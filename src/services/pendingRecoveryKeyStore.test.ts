// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	beginRecoverySetup,
	clearPendingRecoveryKey,
	endRecoverySetup,
	getPendingRecoveryKey,
	savePendingRecoveryKey
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
		expect(beginRecoverySetup(USER)).toBe(true);
		expect(beginRecoverySetup(USER)).toBe(false);
	});

	it('frees the lock again when the flow finishes', () => {
		beginRecoverySetup(USER);
		endRecoverySetup(USER);

		expect(beginRecoverySetup(USER)).toBe(true);
	});

	it('breaks a lock left behind by a tab that never finished', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-12T10:00:00Z'));
		beginRecoverySetup(USER);

		vi.setSystemTime(new Date('2026-08-12T10:03:00Z'));

		expect(beginRecoverySetup(USER)).toBe(true);
	});

	it('keeps locks per user', () => {
		beginRecoverySetup(USER);

		expect(beginRecoverySetup(OTHER_USER)).toBe(true);
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
		expect(beginRecoverySetup(USER)).toBe(true);

		getItem.mockRestore();
		setItem.mockRestore();
	});
});
