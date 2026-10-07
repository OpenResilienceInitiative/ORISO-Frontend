import { describe, expect, it } from 'vitest';
import { createInstance } from 'i18next';
import de from '../../resources/i18n/de/common.json';
import deInformal from '../../resources/i18n/de@informal/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import ti from '../../resources/i18n/ti/common.json';
import tr from '../../resources/i18n/tr/common.json';

describe('call timeline translation resources', () => {
	it('resolves the sparse informal overlay through the German fallback', async () => {
		const translations = createInstance();
		await translations.init({
			lng: 'de@informal',
			fallbackLng: { 'de@informal': ['de'] },
			defaultNS: 'common',
			resources: {
				'de': { common: de },
				'de@informal': { common: deInformal }
			}
		});
		expect(translations.t('message.callLifecycle.type.audio')).toBe(
			de.message.callLifecycle.type.audio
		);
	});

	for (const [locale, catalog] of Object.entries({
		de,
		en,
		fr,
		ru,
		ti,
		tr
	})) {
		it(`${locale} provides the exact message namespace used by the presenter`, () => {
			for (const key of [
				'type.audio',
				'type.video',
				'state.running',
				'state.ended',
				'state.missed',
				'description.running',
				'description.ended',
				'description.missed',
				'participants.attended'
			]) {
				expect(catalog).toHaveProperty(`message.callLifecycle.${key}`);
			}
			expect(catalog).not.toHaveProperty('appointments.callLifecycle');
		});
	}
});
