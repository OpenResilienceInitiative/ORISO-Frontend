import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { NavigationBar } from './NavigationBar';
import { RouterConfigConsultant } from './RouterConfig';
import { config } from '../../resources/scripts/config';
import {
	AUTHORITIES,
	ConsultingTypesContext,
	LocaleContext,
	SessionsDataContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import './navigation.styles.scss';

const APP_ORISO_CHAT_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=316-17725&t=XHH5HQNmA8DUWl2U-0';
const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';

const consultantUserData = {
	userId: 'consultant-storybook',
	userName: 'beraterin@example.invalid',
	displayName: 'Beraterin ORISO',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	agencies: [],
	appointmentFeatureEnabled: false,
	available: false,
	consultingTypes: {},
	e2eEncryptionEnabled: false,
	emailToggles: [],
	formalLanguage: false,
	hasArchive: true,
	isDisplayNameEditable: true,
	isWalkThroughEnabled: false,
	languages: ['de', 'en'],
	preferredLanguage: 'de',
	userRoles: ['CONSULTANT'],
	termsAndConditionsConfirmation: '',
	dataPrivacyConfirmation: '',
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

const consultingTypes = [
	{
		id: 1,
		showAskerProfile: true,
		isVideoCallAllowed: true,
		titles: {
			default: '1-1 Beratung',
			short: '1-1',
			long: '1-1 Beratung',
			welcome: 'Willkommen',
			registrationDropdown: '1-1 Beratung'
		}
	}
] as any;

const storybookSettings = {
	...config,
	disableVideoAppointments: true,
	useOverviewPage: false
} as any;

function RuntimeNavigationRail() {
	const [logoutClicked, setLogoutClicked] = useState(false);

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
		return RouterConfigConsultant(storybookSettings);
	}, []);

	return (
		<UserDataContext.Provider
			value={{
				userData: consultantUserData,
				reloadUserData: async () => consultantUserData,
				loaded: true
			}}
		>
			<ConsultingTypesContext.Provider
				value={{
					consultingTypes,
					setConsultingTypes: () => {}
				}}
			>
				<SessionsDataContext.Provider
					value={{
						ready: true,
						sessions: [],
						dispatch: () => {}
					}}
				>
					<TenantContext.Provider
						value={{
							tenant: {
								id: 1,
								name: 'ORISO Storybook',
								settings: {
									featureToolsEnabled: false
								}
							} as any,
							setTenant: () => {}
						}}
					>
						<LocaleContext.Provider
							value={{
								locale: 'de',
								selectableLocales: ['de', 'en'],
								setLocale: () => {},
								initLocale: 'de'
							}}
						>
							<div
								className="navigationSidebarStory"
								data-logout-clicked={logoutClicked}
							>
								<style>
									{`
										.navigationSidebarStory {
											width: 85px;
											height: 860px;
											min-height: 720px;
											background: #eae7e8;
											overflow: hidden;
										}

										.navigationSidebarStory .navigation__wrapper {
											width: 85px;
											height: 100%;
										}
									`}
								</style>
								<NavigationBar
									routerConfig={routerConfig}
									onLogout={() => setLogoutClicked(true)}
								/>
							</div>
						</LocaleContext.Provider>
					</TenantContext.Provider>
				</SessionsDataContext.Provider>
			</ConsultingTypesContext.Provider>
		</UserDataContext.Provider>
	);
}

const meta = {
	title: 'Components/Layout/NavigationSidebar',
	component: RuntimeNavigationRail,
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
				name: 'App.Oriso consultant rail',
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
					'Runtime Storybook target for the actual `NavigationBar` consultant rail used by the app. This replaces the previous documentation-only placeholder so Storybook MCP renders the real navigation classes, RouterConfig labels, locale switch, live-chat switch, active route state, and logout action.'
			}
		}
	}
} satisfies Meta<typeof RuntimeNavigationRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RuntimeConsultantRail: Story = {
	render: () => <RuntimeNavigationRail />,
	play: async ({ canvasElement }) => {
		const storyShell = canvasElement.querySelector(
			'.navigationSidebarStory'
		);
		const activeSessionsLink = canvasElement.querySelector(
			'a[href="/sessions/consultant/sessionView"]'
		);
		await expect(activeSessionsLink).not.toBeNull();
		await expect(activeSessionsLink).toHaveClass(
			'navigation__item--active'
		);

		const logoutAction = canvasElement.querySelector(
			'.navigation__item--nav-logout'
		);
		await expect(logoutAction).not.toBeNull();
		await userEvent.click(logoutAction as HTMLElement);
		await expect(storyShell).toHaveAttribute('data-logout-clicked', 'true');
	}
};
