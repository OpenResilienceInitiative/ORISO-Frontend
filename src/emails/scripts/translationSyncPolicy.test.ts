import { describe, expect, it } from 'vitest';
import {
	parseTranslationSyncOptions,
	requireTranslationLocaleBaseline
} from './translationSyncPolicy';

const parse = (args: string[]) =>
	parseTranslationSyncOptions(args, ['fr', 'tr'], ['invitation', 'reset']);

describe('translation sync exceptions', () => {
	it('requires a named locale and occasion for force', () => {
		expect(parse(['--force=fr/reset']).forcedPairs).toEqual(
			new Set(['fr/reset'])
		);
		expect(() => parse(['--force'])).toThrow('Unknown');
		expect(() => parse(['--force=fr/unknown'])).toThrow(
			'Invalid --force pair'
		);
		expect(() => parse(['--force=unknown/reset'])).toThrow(
			'Invalid --force pair'
		);
	});

	it('requires a named supported locale for a new baseline', () => {
		expect(parse(['--new-locale=tr']).newLocales).toEqual(new Set(['tr']));
		expect(() => parse(['--new-locale=unknown'])).toThrow(
			'Invalid --new-locale'
		);
	});

	it('refuses a lost whole locale unless that exact locale is declared new', () => {
		expect(() =>
			requireTranslationLocaleBaseline('fr', false, new Set())
		).toThrow('Translation manifest lost locale fr');
		expect(
			requireTranslationLocaleBaseline('fr', false, new Set(['fr']))
		).toBe(true);
		expect(requireTranslationLocaleBaseline('fr', true, new Set())).toBe(
			false
		);
	});

	it('keeps check mode read-only and rejects unknown arguments', () => {
		expect(parse(['--check']).check).toBe(true);
		expect(() => parse(['--check', '--force=fr/reset'])).toThrow(
			'--check cannot'
		);
		expect(() => parse(['--check', '--new-locale=tr'])).toThrow(
			'--check cannot'
		);
		expect(() => parse(['--typo'])).toThrow('Unknown');
	});
});
