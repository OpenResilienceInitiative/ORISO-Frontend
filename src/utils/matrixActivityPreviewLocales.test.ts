import { describe, expect, it } from 'vitest';
import de from '../resources/i18n/de/common.json';
import deInformal from '../resources/i18n/de@informal/common.json';
import en from '../resources/i18n/en/common.json';
import fr from '../resources/i18n/fr/common.json';
import ru from '../resources/i18n/ru/common.json';
import ti from '../resources/i18n/ti/common.json';
import tr from '../resources/i18n/tr/common.json';

/**
 * The modality labels this issue owns. Asserted as a subset, not as the whole
 * node: `notifications.center.preview` is shared — #847 put the read-only
 * conversation preview's own strings (`unavailable`, `empty`) in the same
 * place. An exact-set assertion here would fail whenever a neighbouring issue
 * adds a string, which says nothing about whether these labels are complete.
 */
const REQUIRED_MODALITY_LABELS = [
	'audio',
	'eventUnavailable',
	'file',
	'image',
	'notice',
	'pending',
	'roomUnavailable',
	'unsupported',
	'video'
];

const REQUIRED_PAGINATION_LABELS = [
	'loadOlder',
	'loadingOlder',
	'olderError',
	'retryOlder',
	'endOfHistory'
];

/**
 * `de@informal` is an **overlay**, not a full catalogue: `i18n.ts` declares
 * `fallbackLng: { 'de@informal': ['de'] }`, so it should carry only the strings
 * whose informal wording actually differs. Copying every generic label into it
 * would create duplicates that silently drift from the formal catalogue, so
 * that locale is checked against the resource a user really sees.
 */
const resolved = (locale: string, common: any) =>
	locale === 'de@informal'
		? {
				...de.notifications.center,
				...common.notifications.center,
				preview: {
					...de.notifications.center.preview,
					...common.notifications.center.preview
				}
			}
		: common.notifications.center;

describe('Matrix Activity Timeline preview translations', () => {
	it.each([
		['de', de],
		['de@informal', deInformal],
		['en', en],
		['fr', fr],
		['ru', ru],
		['ti', ti],
		['tr', tr]
	])('provides every safe modality label in %s', (locale, common) => {
		const centre = resolved(locale, common);
		const preview = centre.preview;

		REQUIRED_MODALITY_LABELS.forEach((key) => {
			expect(Object.keys(preview)).toContain(key);
		});
		Object.values(preview).forEach((label) => {
			expect(label).toEqual(expect.any(String));
			expect((label as string).trim()).not.toBe('');
			expect(label).not.toMatch(/^notifications\./);
		});
		REQUIRED_PAGINATION_LABELS.forEach((key) => {
			const label = centre[key];
			expect(label).toEqual(expect.any(String));
			expect(label.trim()).not.toBe('');
		});
	});

	it('keeps de@informal free of strings identical to the formal catalogue', () => {
		// A duplicate is not merely redundant: the two copies drift, and the
		// informal user then reads a stale version of a string somebody
		// updated once.
		const duplicates = [
			...REQUIRED_PAGINATION_LABELS.filter(
				(key) =>
					deInformal.notifications.center[key] !== undefined &&
					deInformal.notifications.center[key] ===
						de.notifications.center[key]
			),
			...Object.entries(deInformal.notifications.center.preview ?? {})
				.filter(
					([key, value]) =>
						value === (de.notifications.center.preview as any)[key]
				)
				.map(([key]) => `preview.${key}`)
		];

		expect(duplicates).toEqual([]);
	});
});
