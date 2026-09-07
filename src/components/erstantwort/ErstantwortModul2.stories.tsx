import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import { ErstantwortSequence } from './ErstantwortSequence';
import {
	ErstantwortNotifyChoice,
	type ErstantwortNotifyBrowserState
} from './ErstantwortNotifyChoice';
import { NotificationChoiceCard } from './NotificationChoiceCard';
import {
	ERSTANTWORT_PAYLOAD_VERSION,
	SYSTEM_NOTIFICATION_FIRST_RESPONSE
} from './erstantwortPayload';
import {
	resolveErstantwortBausteine,
	type ErstantwortLiveState,
	type ResolvedBaustein
} from './erstantwortResolve';
import { bausteinById } from './erstantwortCatalogue';
import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';
import {
	ERSTANTWORT_SHORTENED,
	ERSTANTWORT_SUBTITLES,
	flowText
} from './erstantwortFlowCopy';
import {
	contrastRatio,
	darkSchemeGlobals,
	desktop1440Globals,
	phone390Globals,
	relativeLuminance,
	schemeToken
} from '../message/messageStoryShell';
import './ErstantwortSequence.styles.scss';

/**
 * # Modul 2 — Benachrichtigung
 *
 * **Vorschlag zum Ansehen. Nichts ist entschieden, nichts ist verdrahtet.**
 * Begleitpapier: `0 - Docs/VERDRAHTUNG-modul2-benachrichtigung-2026-09-07.md`.
 * Inventar: `0 - Docs/INVENTAR-erstantwort-carimat-2026-09-07.md`.
 *
 * ## Was Frank am 07.09. verlangt hat
 *
 * 1. **Die Benachrichtigung ist eine eigene Nachricht** — ausdrücklich, weil
 *    sie beim Träger ab- und zuschaltbar ist.
 * 2. **„Da fehlt auch der Button, dass man eine Benachrichtigung bekommt."**
 *    Heute bietet das *laufende* Produkt nur die E-Mail-Adresse an. Die
 *    Möglichkeit, stattdessen oder zusätzlich ein Signal im Browser zu
 *    bekommen, existiert als `NotificationChoiceCard` — und ist außerhalb von
 *    Storybook toter Code (Inventar §3.3).
 *
 * ## Warum eine eigene Nachricht und nicht ein Absatz in Modul 1
 *
 * Weil der Träger-Schalter am **Baustein** hängt, nicht an einem Satz.
 * `isBausteinSilenced` (`erstantwortResolve.ts:118`) entfernt bei
 * `isAskerEmailEnabled === false` den **ganzen** Baustein, nicht nur seinen
 * Button — genau damit die Kette nicht weiter eine E-Mail-Adresse anbietet, die
 * der Träger nicht erheben will. Ein Absatz innerhalb eines anderen Bausteins
 * wäre für diesen Schalter unerreichbar: er müsste dann Text *innerhalb* eines
 * eingefrorenen `body` herausschneiden, und genau das verbietet ADR-018 §4
 * („frozen words"). Dazu kommt ADR-018 §5: Reihenfolge und Auslöser gehören der
 * Plattform, und **Katalogreihenfolge ist Renderreihenfolge** — ein eigener
 * Baustein ist die einzige Einheit, die die Plattform positionieren und ein
 * Träger ein- und ausschalten kann.
 *
 * ## Was diese Stories echt rechnen und was gesetzt ist
 *
 * Jede Story baut ein **synthetisches `FIRST_RESPONSE`-Event** und schickt es
 * durch das ausgelieferte `resolveErstantwortBausteine`. Der Zustand kommt
 * damit nicht aus der Story, sondern aus dem echten Resolver:
 * `isBausteinSilenced` lässt den Baustein verschwinden, `isActionStillOpen`
 * nimmt ihm den Button. Der Baustein trägt bewusst die **id
 * `emailNotification`** und die Aktion **`ADD_EMAIL`**, weil genau diese beiden
 * Werte die vorhandene Mechanik auslösen.
 *
 * Gesetzt ist nur das, was es heute nicht gibt: der Zustand des Browsers
 * (`available` / `granted` / `blocked` / `unsupported`) wird per Prop
 * hineingegeben, weil Storybook keine echte Notification-Berechtigung hat.
 *
 * **Kein Wort ist neu erfunden.** Überschrift und Fließtext sind der
 * ausgelieferte Katalogeintrag `notificationChoice` — heute am nie ausgelösten
 * Trigger `AFTER_ENQUIRY_DISPATCHED`, hier an der Stelle, die wirklich
 * ankommt. Neu sind nur die Beschriftungen der zwei Optionen und der
 * Kombination; sie stehen als eigene i18n-Schlüssel im Begleitpapier.
 */
const meta = {
	title: 'Templates/Erstantwort-Module/2 Benachrichtigung',
	component: ErstantwortSequence,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	args: {
		skipAnimation: true,
		/*
		 * **Handlungsaufruf statt Dekortext** (Frank, 07.09.2026). Ausgeliefert
		 * steht unter „Carimat" in jeder Nachricht „Ihre ersten Schritte"; in
		 * dieser ist etwas zu tun, und die Zeile sagt was. Franks eigener
		 * Wortlaut.
		 */
		subtitle: flowText(ERSTANTWORT_SUBTITLES.notificationChoice)
	}
} satisfies Meta<typeof ErstantwortSequence>;

export default meta;
type Story = StoryObj<typeof meta>;

const translate = (_key: string, defaultValue?: string) => defaultValue ?? '';

/** The catalogue wording, read out rather than retyped. */
const notificationChoiceEntry = bausteinById('notificationChoice');
const emailNotificationEntry = bausteinById('emailNotification');

/**
 * Modul 2 as one persisted Baustein.
 *
 * Two ids meet here on purpose:
 *
 * - **`id: 'emailNotification'`** — the Baustein that is toggleable today and
 *   that `isBausteinSilenced` recognises. Keeping the id is what makes the
 *   Träger switch work with no new code at all.
 * - **the `notificationChoice` wording** — already written, already reviewed,
 *   already channel-neutral („Sagen Sie uns, wie wir Ihnen Bescheid geben
 *   dürfen"), and today attached to a trigger nothing ever fires.
 */
const MODUL_2_BAUSTEIN = {
	id: 'emailNotification',
	headline: notificationChoiceEntry?.defaultHeadline,
	/*
	 * **Gekürzt am 07.09.2026** (Franks Regel: jede Karte liest sich als ein
	 * vollständiger kurzer Text). Ausgeliefert steht dort: „Sie müssen nicht
	 * warten und immer wieder nachsehen. Sagen Sie uns, wie wir Ihnen Bescheid
	 * geben dürfen, sobald die Antwort da ist." Der zweite Satz ist eine
	 * Aufforderung — und die trägt jetzt die Unterzeile. Was bleibt, ist die
	 * Zusage.
	 *
	 * Das ist eine echte **Wortlaut-Änderung** und wirkt deshalb nur auf neue
	 * Erstantworten (ADR-018 §4). Sie hängt an drei Orten: FE-Katalog, sieben
	 * Locales und `ErstantwortPayloadBuilder.java`.
	 */
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

/**
 * Runs the shipped resolver and splits the result the way `ErstantwortMessage`
 * would have to: the surviving Bausteine go into the sequence, and whether the
 * e-mail action survived becomes the molecule's `isEmailOpen`.
 *
 * The action is **stripped before rendering** so the bubble does not grow a
 * second „E-Mail-Adresse angeben" button next to the one inside the molecule.
 * In a shipped version the catalogue entry would carry no `action` at all and
 * the openness would be read from `userData.email` directly; keeping the action
 * here is what lets the story prove `isActionStillOpen` instead of asserting it.
 */
const modul2 = (state: ErstantwortLiveState) => {
	const { bausteine } = resolveErstantwortBausteine({
		rawMessage: modul2Event(),
		translate,
		state
	});
	const baustein = bausteine.find(
		(entry) => entry.id === 'emailNotification'
	);
	const isEmailOpen = Boolean(baustein?.action);
	const rendered: ResolvedBaustein[] = baustein
		? [
				{
					id: baustein.id,
					headline: baustein.headline,
					body: baustein.body
				}
			]
		: [];
	return { rendered, isEmailOpen };
};

const modul2Args = (
	state: ErstantwortLiveState,
	browserState: ErstantwortNotifyBrowserState
) => {
	const { rendered, isEmailOpen } = modul2(state);
	return {
		bausteine: rendered,
		slots: {
			emailNotification: (
				<ErstantwortNotifyChoice
					isEmailOpen={isEmailOpen}
					browserState={browserState}
					onChoose={() => undefined}
					translate={translate}
				/>
			)
		}
	};
};

/**
 * Story scaffolding, **not product UI**: a dashed frame so „der Baustein ist
 * weg" is visible as a result rather than as a blank screenshot. Everything
 * inside the frame is the real, unmodified sequence — which renders nothing.
 */
const SilencedFrame: React.FC<{ children: React.ReactNode }> = ({
	children
}) => (
	<div
		style={{
			border: '1px dashed var(--m3-outline-variant, #c4c7c8)',
			borderRadius: '12px',
			padding: '16px',
			color: 'var(--m3-on-surface-variant, #444748)',
			fontSize: '13px',
			lineHeight: 1.5
		}}
	>
		{children}
		<p style={{ margin: 0 }}>
			Hier stünde Modul 2. Der Träger hat die E-Mail-Benachrichtigung
			abgeschaltet, deshalb entfernt <code>isBausteinSilenced</code> den
			ganzen Baustein — nicht nur seinen Button.
		</p>
		<p style={{ margin: '8px 0 0' }}>
			Dieser gestrichelte Rahmen gehört zur Story. Im Produkt ist an
			dieser Stelle nichts, auch kein Abstand.
		</p>
	</div>
);

/* --------------------------------------------------------------------------
   (m2) Der Vorschlag
   -------------------------------------------------------------------------- */

/**
 * **(m2) Modul 2 — Benachrichtigung.** Eine eigene Carimat-Nachricht: kurzer
 * Text, darunter **E-Mail** und **Signal im Browser** als gleichwertige
 * Optionen mit je einem Button, darunter die empfohlene Kombination.
 *
 * Drei Dinge, die hier absichtlich so sind:
 *
 * - **Gleichwertig heißt gleich gebaut.** Beide Optionen haben dieselbe Form:
 *   Beschriftung, ein ehrlicher Hinweis, ein Button. Der Hinweis am
 *   Browser-Signal sagt die Einschränkung selbst („nur auf diesem Gerät und in
 *   diesem Browser"), damit die Wahl informiert ist und nicht bereut wird.
 * - **Die Empfehlung ist eine dritte Zeile, kein vorausgewählter Haken.** Ein
 *   Häkchen, das schon gesetzt ist, ist keine Einwilligung; eine Empfehlung,
 *   die man drücken muss, ist eine.
 * - **Der Button steht im Molekül, nicht am Baustein.** Ein Baustein kennt
 *   genau eine Aktion (`ErstantwortBaustein.action`), diese Nachricht hat drei.
 *   Das ist derselbe Grund, aus dem `notificationChoice` im Katalog schon heute
 *   bewusst ohne `action` steht.
 */
export const M2Benachrichtigung: Story = {
	name: '(m2) Modul 2 — Benachrichtigung',
	args: modul2Args(OPEN_STATE, 'available')
};

/** **(m2) Telefon 390.** Die Mehrheitsfläche für Ratsuchende. */
export const M2Telefon390: Story = {
	name: '(m2) Modul 2 — Telefon 390',
	args: modul2Args(OPEN_STATE, 'available'),
	globals: phone390Globals
};

/**
 * **(m2) Desktop 1440.** Dieselbe Nachricht in voller Breite. Die Optionen
 * bleiben gestapelt und volle Blasenbreite — die Blase selbst ist auf
 * `min(100%, 34rem)` gedeckelt (`ErstantwortSequence.styles.scss`), also wächst
 * hier nichts ins Unlesbare.
 */
export const M2Desktop1440: Story = {
	name: '(m2) Modul 2 — Desktop 1440',
	args: modul2Args(OPEN_STATE, 'available'),
	globals: desktop1440Globals
};

/* --------------------------------------------------------------------------
   Zustandsvarianten
   -------------------------------------------------------------------------- */

/**
 * **(m2) E-Mail bereits hinterlegt.** `hasEmail: true` →
 * `isActionStillOpen({ kind: 'ADD_EMAIL' })` ist falsch → der Resolver nimmt
 * dem Baustein die Aktion. **Der Text bleibt, die Aktion verschwindet** — das
 * ist die Regel aus `erstantwortResolve.ts:88`, und sie ist keine Kosmetik: der
 * Wortlaut ist der Nachweis, dass die Person informiert wurde, und darf auch
 * nachträglich nicht aus dem Verlauf verschwinden.
 *
 * Die Kombinationszeile fällt mit weg — „beides" wäre hier ein Button, der eine
 * Hälfte von nichts täte. Übrig bleibt genau eine offene Entscheidung.
 */
export const M2EmailBereitsHinterlegt: Story = {
	name: '(m2) E-Mail bereits hinterlegt',
	args: modul2Args({ ...OPEN_STATE, hasEmail: true }, 'available'),
	globals: phone390Globals
};

/**
 * **(m2) Träger hat die E-Mail abgeschaltet.** ORISO-Admin#602, Schalter 2:
 * `isAskerEmailEnabled: false` → `isBausteinSilenced` entfernt den **ganzen**
 * Baustein. Die Story rendert deshalb **nichts**. Das ist das richtige
 * Ergebnis, keine kaputte Story.
 *
 * **Der Preis dieser Bündelung, und er ist echt:** solange E-Mail und
 * Browser-Signal in *einem* Baustein stehen, nimmt der E-Mail-Schalter dem
 * Ratsuchenden auch das Browser-Signal weg. Das ist eine offene Produktfrage,
 * keine getroffene Entscheidung — Begleitpapier §3, Variante A gegen B.
 *
 * **Heute ist der Schalter ohnehin wirkungslos:** `featureAskerEmailEnabled`
 * wird in `ORISO-Frontend/src` nirgends gelesen, die Prop `isAskerEmailEnabled`
 * nie befüllt (Inventar L5). Diese Story zeigt, was passieren *würde*.
 */
export const M2TraegerHatEmailAbgeschaltet: Story = {
	name: '(m2) Träger hat E-Mail abgeschaltet',
	args: modul2Args(
		{ ...OPEN_STATE, isAskerEmailEnabled: false },
		'available'
	),
	globals: phone390Globals,
	render: (args) => (
		<SilencedFrame>
			<ErstantwortSequence {...args} />
		</SilencedFrame>
	),
	parameters: {
		docs: {
			description: {
				story: 'Rendert nichts — der ganze Baustein ist stumm geschaltet. Genau so ist `isBausteinSilenced` gebaut. Der gestrichelte Rahmen gehört zur Story, nicht zum Produkt.'
			}
		}
	}
};

/**
 * **(m2) Browser-Benachrichtigung vom Gerät nicht unterstützt.**
 * `isSupported()` ist falsch — es gibt keine Notification-API. Die Option wird
 * **ganz entfernt**, nicht deaktiviert erklärt: hier kann die Person nichts
 * tun, und eine Erklärung für eine Unmöglichkeit ist Lärm in einer Nachricht,
 * die jemand direkt nach etwas Schwerem liest.
 *
 * Das ist zugleich die einzige Stelle, an der die Regel „disable statt hide"
 * bewusst nicht gilt: dort geht es um Berechtigungen im Produkt, hier um eine
 * Fähigkeit des Geräts.
 *
 * Mit nur einer verbliebenen Option entfällt auch die Kombination — die
 * Nachricht schrumpft korrekt auf eine einzige Entscheidung.
 */
export const M2BrowserNichtUnterstuetzt: Story = {
	name: '(m2) Browser-Benachrichtigung nicht unterstützt',
	args: modul2Args(OPEN_STATE, 'unsupported'),
	globals: phone390Globals
};

/**
 * **(m2) Browser-Erlaubnis bereits erteilt.** `Notification.permission ===
 * 'granted'`. Der Button verschwindet, die Zeile bleibt und sagt, was gilt.
 * Die E-Mail-Option bleibt offen — sie ist der Weg, der auch auf einem anderen
 * Gerät ankommt.
 *
 * **Achtung, das ist heute nicht die ganze Wahrheit:** eine erteilte Erlaubnis
 * genügt im ausgelieferten Code nicht. `sendNotification` verwirft jede
 * Nachricht, solange `browserNotificationsSettings().enabled` falsch ist
 * (`utils/notificationHelpers.ts`) — und dieser Schalter steht per Default auf
 * `false` und wird nur in den Einstellungen der Fachkraft gesetzt. Wer heute
 * „Signal einschalten" drückt, bekäme die Erlaubnis und trotzdem nie ein
 * Signal. Details und Reparaturweg im Begleitpapier §2.
 */
export const M2BrowserErlaubnisErteilt: Story = {
	name: '(m2) Browser-Erlaubnis bereits erteilt',
	args: modul2Args(OPEN_STATE, 'granted'),
	globals: phone390Globals
};

/**
 * **(m2) Browser-Erlaubnis blockiert.** Der Fall, den es heute überhaupt nicht
 * gibt — weder in der `NotificationChoiceCard` noch in
 * `utils/notificationHelpers.ts`.
 *
 * **Was passieren soll, und warum:**
 *
 * 1. **Kein Button.** `Notification.requestPermission()` löst auf einer
 *    abgelehnten Origin sofort mit `denied` auf und zeigt keinen Dialog; das
 *    ausgelieferte `requestPermissions()` ruft es gar nicht erst auf, weil es
 *    nur beim Zustand `default` fragt. Ein Button hier wäre die eine Sache, die
 *    diese Sequenz nie tun darf: aktiv aussehen und nichts tun.
 * 2. **Die Option bleibt sichtbar** — anders als bei „nicht unterstützt". Hier
 *    *kann* die Person etwas tun, also muss sie erfahren, dass es an einer
 *    Einstellung ihres Browsers liegt und nicht an der Beratungsstelle.
 * 3. **Ein Satz statt eines Klickpfads.** Es gibt keine Web-API, die die
 *    Berechtigungsseite eines Browsers öffnet. Der Text nennt den Ort („das
 *    Symbol links neben der Adresse"), ohne einen Screenshot je Browser zu
 *    versprechen.
 * 4. **Die E-Mail wird zum empfohlenen Weg.** Der Schlusssatz sagt das
 *    ausdrücklich, statt die Person mit einem toten Kanal allein zu lassen.
 *
 * Die Farbe ist die **Text**-Rolle `--m3-error`, kein gefüllter Fehlerkasten:
 * ein rotes Feld für „Ihr Browser hat abgelehnt" liest sich wie ein Versagen
 * der Beratung.
 */
export const M2BrowserBlockiert: Story = {
	name: '(m2) Browser-Erlaubnis blockiert',
	args: modul2Args(OPEN_STATE, 'blocked'),
	globals: phone390Globals
};

/* --------------------------------------------------------------------------
   Referenz
   -------------------------------------------------------------------------- */

/**
 * **(m2-heute) Was heute im Repo liegt — zum Vergleich.** Dieselbe Blase mit
 * der ausgelieferten `NotificationChoiceCard`. Sie ist vollständig gebaut,
 * getestet (5 Fälle) und **außerhalb von Storybook toter Code**: kein
 * Nutzerpfad übergibt jemals `trigger="AFTER_ENQUIRY_DISPATCHED"`, und das
 * Backend sendet die id `notificationChoice` nicht (Inventar §3.3).
 *
 * Der Unterschied zum Vorschlag in einem Satz: hier ist die **ganze Option ein
 * Button**, die dritte Zeile bündelt zusätzlich das Passwort-Thema, und es gibt
 * keine Möglichkeit, „E-Mail liegt vor, Browser noch offen" darzustellen.
 */
export const M2HeuteGebaut: Story = {
	name: '(m2-heute) Zum Vergleich: NotificationChoiceCard',
	args: {
		bausteine: modul2(OPEN_STATE).rendered,
		slots: {
			emailNotification: (
				<NotificationChoiceCard onChoose={() => undefined} />
			)
		}
	},
	globals: phone390Globals
};

/* --------------------------------------------------------------------------
   Dunkles Schema
   -------------------------------------------------------------------------- */

/**
 * **(m2-dunkel) Modul 2 im dunklen Schema.**
 *
 * Derselbe Mechanismus wie in Modul 1: `.pseudonymCard__bubble` verdrahtet
 * `background: #eeeeee` fest, die Schrift darin erbt `--m3-on-surface` von
 * `document.body` und läuft nach hell. Modul 2 ist der Fall mit der **höchsten
 * Textdichte**, also fällt hier am meisten aus.
 *
 * Gemessen auf dieser Story (390 px, Schema `dark`):
 *
 * | Element | Farbe | gegen die Blase `#eeeeee` |
 * | --- | --- | --- |
 * | Überschrift der Nachricht | `#e4e2e2` | **1,11:1** |
 * | Optionsbeschriftung (`.erstantwortNotify__label`) | `#e4e2e2` | **1,11:1** |
 * | ehrlicher Hinweis (`.erstantwortNotify__hint`) | `#c4c7c8` | **1,47:1** |
 * | Fließtext der Blase (fester Wert) | `#1c1b1f` | 14,76:1 |
 *
 * Praktisch heißt das: von Modul 2 bleibt im dunklen Schema **nur der eine
 * Satz lesbar, der seine Farbe fest verdrahtet hat** — Beschriftungen und
 * Hinweise der Optionen sind weg. Und das ist die Sorte Fehler, die im hellen
 * Schema unsichtbar ist: dort fallen fester Wert und Rolle zufällig zusammen.
 *
 * Die `play`-Funktion belegt es: das Schema hat dunkel gerendert, die Blase ist
 * hell geblieben, und die Optionsbeschriftung liegt unter der
 * Lesbarkeitsschwelle. Wenn die Blase eine M3-Rolle bekommt, fällt die Story um
 * — beabsichtigt, damit der Befund nicht still verschwindet.
 */
export const M2Dunkel: Story = {
	name: '(m2-dunkel) Dunkles Schema — Telefon 390',
	args: modul2Args(OPEN_STATE, 'available'),
	globals: { ...phone390Globals, ...darkSchemeGlobals },
	play: async ({ canvasElement }) => {
		/* 1. Das Schema hat wirklich dunkel gerendert. */
		expect(relativeLuminance(schemeToken('--m3-surface'))).toBeLessThan(
			0.1
		);

		const bubble = canvasElement.querySelector<HTMLElement>(
			'.pseudonymCard__bubble'
		);
		const label = canvasElement.querySelector<HTMLElement>(
			'.erstantwortNotify__label'
		);
		expect(bubble).not.toBeNull();
		expect(label).not.toBeNull();

		const bubbleBackground = getComputedStyle(
			bubble as HTMLElement
		).backgroundColor;

		/* 2. Die Blase ist hell geblieben. */
		expect(relativeLuminance(bubbleBackground)).toBeGreaterThan(0.5);

		/* 3. Und die Optionsbeschriftung steht damit hell auf hellgrau. */
		expect(
			contrastRatio(
				getComputedStyle(label as HTMLElement).color,
				bubbleBackground
			)
		).toBeLessThan(4.5);
	}
};
