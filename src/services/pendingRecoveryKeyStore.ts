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

/** A tab that dies mid-bootstrap must not block the next one forever. */
const SETUP_LOCK_TTL_MS = 2 * 60 * 1000;

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

/**
 * Take the per-user bootstrap lock. Two tabs bootstrapping at once would
 * create two recovery keys and leave the loser's backup unreadable, so only
 * the caller that gets `true` may run `setUpRecovery`.
 */
export const beginRecoverySetup = (userId: string): boolean => {
	const lockKey = `${SETUP_LOCK_PREFIX}${userId}`;
	const startedAt = Number(readItem(lockKey));
	if (startedAt && Date.now() - startedAt < SETUP_LOCK_TTL_MS) {
		return false;
	}
	writeItem(lockKey, String(Date.now()));
	return true;
};

export const endRecoverySetup = (userId: string): void =>
	removeItem(`${SETUP_LOCK_PREFIX}${userId}`);
