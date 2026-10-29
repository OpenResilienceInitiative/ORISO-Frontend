import * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { SessionsListToolbar } from '../sessionsList/SessionsListToolbar';
import { ResizableHandle } from '../sessionsList/ResizableHandle';
import type { SessionToolbarChipFilter } from '../sessionsList/sessionToolbarFilters';
import { SessionListItemComponent } from '../sessionsListItem/SessionListItemComponent';
import { SessionHeaderComponent } from '../sessionHeader/SessionHeaderComponent';
import { MessageTimeline } from '../session/MessageTimeline';
import type { MessageItem } from '../message/MessageItemComponent';
import { mockE2eeParams } from '../message/MessageItemComponent.mocks';
import { ComposerStoryDecorator } from '../messageSubmitInterface/__storybook__/composerStoryDecorator';
import { buildStageMatrixClientService } from '../chatStage/__storybook__/ChatStageProviders';
import { ServerSettingsContext } from '../../globalState/provider/ServerSettingsProvider';
import { useResponsive } from '../../hooks/useResponsive';
import { AVATAR_SIZES } from '../pseudonym/avatarSizes';
import { MessageSubmitInterfaceComponent } from '../messageSubmitInterface/messageSubmitInterfaceComponent';
import {
	ActiveSessionContext,
	AppConfigContext,
	AUTHORITIES,
	buildExtendedSession,
	ConsultantListContext,
	ConsultingTypesContext,
	E2EEContext,
	LocaleContext,
	NotificationsContext,
	REMOVE_SESSIONS,
	SessionTypeContext,
	SessionsDataContext,
	SET_SESSIONS,
	TopicsContext,
	UPDATE_SESSIONS,
	UserDataContext
} from '../../globalState';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import {
	ListItemInterface,
	REGISTRATION_TYPE_REGISTERED,
	STATUS_ACTIVE,
	STATUS_ENQUIRY
} from '../../globalState/interfaces/SessionsDataInterface';
import type {
	ConsultingTypeInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { LanguagesContext } from '../../globalState/provider/LanguagesProvider';
import { Routing } from './Routing';
import { config } from '../../resources/scripts/config';
import { NavigationStoryShell } from './NavigationStoryShell';
import './consultantChatStory.styles.scss';
import './authenticatedApp.styles.scss';
import './navigation.styles.scss';
import '../sessionsList/sessionsList.styles.scss';
import '../sessionsListItem/sessionsListItem.styles.scss';
import '../message/message.styles.scss';
import '../messageSubmitInterface/messageSubmitInterface.styles';
import '../session/session.styles.scss';
import '../chatStage/chatStage.styles.scss';
import '../sessionMenu/sessionMenu.styles.scss';
import '../chatMenuDropdown/chatMenuDropdown.styles.scss';
import { focusSessionChromeOnPointerDown } from '../session/focusSessionChrome';

const APP_ORISO_CHAT_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1320-38278&m=dev';
const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';

const searchPeopleResults = [
	{
		id: 'active-chat',
		name: 'Sanftes Alpaka Kala',
		subtitle: 'Suchtprobleme'
	},
	{
		id: 'direct-chat',
		name: 'ruhiges Yak Kim',
		subtitle: 'Familienberatung'
	},
	{ id: 'admins', name: 'Träger Admins Caritas', subtitle: 'Interna' }
];

const labelFallbacks: Record<string, string> = {
	'sessionList.toolbar.search.toggle': 'Suche öffnen oder schließen',
	'sessionList.toolbar.search.placeholder': 'Suche',
	'sessionList.toolbar.search.label': 'Suche',
	'sessionList.toolbar.search.clear': 'Suche löschen',
	'sessionList.toolbar.search.removeSelectedPerson': 'Person entfernen',
	'sessionList.toolbar.chips.unread': 'Ungelesen',
	'sessionList.toolbar.chips.drafts': 'Entwürfe',
	'sessionList.toolbar.chips.nearby': 'Mail',
	'sessionList.toolbar.chips.liveChat': 'Live Chat',
	'sessionList.toolbar.chips.internalGroup': 'Interner Gruppenchat',
	'sessionList.toolbar.chips.supervision': 'Supervision',
	'sessionList.toolbar.chips.groups': 'Gesprächskreis'
};

const translate = (key: string) => labelFallbacks[key] || key;

const storybookConsultant = {
	consultantId: 'consultant-storybook',
	id: 'consultant-storybook',
	username: 'beraterin@example.invalid',
	displayName: 'Beraterin ORISO',
	absent: false,
	absenceMessage: ''
};

const mockUserData = {
	userId: 'consultant-storybook',
	userName: 'beraterin@example.invalid',
	displayName: 'Beraterin ORISO',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	agencies: [],
	emailToggles: [],
	e2eEncryptionEnabled: false,
	formalLanguage: false,
	hasArchive: true,
	isDisplayNameEditable: true,
	preferredLanguage: 'de',
	userRoles: [],
	termsAndConditionsConfirmation: '',
	dataPrivacyConfirmation: '',
	isWalkThroughEnabled: false,
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

const appOrisoRouterSettings = {
	...config,
	useOverviewPage: false
} as any;

const runtimeTopics: TopicsDataInterface[] = [
	{
		id: 1,
		name: 'Familienberatung',
		slug: 'familienberatung',
		description: 'Beratung für Familien, Eltern und junge Menschen.',
		internalIdentifier: 'familienberatung',
		status: 'active',
		createDate: '2026-03-01T00:00:00.000Z',
		updateDate: '2026-03-01T00:00:00.000Z',
		fallbackUrl: '',
		titles: {
			short: 'Familie',
			long: 'Familienberatung',
			registrationDropdown: 'Familienberatung',
			welcome: 'Familienberatung'
		}
	},
	{
		id: 2,
		name: 'Suchtprobleme',
		slug: 'suchtprobleme',
		description: 'Beratung zu Sucht, Rückfall und Stabilisierung.',
		internalIdentifier: 'suchtprobleme',
		status: 'active',
		createDate: '2026-03-01T00:00:00.000Z',
		updateDate: '2026-03-01T00:00:00.000Z',
		fallbackUrl: '',
		titles: {
			short: 'Sucht',
			long: 'Suchtprobleme',
			registrationDropdown: 'Suchtprobleme',
			welcome: 'Suchtprobleme'
		}
	}
];

const runtimeConsultingTypes: ConsultingTypeInterface[] = [
	{
		id: 1,
		showAskerProfile: true,
		titles: {
			default: '1-1 Beratung',
			short: '1-1',
			long: '1-1 Beratung',
			welcome: 'Willkommen',
			registrationDropdown: '1-1 Beratung'
		},
		isVideoCallAllowed: true,
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
			isGroupChat: false,
			groupChatRules: ['']
		},
		description: 'Storybook runtime fixture for consultant session rows.',
		slug: 'one-on-one',
		languageFormal: true,
		welcomeScreen: {
			anonymous: {
				title: 'Willkommen',
				text: ''
			}
		}
	},
	{
		id: 2,
		showAskerProfile: false,
		titles: {
			default: 'Interner Gruppenchat',
			short: 'Gruppe',
			long: 'Interner Gruppenchat',
			welcome: 'Willkommen',
			registrationDropdown: 'Interner Gruppenchat'
		},
		isVideoCallAllowed: false,
		isSubsequentRegistrationAllowed: false,
		urls: {
			registrationPostcodeFallbackUrl: '',
			requiredAidMissingRedirectUrl: ''
		},
		registration: {
			autoSelectAgency: true,
			autoSelectPostcode: true,
			notes: {}
		},
		groupChat: {
			isGroupChat: true,
			groupChatRules: ['']
		},
		description: 'Storybook runtime fixture for internal group rows.',
		slug: 'internal-group',
		languageFormal: true,
		welcomeScreen: {
			anonymous: {
				title: 'Willkommen',
				text: ''
			}
		}
	}
];

const runtimeSessions: ListItemInterface[] = [
	{
		user: {
			username: 'ratsuchende@example.invalid',
			displayName: 'Ratsuchende...',
			sessionData: {}
		},
		consultant: storybookConsultant,
		language: 'de',
		session: {
			id: 3361,
			agencyId: 101,
			askerMatrixUserId: 'asker-3361',
			attachment: null,
			consultingType: 1,
			matrixRoomId: 'storybook-room-3361',
			e2eLastMessage: null,
			lastMessage: 'Das soll aber einzigartig',
			messageDate: 1773830100,
			createDate: '2026-03-18T08:15:00.000Z',
			messagesRead: false,
			postcode: 10115,
			registrationType: REGISTRATION_TYPE_REGISTERED,
			status: STATUS_ENQUIRY,
			videoCallMessageDTO: null,
			topic: runtimeTopics[0]
		}
	},
	{
		user: {
			username: 'ratsuchender-r3@example.invalid',
			displayName: 'Ratsuchender R3',
			sessionData: {}
		},
		consultant: storybookConsultant,
		language: 'de',
		session: {
			id: 3362,
			agencyId: 101,
			askerMatrixUserId: 'asker-3362',
			attachment: null,
			consultingType: 1,
			matrixRoomId: 'storybook-room-3362',
			e2eLastMessage: null,
			lastMessage: 'Ja das ist schön das sie das...',
			messageDate: 1773826500,
			createDate: '2026-03-18T07:15:00.000Z',
			messagesRead: true,
			postcode: 99322,
			registrationType: REGISTRATION_TYPE_REGISTERED,
			status: STATUS_ACTIVE,
			videoCallMessageDTO: null,
			topic: runtimeTopics[1]
		}
	},
	{
		user: {
			username: 'ruhiges-yak-kim@example.invalid',
			displayName: 'ruhiges Yak Kim',
			sessionData: {}
		},
		consultant: storybookConsultant,
		language: 'de',
		session: {
			id: 3363,
			agencyId: 101,
			askerMatrixUserId: 'asker-3363',
			attachment: null,
			consultingType: 1,
			matrixRoomId: 'storybook-room-3363',
			e2eLastMessage: null,
			lastMessage: 'Anfrage gesendet',
			messageDate: 1773822900,
			createDate: '2026-03-18T06:15:00.000Z',
			messagesRead: false,
			postcode: 12345,
			registrationType: REGISTRATION_TYPE_REGISTERED,
			status: STATUS_ACTIVE,
			videoCallMessageDTO: null,
			topic: runtimeTopics[0]
		}
	},
	{
		user: {
			username: 'mario-k@example.invalid',
			displayName: 'Mario K',
			sessionData: {}
		},
		consultant: storybookConsultant,
		language: 'de',
		chat: {
			id: 9001,
			active: true,
			assignedAgencies: [],
			attachment: null,
			consultingType: 2,
			duration: 60,
			matrixRoomId: 'storybook-group-caritas',
			hintMessage: '',
			lastMessage: 'Mario K: Das ist schon komisch mit d...',
			messageDate: 1773740100,
			messagesRead: false,
			moderators: ['consultant-storybook'],
			repetitive: false,
			startDate: '2026-03-17',
			startTime: '10:00',
			subscribed: true,
			topic: 'Träger Admins Caritas',
			createdAt: '2026-03-17T10:00:00.000Z',
			e2eLastMessage: null
		}
	}
];

const runtimeAgency = {
	id: 101,
	name: 'Caritas Beratungszentrum Mitte',
	description: 'Storybook agency fixture for the App.Oriso consultant shell.',
	city: 'Berlin',
	postcode: '10115',
	consultingType: 1,
	offline: false,
	external: false,
	tenantId: 1,
	topicIds: [1, 2],
	agencyLogo: ''
};

const runtimeDrafts = [
	{
		id: 1,
		scopeKey: 'session:3363',
		text: 'Ich melde mich gleich mit einem konkreten Vorschlag.',
		title: 'Sanftes Alpaka Kala',
		sourceSessionId: 3363,
		actionPath: '/sessions/consultant/sessionView/session/3363',
		updatedAt: '2026-03-18T08:22:00.000Z'
	},
	{
		id: 2,
		scopeKey: 'session:3362',
		text: 'Danke für die Nachricht, ich prüfe das.',
		title: 'Ratsuchender R3',
		sourceSessionId: 3362,
		actionPath: '/sessions/consultant/sessionView/session/3362',
		updatedAt: '2026-03-18T07:32:00.000Z'
	}
];

const storybookJsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

const requestUrl = (input: RequestInfo | URL): string => {
	if (typeof input === 'string') {
		return input;
	}
	if (input instanceof URL) {
		return input.toString();
	}
	return input.url;
};

const findRuntimeSession = (id: number) =>
	runtimeSessions.find(
		(session) => session.session?.id === id || session.chat?.id === id
	);

let appOrisoRoutingFetchMockDepth = 0;
let appOrisoRoutingOriginalFetch: typeof globalThis.fetch | null = null;

const installAppOrisoRoutingFetchMocks = () => {
	appOrisoRoutingFetchMockDepth += 1;

	const restoreFetchMock = () => {
		appOrisoRoutingFetchMockDepth = Math.max(
			0,
			appOrisoRoutingFetchMockDepth - 1
		);
		if (
			appOrisoRoutingFetchMockDepth === 0 &&
			appOrisoRoutingOriginalFetch
		) {
			globalThis.fetch = appOrisoRoutingOriginalFetch;
			appOrisoRoutingOriginalFetch = null;
		}
	};

	if (appOrisoRoutingOriginalFetch) {
		return restoreFetchMock;
	}

	const originalFetch = globalThis.fetch.bind(globalThis);
	appOrisoRoutingOriginalFetch = originalFetch;

	globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = requestUrl(input);
		if (!url.includes('api.storybook.test')) {
			return originalFetch(input, init);
		}

		const parsed = new URL(url);
		const { pathname } = parsed;

		if (
			pathname === '/service/users/sessions/consultants' ||
			pathname ===
				'/service/conversations/consultants/enquiries/registered'
		) {
			return storybookJsonResponse({
				sessions: runtimeSessions,
				total: runtimeSessions.length
			});
		}

		if (pathname === '/service/users/sessions/room') {
			const ids = (parsed.searchParams.get('roomIds[]') || '')
				.split(',')
				.filter(Boolean);
			const sessions = ids.length
				? runtimeSessions.filter((session) =>
						ids.includes(
							session.session?.matrixRoomId ||
								session.chat?.matrixRoomId ||
								''
						)
					)
				: runtimeSessions;
			return storybookJsonResponse({ sessions });
		}

		const sessionRoomMatch = pathname.match(
			/^\/service\/users\/sessions\/room\/(\d+)$/
		);
		if (sessionRoomMatch) {
			const session = findRuntimeSession(Number(sessionRoomMatch[1]));
			return storybookJsonResponse({
				sessions: session ? [session] : []
			});
		}

		const chatRoomMatch = pathname.match(
			/^\/service\/users\/chat\/room\/(\d+)$/
		);
		if (chatRoomMatch) {
			const session = findRuntimeSession(Number(chatRoomMatch[1]));
			return storybookJsonResponse({
				sessions: session ? [session] : []
			});
		}

		if (pathname === '/service/users/drafts') {
			return storybookJsonResponse({
				items: runtimeDrafts,
				page: Number(parsed.searchParams.get('page') || 0),
				perPage: Number(parsed.searchParams.get('perPage') || 200)
			});
		}

		if (pathname === '/service/messages') {
			return storybookJsonResponse({ messages: [] });
		}

		if (pathname === '/service/agencies/101') {
			return storybookJsonResponse([runtimeAgency]);
		}

		if (pathname === '/service/users/chat/3363') {
			return storybookJsonResponse({
				active: true,
				matrixRoomId: 'storybook-room-3363',
				id: 3363,
				bannedUsers: []
			});
		}

		if (pathname === '/api/v1/subscriptions.read') {
			return storybookJsonResponse({ success: true });
		}

		return storybookJsonResponse(
			{ error: `Unhandled App.Oriso Storybook mock path: ${pathname}` },
			404
		);
	};

	return restoreFetchMock;
};

function RuntimeSessionsDataProvider({
	children
}: {
	children: React.ReactNode;
}) {
	const [state, setState] = useState({
		ready: true,
		sessions: runtimeSessions
	});

	const dispatch = React.useCallback((action: any) => {
		switch (action.type) {
			case SET_SESSIONS:
				setState({
					ready: action.ready ?? true,
					sessions: action.sessions || []
				});
				break;
			case UPDATE_SESSIONS:
				setState((previous) => {
					const sessions = [...previous.sessions];
					(action.sessions || []).forEach((nextSession) => {
						const nextId =
							nextSession.session?.id ??
							nextSession.chat?.id ??
							nextSession.session?.matrixRoomId ??
							nextSession.chat?.matrixRoomId;
						const index = sessions.findIndex(
							(session) =>
								(session.session?.id ??
									session.chat?.id ??
									session.session?.matrixRoomId ??
									session.chat?.matrixRoomId) === nextId
						);
						if (index >= 0) {
							sessions.splice(index, 1, nextSession);
						} else {
							sessions.push(nextSession);
						}
					});
					return {
						ready: action.ready ?? previous.ready,
						sessions
					};
				});
				break;
			case REMOVE_SESSIONS:
				setState((previous) => ({
					ready: action.ready ?? previous.ready,
					sessions: previous.sessions.filter((session) => {
						const ids = [
							session.session?.id,
							session.chat?.id,
							session.session?.matrixRoomId,
							session.chat?.matrixRoomId
						].filter(Boolean);
						return !ids.some((id) => action.ids?.includes(id));
					})
				}));
				break;
			default:
				break;
		}
	}, []);

	return (
		<SessionsDataContext.Provider
			value={{
				ready: state.ready,
				sessions: state.sessions,
				dispatch
			}}
		>
			{children}
		</SessionsDataContext.Provider>
	);
}

function AppOrisoRoutingRuntimeProviders({
	children
}: {
	children: React.ReactNode;
}) {
	const notificationNoop = () => {};

	return (
		<AppConfigContext.Provider value={appOrisoRouterSettings}>
			<LocaleContext.Provider
				value={{
					locale: 'de',
					initLocale: 'de',
					locales: ['de', 'en'],
					selectableLocales: ['de', 'en'],
					setLocale: () => {}
				}}
			>
				<UserDataContext.Provider
					value={{
						userData: mockUserData,
						reloadUserData: async () => mockUserData,
						setUserData: () => {}
					}}
				>
					<ConsultingTypesContext.Provider
						value={{
							consultingTypes: runtimeConsultingTypes,
							setConsultingTypes: () => {}
						}}
					>
						<TopicsContext.Provider
							value={{
								topics: runtimeTopics,
								refreshTopics: () => {}
							}}
						>
							<LanguagesContext.Provider
								value={{
									fixed: ['de'],
									spoken: ['de', 'en']
								}}
							>
								<RuntimeSessionsDataProvider>
									<ConsultantListContext.Provider
										value={{
											consultantList: [],
											setConsultantList: () => {}
										}}
									>
										<NotificationsContext.Provider
											value={{
												notifications: [],
												notificationFeed: [],
												unreadNotificationCount: 0,
												serverUnreadTotal: 0,
												serverUnreadTotalExcludesHidden: false,
												hasUnreadNotifications: false,
												timelineDisplayFilter: {
													kinds: {},
													autoReadHidden: false
												},
												visibleUnreadCount: 0,
												hiddenUnreadInLoadedPages: 0,
												markNotificationsReadConfirmed:
													async () => {},
												setNotifications:
													notificationNoop,
												hasNotification: () => false,
												addNotification:
													notificationNoop,
												addEventNotification:
													notificationNoop,
												refreshNotificationFeed:
													notificationNoop,
												loadOlderNotifications:
													async () => {},
												hasOlderNotifications: false,
												isLoadingOlderNotifications: false,
												olderNotificationsError: false,
												removeNotification:
													notificationNoop,
												markNotificationAsRead:
													notificationNoop,
												markAllNotificationsAsRead:
													notificationNoop,
												clearNotificationFeed:
													notificationNoop
											}}
										>
											<MatrixClientContext.Provider
												value={{
													matrixClientService: null,
													setMatrixClientService:
														() => {}
												}}
											>
												{children}
											</MatrixClientContext.Provider>
										</NotificationsContext.Provider>
									</ConsultantListContext.Provider>
								</RuntimeSessionsDataProvider>
							</LanguagesContext.Provider>
						</TopicsContext.Provider>
					</ConsultingTypesContext.Provider>
				</UserDataContext.Provider>
			</LocaleContext.Provider>
		</AppConfigContext.Provider>
	);
}

function AppOrisoRoutingRuntimeShell() {
	useEffect(() => {
		let previousListWidth: string | null = null;
		let previousLiveChatAvailability: string | null = null;
		try {
			previousListWidth = localStorage.getItem('sessionsList_width');
			previousLiveChatAvailability = localStorage.getItem(
				'oriso_liveChatAvailability'
			);
			localStorage.setItem('sessionsList_width', '397');
			localStorage.removeItem('oriso_liveChatAvailability');
		} catch {
			/* Storybook determinism only. */
		}
		return () => {
			try {
				if (previousListWidth == null) {
					localStorage.removeItem('sessionsList_width');
				} else {
					localStorage.setItem(
						'sessionsList_width',
						previousListWidth
					);
				}
				if (previousLiveChatAvailability == null) {
					localStorage.removeItem('oriso_liveChatAvailability');
				} else {
					localStorage.setItem(
						'oriso_liveChatAvailability',
						previousLiveChatAvailability
					);
				}
			} catch {
				/* Storybook cleanup only. */
			}
		};
	}, []);

	return (
		<div className="appOrisoRoutingRuntime">
			<style>
				{`
					.appOrisoRoutingRuntime {
						height: 860px;
						min-height: 720px;
						background: #eae7e8;
						overflow: hidden;
					}

					.appOrisoRoutingRuntime .app__wrapper {
						height: 860px;
						min-height: 720px;
						background: #eae7e8;
					}

					.appOrisoRoutingRuntime .contentWrapper {
						min-width: 0;
						background: #eae7e8;
					}

					.appOrisoRoutingRuntime .contentWrapper__content {
						min-width: 0;
					}

					.appOrisoRoutingRuntime .contentWrapper__list {
						flex: 0 0 397px;
						width: 397px;
						max-width: 397px;
					}

					.appOrisoRoutingRuntime .contentWrapper__detail {
						min-width: 0;
					}
				`}
			</style>
			<AppOrisoRoutingRuntimeProviders>
				<Routing logout={() => {}} />
			</AppOrisoRoutingRuntimeProviders>
		</div>
	);
}

function RuntimeSidebar() {
	return (
		<NavigationStoryShell
			role="consultant"
			className="appOrisoRuntimeRail"
			onLogout={() => {}}
		/>
	);
}

function AppOrisoRuntimeProviders({
	children,
	sessions = runtimeSessions
}: {
	children: React.ReactNode;
	sessions?: ListItemInterface[];
}) {
	return (
		<UserDataContext.Provider
			value={{
				userData: mockUserData,
				reloadUserData: async () => mockUserData,
				setUserData: () => {}
			}}
		>
			<SessionTypeContext.Provider
				value={{
					type: SESSION_LIST_TYPES.MY_SESSION,
					path: '/sessions/consultant/sessionView'
				}}
			>
				<ConsultingTypesContext.Provider
					value={{
						consultingTypes: runtimeConsultingTypes,
						setConsultingTypes: () => {}
					}}
				>
					<TopicsContext.Provider
						value={{
							topics: runtimeTopics,
							refreshTopics: () => {}
						}}
					>
						<SessionsDataContext.Provider
							value={{
								ready: true,
								sessions,
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
								<LegalLinksContext.Provider value={[]}>
									{children}
								</LegalLinksContext.Provider>
							</E2EEContext.Provider>
						</SessionsDataContext.Provider>
					</TopicsContext.Provider>
				</ConsultingTypesContext.Provider>
			</SessionTypeContext.Provider>
		</UserDataContext.Provider>
	);
}

/** Matches SessionsList neighbour-corner wiring for the stacked card group. */
const STORY_ACTIVE_SESSION_ID = 3363;

function isRuntimeSessionActive(session: ListItemInterface) {
	return (
		session.session?.id === STORY_ACTIVE_SESSION_ID ||
		session.chat?.id === STORY_ACTIVE_SESSION_ID
	);
}

function RealSessionListItem({
	session,
	index,
	isBeforeActive = false,
	isAfterActive = false
}: {
	session: ListItemInterface;
	index: number;
	isBeforeActive?: boolean;
	isAfterActive?: boolean;
}) {
	const activeSession = buildExtendedSession(session, '');

	return (
		<ActiveSessionContext.Provider
			value={{
				activeSession,
				reloadActiveSession: () => {},
				readActiveSession: () => {}
			}}
		>
			<SessionListItemComponent
				defaultLanguage="de"
				handleKeyDownLisItemContent={() => {}}
				index={index}
				isBeforeActive={isBeforeActive}
				isAfterActive={isAfterActive}
			/>
		</ActiveSessionContext.Provider>
	);
}

function SessionListPanel({
	width,
	onResize
}: {
	width: number;
	onResize: (width: number) => void;
}) {
	const [search, setSearch] = useState('');
	const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
	const [chip, setChip] = useState<SessionToolbarChipFilter | null>('drafts');
	const listScrollRef = useRef<HTMLDivElement | null>(null);

	return (
		<aside style={styles.listPanel}>
			<AppOrisoRuntimeProviders sessions={consultantChatSessions}>
				<div className="sessionsList__innerWrapper">
					<SessionsListToolbar
						translate={translate}
						searchValue={search}
						onSearchChange={setSearch}
						searchPeopleResults={searchPeopleResults}
						selectedPersonIds={selectedPeople}
						onSelectedPersonIdsChange={setSelectedPeople}
						activeChip={chip}
						onChipToggle={(nextChip) =>
							setChip((previousChip) =>
								previousChip === nextChip ? null : nextChip
							)
						}
						showConsultantActions
						showCreateGroupChatAction
						showSupervisionChip
						showLiveChatChip
						createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
						archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
						archiveTabActive={false}
						createGroupChatActive={false}
						chipCounts={{
							unread: 4,
							drafts: 2,
							groups: 3,
							liveChat: 1,
							supervision: 1
						}}
					/>
					<div className="sessionsList__scrollArea">
						<div
							ref={listScrollRef}
							className="sessionsList__scrollContainer sessionsList__scrollContainer--hasToolbar"
							style={styles.listScroll}
							role="list"
							aria-label="Conversations"
						>
							{consultantChatSessions.map((session, index) => (
								<RealSessionListItem
									key={
										session.session?.id ??
										session.chat?.id ??
										index
									}
									session={session}
									index={index}
									isBeforeActive={
										!!consultantChatSessions[index + 1] &&
										isRuntimeSessionActive(
											consultantChatSessions[index + 1]
										)
									}
									isAfterActive={
										!!consultantChatSessions[index - 1] &&
										isRuntimeSessionActive(
											consultantChatSessions[index - 1]
										)
									}
								/>
							))}
						</div>
					</div>
				</div>
				<ResizableHandle
					currentWidth={width}
					onResize={onResize}
					scrollTargetRef={listScrollRef}
					maxWidth={500}
				/>
			</AppOrisoRuntimeProviders>
		</aside>
	);
}

const consultantMatrixId = '@consultant-storybook:oriso.invalid';
const runtimeChatListItem = runtimeSessions.find(
	(item) => item.session?.id === STORY_ACTIVE_SESSION_ID
)!;
const consultantChatListItem: ListItemInterface = {
	...runtimeChatListItem,
	user: {
		...runtimeChatListItem.user,
		username: 'sanftes.alpaka.kala@oriso.invalid',
		displayName: 'Sanftes Alpaka Kala'
	},
	session: {
		...runtimeChatListItem.session,
		askerMatrixUserId: '@sanftes.alpaka:oriso.invalid',
		consultantMatrixUserId: consultantMatrixId,
		matrixRoomId: '!storybook-room-3363:oriso.invalid',
		topic: runtimeTopics[1]
	}
};
const consultantChatSessions = runtimeSessions.map((item) =>
	item.session?.id === STORY_ACTIVE_SESSION_ID ? consultantChatListItem : item
);
const consultantChatSession = buildExtendedSession(consultantChatListItem);
const chatRoomMembers = [
	{
		userId: consultantChatSession.item.askerMatrixUserId,
		name: 'Sanftes Alpaka Kala'
	},
	{ userId: consultantMatrixId, name: storybookConsultant.displayName }
];
const chatMatrixService = buildStageMatrixClientService({}, chatRoomMembers);
chatMatrixService.getClient().getUserId = () => consultantMatrixId;
const chatEmptyDraftScopes = [
	`scope:${consultantChatSession.item.id}|thread:main`,
	`scope:${consultantChatSession.rid}|thread:main`
];
const chatMessages: MessageItem[] = [
	{
		_id: '$consultant-chat-1',
		message:
			'Ich habe heute wieder starkes Verlangen und brauche kurz Orientierung.',
		messageDate: { str: 'Heute', date: null },
		messageTime: String(new Date('2026-03-18T09:18:00+01:00').getTime()),
		displayName: 'Sanftes Alpaka Kala',
		username: 'sanftes.alpaka.kala@oriso.invalid',
		askerMatrixUserId: consultantChatSession.item.askerMatrixUserId,
		userId: consultantChatSession.item.askerMatrixUserId,
		isNotRead: false,
		t: null,
		rid: consultantChatSession.rid
	},
	{
		_id: '$consultant-chat-2',
		message:
			'Danke, dass du dich meldest. Lass uns zuerst die nächsten 10 Minuten strukturieren.',
		messageDate: { str: '', date: null },
		messageTime: String(new Date('2026-03-18T09:21:00+01:00').getTime()),
		displayName: storybookConsultant.displayName,
		username: storybookConsultant.username,
		askerMatrixUserId: consultantChatSession.item.askerMatrixUserId,
		userId: consultantMatrixId,
		isNotRead: false,
		t: null,
		rid: consultantChatSession.rid
	},
	{
		_id: '$consultant-chat-3',
		message: 'Okay. Ich bin gerade zuhause und kann schreiben.',
		messageDate: { str: '', date: null },
		messageTime: String(new Date('2026-03-18T09:24:00+01:00').getTime()),
		displayName: 'Sanftes Alpaka Kala',
		username: 'sanftes.alpaka.kala@oriso.invalid',
		askerMatrixUserId: consultantChatSession.item.askerMatrixUserId,
		userId: consultantChatSession.item.askerMatrixUserId,
		isNotRead: false,
		t: null,
		rid: consultantChatSession.rid
	}
];
const noop = () => {};

/** One identity/provider scope for the production header, timeline and composer. */
function ConsultantChatProviders({ children }: { children: React.ReactNode }) {
	return (
		<AppOrisoRuntimeProviders sessions={consultantChatSessions}>
			<ServerSettingsContext.Provider
				value={{
					settings: [],
					settingsReady: true,
					getSetting: () => null
				}}
			>
				<ConsultantListContext.Provider
					value={{ consultantList: [], setConsultantList: noop }}
				>
					<ComposerStoryDecorator
						activeSession={consultantChatSession}
						userData={mockUserData}
						roomMembers={chatRoomMembers}
						emptyDraftScopes={chatEmptyDraftScopes}
						emptyDraftIndex
					>
						<MatrixClientContext.Provider
							value={{
								matrixClientService: chatMatrixService,
								setMatrixClientService: noop
							}}
						>
							{children}
						</MatrixClientContext.Provider>
					</ComposerStoryDecorator>
				</ConsultantListContext.Provider>
			</ServerSettingsContext.Provider>
		</AppOrisoRuntimeProviders>
	);
}

function ChatPanel() {
	const { fromL } = useResponsive();
	return (
		<ConsultantChatProviders>
			<section
				className="session chatStage__card"
				tabIndex={-1}
				onMouseDown={focusSessionChromeOnPointerDown}
				aria-label="Chatraum"
			>
				<div className="chatStage__mainPane">
					<div>
						<SessionHeaderComponent
							bannedUsers={[]}
							hideBackButton={!fromL}
							callsInMenu={!fromL}
						/>
					</div>
					<div className="session__content" aria-label="Chatverlauf">
						<MessageTimeline
							messages={chatMessages}
							clientName="Sanftes Alpaka Kala"
							isMyMessage={(userId) =>
								userId === consultantMatrixId
							}
							handleDecryptionErrors={noop}
							handleDecryptionSuccess={noop}
							e2eeParams={mockE2eeParams()}
						/>
					</div>
					<MessageSubmitInterfaceComponent
						className="session__submit-interface"
						placeholder="Nachricht an Klient:in schreiben"
						onSendButton={noop}
						isTyping={noop}
						language="de"
					/>
				</div>
			</section>
		</ConsultantChatProviders>
	);
}

function AppOrisoConsultantChatSurface() {
	const [listWidth, setListWidth] = useState(400);

	return (
		<div
			className="appOrisoConsultantChatStory"
			style={
				{
					'--storybook-session-list-width': `${listWidth}px`
				} as React.CSSProperties
			}
		>
			<RuntimeSidebar />
			<SessionListPanel width={listWidth} onResize={setListWidth} />
			<div aria-hidden="true" />
			<ChatPanel />
		</div>
	);
}

function AppOrisoRoutingFetchMockDecorator({
	children
}: {
	children: React.ReactNode;
}) {
	// A layout effect, so the mocks are in place before the list's first
	// passive-effect fetch (drafts) (#1338).
	useLayoutEffect(() => installAppOrisoRoutingFetchMocks(), []);
	return <>{children}</>;
}

const meta = {
	title: 'App.Oriso/Consultant chat surface',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		backgrounds: { default: 'gray' },
		router: {
			initialPath: '/sessions/consultant/sessionView/session/3363'
		},
		design: [
			{
				type: 'figma',
				name: 'App.Oriso consultant chat',
				url: APP_ORISO_CHAT_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Design System M3 ORISO',
				url: ORISO_M3_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Storybook MCP target for the App.Oriso consultant chat frame. ' +
					'Uses production SCSS for #597 focus rings: session list selected (`2px --m3-primary`), ' +
					'chat panel `.session` active border on chrome focus (not composer selected), ' +
					'session menu trigger shape on `aria-expanded`, and composer/send styles from ' +
					'`messageSubmitInterface` / `sendButton`. Consultant Chat uses the production ' +
					'`SessionHeaderComponent`, `MessageTimeline` and composer with one synthetic identity. ' +
					'The separate runtime shell mounts Routing/SessionsZone ' +
					'with deterministic fixtures so product-code drift stays visible. ' +
					'Below 900px the active chat sits above the full-width production mobile menu. ' +
					'Canonical menu variants: ' +
					'[All menu variants](?path=/docs/components-layout-navigationsidebar--docs), ' +
					'[Consultant desktop](?path=/story/components-layout-navigationsidebar--runtime-consultant-rail), ' +
					'[Consultant short rail](?path=/story/components-layout-navigationsidebar--runtime-consultant-rail-short), ' +
					'[Asker desktop](?path=/story/components-layout-navigationsidebar--runtime-asker-rail), ' +
					'[Consultant mobile](?path=/story/components-layout-navigationsidebar--runtime-consultant-mobile-375-shell), ' +
					'[Asker mobile](?path=/story/components-layout-navigationsidebar--runtime-asker-mobile). ' +
					'For the session list use [Session list column](?path=/story/components-session-list-session-list-column--toolbar-create-chat-and-cards).'
			}
		}
	}
} satisfies Meta<typeof AppOrisoConsultantChatSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConsultantChat: Story = {
	render: () => <AppOrisoConsultantChatSurface />,
	play: async ({ canvasElement }) => {
		const headerTitle = canvasElement.querySelector('.sessionInfo h3');
		await expect(headerTitle).not.toBeNull();
		await expect(headerTitle).toHaveTextContent('Sanftes Alpaka Kala');
		const header = canvasElement.querySelector('.sessionInfo')!;
		const mainPane = canvasElement.querySelector('.chatStage__mainPane')!;
		const topicTags = header.querySelectorAll(
			'.sessionInfo__metaInfo__content'
		);
		await expect(topicTags).toHaveLength(1);
		await expect(topicTags[0]).toHaveTextContent(/^Suchtprobleme$/);
		const topicBounds = topicTags[0].getBoundingClientRect();
		const headerBounds = header.getBoundingClientRect();
		await expect(topicBounds.left).toBeGreaterThanOrEqual(
			headerBounds.left
		);
		await expect(topicBounds.right).toBeLessThanOrEqual(headerBounds.right);
		await expect(topicBounds.bottom).toBeLessThanOrEqual(
			headerBounds.bottom + 1
		);
		const headerAvatars = header.querySelectorAll(
			'[data-cy="session-header-participants"] [data-testid="user-avatar"]'
		);
		await expect(headerAvatars.length).toBeGreaterThan(0);
		for (const avatar of headerAvatars) {
			await expect(Math.round(avatar.getBoundingClientRect().width)).toBe(
				48
			);
		}
		await expect(
			Math.abs(
				header.getBoundingClientRect().width - mainPane.clientWidth
			)
		).toBeLessThanOrEqual(1);
		await expect(header.getBoundingClientRect().right).toBeLessThanOrEqual(
			mainPane.getBoundingClientRect().right + 1
		);
		const titleStyle = getComputedStyle(headerTitle!);
		await expect(titleStyle.whiteSpace).toBe('nowrap');
		await expect(titleStyle.textOverflow).toBe('ellipsis');
		await expect(
			headerTitle!.getBoundingClientRect().height
		).toBeLessThanOrEqual(Number.parseFloat(titleStyle.lineHeight) + 1);
		await expect(
			canvasElement.querySelector('.messageDateDivider__pill')
		).toHaveTextContent('Heute');
		await waitFor(() => {
			expect(
				canvasElement.querySelectorAll('.messageItem__timeRail')
			).toHaveLength(3);
		});
		await expect(
			Array.from(
				canvasElement.querySelectorAll('.messageItem__messageTime')
			).map((time) => time.textContent?.trim())
		).toEqual(['09:18', '09:21', '09:24']);
		await expect(
			canvasElement.querySelectorAll(
				'.messageItem__avatar [data-testid="user-avatar"]'
			)
		).toHaveLength(3);
		await waitFor(() => {
			for (const avatar of canvasElement.querySelectorAll(
				'.messageItem__avatar [data-testid="user-avatar"]'
			)) {
				expect(Math.round(avatar.getBoundingClientRect().width)).toBe(
					AVATAR_SIZES.message
				);
			}
		});
		const timeline =
			canvasElement.querySelector<HTMLElement>('.session__content')!;
		timeline.scrollTop = timeline.scrollHeight;
		await waitFor(() => {
			const lastTime = canvasElement
				.querySelectorAll('.messageItem__timeRail')[2]
				.getBoundingClientRect();
			const composer = canvasElement
				.querySelector('.messageSubmit__wrapper')!
				.getBoundingClientRect();
			expect(lastTime.bottom).toBeLessThanOrEqual(composer.top);
			expect(lastTime.top).toBeGreaterThanOrEqual(
				timeline.getBoundingClientRect().top
			);
		});
		const rail = canvasElement.querySelector('.appOrisoRuntimeRail');
		const navigation = rail?.querySelector('.navigation__wrapper');
		const routes = rail?.querySelectorAll('.navigation__item__top a');
		await expect(rail).not.toBeNull();
		await expect(navigation).not.toBeNull();
		await expect(routes?.length).toBeGreaterThan(1);
		const first = routes![0].getBoundingClientRect();
		const second = routes![1].getBoundingClientRect();
		const bounds = navigation!.getBoundingClientRect();
		if (window.innerWidth >= 900) {
			await expect(second.top).toBeGreaterThan(first.top);
			await expect(Math.abs(second.left - first.left)).toBeLessThan(1);
			await expect(first.right).toBeLessThanOrEqual(bounds.right + 1);
		} else {
			await expect(second.left).toBeGreaterThan(first.left);
			await expect(Math.abs(second.top - first.top)).toBeLessThan(1);
			await expect(bounds.width).toBeGreaterThanOrEqual(
				canvasElement.getBoundingClientRect().width - 1
			);
			await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
			const chat = canvasElement.querySelector(
				'.appOrisoConsultantChatStory > .session'
			);
			await expect(chat).toBeVisible();
			await expect(
				chat!.getBoundingClientRect().bottom
			).toBeLessThanOrEqual(bounds.top);
		}
	}
};

export const ConsultantChatOnPhone: Story = {
	...ConsultantChat,
	globals: { viewport: { value: 'phone375', isRotated: false } }
};

export const RuntimeRoutingShell: Story = {
	name: 'Runtime Routing Shell',
	decorators: [
		(Story) => (
			<AppOrisoRoutingFetchMockDecorator>
				<Story />
			</AppOrisoRoutingFetchMockDecorator>
		)
	],
	render: () => <AppOrisoRoutingRuntimeShell />
};

const styles = {
	listPanel: {
		position: 'relative',
		background: 'var(--m3-surface-container-high, #eae7e8)',
		// Keep the real handle visible in the gutter.
		overflow: 'visible',
		minHeight: 0,
		display: 'flex',
		flexDirection: 'column'
	} satisfies React.CSSProperties,
	listScroll: {
		height: 'calc(100% - 118px)',
		minHeight: 0
	} satisfies React.CSSProperties
};
