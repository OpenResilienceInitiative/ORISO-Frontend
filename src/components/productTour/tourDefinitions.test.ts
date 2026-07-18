import { describe, expect, it } from 'vitest';
import deTranslations from '../../resources/i18n/de/common.json';
import enTranslations from '../../resources/i18n/en/common.json';
import { consultantWalkthroughTour } from './tourDefinitions';

const resolveKey = (bundle: object, key: string): unknown =>
	key.split('.').reduce<any>((node, part) => node?.[part], bundle);

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
