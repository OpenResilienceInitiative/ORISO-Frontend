// The provider chain every design-sync preview is wrapped in.
//
// Why this file exists: the converter normally bundles `.storybook/preview`
// itself and reuses its decorators. That fails here — `preview.tsx` imports
// `src/resources/styles/styles.scss`, and the converter's decorator bundler has
// no SCSS loader ("! preview decorator bundle failed"). Without the decorators
// every cell renders context-less and most components throw.
//
// So the chain is rebuilt as a real component that ships INSIDE the bundle
// (re-exported from ds-entry.ts, which the SCSS-capable prebundle compiles) and
// is wired via `cfg.provider: { "component": "DesignSyncProviders" }`. Setting
// cfg.provider also tells the converter to skip decorator bundling entirely.
//
// It mirrors `MuiStoryShell` + `withMuiTheme` in `.storybook/preview.tsx`. When
// that decorator changes, this has to change with it — a silent divergence
// shows up as previews that render differently from the storybook reference,
// which is exactly what the compare loop grades.
import * as React from 'react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from '@mui/material';
import i18n from 'i18next';

import {
	AppConfigContext,
	RegistrationContext,
	UserDataContext,
	TenantContext,
	LocaleContext,
	NotificationsContext,
	E2EEContext,
	SessionTypeContext
} from '../src/globalState';
import { UrlParamsContext } from '../src/globalState/provider/UrlParamsProvider';
import { AgencySpecificContext } from '../src/globalState/provider/AgencySpecificProvider';
import { LegalLinksProvider } from '../src/globalState/provider/LegalLinksProvider';
import theme from '../src/resources/scripts/theme';
import { config } from '../src/resources/scripts/config';
import { init } from '../src/i18n';

// Some component deps (html parsing in the legal/stage tree) expect Node's
// Buffer, which webpack provided and neither Vite nor esbuild does.
import { Buffer } from 'buffer';
if (!(globalThis as any).Buffer) (globalThis as any).Buffer = Buffer;

init(config.i18n, null);

// Minimal mock user so components that read userData render instead of crashing
// on a null (TwoFactorAuth, Walkthrough, …). Same shape as preview.tsx's.
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

const storybookTopic = (
	id: number,
	slug: string,
	name: string,
	description: string
) =>
	({
		id,
		name,
		description,
		status: 'ACTIVE',
		internalIdentifier: slug,
		titles: { short: name, long: name, welcome: name, dropdown: name }
	}) as any;

const storybookTopics = [
	storybookTopic(
		1,
		'parents-and-family',
		'Eltern & Familie',
		'Beratung bei Fragen zu Familie, Erziehung und Zusammenleben.'
	)
];

export const DesignSyncProviders = ({
	children
}: {
	children?: React.ReactNode;
}) => (
	<MemoryRouter initialEntries={['/']}>
		<Suspense fallback={null}>
			<I18nextProvider i18n={i18n as any}>
				<AppConfigContext.Provider value={config as any}>
					<LocaleContext.Provider
						value={
							{
								locale: 'de',
								locales: ['de', 'en'],
								selectableLocales: ['de', 'en'],
								setLocale: () => {},
								initLocale: 'de'
							} as any
						}
					>
						<TenantContext.Provider
							value={{ tenant: null, setTenant: () => {} } as any}
						>
							<UserDataContext.Provider
								value={
									{
										userData: mockUserData,
										setUserData: () => {},
										reloadUserData: async () => null as any
									} as any
								}
							>
								<AgencySpecificContext.Provider
									value={
										{
											specificAgency: null,
											setSpecificAgency: () => {}
										} as any
									}
								>
									<UrlParamsContext.Provider
										value={
											{
												agency: null,
												consultingType: null,
												consultant: null,
												topic: null,
												loaded: true,
												slugFallback: '',
												zipcode: ''
											} as any
										}
									>
										<E2EEContext.Provider
											value={
												{
													key: '',
													reloadPrivateKey: () => {},
													isE2eeEnabled: false,
													e2EEReady: true
												} as any
											}
										>
											<NotificationsContext.Provider
												value={
													{
														notifications: [],
														notificationFeed: [],
														unreadNotificationCount: 0,
														setNotifications:
															() => {},
														hasNotification: () =>
															false,
														addNotification:
															() => {},
														addEventNotification:
															() => {},
														refreshNotificationFeed:
															() => {},
														removeNotification:
															() => {},
														markNotificationAsRead:
															() => {},
														markAllNotificationsAsRead:
															() => {},
														clearNotificationFeed:
															() => {}
													} as any
												}
											>
												<RegistrationContext.Provider
													value={
														{
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
														} as any
													}
												>
													<ThemeProvider
														theme={theme}
													>
														<LegalLinksProvider
															legalLinks={
																[] as any
															}
														>
															<SessionTypeContext.Provider
																value={
																	{
																		type: 'MY_SESSION' as any,
																		path: '/sessions/consultant/sessionView'
																	} as any
																}
															>
																{children}
															</SessionTypeContext.Provider>
														</LegalLinksProvider>
													</ThemeProvider>
												</RegistrationContext.Provider>
											</NotificationsContext.Provider>
										</E2EEContext.Provider>
									</UrlParamsContext.Provider>
								</AgencySpecificContext.Provider>
							</UserDataContext.Provider>
						</TenantContext.Provider>
					</LocaleContext.Provider>
				</AppConfigContext.Provider>
			</I18nextProvider>
		</Suspense>
	</MemoryRouter>
);
