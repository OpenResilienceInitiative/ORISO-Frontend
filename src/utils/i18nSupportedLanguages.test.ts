import { describe, expect, it } from 'vitest';
import { collectSupportedLanguages } from './i18nSupportedLanguages';

const collect = (
	overrides: Partial<Parameters<typeof collectSupportedLanguages>[0]> = {}
) =>
	collectSupportedLanguages({
		weblateLanguages: [],
		weblateCoverageAvailable: false,
		bundledLanguages: ['de', 'de@informal'],
		supportedLngs: ['de', 'de@informal', 'uk'],
		fallbackLng: 'de',
		...overrides
	});

describe('supported language gate (ORISO-Frontend#1154)', () => {
	it('withholds a tenant language Weblate does not qualify', () => {
		expect(
			collect({
				weblateLanguages: ['fr'],
				weblateCoverageAvailable: true
			})
		).not.toContain('uk');
	});

	/**
	 * The bug this pins: a Weblate request that succeeds and qualifies nothing
	 * returns an empty list, exactly like a request that failed. Reading
	 * "empty" as "no coverage data" let every tenant language back in — and
	 * disabled the gate precisely for the tenant whose languages are all below
	 * the threshold, which is the case it exists to catch.
	 */
	it('keeps gating when Weblate answers successfully but qualifies nothing', () => {
		expect(
			collect({
				weblateLanguages: [],
				weblateCoverageAvailable: true
			})
		).not.toContain('uk');
	});

	it('admits every requested language when the Weblate request failed', () => {
		expect(
			collect({
				weblateLanguages: [],
				weblateCoverageAvailable: false
			})
		).toContain('uk');
	});

	it('admits every requested language when Weblate is not configured', () => {
		expect(
			collect({
				weblateLanguages: [],
				weblateCoverageAvailable: false,
				supportedLngs: ['de', 'fr', 'ru']
			})
		).toEqual(['de', 'fr', 'ru']);
	});

	it('never withholds a language that ships a bundled catalogue', () => {
		expect(
			collect({
				weblateLanguages: [],
				weblateCoverageAvailable: true,
				bundledLanguages: ['de', 'de@informal', 'fr', 'ru'],
				supportedLngs: ['de', 'fr', 'ru', 'uk']
			})
		).toEqual(['de', 'fr', 'ru']);
	});

	it('keeps the fallback and informal variants whatever Weblate says', () => {
		const languages = collect({
			weblateLanguages: [],
			weblateCoverageAvailable: true,
			bundledLanguages: [],
			supportedLngs: ['de', 'de@informal', 'uk@informal', 'uk']
		});

		expect(languages).toContain('de');
		expect(languages).toContain('de@informal');
		expect(languages).toContain('uk@informal');
		expect(languages).not.toContain('uk');
	});

	it('adds languages Weblate qualifies that the config did not list', () => {
		expect(
			collect({
				weblateLanguages: ['ti'],
				weblateCoverageAvailable: true,
				supportedLngs: ['de']
			})
		).toContain('ti');
	});

	it('does not repeat a language listed by both Weblate and the config', () => {
		const languages = collect({
			weblateLanguages: ['fr'],
			weblateCoverageAvailable: true,
			supportedLngs: ['de', 'fr']
		});

		expect(languages.filter((lng) => lng === 'fr')).toHaveLength(1);
	});

	it.each([[[] as string[]], [false as const], [undefined]])(
		'falls back to the German pair when the config asks for %s',
		(supportedLngs) => {
			expect(collect({ supportedLngs })).toEqual(['de', 'de@informal']);
		}
	);
});
