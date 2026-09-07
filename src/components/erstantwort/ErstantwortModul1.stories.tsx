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
import {
	ERSTANTWORT_SHORTENED,
	ERSTANTWORT_SUBTITLES,
	flowText
} from './erstantwortFlowCopy';
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
 * 2. **Die Fragen ins Akkordeon**, ausdrücklich auch „Soll ich meinen Namen
 *    nennen oder nicht?" — damit durchgehend nur kurze Zeilen stehen.
 *    **Ausgenommen: die Notfallnummern** (siehe unten, Entscheidung vom
 *    Nachmittag).
 * 3. **Die Erfolgsmeldung so kurz wie irgend möglich.**
 * 4. Ziel ist **ein Modul, keine Textwand**.
 * 5. **Die Unterzeile unter „Carimat" ist ein Handlungsaufruf** und kein
 *    Dekortext. Statt „Ihre ersten Schritte" steht hier „Hervorragend, Anfrage
 *    abgesendet" — Franks eigener Wortlaut. Sie ist ein benennbares Feld je
 *    Nachricht (`ERSTANTWORT_SUBTITLES`, `erstantwortFlowCopy.ts`), kein
 *    globaler Satz. Wie die Nachrichten aufeinanderfolgen, zeigt
 *    `Templates/Erstantwort-Ablauf`.
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
 * - **Die Produktfrage ist am 07.09. entschieden worden: die Notfallnummern
 *   bleiben offen.** Die frühere Fassung `(m1-b)` ist damit der Standard, und
 *   diese Datei zeigt nur noch sie. Die Alles-zu-Fassung steht als
 *   `(m1-vergleich)` daneben — verworfen, nicht angeboten. Der Grund: eine
 *   zugeklappte Zeile zeigt keine Telefonnummer, und wer in einer akuten
 *   Notlage ist, hat am wenigsten Kapazität, eine Zeile zu öffnen.
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
	args: {
		onAction: () => undefined,
		skipAnimation: true,
		/*
		 * **Die Unterzeile ist ein Handlungsaufruf** (Frank, 07.09.2026), kein
		 * Dekortext. Ausgeliefert steht dort in *jeder* Nachricht derselbe Satz
		 * „Ihre ersten Schritte"; hier meldet sie den Abschluss, der diese
		 * Nachricht auslöst. Der Wortlaut ist Franks eigenes Beispiel.
		 *
		 * Sie ist bewusst über `meta.args` gesetzt und nicht je Story: eine
		 * Nachricht hat **eine** Unterzeile, so wie sie eine Überschrift hat.
		 */
		subtitle: flowText(ERSTANTWORT_SUBTITLES.enquirySent)
	}
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
const SHORT_GREETING = flowText(ERSTANTWORT_SHORTENED.greeting);

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
   (m1) — der Standard seit 07.09.2026
   -------------------------------------------------------------------------- */

/**
 * **Die Anordnung, die Frank am 07.09. entschieden hat.**
 *
 * Bis dahin lagen zwei Fassungen nebeneinander: `(m1)` faltete die
 * Notfallnummern mit ins Akkordeon, `(m1-b)` ließ sie offen. Entschieden ist
 * **`(m1-b)`** — die Notfallnummern bleiben eine offene Blase. Diese Datei
 * benutzt ab jetzt nur noch sie; die Alles-zu-Fassung steht weiter unten als
 * Vergleich und ist ausdrücklich **nicht** mehr der Vorschlag.
 *
 * Der Grund ist kein gestalterischer: die Zeile, die man sucht, wenn man sie
 * braucht, darf nicht die Zeile sein, die man erst öffnen muss. Sie kostet
 * 116 px auf dem Telefon und liegt damit immer noch 354 px unter dem heutigen
 * Stand.
 */
const m1Bausteine = (): ResolvedBaustein[] => [
	...greetingShort(),
	FAQ_BUBBLE,
	...pick('emergencyNumbers'),
	...pick(...TAIL_IDS)
];

/** Die Vergleichsfassung: alles zugeklappt, Notfallnummern mit im Akkordeon. */
const m1AllesZuBausteine = (): ResolvedBaustein[] => [
	...greetingShort(),
	FAQ_BUBBLE,
	...pick(...TAIL_IDS)
];

/**
 * **(m1) Modul 1 — Standard. 6 Blasen statt 10.**
 *
 * Eine Zeile Ankunftsbestätigung → eine Blase „Häufige Fragen" mit fünf
 * zugeklappten Zeilen → die Notfallnummern **offen** → E-Mail-Karte → 2FA-Karte
 * → Abschluss. Kein Bild.
 *
 * Die fünf zugeklappten Zeilen, in dieser Reihenfolge:
 *
 * | # | Zeile | Rumpf aus |
 * | --- | --- | --- |
 * | 1 | Wer liest meine Nachricht? | `whoReadsAlong` |
 * | 2 | Wann bekomme ich eine Antwort? | `responseDeadline` |
 * | 3 | Soll ich meinen Namen nennen? | `noPersonalData` |
 * | 4 | Wie läuft die Beratung ab? | `modalityNote` |
 * | 5 | Was passiert mit meinen Daten? | `dataProtection` |
 *
 * Das ist **Franks Reihenfolge, nicht Katalogreihenfolge**: die Zeilen 1–3 sind,
 * was man in den ersten Sekunden fragt.
 *
 * `freeNotice` ist als sechste Zeile vorgesehen und erscheint hier nicht: sein
 * Default-Rumpf ist leer, und `erstantwortResolve` verwirft leere Bausteine.
 *
 * Die Notfall-Blase steht **unter** dem Akkordeon und nicht darüber: darüber
 * würde die Erstantwort mit einem Notfall eröffnen. Darunter ist sie die letzte
 * Zeile vor den freiwilligen Angeboten — immer noch vor jeder optionalen
 * Aktion, wie ADR-018 §6 es verlangt.
 */
export const M1Standard: Story = {
	name: '(m1) Modul 1 — Standard, Notfallnummern offen',
	args: {
		bausteine: m1Bausteine(),
		slots: faqSlot(ROWS_WITHOUT_EMERGENCY, false)
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
		slots: faqSlot(ROWS_WITHOUT_EMERGENCY, true)
	}
};

/**
 * **(m1) Nur das Modul — drei Blasen.** Ankunftsbestätigung, Akkordeon,
 * Notfallnummern; ohne die zwei Aktionskarten und den Abschluss.
 *
 * Das ist **kein** Vergleichswert gegen die heutigen 1479 px — es fehlen drei
 * ausgelieferte Blasen. Es zeigt, was Frank mit „ein Modul, keine Textwand"
 * meint, und was die Schwestermodule 2–3 umgeben würden.
 */
export const M1NurDasModul: Story = {
	name: '(m1) Nur das Modul — ohne Aktionskarten',
	args: {
		bausteine: [
			...greetingShort(),
			FAQ_BUBBLE,
			...pick('emergencyNumbers')
		],
		slots: faqSlot(ROWS_WITHOUT_EMERGENCY, false)
	}
};

/* --------------------------------------------------------------------------
   Vergleich — die verworfene Fassung
   -------------------------------------------------------------------------- */

/**
 * **(m1-vergleich) Alles zugeklappt — nicht mehr der Vorschlag.**
 *
 * Die Fassung, die auch die Notfallnummern ins Akkordeon faltet: 5 Blasen,
 * 1 009 px auf dem Telefon, 116 px kürzer als der Standard. Sie steht hier
 * ausschließlich, damit der Unterschied sichtbar bleibt und niemand die
 * Entscheidung später versehentlich zurückdreht, weil er die kürzere Zahl
 * findet und den Grund nicht.
 *
 * Der Grund: eine zugeklappte Zeile zeigt keine Telefonnummer. Wer in einer
 * akuten Notlage ist, hat am wenigsten Kapazität, eine Zeile zu öffnen.
 */
export const M1VergleichAllesZu: Story = {
	name: '(m1-vergleich) Alles zugeklappt — verworfen',
	args: {
		bausteine: m1AllesZuBausteine(),
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

/** **(m1-390)** — der Standard auf einem 390-px-Telefon. */
export const M1Phone390: Story = {
	name: '(m1-390) Telefon 390 px',
	globals: phone390Globals,
	args: {
		bausteine: m1Bausteine(),
		slots: faqSlot(ROWS_WITHOUT_EMERGENCY, false)
	}
};

/** **(m1-390)** mit offener erster Zeile. */
export const M1Phone390ErsteZeileOffen: Story = {
	name: '(m1-390) Telefon 390 px — erste Zeile offen',
	globals: phone390Globals,
	args: {
		bausteine: m1Bausteine(),
		slots: faqSlot(ROWS_WITHOUT_EMERGENCY, true)
	}
};

/** **(m1-1440)** — derselbe Standard auf dem Desktop. */
export const M1Desktop1440: Story = {
	name: '(m1-1440) Desktop 1440 px',
	globals: desktop1440Globals,
	args: {
		bausteine: m1Bausteine(),
		slots: faqSlot(ROWS_WITHOUT_EMERGENCY, false)
	}
};

/** **(m1-1440)** mit offener erster Zeile. */
export const M1Desktop1440ErsteZeileOffen: Story = {
	name: '(m1-1440) Desktop 1440 px — erste Zeile offen',
	globals: desktop1440Globals,
	args: {
		bausteine: m1Bausteine(),
		slots: faqSlot(ROWS_WITHOUT_EMERGENCY, true)
	}
};

/** **(m1-vergleich) auf dem Telefon** — die verworfene Alles-zu-Fassung. */
export const M1VergleichAllesZuPhone390: Story = {
	name: '(m1-vergleich-390) Alles zugeklappt, Telefon 390 px',
	globals: phone390Globals,
	args: {
		bausteine: m1AllesZuBausteine(),
		slots: faqSlot(ALL_ROW_IDS, false)
	}
};
