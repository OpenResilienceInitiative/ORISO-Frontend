/**
 * Holds the one key that seals the login recovery handoff, in IndexedDB — the
 * only browser store that keeps a non-extractable CryptoKey across a document
 * load. Separate from session storage, so the ciphertext alone opens nothing.
 */
const DATABASE = 'oriso-login-handoff';
const STORE = 'key';
const SLOT = 'current';

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

export const putHandoffKey = async (key: CryptoKey): Promise<void> => {
	await run('readwrite', (store) => store.put(key, SLOT));
};

/** Reads and deletes in one transaction: a key is handed out at most once. */
export const takeHandoffKey = async (): Promise<CryptoKey | null> => {
	let key: CryptoKey | undefined;
	await run('readwrite', (store) => {
		const read = store.get(SLOT);
		read.onsuccess = () => {
			key = read.result;
			store.delete(SLOT);
		};
		return read;
	});
	return key ?? null;
};

export const dropHandoffKey = (): void => {
	if (typeof indexedDB === 'undefined') return;
	run('readwrite', (store) => store.delete(SLOT)).catch(() => undefined);
};
