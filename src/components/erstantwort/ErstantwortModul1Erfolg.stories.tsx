/*
 * **Kein `import * as React` hier**, anders als in den Schwester-Stories: die
 * Schwestern setzen ihre Blasen selbst mit JSX zusammen und brauchen den
 * Import, weil Storybooks Vite/esbuild-Pipeline JSX nach `React.createElement`
 * übersetzt. Diese Datei enthält **kein JSX** — sie reicht nur Args an eine
 * fertige Komponente. Ein Import „auf Verdacht" wäre hier eine Warnung im
 * Lint-Tor (`eslint --max-warnings=0`), also die eine Stelle, an der die Regel
 * der Schwesterdateien nicht gilt.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { ErstantwortSuccessMessage } from './ErstantwortSuccessMessage';
import {
	contrastRatio,
	darkSchemeGlobals,
	desktop1440Globals,
	phone390Globals,
	relativeLuminance,
	schemeToken
} from '../message/messageStoryShell';

/**
 * # Modul 1 — die Erfolgsnachricht, Fassung 07.09.2026 abends
 *
 * **Vorschlag, nichts ist verdrahtet.** Begleitpapier:
 * `0 - Docs/VERDRAHTUNG-erstantwort-ablauf-2026-09-07.md`, Abschnitt vom
 * 07.09. abends.
 *
 * Diese Datei ersetzt die Fassung vom Vormittag, die als
 * `(m1) …` in `ErstantwortModul1.stories.tsx` **unverändert stehen bleibt** —
 * damit man sieht, was sich geändert hat, und nicht nur, was jetzt gilt.
 *
 * ## Was Frank am Abend des 07.09. gesagt hat
 *
 * 1. **„Modul 1 ist die Erfolgsnachricht und enthält alles."** Kurzer Gruß,
 *    dazu ein **quadratischer Bildplatz**, und **direkt dabei** die häufigen
 *    Fragen. Nicht drei Nachrichten, nicht ein Knopf, hinter dem etwas liegt.
 * 2. **Der Bildplatz ist reserviert, nicht gezeichnet.** Frank passt seine
 *    Illustration auf *maximal quadratisch* an; das Layout hält deshalb 1:1
 *    frei und benennt den Platz sichtbar, genau wie der Schritt-Platzhalter in
 *    Modul 3. Eine erfundene Grafik würde für die Entscheidung gehalten.
 * 3. **Die letzte Frage bleibt zugeklappt — und wird rot.** Wörtlich: *„Ich
 *    würde sie einfach rot lassen. Und dann kann der Nutzer sie ja auch selbst
 *    ausklappen."* Die Empfehlung, sie offen zu lassen, ist damit **verworfen**.
 * 4. **Zusätzlich eine Variante mit „nicht wieder anzeigen"**, damit der
 *    Fragenblock nicht bei jeder Anmeldung erscheint.
 *
 * ## Die rote Zeile — was sie ist und was sie nicht ist
 *
 * Sie ist die Primärrolle über `--m3-primary`, **keine feste Farbe**: ein
 * Träger mit einer anderen Primärfarbe bekommt seine eigene, statt eines
 * fremden Rots mitten im eigenen Schema. Gemessen gegen den Blasenhintergrund
 * (`#eeeeee`) liegt der ausgelieferte Wert `#a5000a` bei **6,95:1** — WCAG 2.2
 * AA für Fließtext verlangt 4,5:1.
 *
 * Farbe ist dabei nie das **einzige** Signal (WCAG 1.4.1): die Zeile trägt
 * weiter ihren Text, „Was, wenn es nicht warten kann?".
 *
 * ADR-018 §6 hält unverändert. §6 verbietet einen **Schalter**, mit dem ein
 * Träger den Baustein verschwinden lässt — eine Akkordeonzeile steht im DOM,
 * auf dem Bildschirm und im Accessibility-Baum, ist nicht konfigurierbar und
 * von niemandem entfernbar. Und sie steht vor jeder optionalen Aktion: die
 * Benachrichtigungs-Auswahl ist erst die nächste Nachricht.
 *
 * Die Gegenrechnung, die dabei aufgegeben wird, gehört genannt: eine
 * zugeklappte Zeile zeigt **keine Telefonnummer**. Wer in einer akuten Notlage
 * ist, muss sie öffnen. Das ist Franks Entscheidung, nicht die Ableitung des
 * Layouts — die Farbe ist der Preis, der dafür bezahlt wird.
 */
const meta = {
	title: 'Erstantwort/Organisms/SuccessMessage',
	component: ErstantwortSuccessMessage,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	args: {}
} satisfies Meta<typeof ErstantwortSuccessMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------------------------------------------------
   Mit und ohne Bildplatz
   -------------------------------------------------------------------------- */

/**
 * **(m1-erfolg) Die Erfolgsnachricht mit dem quadratischen Bildplatz.**
 *
 * Eine Blase mit Gruß und reservierter Fläche, darunter eine Blase mit den
 * häufigen Fragen — sieben Zeilen, alle zugeklappt, die letzte rot.
 *
 * Der Platz ist auf 260 px Kantenlänge gedeckelt, und das ist eine
 * Gestaltungsentscheidung, keine Rundung: ein Quadrat in voller Blasenbreite
 * misst auf dem Desktop **528 px** (die Kappung von
 * `.pseudonymCard__bubble`) und wäre dort ein Plakat, kein Bild in einer
 * Sprechblase. Wer den Platz ändert, ändert `size` — Höhe folgt Breite, weil
 * die Fläche quadratisch **ist**.
 */
export const M1ErfolgMitBild: Story = {
	name: '(m1-erfolg) Erfolgsnachricht — mit Bildplatz',
	globals: phone390Globals,
	args: { showImage: true }
};

/**
 * **(m1-erfolg) Dieselbe Nachricht ohne Bildplatz.** Die Vergleichsaufnahme für
 * die Höhe: der Unterschied zwischen beiden ist genau die reservierte Fläche
 * plus ihr Abstand.
 */
export const M1ErfolgOhneBild: Story = {
	name: '(m1-erfolg) Erfolgsnachricht — ohne Bildplatz',
	globals: phone390Globals,
	args: { showImage: false }
};

/* --------------------------------------------------------------------------
   Die rote Notruf-Zeile
   -------------------------------------------------------------------------- */

/**
 * **(m1-notruf) Die rote Zeile, zugeklappt.** So kommt die Nachricht an.
 *
 * Ohne den Bildplatz aufgenommen, damit die Zeilen mit dem Carimat-Kopf in ein
 * eng beschnittenes Bild passen — die Farbe ist der Gegenstand dieser Aufnahme,
 * nicht die Höhe.
 *
 * Die `play`-Funktion läuft in CI mit und belegt zwei Dinge, die ein Screenshot
 * nicht belegt: dass die Zeile **zu** ist (`aria-expanded="false"`) und dass
 * genau **eine** Zeile die Primärrolle trägt. Ein rotes Akkordeon wäre keine
 * hervorgehobene Zeile mehr, sondern ein Warnkasten.
 */
export const M1NotrufZu: Story = {
	name: '(m1-notruf) Notruf-Zeile rot — zugeklappt',
	globals: phone390Globals,
	args: { showImage: false },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const row = canvas.getByTestId('erstantwort-faq-emergencyNumbers');

		expect(row.getAttribute('data-tone')).toBe('primary');
		expect(
			within(row).getByRole('button').getAttribute('aria-expanded')
		).toBe('false');

		/* Genau eine rote Zeile — sonst ist es kein Hinweis mehr. */
		expect(
			canvasElement.querySelectorAll('[data-tone="primary"]').length
		).toBe(1);

		/* Und sie lässt sich öffnen, was Franks halber Satz war: „dann kann der
		   Nutzer sie ja auch selbst ausklappen".
		 *
		 * Auf und wieder zu, nicht nur auf: diese Story ist zugleich die
		 * Aufnahme des **zugeklappten** Zustands, und eine `play`-Funktion, die
		 * die Zeile offen stehen lässt, macht aus dem Screenshot still die
		 * andere Story. Das ist die Falle, in die dieser Test schon einmal
		 * getreten ist — beide Aufnahmen waren 598 px hoch statt 494 und 598.
		 */
		await userEvent.click(within(row).getByRole('button'));
		expect(
			within(row).getByRole('button').getAttribute('aria-expanded')
		).toBe('true');

		await userEvent.click(within(row).getByRole('button'));
		expect(
			within(row).getByRole('button').getAttribute('aria-expanded')
		).toBe('false');
	}
};

/**
 * **(m1-notruf) Die rote Zeile, aufgeklappt.** Was hinter ihr steht — die
 * ausgelieferten Notfallnummern, Wortlaut unverändert (ADR-018 §4 friert den
 * Text eines persistierten Ereignisses ein; ein Layout darf ihn falten, nie
 * umschreiben).
 */
export const M1NotrufOffen: Story = {
	name: '(m1-notruf) Notruf-Zeile rot — aufgeklappt',
	globals: phone390Globals,
	args: { showImage: false, openPrimaryRow: true }
};

/* --------------------------------------------------------------------------
   „Nicht wieder anzeigen"
   -------------------------------------------------------------------------- */

/**
 * **(m1-nicht-wieder) Mit „Diese Hinweise nicht wieder anzeigen".**
 *
 * Franks vierte Ansage. Das Kästchen sitzt **unter** den Zeilen — darüber wäre
 * das erste Angebot der Erfolgsnachricht, sie wegzuklicken.
 *
 * Angehakt klappt der Block zusammen und hinterlässt eine Zeile, die ihn
 * zurückholt. Der Block verschwindet bewusst **nicht spurlos**: ohne ein Wort
 * auf dem Bildschirm findet niemand mehr zurück.
 *
 * ## Was daran keine Darstellung ist
 *
 * Dieser Zustand ist die einzige Neuerung des Abends, die nicht allein im
 * Frontend zu haben ist. Er braucht
 *
 * - **einen eigenen Auslöser** — „bei der Anmeldung, sofern nicht abbestellt"
 *   ist eine Bedingung, die der Katalog heute nicht kennt, und
 * - **einen gespeicherten Zustand**, der die Sitzung überlebt.
 *
 * **ADR-018 §4 verbietet, ihn ins Ereignis zu schreiben:** das Ereignis friert
 * den Wortlaut ein und liest Erledigung aus **Live-Zustand**; ein Baustein,
 * dessen Erledigung nicht schon anderswo abgebildet ist, gehört nicht in diesen
 * Katalog. Wo er stattdessen leben müsste, steht im Verdrahtungspapier §14.
 */
export const M1NichtWiederAnzeigen: Story = {
	name: '(m1-nicht-wieder) „Diese Hinweise nicht wieder anzeigen"',
	globals: phone390Globals,
	args: { showImage: false, dismissible: true }
};

/**
 * **(m1-nicht-wieder) Der Zustand danach.** Was bei der nächsten Anmeldung an
 * der Stelle des Blocks steht, wenn das Kästchen angehakt war.
 */
export const M1NichtWiederAnzeigenAusgeblendet: Story = {
	name: '(m1-nicht-wieder) … angehakt, Block ausgeblendet',
	globals: phone390Globals,
	args: { showImage: false, dismissible: true, initialDismissed: true }
};

/* --------------------------------------------------------------------------
   Desktop
   -------------------------------------------------------------------------- */

/**
 * **(m1-erfolg-1440)** — dieselbe Nachricht auf dem Desktop. Der Bildplatz
 * bleibt bei 260 px und wächst **nicht** mit der Blase mit; siehe oben, warum.
 */
export const M1ErfolgDesktop1440: Story = {
	name: '(m1-erfolg-1440) Erfolgsnachricht — Desktop',
	globals: desktop1440Globals,
	args: { showImage: true }
};

/* --------------------------------------------------------------------------
   Dunkles Schema
   -------------------------------------------------------------------------- */

/**
 * **(m1-dunkel) Modul 1 im dunklen Schema — und was dabei herauskommt.**
 *
 * Die erste dunkle Story im ganzen Zweig. Der Umschalter
 * (`.storybook/withOrisoScheme.tsx`, seit ORISO-Frontend#898) hatte bis zum
 * 07.09.2026 **null** Nutzer: `grep -rn "scheme: 'dark'" src --include="*.stories.tsx"`
 * fand keinen Treffer.
 *
 * <h3>Der Mechanismus, gemessen statt vermutet</h3>
 *
 * Die Carimat-Blase folgt dem Schema **nicht**: `.pseudonymCard__bubble` setzt
 * `background: #eeeeee` als **festen Hex-Wert** (`PseudonymCard.styles.scss`).
 * Die Schrift *in* der Blase hat dagegen keine eigene Farbe und erbt sie von
 * `document.body` — und die setzt der Umschalter auf `--m3-on-surface`. Im
 * dunklen Schema läuft der Text also nach hell, der Untergrund bleibt hellgrau.
 *
 * Gemessen auf dieser Story (390 px, Schema `dark`, Seed `#a5000a`):
 *
 * | Element | Farbe | gegen die Blase `#eeeeee` |
 * | --- | --- | --- |
 * | Fragenzeile (`.erstantwortDisclosure__toggle`) | `#e4e2e2` | **1,11:1** |
 * | Überschrift „Häufige Fragen" | `#e4e2e2` | **1,11:1** |
 * | rote Notfallzeile (`--m3-primary` dunkel) | `#ffb4a8` | **1,46:1** |
 * | Fließtext (`.pseudonymCard__bubbleText`) | `#1c1b1f` | 14,76:1 |
 *
 * WCAG 2.2 AA verlangt 4,5:1 für Fließtext. Die letzte Zeile ist der Punkt:
 * **in derselben Blase** ist eine Zeile lesbar und die darüber nicht — weil die
 * eine ihre Farbe fest verdrahtet hat und die andere die Rolle benutzt. Im
 * hellen Schema heben sich die beiden Fehler gegenseitig auf; erst hier fallen
 * sie auseinander.
 *
 * Dazu der Kopf über der Blase, der auf dem dunklen Grund steht:
 * `.pseudonymCard__headerName` („Carimat") ist fest `#1f2937` → **1,26:1**, und
 * `.pseudonymCard__headerSubtitle` benutzt mit `--m3-secondary-container` eine
 * **Container-Rolle als Textfarbe** → **2,0:1**.
 *
 * Das ist **kein Fehler dieser Story**. Der Docblock des Umschalters sagt es
 * selbst: *„Expect components to look wrong in dark. That is the finding this
 * switcher exists to surface."*
 *
 * Die `play`-Funktion hält den Befund fest, statt ihn zu behaupten: sie belegt,
 * dass das Schema wirklich dunkel gerendert hat, und misst dann, dass die Blase
 * trotzdem hell geblieben ist. **Wenn jemand `.pseudonymCard__bubble` auf eine
 * M3-Rolle umstellt, fällt diese Story um** — und muss dann angepasst werden.
 * Das ist beabsichtigt: der Befund darf nicht still verschwinden.
 *
 * <h3>Warum das a11y-Tor es nicht gemeldet hat</h3>
 *
 * Es läuft nicht. `.storybook/vitest.setup.ts` ruft `setProjectAnnotations`
 * selbst auf; seit Storybook 10.3 überspringt `@storybook/addon-vitest` dann
 * das automatische Einhängen der Addon-Annotationen — und damit auch den
 * axe-Lauf von `addon-a11y`. Der Lauf schreibt das als Info-Kasten selbst hin.
 * Gegenprobe: eine Wegwerf-Story mit 1,11:1, einem Knopf ohne Namen und einem
 * `<img>` ohne `alt` lief **grün** durch `vitest --project storybook`.
 * `parameters.a11y.test: 'error'` in `.storybook/preview.tsx` gilt damit heute
 * nur im Browser-Panel, nicht im Tor.
 */
export const M1Dunkel: Story = {
	name: '(m1-dunkel) Dunkles Schema — Telefon 390',
	globals: { ...phone390Globals, ...darkSchemeGlobals },
	args: { showImage: false },
	play: async ({ canvasElement }) => {
		/* 1. Das Schema ist wirklich dunkel — gemessen, nicht angesehen. */
		const surface = schemeToken('--m3-surface');
		const onSurface = schemeToken('--m3-on-surface');
		expect(relativeLuminance(surface)).toBeLessThan(0.1);
		expect(relativeLuminance(onSurface)).toBeGreaterThan(0.5);

		/* 2. Der Befund: die Blase ist dem Schema nicht gefolgt. */
		const bubble = canvasElement.querySelector<HTMLElement>(
			'.pseudonymCard__bubble'
		);
		expect(bubble).not.toBeNull();
		const bubbleBackground = getComputedStyle(
			bubble as HTMLElement
		).backgroundColor;
		expect(relativeLuminance(bubbleBackground)).toBeGreaterThan(0.5);

		/* 3. Und was das kostet: die Fragenzeilen zeichnen ihre Schrift korrekt
		   aus `--m3-on-surface` — hell — und stehen damit auf hellgrau. Die
		   Zahl steht hier, damit der Befund eine Größe hat und nicht nur ein
		   Adjektiv. Unter 4,5:1 ist Fließtext nach WCAG 2.2 AA durchgefallen. */
		const row = canvasElement.querySelector<HTMLElement>(
			'.erstantwortDisclosure__toggle'
		);
		expect(row).not.toBeNull();
		const rowColour = getComputedStyle(row as HTMLElement).color;
		expect(contrastRatio(rowColour, bubbleBackground)).toBeLessThan(4.5);
	}
};
