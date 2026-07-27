// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	KEYBOARD_SHORTCUTS_STORAGE_KEY,
	clearShortcutPreferences,
	createDefaultPreferences,
	loadShortcutPreferences,
	saveShortcutPreferences
} from './preferenceStore';
import {
	SEND_BINDING_ALT_ENTER,
	SEND_BINDING_ENTER
} from '../constants/sendOptions';

const store: Record<string, string> = {};

const localStorageMock = {
	getItem: (key: string) => (key in store ? store[key] : null),
	setItem: (key: string, value: string) => {
		store[key] = String(value);
	},
	removeItem: (key: string) => {
		delete store[key];
	},
	clear: () => {
		Object.keys(store).forEach((k) => delete store[k]);
	}
};

describe('preferenceStore', () => {
	beforeEach(() => {
		Object.keys(store).forEach((k) => delete store[k]);
		Object.defineProperty(window, 'localStorage', {
			value: localStorageMock,
			configurable: true
		});
	});

	afterEach(() => {
		localStorageMock.clear();
	});

	it('returns defaults when empty', () => {
		const prefs = loadShortcutPreferences('user-a');
		expect(prefs.version).toBe(1);
		expect(prefs.bindings['chat.sendMessage']).toEqual(
			SEND_BINDING_ALT_ENTER
		);
	});

	it('saves and reloads preferences per user', () => {
		saveShortcutPreferences(
			{
				version: 1,
				bindings: { 'chat.sendMessage': SEND_BINDING_ENTER }
			},
			'user-a'
		);
		expect(
			loadShortcutPreferences('user-a').bindings['chat.sendMessage']
		).toEqual(SEND_BINDING_ENTER);
		expect(
			loadShortcutPreferences('user-b').bindings['chat.sendMessage']
		).toEqual(SEND_BINDING_ALT_ENTER);
	});

	it('falls back on malformed JSON', () => {
		localStorageMock.setItem(KEYBOARD_SHORTCUTS_STORAGE_KEY, '{not-json');
		expect(loadShortcutPreferences('user-a').version).toBe(1);
	});

	it('ignores unknown schema version', () => {
		localStorageMock.setItem(
			KEYBOARD_SHORTCUTS_STORAGE_KEY,
			JSON.stringify({ version: 99, byUser: { 'user-a': {} } })
		);
		expect(
			loadShortcutPreferences('user-a').bindings['chat.sendMessage']
		).toEqual(SEND_BINDING_ALT_ENTER);
	});

	it('ignores unsupported action ids and malformed bindings', () => {
		localStorageMock.setItem(
			KEYBOARD_SHORTCUTS_STORAGE_KEY,
			JSON.stringify({
				version: 1,
				byUser: {
					'user-a': {
						'chat.sendMessage': { key: 123 },
						'not.a.real.action': {
							key: 'K',
							primaryModifier: true
						}
					}
				}
			})
		);
		const prefs = loadShortcutPreferences('user-a');
		expect(prefs.bindings['chat.sendMessage']).toEqual(
			SEND_BINDING_ALT_ENTER
		);
		expect(
			(prefs.bindings as Record<string, unknown>)['not.a.real.action']
		).toBeUndefined();
	});

	it('restore defaults via clear + createDefault', () => {
		saveShortcutPreferences(
			{
				version: 1,
				bindings: { 'chat.sendMessage': SEND_BINDING_ENTER }
			},
			'user-a'
		);
		clearShortcutPreferences('user-a');
		expect(loadShortcutPreferences('user-a')).toEqual(
			createDefaultPreferences()
		);
	});
});
