/**
 * Silent key-backup setup (#839 follow-up): the app bootstraps the Tresor
 * right after login without asking, so the generated recovery key has no
 * dialog to be shown in. It is parked here — per user — until the Sicherheit
 * panel has shown it and the user confirmed they wrote it down.
 *
 * The key sits in localStorage next to the Rust crypto store, which already
 * holds this device's Megolm keys; parking it there trades a slightly larger
 * local blast radius for a backup that actually exists (ADR-019). It is
 * deleted on confirmation, so the window is as short as the user makes it.
 */

const PENDING_KEY_PREFIX = 'oriso.pendingRecoveryKey.';
const SETUP_LOCK_PREFIX = 'oriso.recoverySetupInFlight.';

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

export const savePendingRecoveryKey = (
	userId: string,
	encodedRecoveryKey: string
): void => writeItem(`${PENDING_KEY_PREFIX}${userId}`, encodedRecoveryKey);

export const getPendingRecoveryKey = (userId: string): string | null =>
	readItem(`${PENDING_KEY_PREFIX}${userId}`);

export const clearPendingRecoveryKey = (userId: string): void =>
	removeItem(`${PENDING_KEY_PREFIX}${userId}`);

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
export const withRecoverySetupLock = async <T>(
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
