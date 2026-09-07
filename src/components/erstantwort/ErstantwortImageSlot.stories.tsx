import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import {
	ErstantwortImageSlot,
	ERSTANTWORT_IMAGE_SLOT_SIZE
} from './ErstantwortImageSlot';
import { ERSTANTWORT_IMAGE_BRIEF } from './erstantwortFlowCopy';
import { phone390Globals } from '../message/messageStoryShell';
import '../pseudonym/PseudonymCard.styles.scss';
import './ErstantwortSequence.styles.scss';

/**
 * **Der reservierte Bildplatz der Erfolgsnachricht** — quadratisch, gedeckelt,
 * leer.
 *
 * Bis heute hatte er **keine Story und wurde nirgends direkt gerendert**, nur
 * transitiv über `ErstantwortSuccessMessage`
 * (`0 - Docs/INVENTAR-bausteine-chat-2026-09-07.md`, §3.1). Der Übergabetext
 * warnt ausdrücklich, sein `object-fit: contain` beim Aufräumen zu retten —
 * eine Story zeigt den Verlust sofort.
 *
 * <h3>Warum quadratisch, und warum reserviert statt gezeichnet</h3>
 *
 * Frank, 07.09.2026 abends: er passt seine Illustration auf **maximal
 * quadratisch** an, das Layout hält deshalb 1:1 frei. Das falsche
 * Seitenverhältnis zu reservieren ist der eine Fehler, den man später nicht
 * durch Austauschen der Datei behebt: ein 16:9-Platz mit quadratischer
 * Zeichnung schneidet sie ab oder lässt zwei leere Spalten — und beides wird
 * **hier** entschieden, Monate bevor die Grafik existiert.
 *
 * Es ist **nichts gezeichnet**. Der Platz ist gestrichelt und beschriftet, wie
 * der Schritt-Platzhalter in Modul 3, und aus demselben Grund: ein
 * Platzhalter, der wie Kunst aussieht, wird für die Entscheidung gehalten. Die
 * Bildunterschrift ist der Auftrag — so reist der Auftrag mit dem Layout statt
 * in einem Dokument, das niemand öffnet.
 *
 * <h3>Warum gedeckelt und nicht blasenfüllend</h3>
 *
 * Ein Quadrat in voller Blasenbreite misst ~290 px auf einem 390-px-Telefon und
 * **528 px** auf dem Desktop, wo `.pseudonymCard__bubble` kappt. 528 px im Chat
 * sind ein Plakat, kein Bild in einer Sprechblase — und würden die Fragen auf
 * jedem Desktop unter die Falz drücken. Der Deckel ist deshalb eine echte
 * Gestaltungsvorgabe, kein Rendering-Detail: darum eine benannte Prop mit
 * dokumentiertem Standard statt einer festen Zahl.
 */
const meta = {
	title: 'Erstantwort/Atoms/ImageSlot',
	component: ErstantwortImageSlot,
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
	args: { brief: ERSTANTWORT_IMAGE_BRIEF }
} satisfies Meta<typeof ErstantwortImageSlot>;

export default meta;
type Story = StoryObj<typeof meta>;

const slot = (canvasElement: HTMLElement, testId = 'erstantwort-image-slot') =>
	within(canvasElement).getByTestId(testId);

/**
 * **Der Standardplatz auf dem Telefon.** 260 px Kantenlänge, 1:1, mit dem
 * Bild-Auftrag als Bildunterschrift.
 *
 * Die `play`-Funktion misst das Seitenverhältnis, statt es zu behaupten — das
 * ist die eine Zusicherung, die dieser Baustein gibt, und die einzige, die man
 * beim Aufräumen versehentlich verliert.
 */
export const Standard: Story = {
	name: 'Standard 260 px — quadratisch',
	globals: phone390Globals,
	play: async ({ canvasElement }) => {
		const element = slot(canvasElement);
		const box = element.getBoundingClientRect();

		/* Quadratisch, auf ein Pixel Rundung genau. */
		expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
		/* Und wirklich gedeckelt, nicht blasenbreit. */
		expect(box.width).toBeLessThanOrEqual(ERSTANTWORT_IMAGE_SLOT_SIZE);
		/* Der Auftrag reist mit dem Layout. */
		expect(element).toHaveTextContent('Platz für Grafik');
		expect(element).toHaveTextContent('Umschlag');
	}
};

/**
 * **Ein anderer Deckel.** `size` ist die Kantenlänge; die Höhe folgt der
 * Breite, weil die Fläche quadratisch **ist** und nicht nur so aussieht. Wer
 * den Platz ändert, ändert genau diese eine Zahl.
 */
export const KleinererDeckel: Story = {
	name: 'size — die Höhe folgt der Breite',
	globals: phone390Globals,
	args: { size: 160, testId: 'erstantwort-image-slot-small' },
	play: async ({ canvasElement }) => {
		const box = slot(
			canvasElement,
			'erstantwort-image-slot-small'
		).getBoundingClientRect();

		expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
		expect(box.width).toBeLessThanOrEqual(160);
		expect(box.width).toBeGreaterThan(140);
	}
};

/**
 * **Der Platz ist für Screenreader unsichtbar.** `aria-hidden`: die
 * Bildunterschrift ist ein Auftrag an die Zeichnerin, keine Auskunft für die
 * lesende Person. „Platz für Grafik — ein Umschlag erreicht ein offenes
 * Fenster" jemandem vorzulesen, der gerade über etwas Schweres geschrieben
 * hat, ist Lärm.
 *
 * Wenn die echte Grafik kommt, bringt sie ihren eigenen Alternativtext mit
 * (oder bleibt dekorativ) — diese Entscheidung gehört dann der Grafik.
 */
export const FuerScreenreaderUnsichtbar: Story = {
	name: 'aria-hidden — der Auftrag wird nicht vorgelesen',
	globals: phone390Globals,
	play: async ({ canvasElement }) => {
		const element = slot(canvasElement);

		expect(element.getAttribute('aria-hidden')).toBe('true');
		/* Und nichts darin ist mit Tab erreichbar — ein fokussierbares Element
		   in einem `aria-hidden`-Baum wäre ein echter Fehler (axe:
		   `aria-hidden-focus`), kein Schönheitsfehler. */
		expect(
			element.querySelectorAll(
				'a[href], button, input, select, textarea, [tabindex]'
			)
		).toHaveLength(0);
	}
};
