import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
	ActiveSessionContext,
	AUTHORITIES,
	buildExtendedSession,
	ConsultantListContext,
	ConsultingTypesContext,
	E2EEContext,
	SessionsDataContext,
	SessionTypeContext,
	TopicsContext,
	UserDataContext,
	type ExtendedSessionInterface
} from '../../globalState';
import { ServerSettingsContext } from '../../globalState/provider/ServerSettingsProvider';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import type {
	ConsultingTypeInterface,
	GroupChatItemInterface,
	ListItemInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { JoinGroupChatView } from './JoinGroupChatView';
import './joinChat.styles';

/* ------------------------------------------------------------------ *
 * Fixtures — an asker waiting for a scheduled self-help group chat
 * ------------------------------------------------------------------ */

const WELCOME =
	'Hallo und herzlich willkommen! Schön, dass du da bist. Mach es dir bequem — ich öffne den Raum pünktlich für uns alle.';

const RULES = [
	'Was hier geteilt wird, bleibt unter uns. So kann jede:r offen sprechen, ohne sich Sorgen machen zu müssen.',
	'Es gibt kein Muss. Erzähl nur, was sich für dich richtig anfühlt — zuhören ist genauso wertvoll.',
	'Jede Nachricht bekommt Raum. Wir antworten mit Respekt und ohne Bewertung.',
	'Wenn es dir gerade nicht gut geht, sag es gern. Deine Beratung und die Gruppe sind für dich da.'
];

const storyTopic: TopicsDataInterface = {
	id: 1,
	name: 'Selbsthilfe',
	slug: 'selbsthilfe',
	description: 'Storybook fixture topic.',
	internalIdentifier: 'selbsthilfe',
	status: 'active',
	createDate: '2026-03-01T00:00:00.000Z',
	updateDate: '2026-03-01T00:00:00.000Z',
	fallbackUrl: '',
	titles: {
		short: 'Selbsthilfe',
		long: 'Selbsthilfe-Gruppe',
		registrationDropdown: 'Selbsthilfe',
		welcome: 'Selbsthilfe'
	}
};

const storyConsultingType: ConsultingTypeInterface = {
	id: 1,
	showAskerProfile: true,
	titles: {
		default: 'Selbsthilfe-Gruppe',
		short: 'Selbsthilfe',
		long: 'Selbsthilfe-Gruppe',
		welcome: 'Willkommen',
		registrationDropdown: 'Selbsthilfe-Gruppe'
	},
	isVideoCallAllowed: false,
	isSubsequentRegistrationAllowed: true,
	urls: {
		registrationPostcodeFallbackUrl: '',
		requiredAidMissingRedirectUrl: ''
	},
	registration: {
		autoSelectAgency: false,
		autoSelectPostcode: false,
		notes: {}
	},
	groupChat: {
		isGroupChat: true,
		groupChatRules: RULES
	},
	description: 'Storybook fixture for the group-chat waiting area.',
	slug: 'selbsthilfe',
	languageFormal: false,
	welcomeScreen: {
		anonymous: {
			title: 'Willkommen',
			text: ''
		}
	}
} as unknown as ConsultingTypeInterface;

// Asker viewer: sees the waiting area with the disabled join button until the
// counsellor starts the chat.
const storyUserData = {
	userId: 'asker-storybook',
	userName: 'ruhiges-yak-kim',
	displayName: 'Ruhiges Yak Kim',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
	userRoles: ['USER'],
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

const pad = (value: number) => String(value).padStart(2, '0');

/** Group-chat session whose planned start is `deltaSeconds` from now. */
const buildWaitingSession = (
	deltaSeconds: number
): ExtendedSessionInterface => {
	const start = new Date(Date.now() + deltaSeconds * 1000);
	return buildExtendedSession(
		{
			consultant: {
				consultantId: 'consultant-storybook',
				id: 'consultant-storybook',
				username: 'beraterin@example.invalid',
				displayName: 'Beraterin ORISO',
				absent: false,
				absenceMessage: ''
			},
			language: 'de',
			chat: {
				active: false,
				assignedAgencies: [],
				attachment: null,
				consultingType: 1,
				duration: 90,
				matrixRoomId: 'sb-waiting-room-9001',
				hintMessage: WELCOME,
				sourceLanguage: 'de',
				hintMessageTranslations: { de: WELCOME },
				groupChatRulesTranslations: { de: RULES },
				id: 9001,
				lastMessage: null,
				e2eLastMessage: null,
				messageDate: Math.floor(start.getTime() / 1000),
				messagesRead: true,
				moderators: [],
				repetitive: false,
				startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
				startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}:${pad(start.getSeconds())}`,
				subscribed: true,
				topic: 'Gemeinsam stark — Selbsthilfe',
				createdAt: '2026-03-18T06:15:00.000Z'
			} as unknown as GroupChatItemInterface
		} as ListItemInterface,
		''
	);
};

/* ------------------------------------------------------------------ *
 * Providers (SessionHeader.stories pattern)
 * ------------------------------------------------------------------ */

const matrixClientService = {
	getClient: () => ({
		getRoom: () => null,
		getRooms: () => []
	})
} as any;

const StoryProviders = ({
	session,
	children
}: {
	session: ExtendedSessionInterface;
	children: React.ReactNode;
}) => (
	<div style={{ maxWidth: 920, margin: '0 auto', background: '#fcf9f9' }}>
		<UserDataContext.Provider
			value={{
				userData: storyUserData,
				setUserData: () => {},
				reloadUserData: async () => storyUserData
			}}
		>
			<SessionTypeContext.Provider
				value={{
					type: SESSION_LIST_TYPES.MY_SESSION,
					path: '/sessions/user/view'
				}}
			>
				<ConsultingTypesContext.Provider
					value={{
						consultingTypes: [storyConsultingType],
						setConsultingTypes: () => {}
					}}
				>
					<TopicsContext.Provider
						value={{
							topics: [storyTopic],
							refreshTopics: () => {}
						}}
					>
						<SessionsDataContext.Provider
							value={{
								ready: true,
								sessions: [],
								dispatch: () => {}
							}}
						>
							<E2EEContext.Provider
								value={{
									key: '',
									reloadPrivateKey: () => {},
									isE2eeEnabled: false,
									e2EEReady: true
								}}
							>
								<ConsultantListContext.Provider
									value={{
										consultantList: [],
										setConsultantList: () => {}
									}}
								>
									<ServerSettingsContext.Provider
										value={{
											settings: [],
											settingsReady: true,
											getSetting: () => null
										}}
									>
										<MatrixClientContext.Provider
											value={{
												matrixClientService,
												setMatrixClientService: () => {}
											}}
										>
											<ActiveSessionContext.Provider
												value={{
													activeSession: session,
													reloadActiveSession:
														() => {},
													readActiveSession: () => {}
												}}
											>
												{children}
											</ActiveSessionContext.Provider>
										</MatrixClientContext.Provider>
									</ServerSettingsContext.Provider>
								</ConsultantListContext.Provider>
							</E2EEContext.Provider>
						</SessionsDataContext.Provider>
					</TopicsContext.Provider>
				</ConsultingTypesContext.Provider>
			</SessionTypeContext.Provider>
		</UserDataContext.Provider>
	</div>
);

/* ------------------------------------------------------------------ *
 * Meta + stories
 * ------------------------------------------------------------------ */

const meta = {
	title: 'GroupChat/JoinGroupChatView',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: {
			initialPath: '/sessions/user/view/sb-waiting-room-9001/9001'
		},
		docs: {
			description: {
				component:
					'The whole group-chat waiting area as askers see it: session header, waiting box (WaitingAreaCountdown, ORISO Design 4a/4b), netiquette rules and the join button. The waiting box is one building block inside this existing view — not a standalone screen.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Planned start ~2 days away — the 4a countdown with flip cards. */
export const WaitingFuture: Story = {
	render: () => (
		<StoryProviders
			session={buildWaitingSession(2 * 86400 + 3 * 3600 + 21 * 60 + 50)}
		>
			<JoinGroupChatView />
		</StoryProviders>
	)
};

/** Planned start 4 minutes ago — the 4b overdue state counting up. */
export const WaitingOverdue: Story = {
	render: () => (
		<StoryProviders session={buildWaitingSession(-252)}>
			<JoinGroupChatView />
		</StoryProviders>
	)
};
