/**
 * **Proposal, not shipped wording.** The copy Modul 2 needs — the two
 * notification channels, their honest limits, and the recommended combination
 * (`VERDRAHTUNG-modul2-benachrichtigung-2026-09-07.md`).
 *
 * Deliberately a **separate map and not `t()` calls in the component**, for the
 * same reason `erstantwortFaqQuestions.ts` exists: none of these keys is in
 * `src/resources/i18n/de/common.json` yet, and `src/i18n.test.ts` rightly fails
 * on any literal translation key that is absent from the canonical catalogue. A
 * proposal must not force an edit to seven locale files before anybody has
 * decided it ships. The caller injects `translate`; without one the German
 * fallback below renders, which is exactly what Storybook needs.
 *
 * If Modul 2 is adopted, these fifteen keys go into all seven locales
 * (`{de,de@informal,en,fr,ru,ti,tr}/common.json`) and this file disappears into
 * ordinary `t()` calls. `de@informal` needs the Du-form of every one of them —
 * it is today the only locale with no `erstantwort.notificationChoice` block at
 * all (Inventar L7).
 *
 * The **message wording itself is not here**: headline and body come from the
 * shipped catalogue entry `notificationChoice`, unchanged. Nothing in this
 * proposal rewrites a Baustein body — ADR-018 §4 freezes those.
 */

export interface ErstantwortNotifyCopyEntry {
	/** i18n key, following the catalogue's `erstantwort.<…>` convention. */
	key: string;
	/** German fallback, gender-neutral by reformulation (ADR-018 §7). */
	de: string;
}

const entry = (key: string, de: string): ErstantwortNotifyCopyEntry => ({
	key,
	de
});

export const ERSTANTWORT_NOTIFY_COPY = {
	groupLabel: entry(
		'erstantwort.notify.groupLabel',
		'Wie wir Sie benachrichtigen'
	),

	/* Franks Regel vom 07.09.2026: benennen, was passiert, nicht bildhaft
	   umschreiben. „Per E-Mail" nennt ein Medium, nicht eine Handlung — was die
	   Person tut, ist eine Adresse hinterlegen, und das steht jetzt da. */
	emailLabel: entry(
		'erstantwort.notify.email.label',
		'E-Mail-Adresse hinterlegen'
	),
	emailHint: entry(
		'erstantwort.notify.email.hint',
		'Erreicht Sie auf jedem Gerät. Der Beratungsinhalt steht nie in der E-Mail.'
	),
	emailAction: entry(
		'erstantwort.notify.email.action',
		'E-Mail-Adresse eingeben'
	),
	emailDone: entry(
		'erstantwort.notify.email.done',
		'Ihre E-Mail-Adresse ist hinterlegt.'
	),

	/* **Franks eigenes Beispiel, wörtlich.** Ausgeliefert steht im Katalog
	   heute „Geben Sie mir hier ein Signal"
	   (`erstantwort.notificationChoice.browser`, `de/common.json`). Das ist ein
	   Bild: es sagt nicht, welche Funktion eingeschaltet wird, und „hier" ist
	   für die Person nicht auflösbar. Der neue Text nennt die Sache beim Namen,
	   den ihr Browser selbst benutzt. */
	browserLabel: entry(
		'erstantwort.notify.browser.label',
		'Benachrichtigungen des Browsers aktivieren'
	),
	/* Die Grenze steht im Angebot selbst, nie in einer Fußnote: wer das hier
	   wählt, weil es ohne Adresse geht, muss vor der Wahl wissen, dass es ihm
	   nicht auf ein anderes Gerät folgt. */
	browserHint: entry(
		'erstantwort.notify.browser.hint',
		'Ohne Adresse. Gilt nur für dieses Gerät und diesen Browser.'
	),
	browserAction: entry(
		'erstantwort.notify.browser.action',
		'Benachrichtigungen erlauben'
	),
	browserDone: entry(
		'erstantwort.notify.browser.done',
		'Benachrichtigungen sind aktiviert.'
	),
	browserBlocked: entry(
		'erstantwort.notify.browser.blocked',
		'Der Browser hat Benachrichtigungen abgelehnt.'
	),
	/* Von der Zeile darüber getrennt, mit Absicht: die Tatsache steht in der
	   Fehlerrolle, der Ausweg wird nicht geschrien. Es gibt keine Web-API, die
	   die Berechtigungsseite eines Browsers öffnet — der Text nennt deshalb den
	   Ort, statt einen Knopf zu versprechen, den es nicht geben kann. */
	browserBlockedHelp: entry(
		'erstantwort.notify.browser.blockedHelp',
		'Wir dürfen nicht noch einmal fragen. Erlauben können Sie es selbst — über das Symbol links neben der Adresse.'
	),

	bothBadge: entry('erstantwort.notify.both.badge', 'Empfohlen'),
	/* „Beides" allein benennt nicht, was beides ist. Die Zeile zählt die zwei
	   Kanäle auf, die sie einschaltet. */
	bothLabel: entry(
		'erstantwort.notify.both.label',
		'E-Mail und Browser-Benachrichtigung'
	),
	bothHint: entry(
		'erstantwort.notify.both.hint',
		'Das Signal kommt sofort, die E-Mail erreicht Sie auch auf einem anderen Gerät.'
	),
	bothAction: entry('erstantwort.notify.both.action', 'Beides einrichten')
} as const;

export type ErstantwortNotifyTranslate = (
	key: string,
	defaultValue: string
) => string;

/** Resolves one entry through the caller's translator, or to its German. */
export const notifyText = (
	copy: ErstantwortNotifyCopyEntry,
	translate?: ErstantwortNotifyTranslate
): string => translate?.(copy.key, copy.de) ?? copy.de;
