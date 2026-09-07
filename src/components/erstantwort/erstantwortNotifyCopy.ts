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

	emailLabel: entry('erstantwort.notify.email.label', 'Per E-Mail'),
	emailHint: entry(
		'erstantwort.notify.email.hint',
		'Erreicht Sie auf jedem Gerät. Was Sie hier besprechen, steht nie in dieser E-Mail.'
	),
	emailAction: entry(
		'erstantwort.notify.email.action',
		'E-Mail-Adresse angeben'
	),
	emailDone: entry(
		'erstantwort.notify.email.done',
		'Ihre E-Mail-Adresse ist hinterlegt. Wir schreiben Ihnen, sobald die Antwort da ist.'
	),

	browserLabel: entry(
		'erstantwort.notify.browser.label',
		'Als Signal in diesem Browser'
	),
	/* The limit is stated in the offer itself, never in a footnote: a person who
	   picks this because it needs no address must know before choosing that it
	   does not follow them to another device. */
	browserHint: entry(
		'erstantwort.notify.browser.hint',
		'Ohne Adresse — erreicht Sie aber nur auf diesem Gerät und in diesem Browser.'
	),
	browserAction: entry(
		'erstantwort.notify.browser.action',
		'Signal einschalten'
	),
	browserDone: entry(
		'erstantwort.notify.browser.done',
		'Auf diesem Gerät eingeschaltet.'
	),
	browserBlocked: entry(
		'erstantwort.notify.browser.blocked',
		'Von diesem Browser abgelehnt.'
	),
	/* Split from the line above on purpose: the fact is flagged in the error
	   role, the way out is not shouted. There is no web API that opens a
	   browser's permission page, so the text names the place instead of
	   promising a button that cannot exist. */
	browserBlockedHelp: entry(
		'erstantwort.notify.browser.blockedHelp',
		'Wir dürfen nicht noch einmal fragen. Sie können es selbst wieder erlauben — über das Symbol links neben der Adresse. Bis dahin ist die E-Mail der sichere Weg.'
	),

	bothBadge: entry('erstantwort.notify.both.badge', 'Empfohlen'),
	bothLabel: entry('erstantwort.notify.both.label', 'Beides'),
	bothHint: entry(
		'erstantwort.notify.both.hint',
		'Das Signal ist sofort da, die E-Mail erreicht Sie auch später und auf einem anderen Gerät.'
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
