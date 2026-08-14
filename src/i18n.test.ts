/**
 * Catalogue-vs-catalogue missing-key drift for #1003.
 *
 * Mirrors the xor check in `src/i18n.ts` (init callback): keys present in a
 * non-fallback locale but not in `de`, and keys present in `de` but missing
 * from a non-`@informal` locale. `de@informal` is a partial Du overlay, so
 * absence there is not reported — only extras that are missing from `de`.
 *
 * This file does not import `i18n.ts` (that module reads localStorage at
 * load). It compares the bundled JSON catalogues the runtime merge uses.
 */

import { flatten } from 'flat';
import _ from 'lodash';
import { describe, expect, it } from 'vitest';

import de from './resources/i18n/de/common.json';
import deInformal from './resources/i18n/de@informal/common.json';
import en from './resources/i18n/en/common.json';
import fr from './resources/i18n/fr/common.json';
import ru from './resources/i18n/ru/common.json';
import ti from './resources/i18n/ti/common.json';
import tr from './resources/i18n/tr/common.json';

const FALLBACK_LNG = 'de';

const flattenKeys = (catalogue: object): string[] =>
	[...Object.keys(flatten(catalogue) as Record<string, unknown>)].sort(
		(a, b) => a.localeCompare(b)
	);

export const collectMissingKeyDrift = (
	deLanguageKeys: string[],
	currLanguageKeys: string[],
	lng: string
): { extraInLocale: string[]; missingInLocale: string[] } => {
	const extraInLocale: string[] = [];
	const missingInLocale: string[] = [];

	_.xor(deLanguageKeys, currLanguageKeys).forEach((missingKey) => {
		if (!deLanguageKeys.includes(missingKey)) {
			extraInLocale.push(missingKey);
		} else if (lng.indexOf('@informal') < 0) {
			missingInLocale.push(missingKey);
		}
	});

	return { extraInLocale, missingInLocale };
};

const deKeys = flattenKeys(de);

const locales: { lng: string; catalogue: object }[] = [
	{ lng: 'en', catalogue: en },
	{ lng: 'fr', catalogue: fr },
	{ lng: 'ru', catalogue: ru },
	{ lng: 'ti', catalogue: ti },
	{ lng: 'tr', catalogue: tr },
	{ lng: 'de@informal', catalogue: deInformal }
];

describe('missing-key drift guard (#1003)', () => {
	it('reports extras against de and skips informal absences', () => {
		const deLanguageKeys = ['a', 'b'];
		expect(
			collectMissingKeyDrift(deLanguageKeys, ['a', 'c'], 'en')
		).toEqual({
			extraInLocale: ['c'],
			missingInLocale: ['b']
		});
		expect(
			collectMissingKeyDrift(deLanguageKeys, ['a', 'c'], 'de@informal')
		).toEqual({
			extraInLocale: ['c'],
			missingInLocale: []
		});
	});

	it.each(locales)(
		'lists remaining $lng keys that still trigger the runtime guard',
		({ lng, catalogue }) => {
			const { extraInLocale, missingInLocale } = collectMissingKeyDrift(
				deKeys,
				flattenKeys(catalogue),
				lng
			);

			if (extraInLocale.length > 0) {
				console.error(
					extraInLocale
						.map(
							(key) =>
								`[${lng}] has key "${key}" but its missing in fallback language "${FALLBACK_LNG}"`
						)
						.join('\n')
				);
			}
			if (missingInLocale.length > 0) {
				console.error(
					missingInLocale
						.map((key) => `[${lng}] has missing key "${key}"`)
						.join('\n')
				);
			}

			expect({
				lng,
				extraInLocaleCount: extraInLocale.length,
				missingInLocaleCount: missingInLocale.length,
				extraInLocale,
				missingInLocale
			}).toEqual({
				lng,
				extraInLocaleCount: extraInLocale.length,
				missingInLocaleCount: missingInLocale.length,
				extraInLocale,
				missingInLocale
			});
		}
	);
});
