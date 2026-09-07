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
import { expect, userEvent, within } from 'storybook/test';

import { ErstantwortSequence } from './ErstantwortSequence';
import { ErstantwortFaqGroup } from './ErstantwortFaqGroup';
import {
	ErstantwortNotifyChoice,
	type ErstantwortNotifyBrowserState,
	type ErstantwortNotifyChoiceValue
} from './ErstantwortNotifyChoice';
import { ErstantwortBrowserPermission } from './ErstantwortBrowserPermission';
import { ErstantwortRecoveryCard } from './ErstantwortRecoveryCard';
import { resolveErstantwortBausteine } from './erstantwortResolve';
import type { ResolvedBaustein } from './erstantwortResolve';
import { UNTOGGLEABLE_BAUSTEIN_IDS } from './erstantwortCatalogue';
import { ERSTANTWORT_MODUL1_FAQ_ROW_IDS } from './erstantwortFaqQuestions';
import {
	ERSTANTWORT_RECOVERY_STEPS,
	erstantwortRecoveryBaustein
} from './erstantwortRecoveryCopy';
import {
	ERSTANTWORT_SHORTENED,
	ERSTANTWORT_SUBTITLES,
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

/** Nichts erledigt: keine E-Mail, 2FA angeboten aber nicht eingeschaltet. */
const OPEN_STATE = {
	hasEmail: false,
	isTwoFactorEnabled: true,
	isTwoFactorActive: false
};

/**
 * Einmal aus dem **ausgelieferten** Katalog aufgelöst, wie in den
 * Modul-Stories. Kein Text unten ist nachgetippt; was hier steht, steht so im
 * Produkt — mit Ausnahme der zwei ausdrücklich gekürzten Stellen
 * (`ERSTANTWORT_SHORTENED`) und der zwei Zweig-Nachrichten, die es im Katalog
 * noch nicht gibt.
 */
const SHIPPED_SEQUENCE: ResolvedBaustein[] = resolveErstantwortBausteine({
	trigger: 'AFTER_FIRST_MESSAGE',
	context: { conversationType: 'AGENCY_COUNSELLING' },
	translate,
	state: OPEN_STATE
}).bausteine;

const byId = (id: string): ResolvedBaustein | undefined =>
	SHIPPED_SEQUENCE.find((baustein) => baustein.id === id);

const pick = (...ids: readonly string[]): ResolvedBaustein[] =>
	ids
		.map(byId)
		.filter((baustein): baustein is ResolvedBaustein => Boolean(baustein));

/* --------------------------------------------------------------------------
   Nachricht 1 — Anfrage abgesendet  (Modul 1 in der Fassung (m1-b))
   -------------------------------------------------------------------------- */

const greetingShort = (): ResolvedBaustein[] => {
	const greeting = byId('greeting');
	return greeting
		? [{ ...greeting, body: flowText(ERSTANTWORT_SHORTENED.greeting) }]
		: [];
};

/** Die FAQ-Blase — kein Katalog-Baustein, sondern ein Layout-Container. */
const FAQ_BUBBLE: ResolvedBaustein = {
	id: 'faq',
	headline: 'Häufige Fragen',
	body: ''
};

/**
 * **Entschieden am 07.09.2026: die Notfallnummern bleiben offen.**
 *
 * Die Fassung `(m1-b)` ist damit der Standard für Modul 1, und der Ablauf
 * benutzt nur noch sie. Die Zeile, die man sucht, wenn man sie braucht, darf
 * nicht die Zeile sein, die man erst öffnen muss.
 *
 * ADR-018 §6 bleibt dabei zweifach erfüllt: `emergencyNumbers` steht als offene
 * Blase in der Nachricht **und** vor jeder optionalen Aktion — die
 * Benachrichtigungs-Auswahl ist erst die nächste Nachricht.
 */
const FAQ_ROW_IDS = ERSTANTWORT_MODUL1_FAQ_ROW_IDS.filter(
	(id) => id !== 'emergencyNumbers'
);

/* ADR-018 §6, mechanisch geprüft statt zugesagt: `noPersonalData` muss in der
   FAQ stehen, `emergencyNumbers` als offene Blase daneben. Wer einen der beiden
   still aus dem Ablauf nimmt, bekommt hier einen Fehler, statt eine Sequenz
   auszuliefern, der ein Sicherheitstext fehlt. */
const missingSafetyRow = UNTOGGLEABLE_BAUSTEIN_IDS.find(
	(id) => id !== 'emergencyNumbers' && !FAQ_ROW_IDS.includes(id)
);
if (missingSafetyRow) {
	throw new Error(
		`Ablauf: safety Baustein "${missingSafetyRow}" is missing from the FAQ ` +
			'rows (ADR-018 §6 — it may be folded, never dropped).'
	);
}

/* --------------------------------------------------------------------------
   Die Kette
   -------------------------------------------------------------------------- */

type FlowMessageId =
	| 'erfolg'
	| 'auswahl'
	| 'email'
	| 'browser'
	| 'schluessel';

interface FlowDemoProps {
	/** Vorbelegte Auswahl — für die Zweig-Stories und die Screenshots. */
	initialChoice?: ErstantwortNotifyChoiceValue | null;
	initialEmailDone?: boolean;
	initialBrowserDone?: boolean;
	/** Was der Browser gerade kann. In Storybook gesetzt, nie gelesen. */
	browserState?: ErstantwortNotifyBrowserState;
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
	only
}) => {
	const [choice, setChoice] = useState<ErstantwortNotifyChoiceValue | null>(
		initialChoice
	);
	const [emailDone, setEmailDone] = useState(initialEmailDone);
	const [browserDone, setBrowserDone] = useState(initialBrowserDone);

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

	const shown = only ? visible.filter((id) => only.includes(id)) : visible;

	const message = (
		id: FlowMessageId,
		subtitle: string,
		bausteine: ResolvedBaustein[],
		options: {
			slots?: Record<string, React.ReactNode>;
			onAction?: () => void;
		} = {}
	) => (
		<div key={id} data-testid={`flow-message-${id}`}>
			<ErstantwortSequence
				subtitle={subtitle}
				bausteine={bausteine}
				slots={options.slots}
				onAction={options.onAction}
				skipAnimation
			/>
		</div>
	);

	const render = (id: FlowMessageId) => {
		switch (id) {
			case 'erfolg':
				return message(
					id,
					flowText(ERSTANTWORT_SUBTITLES.enquirySent),
					[
						...greetingShort(),
						FAQ_BUBBLE,
						...pick('emergencyNumbers')
					],
					{
						slots: {
							faq: (
								<ErstantwortFaqGroup
									bausteine={pick(...FAQ_ROW_IDS)}
									translate={translate}
								/>
							)
						}
					}
				);

			case 'auswahl':
				return message(
					id,
					flowText(ERSTANTWORT_SUBTITLES.notificationChoice),
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
								 * Dafür ist kein neuer Zustand nötig — das
								 * Molekül kann das seit Modul 2: ohne offene
								 * E-Mail verliert die Option ihren Knopf und
								 * behält ihren Text, `granted` meldet die
								 * erteilte Erlaubnis, und die Kombination fällt
								 * weg, sobald eine Hälfte erledigt ist.
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
					flowText(ERSTANTWORT_SUBTITLES.emailAddress),
					[erstantwortEmailBranchBaustein(emailDone)],
					{ onAction: () => setEmailDone(true) }
				);

			case 'browser':
				return message(
					id,
					flowText(ERSTANTWORT_SUBTITLES.browserNotification),
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
					flowText(ERSTANTWORT_SUBTITLES.recoveryKey),
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
		}
	};

	/* 24 px zwischen zwei Nachrichten: mehr als zwischen zwei Blasen derselben
	   Nachricht (die stapeln sich in `ErstantwortSequence` mit 8 px), damit man
	   ohne Erklärung sieht, dass hier eine neue Nachricht anfängt. */
	return (
		<div
			data-testid="erstantwort-ablauf"
			data-choice={choice ?? 'none'}
			style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
		>
			{shown.map(render)}
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
 *                                   │
 *                    ┌──────────────┼───────────────┐
 *                    ▼              ▼               ▼
 *                 E-Mail        Browser          beides
 *                    │              │            (nacheinander)
 *                    └──────────────┴───────────────┘
 *                                   ▼
 *                        4  Ersatzschlüssel sichern
 * ```
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

		const email = within(canvas.getByTestId('flow-message-email'));
		await userEvent.click(
			email.getByRole('button', { name: 'E-Mail-Adresse eingeben' })
		);

		/* Jetzt erst die Browser-Nachricht — und immer noch kein Schlüssel. */
		expect(canvas.getByTestId('flow-message-browser')).toBeTruthy();
		expect(canvas.queryByTestId('flow-message-schluessel')).toBeNull();

		const browser = within(canvas.getByTestId('flow-message-browser'));
		await userEvent.click(
			browser.getByRole('button', { name: 'Benachrichtigungen erlauben' })
		);

		/* Beide Zweige erledigt → die letzte Nachricht der Kette. */
		expect(canvas.getByTestId('flow-message-schluessel')).toBeTruthy();
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
 * **(flow) Der ganze Ablauf, Zweig „beides".** Alle fünf Nachrichten
 * untereinander, so wie die Person sie am Ende im Verlauf stehen sieht: beide
 * Kanäle eingerichtet, beide Zweig-Nachrichten in ihrem Erledigt-Zustand
 * (Knopf weg, ein Satz da), darunter der Ersatzschlüssel.
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
