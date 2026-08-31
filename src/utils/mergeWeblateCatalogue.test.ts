import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergeWeblateCatalogue } from './mergeWeblateCatalogue';

const i18nSource = readFileSync(resolve(__dirname, '../i18n.ts'), 'utf8');

describe('mergeWeblateCatalogue (#1154)', () => {
	it('keeps the bundled value when Weblate still has an English placeholder', () => {
		const merged = mergeWeblateCatalogue(
			{ registration: { headline: 'Inscription' } },
			{ registration: { headline: 'Registration' } }
		);

		expect(merged).toEqual({
			registration: { headline: 'Inscription' }
		});
	});

	it('fills a key the bundle does not ship from Weblate', () => {
		const merged = mergeWeblateCatalogue(
			{ registration: { headline: 'Inscription' } },
			{
				registration: {
					headline: 'Registration',
					extra: 'Weblate only'
				}
			}
		);

		expect(merged).toEqual({
			registration: { headline: 'Inscription', extra: 'Weblate only' }
		});
	});

	it('returns the bundle unchanged when Weblate is empty', () => {
		const bundle = { registration: { headline: 'Inscription' } };

		expect(mergeWeblateCatalogue(bundle, {})).toEqual(bundle);
	});

	it('returns Weblate intact when the bundle is empty (Weblate-only locale)', () => {
		const weblate = { registration: { headline: 'Реєстрація' } };

		expect(mergeWeblateCatalogue({}, weblate)).toEqual(weblate);
	});

	it('pins a LocalStorage cache version when merge precedence changes', () => {
		expect(i18nSource).toMatch(
			/export const WEBLATE_TRANSLATION_CACHE_VERSION = '1154-bundle-wins';/
		);
		expect(i18nSource).toMatch(
			/defaultVersion:\s*\n\s*WEBLATE_TRANSLATION_CACHE_VERSION/
		);
	});
});
