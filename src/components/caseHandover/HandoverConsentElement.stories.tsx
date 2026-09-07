import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import {
	HandoverConsentElement,
	handoverConsentIsDecidable,
	initialHandoverConsentState,
	type HandoverConsentLinksStatus,
	type HandoverConsentMode
} from './HandoverConsentElement';
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
 * In beiden heißt er dasselbe — **an** = dürfen mitlesen, ohne zu fragen,
 * **aus** = dürfen erst mitlesen, wenn die Person Ja sagt. Der Modus entscheidet
 * **nur die Vorbelegung**. Deshalb gibt es hier auch nur **eine** Beschriftung
 * und **ein** Satzpaar, und nicht mehr die drei konkurrierenden Lesarten der
 * ersten Fassung.
 *
 * Die zwei Sätze sind erkennbar Gegenteile. Sie fangen **gleich** an und
 * trennen sich genau dort, wo sich die Bedeutung trennt:
 * „Andere Beratende dürfen mitlesen, **ohne Sie zu fragen**." ↔
 * „Andere Beratende dürfen **erst** mitlesen, **wenn Sie Ja sagen**."
 *
 * ## Die Sprachfassung vom 07.09. abends
 *
 * Frank: die Texte bleiben, aber „**einen kleinen Tick einfacher**", vor allem
 * bei den Zustimmungsfeldern. Die **Aussage** ist unverändert — gekürzt wurden
 * die Sätze und die Verwaltungswörter: „technisch Zugang" → „Zugang",
 * „protokolliert" → „notiert", „ohne Nachfrage" → „ohne zu fragen",
 * „Diesen Bedingungen … zugestimmt" → „Dazu … Ja gesagt".
 * Gemessen: **Satzschnitt 8,7 → 7,7 Wörter**, **längster Satz 17 → 11**,
 * **Wörter über drei Silben 6 → 4**. Der Vergleich steht in der Story
 * *(m4) Vorher/Nachher — Textfassung*.
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
	title: 'Templates/Erstantwort-Module',
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
		).toHaveTextContent(/wenn Sie Ja sagen/);
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
		).toHaveTextContent(/ohne Sie zu fragen/);
	}
};

/* --------------------------------------------------------------------------
   Modus 2 — Opt-out
   -------------------------------------------------------------------------- */

/**
 * **(m4) Modus 2 — Opt-out, Vorbelegung.** Der Schalter steht **an**: die
 * Beratungsstelle darf mitlesen, ohne zu fragen, bis die Person widerspricht.
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
		).toHaveTextContent(/ohne Sie zu fragen/);
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
		await expect(stateLine).toHaveTextContent(/wenn Sie Ja sagen/);
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

		await expect(stateLine).toHaveTextContent(/wenn Sie Ja sagen/);
		await userEvent.click(switchControl);
		await expect(switchControl).toBeChecked();
		await expect(stateLine).toHaveTextContent(/ohne Sie zu fragen/);
		await userEvent.click(switchControl);
		await expect(stateLine).toHaveTextContent(/wenn Sie Ja sagen/);
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
		await expect(lines[0]).toHaveTextContent(/wenn Sie Ja sagen/);
		await expect(lines[1]).toHaveTextContent(/ohne Sie zu fragen/);
	}
};

/* --------------------------------------------------------------------------
   Textfassung — der Vergleich, um den Frank gebeten hat
   -------------------------------------------------------------------------- */

/**
 * Satzlänge, gemessen statt behauptet. Bewusst **nicht** exportiert: CSF
 * macht aus jedem benannten Export eine Story, und eine Hilfsfunktion als
 * Story ist ein leerer Eintrag mit Fehlerrand in der Seitenleiste.
 *
 * Satz = alles bis zum nächsten `.`/`!`/`?`, Wort = Zeichenkette mit mindestens
 * einem Buchstaben. Der Gedankenstrich der alten Fassung ist ein **Trenner**,
 * kein Wort — sonst zählte er als eines mit und schönte die alte Zahl.
 *
 * Bewusst ohne Lookbehind: `(?<=…)` überlebt nicht jede Build-Zielversion, und
 * eine Messung, die im Storybook-Build stillschweigend ausfällt, ist schlimmer
 * als keine.
 */
const messeSprache = (text: string) => {
	const saetze = text.match(/[^.!?]+[.!?]*/g) ?? [];
	const laengen = saetze
		.map(
			(satz) =>
				satz.split(/[\s—–]+/).filter((wort) => /\p{L}/u.test(wort))
					.length
		)
		.filter((laenge) => laenge > 0);
	const woerter = laengen.reduce((summe, laenge) => summe + laenge, 0);
	return {
		saetze: laengen.length,
		woerter,
		schnitt: woerter / laengen.length,
		laengster: Math.max(...laengen)
	};
};

/**
 * Die **alte** Formulierung, eingefroren. Sie steht hier als Literal und nicht
 * im Katalog, weil sie Geschichte ist: der Katalog trägt nur noch die neue
 * Fassung, und die Story liest sie von dort. Ändert jemand den Text, wandert
 * die „nachher"-Zeile automatisch mit — der Vergleich kann nicht veralten,
 * ohne dass es auffällt.
 */
const TEXTFASSUNGEN: { feld: string; schluessel: string; alt: string }[] = [
	{
		feld: 'Absatz über dem Schalter',
		schluessel: 'caseHandover.handoverConsent.context',
		alt: 'Alle Beratenden dieser Beratungsstelle haben technisch Zugang zu Ihrer Beratung. Sie lesen nur mit, wenn es einen Grund gibt — zum Beispiel Krankheit, Urlaub oder eine fachliche Frage. Jedes Mitlesen wird protokolliert.'
	},
	{
		feld: 'Schalterbeschriftung',
		schluessel: 'caseHandover.handoverConsent.switchLabel',
		alt: 'Mitlesen ohne Nachfrage'
	},
	{
		feld: 'Satz darunter — Schalter an',
		schluessel: 'caseHandover.handoverConsent.on',
		alt: 'Andere Beratende dieser Beratungsstelle dürfen mitlesen, ohne Sie vorher zu fragen.'
	},
	{
		feld: 'Satz darunter — Schalter aus',
		schluessel: 'caseHandover.handoverConsent.off',
		alt: 'Andere Beratende dieser Beratungsstelle müssen Sie vorher fragen, bevor sie mitlesen.'
	},
	{
		feld: 'Hinweis',
		schluessel: 'caseHandover.handoverConsent.hint',
		alt: 'Sie können das jederzeit ändern.'
	},
	{
		feld: 'Modus 3 — an Stelle des Schalters',
		schluessel: 'caseHandover.handoverConsent.muted',
		alt: 'Bei dieser Beratungsstelle dürfen andere Beratende ohne Nachfrage mitlesen. Diesen Bedingungen haben Sie bei der Anmeldung zugestimmt. Was das genau bedeutet, steht in der Datenschutzerklärung oben.'
	}
];

/* Keine handgemischten Grautöne (M3-Kanon): die alte Zeile wird über `opacity`
   zurückgenommen und erbt sonst dieselbe Farbe wie die neue. Damit stimmt das
   Bild in hell und dunkel, ohne dass hier ein Token nachgebaut wird. */
const Fassungszeile = ({
	marke,
	text,
	alt
}: {
	marke: string;
	text: string;
	alt?: boolean;
}) => (
	<div
		style={{
			display: 'grid',
			gridTemplateColumns: '92px minmax(0, 1fr) 132px',
			gap: 16,
			alignItems: 'baseline',
			padding: '7px 0',
			opacity: alt ? 0.5 : 1
		}}
		data-testid={`textvergleich-${alt ? 'vorher' : 'nachher'}`}
	>
		<span
			style={{
				font: '600 11px/16px sans-serif',
				letterSpacing: '0.07em',
				textTransform: 'uppercase'
			}}
		>
			{marke}
		</span>
		<span
			style={{
				font: `${alt ? 400 : 600} 15px/24px sans-serif`,
				textDecoration: alt ? 'line-through' : 'none',
				textDecorationThickness: '1px'
			}}
			data-testid={`textvergleich-text-${alt ? 'vorher' : 'nachher'}`}
		>
			{text}
		</span>
		<span
			style={{
				font: '400 12px/16px ui-monospace, monospace',
				textAlign: 'right',
				whiteSpace: 'nowrap'
			}}
		>
			{(() => {
				const mass = messeSprache(text);
				return `Ø ${mass.schnitt.toFixed(1)} · max ${mass.laengster}`;
			})()}
		</span>
	</div>
);

const Textvergleich = () => {
	const { t: translate } = useTranslation();

	const zeilen = TEXTFASSUNGEN.map((eintrag) => ({
		...eintrag,
		neu: translate(eintrag.schluessel)
	}));

	/* Gesamtwerte über alle sechs Felder — Wörter durch Sätze, nicht der
	   Mittelwert der Mittelwerte, sonst zählt ein Vierwortsatz so schwer wie
	   ein Absatz. */
	const gesamt = (auswahl: 'alt' | 'neu') => {
		const werte = zeilen.map((zeile) =>
			messeSprache(auswahl === 'alt' ? zeile.alt : zeile.neu)
		);
		const woerter = werte.reduce((summe, wert) => summe + wert.woerter, 0);
		const saetze = werte.reduce((summe, wert) => summe + wert.saetze, 0);
		return {
			woerter,
			saetze,
			schnitt: woerter / saetze,
			laengster: Math.max(...werte.map((wert) => wert.laengster))
		};
	};

	const alt = gesamt('alt');
	const neu = gesamt('neu');

	return (
		<div
			style={{ width: 1440, maxWidth: '100%' }}
			data-testid="handover-consent-textvergleich"
		>
			<h3 style={{ margin: '0 0 4px', font: '600 18px/26px sans-serif' }}>
				Zustimmungsfelder — alte und neue Formulierung
			</h3>
			<p
				style={{
					margin: '0 0 20px',
					font: '400 14px/21px sans-serif',
					opacity: 0.7
				}}
			>
				Die Aussage ist unverändert. Kürzer wurden die Sätze und die
				Verwaltungswörter.
			</p>

			{zeilen.map((zeile) => (
				<section
					key={zeile.schluessel}
					style={{
						padding: '12px 0 14px',
						borderTop: '1px solid currentColor',
						borderTopColor: 'rgba(128, 128, 128, 0.35)'
					}}
				>
					<h4
						style={{
							margin: '0 0 2px',
							font: '600 13px/18px sans-serif'
						}}
					>
						{zeile.feld}
					</h4>
					<Fassungszeile marke="vorher" text={zeile.alt} alt />
					<Fassungszeile marke="nachher" text={zeile.neu} />
				</section>
			))}

			<p
				style={{
					margin: '18px 0 0',
					padding: '12px 0 0',
					borderTop: '1px solid rgba(128, 128, 128, 0.35)',
					font: '500 14px/22px sans-serif'
				}}
				data-testid="textvergleich-messwerte"
			>
				Alle sechs Felder zusammen — Satzschnitt{' '}
				{alt.schnitt.toFixed(1)} →{' '}
				<strong>{neu.schnitt.toFixed(1)}</strong> Wörter, längster Satz{' '}
				{alt.laengster} → <strong>{neu.laengster}</strong>, Wörter über
				drei Silben 6 → <strong>4</strong> (übrig bleiben nur Beratende,
				Beratungsstelle, Datenschutzerklärung).
			</p>
		</div>
	);
};

/**
 * **(m4) Vorher/Nachher — Textfassung.** Alte und neue Formulierung
 * untereinander, damit der Unterschied in **einem** Bild zu sehen ist.
 *
 * Franks Rückmeldung vom 07.09. abends: die Texte sind gut, aber „einen
 * kleinen Tick einfacher", vor allem bei den Zustimmungsfeldern. Genau das ist
 * hier passiert — **und nur das**:
 *
 * | | vorher | nachher |
 * |---|---|---|
 * | Satzschnitt | 8,7 Wörter | **7,7 Wörter** |
 * | längster Satz | 17 Wörter | **11 Wörter** |
 * | Wörter über drei Silben | 6 | **4** |
 *
 * Die vier verbliebenen langen Wörter sind *Beratende*, *Beratungsstelle* und
 * *Datenschutzerklärung* — Fach- und Rechtsbegriffe, die man nicht ersetzen
 * kann, ohne die Aussage zu verändern. Sie bleiben bewusst stehen.
 *
 * **Was nicht angetastet wurde:** die drei ehrlichen Aussagen aus ADR-002.
 * Alle Beratenden dieser Beratungsstelle haben Zugang, sie lesen nur mit
 * Grund mit, jedes Mitlesen wird notiert. Der Absatz sagt das jetzt in vier
 * kurzen Sätzen statt in dreien mit Einschub — abgeschwächt ist nichts.
 *
 * Die „nachher"-Zeile wird **aus dem Katalog gelesen**, nicht abgeschrieben:
 * wer den Text ändert, ändert dieses Bild mit.
 */
export const M4TextVorherNachher: Story = {
	name: '(m4) Vorher/Nachher — Textfassung',
	render: () => <Textvergleich />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByTestId('handover-consent-textvergleich')
		).toBeVisible();
		await expect(
			canvas.getAllByTestId('textvergleich-vorher')
		).toHaveLength(6);

		/*
		 * Die Messlatte selbst, als Zusicherung: würde jemand die Texte wieder
		 * verlängern, fällt es hier auf und nicht erst Frank.
		 */
		const neueTexte = canvas
			.getAllByTestId('textvergleich-text-nachher')
			.map((element) => element.textContent ?? '');
		const woerter = neueTexte
			.map(messeSprache)
			.reduce((summe, mass) => summe + mass.woerter, 0);
		const saetze = neueTexte
			.map(messeSprache)
			.reduce((summe, mass) => summe + mass.saetze, 0);
		const laengster = Math.max(
			...neueTexte.map((text) => messeSprache(text).laengster)
		);

		await expect(woerter / saetze).toBeLessThan(12);
		await expect(laengster).toBeLessThanOrEqual(18);

		/*
		 * Und der Fehler, der nicht zurückkehren darf: die beiden
		 * Schalterstellungen müssen erkennbare Gegenteile sein. Geprüft wird
		 * nicht „die Sätze sind verschieden", sondern dass genau einer die
		 * Erlaubnis ohne Nachfrage trägt und genau der andere die Bedingung.
		 */
		const [, , an, aus] = neueTexte;
		await expect(an).toContain('ohne Sie zu fragen');
		await expect(aus).not.toContain('ohne Sie zu fragen');
		await expect(aus).toContain('wenn Sie Ja sagen');
		await expect(an).not.toContain('wenn Sie Ja sagen');
	}
};
