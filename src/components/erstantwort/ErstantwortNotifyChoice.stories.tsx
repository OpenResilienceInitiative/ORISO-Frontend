import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { ErstantwortNotifyChoice } from './ErstantwortNotifyChoice';
import {
	ERSTANTWORT_PAYLOAD_VERSION,
	SYSTEM_NOTIFICATION_FIRST_RESPONSE
} from './erstantwortPayload';
import {
	resolveErstantwortBausteine,
	type ErstantwortLiveState
} from './erstantwortResolve';
import { bausteinById } from './erstantwortCatalogue';
import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';
import { ERSTANTWORT_SHORTENED, flowText } from './erstantwortFlowCopy';
import { phone390Globals } from '../message/messageStoryShell';
import '../pseudonym/PseudonymCard.styles.scss';
import './ErstantwortSequence.styles.scss';

/**
 * **Modul 2 als eigener Baustein** — die Auswahl „Wie sollen wir Sie
 * erreichen?", herausgelöst aus der Bühne.
 *
 * Bis heute war dieses Molekül nur über `Templates/Erstantwort-Module`
 * erreichbar: sechs echte Zustände, versteckt zwischen 49 Stories in einem
 * einzigen Seitenleisten-Eintrag
 * (`0 - Docs/INVENTAR-bausteine-chat-2026-09-07.md`, §4.1, P1). Es ist zugleich
 * der einzige Erstantwort-Organismus mit eigenem Unit-Test
 * (`ErstantwortNotifyChoice.test.tsx`) — und hatte trotzdem keine eigene Story.
 *
 * <h3>Was hier geprüft wird und was nicht</h3>
 *
 * Der Zustand des Browsers kommt per Prop herein, weil Storybook keine echte
 * Notification-Berechtigung hat. Alles andere ist **gerechnet**: „E-Mail schon
 * hinterlegt" und „Träger hat abgeschaltet" laufen durch den ausgelieferten
 * `resolveErstantwortBausteine`, nicht durch ein gesetztes Flag. Eine Story,
 * die `isEmailOpen={false}` einfach hinschreibt, belegt die Darstellung; eine,
 * die den Resolver laufen lässt, belegt die Regel.
 *
 * <h3>Die zwei Regeln, die jede `play`-Funktion hier hütet</h3>
 *
 * 1. **`blocked` bekommt nie einen Knopf.** `Notification.requestPermission()`
 *    löst auf einer abgelehnten Herkunft sofort mit `denied` auf und zeigt gar
 *    keinen Dialog. Ein Knopf wäre das eine, was diese Kette nie tun darf:
 *    aktiv aussehen und nichts tun.
 * 2. **Die Kombination gibt es nur, solange beide Hälften offen sind.**
 *    „Beides" neben einer bereits hinterlegten Adresse wäre ein Knopf, der eine
 *    Hälfte von nichts täte.
 */
const meta = {
	title: 'Erstantwort/Organisms/NotifyChoice',
	component: ErstantwortNotifyChoice,
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
	args: {
		isEmailOpen: true,
		browserState: 'available',
		onChoose: () => undefined
	}
} satisfies Meta<typeof ErstantwortNotifyChoice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Storybook has no i18n catalogue for these keys yet — fall back to German. */
const translate = (_key: string, defaultValue?: string) => defaultValue ?? '';

const emailNotificationEntry = bausteinById('emailNotification');
const notificationChoiceEntry = bausteinById('notificationChoice');

/**
 * The same synthetic `FIRST_RESPONSE` event `Templates/Erstantwort-Module/2
 * Benachrichtigung` builds, kept identical on purpose: if the two ever drift,
 * the Baustein view and the module view would disagree about the same rule.
 */
const MODUL_2_BAUSTEIN = {
	id: 'emailNotification',
	headline: notificationChoiceEntry?.defaultHeadline,
	body: flowText(ERSTANTWORT_SHORTENED.notificationChoiceBody),
	action: {
		kind: 'ADD_EMAIL',
		label: emailNotificationEntry?.action?.defaultLabel
	}
};

const modul2Event = () =>
	`${SYSTEM_NOTIFICATION_PREFIX}${JSON.stringify({
		type: SYSTEM_NOTIFICATION_FIRST_RESPONSE,
		version: ERSTANTWORT_PAYLOAD_VERSION,
		bausteine: [MODUL_2_BAUSTEIN]
	})}`;

const OPEN_STATE: ErstantwortLiveState = {
	hasEmail: false,
	isTwoFactorEnabled: true,
	isTwoFactorActive: false
};

/** Runs the shipped resolver and reports what survived. */
const resolved = (state: ErstantwortLiveState) => {
	const { bausteine } = resolveErstantwortBausteine({
		rawMessage: modul2Event(),
		translate,
		state
	});
	const baustein = bausteine.find(
		(entry) => entry.id === 'emailNotification'
	);
	return {
		survived: Boolean(baustein),
		isEmailOpen: Boolean(baustein?.action)
	};
};

/** Convenience for the assertions: the option rows carry `data-channel`. */
const option = (canvasElement: HTMLElement, channel: string) =>
	canvasElement.querySelector<HTMLElement>(`[data-channel="${channel}"]`);

/* --------------------------------------------------------------------------
   Grundzustand
   -------------------------------------------------------------------------- */

/**
 * **Grundzustand — beide Kanäle offen.** Zwei gleichwertige Optionen mit je
 * einem Knopf, darunter die empfohlene Kombination.
 *
 * Gleichwertig heißt hier gleich **gebaut**: Beschriftung, ein ehrlicher
 * Hinweis, ein Knopf. Der Hinweis am Browser-Signal nennt seine Grenze selbst
 * („nur auf diesem Gerät und in diesem Browser"), damit die Wahl informiert ist
 * und nicht bereut wird.
 *
 * Die Empfehlung ist eine **dritte Zeile, kein vorausgewählter Haken**: ein
 * Häkchen, das schon gesetzt ist, ist keine Einwilligung — eine Empfehlung, die
 * man drücken muss, ist eine.
 */
export const Grundzustand: Story = {
	name: 'Grundzustand — beide Kanäle offen',
	globals: phone390Globals,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		/* Drei Optionen, drei Knöpfe — das ist die Zusicherung dieser Story. */
		expect(canvasElement.querySelectorAll('[data-channel]').length).toBe(3);
		expect(canvas.getAllByRole('button')).toHaveLength(3);

		/* Und nur die Kombination trägt das Empfohlen-Abzeichen. */
		const both = option(canvasElement, 'both');
		expect(both).not.toBeNull();
		expect(both).toHaveTextContent('Empfohlen');
		expect(option(canvasElement, 'email')).not.toHaveTextContent(
			'Empfohlen'
		);
	}
};

/* --------------------------------------------------------------------------
   Zustände der E-Mail
   -------------------------------------------------------------------------- */

/**
 * **E-Mail schon hinterlegt.** `hasEmail: true` → der ausgelieferte
 * `isActionStillOpen` nimmt dem Baustein die Aktion, und die Option zeigt
 * statt des Knopfs, was gilt.
 *
 * **Der Text bleibt, die Aktion verschwindet.** Das ist keine Kosmetik: der
 * Wortlaut ist der Nachweis, dass die Person informiert wurde, und darf auch
 * nachträglich nicht aus dem Verlauf verschwinden (ADR-018 §4).
 *
 * Die Kombinationszeile fällt mit weg. Übrig bleibt genau **eine** offene
 * Entscheidung — und genau das prüft die `play`-Funktion.
 */
export const EmailBereitsHinterlegt: Story = {
	name: 'E-Mail schon hinterlegt',
	globals: phone390Globals,
	args: {
		isEmailOpen: resolved({ ...OPEN_STATE, hasEmail: true }).isEmailOpen
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		/* Der Resolver, nicht die Story, hat den Knopf entfernt. */
		expect(resolved({ ...OPEN_STATE, hasEmail: true }).isEmailOpen).toBe(
			false
		);

		const email = option(canvasElement, 'email');
		expect(email).not.toBeNull();
		expect(within(email as HTMLElement).queryByRole('button')).toBeNull();
		expect(email).toHaveTextContent('hinterlegt');

		/* Keine Kombination mehr, und damit genau ein Knopf im ganzen Molekül. */
		expect(option(canvasElement, 'both')).toBeNull();
		expect(canvas.getAllByRole('button')).toHaveLength(1);
	}
};

/**
 * **Träger hat die E-Mail-Benachrichtigung abgeschaltet.**
 *
 * Das ist der Zustand, den dieses Molekül **nicht selbst darstellen kann** —
 * und die Story sagt das, statt eine Darstellung zu erfinden. ORISO-Admin#602,
 * Schalter 2: `isAskerEmailEnabled: false` → `isBausteinSilenced` entfernt den
 * **ganzen** Baustein, nicht nur seinen Knopf. Es gibt hier also nichts zu
 * rendern, und die `play`-Funktion prüft genau diese Abwesenheit.
 *
 * **Der Preis dieser Bündelung ist echt:** solange E-Mail und Browser-Signal in
 * *einem* Baustein stehen, nimmt der E-Mail-Schalter dem Ratsuchenden auch das
 * Browser-Signal weg. Offene Produktfrage, keine getroffene Entscheidung.
 *
 * Heute ist der Schalter ohnehin wirkungslos: `featureAskerEmailEnabled` wird
 * in `ORISO-Frontend/src` nirgends gelesen. Diese Story zeigt, was passieren
 * *würde*.
 */
export const TraegerHatAbgeschaltet: Story = {
	name: 'Träger hat E-Mail abgeschaltet — der Baustein fällt ganz weg',
	globals: phone390Globals,
	render: (args) => {
		const { survived, isEmailOpen } = resolved({
			...OPEN_STATE,
			isAskerEmailEnabled: false
		});
		return survived ? (
			<ErstantwortNotifyChoice {...args} isEmailOpen={isEmailOpen} />
		) : (
			/* Story-Gerüst, kein Produkt-UI: ohne den gestrichelten Rahmen wäre
			   „der Baustein ist weg" von einem kaputten Screenshot nicht zu
			   unterscheiden. Im Produkt steht hier nichts, auch kein Abstand. */
			<div
				data-testid="erstantwort-notify-silenced"
				style={{
					border: '1px dashed var(--m3-outline, #74777a)',
					borderRadius: '12px',
					padding: '16px',
					color: 'var(--m3-on-surface, #1a1c1e)',
					fontSize: '13px',
					lineHeight: 1.5
				}}
			>
				Hier stünde Modul 2. <code>isBausteinSilenced</code> hat den
				ganzen Baustein entfernt, weil der Träger die
				E-Mail-Benachrichtigung abgeschaltet hat.
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		/* Die Zusicherung: der Resolver hat den Baustein wirklich entfernt … */
		expect(
			resolved({ ...OPEN_STATE, isAskerEmailEnabled: false }).survived
		).toBe(false);
		/* … und deshalb ist das Molekül nicht im Baum. */
		expect(canvas.queryByTestId('erstantwort-notify-choice')).toBeNull();
		expect(
			canvas.getByTestId('erstantwort-notify-silenced')
		).toBeInTheDocument();
	}
};

/* --------------------------------------------------------------------------
   Zustände des Browsers
   -------------------------------------------------------------------------- */

/**
 * **Browser unterstützt Benachrichtigungen nicht.** `isSupported()` ist falsch
 * — es gibt keine Notification-API. Die Option wird **ganz entfernt**, nicht
 * deaktiviert erklärt: hier kann die Person nichts tun, und die Erklärung einer
 * Unmöglichkeit ist Lärm in einer Nachricht, die jemand direkt nach etwas
 * Schwerem liest.
 *
 * Die einzige Stelle, an der die Hausregel „disable statt hide" bewusst nicht
 * gilt: dort geht es um Berechtigungen im Produkt, hier um eine Fähigkeit des
 * Geräts.
 */
export const BrowserNichtUnterstuetzt: Story = {
	name: 'Browser nicht unterstützt — die Option verschwindet',
	globals: phone390Globals,
	args: { browserState: 'unsupported' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		expect(option(canvasElement, 'browser')).toBeNull();
		/* Ohne zweiten Kanal gibt es auch keine Kombination — die Nachricht
		   schrumpft korrekt auf eine einzige Entscheidung. */
		expect(option(canvasElement, 'both')).toBeNull();
		expect(option(canvasElement, 'email')).not.toBeNull();
		expect(canvas.getAllByRole('button')).toHaveLength(1);
	}
};

/**
 * **Browser-Erlaubnis bereits erteilt.** `Notification.permission ===
 * 'granted'`. Der Knopf verschwindet, die Zeile bleibt und sagt, was gilt.
 *
 * **Achtung, das ist heute nicht die ganze Wahrheit:** eine erteilte Erlaubnis
 * genügt im ausgelieferten Code nicht. `sendNotification` verwirft jede
 * Nachricht, solange `browserNotificationsSettings().enabled` falsch ist
 * (`utils/notificationHelpers.ts`) — und dieser Schalter steht per Default auf
 * `false`. Wer heute „erlauben" drückt, bekäme die Erlaubnis und trotzdem nie
 * ein Signal.
 */
export const ErlaubnisErteilt: Story = {
	name: 'Browser-Erlaubnis erteilt',
	globals: phone390Globals,
	args: { browserState: 'granted' },
	play: async ({ canvasElement }) => {
		const browser = option(canvasElement, 'browser');
		expect(browser).not.toBeNull();
		expect(browser).toHaveTextContent('aktiviert');
		/* Erledigt heißt: kein zweiter Knopf für dieselbe Sache. */
		expect(within(browser as HTMLElement).queryByRole('button')).toBeNull();
		/* Die Kombination ist weg, weil ihre Browser-Hälfte erledigt ist. */
		expect(option(canvasElement, 'both')).toBeNull();
	}
};

/**
 * **Browser-Erlaubnis blockiert.** Der Fall, den es heute im Produkt gar nicht
 * gibt — weder in der `NotificationChoiceCard` noch in
 * `utils/notificationHelpers.ts`.
 *
 * Drei Dinge sind hier Absicht:
 *
 * 1. **Kein Knopf.** `requestPermission()` löst auf einer abgelehnten Herkunft
 *    sofort mit `denied` auf; das ausgelieferte `requestPermissions()` ruft es
 *    gar nicht erst auf, weil es nur beim Zustand `default` fragt.
 * 2. **Die Option bleibt sichtbar** — anders als bei „nicht unterstützt". Hier
 *    *kann* die Person etwas tun, also muss sie erfahren, dass es an einer
 *    Einstellung ihres Browsers liegt und nicht an der Beratungsstelle.
 * 3. **Ein Satz statt eines Klickpfads.** Es gibt keine Web-API, die die
 *    Berechtigungsseite eines Browsers öffnet.
 *
 * Die Farbe ist die **Text**-Rolle `--m3-error`, kein gefüllter Fehlerkasten:
 * ein rotes Feld für „Ihr Browser hat abgelehnt" liest sich wie ein Versagen
 * der Beratung.
 */
export const ErlaubnisBlockiert: Story = {
	name: 'Browser-Erlaubnis blockiert — niemals ein Knopf',
	globals: phone390Globals,
	args: { browserState: 'blocked' },
	play: async ({ canvasElement }) => {
		const browser = option(canvasElement, 'browser');
		expect(browser).not.toBeNull();

		/* Die eine Regel dieser Story. */
		expect(within(browser as HTMLElement).queryByRole('button')).toBeNull();

		/* Tatsache und Ausweg stehen beide da — sonst ist die Person mit einem
		   toten Kanal allein. */
		expect(browser).toHaveTextContent('abgelehnt');
		expect(browser).toHaveTextContent('links neben der Adresse');
		expect(option(canvasElement, 'both')).toBeNull();
	}
};
