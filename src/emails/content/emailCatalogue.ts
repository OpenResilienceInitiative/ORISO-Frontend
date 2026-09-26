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
	'selbsthilfe-termin-bestaetigt-teilnahme',
	'selbsthilfe-termin-verschoben-teilnahme',
	'selbsthilfe-termin-abgesagt-teilnahme',
	'selbsthilfe-termin-erinnerung-teilnahme',
	'selbsthilfe-termin-bestaetigt-beratung',
	'selbsthilfe-termin-verschoben-beratung',
	'selbsthilfe-termin-abgesagt-beratung',
	'selbsthilfe-termin-erinnerung-beratung',
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

	// The invite an operator writes themselves, in the ORISO frame. Rendered by
	// UserService's InviteFrameMailRenderer.
	'einladung-freitext',

	// Team and platform operations (#868).
	'team-aenderung',
	'smtp-test'
] as const;

export type EmailId = (typeof EMAIL_IDS)[number];

/**
 * The variants every occasion ships in.
 *
 * Two orthogonal things are folded into one flat id, because a template file
 * needs one directory name:
 *
 *   - **language** — the App catalogue under `src/resources/i18n/`;
 *   - **tone** — the address form. German ships twice because that is a
 *     per-tenant decision: youth counselling uses "du", most others "Sie".
 *
 * Only German has two tones. Whether French, Russian, Turkish and Tigrinya —
 * which all have a T–V distinction too — need a second one doubles the work
 * and is deliberately a separate decision (ORISO-Frontend#1065, scope note).
 */
export const EMAIL_LOCALES = [
	'de-sie',
	'de-du',
	'en',
	'fr',
	'ru',
	'ti',
	'tr'
] as const;

export type EmailLocale = (typeof EMAIL_LOCALES)[number];

/**
 * The locale every other one is written from.
 *
 * German is the language the copy is authored, argued about and signed off in,
 * so it is the only one that can be the source. Everything else is measured
 * against it — see `translationManifest.json`.
 */
export const EMAIL_SOURCE_LOCALE = 'de-sie' satisfies EmailLocale;

/** `<html lang>` value per variant. */
export const EMAIL_LOCALE_LANG: Record<EmailLocale, string> = {
	'de-sie': 'de',
	'de-du': 'de',
	'en': 'en',
	'fr': 'fr',
	'ru': 'ru',
	'ti': 'ti',
	'tr': 'tr'
};

/**
 * Writing direction, stated rather than assumed.
 *
 * No language the platform offers is right-to-left — Tigrinya is written in
 * Ge'ez script, which runs left to right, and is the one people most often
 * expect to be RTL. The kit's table layout would need mirroring for a genuine
 * RTL language, so adding one has to change this table, which makes it a
 * visible decision instead of a silent regression.
 */
export const EMAIL_LOCALE_DIR: Record<EmailLocale, 'ltr' | 'rtl'> = {
	'de-sie': 'ltr',
	'de-du': 'ltr',
	'en': 'ltr',
	'fr': 'ltr',
	'ru': 'ltr',
	'ti': 'ltr',
	'tr': 'ltr'
};

export const EMAIL_LOCALE_LABELS: Record<EmailLocale, string> = {
	'de-sie': 'Deutsch (Sie)',
	'de-du': 'Deutsch (du)',
	'en': 'English',
	'fr': 'Français',
	'ru': 'Русский',
	'ti': 'ትግርኛ',
	'tr': 'Türkçe'
};

/**
 * Where the copy came from.
 *
 * `human` means a person wrote or rewrote it and can be asked what it means.
 * `machine` means it was translated automatically and nobody on the team can
 * read it — which is precisely the condition `emailProtectedPaths` exists
 * for.
 */
export type EmailTranslationProvenance = 'source' | 'human' | 'machine';

export const EMAIL_LOCALE_PROVENANCE: Record<
	EmailLocale,
	EmailTranslationProvenance
> = {
	'de-sie': 'source',
	'de-du': 'human',
	'en': 'human',
	'fr': 'machine',
	'ru': 'machine',
	'ti': 'machine',
	'tr': 'machine'
};

/**
 * Human language review status for this variant.
 *
 * A `machine` locale stays `pending-human-review` until every string listed in
 * `emailProtectedPaths` has a signature in `translationReview.json`. All
 * variants are generated now; the catalogue keeps the review debt visible.
 * The guard rejects a false `released` claim.
 */
export type EmailLocaleRelease = 'released' | 'pending-human-review';

export const EMAIL_LOCALE_RELEASE: Record<EmailLocale, EmailLocaleRelease> = {
	'de-sie': 'released',
	'de-du': 'released',
	'en': 'released',
	'fr': 'pending-human-review',
	'ru': 'pending-human-review',
	'ti': 'pending-human-review',
	'tr': 'pending-human-review'
};

/** Variants with completed human copy review; generation does not filter on this list. */
export const EMAIL_RELEASED_LOCALES: readonly EmailLocale[] =
	EMAIL_LOCALES.filter(
		(locale) => EMAIL_LOCALE_RELEASE[locale] === 'released'
	);

/** Every locale that is translated from the source rather than authored. */
export const EMAIL_TRANSLATED_LOCALES: readonly EmailLocale[] =
	EMAIL_LOCALES.filter((locale) => locale !== EMAIL_SOURCE_LOCALE);

/**
 * One variant per language, for artefacts that key by language.
 *
 * The Keycloak theme and the MailService template set both address a template
 * by language rather than by tone — `messages_de.properties`, `foo.en.html`.
 * German therefore has to pick a tone, and it picks the source: "Sie" is the
 * default for adult counselling, and it is the tone those two consumers
 * already carried before there was a design system.
 */
export const EMAIL_LANGUAGE_LOCALES: readonly EmailLocale[] =
	EMAIL_LOCALES.filter(
		(locale, index, all) =>
			all.findIndex(
				(other) =>
					EMAIL_LOCALE_LANG[other] === EMAIL_LOCALE_LANG[locale]
			) === index
	);

export const EMAIL_LABELS: Record<EmailId, string> = {
	'neue-nachricht': 'Neue Nachricht',
	'willkommen': 'Willkommen',
	'passwort-zuruecksetzen': 'Passwort zurücksetzen',
	'termin': 'Termin',
	'selbsthilfe-termin-bestaetigt-teilnahme':
		'Selbsthilfe-Termin bestätigt (Teilnahme)',
	'selbsthilfe-termin-verschoben-teilnahme':
		'Selbsthilfe-Termin verschoben (Teilnahme)',
	'selbsthilfe-termin-abgesagt-teilnahme':
		'Selbsthilfe-Termin abgesagt (Teilnahme)',
	'selbsthilfe-termin-erinnerung-teilnahme':
		'Selbsthilfe-Termin Erinnerung (Teilnahme)',
	'selbsthilfe-termin-bestaetigt-beratung':
		'Selbsthilfe-Termin bestätigt (Beratung)',
	'selbsthilfe-termin-verschoben-beratung':
		'Selbsthilfe-Termin verschoben (Beratung)',
	'selbsthilfe-termin-abgesagt-beratung':
		'Selbsthilfe-Termin abgesagt (Beratung)',
	'selbsthilfe-termin-erinnerung-beratung':
		'Selbsthilfe-Termin Erinnerung (Beratung)',
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
	'avv-unterschrift': 'Vertragsunterlagen zur Unterschrift',
	'einladung-freitext': 'Einladung mit eigenem Text',
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
		'selbsthilfe-termin-bestaetigt-teilnahme': 'asker',
		'selbsthilfe-termin-verschoben-teilnahme': 'asker',
		'selbsthilfe-termin-abgesagt-teilnahme': 'asker',
		'selbsthilfe-termin-erinnerung-teilnahme': 'asker',
		'selbsthilfe-termin-bestaetigt-beratung': 'consultant',
		'selbsthilfe-termin-verschoben-beratung': 'consultant',
		'selbsthilfe-termin-abgesagt-beratung': 'consultant',
		'selbsthilfe-termin-erinnerung-beratung': 'consultant',
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
		'einladung-freitext': 'admin',
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
	'selbsthilfe-termin-bestaetigt-teilnahme': 'personal',
	'selbsthilfe-termin-verschoben-teilnahme': 'personal',
	'selbsthilfe-termin-abgesagt-teilnahme': 'personal',
	'selbsthilfe-termin-erinnerung-teilnahme': 'personal',
	'selbsthilfe-termin-bestaetigt-beratung': 'operational',
	'selbsthilfe-termin-verschoben-beratung': 'operational',
	'selbsthilfe-termin-abgesagt-beratung': 'operational',
	'selbsthilfe-termin-erinnerung-beratung': 'operational',
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
	'einladung-freitext': 'security',
	'team-aenderung': 'operational',
	'smtp-test': 'service'
};

/** Mails whose footer carries no unsubscribe link, because nothing switches them off. */
export const emailIsUnsubscribable = (id: EmailId): boolean =>
	EMAIL_CLASS[id] !== 'security' && EMAIL_CLASS[id] !== 'legal';

/**
 * Mails that ship in the `plain` dialect only.
 *
 * `einladung-freitext` carries sender-rendered HTML in `{{bodyHtml}}` and
 * `{{ctaBlock}}`. The engine dialects escape every placeholder (`[[${x}]]`,
 * `?html`), so their copy of this mail would print the authored markup as
 * text. No engine sends it; emitting a broken file that looks send-ready is
 * worse than emitting none.
 */
const PLAIN_ONLY: ReadonlySet<EmailId> = new Set(['einladung-freitext']);

/** Whether the build emits this mail for the given placeholder dialect. */
export const emailShipsInDialect = (id: EmailId, dialect: string): boolean =>
	dialect === 'plain' || !PLAIN_ONLY.has(id);

/**
 * Copy that states something rather than describes something, and therefore
 * cannot ship in a machine translation nobody on the team can read.
 *
 * Most of a mail is a description of an event: a message arrived, a request was
 * assigned, maintenance is planned. If a translation of that is slightly off,
 * the recipient is mildly confused and clicks the button anyway. Three groups
 * are not like that:
 *
 *   - **the encryption promise** (`assurance`, on every mail) — a claim about
 *     what the platform does. A translation that weakens or overstates it is a
 *     false statement in a language nobody here reads, in a mail we cannot
 *     recall;
 *   - **the privacy explanation** — why a mail withholds the content and the
 *     name, and why a username cannot be recovered. It explains a legal
 *     position to someone in a vulnerable situation;
 *   - **the DPA mail** (`avv-unterschrift`) — contractual, in full.
 *
 * Paths address fields of `EmailContent`; `*` matches one array index.
 *
 * This table is the decision, in one place. Widening or narrowing the split is
 * an edit here, not a redesign.
 */
const EMAIL_PROTECTED_EXTRA: Partial<Record<EmailId, readonly string[]>> = {
	// "Aus Datenschutzgründen zeigen wir hier weder Inhalt noch Namen."
	'neue-nachricht': ['paragraphs.1'],

	// "Aus Datenschutzgründen können wir ihn nicht wiederherstellen."
	'willkommen': ['paragraphs.1'],

	// The whole contractual statement, minus the shared footer links.
	'avv-unterschrift': [
		'subject',
		'preheader',
		'headline',
		'paragraphs.*',
		'panel.*.label',
		'footnote',
		'footer.automatedNote'
	]
};

/**
 * The protected paths of one occasion.
 *
 * `assurance` is on every mail even though the string itself is shared between
 * them — the guard deduplicates by value, so the six distinct assurances are
 * signed off six times per language, not 22.
 */
export const emailProtectedPaths = (id: EmailId): readonly string[] => [
	'assurance',
	...(EMAIL_PROTECTED_EXTRA[id] ?? [])
];
