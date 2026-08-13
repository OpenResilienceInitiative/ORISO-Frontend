import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The "no counselling centre found" empty state is the first thing an advice
 * seeker sees when their postcode has no match, so a missing translation shows
 * German text to an English, French, Russian or Tigrinya speaker.
 *
 * That is exactly what happened: the component read
 * `registration.agency.noresult.*`, which only ever existed in `de` and `tr`,
 * while the fully translated equivalents live under
 * `registration.agencySelection.postcode.*`.
 */

const LOCALES = ['de', 'de@informal', 'en', 'fr', 'ru', 'ti', 'tr'];

const USED_KEYS = [
	'registration.agencySelection.postcode.unavailable.title',
	'registration.agencySelection.postcode.unavailable.text',
	'registration.agencySelection.postcode.search'
];

function readKey(locale: string, dottedKey: string): unknown {
	const file = path.join(
		__dirname,
		'../../../resources/i18n',
		locale,
		'common.json'
	);
	const contents = JSON.parse(fs.readFileSync(file, 'utf8'));
	return dottedKey
		.split('.')
		.reduce<unknown>(
			(node, segment) =>
				node && typeof node === 'object'
					? (node as Record<string, unknown>)[segment]
					: undefined,
			contents
		);
}

describe('agency selection empty state translations', () => {
	for (const locale of LOCALES) {
		for (const key of USED_KEYS) {
			it(`${locale} defines ${key}`, () => {
				const value = readKey(locale, key);
				expect(typeof value, `${key} missing in ${locale}`).toBe(
					'string'
				);
				expect((value as string).trim().length).toBeGreaterThan(0);
			});
		}
	}
});
