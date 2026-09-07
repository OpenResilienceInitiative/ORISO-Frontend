import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	HandoverConsentElement,
	handoverConsentIsDecidable,
	initialHandoverConsentState,
	type HandoverConsentLinksStatus,
	type HandoverConsentMode
} from './HandoverConsentElement';
import {
	contrastRatio,
	darkSchemeGlobals,
	relativeLuminance,
	schemeToken
} from '../message/messageStoryShell';
import '../erstantwort/ErstantwortSequence.styles.scss';
import './handoverConsentElement.styles.scss';

const AGENCY = 'Beratungsstelle Bremen-Mitte';

/**
 * # Modul 4 — Wer darf mitlesen?
 *
 * **Vorschlag, nichts ist entschieden.** Begleitpapier mit der Analyse, den
 * Codebelegen und den offenen Fragen:
 * `0 - Docs/VERDRAHTUNG-modul4-handover-consent-2026-09-07.md`.
 *
 * ## Die Funktion
 *
 * Die ratsuchende Person wird vorher gefragt, ob andere Beratende derselben
 * Beratungsstelle ihren Fall aufdecken dürfen. Es gibt genau drei Betriebsarten,
 * und welche gilt, entscheidet die Beratungsstelle:
 *
 * | Modus | Schalter startet | Was die Person tun muss |
 * |---|---|---|
 * | **1 — Opt-in** | **aus** | selbst einschalten, wenn sie künftig nicht mehr gefragt werden will |
 * | **2 — Opt-out** | **an** | selbst ausschalten, wenn sie jedes Mal gefragt werden will |
 * | **3 — stumm** | — | nichts; die Beratungsstelle hat die Wahl abgeschaltet, der Schalter erscheint nicht |
 *
 * ## Der eine Befund, der alles vereinfacht
 *
 * **Modus 1 und Modus 2 geben dem Schalter nicht zwei verschiedene Bedeutungen.**
 * In beiden heißt er dasselbe — **an** = dürfen ohne Nachfrage mitlesen,
 * **aus** = müssen vorher fragen. Der Modus entscheidet **nur die Vorbelegung**.
 * Deshalb gibt es hier auch nur **eine** Beschriftung und **ein** Satzpaar, und
 * nicht mehr die drei konkurrierenden Lesarten der ersten Fassung.
 *
 * Die zwei Sätze sind jetzt erkennbar Gegenteile:
 * „**dürfen** mitlesen, **ohne** Sie **zu fragen**" ↔
 * „**müssen** Sie **vorher fragen**, bevor sie mitlesen."
 *
 * ## Was der Text nicht behaupten darf
 *
 * Nach **ADR-002** sind die Kolleg:innen der Beratungsstelle **ab Raumerstellung
 * stille Mitglieder**, und der Vorhang ist Zugriffssteuerung plus Protokoll,
 * **nicht Verschlüsselung**. Ein Satz, der verspricht, niemand sonst *könne*
 * lesen, wäre unwahr. Der Absatz über dem Schalter sagt deshalb offen, dass der
 * Zugang technisch existiert — der Schalter regelt das **absichtliche,
 * protokollierte** Mitlesen.
 *
 * ## Nicht verdrahtet
 *
 * Die drei Modi gibt es in der echten Konfiguration **so nicht**: real ist ein
 * einzelnes `clientConsentRequired` **pro Übergabegrund**, plattformweit in der
 * UserService-Tabelle `case_handover_reason_policy` — nicht pro Beratungsstelle.
 * Modus 2 ist im Admin ein deaktivierter Platzhalter, Modus 3 existiert nur als
 * Falsch-Zweig desselben Booleans. Details im Begleitpapier.
 */
const meta = {
	title: 'Erstantwort/Organisms/HandoverConsent',
	component: HandoverConsentElement,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	/*
	 * Every story renders through `Live` below, which owns the switch position,
	 * so these args only satisfy the required props of the documented component.
	 * They are what the autodocs control panel starts from.
	 */
	args: {
		mode: 'OPT_IN',
		agencyName: AGENCY,
		checked: false,
		onChange: () => undefined,
		onOpenDocument: () => undefined
	}
} satisfies Meta<typeof HandoverConsentElement>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Stateful host, so the switch really moves and the sentence underneath really
 * changes. A static `checked` prop would let a screenshot claim a behaviour the
 * component does not have.
 */
const Live = ({
	mode,
	initial,
	width,
	...props
}: {
	mode: HandoverConsentMode;
	/** Overrides the mode's own preselection — used only to show the other position. */
	initial?: boolean;
	width?: number;
	agencyName?: string;
	linksStatus?: HandoverConsentLinksStatus;
	saving?: boolean;
	error?: string;
	onRetry?: () => void;
}) => {
	const [checked, setChecked] = React.useState(
		initial ?? initialHandoverConsentState(mode)
	);
	return (
		<Frame width={width}>
			<HandoverConsentElement
				mode={mode}
				agencyName={AGENCY}
				onOpenDocument={() => undefined}
				checked={checked}
				onChange={setChecked}
				{...props}
			/>
		</Frame>
	);
};

const Frame = ({
	width,
	children
}: {
	width?: number;
	children: React.ReactNode;
}) =>
	width ? (
		<div
			style={{ width, maxWidth: '100%' }}
			data-testid="handover-consent-frame"
		>
			{children}
		</div>
	) : (
		<>{children}</>
	);

/* --------------------------------------------------------------------------
   Modus 1 — Opt-in
   -------------------------------------------------------------------------- */

/**
 * **(m4) Modus 1 — Opt-in, Vorbelegung.** Der Schalter steht **aus**, weil die
 * Person jedes Mal gefragt werden soll, solange sie nichts anderes sagt.
 *
 * Diese Vorbelegung ist nicht nur Franks Regel, sie ist auch die einzig
 * zulässige: eine vorangekreuzte Einwilligung ist nach Art. 4 Nr. 11 und
 * Art. 7 Abs. 2 DSGVO keine Einwilligung (EuGH *Planet49*, C-673/17).
 */
export const M4Modus1OptInAus: Story = {
	name: '(m4) Modus 1 — Opt-in, Schalter aus',
	render: () => <Live mode="OPT_IN" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const switchControl = canvas.getByTestId('handover-consent-switch');
		/* The mode's whole job is the preselection, so it is asserted, not
		   assumed: opt-in must arrive unchecked. */
		await expect(switchControl).not.toBeChecked();
		await expect(
			canvas.getByTestId('handover-consent-state-line')
		).toHaveTextContent(/müssen Sie vorher fragen/);
	}
};

/**
 * **(m4) Modus 1 — nachdem die Person zugestimmt hat.** Sie hat den Schalter
 * selbst gesetzt: ab jetzt wird sie nicht mehr gefragt.
 *
 * Der Satz darunter ist das Gegenteil des vorherigen — dieselbe Aussage,
 * umgedreht, ohne doppelte Verneinung.
 */
export const M4Modus1OptInAn: Story = {
	name: '(m4) Modus 1 — Opt-in, Schalter an',
	render: () => <Live mode="OPT_IN" initial />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByTestId('handover-consent-switch')
		).toBeChecked();
		await expect(
			canvas.getByTestId('handover-consent-state-line')
		).toHaveTextContent(/ohne Sie vorher zu fragen/);
	}
};

/* --------------------------------------------------------------------------
   Modus 2 — Opt-out
   -------------------------------------------------------------------------- */

/**
 * **(m4) Modus 2 — Opt-out, Vorbelegung.** Der Schalter steht **an**: die
 * Beratungsstelle darf ohne Nachfrage mitlesen, bis die Person widerspricht.
 *
 * Beachte: **derselbe Schalter, dieselbe Beschriftung, derselbe Satz** wie in
 * Modus 1 — nur die Ausgangsstellung ist eine andere. Genau das ist der Befund
 * aus dem Begleitpapier.
 */
export const M4Modus2OptOutAn: Story = {
	name: '(m4) Modus 2 — Opt-out, Schalter an',
	render: () => <Live mode="OPT_OUT" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByTestId('handover-consent-switch')
		).toBeChecked();
		await expect(
			canvas.getByTestId('handover-consent-state-line')
		).toHaveTextContent(/ohne Sie vorher zu fragen/);
	}
};

/**
 * **(m4) Modus 2 — nachdem die Person widersprochen hat.** Sie hat den Schalter
 * selbst ausgeschaltet und wird ab jetzt jedes Mal gefragt.
 *
 * Hier wird auch geprüft, dass der beschreibende Satz wirklich am Schalter
 * hängt: `aria-describedby` muss auf genau dieses Element zeigen, sonst hört
 * eine blinde Person nur „an"/„aus" und erfährt die Bedeutung nie.
 */
export const M4Modus2OptOutAus: Story = {
	name: '(m4) Modus 2 — Opt-out, Schalter aus',
	render: () => <Live mode="OPT_OUT" initial={false} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const switchControl = canvas.getByTestId('handover-consent-switch');
		const stateLine = canvas.getByTestId('handover-consent-state-line');

		await expect(switchControl).not.toBeChecked();
		await expect(stateLine).toHaveTextContent(/müssen Sie vorher fragen/);
		await expect(switchControl.getAttribute('aria-describedby')).toBe(
			stateLine.id
		);
		/* The live region is what makes the change audible; a plain paragraph
		   would leave the announcement at "off". */
		await expect(stateLine).toHaveAttribute('role', 'status');
	}
};

/**
 * **(m4) Der Wechsel selbst.** Ein Klick auf den Schalter, und der Satz
 * darunter muss auf die Gegenaussage umspringen. Läuft als Component Test in
 * CI mit — die Behauptung „die beiden Stellungen sind Gegenteile" wird hier
 * geprüft und nicht nur im Screenshot gezeigt.
 */
export const M4Umschalten: Story = {
	name: '(m4) Umschalten — der Satz springt mit',
	render: () => <Live mode="OPT_IN" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const switchControl = canvas.getByTestId('handover-consent-switch');
		const stateLine = canvas.getByTestId('handover-consent-state-line');

		await expect(stateLine).toHaveTextContent(/müssen Sie vorher fragen/);
		await userEvent.click(switchControl);
		await expect(switchControl).toBeChecked();
		await expect(stateLine).toHaveTextContent(/ohne Sie vorher zu fragen/);
		await userEvent.click(switchControl);
		await expect(stateLine).toHaveTextContent(/müssen Sie vorher fragen/);
	}
};

/* --------------------------------------------------------------------------
   Modus 3 — stummgeschaltet
   -------------------------------------------------------------------------- */

/**
 * **(m4) Modus 3 — stummgeschaltet.** Die Beratungsstelle hat die Wahl hart
 * abgeschaltet, deshalb **erscheint der Schalter nicht**.
 *
 * **Die Nachricht bleibt trotzdem stehen** — bewusst, aus drei Gründen:
 *
 * 1. Impressum und Datenschutzerklärung der Beratungsstelle sind eine
 *    **Informationspflicht auf jeder Ebene** (ADR-021 Entscheidung 7) und
 *    hängen an keiner Einwilligung. Fiele die Nachricht weg, fielen sie mit.
 * 2. ADR-002 legt die stille Mitgliedschaft ausdrücklich **über die
 *    Datenschutzerklärung des Fachbereichs** offen — also durch Information,
 *    nicht durch Zustimmung. Genau dieses Regime gilt in Modus 3.
 * 3. Die Wahl abzuschalten heißt nicht, die Tatsache zu verschweigen. Ohne die
 *    Nachricht erführe die Person nie, dass mitgelesen werden darf.
 *
 * An der Stelle des Schalters steht deshalb ein Aussagesatz statt einer
 * Scheinauswahl — und die Unterzeile wechselt von „Bitte einmal entscheiden"
 * zu „Bitte kurz lesen", weil es nichts zu entscheiden gibt.
 */
export const M4Modus3Stumm: Story = {
	name: '(m4) Modus 3 — stummgeschaltet, kein Schalter',
	render: () => <Live mode="MUTED" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		/* "The field does not appear" is the requirement, so absence is the
		   assertion — not a disabled switch, not a hidden one. */
		await expect(
			canvas.queryByTestId('handover-consent-switch')
		).toBeNull();
		await expect(
			canvas.getByTestId('handover-consent-muted')
		).toBeVisible();
		/* But the two legal documents must survive the muting. */
		await expect(
			canvas.getByTestId('handover-consent-link-imprint')
		).toBeVisible();
		await expect(
			canvas.getByTestId('handover-consent-link-privacy')
		).toBeVisible();
		await expect(handoverConsentIsDecidable('MUTED')).toBe(false);
	}
};

/* --------------------------------------------------------------------------
   Zustände
   -------------------------------------------------------------------------- */

/**
 * **(m4) Speichern.** Während die Einstellung geschrieben wird, trägt der
 * Schalter das native `disabled` — nicht nur eine graue Farbe. Ein Schalter,
 * der aussieht wie deaktiviert, aber Klicks annimmt, erzeugt genau die
 * doppelten Schreibvorgänge, die eine Einwilligung nicht haben darf.
 */
export const M4Speichern: Story = {
	name: '(m4) Speichern läuft',
	render: () => <Live mode="OPT_IN" initial saving />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByTestId('handover-consent-switch')
		).toBeDisabled();
		await expect(
			canvas.getByTestId('handover-consent-saving')
		).toBeVisible();
	}
};

/**
 * **(m4) Speichern fehlgeschlagen.** Die Meldung sagt, **welche Stellung jetzt
 * gilt** — sonst bleibt die Person im Unklaren darüber, ob sie gerade
 * zugestimmt hat oder nicht. Muster: `NotificationSwitchRow.tsx:89-112`
 * (optimistisch setzen, bei Fehler zurückrollen und es ansagen).
 */
export const M4Fehler: Story = {
	name: '(m4) Speichern fehlgeschlagen',
	render: () => (
		<Live
			mode="OPT_IN"
			error="Die Einstellung konnte nicht gespeichert werden. Es gilt weiterhin: Sie werden jedes Mal gefragt."
			onRetry={() => undefined}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const alert = canvas.getByTestId('handover-consent-error');
		await expect(alert).toHaveAttribute('role', 'alert');
		await expect(alert).toHaveTextContent(/jedes Mal gefragt/);
	}
};

/**
 * **(m4) Rechtstexte werden geladen.** Die Beschriftungen stehen schon da, aber
 * noch nicht als Link — ein Anker, der noch nirgendwohin führt, ist schlimmer
 * als eine sichtbar wartende Zeile.
 */
export const M4RechtstexteLaden: Story = {
	name: '(m4) Rechtstexte werden geladen',
	render: () => <Live mode="OPT_IN" linksStatus="loading" />
};

/**
 * **(m4) Rechtstexte nicht auflösbar.** ADR-021 Entscheidung 7 verlangt, dass
 * das Impressum auf **jeder** Ebene erreichbar ist. Ein stilles Verstecken der
 * Zeile — was `DepartmentLegalSection` heute tut, wenn `hasPublishedDpp` lügt —
 * würde den Ausfall unsichtbar machen. Also wird er angesagt.
 */
export const M4RechtstexteFehlen: Story = {
	name: '(m4) Rechtstexte nicht auflösbar',
	render: () => <Live mode="OPT_IN" linksStatus="unavailable" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByTestId('handover-consent-link-missing-imprint')
		).toBeVisible();
	}
};

/* --------------------------------------------------------------------------
   Breiten
   -------------------------------------------------------------------------- */

/** **(m4) Telefon 390 — Modus 1, Vorbelegung.** Die enge Breite ist der Härtefall. */
export const M4Telefon390Modus1Aus: Story = {
	name: '(m4) Telefon 390 — Modus 1, aus',
	render: () => <Live mode="OPT_IN" width={390} />
};

/** **(m4) Telefon 390 — Modus 1, nachdem die Person zugestimmt hat.** */
export const M4Telefon390Modus1An: Story = {
	name: '(m4) Telefon 390 — Modus 1, an',
	render: () => <Live mode="OPT_IN" initial width={390} />
};

/** **(m4) Telefon 390 — Modus 2, Vorbelegung.** */
export const M4Telefon390Modus2An: Story = {
	name: '(m4) Telefon 390 — Modus 2, an',
	render: () => <Live mode="OPT_OUT" width={390} />
};

/** **(m4) Telefon 390 — Modus 2, nachdem die Person widersprochen hat.** */
export const M4Telefon390Modus2Aus: Story = {
	name: '(m4) Telefon 390 — Modus 2, aus',
	render: () => <Live mode="OPT_OUT" initial={false} width={390} />
};

/** **(m4) Telefon 390 — Modus 3.** Ohne Schalter, mit beiden Rechtstexten. */
export const M4Telefon390Modus3: Story = {
	name: '(m4) Telefon 390 — Modus 3, stumm',
	render: () => <Live mode="MUTED" width={390} />
};

/**
 * **(m4) Vergleich 1440 — alle drei Modi nebeneinander.** Die Story, die die
 * Entscheidung trägt: links Modus 1 in seiner Vorbelegung, in der Mitte Modus 2
 * in seiner, rechts Modus 3 ohne Schalter.
 *
 * Was hier sichtbar werden soll: Beschriftung und Satz sind in Modus 1 und 2
 * **identisch**, nur die Stellung unterscheidet sich. Wären es zwei
 * Bedeutungen, müsste man hier zwei verschiedene Texte lesen — man liest
 * denselben.
 */
export const M4Vergleich1440: Story = {
	name: '(m4) Vergleich 1440 — alle drei Modi',
	render: () => (
		<div
			style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
				gap: 24,
				width: 1440,
				maxWidth: '100%'
			}}
			data-testid="handover-consent-comparison"
		>
			{(
				[
					['Modus 1 — Opt-in', 'OPT_IN'],
					['Modus 2 — Opt-out', 'OPT_OUT'],
					['Modus 3 — stummgeschaltet', 'MUTED']
				] as [string, HandoverConsentMode][]
			).map(([caption, mode]) => (
				<div key={mode}>
					<h4
						style={{
							margin: '0 0 8px',
							font: '600 13px/18px sans-serif'
						}}
					>
						{caption}
					</h4>
					<Live mode={mode} />
				</div>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		/* Two switches, not three: the muted column has none. That is the
		   whole point of the comparison, so it is asserted here. */
		await expect(
			canvas.getAllByTestId('handover-consent-switch')
		).toHaveLength(2);
		const [optIn, optOut] = canvas.getAllByTestId(
			'handover-consent-switch'
		);
		await expect(optIn).not.toBeChecked();
		await expect(optOut).toBeChecked();
		/* Same label in both decidable modes — the single-meaning finding. */
		const lines = canvas.getAllByTestId('handover-consent-state-line');
		await expect(lines[0]).toHaveTextContent(/müssen Sie vorher fragen/);
		await expect(lines[1]).toHaveTextContent(/ohne Sie vorher zu fragen/);
	}
};

/* --------------------------------------------------------------------------
   Dunkles Schema
   -------------------------------------------------------------------------- */

/**
 * **(m4-dunkel) Modul 4 im dunklen Schema — der Beweis, wo der Fehler liegt.**
 *
 * `handoverConsentElement.styles.scss` ist die **vorbildliche** Datei der vier
 * Module: kein einziger fester Farbwert außerhalb eines
 * `var(--m3-…, fallback)`, wie es der Sweep-Wächter verlangt (Kopf der Datei:
 * *„All colours go through M3 roles with an explicit fallback"*).
 *
 * Und genau deshalb bricht es hier. Modul 4 rendert **in** derselben
 * Carimat-Blase wie die Geschwister — `HandoverConsentElement.tsx:442` gibt
 * seinen Inhalt an `ErstantwortSequence` weiter —, und diese Blase verdrahtet
 * ihr Grau fest: `.pseudonymCard__bubble { background: #eeeeee }`. Die Schrift
 * folgt der Rolle nach hell, der Untergrund folgt nicht.
 *
 * Gemessen auf dieser Story (390 px, Schema `dark`):
 *
 * | Element | Farbe | gegen die Blase `#eeeeee` |
 * | --- | --- | --- |
 * | Zustandszeile (`--m3-on-surface`) | `#e4e2e2` | **1,11:1** |
 * | Fließtext der Blase (fester Wert) | `#1c1b1f` | 14,76:1 |
 *
 * Das ist der eigentliche Befund der vier dunklen Stories: **die Module machen
 * es richtig, die Blase nicht.** Wer den Fehler in Modul 4 sucht, sucht an der
 * falschen Stelle — die Reparatur ist eine Zeile in
 * `PseudonymCard.styles.scss`, nicht vier Zeilen in vier Modulen.
 *
 * Die `play`-Funktion belegt beide Hälften: dass die Schrift dem Schema
 * **gefolgt** ist (das bleibt richtig, auch nachdem die Blase repariert
 * wurde), und dass sie damit heute unter der Lesbarkeitsschwelle landet.
 */
export const M4Dunkel: Story = {
	name: '(m4-dunkel) Dunkles Schema — Telefon 390',
	globals: darkSchemeGlobals,
	render: () => <Live mode="OPT_IN" width={390} />,
	play: async ({ canvasElement }) => {
		/* 1. Das Schema ist wirklich dunkel — gemessen, nicht angesehen. */
		expect(relativeLuminance(schemeToken('--m3-surface'))).toBeLessThan(
			0.1
		);

		/* 2. Die Schrift ist mitgegangen: die Zustandszeile zieht ihre Farbe
		   aus `--m3-on-surface`, also ist sie im dunklen Schema hell. Diese
		   Zusicherung bleibt richtig, wenn die Blase repariert wird. */
		const stateLine = within(canvasElement).getByTestId(
			'handover-consent-state-line'
		);
		const colour = getComputedStyle(stateLine).color;
		expect(relativeLuminance(colour)).toBeGreaterThan(0.5);

		/* 3. Und der Befund: die Blase ist hell geblieben, also steht helle
		   Schrift auf hellgrau. Fällt um, sobald `.pseudonymCard__bubble` eine
		   M3-Rolle bekommt — beabsichtigt. */
		const bubble = canvasElement.querySelector<HTMLElement>(
			'.pseudonymCard__bubble'
		);
		expect(bubble).not.toBeNull();
		const bubbleBackground = getComputedStyle(
			bubble as HTMLElement
		).backgroundColor;
		expect(relativeLuminance(bubbleBackground)).toBeGreaterThan(0.5);
		expect(contrastRatio(colour, bubbleBackground)).toBeLessThan(4.5);
	}
};
