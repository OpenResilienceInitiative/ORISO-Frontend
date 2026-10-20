import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	extractStaticTranslationKeys,
	flattenCatalogueKeys
} from '../../utils/i18nCatalogueGuard';
import {
	PRACTICE_SCRIPT_LOCALES,
	practiceScriptBlock,
	type PracticeScriptLocale
} from './scriptTestSupport';

/** Every locale carries exactly the script keys the engine reads. */
const engineKeys = extractStaticTranslationKeys(
	readFileSync(new URL('./ScriptEngine.ts', import.meta.url), 'utf8')
).filter((key) => key.startsWith('practiceScript.'));

const keysOf = (locale: PracticeScriptLocale) =>
	flattenCatalogueKeys({ practiceScript: practiceScriptBlock(locale) });

const valuesOf = (locale: PracticeScriptLocale) =>
	Object.fromEntries(
		keysOf(locale).map((key) => [
			key,
			key.split('.').reduce<any>((node, part) => node[part], {
				practiceScript: practiceScriptBlock(locale)
			})
		])
	) as Record<string, string>;

describe('practiceScript catalogue', () => {
	it('is read through 13 literal keys', () => {
		expect(engineKeys).toHaveLength(13);
	});

	it.each(
		PRACTICE_SCRIPT_LOCALES.filter((locale) => locale !== 'de@informal')
	)('%s has every key the engine reads and none it does not', (locale) => {
		expect(keysOf(locale)).toEqual([...engineKeys].sort());
	});

	it('leaves de@informal empty: no script text differs in the du-form', () => {
		expect(practiceScriptBlock('de@informal')).toEqual({});
	});

	it.each(
		PRACTICE_SCRIPT_LOCALES.filter((locale) => locale !== 'de@informal')
	)('%s has no empty value, placeholder or markup', (locale) => {
		for (const [key, value] of Object.entries(valuesOf(locale))) {
			expect(value.trim(), key).not.toBe('');
			expect(value, key).not.toMatch(/\{\{|\$t\(|<[^>]+>/);
		}
	});

	it.each(['ru', 'ti'] as const)(
		'%s is written in its own script, not transliterated or copied from English',
		(locale) => {
			const own =
				locale === 'ru'
					? /\p{Script=Cyrillic}/u
					: /\p{Script=Ethiopic}/u;
			for (const [key, value] of Object.entries(valuesOf(locale))) {
				expect(value, key).toMatch(own);
			}
		}
	);

	it('marks the cast as practice in every locale with a different word', () => {
		const suffixes = PRACTICE_SCRIPT_LOCALES.filter(
			(locale) => locale !== 'de@informal'
		).map(
			(locale) =>
				/\(([^)]+)\)$/.exec(
					valuesOf(locale)['practiceScript.cast.asker']
				)?.[1]
		);

		expect(suffixes).toEqual([
			'Übung',
			'practice',
			'exercice',
			'практика',
			'ልምምድ',
			'alıştırma'
		]);
	});
});
