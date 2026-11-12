// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
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
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';

vi.mock('lottie-react', () => ({ default: () => null }));

const responsive = vi.hoisted(() => ({ fromL: false }));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({
		fromS: responsive.fromL,
		fromM: responsive.fromL,
		fromL: responsive.fromL,
		fromXL: false,
		fromXXL: false,
		untilL: !responsive.fromL
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
vi.mock('../../api/apiGetAskerSessionList', () => ({
	apiGetAskerSessionList: vi.fn(() => new Promise(() => {}))
}));

const apiGetConsultantEnquiryCount = vi.hoisted(() => vi.fn());
vi.mock('../../api/apiGetConsultantSessionList', () => ({
	apiGetConsultantEnquiryCount: (...args: unknown[]) =>
		apiGetConsultantEnquiryCount(...args)
}));

const addonRoutes = (badge?: number) => ({
	navigation: [
		{
			to: '/sessions/consultant/sessionView',
			titleKeys: { large: 'navigation.consultant.sessions.large' }
		},
		{
			to: '/addons/digisucht-tools/overview',
			title: 'Übersicht',
			titleKeys: { large: 'Übersicht' },
			navSlot: 'row',
			badge
		}
	]
});

const renderNavigation = (badge?: number) =>
	render(
		<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
			<NotificationsContext.Provider
				value={{ removeNotification: vi.fn() } as never}
			>
				<NavigationStoryProviders role="consultant">
					<NavigationBar
						routerConfig={addonRoutes(badge)}
						onLogout={() => {}}
					/>
				</NavigationStoryProviders>
			</NotificationsContext.Provider>
		</MemoryRouter>
	);

const addonLink = (container: HTMLElement) =>
	container.querySelector(
		'a[href="/addons/digisucht-tools/overview"]'
	) as HTMLAnchorElement;

describe('NavigationBar add-on badge (oriso-addon/v1 section 4)', () => {
	beforeEach(() => {
		localStorage.clear();
		apiGetConsultantEnquiryCount.mockResolvedValue(0);
	});

	afterEach(() => {
		cleanup();
	});

	it.each([
		['mobile bar', false],
		['desktop rail', true]
	])(
		'%s shows the badge, capped at 99+, and names it',
		async (_label, fromL) => {
			responsive.fromL = fromL;
			const { container } = renderNavigation(120);
			await waitFor(() =>
				expect(
					addonLink(container).querySelector(
						'.navigation__item__count'
					)?.textContent
				).toBe('99+')
			);
			expect(addonLink(container).getAttribute('aria-label')).toBe(
				'Übersicht, addons.badge'
			);
		}
	);

	it('shows no badge for 0 or none', async () => {
		const { container } = renderNavigation(0);
		await waitFor(() => expect(addonLink(container)).toBeTruthy());
		expect(
			addonLink(container).querySelector('.navigation__item__count')
		).toBeNull();
		expect(addonLink(container).getAttribute('aria-label')).toBe(
			'Übersicht'
		);
	});
});
