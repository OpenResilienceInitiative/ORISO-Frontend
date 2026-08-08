// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_QUICK_EMOJIS,
	getQuickEmojis,
	rememberEmoji
} from './recentEmojis';

describe('recentEmojis', () => {
	beforeEach(() => {
		// Prefer removeItem: some Node/jsdom hybrids expose a localStorage
		// object without `.clear()` (Vitest then warns about --localstorage-file).
		window.localStorage.removeItem('oriso.recentEmojis');
	});

	it('offers the defaults before the user has picked anything', () => {
		expect(getQuickEmojis()).toEqual(DEFAULT_QUICK_EMOJIS);
	});

	it('puts the most recent pick first and keeps the row full', () => {
		rememberEmoji('🎉');

		const quick = getQuickEmojis();
		expect(quick[0]).toBe('🎉');
		expect(quick).toHaveLength(DEFAULT_QUICK_EMOJIS.length);
	});

	it('does not list the same emoji twice when a default is re-picked', () => {
		rememberEmoji('🙏');

		const quick = getQuickEmojis();
		expect(quick[0]).toBe('🙏');
		expect(new Set(quick).size).toBe(quick.length);
	});

	it('orders by most recent use', () => {
		rememberEmoji('🎉');
		rememberEmoji('🐢');
		rememberEmoji('🎉');

		expect(getQuickEmojis().slice(0, 2)).toEqual(['🎉', '🐢']);
	});

	it('survives unreadable storage', () => {
		window.localStorage.setItem('oriso.recentEmojis', '{ not json');

		expect(getQuickEmojis()).toEqual(DEFAULT_QUICK_EMOJIS);
	});

	it('survives a storage write that throws (private mode)', () => {
		const setItem = vi
			.spyOn(Storage.prototype, 'setItem')
			.mockImplementation(() => {
				throw new Error('QuotaExceededError');
			});

		expect(() => rememberEmoji('🎉')).not.toThrow();

		setItem.mockRestore();
	});
});
