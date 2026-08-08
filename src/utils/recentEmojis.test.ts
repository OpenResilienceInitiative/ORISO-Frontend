// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	DEFAULT_QUICK_EMOJIS,
	getQuickEmojis,
	rememberEmoji
} from './recentEmojis';

const createMemoryStorage = (): Storage => {
	const store = new Map<string, string>();
	return {
		get length() {
			return store.size;
		},
		clear: () => store.clear(),
		getItem: (key: string) => store.get(key) ?? null,
		key: (index: number) => Array.from(store.keys())[index] ?? null,
		removeItem: (key: string) => {
			store.delete(key);
		},
		setItem: (key: string, value: string) => {
			store.set(key, String(value));
		}
	};
};

describe('recentEmojis', () => {
	beforeEach(() => {
		// Node 22+ can inject a partial `--localstorage-file` Storage that
		// lacks clear/removeItem; pin a complete in-memory stub instead.
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: createMemoryStorage()
		});
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
		window.localStorage.setItem = () => {
			throw new Error('QuotaExceededError');
		};

		expect(() => rememberEmoji('🎉')).not.toThrow();
	});
});
