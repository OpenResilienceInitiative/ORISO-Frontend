import { useEffect, useSyncExternalStore } from 'react';
import {
	notifyRecoveryState,
	subscribeRecoveryState
} from './recoveryReminderState';
import {
	dropHandoffKey,
	putHandoffKey,
	readHandoffKey
} from './loginHandoffKeyStore';
/**
 * Silent key-backup setup (#839 follow-up): the app bootstraps the Tresor
 * right after login without asking, so the generated recovery key has no
 * dialog to be shown in. It is parked here — per user — until the Sicherheit
 * panel has shown it and the user confirmed they wrote it down.
 *
 * At rest the key is only ever AES-GCM ciphertext, sealed like the login
 * handoff: its non-extractable CryptoKey sits in `loginHandoffKeyStore`
 * (IndexedDB), so a copy of Web Storage alone reveals nothing. Reads go through an in-memory cache, filled by
 * `loadPendingRecoveryKey`. Without IndexedDB/WebCrypto the key stays in
 * memory only — never plaintext on disk.
 *
 * A key the login password already protects (LOGIN_PASSWORD mode) is a
 * convenience copy: it expires after a week and is dropped on logout. A key
 * from RECOVERY_KEY mode is the only copy and is kept until confirmed (#1071).
 */

const PENDING_KEY_PREFIX = 'oriso.pendingRecoveryKey.';
const SETUP_LOCK_PREFIX = 'oriso.recoverySetupInFlight.';
export const PASSWORD_PROTECTED_KEY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sealId = (userId: string) => `pendingRecoveryKey:${userId}`;
/** Keys the login password does not protect never expire in the key store. */
const NO_EXPIRY = Number.MAX_SAFE_INTEGER;

type Envelope = { v: 2; iv: string; ct: string; exp?: number };
type Entry = { key: string; exp?: number };

/**
 * A tab that dies mid-bootstrap must not block the next one forever, so the
 * lock expires — but a live owner keeps it alive by heartbeat, so the TTL only
 * ever fires for a tab that is actually gone.
 */
const SETUP_LOCK_TTL_MS = 60 * 1000;
const SETUP_LOCK_HEARTBEAT_MS = 20 * 1000;

export class RecoverySetupBusyError extends Error {
	constructor() {
		super('Another tab is already setting the Tresor up');
		this.name = 'RecoverySetupBusyError';
	}
}

const readItem = (key: string): string | null => {
	try {
		return localStorage.getItem(key);
	} catch {
		// Private mode / disabled storage — behave like "nothing stored".
		return null;
	}
};

const writeItem = (key: string, value: string): void => {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Best effort: without storage the user can still set up manually.
	}
};

const removeItem = (key: string): void => {
	try {
		localStorage.removeItem(key);
	} catch {
		// Nothing to clean up when storage is unavailable.
	}
};

const canSeal = (): boolean =>
	typeof indexedDB !== 'undefined' && !!globalThis.crypto?.subtle;

const toBase64 = (bytes: ArrayBuffer | Uint8Array): string =>
	btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text: string): Uint8Array =>
	Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
const aad = (userId: string) => new TextEncoder().encode(userId);

const parseEnvelope = (raw: string): Envelope | null => {
	try {
		const value = JSON.parse(raw);
		return value?.v === 2 &&
			typeof value.iv === 'string' &&
			typeof value.ct === 'string'
			? value
			: null;
	} catch {
		return null;
	}
};

const cache = new Map<string, Entry>();
const hydrations = new Map<string, Promise<string | null>>();
const generations = new Map<string, number>();
const bump = (userId: string): number => {
	const next = (generations.get(userId) ?? 0) + 1;
	generations.set(userId, next);
	return next;
};
const isExpired = (exp?: number): boolean =>
	exp !== undefined && exp <= Date.now();

const persist = async (
	userId: string,
	entry: Entry,
	generation: number
): Promise<void> => {
	if (!canSeal()) return;
	const key = await crypto.subtle.generateKey(
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, additionalData: aad(userId) },
		key,
		new TextEncoder().encode(entry.key)
	);
	// A clear or newer save while encrypting wins over this stale write.
	if (generations.get(userId) !== generation) return;
	await putHandoffKey(sealId(userId), key, entry.exp ?? NO_EXPIRY);
	if (generations.get(userId) !== generation) return;
	const envelope: Envelope = { v: 2, iv: toBase64(iv), ct: toBase64(ct) };
	if (entry.exp !== undefined) envelope.exp = entry.exp;
	writeItem(`${PENDING_KEY_PREFIX}${userId}`, JSON.stringify(envelope));
};

let persisting: Promise<void> = Promise.resolve();
const store = (userId: string, entry: Entry): void => {
	cache.set(userId, entry);
	const generation = bump(userId);
	notifyRecoveryState();
	// Sealing is async; readers use the cache, so callers need not wait.
	persisting = persisting
		.then(() => persist(userId, entry, generation))
		.catch(() => {});
};
/** Tests reset Web Storage between cases; the decrypted cache must follow. */
export const resetPendingRecoveryKeyCacheForTests = (): void => {
	cache.clear();
	generations.clear();
	hydrations.clear();
};
/** Resolves once every save so far has reached storage (or given up). */
export const pendingRecoveryKeyPersisted = (): Promise<void> => persisting;

export const savePendingRecoveryKey = (
	userId: string,
	encodedRecoveryKey: string,
	options: { protectedByPassword?: boolean } = {}
): void =>
	store(userId, {
		key: encodedRecoveryKey,
		exp: options.protectedByPassword
			? Date.now() + PASSWORD_PROTECTED_KEY_TTL_MS
			: undefined
	});

/** The login password now guards the key: the parked copy may expire. */
export const markPendingRecoveryKeyPasswordProtected = (
	userId: string
): void => {
	const entry = cache.get(userId);
	if (!entry || entry.exp !== undefined) return;
	savePendingRecoveryKey(userId, entry.key, {
		protectedByPassword: true
	});
};

const forget = (userId: string): void => {
	cache.delete(userId);
	bump(userId);
	removeItem(`${PENDING_KEY_PREFIX}${userId}`);
	dropHandoffKey(sealId(userId));
};

export const getPendingRecoveryKey = (userId: string): string | null => {
	const entry = cache.get(userId);
	if (!entry) return null;
	if (isExpired(entry.exp)) {
		forget(userId);
		return null;
	}
	return entry.key;
};

const hydrate = async (userId: string): Promise<string | null> => {
	const generation = generations.get(userId);
	const storageKey = `${PENDING_KEY_PREFIX}${userId}`;
	const raw = readItem(storageKey);
	if (!raw) return null;
	const envelope = parseEnvelope(raw);
	if (!envelope) {
		// Plaintext from an older build: adopt it and re-store it encrypted.
		if (generations.get(userId) === generation) store(userId, { key: raw });
		return getPendingRecoveryKey(userId);
	}
	if (isExpired(envelope.exp)) {
		forget(userId);
		return null;
	}
	if (!canSeal()) return null;
	try {
		const key = await readHandoffKey(sealId(userId));
		if (!key) throw new Error('seal key gone');
		const plain = await crypto.subtle.decrypt(
			{
				name: 'AES-GCM',
				iv: fromBase64(envelope.iv),
				additionalData: aad(userId)
			},
			key,
			fromBase64(envelope.ct)
		);
		if (generations.get(userId) !== generation)
			return getPendingRecoveryKey(userId);
		cache.set(userId, {
			key: new TextDecoder().decode(plain),
			exp: envelope.exp
		});
		notifyRecoveryState();
	} catch {
		// Seal key is gone (site data partly cleared): unreadable for good.
		if (generations.get(userId) === generation) forget(userId);
	}
	return getPendingRecoveryKey(userId);
};

/** Resolves the parked key, decrypting it from storage on first use. */
export const loadPendingRecoveryKey = (
	userId: string
): Promise<string | null> => {
	if (cache.has(userId))
		return Promise.resolve(getPendingRecoveryKey(userId));
	let pending = hydrations.get(userId);
	if (!pending) {
		pending = hydrate(userId).finally(() => hydrations.delete(userId));
		hydrations.set(userId, pending);
	}
	return pending;
};

export const usePendingRecoveryKey = (userId: string): string | null => {
	useEffect(() => {
		if (userId) void loadPendingRecoveryKey(userId);
	}, [userId]);
	return useSyncExternalStore(
		subscribeRecoveryState,
		() => (userId ? getPendingRecoveryKey(userId) : null),
		() => null
	);
};

export const clearPendingRecoveryKey = (userId: string): void => {
	forget(userId);
	notifyRecoveryState();
};

/**
 * Logout/startup sweep: drops password-protected copies (after logout) or
 * only expired ones, and never a RECOVERY_KEY-mode key — that is the only copy.
 */
export const purgeParkedRecoveryKeys = (
	scope: 'expired' | 'passwordProtected'
): void => {
	const doomed: string[] = [];
	try {
		for (let index = 0; index < localStorage.length; index++) {
			const storageKey = localStorage.key(index);
			if (!storageKey?.startsWith(PENDING_KEY_PREFIX)) continue;
			const exp = parseEnvelope(readItem(storageKey) ?? '')?.exp;
			if (
				exp !== undefined &&
				(scope === 'passwordProtected' || isExpired(exp))
			)
				doomed.push(storageKey);
		}
	} catch {
		// Storage unavailable: nothing parked there.
	}
	cache.forEach((entry, userId) => {
		if (
			entry.exp !== undefined &&
			(scope === 'passwordProtected' || isExpired(entry.exp))
		)
			doomed.push(`${PENDING_KEY_PREFIX}${userId}`);
	});
	if (!doomed.length) return;
	new Set(doomed).forEach((storageKey) =>
		forget(storageKey.slice(PENDING_KEY_PREFIX.length))
	);
	notifyRecoveryState();
};

if (typeof window !== 'undefined')
	window.addEventListener('storage', (event) => {
		if (!event.key?.startsWith(PENDING_KEY_PREFIX)) return;
		// Another tab saved or cleared: our decrypted copy is stale.
		const userId = event.key.slice(PENDING_KEY_PREFIX.length);
		cache.delete(userId);
		bump(userId);
		if (event.newValue) void loadPendingRecoveryKey(userId);
		else notifyRecoveryState();
	});

const newOwnerToken = (): string =>
	typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const readLock = (userId: string): { owner: string; heldAt: number } | null => {
	const raw = readItem(`${SETUP_LOCK_PREFIX}${userId}`);
	if (!raw) {
		return null;
	}
	const separator = raw.lastIndexOf(':');
	const heldAt = Number(raw.slice(separator + 1));
	if (separator < 0 || !heldAt) {
		return null;
	}
	return { owner: raw.slice(0, separator), heldAt };
};

/**
 * Take the per-user bootstrap lock. Two tabs bootstrapping at once would
 * create two recovery keys and leave the loser's backup unreadable, so only
 * the caller that gets a token back may run `setUpRecovery`.
 */
export const beginRecoverySetup = (userId: string): string | null => {
	const held = readLock(userId);
	if (held && Date.now() - held.heldAt < SETUP_LOCK_TTL_MS) {
		return null;
	}
	const owner = newOwnerToken();
	writeItem(`${SETUP_LOCK_PREFIX}${userId}`, `${owner}:${Date.now()}`);
	return owner;
};

/**
 * Keep the lock alive while the setup runs. Returns false once the lock is
 * gone or has been taken over — the caller has lost it and must stop
 * heartbeating so it never stamps its token over the new owner's.
 */
export const refreshRecoverySetup = (
	userId: string,
	owner: string
): boolean => {
	if (readLock(userId)?.owner !== owner) {
		return false;
	}
	writeItem(`${SETUP_LOCK_PREFIX}${userId}`, `${owner}:${Date.now()}`);
	return true;
};

/** Release the lock — but only ever our own. */
export const endRecoverySetup = (userId: string, owner: string): void => {
	if (readLock(userId)?.owner === owner) {
		removeItem(`${SETUP_LOCK_PREFIX}${userId}`);
	}
};

/**
 * Run `setUpRecovery` (or any other bootstrap) under the cross-tab lock, held
 * for the whole call and released only by its owner. Throws
 * `RecoverySetupBusyError` when someone else is already at it.
 */
const withStorageRecoverySetupLock = async <T>(
	userId: string,
	run: () => Promise<T>
): Promise<T> => {
	const owner = beginRecoverySetup(userId);
	if (!owner) {
		throw new RecoverySetupBusyError();
	}
	const heartbeat = setInterval(() => {
		if (!refreshRecoverySetup(userId, owner)) {
			clearInterval(heartbeat);
		}
	}, SETUP_LOCK_HEARTBEAT_MS);
	try {
		return await run();
	} finally {
		clearInterval(heartbeat);
		endRecoverySetup(userId, owner);
	}
};

/** Browser Web Locks serialize the entire operation, including its server recheck. */
export const withRecoverySetupLock = async <T>(
	userId: string,
	run: () => Promise<T>
): Promise<T> => {
	if (typeof navigator !== 'undefined' && navigator.locks) {
		return navigator.locks.request(
			`oriso.recovery.${userId}`,
			{ ifAvailable: true },
			(lock) => {
				if (!lock) throw new RecoverySetupBusyError();
				return withStorageRecoverySetupLock(userId, run);
			}
		);
	}
	return withStorageRecoverySetupLock(userId, run);
};
