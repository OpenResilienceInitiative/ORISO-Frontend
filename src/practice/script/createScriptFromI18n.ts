import type { i18n as I18nInstance } from 'i18next';
import { createScriptEngine, type ScriptEngine } from './ScriptEngine';

/**
 * The engine in the language the page is in right now. Called once when
 * practice starts: the locale is fixed here for the whole run, later language
 * switches do not reach it.
 */
export const createScriptFromI18n = (
	i18n: I18nInstance | undefined
): ScriptEngine => {
	if (typeof i18n?.t !== 'function') {
		throw new Error(
			'The practice script needs an initialised i18n instance'
		);
	}
	return createScriptEngine({
		translate: (key, options) => String(i18n.t(key, options)),
		// 'de' is the app's fallback language (`FALLBACK_LNG` in src/i18n.ts).
		locale: i18n.resolvedLanguage || i18n.language || 'de'
	});
};
