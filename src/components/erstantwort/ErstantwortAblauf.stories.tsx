/*
 * `import * as React` ist tragend, keine Gewohnheit: `npx tsc` läuft ohne den
 * Import grün (die tsconfig benutzt den automatischen JSX-Transform), aber
 * Storybooks Vite/esbuild-Pipeline übersetzt JSX nach `React.createElement` —
 * eine Story-Datei ohne diesen Import rendert im Browser „React is not defined",
 * während jedes Typ-Tor grün bleibt. Die Schwester-Stories tragen ihn aus
 * demselben Grund.
 */
import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { ErstantwortSequence } from './ErstantwortSequence';
import { ErstantwortSuccessMessage } from './ErstantwortSuccessMessage';
import {
	HandoverConsentElement,
	initialHandoverConsentState,
	type HandoverConsentMode
} from '../caseHandover/HandoverConsentElement';
import { MessageDateDivider } from '../message/MessageDateDivider';
import { useAdvanceFocus } from './erstantwortAdvanceFocus';
import {
	ErstantwortNotifyChoice,
	type ErstantwortNotifyBrowserState,
	type ErstantwortNotifyChoiceValue
} from './ErstantwortNotifyChoice';
import { ErstantwortBrowserPermission } from './ErstantwortBrowserPermission';
import { ErstantwortRecoveryCard } from './ErstantwortRecoveryCard';
import type { ResolvedBaustein } from './erstantwortResolve';
import {
	ERSTANTWORT_RECOVERY_STEPS,
	erstantwortRecoveryBaustein
} from './erstantwortRecoveryCopy';
import {
	ERSTANTWORT_LATER_MARKER,
	ERSTANTWORT_SHORTENED,
	ERSTANTWORT_SUBTITLES,
	advanceAnnouncement,
	erstantwortBrowserBranchBaustein,
	erstantwortEmailBranchBaustein,
	flowText
} from './erstantwortFlowCopy';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import './ErstantwortSequence.styles.scss';


/* Keiner der vorgeschlagenen Schlüssel steht in `de/common.json`; die Module
   arbeiten deshalb mit einer Copy-Map plus injiziertem `translate`. Hier gibt
   der Übersetzer schlicht den deutschen Rückfall zurück — genau das, was die
   Anwendung nach dem Nachtragen der Schlüssel auch anzeigen würde. */
const translate = (_key: string, defaultValue?: string) => defaultValue ?? '';

/*
 * Nachricht 1 löst ihre Bausteine seit dem 07.09. abends selbst aus dem
 * ausgelieferten Katalog auf — in `ErstantwortSuccessMessage.tsx`, damit
 * `Templates/Erstantwort-Module` und diese Kette **dieselbe** Nachricht zeigen.
 * Deshalb steht hier kein zweiter Aufruf des Auflösers mehr; die übrigen
 * Nachrichten der Kette bauen ihre Bausteine aus `erstantwortFlowCopy.ts` und
 * `erstantwortRecoveryCopy.ts`.
 */

/* --------------------------------------------------------------------------
   Die Kette
   -------------------------------------------------------------------------- */

type FlowMessageId =
	| 'erfolg'
	| 'auswahl'
	| 'email'
	| 'browser'
	| 'schluessel'
	| 'einwilligung';

interface FlowDemoProps {
	/** Vorbelegte Auswahl — für die Zweig-Stories und die Screenshots. */
	initialChoice?: ErstantwortNotifyChoiceValue | null;
	initialEmailDone?: boolean;
	initialBrowserDone?: boolean;
	/** Was der Browser gerade kann. In Storybook gesetzt, nie gelesen. */
	browserState?: ErstantwortNotifyBrowserState;
	/** Den quadratischen Bildplatz in Nachricht 1 reservieren. */
	showImage?: boolean;
	/** Das Kästchen „nicht wieder anzeigen" unter den Fragen zeigen. */
	dismissible?: boolean;
	/**
	 * **Das sechste Kettenglied: die Einwilligungsnachricht (Modul 4).**
	 *
	 * Sie hat einen **eigenen Auslöser** und kommt deshalb nicht mit den
	 * anderen: die vier oben entstehen in der Sekunde des Absendens, diese
	 * erst, wenn eine Beratungsstelle die Anfrage **angenommen** hat. Deshalb
	 * ist sie eine eigene Fahne und keine abgeleitete Bedingung der Kette —
	 * eine Kette, die sie selbst „ausrechnen" könnte, gäbe es nicht.
	 */
	agencyAccepted?: boolean;
	/** Betriebsart der Beratungsstelle für Modul 4 (`OPT_IN` ist der Ist-Zustand). */
	consentMode?: HandoverConsentMode;
	/** Name der annehmenden Beratungsstelle, für den Eröffnungssatz von Modul 4. */
	agencyName?: string;
	/**
	 * Nur diese Nachrichten rendern. Die Kette rechnet unverändert weiter — die
	 * Liste beschneidet ausschließlich die Anzeige, damit ein Screenshot eine
	 * einzelne Nachricht mit ihrem Carimat-Kopf zeigen kann, ohne dass die
	 * Story eine andere Rechnung anstellt als die Ablauf-Story daneben.
	 */
	only?: readonly FlowMessageId[];
}

/**
 * **Der Ablauf als Zustandsmaschine — Storybook-only.**
 *
 * Bewusst in der Story-Datei und nicht in einer Komponente: die Kette ist genau
 * das, worüber noch nicht entschieden ist. Eine Komponente unter
 * `src/components/` läse sich als halbe Umsetzung; hier ist sie unmissverständ­
 * lich ein Vorschlag zum Ansehen.
 */
const FlowDemo: React.FC<FlowDemoProps> = ({
	initialChoice = null,
	initialEmailDone = false,
	initialBrowserDone = false,
	browserState = 'available',
	showImage = true,
	dismissible = false,
	agencyAccepted = false,
	consentMode = 'OPT_IN',
	agencyName = 'Beratungsstelle Bremen-Mitte',
	only
}) => {
	const [choice, setChoice] = useState<ErstantwortNotifyChoiceValue | null>(
		initialChoice
	);
	const [emailDone, setEmailDone] = useState(initialEmailDone);
	const [browserDone, setBrowserDone] = useState(initialBrowserDone);
	const [consent, setConsent] = useState(() =>
		initialHandoverConsentState(consentMode)
	);

	const needsEmail = choice === 'EMAIL' || choice === 'BOTH';
	const needsBrowser = choice === 'BROWSER' || choice === 'BOTH';
	/* „Beides" heißt nacheinander: die Browser-Nachricht wartet, bis die
	   E-Mail-Nachricht erledigt ist. Zwei offene Fragen gleichzeitig sind genau
	   die Textwand, die dieser Umbau loswerden soll. */
	const showBrowser = needsBrowser && (choice !== 'BOTH' || emailDone);
	const branchComplete =
		choice !== null &&
		(!needsEmail || emailDone) &&
		(!needsBrowser || browserDone);

	const visible: FlowMessageId[] = ['erfolg', 'auswahl'];
	if (needsEmail) visible.push('email');
	if (showBrowser) visible.push('browser');
	if (branchComplete) visible.push('schluessel');
	if (agencyAccepted) visible.push('einwilligung');

	const shown = only ? visible.filter((id) => only.includes(id)) : visible;

	/*
	 * **Die Stelle, an der jetzt etwas zu tun ist.** Genau eine, immer die
	 * unterste offene — das ist der Anker, zu dem nach jeder Antwort weich
	 * gesprungen wird (Franks fünfte Ansage vom 07.09.).
	 *
	 * Sie wird aus demselben Zustand *abgeleitet*, aus dem auch die
	 * Sichtbarkeit folgt, und nicht getrennt gesetzt: ein zweiter Zustand
	 * „wohin springen wir" könnte auf eine Nachricht zeigen, die gar nicht
	 * mehr da ist, und die Kette spränge ins Leere.
	 */
	const openStep: FlowMessageId | null = !choice
		? 'auswahl'
		: needsEmail && !emailDone
			? 'email'
			: showBrowser && !browserDone
				? 'browser'
				: agencyAccepted
					? 'einwilligung'
					: branchComplete
						? 'schluessel'
						: null;

	const visibleOpenStep =
		openStep && shown.includes(openStep) ? openStep : null;
	const { register } = useAdvanceFocus(visibleOpenStep);

	const subtitles: Record<FlowMessageId, string> = {
		erfolg: flowText(ERSTANTWORT_SUBTITLES.enquirySent),
		auswahl: flowText(ERSTANTWORT_SUBTITLES.notificationChoice),
		email: flowText(ERSTANTWORT_SUBTITLES.emailAddress),
		browser: flowText(ERSTANTWORT_SUBTITLES.browserNotification),
		schluessel: flowText(ERSTANTWORT_SUBTITLES.recoveryKey),
		/* Modul 4 setzt seine Unterzeile selbst, abhängig von der Betriebsart —
		   hier steht nur, was die Live-Region ansagt. */
		einwilligung: 'Bitte einmal entscheiden'
	};

	const message = (
		id: FlowMessageId,
		subtitle: string,
		bausteine: ResolvedBaustein[],
		options: {
			slots?: Record<string, React.ReactNode>;
			onAction?: () => void;
		} = {}
	) => (
		<ErstantwortSequence
			subtitle={subtitle}
			bausteine={bausteine}
			slots={options.slots}
			onAction={options.onAction}
			skipAnimation
		/>
	);

	const render = (id: FlowMessageId) => {
		switch (id) {
			case 'erfolg':
				/*
				 * **Modul 1 enthält alles** (Frank, 07.09. abends): kurzer
				 * Gruß, quadratischer Bildplatz, und direkt dabei die häufigen
				 * Fragen — mit der roten Notruf-Zeile als letzter.
				 *
				 * Die Zusammenstellung steht in
				 * `ErstantwortSuccessMessage.tsx` und **nicht** hier, damit
				 * `Templates/Erstantwort-Module` und diese Kette dieselbe
				 * Nachricht zeigen und nicht zwei, die auseinanderdriften.
				 */
				return (
					<ErstantwortSuccessMessage
						showImage={showImage}
						dismissible={dismissible}
						translate={translate}
					/>
				);

			case 'auswahl':
				return message(
					id,
					subtitles.auswahl,
					[
						{
							id: 'notificationChoice',
							headline: 'Wie sollen wir Sie erreichen?',
							body: flowText(
								ERSTANTWORT_SHORTENED.notificationChoiceBody
							)
						}
					],
					{
						slots: {
							notificationChoice: (
								/*
								 * Die Auswahl-Nachricht bleibt im Verlauf
								 * stehen, also muss sie **ihren Ausgang zeigen**
								 * und nicht drei weiter drückbare Knöpfe: sonst
								 * lädt eine bereits beantwortete Nachricht zum
								 * Zurückwählen ein.
								 *
								 * Frank hat das am 07.09. abends bestätigt —
								 * unter der Bedingung, dass danach weich zur
								 * nächsten offenen Stelle gesprungen wird. Ohne
								 * dieses Springen ist der Ausgang statt der
								 * Knöpfe eine Sackgasse; mit ihm ist er der
								 * ruhigere Weg.
								 */
								<ErstantwortNotifyChoice
									isEmailOpen={!emailDone}
									browserState={
										browserDone ? 'granted' : browserState
									}
									onChoose={setChoice}
									translate={translate}
								/>
							)
						}
					}
				);

			case 'email':
				return message(
					id,
					subtitles.email,
					[erstantwortEmailBranchBaustein(emailDone)],
					{ onAction: () => setEmailDone(true) }
				);

			case 'browser':
				return message(
					id,
					subtitles.browser,
					[erstantwortBrowserBranchBaustein()],
					{
						slots: {
							browserNotification: (
								<ErstantwortBrowserPermission
									state={
										browserDone ? 'granted' : browserState
									}
									onAllow={() => setBrowserDone(true)}
									translate={translate}
								/>
							)
						}
					}
				);

			case 'schluessel':
				return message(
					id,
					subtitles.schluessel,
					[erstantwortRecoveryBaustein('notSecured')],
					{
						onAction: () => undefined,
						slots: {
							recoveryKey: (
								<ErstantwortRecoveryCard
									state="notSecured"
									steps={ERSTANTWORT_RECOVERY_STEPS}
									initialStep={1}
								/>
							)
						}
					}
				);

			case 'einwilligung':
				/*
				 * **Modul 4, und es ist kein Anhängsel.** Frank am 07.09.
				 * abends: „wo ist denn jetzt unsere Confirmation Opt-in,
				 * Opt-out Nachricht? Die hast du schon wieder irgendwie
				 * geschluckt." Sie war gebaut, lag aber auf einem anderen
				 * Zweig und damit in einem anderen Storybook — hier steht sie
				 * jetzt in der Kette, an ihrem Platz.
				 *
				 * Die Zeitmarke davor ist Pflicht, nicht Schmuck: die vier
				 * Nachrichten oben entstehen beim Absenden, diese erst bei der
				 * Annahme durch die Beratungsstelle. Ohne die Trennung liest
				 * sich die Kette als eine Zustellung, und die Person fragt
				 * sich, woher plötzlich eine Beratungsstelle kommt.
				 */
				return (
					<>
						<MessageDateDivider
							label={flowText(ERSTANTWORT_LATER_MARKER)}
						/>
						<HandoverConsentElement
							mode={consentMode}
							agencyName={agencyName}
							checked={consent}
							onChange={setConsent}
							imprintUrl="https://example.org/impressum"
							privacyUrl="https://example.org/datenschutz"
						/>
					</>
				);
		}
	};

	/* 24 px zwischen zwei Nachrichten: mehr als zwischen zwei Blasen derselben
	   Nachricht (die stapeln sich in `ErstantwortSequence` mit 8 px), damit man
	   ohne Erklärung sieht, dass hier eine neue Nachricht anfängt. */
	return (
		<div
			data-testid="erstantwort-ablauf"
			data-choice={choice ?? 'none'}
			data-open-step={visibleOpenStep ?? 'none'}
			style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
		>
			{shown.map((id) => (
				/*
				 * Der Sprungpunkt. `tabIndex={-1}` macht ihn programmatisch
				 * fokussierbar, ohne ihn in die Tab-Reihenfolge zu hängen —
				 * ein zusätzlicher Tab-Halt je Nachricht wäre für jemanden mit
				 * Tastatur eine Verschlechterung, keine Hilfe.
				 */
				<div
					key={id}
					ref={register(id)}
					tabIndex={-1}
					data-testid={`flow-message-${id}`}
					style={{ outlineOffset: 4 }}
				>
					{render(id)}
				</div>
			))}

			{/*
			 * Die Ansage für Screenreader. Sie steht **dauerhaft** im DOM und
			 * bekommt nur neuen Inhalt: eine frisch montierte Live-Region sagt
			 * in den meisten Screenreadern gar nichts an, weshalb das
			 * `aria-live` in `ErstantwortSequence` allein die neue Nachricht
			 * nicht meldet.
			 */}
			<div
				role="status"
				aria-live="polite"
				data-testid="flow-announcement"
				style={{
					position: 'absolute',
					width: 1,
					height: 1,
					margin: -1,
					padding: 0,
					overflow: 'hidden',
					clip: 'rect(0 0 0 0)',
					whiteSpace: 'nowrap',
					border: 0
				}}
			>
				{visibleOpenStep
					? advanceAnnouncement(subtitles[visibleOpenStep])
					: ''}
			</div>
		</div>
	);
};

/**
 * # Der Ablauf — eine Nachricht löst die nächste aus
 *
 * **Vorschlag, nichts ist entschieden, nichts ist verdrahtet.** Begleitpapier:
 * `0 - Docs/VERDRAHTUNG-erstantwort-ablauf-2026-09-07.md`. Die Einzelmodule
 * bleiben daneben als eigene Stories bestehen (`(m1)`, `(m2)`, `(m3)`), damit
 * man sie einzeln weiterentwerfen kann — diese Datei fasst sie nicht an, sie
 * setzt sie zusammen.
 *
 * ## Was Frank am 07.09. dazu gesagt hat
 *
 * 1. **Jede Karte ist eine eigene Nachricht von Carimat**, „wie von einer
 *    anderen Person" — und liest sich als **ein vollständiger kurzer Text**,
 *    nicht als riesige Box, die einen erschlägt. Deshalb steht hier je Schritt
 *    ein **eigener** `ErstantwortSequence`-Block mit eigenem Avatar, eigenem
 *    Namen und eigener Unterzeile, nicht eine Sequenz mit zehn Blasen.
 * 2. **Die Unterzeile unter „Carimat" ist ein Handlungsaufruf**, kein
 *    Dekortext. Heute steht dort in jeder Nachricht „Ihre ersten Schritte".
 *    Hier sagt sie pro Nachricht, was jetzt dran ist —
 *    `ERSTANTWORT_SUBTITLES` in `erstantwortFlowCopy.ts`, ein i18n-Schlüssel je
 *    Nachricht.
 * 3. **Der Ablauf ist verkettet und verzweigt.** Was nach der ersten Auswahl
 *    kommt, hängt von der Auswahl ab.
 *
 * ## Die Verzweigung
 *
 * ```
 * 1  Anfrage abgesendet  ──▶  2  Wie sollen wir Sie erreichen?
 *    (Gruß · Bildplatz ·          │
 *     häufige Fragen)             │
 *                    ┌────────────┼───────────────┐
 *                    ▼            ▼               ▼
 *                 E-Mail       Browser         beides
 *                    │            │          (nacheinander)
 *                    └────────────┴───────────────┘
 *                                 ▼
 *                      4  Ersatzschlüssel sichern
 *
 *      ── ── ── später: die Beratungsstelle nimmt an ── ── ──
 *
 *                                 ▼
 *                      5  Wer darf mitlesen? (Modul 4)
 * ```
 *
 * ## Was am 07.09. abends dazugekommen ist
 *
 * 4. **Modul 1 enthält alles** — kurzer Gruß, ein **quadratischer** Bildplatz,
 *    und direkt dabei die häufigen Fragen. Die letzte Frage („Was, wenn es
 *    nicht warten kann?") bleibt **zugeklappt**, aber in der **Primärfarbe**:
 *    Frank hat die Empfehlung, sie offen zu lassen, ausdrücklich verworfen.
 * 5. **Die Einwilligungsnachricht gehört sichtbar in die Kette** — als
 *    sechstes Glied, nach der Annahme durch die Beratungsstelle, mit einer
 *    Zeitmarke davor.
 * 6. **Sanftes Weiterspringen ist Pflicht.** Nach jeder Antwort scrollt die
 *    Ansicht weich zur nächsten Stelle, an der etwas zu tun ist, setzt dort den
 *    Fokus und meldet die neue Nachricht über eine Live-Region. Das ist die
 *    Bedingung, unter der Frank akzeptiert hat, dass eine beantwortete
 *    Nachricht ihren Ausgang statt ihrer Knöpfe zeigt — die `play`-Funktion
 *    unten belegt es, die Einzelheiten sind in
 *    `erstantwortAdvanceFocus.test.ts` gepinnt.
 *
 * „Beides" ist keine dritte Nachricht, sondern **beide nacheinander**: erst die
 * E-Mail-Nachricht, nach ihrer Erledigung die Browser-Nachricht, dann der
 * Ersatzschlüssel. So bleibt jede Nachricht kurz, und die Person beantwortet
 * nie zwei Dinge gleichzeitig.
 *
 * ## Was diese Story **nicht** ist
 *
 * Kein Vorgriff auf die Umsetzung. Die Kette lebt hier in einem
 * `useState` **in dieser Datei** — kein App-Pfad importiert sie, kein Katalog,
 * kein Resolver und kein Ereignis ist angefasst. Wer den Zustand in der
 * laufenden Anwendung halten müsste, wie eine Antwort die nächste Nachricht
 * auslöst, und warum das **eingefrorene Ereignis dabei unverändert bleibt**,
 * steht im Begleitpapier. Kurzfassung: die Kette ist Zustand zur Laufzeit, das
 * Ereignis ist ein Nachweis — die beiden treffen sich nicht.
 */
const meta = {
	title: 'Templates/Erstantwort-Ablauf',
	/*
	 * Die Zustandsmaschine ist die Komponente dieser Datei, nicht
	 * `ErstantwortSequence`: eine Story hier ist ein *Ablauf*, und ihre Args
	 * sind der Einstiegszustand dieses Ablaufs. Zeigte `component` auf die
	 * Sequenz, verlangte jede Story deren `bausteine` — also genau die Liste,
	 * die der Ablauf selbst zusammenstellt.
	 */
	component: FlowDemo,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	args: {}
} satisfies Meta<typeof FlowDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------------------------------------------------
   Die spielbare Ablauf-Story
   -------------------------------------------------------------------------- */

/**
 * **(flow) Ablauf — eine Nachricht löst die nächste aus.**
 *
 * Spielbar: unten in Nachricht 2 eine Option wählen, und die nächste Nachricht
 * erscheint. „Beides" bringt erst die E-Mail-Nachricht, nach deren Erledigung
 * die Browser-Nachricht, dann den Ersatzschlüssel.
 *
 * Die `play`-Funktion unten läuft als Component Test in CI mit: sie prüft, dass
 * vor der Wahl **keine** Zweig-Nachricht dasteht, wählt „Beides einrichten",
 * und belegt dann, dass die Kette Schritt für Schritt weiterläuft — nicht alles
 * auf einmal. Das ist die eine Zusicherung, die diese Datei selbst halten kann.
 */
export const Ablauf: Story = {
	name: '(flow) Ablauf — eine Nachricht löst die nächste aus',
	args: {},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		/* Vor der Wahl: zwei Nachrichten, keine Verzweigung, kein Schlüssel. */
		expect(canvas.getByTestId('flow-message-erfolg')).toBeTruthy();
		expect(canvas.getByTestId('flow-message-auswahl')).toBeTruthy();
		expect(canvas.queryByTestId('flow-message-email')).toBeNull();
		expect(canvas.queryByTestId('flow-message-browser')).toBeNull();
		expect(canvas.queryByTestId('flow-message-schluessel')).toBeNull();

		/* Die Knöpfe der Auswahl heißen teils wie die der Folgenachrichten —
		   das ist Absicht (dieselbe Handlung, einmal gewählt, einmal getan) und
		   deshalb wird hier auf die Auswahl-Nachricht eingegrenzt statt auf die
		   ganze Seite. */
		const auswahl = within(canvas.getByTestId('flow-message-auswahl'));
		await userEvent.click(
			auswahl.getByRole('button', { name: 'Beides einrichten' })
		);

		/* „Beides" heißt nacheinander: E-Mail zuerst, Browser noch nicht. */
		expect(canvas.getByTestId('flow-message-email')).toBeTruthy();
		expect(canvas.queryByTestId('flow-message-browser')).toBeNull();
		expect(canvas.queryByTestId('flow-message-schluessel')).toBeNull();

		/*
		 * **Franks fünfte Ansage, hier belegt statt zugesagt.** Nach der
		 * Antwort steht der Fokus auf der nächsten Stelle, an der etwas zu tun
		 * ist — nicht auf dem gedrückten Knopf, der gerade verschwunden ist,
		 * und nicht am Seitenanfang.
		 *
		 * Warum das der Beleg für den weichen Bildlauf ist, obwohl es Fokus
		 * prüft: beide kommen aus demselben Aufruf (`advanceFocusTo`), und der
		 * Bildlauf selbst ist im Test nicht beobachtbar — die Einzelheiten
		 * (`behavior: 'smooth'`, `block: 'center'`,
		 * `focus({ preventScroll: true })`, Rücksicht auf
		 * `prefers-reduced-motion`) sind in
		 * `erstantwortAdvanceFocus.test.ts` gepinnt.
		 */
		await waitFor(() =>
			expect(document.activeElement).toBe(
				canvas.getByTestId('flow-message-email')
			)
		);

		const email = within(canvas.getByTestId('flow-message-email'));
		await userEvent.click(
			email.getByRole('button', { name: 'E-Mail-Adresse eingeben' })
		);

		/* Jetzt erst die Browser-Nachricht — und immer noch kein Schlüssel. */
		expect(canvas.getByTestId('flow-message-browser')).toBeTruthy();
		expect(canvas.queryByTestId('flow-message-schluessel')).toBeNull();

		/* Und wieder: der Fokus ist mitgewandert. */
		await waitFor(() =>
			expect(document.activeElement).toBe(
				canvas.getByTestId('flow-message-browser')
			)
		);

		const browser = within(canvas.getByTestId('flow-message-browser'));
		await userEvent.click(
			browser.getByRole('button', { name: 'Benachrichtigungen erlauben' })
		);

		/* Beide Zweige erledigt → die letzte Nachricht der Kette, und der
		   Fokus steht auf ihr. */
		expect(canvas.getByTestId('flow-message-schluessel')).toBeTruthy();
		await waitFor(() =>
			expect(document.activeElement).toBe(
				canvas.getByTestId('flow-message-schluessel')
			)
		);

		/* Die Live-Region meldet dieselbe Stelle, damit ein Screenreader nicht
		   raten muss, was gerade passiert ist. */
		expect(canvas.getByTestId('flow-announcement').textContent).toContain(
			'Sichern Sie Ihren Ersatzschlüssel'
		);
	}
};

/* --------------------------------------------------------------------------
   Die einzelnen Nachrichten — je eine für den Screenshot
   -------------------------------------------------------------------------- */

/**
 * **(flow-1) Nachricht 1 — Anfrage abgesendet.** Unterzeile
 * „Hervorragend, Anfrage abgesendet" (Franks eigenes Beispiel).
 *
 * Drei Blasen: die Ankunftsbestätigung, das Akkordeon mit fünf Fragen, und die
 * Notfallnummern **offen** — `(m1-b)` ist seit 07.09. der Standard.
 */
export const Flow1Erfolg: Story = {
	name: '(flow-1) Nachricht 1 — Anfrage abgesendet',
	globals: phone390Globals,
	args: { only: ['erfolg'] }
};

/**
 * **(flow-1-ohne-bild) Nachricht 1 ohne den Bildplatz.** Dieselbe Nachricht,
 * nur ohne die reservierte Fläche — die Vergleichsaufnahme für die Höhe.
 *
 * Die Messung steht im Verdrahtungspapier; hier nur die Regel, die sie
 * begründet: der quadratische Platz kostet auf dem Telefon so viel Höhe wie
 * seine Breite, weil er quadratisch **ist**. Wer ihn schmaler macht, macht ihn
 * auch niedriger — das ist der einzige Hebel, und er heißt `size`.
 */
export const Flow1ErfolgOhneBild: Story = {
	name: '(flow-1-ohne-bild) Nachricht 1 — ohne Bildplatz',
	globals: phone390Globals,
	args: { only: ['erfolg'], showImage: false }
};

/**
 * **(flow-1-nicht-wieder) Nachricht 1 mit „nicht wieder anzeigen".**
 *
 * Franks dritte Ansage vom 07.09. abends. Das Kästchen sitzt unter den Fragen;
 * angehakt klappt der Block zusammen und hinterlässt die Zeile, die ihn
 * zurückholt.
 *
 * **Was daran keine Darstellung ist:** dieser Zustand braucht einen eigenen
 * Auslöser und einen **gespeicherten** Zustand, und ADR-018 §4 verbietet neuen
 * Baustein-Zustand im Ereignis. Wo er stattdessen leben müsste, steht im
 * Verdrahtungspapier §14 — es ist die einzige Position dieses Abends, die nicht
 * allein im Frontend zu haben ist.
 */
export const Flow1NichtWiederAnzeigen: Story = {
	name: '(flow-1-nicht-wieder) Nachricht 1 — „nicht wieder anzeigen"',
	globals: phone390Globals,
	args: { only: ['erfolg'], dismissible: true }
};

/**
 * **(flow-2) Nachricht 2 — die Auswahl.** Unterzeile „Wählen Sie eine Option
 * aus" (Franks zweites Beispiel).
 *
 * Drei Auswahlfelder mit je einem führenden Symbol aus der vorhandenen
 * Icon-Bibliothek: Umschlag, Glocke, Geräte. Die Beschriftungen benennen, was
 * passiert — „Benachrichtigungen des Browsers aktivieren" statt „Geben Sie mir
 * hier ein Signal", wie es heute im Katalog steht.
 */
export const Flow2Auswahl: Story = {
	name: '(flow-2) Nachricht 2 — Auswahl',
	globals: phone390Globals,
	args: { only: ['auswahl'] }
};

/**
 * **(flow-3a) Zweig E-Mail.** Was nach „E-Mail-Adresse hinterlegen" kommt:
 * eine eigene, kurze Nachricht, die nach der Adresse fragt. Unterzeile
 * „Geben Sie Ihre E-Mail-Adresse ein".
 */
export const Flow3aEmail: Story = {
	name: '(flow-3a) Zweig E-Mail',
	globals: phone390Globals,
	args: { initialChoice: 'EMAIL', only: ['email'] }
};

/**
 * **(flow-3b) Zweig Browser-Benachrichtigung.** Unterzeile „Erlauben Sie die
 * Benachrichtigung im Browser".
 *
 * Die Nachricht sagt **vorher**, was gleich passiert. Das ist kein Stilwunsch:
 * ein reflexhaftes „Blockieren" im Browserdialog ist ohne Zutun der Person
 * nicht mehr umkehrbar, deshalb erscheint der Dialog nur nach einem
 * ausdrücklichen Tippen — und die Person weiß, worauf sie tippt.
 */
export const Flow3bBrowser: Story = {
	name: '(flow-3b) Zweig Browser-Benachrichtigung',
	globals: phone390Globals,
	args: { initialChoice: 'BROWSER', only: ['browser'] }
};

/**
 * **(flow-4) Nachricht 4 — Ersatzschlüssel.** Die letzte Nachricht der Kette,
 * unabhängig davon, welcher Zweig davor lief. Unterzeile
 * **„Sichern Sie Ihren Ersatzschlüssel"** — der Vorschlag für Modul 3.
 *
 * Warum diese Zeile: sie nennt die Handlung („sichern") und das Ding beim
 * vereinbarten Namen („Ersatzschlüssel", Vokabel-Entscheidung 14.08.2026).
 * Nicht „Ihre Sicherheit", nicht „Wichtiger Hinweis" — beides sagt nicht, was
 * jetzt dran ist.
 */
export const Flow4Schluessel: Story = {
	name: '(flow-4) Nachricht 4 — Ersatzschlüssel',
	globals: phone390Globals,
	args: {
		initialChoice: 'EMAIL',
		initialEmailDone: true,
		only: ['schluessel']
	}
};

/**
 * **(flow-5) Nach der Annahme — die Einwilligungsnachricht (Modul 4).**
 *
 * Das **sechste Kettenglied**, und das einzige mit einem **eigenen Auslöser**:
 * die fünf davor entstehen in der Sekunde, in der die Anfrage abgesendet wird,
 * diese erst, wenn eine Beratungsstelle sie **angenommen** hat. Deshalb steht
 * darüber die Zeitmarke, und deshalb ist `agencyAccepted` eine eigene Fahne und
 * keine Ableitung aus dem Zustand der Kette.
 *
 * Gezeigt ist Betriebsart 1 (Opt-in): der Schalter startet **aus**, die Person
 * schaltet ihn ein, wenn sie einverstanden ist, künftig nicht mehr gefragt zu
 * werden. Das ist die einzige der drei Betriebsarten, die es im Produkt heute
 * wirklich gibt.
 *
 * Der ehrliche Absatz über dem Schalter ist nicht kürzbar: nach ADR-002 haben
 * alle Beratenden der Beratungsstelle **technisch** Zugang, und der Schalter
 * regelt das bewusste, protokollierte Mitlesen — nicht die Möglichkeit dazu.
 * Ohne diesen Satz liest sich der Schalter als ein Versprechen technischer
 * Geheimhaltung, das die Plattform nicht halten kann.
 */
export const Flow5Einwilligung: Story = {
	name: '(flow-5) Nach der Annahme — Einwilligung',
	globals: phone390Globals,
	args: {
		agencyAccepted: true,
		only: ['einwilligung']
	}
};

/**
 * **(flow-5-optout) Dieselbe Nachricht in Betriebsart 2.** Der Schalter startet
 * **an**; die Person schaltet ihn aus, wenn sie jedes Mal gefragt werden will.
 *
 * Beschriftung und Satzpaar sind identisch mit Betriebsart 1 — der Modus
 * entscheidet **ausschließlich die Vorbelegung**. Zwei verschiedene Texte wären
 * eine erfundene Unterscheidung; die Begründung steht in
 * `VERDRAHTUNG-modul4-handover-consent-2026-09-07.md` §N1.
 *
 * **Nicht verfügbar:** Betriebsart 2 existiert im Produkt nicht. Es gibt kein
 * Feld, keinen Endpunkt und keinen Produzenten, und der Admin-Schalter ist ein
 * deaktivierter Platzhalter (§N2b/N2e).
 */
export const Flow5EinwilligungOptOut: Story = {
	name: '(flow-5-optout) Nach der Annahme — Opt-out',
	globals: phone390Globals,
	args: {
		agencyAccepted: true,
		consentMode: 'OPT_OUT',
		only: ['einwilligung']
	}
};

/**
 * **(flow) Der ganze Ablauf, Zweig „beides".** Alle fünf Nachrichten des
 * Absendens untereinander, so wie die Person sie im Verlauf stehen sieht: beide
 * Kanäle eingerichtet, beide Zweig-Nachrichten in ihrem Erledigt-Zustand
 * (Knopf weg, ein Satz da), darunter der Ersatzschlüssel. **Ohne** die
 * Einwilligung — die kommt erst mit der Annahme.
 *
 * Hier ist zu prüfen, was Frank mit „nicht eine riesige Box" meint: fünf kurze
 * Nachrichten mit fünf verschiedenen Handlungsaufrufen statt einer Blasenwand
 * mit einer Unterzeile.
 */
export const FlowGesamt: Story = {
	name: '(flow) Gesamter Ablauf — Zweig „beides"',
	globals: phone390Globals,
	args: {
		initialChoice: 'BOTH',
		initialEmailDone: true,
		initialBrowserDone: true
	}
};

/**
 * **(flow) Die volle Strecke, inklusive Einwilligung.**
 *
 * Alle sechs Nachrichten untereinander: die fünf vom Absenden, dann die
 * Zeitmarke, dann Modul 4. So sieht der Verlauf aus, nachdem eine
 * Beratungsstelle angenommen hat.
 *
 * Die Zeitmarke ist die einzige Stelle, an der diese Story etwas behauptet, was
 * die anderen nicht behaupten: dass zwischen Nachricht 5 und Nachricht 6 Zeit
 * vergeht. Sie benutzt dafür die vorhandene Zeitleiste des Verlaufs
 * (`MessageDateDivider`, Figma 7539-29134) und kein eigenes Trennelement — die
 * Kette soll aussehen wie der Verlauf, in dem sie steht.
 */
export const FlowGesamtMitEinwilligung: Story = {
	name: '(flow) Gesamter Ablauf — mit Einwilligung',
	globals: phone390Globals,
	args: {
		initialChoice: 'BOTH',
		initialEmailDone: true,
		initialBrowserDone: true,
		agencyAccepted: true
	}
};

/* --------------------------------------------------------------------------
   Desktop
   -------------------------------------------------------------------------- */

/** **(flow-1-1440)** — dieselbe Nachricht 1 auf dem Desktop. */
export const Flow1Desktop1440: Story = {
	name: '(flow-1-1440) Nachricht 1 — Desktop',
	globals: desktop1440Globals,
	args: { only: ['erfolg'] }
};

/** **(flow-2-1440)** — die Auswahl auf dem Desktop. */
export const Flow2Desktop1440: Story = {
	name: '(flow-2-1440) Auswahl — Desktop',
	globals: desktop1440Globals,
	args: { only: ['auswahl'] }
};
