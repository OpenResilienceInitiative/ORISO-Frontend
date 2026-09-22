import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { useTranslation } from 'react-i18next';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
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
import type { GuestName } from './entryRoom/LiveChatEntryRoom';
import { toRegistrationUsername } from '../registration/accountData/registrationUsername';
import { LiveChatWaitingRoom } from './entryRoom/LiveChatWaitingRoom';
import { LiveChatClosed } from './entryRoom/LiveChatClosed';
import { LiveChatChecking } from './entryRoom/LiveChatChecking';
import { EntryRoomView } from './entryRoom/EntryRoomView';
import LegalLinks from '../legalLinks/LegalLinks';
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
/* The same sentence the room builds, read from the catalogue instead of a
   German literal — a story opened in English has to read English, because
   this is the text the guest consents to. */
const useConsentHtml = () => {
	const { t } = useTranslation();
	return t('anonymousConsent.label.text', {
		interpolation: { escapeValue: false },
		legal_links: renderToString(
			<LegalLinks
				legalLinks={legalLinks}
				filter={(l) => l.registration}
				delimiter={', '}
			/>
		)
	});
};

const Shell = ({
	statusKey,
	children
}: {
	statusKey: string;
	children: React.ReactNode;
}) => {
	const { t } = useTranslation();
	return (
		<GlobalComponentContext.Provider value={{ Stage } as never}>
			<LegalLinksContext.Provider value={legalLinks}>
				<AgencySpecificContext.Provider
					value={{
						specificAgency: null,
						setSpecificAgency: () => undefined
					}}
				>
					<EntryRoomShell
						kicker={`${t('liveChat.entry.kicker')} · Schulden`}
						statusLine={t(statusKey)}
					>
						{children}
					</EntryRoomShell>
				</AgencySpecificContext.Provider>
			</LegalLinksContext.Provider>
		</GlobalComponentContext.Provider>
	);
};

/* Same rule as the room: four offers, no double User-ID in the set. */
const rollFour = (): GuestName[] => {
	const picked: GuestName[] = [];
	const seen = new Set<string>();
	while (picked.length < 4) {
		const identity = generatePseudonym('de');
		const userId = toRegistrationUsername(identity);
		if (seen.has(userId)) continue;
		seen.add(userId);
		picked.push({ identity, userId });
	}
	return picked;
};

const Access = () => {
	const [names, setNames] = React.useState(rollFour);
	const [selected, setSelected] = React.useState(0);
	return (
		<Shell statusKey="liveChat.entry.status.access">
			<LiveChatAccess
				names={names}
				selectedIndex={selected}
				onSelect={setSelected}
				onReroll={() => {
					setNames(rollFour());
					setSelected(0);
				}}
				onContinue={() => undefined}
			/>
		</Shell>
	);
};
const Waiting = ({
	accepted = false,
	companionStart = false,
	ahead = 3,
	consentHtml: consentHtmlOverride
}: {
	accepted?: boolean;
	companionStart?: boolean;
	ahead?: number;
	consentHtml?: string;
}) => {
	const defaultConsentHtml = useConsentHtml();
	const consentHtml = consentHtmlOverride ?? defaultConsentHtml;
	return (
		<Shell
			statusKey={
				accepted
					? 'liveChat.entry.status.accepted'
					: 'liveChat.entry.status.waiting'
			}
		>
			<LiveChatWaitingRoom
				ahead={ahead}
				accepted={accepted}
				consentHtml={consentHtml}
				companionStart={companionStart}
				onAccept={() => undefined}
				onLeave={() => undefined}
				onMailCounselling={() => undefined}
			/>
		</Shell>
	);
};
const Closed = () => (
	<Shell statusKey="liveChat.entry.status.closed">
		<LiveChatClosed
			onMailCounselling={() => undefined}
			onLater={() => undefined}
		/>
	</Shell>
);

const Checking = () => {
	const { t } = useTranslation();
	return (
		<Shell statusKey="liveChat.entry.status.checking">
			<LiveChatChecking text={t('liveChat.entry.checking.text')} />
		</Shell>
	);
};

/* The door as the link plays it: look, nobody → closed; „Ich warte" → look
   again; somebody comes online → the names. Timed, so the slides are visible. */
const DoorFlow = () => {
	const { t } = useTranslation();
	const [view, setView] = React.useState<
		'checking' | 'closed' | 'waitingForLive' | 'access'
	>('checking');
	const [names, setNames] = React.useState(rollFour);
	const [selected, setSelected] = React.useState(0);
	React.useEffect(() => {
		const next =
			view === 'checking'
				? 'closed'
				: view === 'waitingForLive'
					? 'access'
					: null;
		if (!next) return undefined;
		const timer = window.setTimeout(() => setView(next), 1800);
		return () => window.clearTimeout(timer);
	}, [view]);
	return (
		<Shell
			statusKey={
				view === 'closed'
					? 'liveChat.entry.status.closed'
					: view === 'access'
						? 'liveChat.entry.status.access'
						: view === 'waitingForLive'
							? 'liveChat.entry.status.waitingForLive'
							: 'liveChat.entry.status.checking'
			}
		>
			<EntryRoomView key={view}>
				{(view === 'checking' || view === 'waitingForLive') && (
					<LiveChatChecking
						text={t(
							view === 'checking'
								? 'liveChat.entry.checking.text'
								: 'liveChat.entry.checking.waiting'
						)}
					/>
				)}
				{view === 'closed' && (
					<LiveChatClosed
						onMailCounselling={() => undefined}
						onLater={() => setView('waitingForLive')}
					/>
				)}
				{view === 'access' && (
					<LiveChatAccess
						names={names}
						selectedIndex={selected}
						onSelect={setSelected}
						onReroll={() => {
							setNames(rollFour());
							setSelected(0);
						}}
						onContinue={() => setView('checking')}
					/>
				)}
			</EntryRoomView>
		</Shell>
	);
};

const full = (story: string) => ({
	layout: 'fullscreen' as const,
	docs: { description: { story } }
});

export const StepChecking: StoryObj = {
	name: '0 — Wer ist live?',
	render: () => <Checking />,
	parameters: full(
		'Das Erste, was der Link zeigt: der Orbital-Loader mittig im weißen Bereich, darunter ein Satz. Noch ist nichts angelegt — kein Konto, kein Platz in der Schlange. In der App: `GET /service/users/invitelinks/{token}/context` (öffentlich) für das Thema, dann `GET /service/conversations/anonymous/availability?topicId=…` (öffentlich). Eine 0 wird nach 1 s ein zweites Mal gefragt, weil der Server einen Fehler als 0 meldet.'
	)
};
export const StepCheckingMobile: StoryObj = {
	name: '0 — Wer ist live?, mobil',
	globals: phone375Globals,
	render: () => <Checking />,
	parameters: { layout: 'fullscreen' }
};
export const Door: StoryObj = {
	name: '0 → C → A — Die Tür, als Ablauf',
	render: () => <DoorFlow />,
	parameters: full(
		'Der Ablauf mit echten Übergängen: Loader → niemand live → „Geschlossen" gleitet ein (Desktop von rechts, mobil von unten; die Bühne links bleibt stehen). „Ich warte" → der Loader wartet weiter → jemand kommt online → die Namen gleiten ein. Erst „Zum Warteraum" löst den Link ein. Zeiten hier fest (1,8 s), in der App der Poll alle 4 s.'
	)
};
export const DoorMobile: StoryObj = {
	name: '0 → C → A — Die Tür, mobil',
	globals: phone375Globals,
	render: () => <DoorFlow />,
	parameters: { layout: 'fullscreen' }
};
export const StepAccess: StoryObj = {
	name: 'A — Der Zugang',
	render: () => <Access />,
	parameters: full(
		'Vier Namen statt einem Würfel (#1341): eine Radiogruppe, zentriert im weißen Bereich, der erste Name ist schon gewählt — wer nichts anfassen will, drückt einfach „Zum Warteraum". Am Telefon zwei nebeneinander, ab `lg` alle vier. Kein Träger im Header — der Link ist global. Kein Passwort: ein Zugang, der sich selbst löscht, braucht keins. „Neu würfeln" holt vier frische Namen, ohne Doppel, und wählt wieder den ersten. In der App: `apiPutSessionData` + `apiPatchUserData` mit dem GEWÄHLTEN Anzeigenamen, dann der Warteraum.'
	)
};
export const StepAccessMobile: StoryObj = {
	name: 'A — Der Zugang, mobil',
	globals: phone375Globals,
	render: () => <Access />,
	parameters: full(
		'Dieselbe Auswahl auf 375 pt: zwei Karten nebeneinander, lange Namen brechen um. Der Bildschirm war vorher fast leer — das war Franks Beschwerde.'
	)
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
		'Status `IN_PROGRESS`: die Zeile wird rot, die Datenschutz-Karte des Tenants slidet von unten herein. Der Datenschutz ist eine echte Checkbox: „Gespräch beginnen" ohne Haken startet nichts, sondern zeigt den Fehler (#1341). Das runde X führt in den Verlassen-Dialog, der jetzt „Sind Sie sicher, dass Sie abbrechen wollen und schließen?" fragt. In der App: `apiPatchUserData({dataPrivacyConfirmation, termsAndConditionsConfirmation})`, die drei sessionStorage-Marken, Übergabe in die Session.'
	)
};
export const StepAcceptedMissingAgencyPolicy: StoryObj = {
	name: 'B — Warteraum: Datenschutzerklärung fehlt',
	render: () => (
		<Waiting
			accepted
			consentHtml="Für diese Beratungsstelle ist derzeit keine eigene Datenschutzerklärung hinterlegt. Wenn Sie fortfahren, nutzen Sie das Angebot auf eigenes Risiko. Mit dem Aktivieren des Kontrollkästchens stimmen Sie den Datenschutzhinweisen und Nutzungsbedingungen dieser Website zu. Diese Website verwendet Cookies."
		/>
	),
	parameters: full(
		'Fehlt der Beratungsstelle eine nutzbare veröffentlichte Datenschutzerklärung, bleibt der Einstieg möglich. Die feste Systemwarnung nennt das Risiko; die bestehende Checkbox dokumentiert die bewusste Entscheidung der ratsuchenden Person.'
	)
};
/**
 * What pressing the primary action without the checkbox does: nothing happens,
 * and the reason says so. Frank's item 2 in #1341 — the sentence used to be
 * text and the button implied agreement to it.
 */
export const StepAcceptedConsentMissing: StoryObj = {
	name: 'B — Warteraum: Zustimmung fehlt',
	render: () => <Waiting accepted />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', { name: /Gespräch beginnen/i })
		);
		await expect(await canvas.findByRole('alert')).toBeInTheDocument();
		await expect(canvas.getByRole('checkbox')).not.toBeChecked();
	},
	parameters: full(
		'Der Fehlerzustand der Checkbox — dieselbe Behandlung wie im Konto-Schritt der Mail-Beratung (`AccountData`). Ein Haken räumt die Meldung wieder ab.'
	)
};
/**
 * The third of Frank's items in #1341: the round ✕ must ask before it closes.
 * It opens the existing „Chat verlassen?" dialog, which now carries his
 * sentence at the top — no second dialog stacked in front of it.
 */
export const StepAcceptedLeaving: StoryObj = {
	name: 'B — Warteraum: Abbrechen fragt nach',
	render: () => <Waiting accepted />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', {
				name: /Nicht zustimmen und Chat verlassen/i
			})
		);
		await expect(
			await within(document.body).findByText(
				/Sind Sie sicher, dass Sie abbrechen wollen und schließen\?/i
			)
		).toBeInTheDocument();
	},
	parameters: full(
		'Das ✕ öffnet den bestehenden Verlassen-Dialog — er fragt bereits, und trägt jetzt Franks Satz oben. Bleiben, Chat starten und Zugang löschen bleiben die drei Wege daraus.'
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
		'Kein Berater verfügbar (`numAvailableConsultants === 0`). Woche als Leiste aus `LIVE_CHAT_OPENING_HOURS`, Fuß: Ich warte · Anfrage schreiben (→ Registrierung). Erscheint schon vor der Namenswahl, ohne dass etwas angelegt wurde. „Ich warte" statt „Später": eine Seite kann einen Tab, den die Person selbst geöffnet hat, nicht schließen — der Knopf sagt, was er tut. Steigt weiter, sobald jemand live ist.'
	)
};
export const StepClosedMobile: StoryObj = {
	name: 'C — Geschlossen, mobil',
	globals: phone375Globals,
	render: () => <Closed />,
	parameters: { layout: 'fullscreen' }
};
