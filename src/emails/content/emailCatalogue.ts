/**
 * The catalogue of transactional e-mails and the tone variants they ship in.
 *
 * Ids are stable file names — `emails/<dialect>/<tone>/<id>` — because that is
 * how the sending services address a template. Renaming one is a breaking
 * change.
 */

export const EMAIL_IDS = [
	// Designed first, from the imported design project.
	'neue-nachricht',
	'willkommen',
	'passwort-zuruecksetzen',
	'termin',
	'beraterin-kontakt',
	'anfrage-zugewiesen',
	'systemhinweis',

	// The counsellor's enquiry stream (#863).
	'neue-anfrage',
	'direkte-anfrage',
	'tagesuebersicht',

	// Handover and supervision (#864).
	'uebergabe-angefragt',
	'uebergabe-bestaetigt',
	'rueckmeldung',

	// The generic mail an administrator can send (#865).
	'mitteilung',

	// Account and access (#866).
	'anmeldelink',
	'einmalcode',
	'email-geaendert',

	// Invitations and the DPA (#867).
	'einladung-traeger',
	'einladung-fachkraft',
	'avv-unterschrift',

	// Team and platform operations (#868).
	'team-aenderung',
	'smtp-test'
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
	'systemhinweis': 'Systemhinweis',
	'neue-anfrage': 'Neue Anfrage in der Beratungsstelle',
	'direkte-anfrage': 'Direkte Anfrage',
	'tagesuebersicht': 'Tagesübersicht',
	'uebergabe-angefragt': 'Übergabe angefragt',
	'uebergabe-bestaetigt': 'Übergabe bestätigt',
	'rueckmeldung': 'Rückmeldung im Fachaustausch',
	'mitteilung': 'Mitteilung',
	'anmeldelink': 'Anmeldelink',
	'einmalcode': 'Einmalcode',
	'email-geaendert': 'E-Mail-Adresse geändert',
	'einladung-traeger': 'Einladung für einen Träger',
	'einladung-fachkraft': 'Einladung für eine Fachkraft',
	'avv-unterschrift': 'AVV zur Unterschrift',
	'team-aenderung': 'Änderung im Team',
	'smtp-test': 'SMTP-Test'
};

/**
 * Who receives each mail.
 *
 * This is not decoration: mails to `asker` must never carry message content, a
 * real name or the counselling centre — see the anonymity rule in ADR-019.
 * `beraterin-kontakt` and `termin` are the two exceptions, and only because the
 * recipient asked for that information themselves.
 *
 * `admin` is a Träger administrator: someone who configures the platform rather
 * than counselling in it. Their mails may name organisations and systems, but
 * still never an advice seeker.
 */
export const EMAIL_AUDIENCE: Record<EmailId, 'asker' | 'consultant' | 'admin'> =
	{
		'neue-nachricht': 'asker',
		'willkommen': 'asker',
		'passwort-zuruecksetzen': 'asker',
		'termin': 'asker',
		'beraterin-kontakt': 'asker',
		'anfrage-zugewiesen': 'consultant',
		'systemhinweis': 'asker',
		'neue-anfrage': 'consultant',
		'direkte-anfrage': 'consultant',
		'tagesuebersicht': 'consultant',
		'uebergabe-angefragt': 'consultant',
		'uebergabe-bestaetigt': 'consultant',
		'rueckmeldung': 'consultant',
		'mitteilung': 'asker',
		'anmeldelink': 'asker',
		'einmalcode': 'asker',
		'email-geaendert': 'asker',
		'einladung-traeger': 'admin',
		'einladung-fachkraft': 'consultant',
		'avv-unterschrift': 'admin',
		'team-aenderung': 'consultant',
		'smtp-test': 'admin'
	};

/**
 * Switchability class, from ADR-019.
 *
 * The footer of a `security` or `legal` mail must not offer an unsubscribe
 * link: there is no switch behind it, and sending the recipient to a settings
 * screen to look for one is worse than saying so.
 */
export const EMAIL_CLASS: Record<
	EmailId,
	'security' | 'legal' | 'personal' | 'operational' | 'requested' | 'service'
> = {
	'neue-nachricht': 'personal',
	'willkommen': 'personal',
	'passwort-zuruecksetzen': 'security',
	'termin': 'personal',
	'beraterin-kontakt': 'requested',
	'anfrage-zugewiesen': 'operational',
	'systemhinweis': 'service',
	'neue-anfrage': 'operational',
	'direkte-anfrage': 'operational',
	'tagesuebersicht': 'operational',
	'uebergabe-angefragt': 'operational',
	'uebergabe-bestaetigt': 'operational',
	'rueckmeldung': 'operational',
	'mitteilung': 'service',
	'anmeldelink': 'security',
	'einmalcode': 'security',
	'email-geaendert': 'security',
	'einladung-traeger': 'security',
	'einladung-fachkraft': 'security',
	'avv-unterschrift': 'legal',
	'team-aenderung': 'operational',
	'smtp-test': 'service'
};

/** Mails whose footer carries no unsubscribe link, because nothing switches them off. */
export const emailIsUnsubscribable = (id: EmailId): boolean =>
	EMAIL_CLASS[id] !== 'security' && EMAIL_CLASS[id] !== 'legal';
