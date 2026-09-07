import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { ErstantwortRecoverySteps } from './ErstantwortRecoverySteps';
import { ERSTANTWORT_RECOVERY_STEPS } from './erstantwortRecoveryCopy';
import { phone390Globals } from '../message/messageStoryShell';
import '../pseudonym/PseudonymCard.styles.scss';
import './ErstantwortSequence.styles.scss';

/**
 * **Der Ersatzschlüssel-Rundgang — Modul 3, ausgepackt.**
 *
 * 375 Zeilen und bis heute **von keiner Story direkt gerendert**: sichtbar war
 * er nur transitiv über `ErstantwortRecoveryCard` und nur in der Modul-3-Bühne
 * (`0 - Docs/INVENTAR-bausteine-chat-2026-09-07.md`, §4.1, P1 — „größte neue
 * Datei ohne jeden eigenen Zeugen").
 *
 * <h3>Warum ein Blätterer und keine Liste</h3>
 *
 * Die fünf Schritte sind kurz, aber sie sind **Anweisungen**, und fünf
 * Anweisungen als Aufzählung in einer Carimat-Blase lesen sich wie ein weiterer
 * Absatz zum Wegscrollen — genau der Fehler, den die zehnblasige Erstantwort
 * schon hat. Ein Schritt auf einmal zwingt das Auge auf den Satz, der jetzt
 * gilt, und lässt Platz für die Grafik, die später dazukommt.
 *
 * <h3>Was er nicht tut</h3>
 *
 * Er zeichnet **keine Grafik**. Jeder Schritt reserviert einen benannten,
 * gestrichelten Platz mit dem Bild-Auftrag als Bildunterschrift. Und er hält
 * **keinen Krypto-Zustand**: ob der Schlüssel schon gesichert ist, entscheidet
 * der Aufrufer (`ErstantwortRecoveryCard`) — das hier ist ein reiner Blätterer.
 *
 * <h3>Tastatur</h3>
 *
 * Der Blätterer selbst ist das Fokusziel (`tabIndex={0}`): Pfeil links/rechts
 * blättern, Pos1/Ende springen an die Enden. Die beiden Pfeilknöpfe sind echte
 * Knöpfe und bleiben mit Tab erreichbar — ein Bedienelement, das nur auf
 * Pfeiltasten reagiert, ist für jeden unsichtbar, der nicht schon weiß, dass es
 * da ist. Die letzte Story prüft das als `play`-Test.
 */
const meta = {
	title: 'Erstantwort/Organisms/RecoverySteps',
	component: ErstantwortRecoverySteps,
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
	args: { steps: ERSTANTWORT_RECOVERY_STEPS }
} satisfies Meta<typeof ErstantwortRecoverySteps>;

export default meta;
type Story = StoryObj<typeof meta>;

const LAST_STEP = ERSTANTWORT_RECOVERY_STEPS.length;

/** The pager root, which carries the current step as a data attribute. */
const pager = (canvasElement: HTMLElement) =>
	within(canvasElement).getByTestId('erstantwort-recovery-steps');

/* --------------------------------------------------------------------------
   Die drei Positionen
   -------------------------------------------------------------------------- */

/**
 * **Schritt 1 — der Anfang.** Der Zurück-Pfeil ist **deaktiviert, nicht
 * versteckt**: die Person behält einen stabilen Rahmen zum Zielen, und der
 * graue Pfeil sagt „das hier ist der erste Schritt" (ORISO-Hausregel
 * „disable statt hide").
 *
 * Der Bildplatz ist gestrichelt und beschriftet — er muss als „hier kommt eine
 * Zeichnung hin" lesbar sein, nie als die Zeichnung.
 */
export const Schritt1: Story = {
	name: 'Schritt 1 — Zurück ist deaktiviert',
	globals: phone390Globals,
	play: async ({ canvasElement }) => {
		const root = pager(canvasElement);
		const canvas = within(root);

		expect(root.getAttribute('data-current-step')).toBe('1');
		expect(canvas.getByTestId('erstantwort-recovery-prev')).toBeDisabled();
		expect(
			canvas.getByTestId('erstantwort-recovery-next')
		).not.toBeDisabled();
		expect(
			canvas.getByTestId('erstantwort-recovery-progress')
		).toHaveTextContent(`Schritt 1 von ${LAST_STEP}`);
		/* Der Bildplatz trägt die id seines Schritts — so belegt der Screenshot,
		   dass Text und reservierte Fläche zusammengehören. */
		expect(
			canvas
				.getByTestId('erstantwort-recovery-illustration-slot')
				.getAttribute('data-step-id')
		).toBe(ERSTANTWORT_RECOVERY_STEPS[0].id);
	}
};

/**
 * **Ein mittlerer Schritt.** Beide Pfeile aktiv, die Punktreihe zeigt die
 * Position. Die Punkte sind **anklickbar**: ein Punkt, der die Position zeigt,
 * aber nicht zum Springen taugt, ist eine Dekoration, die wie ein
 * Bedienelement aussieht.
 */
export const MittlererSchritt: Story = {
	name: 'Mittlerer Schritt — beide Pfeile aktiv',
	globals: phone390Globals,
	args: { initialStep: 3 },
	play: async ({ canvasElement }) => {
		const root = pager(canvasElement);
		const canvas = within(root);

		expect(root.getAttribute('data-current-step')).toBe('3');
		expect(
			canvas.getByTestId('erstantwort-recovery-prev')
		).not.toBeDisabled();
		expect(
			canvas.getByTestId('erstantwort-recovery-next')
		).not.toBeDisabled();

		/* Genau ein Punkt ist der aktuelle — sonst zeigt die Reihe zwei Orte an. */
		expect(root.querySelectorAll('[aria-current="step"]').length).toBe(1);
		expect(
			canvas
				.getByTestId('erstantwort-recovery-dot-3')
				.getAttribute('aria-current')
		).toBe('step');
	}
};

/**
 * **Der letzte Schritt.** Jetzt ist der Vorwärts-Pfeil deaktiviert, aus
 * demselben Grund wie der Zurück-Pfeil auf Schritt 1: die Reihe endet
 * sichtbar, statt ins Leere zu klicken.
 */
export const LetzterSchritt: Story = {
	name: 'Letzter Schritt — Weiter ist deaktiviert',
	globals: phone390Globals,
	args: { initialStep: LAST_STEP },
	play: async ({ canvasElement }) => {
		const root = pager(canvasElement);
		const canvas = within(root);

		expect(root.getAttribute('data-current-step')).toBe(String(LAST_STEP));
		expect(canvas.getByTestId('erstantwort-recovery-next')).toBeDisabled();
		expect(
			canvas.getByTestId('erstantwort-recovery-prev')
		).not.toBeDisabled();
		expect(
			canvas.getByTestId('erstantwort-recovery-progress')
		).toHaveTextContent(`Schritt ${LAST_STEP} von ${LAST_STEP}`);
	}
};

/* --------------------------------------------------------------------------
   Tastatur
   -------------------------------------------------------------------------- */

/**
 * **Tastaturbedienung.** Der Zustand, den ein Screenshot nicht zeigen kann und
 * den vorher nur die 910-Zeilen-Bühne indirekt geprüft hat.
 *
 * Geprüft wird die ganze Abmachung des Blätterers:
 *
 * - Der Blätterer nimmt Fokus (`tabIndex={0}`) — sonst kämen die Pfeiltasten
 *   nie bei ihm an.
 * - **Pfeil rechts / links** blättern um einen Schritt.
 * - **Ende / Pos1** springen an die Enden.
 * - An den Enden passiert **nichts** statt eines Fehlers: `clamp` hält die
 *   Zahl im Bereich.
 *
 * Die Story endet bewusst wieder auf Schritt 1, damit ihre Aufnahme denselben
 * Zustand zeigt wie ihr Name — eine `play`-Funktion, die den Blätterer offen
 * stehen lässt, macht aus dem Screenshot still eine andere Story.
 */
export const Tastaturbedienung: Story = {
	name: 'Tastaturbedienung — Pfeile, Pos1 und Ende',
	globals: phone390Globals,
	play: async ({ canvasElement }) => {
		const root = pager(canvasElement);

		root.focus();
		expect(root).toHaveFocus();

		await userEvent.keyboard('{ArrowRight}');
		expect(root.getAttribute('data-current-step')).toBe('2');

		await userEvent.keyboard('{ArrowRight}');
		expect(root.getAttribute('data-current-step')).toBe('3');

		await userEvent.keyboard('{ArrowLeft}');
		expect(root.getAttribute('data-current-step')).toBe('2');

		await userEvent.keyboard('{End}');
		expect(root.getAttribute('data-current-step')).toBe(String(LAST_STEP));

		/* Am Ende weiterdrücken darf nichts tun — nicht überlaufen, nicht
		   umbrechen, nicht werfen. */
		await userEvent.keyboard('{ArrowRight}');
		expect(root.getAttribute('data-current-step')).toBe(String(LAST_STEP));

		await userEvent.keyboard('{Home}');
		expect(root.getAttribute('data-current-step')).toBe('1');

		await userEvent.keyboard('{ArrowLeft}');
		expect(root.getAttribute('data-current-step')).toBe('1');
	}
};
