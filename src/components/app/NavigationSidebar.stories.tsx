import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { PersonalDisplayControls } from '../../features/personal-display/PersonalDisplayEntry';
import { DEFAULT_DISPLAY } from '../../features/personal-display/preferences';
import i18n from '../../i18n';
import { NavigationStoryShell } from './NavigationStoryShell';
import './navigationSidebarStory.styles.scss';

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
	railHeightPx,
	fullMobileShell = false,
	liveChatViaSidebar = true,
	languageOptions,
	tenantSettings
}: {
	role: 'consultant' | 'asker';
	layout?: 'desktop' | 'mobile';
	/** Profile preference "Live Chat über Menü Leiste aktivieren". */
	liveChatViaSidebar?: boolean;
	languageOptions?: string[];
	/** Desktop only: force a short rail to exercise vertical scroll + pinned logout */
	railHeightPx?: number;
	/** Exercise the production mobile shell and its version overlay. */
	fullMobileShell?: boolean;
	/** Träger settings for the story tenant. */
	tenantSettings?: Record<string, unknown>;
}) {
	const [logoutClicked, setLogoutClicked] = useState(false);
	const [displayPreferences, setDisplayPreferences] =
		useState(DEFAULT_DISPLAY);
	const isDesktop = layout === 'desktop';
	const desktopHeight = railHeightPx ?? 860;

	return (
		<NavigationStoryShell
			role={role}
			liveChatViaSidebar={liveChatViaSidebar}
			languageOptions={languageOptions}
			tenantSettings={tenantSettings}
			onLogout={() => setLogoutClicked(true)}
			displayEntry={
				role === 'asker' && layout === 'mobile' ? (
					<PersonalDisplayControls
						preferences={displayPreferences}
						onChange={setDisplayPreferences}
					/>
				) : undefined
			}
			className="navigationSidebarStory"
			data-logout-clicked={logoutClicked}
			style={
				{
					'--storybook-navigation-direction': isDesktop
						? 'row'
						: 'column',
					'--storybook-navigation-width': isDesktop ? '85px' : '100%',
					'--storybook-navigation-max-width':
						isDesktop || fullMobileShell ? 'none' : '375px',
					'--storybook-navigation-height': isDesktop
						? `${desktopHeight}px`
						: fullMobileShell
							? '100vh'
							: '76px',
					'--storybook-navigation-min-height': isDesktop
						? railHeightPx
							? `${railHeightPx}px`
							: '720px'
						: '0',
					'--storybook-navigation-mobile-height': fullMobileShell
						? '100vh'
						: '76px',
					'--storybook-navigation-menu-height': fullMobileShell
						? 'auto'
						: '100%'
				} as React.CSSProperties
			}
		>
			{fullMobileShell && (
				<div style={{ flex: 1, minHeight: 0, padding: 24 }}>
					<h1>
						{i18n.t(
							role === 'consultant'
								? 'navigation.consultant.sessions.nav'
								: 'navigation.asker.sessions.large'
						)}
					</h1>
				</div>
			)}
			{fullMobileShell && (
				<div className="app__platformVersion">2.9.14 - abc1234</div>
			)}
		</NavigationStoryShell>
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
	globals: { backgrounds: { value: 'gray' } },
	parameters: {
		layout: 'fullscreen',
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
					'Runtime Storybook target for the shared `NavigationBar` (asker + consultant). Desktop: top routes scroll vertically; logout/actions stay pinned. Below 900px, including narrow Docs canvases, the menu becomes a full-width horizontal bar. Mobile: primary routes and a role-specific Display entry stay in view. More opens profile, remaining routes and account actions.'
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
		// The original CI case renders the first-visit profile badge. Its
		// navigation owner, not a nameless span, must announce the count.
		await waitFor(() => {
			const badge = canvasElement.querySelector(
				'.navigation__item__count'
			);
			expect(badge).not.toBeNull();
			expect(badge).toHaveTextContent('1');
			expect(badge).toHaveAttribute('aria-hidden', 'true');
			expect(badge).not.toHaveAttribute('aria-label');
			const owner = badge?.closest('a');
			expect(owner).toHaveAttribute('href', '/profile');
			expect(owner).not.toHaveAttribute('role');
			expect(owner).toHaveAccessibleName(
				`${i18n.t('navigation.myProfile')}, ${i18n.t('sessionList.rail.unreadCount', { count: 1 })}`
			);
		});

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

/**
 * *19 (Frank, 2026-11-17): "Meine Direktlinks" moved into the calendar
 * list, so the clock entry is gone even while a medium is allowed.
 */
export const DirectLinksOneMediumAllowed: Story = {
	name: 'Direct links: no clock entry, the links live in the calendar',
	args: {
		role: 'consultant',
		layout: 'desktop',
		tenantSettings: {
			featureDirectInviteChatEnabled: false,
			featureDirectInviteAudioEnabled: false,
			featureDirectInviteVideoEnabled: true
		}
	},
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelector('a[href="/booking/events"]')
			).not.toBeNull()
		);
		await expect(
			canvasElement.querySelector('a[href="/direct-links"]')
		).toBeNull();
	}
};

/** #1894: with all three media off the clock entry is gone. */
export const DirectLinksAllMediaOff: Story = {
	name: 'Direct links: no clock entry when direct invitation is off',
	args: {
		role: 'consultant',
		layout: 'desktop',
		tenantSettings: {
			featureDirectInviteChatEnabled: false,
			featureDirectInviteAudioEnabled: false,
			featureDirectInviteVideoEnabled: false
		}
	},
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelector(
					'a[href="/sessions/consultant/sessionView"]'
				)
			).not.toBeNull()
		);
		await expect(
			canvasElement.querySelector('a[href="/direct-links"]')
		).toBeNull();
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
	args: { role: 'consultant', layout: 'mobile', fullMobileShell: true },
	globals: {
		locale: 'de',
		viewport: { value: 'phone375', isRotated: false }
	},
	play: async ({ canvasElement }) => {
		const root = within(canvasElement);
		const bar = root.getByRole('navigation', { name: 'Navigation' });
		await expect(
			within(bar).queryByRole('button', { name: 'Anzeige' })
		).not.toBeInTheDocument();
		await userEvent.click(
			within(bar).getByRole('button', { name: 'Mehr' })
		);
		const dialog = within(
			await within(canvasElement.ownerDocument.body).findByRole(
				'dialog',
				{ name: 'Mehr' }
			)
		);
		await expect(
			dialog.getByRole('link', { name: /anfragen/i })
		).toHaveAttribute('href', '/sessions/consultant/sessionPreview');
		await expect(
			dialog.getByRole('link', { name: /gespräche|gespräch/i })
		).toHaveAttribute('href', '/sessions/consultant/sessionView');
		await expect(
			dialog.getByRole('link', { name: /mein profil/i })
		).toHaveAttribute('href', '/profile');
		await waitFor(() =>
			expect(
				dialog.getByRole('switch', { name: /live[- ]chat/i })
			).toBeVisible()
		);
		await userEvent.keyboard('{Escape}');
		await waitFor(() =>
			expect(
				within(bar).getByRole('button', { name: 'Mehr' })
			).toHaveFocus()
		);
	}
};

export const MobileMoreSevenLanguages: Story = {
	...RuntimeConsultantMobile,
	args: {
		...RuntimeConsultantMobile.args,
		languageOptions: ['de', 'en', 'fr', 'ru', 'tr', 'ti', 'uk']
	},
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		await userEvent.click(page.getByRole('button', { name: 'Mehr' }));
		const dialog = within(
			await page.findByRole('dialog', { name: 'Mehr' })
		);
		await userEvent.click(
			dialog.getByRole('button', { name: /Deutsch/, expanded: false })
		);
		await expect(
			dialog.getAllByRole('button', { pressed: true }).length
		).toBe(1);
	}
};

export const RuntimeConsultantMobileWithoutLiveChatPreference: Story = {
	...RuntimeConsultantMobile,
	args: { ...RuntimeConsultantMobile.args, liveChatViaSidebar: false },
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole('button', { name: 'Mehr' })
		);
		const dialog = within(
			await within(canvasElement.ownerDocument.body).findByRole(
				'dialog',
				{ name: 'Mehr' }
			)
		);
		await waitFor(() =>
			expect(
				dialog.getByRole('link', { name: /mein profil/i })
			).toBeVisible()
		);
		await expect(
			dialog.queryByRole('switch', { name: /live[- ]chat/i })
		).not.toBeInTheDocument();
	}
};

export const RuntimeAskerMobile: Story = {
	args: { role: 'asker', layout: 'mobile', fullMobileShell: true },
	globals: {
		locale: 'de',
		viewport: { value: 'phone375', isRotated: false }
	},
	parameters: { router: { initialPath: '/sessions/user/view/session/123' } },
	play: async ({ canvasElement }) => {
		const bar = within(canvasElement).getByRole('navigation', {
			name: 'Navigation'
		});
		const display = within(bar).getByRole('button', { name: 'Anzeige' });
		await userEvent.click(display);
		const dialog = within(
			await within(canvasElement.ownerDocument.body).findByRole(
				'dialog',
				{ name: 'Anzeige' }
			)
		);
		await userEvent.click(dialog.getByRole('button', { name: 'Größer' }));
		await expect(
			dialog.getByRole('status', { name: 'Gewählte Textgröße' })
		).toHaveTextContent('125 %');
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(display).toHaveFocus());
	}
};

export const RuntimeConsultantMobile375Shell: Story = {
	...RuntimeConsultantMobile,
	play: async ({ canvasElement }) => {
		const nav = canvasElement.querySelector(
			'.navigation__wrapper'
		) as HTMLElement;
		const bar = nav.querySelector('.navigation__mobileBar') as HTMLElement;
		const version = canvasElement.querySelector(
			'.app__platformVersion'
		) as HTMLElement;
		const navBounds = nav.getBoundingClientRect();
		await expect(window.innerWidth).toBe(375);
		await expect(bar.getBoundingClientRect().right).toBeLessThanOrEqual(
			navBounds.right + 1
		);
		await expect(
			version.getBoundingClientRect().bottom
		).toBeLessThanOrEqual(navBounds.top);
		await expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth + 1);
		await userEvent.click(
			within(bar).getByRole('button', { name: 'Mehr' })
		);
		const dialog = await within(
			canvasElement.ownerDocument.body
		).findByRole('dialog', { name: 'Mehr' });
		const language = within(dialog).getByRole('button', {
			name: /Deutsch/,
			expanded: false
		});
		language.focus();
		await expect(language).toHaveFocus();
		await userEvent.keyboard('{Enter}');
		await expect(language).toHaveAttribute('aria-expanded', 'true');
		await expect(
			within(dialog).getByRole('button', { name: 'Englisch' })
		).toBeVisible();
		await userEvent.tab();
		await userEvent.keyboard('{Escape}');
		await expect(language).toHaveFocus();
		await expect(language).toHaveAttribute('aria-expanded', 'false');
		const logout = dialog.querySelector(
			'.navigation__item--nav-logout'
		) as HTMLElement;
		logout.focus();
		await expect(logout).toHaveFocus();
		await userEvent.keyboard('{Enter}');
		await expect(
			canvasElement.querySelector('.navigationSidebarStory')
		).toHaveAttribute('data-logout-clicked', 'true');
	}
};

/** How often the badge's registered-enquiry request was answered. */
const answeredEnquiryFeeds = { registered: 0 };

/**
 * FE#1435: answers the two enquiry feeds the "Anfragen" badge reads with a
 * fixed total, installed during render (before the badge's first request)
 * and restored on unmount.
 */
const WithOpenEnquiries = ({
	total,
	children
}: {
	total: number;
	children: React.ReactNode;
}) => {
	const restore = useRef<(() => void) | null>(null);
	if (!restore.current) {
		answeredEnquiryFeeds.registered = 0;
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			if (url.includes('/consultants/enquiries/registered')) {
				answeredEnquiryFeeds.registered += 1;
				return new Response(
					JSON.stringify({
						sessions: total ? [{}] : [],
						count: total ? 1 : 0,
						offset: 0,
						total
					}),
					{
						status: 200,
						headers: { 'content-type': 'application/json' }
					}
				);
			}
			if (url.includes('/consultants/enquiries/anonymous')) {
				return new Response(null, { status: 204 });
			}
			return originalFetch(input, init);
		};
		restore.current = () => {
			globalThis.fetch = originalFetch;
		};
	}
	useEffect(() => () => restore.current?.(), []);
	return <>{children}</>;
};

const expectEnquiryBadge = async (canvasElement: HTMLElement, count: number) =>
	waitFor(() => {
		const owner = canvasElement.querySelector(
			'a[href="/sessions/consultant/sessionPreview"]'
		);
		const badge = owner?.querySelector('.navigation__item__count');
		expect(badge).toHaveTextContent(String(count));
		expect(badge).toHaveAttribute('aria-hidden', 'true');
		expect(owner).toHaveAccessibleName(
			`${i18n.t('navigation.consultant.enquiries')}, ${i18n.t('sessionList.rail.openEnquiries', { count })}`
		);
	});

export const RuntimeConsultantRailOpenEnquiries: Story = {
	name: 'Runtime Consultant Rail — open enquiries (FE#1435)',
	args: { role: 'consultant', layout: 'desktop' },
	decorators: [
		(StoryComponent) => (
			<WithOpenEnquiries total={3}>
				<StoryComponent />
			</WithOpenEnquiries>
		)
	],
	play: async ({ canvasElement }) => {
		await expectEnquiryBadge(canvasElement, 3);
	}
};

export const RuntimeConsultantMobileOpenEnquiries: Story = {
	name: 'Runtime Consultant Mobile — open enquiries (FE#1435)',
	args: { role: 'consultant', layout: 'mobile' },
	globals: { viewport: { value: 'phone375', isRotated: false } },
	decorators: [
		(StoryComponent) => (
			<WithOpenEnquiries total={12}>
				<StoryComponent />
			</WithOpenEnquiries>
		)
	],
	play: async ({ canvasElement }) => {
		await expectEnquiryBadge(canvasElement, 12);
	}
};

export const RuntimeConsultantRailNoOpenEnquiries: Story = {
	name: 'Runtime Consultant Rail — nothing open (FE#1435)',
	args: { role: 'consultant', layout: 'desktop' },
	decorators: [
		(StoryComponent) => (
			<WithOpenEnquiries total={0}>
				<StoryComponent />
			</WithOpenEnquiries>
		)
	],
	play: async ({ canvasElement }) => {
		// The badge's own request came back with 0, then one task for the render.
		await waitFor(() =>
			expect(answeredEnquiryFeeds.registered).toBeGreaterThan(0)
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		await expect(
			canvasElement.querySelector(
				'a[href="/sessions/consultant/sessionPreview"] .navigation__item__count'
			)
		).toBeNull();
	}
};
