import type { ResolvedBaustein } from './erstantwortResolve';

/**
 * **Vorschlag 07.09.2026 — nichts davon ist verdrahtet.** Die Worte für zwei
 * Dinge, die es im ausgelieferten Produkt so noch nicht gibt:
 *
 * 1. **Die Unterzeile unter „Carimat" als Handlungsaufruf.** Heute steht dort
 *    in *jeder* Nachricht derselbe Satz — `erstantwort.subtitle`,
 *    „Ihre ersten Schritte" (`ErstantwortSequence.tsx`, Default bei `subtitle`).
 *    Franks Ansage vom 07.09.: die Zeile soll pro Nachricht sagen, was **jetzt**
 *    dran ist. Damit ist sie kein Dekortext mehr, sondern ein **benennbares
 *    Feld einer fest geskripteten Systemnachricht** — eigene Prop
 *    (`ErstantwortSequence.subtitle`, existiert bereits), eigener i18n-Schlüssel
 *    **je Nachricht**. Genau so ist sie hier modelliert.
 * 2. **Die zwei Nachrichten der Verzweigung.** Wer „E-Mail" wählt, bekommt als
 *    nächstes eine Nachricht, die nach der Adresse fragt; wer
 *    „Benachrichtigungen des Browsers" wählt, eine, die durch die Erlaubnis
 *    führt. Beide existieren im Katalog nicht — sie sind der Vorschlag.
 *
 * <h3>Warum eine Copy-Map und keine `t()`-Aufrufe</h3>
 *
 * Derselbe Grund wie bei `erstantwortNotifyCopy.ts` und
 * `erstantwortFaqQuestions.ts`: keiner dieser Schlüssel steht in
 * `src/resources/i18n/de/common.json`, und `src/i18n.test.ts` lässt einen
 * literalen Übersetzungsaufruf ohne Katalogeintrag zu Recht durchfallen — bei
 * einem
 * Fehlbudget von **0** in `fr`/`ru`/`ti`/`tr`. Ein Vorschlag darf keine
 * Änderung an sieben Locale-Dateien erzwingen, bevor jemand ihn entschieden
 * hat. Der Aufrufer injiziert `translate`; ohne einen rendert der deutsche
 * Rückfall, und genau den zeigt Storybook.
 *
 * Wird der Ablauf angenommen, wandern die Schlüssel in die sieben Locales und
 * diese Datei verschwindet in gewöhnliche Übersetzungsaufrufe.
 *
 * **Der Wächter ist hier selbst die Falle gewesen:** ein ausgeschriebener
 * Übersetzungsaufruf in einem *Kommentar* zählt für
 * `extractStaticTranslationKeys` als literaler Schlüssel und macht
 * `npx vitest run --project unit` rot — der Extraktor liest Quelltext, nicht
 * Syntaxbäume. Deshalb steht in dieser Datei nirgends ein Beispielaufruf mit
 * Klammern und Anführungszeichen. Wie die Unterzeile
 * dabei als Feld in den Katalog kommt, steht in
 * `0 - Docs/VERDRAHTUNG-erstantwort-ablauf-2026-09-07.md`.
 */

export interface ErstantwortFlowCopyEntry {
	/** i18n-Schlüssel, nach der Katalog-Konvention `erstantwort.<id>.<feld>`. */
	key: string;
	/** Deutscher Rückfall, geschlechtsneutral formuliert (ADR-018 §7). */
	de: string;
}

const entry = (key: string, de: string): ErstantwortFlowCopyEntry => ({
	key,
	de
});

/** Löst einen Eintrag über den Übersetzer des Aufrufers auf, sonst deutsch. */
export const flowText = (
	copy: ErstantwortFlowCopyEntry,
	translate?: (key: string, defaultValue: string) => string
): string => translate?.(copy.key, copy.de) ?? copy.de;

/**
 * **Die Unterzeilen — ein Handlungsaufruf je Nachricht.**
 *
 * Regeln, die diese Liste selbst einhält, damit die Zeile ein Feld bleibt und
 * keine Textwiese wird:
 *
 * - **Sie sagt, was jetzt dran ist**, nicht was die Nachricht ist. Die
 *   Erfolgsmeldung verlangt nichts — dort meldet die Zeile den Abschluss
 *   („Hervorragend, Anfrage abgesendet"), das ist Franks eigenes Beispiel.
 * - **Kein Schlusspunkt.** Die Zeile steht neben einem Namen, nicht in einem
 *   Absatz — beide Beispiele Franks sind punktlos.
 * - **Ein Schlüssel je Nachricht, nicht je Zustand-Familie.** `recoveryKey`
 *   steht dreimal darin, weil dieselbe Nachricht in drei Zuständen drei
 *   verschiedene Dinge verlangt — und in einem davon gar nichts.
 */
export const ERSTANTWORT_SUBTITLES = {
	/** Modul 1. Franks Beispiel, wörtlich. */
	enquirySent: entry(
		'erstantwort.greeting.subtitle',
		'Hervorragend, Anfrage abgesendet'
	),
	/** Modul 2, die Auswahl. Franks zweites Beispiel, wörtlich. */
	notificationChoice: entry(
		'erstantwort.notificationChoice.subtitle',
		'Wählen Sie eine Option aus'
	),
	/** Zweig E-Mail. */
	emailAddress: entry(
		'erstantwort.emailAddress.subtitle',
		'Geben Sie Ihre E-Mail-Adresse ein'
	),
	/** Zweig Browser-Benachrichtigung. */
	browserNotification: entry(
		'erstantwort.browserNotification.subtitle',
		'Erlauben Sie die Benachrichtigung im Browser'
	),
	/**
	 * Modul 3, noch nicht gesichert. **Der Vorschlag, um den Frank gebeten
	 * hat.** Er nennt die Handlung („sichern") und das Ding beim vereinbarten
	 * Namen („Ersatzschlüssel", Franks Vokabel-Entscheidung vom 14.08.2026) —
	 * nicht „Ihre Sicherheit" und nicht „Wichtiger Hinweis".
	 */
	recoveryKey: entry(
		'erstantwort.recoveryKey.subtitle',
		'Sichern Sie Ihren Ersatzschlüssel'
	),
	/** Modul 3, bereits gesichert — hier ist nichts mehr zu tun, und das sagt die Zeile. */
	recoveryKeySecured: entry(
		'erstantwort.recoveryKey.subtitleSecured',
		'Erledigt, nichts weiter zu tun'
	),
	/** Modul 3 ohne Krypto — die einzige Nachricht der Kette, die nur informiert. */
	recoveryKeyUnsupported: entry(
		'erstantwort.recoveryKey.subtitleUnsupported',
		'Nur zur Information'
	)
} as const;

/**
 * **Gekürzte Fassungen ausgelieferter Katalogtexte.**
 *
 * Beide sind echte **Wortlaut-Änderungen**, nicht Umgruppierungen — sie wirken
 * deshalb nur auf **neue** Erstantworten, weil ADR-018 §4 den Wortlaut eines
 * persistierten Ereignisses einfriert. Und sie hängen an drei Orten, nicht an
 * einem: FE-Katalog, sieben Locales und
 * `ErstantwortPayloadBuilder.java` im UserService, der den Wortlaut beim
 * Absenden einfriert. Solange dort der lange Satz steht, bekommt jede neue
 * Erstantwort den langen Satz.
 */
export const ERSTANTWORT_SHORTENED = {
	/**
	 * `greeting.body`. Ausgeliefert: „Schön, dass Sie sich gemeldet haben. Ihre
	 * Nachricht ist bei uns angekommen." Der Preis ist die Wärme des ersten
	 * Satzes — die einzige Stelle der Sequenz, an der die Plattform begrüßt
	 * statt informiert. Abwägung, keine Optimierung.
	 */
	greeting: entry(
		'erstantwort.greeting.body',
		'Ihre Nachricht ist bei uns angekommen.'
	),
	/**
	 * `notificationChoice.body`. Ausgeliefert: „Sie müssen nicht warten und
	 * immer wieder nachsehen. Sagen Sie uns, wie wir Ihnen Bescheid geben
	 * dürfen, sobald die Antwort da ist." Zwei Sätze, einer davon eine
	 * Aufforderung, die die Unterzeile jetzt trägt — also fällt er weg.
	 */
	notificationChoiceBody: entry(
		'erstantwort.notificationChoice.body',
		'Wir geben Ihnen Bescheid, sobald die Antwort da ist.'
	)
} as const;

/**
 * **Zweig E-Mail** — die Nachricht, die nach der Auswahl „E-Mail-Adresse
 * hinterlegen" kommt.
 *
 * Sie erfindet keinen Baustein: Überschrift und Aktion sind der ausgelieferte
 * Eintrag `emailNotification` (`erstantwortCatalogue.ts`), nur der Rumpf ist
 * gekürzt und die Beschriftung des Knopfes benennt die Handlung („eingeben"
 * statt „angeben"). Die id bleibt `emailNotification`, weil genau sie es ist,
 * die `isBausteinSilenced` beim Träger-Schalter erkennt.
 */
export const ERSTANTWORT_EMAIL_BRANCH = {
	headline: entry(
		'erstantwort.emailNotification.headline',
		'Benachrichtigung per E-Mail'
	),
	body: entry(
		'erstantwort.emailAddress.body',
		'Wir schreiben Ihnen nur, dass eine Antwort da ist. Was Sie hier besprechen, steht nie in dieser E-Mail.'
	),
	action: entry(
		'erstantwort.emailAddress.action',
		'E-Mail-Adresse eingeben'
	),
	/*
	 * **Nicht dieselben Worte wie im Auswahlfeld.** Dort meldet
	 * `ERSTANTWORT_NOTIFY_COPY.emailDone` den Status („Ihre E-Mail-Adresse ist
	 * hinterlegt."); stünde derselbe Satz auch hier, läse die Person ihn im
	 * Verlauf zweimal untereinander. Die Auswahl-Nachricht sagt, **was gilt**,
	 * die Zweig-Nachricht sagt, **was daraus folgt**.
	 */
	done: entry(
		'erstantwort.emailAddress.done',
		'Erledigt. Wir schreiben Ihnen, sobald die Antwort da ist.'
	)
} as const;

/**
 * **Zweig Browser-Benachrichtigung** — die Nachricht, die nach der Auswahl
 * „Benachrichtigungen des Browsers aktivieren" kommt.
 *
 * Sie führt durch die Erlaubnis, statt sie stillschweigend anzufordern: der
 * Dialog des Browsers erscheint nur nach einem ausdrücklichen Tippen, und die
 * Nachricht sagt vorher, was dann passiert. Das ist kein Stilwunsch — ein
 * reflexhaftes „Blockieren" ist ohne Zutun der Person **nicht mehr umkehrbar**
 * (`Notification.requestPermission()` löst danach sofort mit `denied` auf und
 * zeigt gar keinen Dialog mehr).
 *
 * **Was der Text nicht verspricht:** dass die Benachrichtigung ankommt, wenn
 * der Tab zu ist. Im ausgelieferten Code gibt es weder Service Worker noch Web
 * Push (`VERDRAHTUNG-modul2-benachrichtigung-2026-09-07.md` §2.2); es ist eine
 * reine Vordergrund-Benachrichtigung. Deshalb „solange dieses Fenster offen
 * ist" und kein Wort mehr.
 */
export const ERSTANTWORT_BROWSER_BRANCH = {
	headline: entry(
		'erstantwort.browserNotification.headline',
		'Benachrichtigungen des Browsers'
	),
	body: entry(
		'erstantwort.browserNotification.body',
		'Gleich fragt Ihr Browser, ob er Benachrichtigungen anzeigen darf. Tippen Sie dort auf „Erlauben“ — das gilt nur für dieses Gerät.'
	),
	action: entry(
		'erstantwort.browserNotification.action',
		'Benachrichtigungen erlauben'
	),
	/* Aus demselben Grund wie beim E-Mail-Zweig nicht der Statussatz des
	   Auswahlfelds: was gilt, steht dort — was folgt, steht hier. */
	done: entry(
		'erstantwort.browserNotification.done',
		'Erledigt. Sie bekommen hier ein Signal, sobald die Antwort da ist.'
	),
	blocked: entry(
		'erstantwort.browserNotification.blocked',
		'Der Browser hat Benachrichtigungen abgelehnt. Erlauben können Sie es selbst — über das Symbol links neben der Adresse.'
	)
} as const;

/**
 * Die zwei Zweig-Nachrichten als `ResolvedBaustein` — also in genau der Form,
 * die `ErstantwortSequence` von einem Katalog-Eintrag bekommt. Nichts hier ist
 * eine Story-lokale Nachbildung eines Bausteins.
 *
 * `isDone` nimmt dem Baustein die Aktion, statt einen zweiten Text danebenzu­
 * stellen: „kein Handler, kein Knopf" ist die Regel, die `ErstantwortSequence`
 * ohnehin befolgt, und ein erledigter Kanal hat nichts mehr zu drücken.
 */
export const erstantwortEmailBranchBaustein = (
	isDone = false,
	translate?: (key: string, defaultValue: string) => string
): ResolvedBaustein => ({
	id: 'emailNotification',
	headline: flowText(ERSTANTWORT_EMAIL_BRANCH.headline, translate),
	body: isDone
		? flowText(ERSTANTWORT_EMAIL_BRANCH.done, translate)
		: flowText(ERSTANTWORT_EMAIL_BRANCH.body, translate),
	action: isDone
		? undefined
		: {
				kind: 'ADD_EMAIL',
				label: flowText(ERSTANTWORT_EMAIL_BRANCH.action, translate)
			}
});

/**
 * Der Rumpf dieser Nachricht **wechselt nicht** mit dem Zustand — anders als
 * beim E-Mail-Zweig. Der Grund ist der Unterschied zwischen den beiden Zweigen:
 * die E-Mail-Nachricht hat kein Molekül, ihr Ausgang kann nur im Rumpf stehen;
 * die Browser-Nachricht hat eins (`ErstantwortBrowserPermission`), und das trägt
 * Knopf, Bestätigung und Ablehnung. Stünde der Ausgang zusätzlich im Rumpf,
 * stünde er zweimal in derselben Blase.
 *
 * **Keine `action`.** `ERSTANTWORT_ACTION_KINDS` (`erstantwortPayload.ts`) kennt
 * fünf Werte — `ADD_EMAIL`, `ENABLE_2FA`, `SAVE_CREDENTIALS`,
 * `SET_DISPLAY_NAME`, `SHOW_RECOVERY_KEY` — und keiner davon ist eine
 * Browser-Erlaubnis. Ein sechster wäre eine Wire-Format-Änderung an einem
 * Datensatz, der als KDG-§11-Transparenznachweis dient, für einen Vorgang, der
 * den Server nie erreicht. Die Affordanz hängt deshalb im Slot.
 */
export const erstantwortBrowserBranchBaustein = (
	translate?: (key: string, defaultValue: string) => string
): ResolvedBaustein => ({
	id: 'browserNotification',
	headline: flowText(ERSTANTWORT_BROWSER_BRANCH.headline, translate),
	body: flowText(ERSTANTWORT_BROWSER_BRANCH.body, translate)
});

/* --------------------------------------------------------------------------
   Zusätze vom 07.09.2026, abends — Franks Ansagen nach dem ersten Durchgang
   -------------------------------------------------------------------------- */

/**
 * **Der quadratische Bildplatz in der Erfolgsnachricht.**
 *
 * Frank: die Erfolgsnachricht ist Modul 1 und enthält alles — kurzer Gruß, ein
 * **quadratischer** Bildplatz, und direkt dabei die häufigen Fragen. Er passt
 * seine Illustration auf „maximal quadratisch" an, also reserviert das Layout
 * 1:1 und erfindet keine Grafik.
 *
 * Der Text unten ist der **Auftrag an die Illustration**, nicht Produkttext: er
 * steht im Platzhalter und verschwindet mit ihm, sobald die Zeichnung da ist.
 * Deshalb hat er auch keinen i18n-Schlüssel — er wird nie ausgeliefert.
 */
export const ERSTANTWORT_IMAGE_BRIEF =
	'Die Anfrage kommt an: ein Umschlag erreicht ein offenes Fenster. Ruhig, ohne Personen, ohne Text im Bild.';

/**
 * **„Diese Hinweise nicht wieder anzeigen" — Franks dritte Ansage.**
 *
 * Er will den Fragenblock nicht bei jeder Anmeldung sehen. Der Wortlaut sagt
 * **was** verschwindet („diese Hinweise"), nicht „das hier": ein Kästchen, von
 * dem man nicht weiß, was es ausblendet, wird entweder nie oder aus Versehen
 * angehakt.
 *
 * **Was daran nicht Text ist**, steht im Verdrahtungspapier §14: ein solcher
 * Zustand braucht einen eigenen Auslöser und einen gespeicherten Zustand, und
 * ADR-018 §4 verbietet neuen Baustein-Zustand im Ereignis.
 */
export const ERSTANTWORT_DISMISS = {
	label: entry(
		'erstantwort.faq.dismiss.label',
		'Diese Hinweise nicht wieder anzeigen'
	),
	/** Was danach an der Stelle des Blocks steht — die Zeile, die ihn zurückholt. */
	dismissed: entry(
		'erstantwort.faq.dismiss.dismissed',
		'Die häufigen Fragen sind ausgeblendet.'
	),
	restore: entry('erstantwort.faq.dismiss.restore', 'Wieder anzeigen')
} as const;

/**
 * **Die Zeitmarke vor der Einwilligungsnachricht (Modul 4).**
 *
 * Modul 4 kommt **nicht** mit den anderen vier: die vier oben stehen in der
 * Sekunde, in der die Anfrage abgesendet wird, Modul 4 erst, wenn eine
 * Beratungsstelle die Anfrage angenommen hat — Minuten oder Tage später. Ohne
 * eine sichtbare Trennung liest sich die Kette als eine einzige Zustellung, und
 * die Person wundert sich, warum sie fünf Nachrichten auf einmal bekommt und
 * eine davon von einer Beratungsstelle spricht, die sie noch nie gesehen hat.
 *
 * Umgesetzt mit dem vorhandenen `MessageDateDivider` (Zeitleiste, Figma
 * 7539-29134) — kein neues Trennelement, damit die Kette aussieht wie der
 * Verlauf, in dem sie steht.
 */
export const ERSTANTWORT_LATER_MARKER = entry(
	'erstantwort.handoverConsent.timeMarker',
	'Später — die Beratungsstelle hat angenommen'
);

/**
 * **Die Ansage der Live-Region beim Weiterspringen.**
 *
 * Frank verlangt, dass nach jeder Antwort „smooth und angenehm" zur nächsten
 * Stelle weitergeleitet wird. Sichtbar leistet das der weiche Bildlauf; für
 * jemanden mit Screenreader leistet ihn **diese** Zeile, weil eine frisch
 * montierte Live-Region nichts ansagt. Sie steht deshalb dauerhaft im DOM und
 * bekommt nur neuen Inhalt.
 */
export const ERSTANTWORT_ADVANCE_ANNOUNCEMENT = entry(
	'erstantwort.flow.advanced',
	'Neue Nachricht von Carimat: {{subtitle}}'
);

/** Setzt die Ansage zusammen, ohne einen Übersetzungsaufruf zu brauchen. */
export const advanceAnnouncement = (
	subtitle: string,
	translate?: (key: string, defaultValue: string) => string
): string =>
	flowText(ERSTANTWORT_ADVANCE_ANNOUNCEMENT, translate).replace(
		'{{subtitle}}',
		subtitle
	);
