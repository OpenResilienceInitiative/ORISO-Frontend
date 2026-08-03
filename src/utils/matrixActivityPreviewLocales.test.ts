import { describe, expect, it } from 'vitest';
import de from '../resources/i18n/de/common.json';
import deInformal from '../resources/i18n/de@informal/common.json';
import en from '../resources/i18n/en/common.json';
import fr from '../resources/i18n/fr/common.json';
import ru from '../resources/i18n/ru/common.json';
import ti from '../resources/i18n/ti/common.json';
import tr from '../resources/i18n/tr/common.json';

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

		expect(Object.keys(preview).sort()).toEqual(
			['audio', 'file', 'image', 'notice', 'unsupported', 'video'].sort()
		);
		Object.values(preview).forEach((label) => {
			expect(label).toEqual(expect.any(String));
			expect(label.trim()).not.toBe('');
			expect(label).not.toMatch(/^notifications\./);
		});
	});
});
