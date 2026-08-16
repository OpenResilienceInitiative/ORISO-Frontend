import { describe, expect, it } from 'vitest';
import deTranslations from '../../resources/i18n/de/common.json';
import deInformalTranslations from '../../resources/i18n/de@informal/common.json';
import enTranslations from '../../resources/i18n/en/common.json';
import frTranslations from '../../resources/i18n/fr/common.json';
import ruTranslations from '../../resources/i18n/ru/common.json';
import tiTranslations from '../../resources/i18n/ti/common.json';
import trTranslations from '../../resources/i18n/tr/common.json';
import {
	consultantMailCounsellingTour,
	consultantWalkthroughTour,
	frontendTours
} from './tourDefinitions';

const resolveKey = (bundle: object, key: string): unknown =>
	key.split('.').reduce<any>((node, part) => node?.[part], bundle);

// Every locale ships in the bundle and falls back to `de` (src/i18n.ts
// fallbackLng). A tour key must resolve in the locale itself or in the
// fallback — otherwise the tooltip silently shows the raw key.
const bundledLocales: Array<[string, object]> = [
	['de', deTranslations],
	['de@informal', deInformalTranslations],
	['en', enTranslations],
	['fr', frTranslations],
	['ru', ruTranslations],
	['ti', tiTranslations],
	['tr', trTranslations]
];

const resolvesWithFallback = (bundle: object, key: string): boolean =>
	typeof resolveKey(bundle, key) === 'string' ||
	typeof resolveKey(deTranslations, key) === 'string';

describe('consultantWalkthroughTour', () => {
	it('migrates the five legacy walkthrough steps in order', () => {
		expect(consultantWalkthroughTour.id).toBe('consultant-walkthrough');
		expect(consultantWalkthroughTour.version).toBe(1);
		expect(consultantWalkthroughTour.surface).toBe('frontend');
		expect(consultantWalkthroughTour.audiences).toEqual(['consultant']);
		expect(consultantWalkthroughTour.steps).toHaveLength(5);
	});

	it('keeps the legacy route behavior for every step', () => {
		const routes = consultantWalkthroughTour.steps.map((s) => s.route);
		expect(routes).toEqual([
			undefined,
			'/sessions/consultant/sessionPreview',
			'/sessions/consultant/sessionView',
			'/sessions/consultant/sessionView?sessionListTab=archive',
			'/profile/allgemeines'
		]);
	});

	it('positions tooltips inside the fixed-viewport app layout', () => {
		const placements = consultantWalkthroughTour.steps.map(
			(s) => s.placement
		);
		// Full-height list columns need a side placement, the archive chip
		// sits at the top, and the profile step is overlay-centered.
		expect(placements).toEqual([
			'center',
			'right',
			'right',
			'bottom',
			'center'
		]);
	});

	it('opens with a centered step and anchors the rest on semantic targets', () => {
		const [intro, ...anchored] = consultantWalkthroughTour.steps;
		expect(intro.target).toBe('');
		expect(intro.placement).toBe('center');
		anchored.forEach((step) => {
			expect(step.target).not.toBe('');
			expect(step.target).toMatch(/^[a-z0-9-]+$/);
		});
	});

	it('uses only i18n keys that exist in the German and English bundles', () => {
		consultantWalkthroughTour.steps.forEach((step) => {
			[step.titleKey, step.contentKey].forEach((key) => {
				expect(
					typeof resolveKey(deTranslations, key),
					`missing DE key ${key}`
				).toBe('string');
				expect(
					typeof resolveKey(enTranslations, key),
					`missing EN key ${key}`
				).toBe('string');
			});
		});
		[
			consultantWalkthroughTour.titleKey,
			consultantWalkthroughTour.summaryKey
		].forEach((key) => {
			expect(
				typeof resolveKey(deTranslations, key),
				`missing DE key ${key}`
			).toBe('string');
			expect(
				typeof resolveKey(enTranslations, key),
				`missing EN key ${key}`
			).toBe('string');
		});
	});
});

describe('consultantMailCounsellingTour', () => {
	it('is registered for consultants with six migration-framed steps', () => {
		expect(consultantMailCounsellingTour.id).toBe(
			'consultant-mail-counselling'
		);
		expect(consultantMailCounsellingTour.version).toBe(1);
		expect(consultantMailCounsellingTour.surface).toBe('frontend');
		expect(consultantMailCounsellingTour.audiences).toEqual(['consultant']);
		expect(consultantMailCounsellingTour.steps.map((s) => s.id)).toEqual([
			'whats-new',
			'enquiries',
			'accepting',
			'my-sessions',
			'composer',
			'archive'
		]);
	});

	it('marks only the composer step optional so a fresh account can finish', () => {
		const optionalIds = consultantMailCounsellingTour.steps
			.filter((s) => s.optional)
			.map((s) => s.id);
		expect(optionalIds).toEqual(['composer']);
	});

	it('routes through the real consultant session views', () => {
		const routes = consultantMailCounsellingTour.steps.map((s) => s.route);
		expect(routes).toEqual([
			undefined,
			'/sessions/consultant/sessionPreview',
			'/sessions/consultant/sessionPreview',
			'/sessions/consultant/sessionView',
			undefined,
			'/sessions/consultant/sessionView?sessionListTab=archive'
		]);
	});

	it('anchors every non-intro step on a semantic target', () => {
		const [intro, ...anchored] = consultantMailCounsellingTour.steps;
		expect(intro.target).toBe('');
		anchored.forEach((step) => {
			expect(step.target).toMatch(/^[a-z0-9-]+$/);
		});
	});
});

describe('frontendTours registry', () => {
	it('lists both consultant tours with unique ids', () => {
		const ids = frontendTours.map((t) => t.id);
		expect(ids).toEqual([
			'consultant-walkthrough',
			'consultant-mail-counselling'
		]);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('resolves every i18n key of every tour in every bundled locale (incl. fallback)', () => {
		frontendTours.forEach((tour) => {
			const keys = [
				tour.titleKey,
				tour.summaryKey,
				...tour.steps.flatMap((s) => [s.titleKey, s.contentKey])
			];
			bundledLocales.forEach(([locale, bundle]) => {
				keys.forEach((key) => {
					expect(
						resolvesWithFallback(bundle, key),
						`key ${key} unresolvable for ${locale}`
					).toBe(true);
				});
			});
		});
	});

	it('ships the mail-counselling copy natively in every bundled locale', () => {
		const keys = [
			consultantMailCounsellingTour.titleKey,
			consultantMailCounsellingTour.summaryKey,
			...consultantMailCounsellingTour.steps.flatMap((s) => [
				s.titleKey,
				s.contentKey
			])
		];
		bundledLocales.forEach(([locale, bundle]) => {
			keys.forEach((key) => {
				expect(
					typeof resolveKey(bundle, key),
					`missing ${locale} key ${key}`
				).toBe('string');
			});
		});
	});
});
