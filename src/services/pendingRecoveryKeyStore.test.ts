// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	beginRecoverySetup,
	clearPendingRecoveryKey,
	endRecoverySetup,
	getPendingRecoveryKey,
	loadPendingRecoveryKey,
	markPendingRecoveryKeyPasswordProtected,
	PASSWORD_PROTECTED_KEY_TTL_MS,
	pendingRecoveryKeyPersisted,
	purgeParkedRecoveryKeys,
	RecoverySetupBusyError,
	refreshRecoverySetup,
	resetPendingRecoveryKeyCacheForTests,
	savePendingRecoveryKey,
	withRecoverySetupLock
} from './pendingRecoveryKeyStore';

// vi.mock is hoisted above the imports.
// Stands in for IndexedDB, which jsdom lacks; outlives a simulated reload.
const { sealKeys } = vi.hoisted(() => ({
	sealKeys: new Map<string, { key: CryptoKey; expiresAt: number }>()
}));
vi.mock('./loginHandoffKeyStore', () => ({
	putHandoffKey: async (id: string, key: CryptoKey, expiresAt: number) =>
		void sealKeys.set(id, { key, expiresAt }),
	readHandoffKey: async (id: string) => {
		const entry = sealKeys.get(id);
		return entry && entry.expiresAt > Date.now() ? entry.key : null;
	},
	dropHandoffKey: (id: string) => void sealKeys.delete(id)
}));

const USER = '@abe.simpson:example.org';
const OTHER_USER = '@lisa.simpson:example.org';
const KEY = 'EsTc 1234 5678 90ab cdef';

describe('pendingRecoveryKeyStore (silent key-backup setup)', () => {
	beforeEach(() => {
		localStorage.clear();
		resetPendingRecoveryKeyCacheForTests();
		sealKeys.clear();
		vi.useRealTimers();
		vi.stubGlobal('indexedDB', {});
	});
	afterEach(() => vi.unstubAllGlobals());

	/** Module memory is gone after a document load; storage and IndexedDB are not. */
	const reload = () => resetPendingRecoveryKeyCacheForTests();
	const stored = () =>
		Object.entries(localStorage)
			.filter(([name]) => name.startsWith('oriso.pendingRecoveryKey.'))
			.map(([, value]) => String(value));

	it('hands the parked key back for the user it was stored for', () => {
		savePendingRecoveryKey(USER, KEY);

		expect(getPendingRecoveryKey(USER)).toBe(KEY);
		expect(getPendingRecoveryKey(OTHER_USER)).toBeNull();
	});

	it('drops the key once the user confirmed they stored it', () => {
		savePendingRecoveryKey(USER, KEY);

		clearPendingRecoveryKey(USER);

		expect(getPendingRecoveryKey(USER)).toBeNull();
	});

	it('never writes the key to Web Storage in plain text', async () => {
		savePendingRecoveryKey(USER, KEY);
		await pendingRecoveryKeyPersisted();

		expect(stored()).toHaveLength(1);
		expect(stored()[0]).not.toContain(KEY);
		expect(stored()[0]).not.toContain('EsTc');
	});

	it('survives a reload — decrypted with the sealed key from IndexedDB', async () => {
		savePendingRecoveryKey(USER, KEY);
		await pendingRecoveryKeyPersisted();
		reload();

		expect(getPendingRecoveryKey(USER)).toBeNull();
		expect(await loadPendingRecoveryKey(USER)).toBe(KEY);
		expect(getPendingRecoveryKey(USER)).toBe(KEY);
	});

	it('binds the ciphertext to its user, so a copied entry opens nothing', async () => {
		savePendingRecoveryKey(USER, KEY);
		await pendingRecoveryKeyPersisted();
		localStorage.setItem(
			`oriso.pendingRecoveryKey.${OTHER_USER}`,
			stored()[0]
		);
		sealKeys.set(
			`pendingRecoveryKey:${OTHER_USER}`,
			sealKeys.get(`pendingRecoveryKey:${USER}`)!
		);
		reload();

		expect(await loadPendingRecoveryKey(OTHER_USER)).toBeNull();
	});

	it('keeps the key in memory only when IndexedDB is unavailable', async () => {
		vi.unstubAllGlobals();
		savePendingRecoveryKey(USER, KEY);
		await pendingRecoveryKeyPersisted();

		expect(getPendingRecoveryKey(USER)).toBe(KEY);
		expect(stored()).toHaveLength(0);
	});

	it('adopts a plaintext key from an older build and re-stores it sealed', async () => {
		localStorage.setItem(`oriso.pendingRecoveryKey.${USER}`, KEY);

		expect(await loadPendingRecoveryKey(USER)).toBe(KEY);
		await pendingRecoveryKeyPersisted();
		expect(stored()[0]).not.toContain(KEY);
	});

	it('drops the sealing key together with the entry', async () => {
		savePendingRecoveryKey(USER, KEY);
		await pendingRecoveryKeyPersisted();

		clearPendingRecoveryKey(USER);

		expect(sealKeys.size).toBe(0);
		expect(stored()).toHaveLength(0);
	});

	it('expires a password-protected copy after a week, also across reloads', async () => {
		const now = Date.now();
		const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
		savePendingRecoveryKey(USER, KEY);
		markPendingRecoveryKeyPasswordProtected(USER);
		await pendingRecoveryKeyPersisted();

		clock.mockReturnValue(now + PASSWORD_PROTECTED_KEY_TTL_MS - 1);
		reload();
		expect(await loadPendingRecoveryKey(USER)).toBe(KEY);

		clock.mockReturnValue(now + PASSWORD_PROTECTED_KEY_TTL_MS);
		expect(getPendingRecoveryKey(USER)).toBeNull();
		expect(stored()).toHaveLength(0);
		clock.mockRestore();
	});

	it('never expires a key the login password does not protect — it is the only copy', async () => {
		const now = Date.now();
		const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
		savePendingRecoveryKey(USER, KEY);
		await pendingRecoveryKeyPersisted();

		clock.mockReturnValue(now + 10 * PASSWORD_PROTECTED_KEY_TTL_MS);
		purgeParkedRecoveryKeys('expired');
		reload();
		expect(await loadPendingRecoveryKey(USER)).toBe(KEY);
		clock.mockRestore();
	});

	it('drops password-protected copies on logout but keeps RECOVERY_KEY-mode keys', async () => {
		savePendingRecoveryKey(USER, KEY);
		savePendingRecoveryKey(OTHER_USER, 'other key');
		markPendingRecoveryKeyPasswordProtected(OTHER_USER);
		await pendingRecoveryKeyPersisted();

		purgeParkedRecoveryKeys('passwordProtected');

		expect(getPendingRecoveryKey(OTHER_USER)).toBeNull();
		expect(getPendingRecoveryKey(USER)).toBe(KEY);
		reload();
		expect(await loadPendingRecoveryKey(OTHER_USER)).toBeNull();
		expect(await loadPendingRecoveryKey(USER)).toBe(KEY);
	});

	it('lets the first caller take the setup lock and refuses the second', () => {
		expect(beginRecoverySetup(USER)).toBeTruthy();
		expect(beginRecoverySetup(USER)).toBeNull();
	});

	it('frees the lock again when the flow finishes', () => {
		const owner = beginRecoverySetup(USER);
		endRecoverySetup(USER, owner);

		expect(beginRecoverySetup(USER)).toBeTruthy();
	});

	it('breaks a lock left behind by a tab that never finished', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-12T10:00:00Z'));
		beginRecoverySetup(USER);

		vi.setSystemTime(new Date('2026-08-12T10:03:00Z'));

		expect(beginRecoverySetup(USER)).toBeTruthy();
	});

	it('keeps locks per user', () => {
		beginRecoverySetup(USER);

		expect(beginRecoverySetup(OTHER_USER)).toBeTruthy();
	});

	it('never lets a superseded owner release the new owner’s lock', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-12T10:00:00Z'));
		const stale = beginRecoverySetup(USER);

		// The first tab froze; its lock expires and a second tab takes over.
		vi.setSystemTime(new Date('2026-08-12T10:03:00Z'));
		const fresh = beginRecoverySetup(USER);

		// The first tab finally finishes and tries to clean up after itself.
		endRecoverySetup(USER, stale);

		expect(beginRecoverySetup(USER)).toBeNull();
		expect(refreshRecoverySetup(USER, stale)).toBe(false);
		expect(refreshRecoverySetup(USER, fresh)).toBe(true);
	});

	it('holds the lock for the whole setup, however long it takes', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-12T10:00:00Z'));
		let finish: () => void = () => undefined;
		const slowSetup = withRecoverySetupLock(
			USER,
			() =>
				new Promise<string>((resolve) => {
					finish = () => resolve('done');
				})
		);

		// Well past the TTL — the heartbeat has to keep the lock alive.
		await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
		expect(beginRecoverySetup(USER)).toBeNull();

		finish();
		await expect(slowSetup).resolves.toBe('done');
		expect(beginRecoverySetup(USER)).toBeTruthy();
	});

	it('turns a busy lock into a typed error the caller can react to', async () => {
		beginRecoverySetup(USER);

		await expect(
			withRecoverySetupLock(USER, async () => 'never runs')
		).rejects.toBeInstanceOf(RecoverySetupBusyError);
	});

	it('releases the lock when the setup throws', async () => {
		await expect(
			withRecoverySetupLock(USER, async () => {
				throw new Error('UIA rejected');
			})
		).rejects.toThrow('UIA rejected');

		expect(beginRecoverySetup(USER)).toBeTruthy();
	});

	it('stays silent when localStorage is unavailable', () => {
		const getItem = vi
			.spyOn(Storage.prototype, 'getItem')
			.mockImplementation(() => {
				throw new Error('localStorage disabled');
			});
		const setItem = vi
			.spyOn(Storage.prototype, 'setItem')
			.mockImplementation(() => {
				throw new Error('localStorage disabled');
			});

		expect(() => savePendingRecoveryKey(USER, KEY)).not.toThrow();
		// Held in memory for this document; nothing reaches disk.
		expect(getPendingRecoveryKey(USER)).toBe(KEY);
		// Without storage we cannot coordinate tabs — do not block the setup.
		expect(beginRecoverySetup(USER)).toBeTruthy();

		getItem.mockRestore();
		setItem.mockRestore();
	});
});

it('rejects immediately when another browser tab holds the Web Lock', async () => {
	const run = vi.fn();
	const request = vi.fn(async (_name, options, callback) => {
		expect(options).toEqual({ ifAvailable: true });
		return callback(null);
	});
	vi.stubGlobal('navigator', { locks: { request } });
	try {
		await expect(
			withRecoverySetupLock('@busy:test', run)
		).rejects.toBeInstanceOf(RecoverySetupBusyError);
		expect(run).not.toHaveBeenCalled();
	} finally {
		vi.unstubAllGlobals();
	}
});
