import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { ErstantwortSequence } from './ErstantwortSequence';
import { ErstantwortRecoveryCard } from './ErstantwortRecoveryCard';
import {
	ERSTANTWORT_RECOVERY_STEPS,
	erstantwortRecoveryBaustein,
	type ErstantwortRecoveryState
} from './erstantwortRecoveryCopy';
import { ERSTANTWORT_SUBTITLES, flowText } from './erstantwortFlowCopy';
import './ErstantwortSequence.styles.scss';

/**
 * # Modul 3 — Ersatzschlüssel
 *
 * **Vorschlag, nichts ist entschieden.** Begleitpapier mit den Schritten,
 * den Codebelegen und der Verdrahtungs-Analyse:
 * `0 - Docs/VERDRAHTUNG-modul3-ersatzschluessel-2026-09-07.md`.
 *
 * ## Was der Code heute wirklich tut
 *
 * Der Ersatzschlüssel wird **nicht** von der Person erstellt. Beim ersten
 * Anmelden prüft `KeyBackupRecoveryPrompt` den Krypto-Zustand, sobald der
 * Matrix-Sync `PREPARED` meldet; findet es eine frische Identität
 * (`canBootstrapSilently`), erzeugt `setUpRecovery` den Schlüssel im
 * Hintergrund. Er landet in `localStorage` dieses Geräts
 * (`oriso.pendingRecoveryKey.<userId>`) und wird nirgendwo hochgeladen.
 * Ansehen kann man ihn nur unter **Profil → Einstellungen → Sicherheit**.
 * Setzt man dort den Bestätigungshaken, wird die geparkte Kopie gelöscht —
 * danach kann die App ihn **nie wieder** anzeigen.
 *
 * Auf einem zweiten Gerät (jede neue Anmeldung ist ein neues Matrix-Gerät)
 * meldet `getEncryptionStatus` `keyStorageOutOfSync: true`, der
 * Wiederherstellungs-Dialog geht auf und fragt genau nach diesem Schlüssel.
 *
 * Dieses Modul schließt die eine Lücke, die ADR-019 offen gelassen hat:
 * *„wer nie ins Sicherheit-Panel geht, sieht seinen Schlüssel nie."*
 *
 * ## Was hier gebaut ist
 *
 * Eine eigenständige Carimat-Nachricht mit kurzem Erklärtext, darunter ein
 * kompakter Stepper: fünf Schritte, Punkte, Vor- und Zurück-Pfeil,
 * Pfeiltasten links/rechts (plus Pos1/Ende), `aria-live` beim Schrittwechsel
 * und eine Fortschrittsanzeige. Pro Schritt eine Zeile Text und ein
 * **benannter, leerer Platz** für die spätere Grafik — mit dem Bild-Auftrag
 * als Bildunterschrift. Es ist bewusst **keine Grafik erfunden**.
 *
 * ## Nicht verdrahtet
 *
 * Nichts hier liest Matrix-Zustand. Welcher Zustand gilt, ist eine
 * Verdrahtungsfrage (`getEncryptionStatus` + `getPendingRecoveryKey`) und
 * steht im Begleitpapier, Teil B.
 */
const meta = {
	title: 'Templates/Erstantwort-Module',
	component: ErstantwortSequence,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	args: { skipAnimation: true }
} satisfies Meta<typeof ErstantwortSequence>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Only the layout is under review here, so the button reports and stops. */
const noop = () => undefined;

/**
 * **Die Unterzeile ist ein Handlungsaufruf und hängt am Zustand.**
 *
 * Franks Ansage vom 07.09.2026 — und Modul 3 ist der Fall, der zeigt, warum die
 * Zeile ein eigenes Feld je Nachricht sein muss und nicht ein globaler Satz:
 * dieselbe Nachricht verlangt in drei Zuständen drei verschiedene Dinge, und in
 * zweien davon gar nichts.
 *
 * | Zustand | Unterzeile |
 * | --- | --- |
 * | `notSecured` | Sichern Sie Ihren Ersatzschlüssel |
 * | `secured` | Erledigt, nichts weiter zu tun |
 * | `unsupported` | Nur zur Information |
 *
 * „Sichern Sie Ihren Ersatzschlüssel" ist der **Vorschlag für Modul 3**, um den
 * Frank gebeten hat: er nennt die Handlung und das Ding beim vereinbarten Namen
 * (Vokabel-Entscheidung 14.08.2026) — nicht „Ihre Sicherheit" und nicht
 * „Wichtiger Hinweis", die beide nicht sagen, was jetzt dran ist.
 */
const subtitleFor = (state: ErstantwortRecoveryState): string => {
	switch (state) {
		case 'secured':
			return flowText(ERSTANTWORT_SUBTITLES.recoveryKeySecured);
		case 'unsupported':
			return flowText(ERSTANTWORT_SUBTITLES.recoveryKeyUnsupported);
		default:
			return flowText(ERSTANTWORT_SUBTITLES.recoveryKey);
	}
};

const modul3 = (
	state: ErstantwortRecoveryState,
	options: { initialStep?: number; illustrationHeight?: number } = {}
): Story['args'] => ({
	bausteine: [erstantwortRecoveryBaustein(state)],
	subtitle: subtitleFor(state),
	skipAnimation: true,
	// `ErstantwortSequence` renders no button without a handler, on purpose —
	// an enabled control that does nothing is worse than an absent one.
	onAction: noop,
	slots: {
		recoveryKey: (
			<ErstantwortRecoveryCard
				state={state}
				steps={ERSTANTWORT_RECOVERY_STEPS}
				initialStep={options.initialStep}
				illustrationHeight={options.illustrationHeight}
			/>
		)
	}
});

/* --------------------------------------------------------------------------
   Das Modul
   -------------------------------------------------------------------------- */

/**
 * **(m3) Modul 3 — Ersatzschlüssel.** Die eigenständige Carimat-Nachricht,
 * Zustand „noch nicht gesichert", Stepper auf Schritt 1.
 *
 * Der Erklärtext beruhigt zuerst und schränkt danach ein — dieselbe Reihenfolge
 * wie im ausgelieferten `deviceLimit`-Baustein, aus demselben Grund: die
 * Einschränkung allein liest sich als „gleich ist alles weg".
 *
 * Der Knopf „Ersatzschlüssel ansehen" ist der bereits existierende
 * `SHOW_RECOVERY_KEY`-Handler und führt nach
 * `/profile/einstellungen/sicherheit` — dort wartet der Schlüssel wirklich.
 */
export const M3ErsatzschluesselSchritt1: Story = {
	name: '(m3) Modul 3 — Ersatzschlüssel',
	args: modul3('notSecured', { initialStep: 1 })
};

/**
 * **(m3) Mittlerer Schritt.** Dasselbe Modul, der Stepper steht auf **Schritt 3
 * von 5** („Schlüssel kopieren").
 *
 * Die Story existiert, weil der erste Schritt der einzige ist, der nichts
 * verlangt („der Schlüssel ist schon fertig"). Ob die Schrittfolge trägt,
 * entscheidet sich in der Mitte, wo tatsächlich etwas zu tun ist.
 */
export const M3MittlererSchritt: Story = {
	name: '(m3) Mittlerer Schritt (3 von 5)',
	args: modul3('notSecured', { initialStep: 3 }),
	/**
	 * Die Tastaturbedienung ist die halbe Anforderung an dieses Modul, also
	 * wird sie hier auch geprüft und nicht nur behauptet: Fokus auf die
	 * Schrittfolge, Pfeil rechts, zweimal Pfeil links — und der angezeigte
	 * Schritt muss mitgehen. Läuft als Component Test in CI mit.
	 */
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const pager = canvas.getByTestId('erstantwort-recovery-steps');

		expect(pager).toHaveAttribute('data-current-step', '3');

		pager.focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(pager).toHaveAttribute('data-current-step', '4');

		await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
		expect(pager).toHaveAttribute('data-current-step', '2');
		expect(
			canvas.getByTestId('erstantwort-recovery-progress')
		).toHaveTextContent('Schritt 2 von 5');

		// Home/End exist because a five-step pager is short enough that
		// jumping to either end is faster than paging there.
		await userEvent.keyboard('{End}');
		expect(pager).toHaveAttribute('data-current-step', '5');
		expect(canvas.getByTestId('erstantwort-recovery-next')).toBeDisabled();
	}
};

/* --------------------------------------------------------------------------
   Zustandsvarianten
   -------------------------------------------------------------------------- */

/**
 * **(m3) Zustand — schon gesichert.** Keine Aufforderung mehr, keine
 * Schrittfolge: nur die Bestätigung und die abgeschlossene Punktreihe.
 *
 * Das ist keine Design-Vorliebe, sondern das, was der Code hergibt. Nach dem
 * Bestätigungshaken löscht `clearPendingRecoveryKey` die geparkte Kopie, und
 * der Server hatte sie nie — „nochmal ansehen" gäbe es also gar nicht. Der
 * verbleibende Knopf heißt deshalb **„Ersatzschlüssel ändern"**, was das
 * Sicherheit-Panel in seiner gesunden Phase tatsächlich anbietet.
 */
export const M3ZustandGesichert: Story = {
	name: '(m3) Zustand — schon gesichert',
	args: modul3('secured')
};

/**
 * **(m3) Zustand — Gerät ohne Verschlüsselung.** Kein Schlüssel, kein Stepper,
 * kein Knopf.
 *
 * Tritt ein, wenn `client.getCrypto()` nichts liefert
 * (`CryptoUnavailableError`; das Sicherheit-Panel zeigt dafür die Phase
 * `unavailable`). Der Text verspricht nichts, was dieses Gerät nicht halten
 * kann, und sagt zugleich, dass die Beratung davon unberührt weiterläuft.
 */
export const M3ZustandNichtUnterstuetzt: Story = {
	name: '(m3) Zustand — ohne Verschlüsselung',
	args: modul3('unsupported')
};

/* --------------------------------------------------------------------------
   Breiten
   -------------------------------------------------------------------------- */

const Frame: React.FC<{ width: number; children: React.ReactNode }> = ({
	width,
	children
}) => (
	<div style={{ width, maxWidth: '100%' }} data-testid="erstantwort-frame">
		{children}
	</div>
);

/**
 * **(m3) Telefon 390.** Die enge Breite ist der Härtefall: Erklärtext,
 * Grafikfläche, Schrittzeile, Pfeile, Punkte und Fortschritt müssen
 * nebeneinander bestehen, ohne dass etwas umbricht oder aus der Blase läuft.
 */
export const M3Telefon390: Story = {
	name: '(m3) Telefon 390 — Schritt 1',
	args: modul3('notSecured', { initialStep: 1 }),
	render: (args) => (
		<Frame width={390}>
			<ErstantwortSequence {...args} />
		</Frame>
	)
};

/**
 * **(m3) Telefon 390, mittlerer Schritt.** Dieselbe Breite, Stepper auf
 * Schritt 3 von 5.
 */
export const M3Telefon390MittlererSchritt: Story = {
	name: '(m3) Telefon 390 — Schritt 3',
	args: modul3('notSecured', { initialStep: 3 }),
	render: (args) => (
		<Frame width={390}>
			<ErstantwortSequence {...args} />
		</Frame>
	)
};

/**
 * **(m3) Telefon 390, schon gesichert.** Der ruhige Zustand auf der engen
 * Breite — hier fällt am ehesten auf, wenn die Bestätigungszeile zu viel Platz
 * für eine erledigte Sache nimmt.
 */
export const M3Telefon390Gesichert: Story = {
	name: '(m3) Telefon 390 — schon gesichert',
	args: modul3('secured'),
	render: (args) => (
		<Frame width={390}>
			<ErstantwortSequence {...args} />
		</Frame>
	)
};

/**
 * **(m3) Desktop 1440.** Die Blase deckelt bei `min(100%, 34rem)`, damit die
 * Zeilen lesbar kurz bleiben; die Grafikfläche wächst mit der Blase, nicht mit
 * dem Fenster. Zu prüfen ist, ob die Fläche auf dieser Breite nicht leer wirkt
 * — davon hängt ab, welches Format die Zeichnungen bekommen.
 */
export const M3Desktop1440: Story = {
	name: '(m3) Desktop 1440 — Schritt 1',
	args: modul3('notSecured', { initialStep: 1, illustrationHeight: 156 }),
	render: (args) => (
		<Frame width={1440}>
			<ErstantwortSequence {...args} />
		</Frame>
	)
};
