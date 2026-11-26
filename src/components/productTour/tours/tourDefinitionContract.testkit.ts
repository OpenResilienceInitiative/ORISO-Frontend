import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { expect, it } from 'vite-plus/test';
import type { TourDefinition } from '../types';

const i18nRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../../resources/i18n'
);
/** Every bundled language must carry every key (missing keys fail silently). */
export const BUNDLED_LOCALES = ['de', 'en', 'fr', 'ru', 'tr', 'ti'] as const;

const catalogue = (locale: string) =>
	JSON.parse(readFileSync(`${i18nRoot}/${locale}/common.json`, 'utf8'));

const lookup = (bundle: Record<string, unknown>, key: string) =>
	key
		.split('.')
		.reduce<unknown>(
			(node, part) =>
				node && typeof node === 'object'
					? (node as Record<string, unknown>)[part]
					: undefined,
			bundle
		);

const keysOf = (tour: TourDefinition) => [
	tour.titleKey,
	tour.summaryKey,
	...tour.steps.flatMap((step) => [step.titleKey, step.contentKey])
];

/**
 * The shared contract every use-case tour must keep (FE#2339): version 1,
 * unique lowercase step ids, watch-only (no step waits for a real action),
 * only centred steps without a target, and copy in every bundled language.
 */
export const itKeepsTheTourContract = (
	tour: TourDefinition,
	audience: TourDefinition['audiences'][number],
	/** A tour whose content changed counts as new (FE#2545: Live-Chat is 2). */
	version = 1
) => {
	it(`${tour.id}: is a version-${version} frontend tour for ${audience}`, () => {
		expect(tour.version).toBe(version);
		expect(tour.surface).toBe('frontend');
		expect(tour.audiences).toEqual([audience]);
	});

	it(`${tour.id}: has unique short lowercase step ids`, () => {
		const ids = tour.steps.map((step) => step.id);
		expect(new Set(ids).size).toBe(ids.length);
		ids.forEach((id) => expect(id).toMatch(/^[a-z][a-z0-9-]{0,63}$/));
	});

	it(`${tour.id}: is watch-only and never waits for a real action`, () => {
		tour.steps.forEach((step) => expect(step.advanceOn).toBeUndefined());
	});

	it(`${tour.id}: centres exactly the steps without a page target`, () => {
		tour.steps
			.filter((step) => step.target === '')
			.forEach((step) => expect(step.placement).toBe('center'));
	});

	it.each(BUNDLED_LOCALES)(`${tour.id}: has its copy in %s`, (locale) => {
		const bundle = catalogue(locale);
		keysOf(tour).forEach((key) =>
			expect(
				typeof lookup(bundle, key) === 'string' &&
					(lookup(bundle, key) as string).trim().length > 0,
				`${locale}: ${key}`
			).toBe(true)
		);
	});
};
