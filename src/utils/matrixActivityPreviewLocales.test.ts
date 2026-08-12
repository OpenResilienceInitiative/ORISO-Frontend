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

describe('Matrix Activity Timeline preview translations', () => {
	it.each([
		['de', de],
		['de@informal', deInformal],
		['en', en],
		['fr', fr],
		['ru', ru],
		['ti', ti],
		['tr', tr]
	])('provides every safe modality label in %s', (_locale, common) => {
		const preview = common.notifications.center.preview;

		REQUIRED_MODALITY_LABELS.forEach((key) => {
			expect(Object.keys(preview)).toContain(key);
		});
		Object.values(preview).forEach((label) => {
			expect(label).toEqual(expect.any(String));
			expect(label.trim()).not.toBe('');
			expect(label).not.toMatch(/^notifications\./);
		});
		[
			'loadOlder',
			'loadingOlder',
			'olderError',
			'retryOlder',
			'endOfHistory'
		].forEach((key) => {
			const label = common.notifications.center[key];
			expect(label).toEqual(expect.any(String));
			expect(label.trim()).not.toBe('');
		});
	});
});
