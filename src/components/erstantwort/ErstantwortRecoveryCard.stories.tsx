import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { ErstantwortRecoveryCard } from './ErstantwortRecoveryCard';
import { ERSTANTWORT_RECOVERY_STEPS } from './erstantwortRecoveryCopy';
import { phone390Globals } from '../message/messageStoryShell';
import '../pseudonym/PseudonymCard.styles.scss';
import './ErstantwortSequence.styles.scss';

/**
 * **Die Ersatzschlüssel-Karte** — der Teil von Modul 3, der **in** der
 * Carimat-Blase sitzt, neben deren eigenem Text (derselbe `slots`-Mechanismus,
 * den `SaveCredentialsCard` schon benutzt).
 *
 * Sie ist die eine Stelle, die entscheidet, was jeder Zustand inline zeigt —
 * genau die Entscheidung, die die spätere Verdrahtung treffen muss. Bis heute
 * war sie nur in `Templates/Erstantwort-Module` und `-Ablauf` eingebettet
 * (`0 - Docs/INVENTAR-bausteine-chat-2026-09-07.md`, §4.1, P2).
 *
 * | Zustand | was inline steht | warum |
 * | --- | --- | --- |
 * | `notSecured` | der Rundgang | der einzige Zustand, der überhaupt etwas verlangt |
 * | `secured` | ein stiller Abschlussstreifen | der geparkte Schlüssel wurde beim Bestätigen gelöscht und lag nie auf dem Server — Anweisungen wären Anweisungen für eine erledigte, nicht wiederholbare Sache |
 * | `unsupported` | **nichts** | es gibt auf diesem Client keinen Schlüssel, und ein leerer Blätterer wären fünf Schritte zu einem Ding, das nicht existiert |
 *
 * Die Karte hält **keinen Matrix-Zustand**: welcher Zustand gilt, liest der
 * Aufrufer.
 */
const meta = {
	title: 'Erstantwort/Molecules/RecoveryCard',
	component: ErstantwortRecoveryCard,
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
	args: { state: 'notSecured', steps: ERSTANTWORT_RECOVERY_STEPS }
} satisfies Meta<typeof ErstantwortRecoveryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * **`notSecured` — der Rundgang.** Der Zustand, in dem etwas zu tun ist: der
 * Blätterer steht in der Karte, mit reserviertem Bildplatz und Fortschritt.
 */
export const NochNichtGesichert: Story = {
	name: 'notSecured — der Rundgang',
	globals: phone390Globals,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const card = canvas.getByTestId('erstantwort-recovery-card');

		expect(card.getAttribute('data-state')).toBe('notSecured');
		/* Die Karte reicht wirklich an den Blätterer durch — das ist ihre
		   einzige Aufgabe in diesem Zustand. */
		expect(
			canvas.getByTestId('erstantwort-recovery-steps')
		).toBeInTheDocument();
		expect(
			canvas.getByTestId('erstantwort-recovery-progress')
		).toHaveTextContent(`von ${ERSTANTWORT_RECOVERY_STEPS.length}`);
	}
};

/**
 * **`secured` — der stille Abschluss.** Kein Blätterer, kein Knopf: eine Zeile
 * mit Haken und die gefüllte Punktreihe, damit die Folge sichtbar **schließt**,
 * statt einfach zu verschwinden.
 *
 * Die Punktreihe ist hier dekorativ (`aria-hidden`) — die Zeile daneben sagt
 * dasselbe in Worten, und zweimal dieselbe Auskunft vorzulesen macht sie nicht
 * klarer.
 */
export const Gesichert: Story = {
	name: 'secured — Abschlussstreifen ohne Anweisungen',
	globals: phone390Globals,
	args: { state: 'secured' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const card = canvas.getByTestId('erstantwort-recovery-card');

		expect(card.getAttribute('data-state')).toBe('secured');
		expect(card).toHaveTextContent('Alle Schritte erledigt');

		/* Erledigt heißt: nichts mehr zu bedienen. Kein Blätterer, kein Knopf. */
		expect(canvas.queryByTestId('erstantwort-recovery-steps')).toBeNull();
		expect(canvas.queryAllByRole('button')).toHaveLength(0);
	}
};

/**
 * **`unsupported` — nichts.** Dieser Browser kann keine Verschlüsselung, also
 * gibt es keinen Ersatzschlüssel und nichts zu erklären. Die Karte rendert
 * `null`, und das ist das **richtige** Ergebnis, keine kaputte Story.
 *
 * Der gestrichelte Rahmen gehört zur Story, nicht zum Produkt: ohne ihn wäre
 * die korrekte Abwesenheit von einem leeren Bild nicht zu unterscheiden.
 */
export const NichtUnterstuetzt: Story = {
	name: 'unsupported — die Karte rendert nichts',
	globals: phone390Globals,
	args: { state: 'unsupported' },
	render: (args) => (
		<div
			data-testid="erstantwort-recovery-absent"
			style={{
				border: '1px dashed var(--m3-outline, #74777a)',
				borderRadius: '12px',
				padding: '16px',
				color: 'var(--m3-on-surface, #1a1c1e)',
				fontSize: '13px',
				lineHeight: 1.5
			}}
		>
			<ErstantwortRecoveryCard {...args} />
			Hier stünde die Karte. Ohne Verschlüsselung gibt es keinen
			Ersatzschlüssel — im Produkt steht an dieser Stelle nichts, auch
			kein Abstand.
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.queryByTestId('erstantwort-recovery-card')).toBeNull();
		expect(canvas.queryByTestId('erstantwort-recovery-steps')).toBeNull();
		expect(
			canvas.getByTestId('erstantwort-recovery-absent')
		).toBeInTheDocument();
	}
};
