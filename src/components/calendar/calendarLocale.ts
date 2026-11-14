/**
 * One locale policy for the whole calendar: the app language decides the
 * Intl locale for dates, times and weekday names, and the FullCalendar
 * locale for headings. `de@informal` is German. A language without a
 * mapping, or one the browser's Intl data lacks, falls back explicitly —
 * never silently to German weekday names inside a French page.
 */

/** The app's languages (src/resources/i18n) and their Intl locales. */
const INTL_LOCALES: Record<string, string> = {
	de: 'de-DE',
	en: 'en-GB',
	fr: 'fr-FR',
	ru: 'ru-RU',
	tr: 'tr-TR',
	ti: 'ti-ER'
};

/** The app's fallback language (src/i18n.ts, FALLBACK_LNG). */
const FALLBACK_INTL = INTL_LOCALES.de;
/** What an Intl runtime without the language's data shows instead. */
const MISSING_DATA_INTL = INTL_LOCALES.en;

/**
 * FullCalendar ships locale data for all of them except Tigrinya, which
 * gets British English (24 h, the order of the app's English).
 */
const FULLCALENDAR_LOCALES: Record<string, string> = {
	de: 'de',
	en: 'en-gb',
	fr: 'fr',
	ru: 'ru',
	tr: 'tr',
	ti: 'en-gb'
};

const baseLanguage = (language?: string) =>
	(language ?? '').split('@')[0].split('-')[0].toLowerCase();

/** The Intl locale for `i18n.language`, e.g. 'fr' → 'fr-FR'. */
export const calendarLocale = (language?: string): string => {
	const tag = INTL_LOCALES[baseLanguage(language)];
	if (!tag) return FALLBACK_INTL;
	return Intl.DateTimeFormat.supportedLocalesOf([tag]).length
		? tag
		: MISSING_DATA_INTL;
};

/** The FullCalendar locale code for `i18n.language`, e.g. 'en' → 'en-gb'. */
export const fullCalendarLocale = (language?: string): string =>
	FULLCALENDAR_LOCALES[baseLanguage(language)] ??
	FULLCALENDAR_LOCALES.de;
