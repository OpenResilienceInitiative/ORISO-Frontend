/**
 * Holds the keys that seal login recovery handoffs, in IndexedDB — the only
 * browser store that keeps a non-extractable CryptoKey across a document load.
 * Separate from session storage, so the ciphertext alone opens nothing.
 *
 * IndexedDB is shared by every tab of the origin while each tab's ciphertext
 * sits in its own session storage, so every handoff gets its own slot, named
 * by a random id recorded next to its ciphertext. A tab closed before its
 * handoff was read leaves a key behind; the next put sweeps expired ones.
 */
const DATABASE = 'oriso-login-handoff';
const STORE = 'key';

type Entry = { key: CryptoKey; expiresAt: number };

const open = (): Promise<IDBDatabase> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});

// Each operation opens its own connection, so without a queue a fire-and-forget
// drop from a clear could land after the put of the handoff staged right after it.
let queue: Promise<unknown> = Promise.resolve();
const run = <T>(
	mode: IDBTransactionMode,
	act: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
	const next = queue.then(() => transact(mode, act));
	queue = next.catch(() => undefined);
	return next;
};

const transact = async <T>(
	mode: IDBTransactionMode,
	act: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
	const database = await open();
	try {
		return await new Promise<T>((resolve, reject) => {
			const transaction = database.transaction(STORE, mode);
			const request = act(transaction.objectStore(STORE));
			transaction.oncomplete = () => resolve(request.result);
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
	} finally {
		database.close();
	}
};

export const putHandoffKey = async (
	id: string,
	key: CryptoKey,
	expiresAt: number
): Promise<void> => {
	await run('readwrite', (store) => {
		const now = Date.now();
		const sweep = store.openCursor();
		sweep.onsuccess = () => {
			const cursor = sweep.result;
			if (!cursor) return;
			if (!((cursor.value as Entry | undefined)?.expiresAt > now))
				cursor.delete();
			cursor.continue();
		};
		const entry: Entry = { key, expiresAt };
		return store.put(entry, id);
	});
};

/** Reads and deletes in one transaction: a key is handed out at most once. */
export const takeHandoffKey = async (id: string): Promise<CryptoKey | null> => {
	let entry: Entry | undefined;
	await run('readwrite', (store) => {
		const read = store.get(id);
		read.onsuccess = () => {
			entry = read.result;
			store.delete(id);
		};
		return read;
	});
	return entry?.key ?? null;
};

export const dropHandoffKey = (id: string): void => {
	if (typeof indexedDB === 'undefined') return;
	run('readwrite', (store) => store.delete(id)).catch(() => undefined);
};
