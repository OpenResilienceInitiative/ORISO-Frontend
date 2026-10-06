import { createInstance, type i18n as I18nInstance } from 'i18next';
import de from '../../resources/i18n/de/common.json';
import deInformal from '../../resources/i18n/de@informal/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import ti from '../../resources/i18n/ti/common.json';
import tr from '../../resources/i18n/tr/common.json';
import { createScriptEngine, type ScriptEngine } from './ScriptEngine';

/** Test-only: never imported by app code, so the catalogues stay out of this bundle. */
export const PRACTICE_SCRIPT_LOCALES = [
	'de',
	'de@informal',
	'en',
	'fr',
	'ru',
	'ti',
	'tr'
] as const;

export type PracticeScriptLocale = (typeof PRACTICE_SCRIPT_LOCALES)[number];

const catalogues: Record<PracticeScriptLocale, { practiceScript?: object }> = {
	'de': de,
	'de@informal': deInformal as { practiceScript?: object },
	en,
	fr,
	ru,
	ti,
	tr
};

/** The `practiceScript` block of one locale's catalogue; `{}` where it has none. */
export const practiceScriptBlock = (locale: PracticeScriptLocale): object =>
	catalogues[locale].practiceScript ?? {};

/**
 * An i18next instance built like the app's: the seven real catalogues, the
 * informal overlay falling back to German. `defaultNS` is `common`, as in
 * `src/i18n.ts`.
 */
export const createPracticeTestI18n = (
	lng: PracticeScriptLocale = 'de'
): I18nInstance => {
	const instance = createInstance();
	void instance.init({
		lng,
		fallbackLng: { 'de@informal': ['de'], 'default': ['de'] },
		ns: ['common'],
		defaultNS: 'common',
		resources: Object.fromEntries(
			PRACTICE_SCRIPT_LOCALES.map((locale) => [
				locale,
				{ common: { practiceScript: practiceScriptBlock(locale) } }
			])
		),
		returnEmptyString: true,
		interpolation: { escapeValue: false }
	});
	return instance;
};

export const createTestScript = (
	locale: PracticeScriptLocale = 'de',
	i18n: I18nInstance = createPracticeTestI18n(locale)
): ScriptEngine =>
	createScriptEngine({
		translate: (key, options) => String(i18n.t(key, options)),
		locale
	});
