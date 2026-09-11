// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	beginRecoverySetup,
	clearPendingRecoveryKey,
	endRecoverySetup,
	getPendingRecoveryKey,
	RecoverySetupBusyError,
	refreshRecoverySetup,
	savePendingRecoveryKey,
	withRecoverySetupLock
} from './pendingRecoveryKeyStore';

const USER = '@abe.simpson:oriso.org';
const OTHER_USER = '@lisa.simpson:oriso.org';
const KEY = 'EsTc 1234 5678 90ab cdef';

describe('pendingRecoveryKeyStore (silent key-backup setup)', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.useRealTimers();
	});

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

	it('survives a reload — the key lives in localStorage, not in memory', () => {
		savePendingRecoveryKey(USER, KEY);

		const raw = Object.entries(localStorage).find(([, value]) =>
			String(value).includes(KEY)
		);

		expect(raw).toBeTruthy();
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
		expect(getPendingRecoveryKey(USER)).toBeNull();
		// Without storage we cannot coordinate tabs — do not block the setup.
		expect(beginRecoverySetup(USER)).toBeTruthy();

		getItem.mockRestore();
		setItem.mockRestore();
	});
});
