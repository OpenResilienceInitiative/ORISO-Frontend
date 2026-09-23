import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Box } from '@mui/material';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../globalState/provider/LegalLinksProvider';
import { AgencySpecificContext, UserDataContext } from '../../globalState';
import { StageLayout } from '../stageLayout/StageLayout';
import { Stage } from '../stage/stage';
import { RegistrationHandover } from '../app/registrationLoader/RegistrationHandover';
import { GroupInviteEntry } from '../registration/groupInviteEntry/GroupInviteEntry';
import { GroupWaitingRoom } from './entryRoom/GroupWaitingRoom';
import { GroupConsentGate } from './consent/GroupConsentGate';
import { SessionMenu } from '../sessionMenu/SessionMenu';
import { ChatStageProviders } from '../chatStage/__storybook__/ChatStageProviders';
import {
	stageRoute,
	stageSession
} from '../chatStage/__storybook__/chatStageFixtures';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import '../sessionMenu/sessionMenu.styles.scss';

/**
 * # Self-help group: privacy and the words while joining (#1499)
 *
 * Frank, 23.09.2026, on the two follow-ups:
 *
 * 1. **Privacy statement.** "ja, für die nicht registrierten, und dann sollte
 *    sie wie jeder Chatraum auch über das Menü einsehbar sein, und Impressum".
 *    A client whose agreement is not on record agrees to the statement of the
 *    Beratungsstelle that runs the group before the first message (ADR-022
 *    gate 2). Datenschutz and Impressum are reachable from a menu wherever a
 *    group participant is — the running room and, on a phone, the waiting
 *    room.
 * 2. **While joining.** The screen that bridges the registration still spoke
 *    about a counselling enquiry ("Antwort in 2 Arbeitstagen", "Anfrage
 *    schreiben"). A group join opens no enquiry, so it now shows the group's
 *    three cards.
 *
 * Every story is the production component; only the data is fixture.
 */
const meta: Meta = {
	title: 'Group chat/Privacy and joining (#1499)',
	parameters: { layout: 'fullscreen' }
};

export default meta;
type Story = StoryObj;

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

const StageProviders = ({ children }: { children: React.ReactNode }) => (
	<LegalLinksContext.Provider value={legalLinks}>
		<AgencySpecificContext.Provider
			value={{ specificAgency: null, setSpecificAgency: () => undefined }}
		>
			<Box sx={{ minHeight: '100vh' }}>{children}</Box>
		</AgencySpecificContext.Provider>
	</LegalLinksContext.Provider>
);

/* ---------------------------------------------------------------------------
   2 — while joining
   --------------------------------------------------------------------------- */

const JoiningBefore = () => (
	<StageProviders>
		<StageLayout
			className="stageLayout--registration"
			showLegalLinks={true}
			showRegistrationLink={false}
			stage={<Stage hasAnimation={false} />}
			mobileHero="bar"
		>
			<RegistrationHandover
				ready={false}
				forcedState="preparing"
				variant="inline"
				onEnter={() => undefined}
			/>
		</StageLayout>
	</StageProviders>
);

const JoiningAfter = () => (
	<StageProviders>
		<GroupInviteEntry
			stage={<Stage hasAnimation={false} />}
			gcid="20"
			aid="19"
			temporary={true}
			onToggleTemporary={() => undefined}
			onChange={() => undefined}
			onJoin={() => undefined}
			joinDisabled={true}
			busy={true}
		/>
	</StageProviders>
);

const expectGroupWords = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	await expect(await canvas.findByText('Bitte nur mit Alias')).toBeVisible();
	await expect(canvas.queryByText('Antwort in 2 Arbeitstagen')).toBeNull();
	await expect(canvas.queryByText('Anfrage schreiben')).toBeNull();
};

export const JoiningBefore1440: Story = {
	name: '2 · Joining — before (counselling words) · 1440',
	globals: desktop1440Globals,
	render: () => <JoiningBefore />
};

export const JoiningAfter1440: Story = {
	name: '2 · Joining — after (group words) · 1440',
	globals: desktop1440Globals,
	render: () => <JoiningAfter />,
	play: async ({ canvasElement }) => expectGroupWords(canvasElement)
};

export const JoiningBefore390: Story = {
	name: '2 · Joining — before (counselling words) · 390',
	globals: phone390Globals,
	render: () => <JoiningBefore />
};

export const JoiningAfter390: Story = {
	name: '2 · Joining — after (group words) · 390',
	globals: phone390Globals,
	render: () => <JoiningAfter />,
	play: async ({ canvasElement }) => expectGroupWords(canvasElement)
};

/* ---------------------------------------------------------------------------
   1a — the privacy gate before the first message
   --------------------------------------------------------------------------- */

/**
 * The gate as the room shows it: in place of the conversation, the composer
 * hidden. Storybook has no agency service, so the sentence is the platform's
 * — the fallback the gate uses when the group's department cannot be told.
 * With a department that has its own wording, that wording stands here.
 */
/* Plain labels: the gate renders its sentence with `renderToString`, outside
   the story's locale provider, so i18n keys would come out in English. */
const gateLegalLinks: TProvidedLegalLink[] = [
	{
		label: 'Datenschutzerklärung',
		registration: true,
		getUrl: () => 'https://oriso.example/datenschutz'
	} as TProvidedLegalLink,
	{
		label: 'Impressum',
		registration: true,
		getUrl: () => 'https://oriso.example/impressum'
	} as TProvidedLegalLink
];

const GateInRoom = () => (
	<LegalLinksContext.Provider value={gateLegalLinks}>
		<Box
			sx={{
				minHeight: '100vh',
				display: 'flex',
				bgcolor: 'var(--m3-surface-container, #eceaea)'
			}}
		>
			<Box
				className="session__content session__content--consentGate"
				sx={{
					flex: 1,
					display: 'flex',
					m: { xs: 0, md: 3 },
					borderRadius: { xs: 0, md: '24px' },
					bgcolor: '#fff'
				}}
			>
				<GroupConsentGate
					agencyId={null}
					onAccepted={() => undefined}
				/>
			</Box>
		</Box>
	</LegalLinksContext.Provider>
);

const expectGate = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	await expect(await canvas.findByRole('dialog')).toBeVisible();
	await expect(canvas.getByText('Bevor Sie schreiben')).toBeVisible();
	await expect(canvas.queryByText(/beratende Person einen Chat/)).toBeNull();
};

export const PrivacyGate1440: Story = {
	name: '1a · Group room — privacy gate before the first message · 1440',
	globals: desktop1440Globals,
	render: () => <GateInRoom />,
	play: async ({ canvasElement }) => expectGate(canvasElement)
};

export const PrivacyGate390: Story = {
	name: '1a · Group room — privacy gate before the first message · 390',
	globals: phone390Globals,
	render: () => <GateInRoom />,
	play: async ({ canvasElement }) => expectGate(canvasElement)
};

/* ---------------------------------------------------------------------------
   1b — Datenschutz and Impressum from a menu
   --------------------------------------------------------------------------- */

const NOW = Date.UTC(2026, 8, 4, 14, 0, 0);

const WaitingRoom = () => (
	<StageProviders>
		<GroupWaitingRoom
			topicName="Trauerbegleitung"
			agencyName="Caritas Berlin, Selbsthilfegruppe Trauer"
			agencyId={null}
			plannedStart={new Date(NOW + 3 * 24 * 3600e3 + 5 * 3600e3)}
			eventId={20}
			welcomeText="Schön, dass Sie da sind."
			rules={['Was hier gesagt wird, bleibt hier.']}
			active={false}
			onJoin={() => undefined}
			nowMs={NOW}
		/>
	</StageProviders>
);

export const WaitingRoom1440: Story = {
	name: '1b · Client waiting room — legal links in the stage · 1440',
	globals: desktop1440Globals,
	render: () => <WaitingRoom />
};

export const WaitingRoomLegalMenu390: Story = {
	name: '1b · Client waiting room — legal menu in the phone bar · 390',
	globals: phone390Globals,
	render: () => <WaitingRoom />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Rechtliches' })
		);
		const body = within(canvasElement.ownerDocument.body);
		await expect(
			await body.findByRole('menuitem', { name: /Datenschutz/ })
		).toBeVisible();
		await expect(
			body.getByRole('menuitem', { name: /Impressum/ })
		).toBeVisible();
	}
};

const clientUserData = {
	userId: 'client-1',
	userName: 'ente_yuki_7984',
	grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT'],
	userRoles: ['USER'],
	dataPrivacyConfirmation: '2026-09-23T10:00:00Z'
} as any;

const groupSession = () => {
	const session = stageSession();
	return {
		...session,
		isGroup: true,
		isSession: false,
		item: { ...session.item, active: true, subscribed: true }
	} as typeof session;
};

const RunningGroupMenu = () => (
	<ChatStageProviders activeSession={groupSession()}>
		<LegalLinksContext.Provider value={legalLinks}>
			<UserDataContext.Provider
				value={
					{
						userData: clientUserData,
						setUserData: () => undefined,
						reloadUserData: async () => clientUserData
					} as any
				}
			>
				<div
					style={{
						position: 'relative',
						padding: 24,
						minHeight: 520
					}}
				>
					<SessionMenu
						hasUserInitiatedStopOrLeaveRequest={{ current: false }}
						isAskerInfoAvailable={false}
					/>
				</div>
			</UserDataContext.Provider>
		</LegalLinksContext.Provider>
	</ChatStageProviders>
);

const openMenuAndExpectLegal = async (canvasElement: HTMLElement) => {
	const trigger =
		canvasElement.querySelector<HTMLElement>(
			'.sessionMenu__icon--desktop'
		) ?? canvasElement.querySelector<HTMLElement>('.sessionMenu__icon');
	await userEvent.click(trigger!);
	await waitFor(() =>
		expect(
			canvasElement.querySelector('.legalInformationLinks--menu')
				?.textContent
		).toMatch(/Datenschutz/)
	);
	await expect(
		canvasElement.querySelector('.legalInformationLinks--menu')?.textContent
	).toMatch(/Impressum/);
};

export const RunningGroupClientMenu1440: Story = {
	name: '1b · Running group — client menu keeps Datenschutz and Impressum · 1440',
	globals: desktop1440Globals,
	parameters: { router: { initialPath: stageRoute } },
	render: () => <RunningGroupMenu />,
	play: async ({ canvasElement }) => openMenuAndExpectLegal(canvasElement)
};
