// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { NavigationBar } from './NavigationBar';
import { NavigationStoryProviders } from './navigationStoryHelpers';
import { apiGetLiveChatAvailability } from '../../api/apiSetLiveChatAvailability';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { DEFAULT_DISPLAY_FILTER } from '../../utils/displayFilter/model';

// Imported transitively; lottie-web needs a real canvas at module load.
vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({
		fromS: true,
		fromM: true,
		fromL: true,
		fromXL: false,
		fromXXL: false,
		untilL: false
	})
}));

vi.mock('../../api/apiSetLiveChatAvailability', () => ({
	apiGetLiveChatAvailability: vi.fn(() => Promise.resolve(false)),
	apiGetNewCounsellingAllowed: vi.fn(() => Promise.resolve(null)),
	apiHeartbeatLiveChatAvailability: vi.fn(() => Promise.resolve(true)),
	apiSetLiveChatAvailability: vi.fn(() => Promise.resolve())
}));

vi.mock('../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn(() => Promise.resolve())
}));

vi.mock('../../api/apiGetTools', () => ({
	userHasBudibaseTools: vi.fn(() => Promise.resolve(false))
}));

const routerConfig = {
	navigation: [
		{
			to: '/sessions/consultant/sessionPreview',
			titleKeys: { large: 'navigation.consultant.enquiries.large' }
		},
		{
			to: '/sessions/consultant/sessionView',
			titleKeys: { large: 'navigation.consultant.sessions.large' }
		}
	]
};

describe('NavigationBar — product-tour anchor (FE#1622)', () => {
	it('marks only the consultant enquiries item as nav-enquiries', async () => {
		const { container } = render(
			<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
				<NavigationStoryProviders role="consultant">
					<NavigationBar
						routerConfig={routerConfig}
						onLogout={() => {}}
					/>
				</NavigationStoryProviders>
			</MemoryRouter>
		);
		await waitFor(() =>
			expect(apiGetLiveChatAvailability).toHaveBeenCalled()
		);

		const anchored = container.querySelectorAll(
			'[data-tour-target="nav-enquiries"]'
		);
		expect(anchored).toHaveLength(1);
		expect(anchored[0].getAttribute('href')).toBe(
			'/sessions/consultant/sessionPreview'
		);
	});
});

// The real badge remains inside NavigationBar and its existing provider fixture.
const unreadContext = (
	count: number
): NonNullable<React.ContextType<typeof NotificationsContext>> => ({
	notifications: [],
	notificationFeed: [],
	unreadNotificationCount: count,
	serverUnreadTotal: count,
	serverUnreadTotalExcludesHidden: false,
	hasUnreadNotifications: count > 0,
	timelineDisplayFilter: DEFAULT_DISPLAY_FILTER,
	visibleUnreadCount: count,
	hiddenUnreadInLoadedPages: 0,
	setNotifications: () => {},
	hasNotification: () => false,
	addNotification: () => {},
	addEventNotification: () => {},
	refreshNotificationFeed: () => {},
	loadOlderNotifications: async () => {},
	hasOlderNotifications: false,
	isLoadingOlderNotifications: false,
	olderNotificationsError: false,
	removeNotification: () => {},
	markNotificationAsRead: () => {},
	markNotificationsReadConfirmed: async () => {},
	markAllNotificationsAsRead: () => {},
	clearNotificationFeed: () => {}
});

const unreadNavigation = (
	count: number,
	{ figma = false, strict = false } = {}
) => {
	const navigation = (
		<MemoryRouter initialEntries={['/notifications']}>
			<NavigationStoryProviders role="consultant">
				<NotificationsContext.Provider value={unreadContext(count)}>
					<NavigationBar
						routerConfig={{
							navigation: [
								{
									to: '/notifications',
									titleKeys: {
										large: 'navigation.notifications'
									},
									...(figma
										? { navSlot: 'notifications' }
										: {})
								}
							]
						}}
						onLogout={() => {}}
					/>
				</NotificationsContext.Provider>
			</NavigationStoryProviders>
		</MemoryRouter>
	);
	return strict ? (
		<React.StrictMode>{navigation}</React.StrictMode>
	) : (
		navigation
	);
};

const renderIdleNavigation = async (options = {}) => {
	const view = render(unreadNavigation(0, options));
	// Settle the existing API mock promises, then finish the independent parent
	// navigation-icon timer BEFORE mounting a badge. No waitFor polling timers.
	await act(async () => {});
	act(() => vi.advanceTimersByTime(1000));
	expect(vi.getTimerCount()).toBe(0);
	return {
		...view,
		setCount: (count: number) =>
			view.rerender(unreadNavigation(count, options))
	};
};

describe('NavigationBar unread badge timer ownership', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		try {
			cleanup();
			// Assert ownership before restoring the clock. Do not clearAllTimers
			// or run pending callbacks as a substitute for component cleanup.
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps the initial badge for 1000ms without restarting on a count update', async () => {
		const view = await renderIdleNavigation();
		view.setCount(1);
		const badge = view.container.querySelector('.navigation__item__count');
		expect(badge).not.toBeNull();
		expect(
			badge?.classList.contains('navigation__item__count--initial')
		).toBe(true);
		act(() => vi.advanceTimersByTime(499));
		view.setCount(2);
		act(() => vi.advanceTimersByTime(500));
		expect(
			badge?.classList.contains('navigation__item__count--initial')
		).toBe(true);
		act(() => vi.advanceTimersByTime(1));
		expect(
			badge?.classList.contains('navigation__item__count--initial')
		).toBe(false);
		expect(badge?.textContent).toBe('2');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('cancels a removed badge timer without cancelling another owner or ageing its replacement', async () => {
		const view = await renderIdleNavigation();
		view.setCount(1);
		const otherOwner = vi.fn();
		setTimeout(otherOwner, 1000);
		act(() => vi.advanceTimersByTime(400));
		view.setCount(0);
		expect(
			view.container.querySelector('.navigation__item__count')
		).toBeNull();
		expect(vi.getTimerCount()).toBe(1);
		view.setCount(3);
		act(() => vi.advanceTimersByTime(600));
		expect(otherOwner).toHaveBeenCalledTimes(1);
		const replacement = view.container.querySelector(
			'.navigation__item__count'
		);
		expect(
			replacement?.classList.contains('navigation__item__count--initial')
		).toBe(true);
		act(() => vi.advanceTimersByTime(400));
		expect(
			replacement?.classList.contains('navigation__item__count--initial')
		).toBe(false);
	});

	it('owns only one figma badge timer during StrictMode replay and cancels it on root unmount', async () => {
		const view = await renderIdleNavigation({ figma: true, strict: true });
		view.setCount(1);
		expect(
			view.container.querySelector('.navigation__item__count--figma')
		).not.toBeNull();
		expect(vi.getTimerCount()).toBe(1);
		act(() => vi.advanceTimersByTime(999));
		view.unmount();
		expect(vi.getTimerCount()).toBe(0);
		act(() => vi.advanceTimersByTime(1));
		expect(vi.getTimerCount()).toBe(0);
	});
});
