// Compound styles loaded via preview-head.html
import '../src/resources/styles/styles.scss';
import '../src/resources/styles/mui-variables-mapping.scss';
import i18n from 'i18next';
import { ThemeProvider } from '@mui/material';
import type { Preview } from '@storybook/react-vite';
import * as React from 'react';
import { useEffect } from 'react';
import { useGlobals } from 'storybook/preview-api';
import { I18nextProvider } from 'react-i18next';
import { themes } from 'storybook/theming';
import theme from '../src/resources/scripts/theme';
import { config } from '../src/resources/scripts/config';
import { LegalLinksProvider } from '../src/globalState/provider/LegalLinksProvider';
import { init, FALLBACK_LNG } from '../src/i18n';
import { MemoryRouter } from 'react-router-dom';
import { Loading } from '../src/components/app/Loading';
import { Suspense } from 'react';
import {
	AppConfigContext,
	AppConfigProvider,
	RegistrationContext,
	UserDataContext,
	TenantContext,
	LocaleContext,
	NotificationsContext,
	E2EEContext,
	SessionTypeContext
} from '../src/globalState';
import { Buffer } from 'buffer';

// Some component deps (html parsing in the legal/stage tree) expect Node's Buffer,
// which the app's webpack provided but Vite does not. Polyfill it globally.
if (!(globalThis as any).Buffer) (globalThis as any).Buffer = Buffer;

// Minimal mock user so components that read userData fields render instead of
// crashing on `userData` being null (TwoFactorAuth, Walkthrough, …).
const mockUserData = {
	userId: 'sb-user',
	userName: 'Storybook User',
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
import { UrlParamsContext } from '../src/globalState/provider/UrlParamsProvider';
import { RocketChatPublicSettingsContext } from '../src/globalState/provider/RocketChatPublicSettingsProvider';
import { RocketChatSubscriptionsContext } from '../src/globalState/provider/RocketChatSubscriptionsProvider';
import { RocketChatUsersOfRoomContext } from '../src/globalState/provider/RocketChatUsersOfRoomProvider';
import { RocketChatContext } from '../src/globalState/provider/RocketChatProvider';
import type {
	AgencyDataInterface,
	ConsultingTypeInterface,
	TopicsDataInterface
} from '../src/globalState/interfaces';

// Catch components that throw because they need live app data (session, overlays,
// notification feed, …) that Storybook can't mock. Instead of a red crash, show a
// clean "needs live data" panel. The data-sb-needs-data marker lets the automated
// verification classify these as 'needs-data' rather than as failures.
class StoryErrorBoundary extends React.Component<
	{ children: React.ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	componentDidCatch() {
		/* swallow — the panel below is the user-facing result */
	}
	render() {
		if (this.state.failed) {
			return (
				<div
					data-sb-needs-data="true"
					style={{
						padding: 16,
						margin: 16,
						font: '13px/1.5 system-ui, sans-serif',
						color: '#7a5b00',
						background: '#fff8e1',
						border: '1px solid #ffe082',
						borderRadius: 8,
						maxWidth: 520
					}}
				>
					<strong>⚠ Needs live app data</strong>
					<br />
					This component depends on session / overlay / feed data that
					Storybook doesn’t mock, so it can’t fully render here. Its
					props are in the Docs tab — use the linked Figma design for
					the intended visual.
				</div>
			);
		}
		return this.props.children as any;
	}
}

const storybookTopic = (
	id: number,
	slug: string,
	name: string,
	description: string
): TopicsDataInterface => ({
	id,
	name,
	slug,
	description,
	internalIdentifier: slug,
	status: 'active',
	createDate: '2026-06-30T00:00:00.000Z',
	updateDate: '2026-06-30T00:00:00.000Z',
	fallbackUrl: 'https://www.caritas.de/hilfeundberatung/onlineberatung/',
	titles: {
		short: name,
		long: name,
		registrationDropdown: name,
		welcome: name
	}
});

const storybookTopics: TopicsDataInterface[] = [
	storybookTopic(
		1,
		'parents-and-family',
		'Eltern & Familie',
		'Beratung bei Fragen zu Familie, Erziehung und Zusammenleben.'
	),
	storybookTopic(
		2,
		'children-youth-counselling',
		'Kinder- und Jugendberatung',
		'Unterstützung für junge Menschen und ihre Bezugspersonen.'
	),
	storybookTopic(
		3,
		'u25-suicide-prevention',
		'U25 Suizidprävention',
		'Anonyme Begleitung für junge Menschen in Krisen.'
	),
	storybookTopic(
		4,
		'general-social-counselling',
		'Allgemeine Sozialberatung',
		'Orientierung bei sozialen, finanziellen und behördlichen Fragen.'
	),
	storybookTopic(
		5,
		'debt',
		'Schuldnerberatung',
		'Hilfe bei Schulden, Mahnungen und finanzieller Überforderung.'
	),
	storybookTopic(
		6,
		'migration',
		'Migration & Integration',
		'Beratung zu Ankommen, Aufenthalt und Integration.'
	),
	storybookTopic(
		7,
		'life-in-old-age',
		'Leben im Alter',
		'Unterstützung bei Pflege, Alltag und sozialer Teilhabe.'
	),
	storybookTopic(
		8,
		'disability-psychological-impairment',
		'Behinderung & psychische Belastung',
		'Beratung zu Teilhabe, Belastung und passenden Hilfen.'
	)
];

const storybookConsultingType: ConsultingTypeInterface = {
	id: 1,
	showAskerProfile: true,
	titles: {
		default: 'Onlineberatung',
		short: 'Onlineberatung',
		long: 'ORISO Onlineberatung',
		welcome: 'Willkommen in der Onlineberatung',
		registrationDropdown: 'Onlineberatung'
	},
	isVideoCallAllowed: true,
	isSubsequentRegistrationAllowed: true,
	urls: {
		registrationPostcodeFallbackUrl:
			'https://www.caritas.de/hilfeundberatung/onlineberatung/',
		requiredAidMissingRedirectUrl:
			'https://www.caritas.de/hilfeundberatung/'
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
	description: 'Storybook fixture for the public ORISO registration flow.',
	slug: 'onlineberatung',
	languageFormal: true,
	welcomeScreen: {
		anonymous: {
			title: 'Willkommen',
			text: 'Beschreiben Sie kurz Ihr Anliegen.'
		}
	}
};

const storybookAgencies: AgencyDataInterface[] = [
	{
		id: 101,
		name: 'Caritas Beratungszentrum Köln Mitte',
		description:
			'Beratung zu Familie, sozialen Notlagen und Migration. Termine sind online, telefonisch oder vor Ort möglich.',
		city: 'Köln',
		postcode: '50667',
		consultingType: 1,
		offline: false,
		external: false,
		tenantId: 1,
		topicIds: [1, 4, 6],
		consultingTypeRel: storybookConsultingType,
		address: 'Domkloster 3, 50667 Köln',
		phone: '0221 123 45 0',
		openingHours: 'Mo-Do 9-17 Uhr · Fr 9-13 Uhr',
		lat: 50.9413,
		lng: 6.9583
	} as AgencyDataInterface,
	{
		id: 102,
		name: 'U25 Onlineberatung Rheinland',
		description:
			'Anonyme Krisenbegleitung für junge Menschen bis 25 Jahre mit geschulten Peers und Fachberatung.',
		city: 'Köln',
		postcode: '50674',
		consultingType: 1,
		offline: false,
		external: false,
		tenantId: 1,
		topicIds: [2, 3],
		consultingTypeRel: storybookConsultingType,
		address: 'Hohenstaufenring 2, 50674 Köln',
		phone: '0221 95 41 21 0',
		openingHours: 'Mo-Fr 9-16 Uhr',
		lat: 50.9352,
		lng: 6.9378
	} as AgencyDataInterface,
	{
		id: 103,
		name: 'Schuldnerberatung Köln-Nord',
		description:
			'Vertrauliche Beratung bei Schulden, Mahnungen, Pfändungen und Haushaltsplanung.',
		city: 'Köln',
		postcode: '50733',
		consultingType: 1,
		offline: false,
		external: false,
		tenantId: 1,
		topicIds: [4, 5],
		consultingTypeRel: storybookConsultingType,
		address: 'Neusser Straße 120, 50733 Köln',
		phone: '0221 48 90 33',
		openingHours: 'Mo, Mi, Do 9-15 Uhr',
		lat: 50.9636,
		lng: 6.9542
	} as AgencyDataInterface
];

const storybookJsonResponse = (body: unknown) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});

const storybookRequestUrl = (input: RequestInfo | URL): string => {
	if (typeof input === 'string') {
		return input;
	}

	if (input instanceof URL) {
		return input.toString();
	}

	return input.url;
};

const installStorybookFetchMocks = () => {
	const marker = '__orisoStorybookFetchMockInstalled';
	const originalFetch = globalThis.fetch?.bind(globalThis);
	if (!originalFetch || (globalThis as any)[marker]) {
		return;
	}

	(globalThis as any)[marker] = true;
	globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = storybookRequestUrl(input);

		if (!url.includes('api.storybook.test')) {
			return originalFetch(input, init);
		}

		if (url.includes('/service/topic/public/')) {
			return storybookJsonResponse(storybookTopics);
		}

		if (url.match(/\/service\/agencies(?:\?|$)/)) {
			return storybookJsonResponse(storybookAgencies);
		}

		if (url.match(/\/service\/consultingtypes\/\d+\/full(?:\?|$)/)) {
			return storybookJsonResponse(storybookConsultingType);
		}

		if (url.includes('/service/users/consultants/languages')) {
			return storybookJsonResponse({ languages: ['en', 'ar', 'uk'] });
		}

		if (url.includes('/service/conversations/consultants/availability')) {
			return storybookJsonResponse({ available: true });
		}

		return originalFetch(input, init);
	};
};

installStorybookFetchMocks();

function MuiStoryShell({ Story }: { Story: React.ComponentType }) {
	return (
		<AppConfigContext.Provider value={config}>
			<LocaleContext.Provider
				value={{
					locale: 'de',
					selectableLocales: ['de', 'en'],
					setLocale: () => {},
					initLocale: 'de'
				}}
			>
				<TenantContext.Provider
					value={{
						tenant: null,
						setTenant: () => {}
					}}
				>
					<UserDataContext.Provider
						value={{
							userData: mockUserData,
							reloadUserData: async () => null as any,
							loaded: true
						}}
					>
						<UrlParamsContext.Provider
							value={{
								agency: null,
								consultingType: null,
								consultant: null,
								topic: null,
								loaded: true,
								slugFallback: '',
								zipcode: ''
							}}
						>
							<RocketChatContext.Provider
								value={{
									ready: true,
									send: () => {},
									subscribe: () => {},
									unsubscribe: () => {},
									listen: () => {},
									sendMethod: async () => ({}),
									close: () => {},
									rcWebsocket: null
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
											total: 0,
											reload: async () => []
										}}
									>
										<RocketChatPublicSettingsContext.Provider
											value={{
												settingsReady: true,
												getSetting: () => ({
													value: false
												})
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
												<NotificationsContext.Provider
													value={{
														notifications: [],
														setNotifications:
															() => {},
														hasNotification: () =>
															false,
														addNotification:
															() => {},
														removeNotification:
															() => {}
													}}
												>
													<RegistrationContext.Provider
														value={{
															setDisabledNextButton:
																() => null,
															registrationData: {
																agency: null,
																agencyId: null,
																username: null,
																password: null,
																zipcode:
																	'50667',
																mainTopic:
																	storybookTopics[0],
																mainTopicId:
																	storybookTopics[0]
																		.id,
																topicGroupId: 10001
															}
														}}
													>
														<ThemeProvider
															theme={theme}
														>
															<LegalLinksProvider
																legalLinks={[]}
															>
																<SessionTypeContext.Provider
																	value={{
																		type: 'MY_SESSION' as any,
																		path: '/sessions/consultant/sessionView'
																	}}
																>
																	<StoryErrorBoundary>
																		<Story />
																	</StoryErrorBoundary>
																</SessionTypeContext.Provider>
															</LegalLinksProvider>
														</ThemeProvider>
													</RegistrationContext.Provider>
												</NotificationsContext.Provider>
											</E2EEContext.Provider>
										</RocketChatPublicSettingsContext.Provider>
									</RocketChatUsersOfRoomContext.Provider>
								</RocketChatSubscriptionsContext.Provider>
							</RocketChatContext.Provider>
						</UrlParamsContext.Provider>
					</UserDataContext.Provider>
				</TenantContext.Provider>
			</LocaleContext.Provider>
		</AppConfigContext.Provider>
	);
}

export const withMuiTheme = (Story: React.ComponentType, context: any) => {
	const [{ locale }] = useGlobals();
	useEffect(() => {
		if (locale && typeof locale === 'string') {
			void i18n.changeLanguage(locale);
		}
	}, [locale]);
	const initialPath =
		context.parameters?.router?.initialPath ||
		`${window.location.pathname}${window.location.search}`;
	return (
		<MemoryRouter initialEntries={[initialPath]}>
			<Suspense fallback={<Loading />}>
				<I18nextProvider i18n={i18n}>
					<MuiStoryShell Story={Story} />
				</I18nextProvider>
			</Suspense>
		</MemoryRouter>
	);
};

init(config.i18n, null);

const preview: Preview = {
	parameters: {
		i18n,
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/
			},
			expanded: true,
			sort: 'requiredFirst'
		},
		docs: {
			theme: themes.light,
			toc: true
		},
		backgrounds: {
			default: 'light',
			values: [
				{
					name: 'light',
					value: '#ffffff'
				},
				{
					name: 'dark',
					value: '#1a1a1a'
				},
				{
					name: 'gray',
					value: '#f5f5f5'
				}
			]
		}
	},
	globals: {
		locale: FALLBACK_LNG,
		locales: {
			de: { icon: '🇩🇪', title: 'Deutsch', right: 'DE' },
			en: { icon: '🇺🇸', title: 'Englisch', right: 'EN' }
		}
	},
	tags: ['autodocs'],
	decorators: [withMuiTheme]
};

export default preview;
