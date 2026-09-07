import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { ErstantwortDisclosure } from './ErstantwortDisclosure';
import { phone390Globals } from '../message/messageStoryShell';
import '../pseudonym/PseudonymCard.styles.scss';
import './ErstantwortSequence.styles.scss';

/**
 * **Erstantwort-Disclosure** — one collapsible question row, the atom the FAQ
 * layout proposal is built from
 * (`0 - Docs/VORSCHLAG-erstantwort-faq-layout-2026-09-07.md`).
 *
 * Built rather than reused, and the reason is worth checking before anybody
 * "simplifies" it away: the two disclosures this repository already has
 * (`WhyLocalDisclosure`, `DepartmentLegalSection`) are MUI components drawing
 * their colours from the registration theme, and the chat surface imports no
 * MUI at all. Four rows in a chat bubble are not worth that dependency.
 *
 * What to check here:
 *
 * - The closed panel is **unmounted**, not hidden — nothing collapsed is read
 *   out by a screen reader or reachable with Tab.
 * - `aria-expanded` and `aria-controls` sit on a native `<button>`, so Enter
 *   and Space work without a key handler.
 * - The focus ring is the platform's own (ORISO-Frontend#113), not the browser
 *   default, which is nearly invisible on the bubble's grey.
 */
const meta = {
	title: 'Erstantwort/Molecules/Disclosure',
	component: ErstantwortDisclosure,
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
} satisfies Meta<typeof ErstantwortDisclosure>;

export default meta;
type Story = StoryObj<typeof meta>;

const ANSWER =
	'Ihre Nachricht lesen ausschließlich die Fachkräfte der zuständigen Beratungsstelle. Alle sind zur Verschwiegenheit verpflichtet.';

/**
 * Farbvergleich ohne Formatstreit: `getComputedStyle().color` liefert
 * `rgb(165, 0, 10)`, die M3-Token stehen als Kleinbuchstaben-Hex
 * (`orisoScheme.ts` normalisiert mit `hexFromArgb(...).toLowerCase()`). Beide
 * Seiten werden deshalb auf `r,g,b` gebracht, bevor sie verglichen werden —
 * sonst prüft die Assertion die Schreibweise statt der Farbe.
 */
const toRgb = (value: string): string => {
	const hex = value.trim().match(/^#([\da-f]{6})$/i);
	if (hex) {
		const n = parseInt(hex[1], 16);
		return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
	}
	const rgb = value.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
	return rgb ? `${rgb[1]},${rgb[2]},${rgb[3]}` : value.trim();
};

/** The resting state: a question, a chevron, nothing else. */
export const Closed: Story = {
	args: {
		question: 'Wer liest meine Nachricht?',
		children: <p>{ANSWER}</p>
	}
};

/** Opened. The body is the frozen Baustein wording, unchanged (ADR-018 §4). */
export const Open: Story = {
	args: { ...Closed.args, defaultOpen: true }
};

/**
 * A row whose question wraps. German questions are long and the phone column
 * is narrow, so the chevron has to stay put while the label takes two lines.
 */
export const LongQuestionOnPhone: Story = {
	args: {
		question:
			'Was passiert mit meinen Daten, wenn ich die Beratung abbreche?',
		children: <p>{ANSWER}</p>
	},
	globals: phone390Globals
};

/**
 * **Die Primärrolle — die eine Zeile, die man ohne Lesen findet.**
 *
 * Frank, 07.09.2026 abends, zur Notfallnummern-Zeile: *„Ich würde sie einfach
 * rot lassen. Und dann kann der Nutzer sie ja auch selbst ausklappen."* Die
 * Zeile bleibt also **zu** wie jede andere, und allein die Farbe sagt, dass sie
 * die besondere ist.
 *
 * Es ist die Rolle `--m3-primary`, **keine feste Farbe**: ein Träger mit
 * anderer Primärfarbe bekommt seine eigene, statt eines fremden Rots mitten im
 * eigenen Schema. Gegen den Blasengrund (`#eeeeee`) liegt der ausgelieferte
 * Wert `#a5000a` bei 6,95:1 — WCAG 2.2 AA verlangt 4,5:1 für Fließtext.
 *
 * Farbe ist nie das **einzige** Signal (WCAG 1.4.1): die Zeile trägt weiter
 * ihre Frage im Klartext.
 *
 * Die `play`-Funktion prüft genau das, was die Story behauptet — nicht dass sie
 * rendert: `data-tone` steht auf `primary`, die Zeile ist **zu**, und der
 * Farbwert des Knopfes ist der der Primärrolle und **nicht** der Textrolle der
 * Standardzeile. Ein `--m3-primary`, das nie durchschlägt, wäre sonst eine
 * grüne Story mit grauer Zeile.
 */
export const PrimaryToneClosed: Story = {
	globals: phone390Globals,
	args: {
		question: 'Was, wenn es nicht warten kann?',
		children: <p>{ANSWER}</p>,
		tone: 'primary',
		testId: 'erstantwort-disclosure-primary'
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const row = canvas.getByTestId('erstantwort-disclosure-primary');

		expect(row.getAttribute('data-tone')).toBe('primary');
		expect(
			within(row).getByRole('button').getAttribute('aria-expanded')
		).toBe('false');

		/* Die Farbe ist die Zusicherung dieser Story, also wird sie gemessen.
		   Verglichen wird gegen die Standardzeile im selben Canvas ist hier
		   nicht möglich (eine Story = eine Zeile), deshalb gegen die Rolle
		   selbst: der Knopf muss den Wert von `--m3-primary` tragen, und der
		   darf nicht der Wert von `--m3-on-surface` sein. */
		const toggle = within(row).getByRole('button');
		const root = document.documentElement;
		const primary =
			getComputedStyle(root).getPropertyValue('--m3-primary').trim() ||
			'#a5000a';
		const onSurface =
			getComputedStyle(root).getPropertyValue('--m3-on-surface').trim() ||
			'#1a1c1e';

		expect(primary).not.toBe(onSurface);
		expect(toRgb(getComputedStyle(toggle).color)).toBe(toRgb(primary));
	}
};

/**
 * **Dieselbe rote Zeile, aufgeklappt.** Franks halber Satz — „dann kann der
 * Nutzer sie ja auch selbst ausklappen" — als eigener Zustand, damit der
 * geöffnete Notfall-Text einen Zeugen hat, der nicht die ganze Modul-1-Bühne
 * ist.
 */
export const PrimaryToneOpen: Story = {
	globals: phone390Globals,
	args: {
		...PrimaryToneClosed.args,
		defaultOpen: true
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const row = canvas.getByTestId('erstantwort-disclosure-primary');

		expect(
			within(row).getByRole('button').getAttribute('aria-expanded')
		).toBe('true');
		/* Offen heißt: der Text ist wirklich im Baum, nicht nur sichtbar
		   gemacht — die zugeklappte Fassung hängt ihn aus (`isOpen &&`). */
		expect(within(row).getByRole('region')).toHaveTextContent(
			ANSWER.slice(0, 40)
		);
	}
};
