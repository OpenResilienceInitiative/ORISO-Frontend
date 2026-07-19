import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { NavigationBar } from './NavigationBar';
import { RouterConfigConsultant, RouterConfigUser } from './RouterConfig';
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
const M3_NAV_BAR_CLIENT_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=61212-3707&m=dev';
const M3_NAV_BAR_CONSULTANT_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=61212-3732&m=dev';
const M3_NAV_BAR_LIVE_CHAT_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=61216-2651&m=dev';

const LIVE_CHAT_STORAGE_KEY = 'caritas_liveChatAvailability';
// The Live Chat nav item only appears once the consultant enabled "Live Chat
// über Menü Leiste aktivieren" in My-Profile (rail + mobile bar alike), so the
// live-chat-active story must set this placement flag too.
const LIVE_CHAT_VIA_SIDEBAR_KEY = 'caritas_liveChatViaSidebar';

const baseUserData = {
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

const consultantUserData = {
	...baseUserData,
	userId: 'consultant-storybook',
	userName: 'beraterin@example.invalid',
	displayName: 'Beraterin ORISO',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	userRoles: ['CONSULTANT']
} as any;

const askerUserData = {
	...baseUserData,
	userId: 'asker-storybook',
	userName: 'ratsuchende@example.invalid',
	displayName: 'Ratsuchende ORISO',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
	userRoles: ['USER']
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

interface RuntimeNavigationProps {
	/** 'consultant' renders the counsellor nav, 'asker' the client nav. */
	role?: 'consultant' | 'asker';
	/** Pre-activate the consultant live-chat availability toggle. */
	liveChatActive?: boolean;
	/** 'rail' pins the desktop sidebar shell, 'bar' the mobile bottom bar. */
	shell?: 'rail' | 'bar';
}

function RuntimeNavigation({
	role = 'consultant',
	liveChatActive = false,
	shell = 'rail'
}: RuntimeNavigationProps) {
	const [logoutClicked, setLogoutClicked] = useState(false);

	/* Deterministic live-chat state: the NavigationBar reads the
	   localStorage-backed flag on first render, so it must be set before
	   mounting the child — an effect would run too late. */
	const [previousLiveChat] = useState<[string | null, string | null]>(() => {
		let previousAvail: string | null = null;
		let previousViaSidebar: string | null = null;
		try {
			previousAvail = localStorage.getItem(LIVE_CHAT_STORAGE_KEY);
			previousViaSidebar = localStorage.getItem(
				LIVE_CHAT_VIA_SIDEBAR_KEY
			);
			if (liveChatActive) {
				// Show Live Chat in the rail/bar: it is gated on the "via menu
				// bar" placement flag and reflects the availability state.
				localStorage.setItem(LIVE_CHAT_VIA_SIDEBAR_KEY, '1');
				localStorage.setItem(LIVE_CHAT_STORAGE_KEY, '1');
			} else {
				localStorage.removeItem(LIVE_CHAT_STORAGE_KEY);
				localStorage.removeItem(LIVE_CHAT_VIA_SIDEBAR_KEY);
			}
		} catch {
			/* Storybook determinism only. */
		}
		return [previousAvail, previousViaSidebar];
	});

	useEffect(() => {
		return () => {
			const restore = (key: string, value: string | null) => {
				try {
					if (value == null) {
						localStorage.removeItem(key);
					} else {
						localStorage.setItem(key, value);
					}
				} catch {
					/* Storybook cleanup only. */
				}
			};
			restore(LIVE_CHAT_STORAGE_KEY, previousLiveChat[0]);
			restore(LIVE_CHAT_VIA_SIDEBAR_KEY, previousLiveChat[1]);
		};
	}, [previousLiveChat]);

	const routerConfig = useMemo(() => {
		return role === 'asker'
			? RouterConfigUser(storybookSettings, true)
			: RouterConfigConsultant(storybookSettings);
	}, [role]);

	return (
		<UserDataContext.Provider
			value={{
				userData: role === 'asker' ? askerUserData : consultantUserData,
				setUserData: () => {},
				reloadUserData: async () =>
					role === 'asker' ? askerUserData : consultantUserData
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
								locales: ['de', 'en'],
								selectableLocales: ['de', 'en'],
								setLocale: () => {},
								initLocale: 'de'
							}}
						>
							<div
								className={
									shell === 'bar'
										? 'navigationBarStory app__wrapper'
										: 'navigationSidebarStory app__wrapper'
								}
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

										.navigationBarStory {
											display: flex;
											flex-direction: column;
											justify-content: flex-end;
											width: 100%;
											min-height: 180px;
											background: #fff;
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
	component: RuntimeNavigation,
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
					'Runtime Storybook target for the actual `NavigationBar` used by the app: the desktop consultant rail plus the mobile M3 bottom navigation bar (client view, counsellor view, counsellor with activated live chat). Renders the real navigation classes, RouterConfig labels, locale switch, live-chat switch, active route state, and logout action.'
			}
		}
	}
} satisfies Meta<typeof RuntimeNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RuntimeConsultantRail: Story = {
	render: () => <RuntimeNavigation shell="rail" />,
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

/* Mobile M3 bottom navigation bar (Figma Design-System-M3_ORISO).
   The mobile2 viewport (414px) keeps both the CSS breakpoint and the
   useResponsive() hook below the $fromLarge/900px threshold. */

export const MobileBottomBarClient: Story = {
	globals: { viewport: { value: 'mobile2', isRotated: false } },
	parameters: {
		router: { initialPath: '/sessions/user/view' },
		design: [
			{
				type: 'figma',
				name: 'M3 nav bar — client view',
				url: M3_NAV_BAR_CLIENT_FIGMA_URL
			}
		]
	},
	render: () => <RuntimeNavigation shell="bar" role="asker" />,
	play: async ({ canvasElement }) => {
		const activeSessionsLink = canvasElement.querySelector(
			'a[href="/sessions/user/view"]'
		);
		await expect(activeSessionsLink).not.toBeNull();
		await expect(activeSessionsLink).toHaveClass(
			'navigation__item--active'
		);
		/* Clients never get the consultant live-chat toggle. */
		await expect(
			canvasElement.querySelector('.navigation__item--liveChatToggle')
		).toBeNull();
	}
};

export const MobileBottomBarConsultant: Story = {
	globals: { viewport: { value: 'mobile2', isRotated: false } },
	parameters: {
		router: { initialPath: '/sessions/consultant/sessionPreview' },
		design: [
			{
				type: 'figma',
				name: 'M3 nav bar — counsellor view',
				url: M3_NAV_BAR_CONSULTANT_FIGMA_URL
			}
		]
	},
	render: () => <RuntimeNavigation shell="bar" role="consultant" />,
	play: async ({ canvasElement }) => {
		const activeEnquiriesLink = canvasElement.querySelector(
			'a[href="/sessions/consultant/sessionPreview"]'
		);
		await expect(activeEnquiriesLink).not.toBeNull();
		await expect(activeEnquiriesLink).toHaveClass(
			'navigation__item--active'
		);

		const liveChatToggle = canvasElement.querySelector(
			'.navigation__item--liveChatToggle'
		);
		await expect(liveChatToggle).toBeVisible();
		await expect(liveChatToggle).toHaveAttribute('aria-checked', 'false');
	}
};

export const MobileBottomBarConsultantLiveChatActive: Story = {
	globals: { viewport: { value: 'mobile2', isRotated: false } },
	parameters: {
		router: { initialPath: '/sessions/consultant/sessionPreview' },
		design: [
			{
				type: 'figma',
				name: 'M3 nav bar — live chat activated',
				url: M3_NAV_BAR_LIVE_CHAT_FIGMA_URL
			}
		]
	},
	render: () => (
		<RuntimeNavigation shell="bar" role="consultant" liveChatActive />
	),
	play: async ({ canvasElement }) => {
		const liveChatToggle = canvasElement.querySelector(
			'.navigation__item--liveChatToggle'
		);
		await expect(liveChatToggle).not.toBeNull();
		await expect(liveChatToggle).toHaveAttribute('aria-checked', 'true');
		await expect(
			liveChatToggle.querySelector('.navigation__icon-slot--active')
		).not.toBeNull();
	}
};
