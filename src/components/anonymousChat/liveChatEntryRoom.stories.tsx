import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { generatePseudonym } from '../../utils/pseudonymGenerator';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { AgencySpecificContext } from '../../globalState';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../globalState/provider/LegalLinksProvider';
import { Stage } from '../stage/stage';
import { EntryRoomShell } from './entryRoom/EntryRoomShell';
import { LiveChatAccess } from './entryRoom/LiveChatAccess';
import { LiveChatWaitingRoom } from './entryRoom/LiveChatWaitingRoom';
import { LiveChatClosed } from './entryRoom/LiveChatClosed';
import { phone375Globals } from '../message/messageStoryShell';

/**
 * The **live chat** entry room — the real views (`entryRoom/`), which the
 * app mounts on `/invite/:token/:topic` through `LiveChatEntryRoom`. These
 * stories render the same components with fixtures instead of the queue
 * poll, so what Storybook shows is what the link shows.
 */
const meta: Meta = {
	title: 'Live chat/Entry room',
	parameters: {
		docs: {
			description: {
				component:
					'Zugang → Warteraum (wartet · Beraterin da) → Chat, plus „Geschlossen". Dieselben Bauteile wie in der App (`src/components/anonymousChat/entryRoom/`), hier mit festen Werten statt Poll.'
			}
		}
	}
};
export default meta;

const legalLinks: TProvidedLegalLink[] = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: () => 'https://oriso.example/datenschutz'
	} as TProvidedLegalLink,
	{
		label: 'login.legal.infoText.impressum',
		registration: true,
		getUrl: () => 'https://oriso.example/impressum'
	} as TProvidedLegalLink
];
const CONSENT_HTML =
	'Ich habe die <a href="https://oriso.example/datenschutz" target="_blank" rel="noreferrer">Datenschutzerklärung</a> und das <a href="https://oriso.example/impressum">Impressum</a> zur Kenntnis genommen. Für Authentifizierung und Navigation verwendet diese Webseite Cookies.';

const Shell = ({
	status,
	children
}: {
	status: string;
	children: React.ReactNode;
}) => (
	<GlobalComponentContext.Provider value={{ Stage } as never}>
		<LegalLinksContext.Provider value={legalLinks}>
			<AgencySpecificContext.Provider
				value={{
					specificAgency: null,
					setSpecificAgency: () => undefined
				}}
			>
				<EntryRoomShell
					kicker="Live-Chat · Schulden"
					statusLine={status}
				>
					{children}
				</EntryRoomShell>
			</AgencySpecificContext.Provider>
		</LegalLinksContext.Provider>
	</GlobalComponentContext.Provider>
);

const Access = () => {
	const [p, setP] = React.useState(() => generatePseudonym('de'));
	return (
		<Shell status="Ihr Zugang für dieses Gespräch">
			<LiveChatAccess
				pseudonym={p}
				onReroll={() => setP(generatePseudonym('de'))}
				onContinue={() => undefined}
			/>
		</Shell>
	);
};
const Waiting = ({
	accepted = false,
	companionStart = false,
	ahead = 3
}: {
	accepted?: boolean;
	companionStart?: boolean;
	ahead?: number;
}) => (
	<Shell
		status={
			accepted
				? 'Eine Beraterin hat Ihr Gespräch angenommen'
				: 'Warteraum — freie Beraterin wird gesucht'
		}
	>
		<LiveChatWaitingRoom
			ahead={ahead}
			accepted={accepted}
			consentHtml={CONSENT_HTML}
			companionStart={companionStart}
			onAccept={() => undefined}
			onLeave={() => undefined}
			onMailCounselling={() => undefined}
		/>
	</Shell>
);
const Closed = () => (
	<Shell status="Gerade geschlossen">
		<LiveChatClosed
			onMailCounselling={() => undefined}
			onLater={() => undefined}
		/>
	</Shell>
);

const full = (story: string) => ({
	layout: 'fullscreen' as const,
	docs: { description: { story } }
});

export const StepAccess: StoryObj = {
	name: 'A — Der Zugang',
	render: () => <Access />,
	parameters: full(
		'Kein Träger im Header — der Link ist global. Kein Passwort: ein Zugang, der sich selbst löscht, braucht keins. Fuß: Neu würfeln · Zum Warteraum. In der App: `apiPutSessionData` + `apiPatchUserData` mit dem Anzeigenamen, dann der Warteraum.'
	)
};
export const StepAccessMobile: StoryObj = {
	name: 'A — Der Zugang, mobil',
	globals: phone375Globals,
	render: () => <Access />,
	parameters: { layout: 'fullscreen' }
};
export const StepWaiting: StoryObj = {
	name: 'B — Warteraum: wartet',
	render: () => <Waiting />,
	parameters: full(
		'Eine Seite, drei Stellen ändern sich. Die Punkte sind die Schlange, der Knopf der Ladebalken (drehende Uhr statt Pfeil), die drei Karten das Karussell der Registrierung mit Franks Bildern. In der App: Poll auf `/service/conversations/anonymous/{id}` alle 4 s.'
	)
};
export const StepWaitingMobile: StoryObj = {
	name: 'B — Warteraum, mobil',
	globals: phone375Globals,
	render: () => <Waiting />,
	parameters: { layout: 'fullscreen' }
};
export const StepCompanion: StoryObj = {
	name: 'B — Warteraum: ruhige Begleitung',
	render: () => <Waiting companionStart />,
	parameters: full(
		'Das Atemspiel an der Stelle der Karten, im weißen Bereich — kein Popup. Nimmt eine Beraterin an, wird es abgebaut.'
	)
};
export const StepCompanionMobile: StoryObj = {
	name: 'B — Ruhige Begleitung, mobil',
	globals: phone375Globals,
	render: () => <Waiting companionStart />,
	parameters: { layout: 'fullscreen' }
};
export const StepAccepted: StoryObj = {
	name: 'B — Warteraum: Beraterin ist da',
	render: () => <Waiting accepted />,
	parameters: full(
		'Status `IN_PROGRESS`: die Zeile wird rot, die Datenschutz-Karte des Tenants slidet von unten herein, „Zustimmen & starten" + rundes X (→ „Sind Sie sicher?"). In der App: `apiPatchUserData({dataPrivacyConfirmation, termsAndConditionsConfirmation})`, die drei sessionStorage-Marken, Übergabe in die Session.'
	)
};
export const StepAcceptedMobile: StoryObj = {
	name: 'B — Beraterin ist da, mobil',
	globals: phone375Globals,
	render: () => <Waiting accepted />,
	parameters: { layout: 'fullscreen' }
};
export const StepClosed: StoryObj = {
	name: 'C — Geschlossen',
	render: () => <Closed />,
	parameters: full(
		'Kein Berater verfügbar (`numAvailableConsultants === 0`). Woche als Leiste aus `LIVE_CHAT_OPENING_HOURS`, Fuß: Später · Anfrage schreiben (→ Registrierung). Steigt zurück in den Warteraum, sobald jemand verfügbar ist.'
	)
};
export const StepClosedMobile: StoryObj = {
	name: 'C — Geschlossen, mobil',
	globals: phone375Globals,
	render: () => <Closed />,
	parameters: { layout: 'fullscreen' }
};
