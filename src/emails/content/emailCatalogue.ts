/**
 * The catalogue of transactional e-mails and the tone variants they ship in.
 *
 * Ids are stable file names — `emails/<locale>/<id>.html` — because that is how
 * the sending services address a template. Renaming one is a breaking change.
 */

export const EMAIL_IDS = [
	'neue-nachricht',
	'willkommen',
	'passwort-zuruecksetzen',
	'termin',
	'beraterin-kontakt',
	'anfrage-zugewiesen',
	'systemhinweis'
] as const;

export type EmailId = (typeof EMAIL_IDS)[number];

/**
 * Tone variants. German ships twice because the address form is a per-tenant
 * decision: youth counselling uses "du", most others "Sie".
 */
export const EMAIL_LOCALES = ['de-sie', 'de-du', 'en'] as const;

export type EmailLocale = (typeof EMAIL_LOCALES)[number];

/** `<html lang>` value per tone variant. */
export const EMAIL_LOCALE_LANG: Record<EmailLocale, string> = {
	'de-sie': 'de',
	'de-du': 'de',
	'en': 'en'
};

export const EMAIL_LOCALE_LABELS: Record<EmailLocale, string> = {
	'de-sie': 'Deutsch (Sie)',
	'de-du': 'Deutsch (du)',
	'en': 'English'
};

export const EMAIL_LABELS: Record<EmailId, string> = {
	'neue-nachricht': 'Neue Nachricht',
	'willkommen': 'Willkommen',
	'passwort-zuruecksetzen': 'Passwort zurücksetzen',
	'termin': 'Termin',
	'beraterin-kontakt': 'Kontakt zur Beratung',
	'anfrage-zugewiesen': 'Anfrage zugewiesen',
	'systemhinweis': 'Systemhinweis'
};

/**
 * Who receives each mail.
 *
 * This is not decoration: mails to `asker` must never carry message content, a
 * real name or the counselling centre — see the anonymity rule in the README.
 * `beraterin-kontakt` and `termin` are the two exceptions, and only because the
 * recipient asked for that information themselves.
 */
export const EMAIL_AUDIENCE: Record<EmailId, 'asker' | 'consultant'> = {
	'neue-nachricht': 'asker',
	'willkommen': 'asker',
	'passwort-zuruecksetzen': 'asker',
	'termin': 'asker',
	'beraterin-kontakt': 'asker',
	'anfrage-zugewiesen': 'consultant',
	'systemhinweis': 'asker'
};
