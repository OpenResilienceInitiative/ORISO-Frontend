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
import { BrowserRouter as Router } from 'react-router-dom';
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
	E2EEContext
} from '../src/globalState';
import { UrlParamsContext } from '../src/globalState/provider/UrlParamsProvider';
import { RocketChatPublicSettingsContext } from '../src/globalState/provider/RocketChatPublicSettingsProvider';
import { RocketChatSubscriptionsContext } from '../src/globalState/provider/RocketChatSubscriptionsProvider';
import { RocketChatUsersOfRoomContext } from '../src/globalState/provider/RocketChatUsersOfRoomProvider';
import { RocketChatContext } from '../src/globalState/provider/RocketChatProvider';

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
							userData: null,
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
																zipcode: null,
																mainTopic: {
																	id: 1,
																	name: 'Topic',
																	slug: 'topic1',
																	description:
																		'',
																	internalIdentifier:
																		'topic1',
																	status: '',
																	createDate:
																		'',
																	updateDate:
																		''
																},
																mainTopicId: 1
															}
														}}
													>
														<ThemeProvider
															theme={theme}
														>
															<LegalLinksProvider
																legalLinks={[]}
															>
																<Story />
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

export const withMuiTheme = (Story: React.ComponentType) => {
	const [{ locale }] = useGlobals();
	useEffect(() => {
		if (locale && typeof locale === 'string') {
			void i18n.changeLanguage(locale);
		}
	}, [locale]);
	return (
		<Router>
			<Suspense fallback={<Loading />}>
				<I18nextProvider i18n={i18n}>
					<MuiStoryShell Story={Story} />
				</I18nextProvider>
			</Suspense>
		</Router>
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
