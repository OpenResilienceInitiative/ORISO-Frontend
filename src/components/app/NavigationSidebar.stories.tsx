import * as React from 'react';
import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { NavigationBar } from './NavigationBar';
import { RouterConfigConsultant, RouterConfigUser } from './RouterConfig';
import { config } from '../../resources/scripts/config';
import {
	NavigationStoryProviders,
	storybookSettings
} from './navigationStoryHelpers';
import './navigation.styles.scss';
import './authenticatedApp.styles.scss';

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

function RuntimeNavigationRail({
	role,
	layout = 'desktop',
	railHeightPx
}: {
	role: 'consultant' | 'asker';
	layout?: 'desktop' | 'mobile';
	/** Desktop only: force a short rail to exercise vertical scroll + pinned logout */
	railHeightPx?: number;
}) {
	const [logoutClicked, setLogoutClicked] = useState(false);
	const isDesktop = layout === 'desktop';
	const desktopHeight = railHeightPx ?? 860;

	const routerConfig = useMemo(() => {
		const settings = { ...config, ...storybookSettings };
		return role === 'consultant'
			? RouterConfigConsultant(settings)
			: RouterConfigUser(settings, false);
	}, [role]);

	const shellStyle = isDesktop
		? {
				width: '85px',
				height: `${desktopHeight}px`,
				minHeight: railHeightPx ? `${railHeightPx}px` : '720px',
				background: '#eae7e8',
				overflow: 'hidden'
			}
		: {
				width: '100%',
				maxWidth: '375px',
				height: '76px',
				background: '#eae7e8',
				overflow: 'hidden'
			};

	return (
		<NavigationStoryProviders role={role}>
			{/*
			  app__wrapper is required so production shell + figma nav rules
			  (authenticatedApp + app-scoped navigation styles) apply in Storybook.
			*/}
			<div
				className="app__wrapper navigationSidebarStory"
				data-logout-clicked={logoutClicked}
				style={shellStyle}
			>
				<style>
					{`
						.navigationSidebarStory.app__wrapper {
							display: flex;
							flex-direction: ${isDesktop ? 'row' : 'column'};
						}

						.navigationSidebarStory .navigation__wrapper {
							width: ${isDesktop ? '85px' : '100%'};
							height: 100%;
						}
					`}
				</style>
				<NavigationBar
					routerConfig={routerConfig}
					onLogout={() => setLogoutClicked(true)}
				/>
			</div>
		</NavigationStoryProviders>
	);
}

const meta = {
	title: 'Components/Layout/NavigationSidebar',
	component: RuntimeNavigationRail,
	tags: ['autodocs'],
	args: {
		role: 'consultant' as const,
		layout: 'desktop' as const
	},
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
			},
			{
				type: 'figma',
				name: 'M3 nav bar (client)',
				url: M3_NAV_BAR_CLIENT_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'M3 nav bar (consultant)',
				url: M3_NAV_BAR_CONSULTANT_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'M3 nav bar (live chat)',
				url: M3_NAV_BAR_LIVE_CHAT_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Runtime Storybook target for the shared `NavigationBar` (asker + consultant). Desktop: top routes scroll vertically; logout/actions stay pinned. Mobile: routes, Live Chat, language, and logout scroll together in one smooth horizontal bar.'
			}
		}
	}
} satisfies Meta<typeof RuntimeNavigationRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RuntimeConsultantRail: Story = {
	args: {
		role: 'consultant',
		layout: 'desktop'
	},
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

		const navigationRail = canvasElement.querySelector(
			'.navigation__wrapper--figma-consultant'
		);
		await expect(navigationRail).not.toBeNull();

		const bottomActions = canvasElement.querySelector(
			'.navigation__item__bottom'
		);
		await expect(bottomActions).not.toBeNull();

		await expect(
			getComputedStyle(bottomActions as Element).flexDirection
		).toBe('column');

		const railBounds = (navigationRail as Element).getBoundingClientRect();
		const logoutBounds = (
			logoutAction as HTMLElement
		).getBoundingClientRect();
		await expect(logoutBounds.left).toBeGreaterThanOrEqual(railBounds.left);
		await expect(logoutBounds.right).toBeLessThanOrEqual(railBounds.right);

		await userEvent.click(logoutAction as HTMLElement);
		await expect(storyShell).toHaveAttribute('data-logout-clicked', 'true');
	}
};

export const RuntimeConsultantRailShort: Story = {
	args: {
		role: 'consultant',
		layout: 'desktop',
		railHeightPx: 420
	},
	play: async ({ canvasElement }) => {
		const topGroup = canvasElement.querySelector('.navigation__item__top');
		const logoutAction = canvasElement.querySelector(
			'.navigation__item--nav-logout'
		);
		await expect(topGroup).not.toBeNull();
		await expect(logoutAction).not.toBeNull();

		const topStyles = window.getComputedStyle(topGroup as Element);
		await expect(topStyles.overflowY).toBe('auto');

		const logoutRect = (
			logoutAction as HTMLElement
		).getBoundingClientRect();
		const shell = canvasElement.querySelector(
			'.navigationSidebarStory'
		) as HTMLElement;
		const shellRect = shell.getBoundingClientRect();
		// Logout stays inside the visible shell (pinned), not scrolled away.
		await expect(logoutRect.bottom).toBeLessThanOrEqual(
			shellRect.bottom + 1
		);
		await expect(logoutRect.top).toBeGreaterThanOrEqual(shellRect.top - 1);
	}
};

export const RuntimeAskerRail: Story = {
	args: {
		role: 'asker',
		layout: 'desktop'
	},
	parameters: {
		router: {
			initialPath: '/sessions/user/view/session/123'
		}
	}
};

export const RuntimeConsultantMobile: Story = {
	args: {
		role: 'consultant',
		layout: 'mobile'
	},
	globals: {
		viewport: { value: 'mobile1' }
	},
	play: async ({ canvasElement }) => {
		const itemContainer = canvasElement.querySelector(
			'.navigation__itemContainer'
		);
		const bottomGroup = canvasElement.querySelector(
			'.navigation__item__bottom'
		);
		const logoutAction = canvasElement.querySelector(
			'.navigation__item--nav-logout'
		);
		const liveChat = canvasElement.querySelector(
			'.navigation__item--liveChatToggle'
		);
		const language = canvasElement.querySelector(
			'.navigation__item__language'
		);

		await expect(itemContainer).not.toBeNull();
		await expect(bottomGroup).not.toBeNull();
		await expect(logoutAction).not.toBeNull();
		await expect(liveChat).not.toBeNull();
		await expect(language).not.toBeNull();

		const liveStyles = window.getComputedStyle(liveChat as Element);
		const languageStyles = window.getComputedStyle(language as Element);
		await expect(liveStyles.display).not.toBe('none');
		await expect(languageStyles.display).not.toBe('none');

		// The bottom-bar rules live behind `@media (width < 900px)`, i.e. they
		// depend on the *canvas* width. Storybook applies `globals.viewport`
		// from the manager, so a canvas opened straight at `/iframe.html` keeps
		// the browser's width. Assert against whichever layout is actually in
		// force — neither branch is vacuous.
		const container = itemContainer as HTMLElement;
		const containerStyles = window.getComputedStyle(container);
		if (window.matchMedia('(width < 900px)').matches) {
			await expect(containerStyles.overflowX).toBe('auto');
			// Whole row (routes + actions + logout) scrolls as one strip.
			await expect(container.scrollWidth).toBeGreaterThan(
				container.clientWidth
			);
		} else {
			// Desktop rail: the column fits the shell, no horizontal scroll.
			await expect(containerStyles.overflowX).toBe('hidden');
			await expect(container.scrollWidth).toBe(container.clientWidth);
		}
	}
};

export const RuntimeAskerMobile: Story = {
	args: {
		role: 'asker',
		layout: 'mobile'
	},
	globals: {
		viewport: { value: 'mobile1' }
	},
	parameters: {
		router: {
			initialPath: '/sessions/user/view/session/123'
		}
	}
};
