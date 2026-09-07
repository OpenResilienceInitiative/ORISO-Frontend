import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { ErstantwortFaqGroup } from './ErstantwortFaqGroup';
import {
	ERSTANTWORT_MODUL1_FAQ_ROW_IDS,
	ERSTANTWORT_FAQ_QUESTIONS
} from './erstantwortFaqQuestions';
import {
	resolveErstantwortBausteine,
	type ResolvedBaustein
} from './erstantwortResolve';
import { phone390Globals } from '../message/messageStoryShell';
import '../pseudonym/PseudonymCard.styles.scss';
import './ErstantwortSequence.styles.scss';

/**
 * **Die Fragen-Gruppe** — der eigentliche Gewinn von Modul 1: aus sieben
 * Informationsblasen wird **eine** Blase mit sieben zugeklappten Zeilen.
 *
 * Bis heute war das nur in `Templates/Erstantwort-Module` und
 * `Templates/Erstantwort-Layouts` zu sehen; der Nachweis, dass das Aufklappen
 * überhaupt funktioniert, lag in einer fremden Story
 * (`0 - Docs/INVENTAR-bausteine-chat-2026-09-07.md`, §4.1, P2).
 *
 * <h3>Zwei Regeln, die dieser Baustein niemals brechen darf</h3>
 *
 * 1. **Wortlaut ist unantastbar.** Die `body`-Texte kommen **wörtlich** aus dem
 *    ausgelieferten Katalog. ADR-018 §4 friert den Wortlaut eines
 *    persistierten Ereignisses ein: ein Layout darf ihn falten, nie
 *    umschreiben. Neu ist ausschließlich die Zeilen-Überschrift
 *    (`erstantwortFaqQuestions.ts`) — weil eine Aussage auf einer zugeklappten
 *    Zeile nicht funktioniert: niemand öffnet „Wann Sie eine Antwort
 *    erhalten", aber „Wann bekomme ich eine Antwort?" schon.
 * 2. **Kein Sicherheits-Baustein wird verschluckt.** `noPersonalData` und
 *    `emergencyNumbers` sind `UNTOGGLEABLE_BAUSTEIN_IDS` (ADR-018 §6). Diese
 *    Komponente rendert, was der Aufrufer ihr gibt — die Auswahl ist also
 *    Sache des Aufrufers, und dass beide Zeilen vorkommen, prüft die erste
 *    `play`-Funktion hier mit.
 *
 * Der zugeklappte Bereich ist **ausgehängt**, nicht versteckt: nichts
 * Zugeklapptes wird vorgelesen oder ist mit Tab erreichbar.
 */
const meta = {
	title: 'Erstantwort/Molecules/FaqGroup',
	component: ErstantwortFaqGroup,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	decorators: [
		(Story) => (
			<div
				className="pseudonymCard__bubble erstantwort__bubble"
				style={{ width: '100%', maxWidth: 520 }}
			>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof ErstantwortFaqGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const translate = (_key: string, defaultValue: string) => defaultValue;

/**
 * Aus dem **ausgelieferten** Katalog aufgelöst, nicht nachgetippt. Was in den
 * Zeilen steht, steht so im Produkt.
 */
const SHIPPED: ResolvedBaustein[] = resolveErstantwortBausteine({
	trigger: 'AFTER_FIRST_MESSAGE',
	context: { conversationType: 'AGENCY_COUNSELLING' },
	translate,
	state: {
		hasEmail: false,
		isTwoFactorEnabled: true,
		isTwoFactorActive: false
	}
}).bausteine;

const ROWS: ResolvedBaustein[] = ERSTANTWORT_MODUL1_FAQ_ROW_IDS.map((id) =>
	SHIPPED.find((baustein) => baustein.id === id)
).filter((baustein): baustein is ResolvedBaustein => Boolean(baustein));

const PRIMARY_ROW_IDS = ['emergencyNumbers'] as const;

const row = (canvasElement: HTMLElement, id: string) =>
	within(canvasElement).getByTestId(`erstantwort-faq-${id}`);

const isOpen = (element: HTMLElement) =>
	within(element).getByRole('button').getAttribute('aria-expanded') ===
	'true';

/* --------------------------------------------------------------------------
   Ruhezustand
   -------------------------------------------------------------------------- */

/**
 * **Alles zu.** So kommt die Nachricht an: sieben Zeilen, keine offen, die
 * ganze Auskunft in Reichweite eines Tippens statt in sieben Blasen
 * untereinander.
 *
 * Die `play`-Funktion prüft drei Zusicherungen, nicht bloß das Rendern: die
 * Zeilenzahl stimmt, **keine** ist offen, und beide unabschaltbaren
 * Sicherheits-Bausteine sind dabei (ADR-018 §6).
 */
export const AllesZu: Story = {
	name: 'Alles zugeklappt',
	globals: phone390Globals,
	args: { bausteine: ROWS, primaryRowIds: PRIMARY_ROW_IDS, translate },
	play: async ({ canvasElement }) => {
		const toggles = within(canvasElement).getAllByRole('button');
		expect(toggles).toHaveLength(ROWS.length);
		expect(
			toggles.every(
				(toggle) => toggle.getAttribute('aria-expanded') === 'false'
			)
		).toBe(true);

		/* Zugeklappt heißt ausgehängt: kein einziger Antwort-Bereich im Baum. */
		expect(within(canvasElement).queryAllByRole('region')).toHaveLength(0);

		/* ADR-018 §6 — beide Sicherheitszeilen müssen vorkommen. */
		expect(row(canvasElement, 'noPersonalData')).toBeInTheDocument();
		expect(row(canvasElement, 'emergencyNumbers')).toBeInTheDocument();
	}
};

/**
 * **Erste Zeile offen.** `openFirst` ist **positionsbezogen** — es öffnet die
 * erste Zeile, nicht eine benannte. Der Zustand zeigt, dass die Zeilen
 * überhaupt zu öffnen sind, ohne dass man dafür klicken muss; das war der
 * Einwand gegen die vollständig zugeklappte Fassung.
 */
export const ErsteZeileOffen: Story = {
	name: 'Erste Zeile offen',
	globals: phone390Globals,
	args: {
		bausteine: ROWS,
		openFirst: true,
		primaryRowIds: PRIMARY_ROW_IDS,
		translate
	},
	play: async ({ canvasElement }) => {
		expect(isOpen(row(canvasElement, ROWS[0].id))).toBe(true);
		/* Genau eine, sonst wäre es keine Andeutung mehr, sondern die Liste. */
		expect(within(canvasElement).getAllByRole('region')).toHaveLength(1);
		expect(isOpen(row(canvasElement, ROWS[1].id))).toBe(false);
	}
};

/* --------------------------------------------------------------------------
   Die rote Notfallzeile
   -------------------------------------------------------------------------- */

/**
 * **Die rote Notfallzeile.** Frank, 07.09.2026 abends: *„Ich würde sie einfach
 * rot lassen. Und dann kann der Nutzer sie ja auch selbst ausklappen."*
 *
 * Sie bleibt also **zu** wie jede andere Zeile, und allein die Farbe macht sie
 * auffindbar. Es ist die Rolle `--m3-primary`, keine feste Farbe: ein Träger
 * mit anderer Primärfarbe bekommt seine eigene.
 *
 * **Genau eine Zeile** darf die Rolle tragen — ein rotes Akkordeon wäre keine
 * hervorgehobene Zeile mehr, sondern ein Warnkasten. Deshalb ist
 * `primaryRowIds` eine Liste von ids und kein Schalter an der Gruppe, und
 * deshalb zählt die `play`-Funktion nach.
 *
 * Die Funktion klappt die Zeile **auf und wieder zu**: diese Story ist zugleich
 * die Aufnahme des zugeklappten Zustands.
 */
export const RoteNotfallzeile: Story = {
	name: 'Die rote Notfallzeile',
	globals: phone390Globals,
	args: { bausteine: ROWS, primaryRowIds: PRIMARY_ROW_IDS, translate },
	play: async ({ canvasElement }) => {
		const emergency = row(canvasElement, 'emergencyNumbers');

		expect(emergency.getAttribute('data-tone')).toBe('primary');
		expect(
			canvasElement.querySelectorAll('[data-tone="primary"]')
		).toHaveLength(1);

		/* Farbe ist nie das einzige Signal (WCAG 1.4.1): die Frage steht da. */
		expect(emergency).toHaveTextContent(
			ERSTANTWORT_FAQ_QUESTIONS.emergencyNumbers.defaultQuestion
		);

		/* Und sie lässt sich öffnen — Franks halber Satz. */
		const toggle = within(emergency).getByRole('button');
		await userEvent.click(toggle);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		await userEvent.click(toggle);
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
	}
};

/**
 * **Dieselbe Zeile, aufgeklappt.** Was hinter ihr steht — die ausgelieferten
 * Notfallnummern, Wortlaut unverändert. `openRowIds` benennt die Zeile, statt
 * auf ihre Position zu zeigen; genau das braucht diese Aufnahme („öffne
 * *diese*", nicht „öffne die erste").
 */
export const RoteNotfallzeileOffen: Story = {
	name: 'Die rote Notfallzeile — aufgeklappt',
	globals: phone390Globals,
	args: {
		bausteine: ROWS,
		primaryRowIds: PRIMARY_ROW_IDS,
		openRowIds: PRIMARY_ROW_IDS,
		translate
	},
	play: async ({ canvasElement }) => {
		const emergency = row(canvasElement, 'emergencyNumbers');
		expect(isOpen(emergency)).toBe(true);
		/* `openRowIds` ist benannt, nicht positionsbezogen: die erste Zeile
		   bleibt zu, obwohl eine Zeile offen ist. */
		expect(isOpen(row(canvasElement, ROWS[0].id))).toBe(false);
		expect(within(emergency).getByRole('region')).toBeInTheDocument();
	}
};

/* --------------------------------------------------------------------------
   Umbruch
   -------------------------------------------------------------------------- */

/**
 * **Lange Frage mit Umbruch.** Deutsche Fragen sind lang und die Telefonspalte
 * ist schmal. Der Winkel muss stehen bleiben, während die Beschriftung zwei
 * Zeilen nimmt — er ist `flex-shrink: 0`, die Frage `min-width: 0`.
 *
 * Die lange Zeile ist zugleich der **Rückfall-Pfad**: ein Baustein, für den
 * `erstantwortFaqQuestions.ts` keine Frage kennt, wird mit seiner eigenen
 * Überschrift beschriftet. Das ist der Fall des Freien Hinweises, den ein
 * Träger selbst füllt — die Plattform kann seine Frage nicht kennen. Besser
 * eine schlichte Zeile als eine Zeile, die eine id trägt.
 *
 * Die `play`-Funktion misst den Umbruch, statt ihn zu behaupten: der Knopf ist
 * höher als eine Zeile, und der Winkel steht trotzdem noch rechts neben der
 * Frage statt darunter.
 */
export const LangeFrageMitUmbruch: Story = {
	name: 'Lange Frage — Umbruch auf dem Telefon',
	globals: phone390Globals,
	args: {
		bausteine: [
			{
				id: 'freeNoticeLong',
				headline:
					'Was passiert eigentlich mit meinen Angaben, wenn ich die Beratung mittendrin abbreche?',
				body: 'Ihre Angaben bleiben bei der Beratungsstelle, bis Sie die Löschung verlangen. Sie können das jederzeit tun, ohne einen Grund zu nennen.'
			}
		],
		translate
	},
	play: async ({ canvasElement }) => {
		const toggle = within(canvasElement).getByRole('button');
		const question = toggle.querySelector<HTMLElement>(
			'.erstantwortDisclosure__question'
		);
		const chevron = toggle.querySelector<HTMLElement>(
			'.erstantwortDisclosure__chevron'
		);
		expect(question).not.toBeNull();
		expect(chevron).not.toBeNull();

		/* Der Rückfall greift: die Zeile trägt die Überschrift des Bausteins. */
		expect(question).toHaveTextContent('mittendrin abbreche');

		/* Wirklich umgebrochen — zwei Zeilen sind höher als eine. */
		const questionBox = (question as HTMLElement).getBoundingClientRect();
		const lineHeight = parseFloat(
			getComputedStyle(question as HTMLElement).lineHeight
		);
		expect(questionBox.height).toBeGreaterThan(lineHeight * 1.5);

		/* Und der Winkel bleibt rechts daneben, nicht darunter. */
		const chevronBox = (chevron as HTMLElement).getBoundingClientRect();
		expect(chevronBox.left).toBeGreaterThanOrEqual(questionBox.right);
	}
};
