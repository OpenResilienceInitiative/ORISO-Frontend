/**
 * Regression guard for #980 — "Message dropdown menu is displayed in English
 * despite German language settings".
 *
 * Root cause: every label of the message action menu was rendered through
 * `translate('message.menu.…', 'English default')`, but none of those keys had
 * ever been added to a catalogue. react-i18next therefore fell back to the
 * inline English default in *every* language, so the menu stayed English no
 * matter what the user had configured.
 *
 * The guard is deliberately source-driven rather than a snapshot of one menu:
 * it reads the translate() call sites out of `MessageItemComponent.tsx` and
 * asserts that every `message.*` key they reference actually resolves in de
 * and en. Those two plus the de@informal Du overlay are the catalogues
 * authored in this repo. A new hardcoded-default label with a missing key
 * reintroduces the bug and fails here.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import deCommon from '../../resources/i18n/de/common.json';
import enCommon from '../../resources/i18n/en/common.json';

const SOURCE = readFileSync(
	join(__dirname, 'MessageItemComponent.tsx'),
	'utf-8'
);

/** `translate('some.key'` — prettier may wrap the argument onto its own line. */
const TRANSLATE_KEY = /translate\(\s*'([^']+)'/g;

const resolve = (catalogue: unknown, key: string): unknown =>
	key
		.split('.')
		.reduce<unknown>(
			(node, part) =>
				node && typeof node === 'object'
					? (node as Record<string, unknown>)[part]
					: undefined,
			catalogue
		);

const messageKeys = Array.from(SOURCE.matchAll(TRANSLATE_KEY))
	.map((match) => match[1])
	.filter((key) => key.startsWith('message.'))
	.filter((key, index, all) => all.indexOf(key) === index)
	.sort();

/** The labels the reporter saw in English (screenshot on #980). */
const ACTION_MENU_KEYS = [
	'message.menu.open',
	'message.menu.replyDirect',
	'message.menu.replyThread',
	'message.menu.edit',
	'message.menu.markText',
	'message.menu.forward',
	'message.menu.delete'
];

describe('message action menu i18n (#980)', () => {
	it('finds the translate() call sites it is supposed to guard', () => {
		expect(messageKeys.length).toBeGreaterThan(10);
		ACTION_MENU_KEYS.forEach((key) => {
			expect(messageKeys).toContain(key);
		});
	});

	it.each(ACTION_MENU_KEYS)('has a German label for %s', (key) => {
		const german = resolve(deCommon, key);
		expect(typeof german).toBe('string');
		expect(german).not.toBe('');
		// A German catalogue entry that merely repeats the English one would
		// still show up as "English menu" to the counsellor.
		expect(german).not.toBe(resolve(enCommon, key));
	});

	it('resolves every message.* key used by MessageItemComponent', () => {
		const unresolved = messageKeys.filter(
			(key) =>
				typeof resolve(deCommon, key) !== 'string' ||
				typeof resolve(enCommon, key) !== 'string'
		);

		expect(unresolved).toEqual([]);
	});

	it('no longer relies on a hardcoded English aria-label for the kebab', () => {
		expect(SOURCE).not.toContain('aria-label="More"');
	});
});
