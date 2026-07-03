import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import SupervisedUserCircleRoundedIcon from '@mui/icons-material/SupervisedUserCircleRounded';
import { SessionsListToolbar } from '../sessionsList/SessionsListToolbar';
import type { SessionToolbarChipFilter } from '../sessionsList/sessionToolbarFilters';
import { SessionListItemComponent } from '../sessionsListItem/SessionListItemComponent';
import { UserAvatar } from '../message/UserAvatar';
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
	RocketChatContext,
	RocketChatGlobalSettingsContext,
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
import { RocketChatSubscriptionsContext } from '../../globalState/provider/RocketChatSubscriptionsProvider';
import { RocketChatUsersOfRoomContext } from '../../globalState/provider/RocketChatUsersOfRoomProvider';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { LanguagesContext } from '../../globalState/provider/LanguagesProvider';
import { NavigationBar } from './NavigationBar';
import { RouterConfigConsultant } from './RouterConfig';
import { Routing } from './Routing';
import { config } from '../../resources/scripts/config';
import { MenuVerticalIcon } from '../../resources/img/icons';
import {
	SETTING_E2E_ENABLE,
	SETTING_HIDE_SYSTEM_MESSAGES,
	SETTING_MESSAGE_ALLOWDELETING,
	SETTING_MESSAGE_SHOWDELETEDSTATUS,
	type TSetting
} from '../../api/apiRocketChatSettingsPublic';
import './authenticatedApp.styles.scss';
import './navigation.styles.scss';
import '../sessionsList/sessionsList.styles.scss';
import '../sessionsListItem/sessionsListItem.styles.scss';
import '../message/message.styles.scss';
import '../messageSubmitInterface/messageSubmitInterface.styles';

const APP_ORISO_CHAT_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=316-17725&t=XHH5HQNmA8DUWl2U-0';
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
	'sessionList.toolbar.chips.nearby': 'Nearby',
	'sessionList.toolbar.chips.liveChat': 'Live Chat',
	'sessionList.toolbar.chips.internalGroup': 'Interner Gruppenchat',
	'sessionList.toolbar.chips.supervision': 'Supervision',
	'sessionList.toolbar.chips.groups': 'Gesprächskreis'
};

const translate = (key: string) => labelFallbacks[key] || key;

const mockActiveSession = {
	rid: null,
	type: 'session',
	isGroup: false,
	isSession: true,
	item: {
		id: 0,
		agencyId: undefined,
		askerRcId: 'alice',
		groupId: '',
		matrixRoomId: '!storybook:oriso.org',
		postcode: 10115,
		registrationType: REGISTRATION_TYPE_REGISTERED,
		status: STATUS_ACTIVE,
		topic: {
			id: 1,
			name: 'Suchtprobleme',
			description: ''
		},
		moderators: [],
		messageDate: Date.now(),
		messagesRead: false
	},
	user: {
		username: 'sanftes.alpaka.kala@oriso.invalid',
		displayName: 'Sanftes Alpaka Kala',
		sessionData: {}
	},
	consultant: {
		consultantId: 'consultant-storybook',
		id: 'consultant-storybook',
		username: 'beraterin@example.invalid',
		displayName: 'Beraterin ORISO',
		absent: false,
		absenceMessage: ''
	}
} as any;

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
	disableVideoAppointments: true,
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
		consultant: mockActiveSession.consultant,
		language: 'de',
		session: {
			id: 3361,
			agencyId: 101,
			askerRcId: 'asker-3361',
			attachment: null,
			consultingType: 1,
			groupId: 'storybook-room-3361',
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
		consultant: mockActiveSession.consultant,
		language: 'de',
		session: {
			id: 3362,
			agencyId: 101,
			askerRcId: 'asker-3362',
			attachment: null,
			consultingType: 1,
			groupId: 'storybook-room-3362',
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
		consultant: mockActiveSession.consultant,
		language: 'de',
		session: {
			id: 3363,
			agencyId: 101,
			askerRcId: 'asker-3363',
			attachment: null,
			consultingType: 1,
			groupId: 'storybook-room-3363',
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
		consultant: mockActiveSession.consultant,
		language: 'de',
		chat: {
			id: 9001,
			active: true,
			assignedAgencies: [],
			attachment: null,
			consultingType: 2,
			duration: 60,
			groupId: 'storybook-group-caritas',
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
			const ids = (parsed.searchParams.get('rcGroupIds') || '')
				.split(',')
				.filter(Boolean);
			const sessions = ids.length
				? runtimeSessions.filter((session) =>
						ids.includes(
							session.session?.groupId ||
								session.chat?.groupId ||
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
				groupId: 'storybook-room-3363',
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
							nextSession.session?.groupId ??
							nextSession.chat?.groupId;
						const index = sessions.findIndex(
							(session) =>
								(session.session?.id ??
									session.chat?.id ??
									session.session?.groupId ??
									session.chat?.groupId) === nextId
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
							session.session?.groupId,
							session.chat?.groupId
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
	const settings: TSetting[] = [
		{ _id: SETTING_HIDE_SYSTEM_MESSAGES, enterprise: false, value: [] },
		{ _id: SETTING_E2E_ENABLE, enterprise: false, value: false },
		{
			_id: SETTING_MESSAGE_ALLOWDELETING,
			enterprise: false,
			value: false
		},
		{
			_id: SETTING_MESSAGE_SHOWDELETEDSTATUS,
			enterprise: false,
			value: false
		}
	];
	const getSetting = <T extends TSetting>(id: T['_id']): T | null =>
		(settings.find((setting) => setting._id === id) as T) ?? null;

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
									<RocketChatContext.Provider
										value={{
											ready: true,
											send: () => {},
											subscribe: () => {},
											unsubscribe: () => {},
											listen: () => {},
											sendMethod: (async () =>
												settings) as any,
											close: () => {},
											rcWebsocket: null
										}}
									>
										<RocketChatGlobalSettingsContext.Provider
											value={{
												settings,
												settingsReady: true,
												getSetting
											}}
										>
											<RocketChatSubscriptionsContext.Provider
												value={{
													subscriptionsReady: true,
													subscriptions: [],
													roomsReady: true,
													rooms: []
												}}
											>
												<RocketChatUsersOfRoomContext.Provider
													value={{
														ready: true,
														users: [],
														moderators: [],
														total: 3,
														reload: async () => []
													}}
												>
													<ConsultantListContext.Provider
														value={{
															consultantList: [],
															setConsultantList:
																() => {}
														}}
													>
														<NotificationsContext.Provider
															value={{
																notifications:
																	[],
																notificationFeed:
																	[],
																unreadNotificationCount: 0,
																setNotifications:
																	notificationNoop,
																hasNotification:
																	() => false,
																addNotification:
																	notificationNoop,
																addEventNotification:
																	notificationNoop,
																refreshNotificationFeed:
																	notificationNoop,
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
																	matrixClientService:
																		null,
																	setMatrixClientService:
																		() => {}
																}}
															>
																{children}
															</MatrixClientContext.Provider>
														</NotificationsContext.Provider>
													</ConsultantListContext.Provider>
												</RocketChatUsersOfRoomContext.Provider>
											</RocketChatSubscriptionsContext.Provider>
										</RocketChatGlobalSettingsContext.Provider>
									</RocketChatContext.Provider>
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
				'caritas_liveChatAvailability'
			);
			localStorage.setItem('sessionsList_width', '397');
			localStorage.removeItem('caritas_liveChatAvailability');
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
					localStorage.removeItem('caritas_liveChatAvailability');
				} else {
					localStorage.setItem(
						'caritas_liveChatAvailability',
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

class ComposerBoundary extends React.Component<
	{ children: React.ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	render() {
		if (this.state.failed) {
			return <StaticComposerFallback />;
		}
		return this.props.children;
	}
}

function RuntimeSidebar() {
	useEffect(() => {
		let previousLiveChatAvailability: string | null = null;
		try {
			previousLiveChatAvailability = localStorage.getItem(
				'caritas_liveChatAvailability'
			);
			localStorage.removeItem('caritas_liveChatAvailability');
		} catch {
			/* Storybook determinism only. */
		}
		return () => {
			try {
				if (previousLiveChatAvailability == null) {
					localStorage.removeItem('caritas_liveChatAvailability');
				} else {
					localStorage.setItem(
						'caritas_liveChatAvailability',
						previousLiveChatAvailability
					);
				}
			} catch {
				/* Storybook cleanup only. */
			}
		};
	}, []);

	const routerConfig = useMemo(() => {
		return RouterConfigConsultant(appOrisoRouterSettings);
	}, []);
	return (
		<div className="appOrisoRuntimeRail" style={styles.navigationRail}>
			<style>
				{`
					.appOrisoRuntimeRail .navigation__wrapper {
						width: 85px;
						height: 100%;
					}
				`}
			</style>
			<AppOrisoRuntimeProviders>
				<NavigationBar
					routerConfig={routerConfig}
					onLogout={() => {}}
				/>
			</AppOrisoRuntimeProviders>
		</div>
	);
}

function AppOrisoRuntimeProviders({ children }: { children: React.ReactNode }) {
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
								sessions: runtimeSessions,
								dispatch: () => {}
							}}
						>
							<RocketChatSubscriptionsContext.Provider
								value={{
									subscriptionsReady: true,
									subscriptions: [],
									roomsReady: true,
									rooms: []
								}}
							>
								<RocketChatUsersOfRoomContext.Provider
									value={{
										ready: true,
										users: [],
										moderators: [],
										total: 3,
										reload: async () => []
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
								</RocketChatUsersOfRoomContext.Provider>
							</RocketChatSubscriptionsContext.Provider>
						</SessionsDataContext.Provider>
					</TopicsContext.Provider>
				</ConsultingTypesContext.Provider>
			</SessionTypeContext.Provider>
		</UserDataContext.Provider>
	);
}

function RealSessionListItem({
	session,
	index
}: {
	session: ListItemInterface;
	index: number;
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
			/>
		</ActiveSessionContext.Provider>
	);
}

function SessionListPanel() {
	const [search, setSearch] = useState('');
	const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
	const [chip, setChip] = useState<SessionToolbarChipFilter | null>('drafts');

	return (
		<aside style={styles.listPanel}>
			<AppOrisoRuntimeProviders>
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
				<div style={styles.listScroll}>
					{runtimeSessions.map((session, index) => (
						<RealSessionListItem
							key={
								session.session?.id ?? session.chat?.id ?? index
							}
							session={session}
							index={index}
						/>
					))}
				</div>
			</AppOrisoRuntimeProviders>
		</aside>
	);
}

function StaticComposerFallback() {
	return (
		<div style={styles.staticComposer}>
			<div style={styles.toolbarStrip}>
				<span style={styles.iconPill} aria-hidden="true">
					B
				</span>
				<span style={styles.iconPill} aria-hidden="true">
					I
				</span>
				<span style={styles.iconPill} aria-hidden="true">
					@
				</span>
				<span style={styles.iconPill} aria-hidden="true">
					+
				</span>
			</div>
			<div style={styles.staticInput}>
				Nachricht an Klient:in schreiben
			</div>
			<span style={styles.sendButton} aria-hidden="true">
				Senden
			</span>
		</div>
	);
}

function ComposerPreview() {
	const rootRef = React.useRef<HTMLDivElement>(null);

	useEffect(() => {
		const frame = window.requestAnimationFrame(() => {
			rootRef.current
				?.querySelector<HTMLButtonElement>(
					'button[aria-label="Back to full editor tools"]'
				)
				?.click();
		});

		return () => window.cancelAnimationFrame(frame);
	}, []);

	return (
		<div
			ref={rootRef}
			className="session"
			style={styles.composerSessionShell}
		>
			<MatrixClientContext.Provider
				value={{
					matrixClientService: null,
					setMatrixClientService: () => {}
				}}
			>
				<ActiveSessionContext.Provider
					value={{
						activeSession: mockActiveSession,
						reloadActiveSession: () => {}
					}}
				>
					<UserDataContext.Provider
						value={{
							userData: mockUserData,
							reloadUserData: async () => mockUserData,
							setUserData: () => {}
						}}
					>
						<ComposerBoundary>
							<MessageSubmitInterfaceComponent
								placeholder="Nachricht an Klient:in schreiben"
								onSendButton={() => {}}
								isTyping={() => {}}
								language="de"
							/>
						</ComposerBoundary>
					</UserDataContext.Provider>
				</ActiveSessionContext.Provider>
			</MatrixClientContext.Provider>
		</div>
	);
}

function ChatPanel() {
	return (
		<section style={styles.chatPanel}>
			<header style={styles.chatHeader}>
				<div style={styles.chatTitleCluster}>
					<UserAvatar
						username="sanftes.alpaka.kala@oriso.invalid"
						displayName="Sanftes Alpaka Kala"
						userId="active-chat"
						size="32px"
					/>
					<div>
						<div style={styles.chatTitle}>Sanftes Alpaka Kala</div>
					</div>
				</div>
				<div style={styles.headerActions}>
					<button
						type="button"
						aria-label="Audio call preview"
						disabled
						style={{
							...styles.headerActionSoft,
							...styles.previewAction
						}}
					>
						<PhoneRoundedIcon fontSize="small" />
					</button>
					<button
						type="button"
						aria-label="Video call preview"
						disabled
						style={{
							...styles.headerActionPrimary,
							...styles.previewAction
						}}
					>
						<VideocamRoundedIcon fontSize="small" />
					</button>
					<button
						type="button"
						aria-label="Supervision preview"
						disabled
						style={{
							...styles.headerActionAccent,
							...styles.previewAction
						}}
					>
						<SupervisedUserCircleRoundedIcon fontSize="small" />
					</button>
					<button
						type="button"
						aria-label="More actions preview"
						disabled
						style={{
							...styles.headerAction,
							...styles.previewAction
						}}
					>
						<MenuVerticalIcon />
					</button>
				</div>
			</header>
			<div style={styles.topicDivider}>
				<span style={styles.topicPill}>Suchtprobleme</span>
			</div>
			<div style={styles.messageArea} aria-label="Chatverlauf">
				<div className="messageItem__divider" style={styles.dayDivider}>
					Heute
				</div>
				<div className="messageItem" style={styles.messageItem}>
					<div className="messageItem__messageWrap">
						<span className="messageItem__avatar">
							<UserAvatar
								username="sanftes.alpaka.kala@oriso.invalid"
								displayName="Sanftes Alpaka Kala"
								userId="active-chat"
								size="32px"
								ring={false}
							/>
						</span>
						<div className="messageItem__content">
							<div className="messageItem__header">
								<span className="messageItem__username messageItem__username--user">
									Sanftes Alpaka Kala
								</span>
								<span className="messageItem__headerTime">
									09:18
								</span>
							</div>
							<div className="messageItem__message">
								Ich habe heute wieder starkes Verlangen und
								brauche kurz Orientierung.
							</div>
						</div>
					</div>
				</div>
				<div
					className="messageItem messageItem--right"
					style={styles.messageItem}
				>
					<div className="messageItem__messageWrap messageItem__messageWrap--right">
						<div className="messageItem__content">
							<div className="messageItem__header">
								<span className="messageItem__headerTime">
									09:21
								</span>
							</div>
							<div className="messageItem__message">
								Danke, dass du dich meldest. Lass uns zuerst die
								nächsten 10 Minuten strukturieren.
							</div>
						</div>
					</div>
				</div>
				<div className="messageItem" style={styles.messageItem}>
					<div className="messageItem__messageWrap">
						<span className="messageItem__avatar">
							<UserAvatar
								username="sanftes.alpaka.kala@oriso.invalid"
								displayName="Sanftes Alpaka Kala"
								userId="active-chat"
								size="32px"
								ring={false}
							/>
						</span>
						<div className="messageItem__content">
							<div className="messageItem__header">
								<span className="messageItem__username messageItem__username--user">
									Sanftes Alpaka Kala
								</span>
								<span className="messageItem__headerTime">
									09:24
								</span>
							</div>
							<div className="messageItem__message">
								Okay. Ich bin gerade zuhause und kann schreiben.
							</div>
						</div>
					</div>
				</div>
			</div>
			<div style={styles.composerDock}>
				<ComposerPreview />
			</div>
		</section>
	);
}

function AppOrisoConsultantChatSurface() {
	return (
		<div style={styles.viewport}>
			<RuntimeSidebar />
			<SessionListPanel />
			<ChatPanel />
		</div>
	);
}

function AppOrisoRoutingFetchMockDecorator({
	children
}: {
	children: React.ReactNode;
}) {
	useEffect(() => installAppOrisoRoutingFetchMocks(), []);
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
					'Storybook MCP target for the App.Oriso consultant chat frame. The composite story keeps the Figma frame inspectable with real ORISO subcomponents; the runtime shell story mounts the real Routing/SessionsZone path with deterministic session fixtures so product-code drift is visible.'
			}
		}
	}
} satisfies Meta<typeof AppOrisoConsultantChatSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConsultantChat: Story = {
	render: () => <AppOrisoConsultantChatSurface />
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
	viewport: {
		display: 'grid',
		gridTemplateColumns: '85px 397px minmax(0, 1fr)',
		height: 860,
		minHeight: 720,
		background: '#EAE7E8',
		color: '#1D1B20',
		fontFamily:
			'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
		overflow: 'hidden'
	} satisfies React.CSSProperties,
	navigationRail: {
		width: 85,
		height: '100%',
		minHeight: 0,
		background: '#EAE7E8',
		overflow: 'hidden'
	} satisfies React.CSSProperties,
	sidebar: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '24px 10px',
		background: '#EAE7E8'
	} satisfies React.CSSProperties,
	sidebarNav: {
		display: 'flex',
		flexDirection: 'column',
		gap: 14,
		alignItems: 'center'
	} satisfies React.CSSProperties,
	sidebarItem: {
		border: 0,
		background: 'transparent',
		padding: 0,
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		gap: 4,
		color: '#4C555F',
		fontFamily: 'inherit'
	} satisfies React.CSSProperties,
	sidebarButton: {
		width: 48,
		height: 48,
		borderRadius: 12,
		background: '#E4E2E2',
		color: '#4C555F',
		display: 'grid',
		placeItems: 'center'
	} satisfies React.CSSProperties,
	sidebarButtonActive: {
		background: '#FFDAD5',
		border: '1px solid #930008',
		color: '#A5000A'
	} satisfies React.CSSProperties,
	sidebarButtonDark: {
		background: '#410001',
		color: '#FFFFFF'
	} satisfies React.CSSProperties,
	sidebarLabel: {
		fontSize: 11,
		lineHeight: '16px',
		fontWeight: 500,
		color: '#4C555F',
		letterSpacing: 0,
		textAlign: 'center'
	} satisfies React.CSSProperties,
	sidebarLabelActive: {
		color: '#A5000A'
	} satisfies React.CSSProperties,
	listPanel: {
		background: '#EAE7E8',
		padding: '16px 0 0',
		overflow: 'hidden'
	} satisfies React.CSSProperties,
	listScroll: {
		height: 'calc(100% - 118px)',
		overflow: 'hidden auto',
		padding: '0',
		scrollbarWidth: 'none'
	} satisfies React.CSSProperties,
	consultingTypeLabel: {
		marginLeft: 4,
		color: '#4C555F',
		fontSize: 12,
		lineHeight: '16px',
		fontWeight: 500
	} satisfies React.CSSProperties,
	chatPanel: {
		display: 'grid',
		gridTemplateRows: '58px auto minmax(0, 1fr) auto',
		margin: '16px 8px 16px 0',
		background: '#FFFFFF',
		border: '1px solid #FFB4AA',
		borderRadius: 28,
		overflow: 'hidden',
		minWidth: 0
	} satisfies React.CSSProperties,
	chatHeader: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '8px 12px',
		background: '#FFFFFF'
	} satisfies React.CSSProperties,
	chatTitleCluster: {
		display: 'flex',
		alignItems: 'center',
		gap: 8,
		minWidth: 0
	} satisfies React.CSSProperties,
	chatTitle: {
		fontSize: 22,
		lineHeight: '28px',
		fontWeight: 500,
		color: '#4C555F'
	} satisfies React.CSSProperties,
	headerActions: {
		display: 'flex',
		alignItems: 'center',
		gap: 8
	} satisfies React.CSSProperties,
	headerAction: {
		width: 32,
		height: 32,
		borderRadius: 999,
		border: '1px solid #FFDAD5',
		background: '#FFFFFF',
		color: '#410001',
		display: 'grid',
		placeItems: 'center'
	} satisfies React.CSSProperties,
	headerActionSoft: {
		width: 32,
		height: 32,
		borderRadius: 999,
		border: 0,
		background: '#FFE2DE',
		color: '#A5000A',
		display: 'grid',
		placeItems: 'center'
	} satisfies React.CSSProperties,
	headerActionPrimary: {
		width: 32,
		height: 32,
		borderRadius: 12,
		border: 0,
		background: '#A5000A',
		color: '#FFFFFF',
		display: 'grid',
		placeItems: 'center'
	} satisfies React.CSSProperties,
	headerActionAccent: {
		width: 32,
		height: 32,
		borderRadius: 4,
		border: 0,
		background: '#CC1E1C',
		color: '#FFFFFF',
		display: 'grid',
		placeItems: 'center'
	} satisfies React.CSSProperties,
	previewAction: {
		opacity: 1,
		cursor: 'default'
	} satisfies React.CSSProperties,
	topicDivider: {
		borderTop: '1px solid #FFE2DE',
		paddingLeft: 36,
		height: 18,
		background: '#FFFFFF'
	} satisfies React.CSSProperties,
	topicPill: {
		display: 'inline-flex',
		alignItems: 'center',
		height: 20,
		padding: '2px 8px',
		borderRadius: '0 0 4px 4px',
		background: '#FFE2DE',
		color: '#4C555F',
		fontSize: 12,
		lineHeight: '16px',
		fontWeight: 500
	} satisfies React.CSSProperties,
	messageArea: {
		overflow: 'hidden auto',
		background: '#FFFFFF',
		minHeight: 0,
		padding: '32px 40px'
	} satisfies React.CSSProperties,
	messageItem: {
		opacity: 1,
		animation: 'none'
	} satisfies React.CSSProperties,
	dayDivider: {
		opacity: 1,
		animation: 'none'
	} satisfies React.CSSProperties,
	composerDock: {
		padding: '0 12px 10px',
		background: '#FFFFFF'
	} satisfies React.CSSProperties,
	composerSessionShell: {
		position: 'relative',
		display: 'block',
		height: 156,
		minHeight: 156,
		margin: 0,
		border: 0,
		borderRadius: 0,
		background: 'transparent',
		overflow: 'visible'
	} satisfies React.CSSProperties,
	staticComposer: {
		display: 'grid',
		gridTemplateColumns: 'auto minmax(0, 1fr) auto',
		alignItems: 'center',
		gap: 12,
		background: '#FFFFFF',
		border: '1px solid #E4E2E2',
		borderRadius: 8,
		padding: 12
	} satisfies React.CSSProperties,
	toolbarStrip: {
		display: 'flex',
		gap: 6
	} satisfies React.CSSProperties,
	iconPill: {
		width: 32,
		height: 32,
		borderRadius: 16,
		border: '1px solid #E4E2E2',
		background: '#F6F3F3',
		color: '#4C555F',
		fontWeight: 700,
		display: 'grid',
		placeItems: 'center'
	} satisfies React.CSSProperties,
	staticInput: {
		minHeight: 44,
		display: 'flex',
		alignItems: 'center',
		color: '#4C555F'
	} satisfies React.CSSProperties,
	sendButton: {
		minHeight: 44,
		borderRadius: 22,
		border: 0,
		padding: '0 18px',
		background: '#CC1E1C',
		color: '#FFFFFF',
		fontWeight: 700,
		display: 'inline-flex',
		alignItems: 'center'
	} satisfies React.CSSProperties
};
