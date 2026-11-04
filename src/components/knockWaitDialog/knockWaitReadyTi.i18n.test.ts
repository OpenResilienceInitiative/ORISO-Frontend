/**
 * The device check's privacy promises ("nobody sees or hears you", "only you
 * see the preview") have no native-reviewed Tigrinya text yet. Until Weblate
 * delivers one, `ti` carries no such keys and shows the default language
 * (`FALLBACK_LNG`, German) through the fallback chain instead.
 */
import { flatten } from 'flat';
import i18next from 'i18next';
import { describe, expect, it } from 'vite-plus/test';
import de from '../../resources/i18n/de/common.json';
import ti from '../../resources/i18n/ti/common.json';

const PRIVACY_KEYS = [
	'knockWait.ready.description',
	'knockWait.ready.descriptionCheck'
];

const tiInstance = async () => {
	const instance = i18next.createInstance();
	await instance.init({
		lng: 'ti',
		// The app's chain (`src/i18n.ts`): every language falls back to `de`.
		fallbackLng: { 'de@informal': ['de'], 'default': ['de'] },
		defaultNS: 'common',
		resources: { de: { common: de }, ti: { common: ti } },
		returnEmptyString: true,
		interpolation: { escapeValue: false }
	});
	return instance;
};

describe('Tigrinya privacy copy in the device check', () => {
	it.each(PRIVACY_KEYS)('%s is not in the ti catalogue', (key) => {
		expect(
			flatten<object, Record<string, unknown>>(ti)[key]
		).toBeUndefined();
	});

	it.each(PRIVACY_KEYS)(
		'%s resolves to the default-language text for ti',
		async (key) => {
			const instance = await tiInstance();
			const german = instance.getFixedT('de')(key);
			expect(german).not.toBe(key);
			expect(german).not.toBe('');
			expect(instance.t(key)).toBe(german);
		}
	);
});
