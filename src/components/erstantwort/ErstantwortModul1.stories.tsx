/*
 * `import * as React` is load-bearing, not habit: `npx tsc` passes without it
 * (tsconfig runs the automatic JSX runtime), but Storybook's Vite/esbuild
 * pipeline transpiles JSX to `React.createElement`, so a story file without it
 * renders "React is not defined" in the browser while every type gate stays
 * green. `ErstantwortLayouts.stories.tsx` carries the same import.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ErstantwortSequence } from './ErstantwortSequence';
import { ErstantwortFaqGroup } from './ErstantwortFaqGroup';
import { resolveErstantwortBausteine } from './erstantwortResolve';
import type { ResolvedBaustein } from './erstantwortResolve';
import { UNTOGGLEABLE_BAUSTEIN_IDS } from './erstantwortCatalogue';
import { ERSTANTWORT_MODUL1_FAQ_ROW_IDS } from './erstantwortFaqQuestions';
import './ErstantwortSequence.styles.scss';

/**
 * # Modul 1 — Erfolgsmeldung + ein Akkordeon
 *
 * **Vorschlag, nichts ist entschieden.** Begleitpapier:
 * `0 - Docs/VERDRAHTUNG-modul1-faq-2026-09-07.md`. Der ältere, breitere
 * Variantenvergleich steht unverändert unter `Templates/Erstantwort-Layouts`
 * (v0 heute, v1 FAQ, v2 Dialoge, v3 Illustration) — diese Datei fasst ihn nicht
 * an, damit man beide nebeneinander ansehen kann.
 *
 * ## Was Frank am 07.09. entschieden hat
 *
 * 1. **Kein Bild.** Die Illustration fällt komplett raus — auch aus der
 *    Begrüßungsblase, in die v1/v2 sie versuchsweise gesetzt hatten. Die
 *    Messung aus dem Vorschlagsdokument hatte gezeigt, dass sie auf dem Telefon
 *    195 px kostet und damit die gesamte Layout-Ersparnis auffrisst.
 * 2. **Alle Fragen ins Akkordeon**, ausdrücklich auch „Soll ich meinen Namen
 *    nennen oder nicht?" — damit durchgehend nur kurze Zeilen stehen.
 * 3. **Die Erfolgsmeldung so kurz wie irgend möglich.**
 * 4. Ziel ist **ein Modul, keine Textwand**.
 *
 * ## Die harte Randbedingung, und warum sie hält
 *
 * ADR-018 §6 macht `noPersonalData` und `emergencyNumbers` **unabschaltbar**
 * (`UNTOGGLEABLE_BAUSTEIN_IDS`) und ordnet sie vor jede optionale Aktion.
 *
 * - **Zuklappen ist kein Abschalten.** §6 verbietet einen *Schalter* — eine
 *   Träger-Konfiguration, die den Baustein verschwinden lässt. Eine
 *   Akkordeonzeile steht im DOM, auf dem Bildschirm und im Accessibility-Baum,
 *   ist nicht konfigurierbar und von keinem Träger entfernbar.
 * - **Die Reihenfolge-Zusage hält.** Die FAQ-Blase steht über
 *   `emailNotification` und `accountProtection`; beide Sicherheitstexte kommen
 *   also weiterhin vor jeder optionalen Aktion.
 * - **Offen bleibt eine Produktfrage**, keine Regelfrage: bei einer akuten
 *   Notlage hinter einem Klick zu stehen. Deshalb liegen hier **beide** Formen
 *   nebeneinander — `(m1)` faltet die Notfallnummern mit ein, `(m1-b)` lässt
 *   sie offen. Empfehlung im Verdrahtungspapier, entschieden wird das nicht
 *   hier.
 *
 * ADR-018 §4 friert den **Wortlaut** eines persistierten Ereignisses ein, nicht
 * sein Layout. Kein Fließtext unten ist umgeschrieben — **mit einer Ausnahme,
 * die man kennen muss:** die gekürzte Begrüßung ist eine echte
 * Wortlaut-Änderung und wirkt deshalb nur auf **neue** Erstantworten (Details
 * unten bei `(m1)` und im Verdrahtungspapier §2).
 */
const meta = {
	title: 'Templates/Erstantwort-Module',
	component: ErstantwortSequence,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	args: { onAction: () => undefined, skipAnimation: true }
} satisfies Meta<typeof ErstantwortSequence>;

export default meta;
type Story = StoryObj<typeof meta>;

const translate = (_key: string, defaultValue?: string) => defaultValue ?? '';

/** Nothing done yet: no e-mail, 2FA offered but not switched on. */
const OPEN_STATE = {
	hasEmail: false,
	isTwoFactorEnabled: true,
	isTwoFactorActive: false
};

/**
 * Resolved **once** from the shipped catalogue, exactly as `Erstantwort-Layouts`
 * does it. Every story below picks from this one array, so no comparison can be
 * won by quietly dropping a Baustein.
 */
const SHIPPED_SEQUENCE: ResolvedBaustein[] = resolveErstantwortBausteine({
	trigger: 'AFTER_FIRST_MESSAGE',
	context: { conversationType: 'AGENCY_COUNSELLING' },
	translate,
	state: OPEN_STATE
}).bausteine;

const byId = (id: string): ResolvedBaustein | undefined =>
	SHIPPED_SEQUENCE.find((baustein) => baustein.id === id);

const pick = (...ids: readonly string[]): ResolvedBaustein[] =>
	ids
		.map(byId)
		.filter((baustein): baustein is ResolvedBaustein => Boolean(baustein));

/**
 * **Die einzige Wortlaut-Änderung in diesem Modul.**
 *
 * Ausgeliefert steht dort heute: „Schön, dass Sie sich gemeldet haben. Ihre
 * Nachricht ist bei uns angekommen." Franks Vorgabe war „so kurz wie irgend
 * möglich", also bleibt der zweite Satz — der, der die Ankunft bestätigt.
 *
 * Der Preis ist die Wärme des ersten Satzes. Das ist eine Abwägung, keine
 * Optimierung: „Schön, dass Sie sich gemeldet haben" ist die einzige Stelle der
 * Sequenz, an der die Plattform nicht informiert, sondern begrüßt. Beide Sätze
 * stehen im Verdrahtungspapier als offene Frage nebeneinander.
 *
 * Technisch ist das **nicht** dieselbe Art Änderung wie die Umgruppierung: der
 * Katalog-Default und `erstantwort.greeting.body` in allen sieben Locales
 * müssten geändert werden, und alte, bereits persistierte Ereignisse behalten
 * ihren langen Satz (ADR-018 §4).
 */
const SHORT_GREETING = 'Ihre Nachricht ist bei uns angekommen.';

const greetingShort = (): ResolvedBaustein[] => {
	const greeting = byId('greeting');
	return greeting ? [{ ...greeting, body: SHORT_GREETING }] : [];
};

/**
 * Die FAQ-Blase. **Kein Katalog-Baustein**, sondern ein Container, den das
 * Layout einführt — genau der Eintrag, der nach `erstantwortCatalogue.ts`
 * wandern müsste, wenn Frank die Variante wählt (Verdrahtungspapier §1).
 *
 * `body: ''` ist Absicht: die Überschrift trägt die Blase, und „Öffnen Sie, was
 * Sie interessiert." wäre genau die Textzeile, die dieses Modul loswerden soll.
 * Die leere Zeile wird in `ErstantwortFaqGroup.styles.scss` ausgeblendet, damit
 * sie keine Zeilenhöhe kostet.
 */
const FAQ_BUBBLE: ResolvedBaustein = {
	id: 'faq',
	headline: 'Häufige Fragen',
	body: ''
};

/** Alle sechs Zeilen (`freeNotice` ist leer und fällt beim Auflösen weg). */
const ALL_ROW_IDS = ERSTANTWORT_MODUL1_FAQ_ROW_IDS;

/*
 * ADR-018 §6, mechanisch geprüft statt zugesagt: beide Sicherheits-Bausteine
 * müssen in Modul 1 vorkommen. Wer sie später still aus der Reihenfolge nimmt,
 * bekommt hier einen Fehler, statt eine Sequenz auszuliefern, der ein
 * Sicherheitstext fehlt. Das ist die eine Zusicherung, die diese Datei selbst
 * halten kann — dass die Zeile auch *gefunden* wird, kann sie nicht prüfen, und
 * genau darum steht `(m1-b)` daneben.
 */
const missingSafetyRow = UNTOGGLEABLE_BAUSTEIN_IDS.find(
	(id) => !ALL_ROW_IDS.includes(id)
);
if (missingSafetyRow) {
	throw new Error(
		`Modul 1: safety Baustein "${missingSafetyRow}" is missing from the FAQ ` +
			'row order (ADR-018 §6 — it may be folded, never dropped).'
	);
}

/** `(m1-b)`: dieselbe Reihe ohne die Notfallnummern — die bleiben offen. */
const ROWS_WITHOUT_EMERGENCY = ALL_ROW_IDS.filter(
	(id) => id !== 'emergencyNumbers'
);

const faqSlot = (rowIds: readonly string[], openFirst: boolean) => ({
	faq: (
		<ErstantwortFaqGroup
			bausteine={pick(...rowIds)}
			openFirst={openFirst}
			translate={translate}
		/>
	)
});

/**
 * Die Blasen nach der FAQ-Blase: die zwei ausgelieferten Aktionsblasen und der
 * Abschluss.
 *
 * Sie bleiben absichtlich **offene** Blasen. Eine Schaltfläche hinter einer
 * geschlossenen Zeile ist eine Zusage, die man erst aufklappen muss — und die
 * beiden Aktionen sind das, was ADR-018 §1 ausdrücklich gegen eine freie
 * Textfläche verteidigt hat. Sie bleiben außerdem in der Sequenz, damit die
 * Höhenmessung unten mit den 1479 px von heute vergleichbar ist: kein Vergleich
 * darf dadurch gewonnen werden, dass etwas verschwindet.
 */
const TAIL_IDS = ['emailNotification', 'accountProtection', 'closing'];

/* --------------------------------------------------------------------------
   (m1) — Erfolg + FAQ
   -------------------------------------------------------------------------- */

const m1Bausteine = (): ResolvedBaustein[] => [
	...greetingShort(),
	FAQ_BUBBLE,
	...pick(...TAIL_IDS)
];

/**
 * **(m1) Modul 1 — Erfolg + FAQ. 5 Blasen statt 10.**
 *
 * Eine Zeile Ankunftsbestätigung → **eine** Blase „Häufige Fragen" mit sechs
 * zugeklappten Zeilen → E-Mail-Karte → 2FA-Karte → Abschluss. Kein Bild.
 *
 * Die sechs Zeilen, in dieser Reihenfolge:
 *
 * | # | Zeile | Rumpf aus |
 * | --- | --- | --- |
 * | 1 | Wer liest meine Nachricht? | `whoReadsAlong` |
 * | 2 | Wann bekomme ich eine Antwort? | `responseDeadline` |
 * | 3 | Soll ich meinen Namen nennen? | `noPersonalData` |
 * | 4 | Wie läuft die Beratung ab? | `modalityNote` |
 * | 5 | Was passiert mit meinen Daten? | `dataProtection` |
 * | 6 | Was, wenn es nicht warten kann? | `emergencyNumbers` |
 *
 * Das ist **Franks Reihenfolge, nicht Katalogreihenfolge**: der Katalog führt
 * `modalityNote` vor `noPersonalData` und `dataProtection` nach
 * `emergencyNumbers`. Die Zeilen 1–3 sind, was man in den ersten Sekunden
 * fragt; die Notfallnummern sind die Zeile, die man sucht, wenn man sie
 * braucht, nicht die, die man der Reihe nach liest.
 *
 * `freeNotice` ist als siebte Zeile vorgesehen und erscheint hier nicht: sein
 * Default-Rumpf ist leer, und `erstantwortResolve` verwirft leere Bausteine —
 * das ist das gebaute Verhalten des Freien Hinweises, bis ein Träger ihn füllt.
 *
 * **Was hier zu prüfen ist:** Erkennt man ohne Anleitung, dass die Zeilen
 * aufgehen? Und ist „Soll ich meinen Namen nennen?" als Zeile so verständlich
 * wie die heutige Überschrift „Bitte keine persönlichen Daten senden"?
 */
export const M1ErfolgUndFaq: Story = {
	name: '(m1) Modul 1 — Erfolg + FAQ',
	args: {
		bausteine: m1Bausteine(),
		slots: faqSlot(ALL_ROW_IDS, false)
	}
};

/**
 * **(m1) mit offener erster Zeile.** Dieselbe Anordnung, „Wer liest meine
 * Nachricht?" steht schon aufgeklappt da.
 *
 * Der Preis ist Höhe, der Gewinn ist, dass die Zeilen sichtbar aufklappbar
 * sind. Der Chevron leistet das auch — deshalb liegen beide nebeneinander.
 */
export const M1ErsteZeileOffen: Story = {
	name: '(m1) Modul 1 — erste Zeile offen',
	args: {
		bausteine: m1Bausteine(),
		slots: faqSlot(ALL_ROW_IDS, true)
	}
};

/* --------------------------------------------------------------------------
   (m1-b) — Notfallnummern bleiben offen
   -------------------------------------------------------------------------- */

/**
 * **(m1-b) Variante — Notfallnummern bleiben offen. 6 Blasen.**
 *
 * Identisch zu `(m1)`, nur bleibt `emergencyNumbers` eine **offene Blase unter
 * dem Akkordeon**: „Wenn es nicht warten kann" mit Telefonseelsorge und 112 im
 * Klartext, ohne Tipp.
 *
 * **Warum diese Variante überhaupt existiert.** ADR-018 §6 macht
 * `noPersonalData` und `emergencyNumbers` unabschaltbar und ordnet sie bewusst
 * vor jede optionale Aktion. Zuklappen ist kein Abschalten — Franks Wunsch ist
 * also umsetzbar, und `(m1)` setzt ihn um. Aber bei einer akuten Notlage hinter
 * einem Klick zu stehen, ist eine **Produktentscheidung**, die Frank sehen
 * soll, bevor sie fällt. Beide Formen sind gebaut, eine ist empfohlen, keine
 * ist entschieden.
 *
 * Die Blase steht **unter** dem Akkordeon und nicht darüber: darüber wäre sie
 * das Erste nach der Ankunftsbestätigung und würde die Erstantwort mit einem
 * Notfall eröffnen. Darunter ist sie die letzte Zeile vor den freiwilligen
 * Angeboten — immer noch vor jeder optionalen Aktion, wie §6 es verlangt.
 */
export const M1bNotrufnummernOffen: Story = {
	name: '(m1-b) Variante — Notfallnummern bleiben offen',
	args: {
		bausteine: [
			...greetingShort(),
			FAQ_BUBBLE,
			...pick('emergencyNumbers'),
			...pick(...TAIL_IDS)
		],
		slots: faqSlot(ROWS_WITHOUT_EMERGENCY, false)
	}
};

/* --------------------------------------------------------------------------
   Das Modul für sich
   -------------------------------------------------------------------------- */

/**
 * **Nur das Modul — zwei Blasen.** Ankunftsbestätigung plus Akkordeon, ohne die
 * zwei Aktionskarten und den Abschluss.
 *
 * Das ist **kein** Vergleichswert gegen die heutigen 1479 px — es fehlen drei
 * ausgelieferte Blasen. Es zeigt, was Frank mit „ein Modul, keine Textwand"
 * meint, und was die Schwestermodule 2–4 umgeben würden.
 */
export const M1NurDasModul: Story = {
	name: '(m1) Nur das Modul — ohne Aktionskarten',
	args: {
		bausteine: [...greetingShort(), FAQ_BUBBLE],
		slots: faqSlot(ALL_ROW_IDS, false)
	}
};

/* --------------------------------------------------------------------------
   Ansichten für die Screenshots
   -------------------------------------------------------------------------- */

/*
 * Der Viewport liegt in **globals**, nicht in parameters: Storybook 10 ignoriert
 * das alte `parameters.viewport.defaultViewport`, und die eingebaute `mobile1`
 * (320 px) ist in diesem Setup gar nicht registriert. `phone390` und
 * `desktop1440` kommen aus `.storybook/preview.tsx` (ORISO-Frontend#849); die
 * Begründung steht ausführlich in `../message/messageStoryShell.tsx`. Hier
 * bewusst lokal wiederholt statt importiert — `messageStoryShell` zieht die
 * kompletten `MessageItemComponent`-Mocks nach, die dieses Modul nicht braucht.
 */
const phone390Globals = { viewport: { value: 'phone390' } };
const desktop1440Globals = { viewport: { value: 'desktop1440' } };

/** **(m1-390)** — Modul 1 auf einem 390-px-Telefon, alles zugeklappt. */
export const M1Phone390: Story = {
	name: '(m1-390) Telefon 390 px',
	globals: phone390Globals,
	args: {
		bausteine: m1Bausteine(),
		slots: faqSlot(ALL_ROW_IDS, false)
	}
};

/** **(m1-390)** mit offener erster Zeile. */
export const M1Phone390ErsteZeileOffen: Story = {
	name: '(m1-390) Telefon 390 px — erste Zeile offen',
	globals: phone390Globals,
	args: {
		bausteine: m1Bausteine(),
		slots: faqSlot(ALL_ROW_IDS, true)
	}
};

/** **(m1-1440)** — dasselbe Modul auf dem Desktop. */
export const M1Desktop1440: Story = {
	name: '(m1-1440) Desktop 1440 px',
	globals: desktop1440Globals,
	args: {
		bausteine: m1Bausteine(),
		slots: faqSlot(ALL_ROW_IDS, false)
	}
};

/** **(m1-1440)** mit offener erster Zeile. */
export const M1Desktop1440ErsteZeileOffen: Story = {
	name: '(m1-1440) Desktop 1440 px — erste Zeile offen',
	globals: desktop1440Globals,
	args: {
		bausteine: m1Bausteine(),
		slots: faqSlot(ALL_ROW_IDS, true)
	}
};

/** **(m1-b) auf dem Telefon** — die Variante mit offenen Notfallnummern. */
export const M1bPhone390: Story = {
	name: '(m1-b-390) Notfallnummern offen, Telefon 390 px',
	globals: phone390Globals,
	args: {
		bausteine: [
			...greetingShort(),
			FAQ_BUBBLE,
			...pick('emergencyNumbers'),
			...pick(...TAIL_IDS)
		],
		slots: faqSlot(ROWS_WITHOUT_EMERGENCY, false)
	}
};
