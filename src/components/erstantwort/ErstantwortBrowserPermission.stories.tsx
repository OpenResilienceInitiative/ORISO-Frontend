import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import { ErstantwortBrowserPermission } from './ErstantwortBrowserPermission';
import { ERSTANTWORT_BROWSER_BRANCH, flowText } from './erstantwortFlowCopy';
import { phone390Globals } from '../message/messageStoryShell';
import '../pseudonym/PseudonymCard.styles.scss';
import './ErstantwortSequence.styles.scss';

/**
 * **Die Browser-Erlaubnis-Zeile** — das Gegenstück zu
 * `Erstantwort/Organisms/NotifyChoice`: dort wird der Kanal *gewählt*, hier
 * wird er *eingerichtet*.
 *
 * Deshalb ein eigenes Molekül und kein zweiter Zustand im Auswahl-Molekül: die
 * Auswahl ist danach vorbei, und eine Karte, die ihre eigene Auswahl weiter
 * anzeigt, lädt zum Zurückwählen ein.
 *
 * Bis heute war die Zeile nur in `Templates/Erstantwort-Ablauf` eingebettet
 * (`0 - Docs/INVENTAR-bausteine-chat-2026-09-07.md`, §4.1, P2 — als
 * „sicherheitsrelevant" markiert, weil ein blockierter Browser sonst still
 * durchfällt).
 *
 * <h3>Warum ein Knopf im Slot und keine Baustein-Aktion</h3>
 *
 * `ERSTANTWORT_ACTION_KINDS` kennt fünf Werte, keiner davon ist
 * „Browser-Erlaubnis". Ein sechster wäre eine Wire-Format-Änderung an einem
 * Datensatz, der als KDG-§11-Transparenznachweis dient — für einen Vorgang,
 * der **rein im Browser** stattfindet und den Server nie erreicht.
 */
const meta = {
	title: 'Erstantwort/Molecules/BrowserPermission',
	component: ErstantwortBrowserPermission,
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
	],
	args: { state: 'available', onAllow: fn() }
} satisfies Meta<typeof ErstantwortBrowserPermission>;

export default meta;
type Story = StoryObj<typeof meta>;

const line = (canvasElement: HTMLElement) =>
	within(canvasElement).queryByTestId('erstantwort-browser-permission');

/**
 * **`available` — der Knopf.** `Notification.permission === 'default'`: wir
 * dürfen fragen, und wir fragen **nur** nach diesem ausdrücklichen Tippen.
 *
 * Kein Symbol im Knopf: die Beschriftung bricht auf 390 px auf zwei Zeilen um,
 * und eine Glocke links davon stünde dann neben einem zweizeiligen, mittig
 * gesetzten Text statt vor ihm. Die Glocke hat ihren Platz eine Nachricht
 * früher, im Auswahlfeld — dort führt sie eine Zeile an.
 */
export const Verfuegbar: Story = {
	name: 'available — der Knopf',
	globals: phone390Globals,
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole('button');

		expect(line(canvasElement)?.getAttribute('data-state')).toBe(
			'available'
		);
		expect(button).toHaveTextContent(
			flowText(ERSTANTWORT_BROWSER_BRANCH.action)
		);
		/* Die Regel, die `ErstantwortSequence` überall befolgt: kein Handler,
		   kein Knopf. Hier ist ein Handler da, also muss er auch feuern. */
		await button.click();
		expect(args.onAllow).toHaveBeenCalledTimes(1);
	}
};

/**
 * **`available` ohne Handler — kein Knopf.** Derselbe Zustand, aber ohne
 * `onAllow`. Ein aktiviert aussehender Knopf ohne Wirkung ist das eine, was
 * diese Kette nie tun darf; das Molekül lässt ihn deshalb weg statt ihn
 * auszugrauen.
 */
export const VerfuegbarOhneHandler: Story = {
	name: 'available ohne Handler — kein Knopf',
	globals: phone390Globals,
	args: { onAllow: undefined },
	play: async ({ canvasElement }) => {
		expect(within(canvasElement).queryAllByRole('button')).toHaveLength(0);
		expect(line(canvasElement)?.getAttribute('data-state')).toBe(
			'available'
		);
	}
};

/**
 * **`granted` — eine Bestätigung, kein zweiter Knopf.** Was folgt, steht hier;
 * was gilt, stand eine Nachricht früher im Auswahlfeld.
 */
export const Erteilt: Story = {
	name: 'granted — Bestätigung',
	globals: phone390Globals,
	args: { state: 'granted' },
	play: async ({ canvasElement }) => {
		const element = line(canvasElement);
		expect(element?.getAttribute('data-state')).toBe('granted');
		expect(element).toHaveTextContent('Erledigt');
		expect(within(canvasElement).queryAllByRole('button')).toHaveLength(0);
	}
};

/**
 * **`blocked` — niemals ein Knopf.** `requestPermission()` löst auf einer
 * blockierten Herkunft sofort mit `denied` auf und zeigt gar keinen Dialog;
 * der ausgelieferte `requestPermissions()` ruft ihn dann nicht einmal auf.
 *
 * Der Satz nennt den Ort („das Symbol links neben der Adresse"), ohne einen
 * Screenshot je Browser zu versprechen — es gibt keine Web-API, die die
 * Berechtigungsseite eines Browsers öffnet.
 *
 * Die Farbe ist die **Text**-Rolle `--m3-error`, kein gefüllter Fehlerkasten.
 */
export const Blockiert: Story = {
	name: 'blocked — Satz statt Knopf',
	globals: phone390Globals,
	args: { state: 'blocked' },
	play: async ({ canvasElement }) => {
		const element = line(canvasElement);
		expect(element?.getAttribute('data-state')).toBe('blocked');
		/* Die eine Regel dieser Story. */
		expect(within(canvasElement).queryAllByRole('button')).toHaveLength(0);
		expect(element).toHaveTextContent('abgelehnt');
		expect(element).toHaveTextContent('links neben der Adresse');
	}
};

/**
 * **`unsupported` — nichts.** Diese Nachricht dürfte in dem Fall gar nicht
 * entstehen: die Option wurde in der Auswahl davor nicht angeboten. Das
 * Molekül rendert deshalb `null`, statt eine Unmöglichkeit zu erklären.
 *
 * Der gestrichelte Rahmen gehört zur Story, nicht zum Produkt.
 */
export const NichtUnterstuetzt: Story = {
	name: 'unsupported — rendert nichts',
	globals: phone390Globals,
	args: { state: 'unsupported' },
	render: (args) => (
		<div
			data-testid="erstantwort-permission-absent"
			style={{
				border: '1px dashed var(--m3-outline, #74777a)',
				borderRadius: '12px',
				padding: '16px',
				color: 'var(--m3-on-surface, #1a1c1e)',
				fontSize: '13px',
				lineHeight: 1.5
			}}
		>
			<ErstantwortBrowserPermission {...args} />
			Hier stünde die Erlaubnis-Zeile. Ohne Notification-API im Browser
			wurde die Option schon in der Auswahl nicht angeboten — diese
			Nachricht entsteht dann gar nicht.
		</div>
	),
	play: async ({ canvasElement }) => {
		expect(line(canvasElement)).toBeNull();
		expect(
			within(canvasElement).getByTestId('erstantwort-permission-absent')
		).toBeInTheDocument();
	}
};
