// @vitest-environment oriso-jsdom
/**
 * FE#1050: "Meine Termine" counts the move proposals that wait for the
 * counsellor's answer, from every section (desktop rail and mobile bar
 * render the same items). The calendar tells it at once when the number
 * changes there.
 */
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
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { publishReceivedProposalCount } from '../calendar/calendarProposalCount';

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
vi.mock('../../api/apiGetConsultantSessionList', () => ({
	apiGetConsultantEnquiryCount: vi.fn(() => Promise.resolve(0))
}));

const apiGetCalendarProposals = vi.hoisted(() => vi.fn());
vi.mock('../../api/apiCalendar', () => ({
	apiGetCalendarProposals: (...args: unknown[]) =>
		apiGetCalendarProposals(...args)
}));

const CALENDAR = {
	to: '/booking/events',
	titleKeys: { large: 'navigation.booking.events' }
};
const SESSIONS = {
	to: '/sessions/consultant/sessionView',
	titleKeys: { large: 'navigation.consultant.sessions.large' }
};

const renderNavigation = (
	role: 'consultant' | 'asker' = 'consultant',
	navigation = [SESSIONS, CALENDAR]
) =>
	render(
		<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
			<NotificationsContext.Provider
				value={{ removeNotification: vi.fn() } as never}
			>
				<NavigationStoryProviders role={role}>
					<NavigationBar
						routerConfig={{ navigation }}
						onLogout={() => {}}
					/>
				</NavigationStoryProviders>
			</NotificationsContext.Provider>
		</MemoryRouter>
	);

const calendarLink = (container: HTMLElement) =>
	container.querySelector('a[href="/booking/events"]') as HTMLAnchorElement;
const count = (container: HTMLElement) =>
	calendarLink(container).querySelector('.navigation__item__count')
		?.textContent ?? null;

const proposals = (received: number) => ({
	sent: [],
	received: Array.from({ length: received }, (_, i) => ({ id: `p${i}` }))
});

describe('NavigationBar "Meine Termine" count (FE#1050)', () => {
	beforeEach(() => {
		localStorage.clear();
		apiGetCalendarProposals.mockReset();
	});
	afterEach(cleanup);

	describe.each([
		['mobile bar', false],
		['desktop rail', true]
	])('%s', (_label, fromL) => {
		beforeEach(() => {
			responsive.fromL = fromL;
		});

		it('shows how many proposals wait for an answer, also in the name', async () => {
			apiGetCalendarProposals.mockResolvedValue(proposals(2));
			const { container } = renderNavigation();
			await waitFor(() => expect(count(container)).toBe('2'));
			// "Meine Termine, 2 offene Verschiebungen" (keys: no catalogue here).
			expect(calendarLink(container).getAttribute('aria-label')).toBe(
				'navigation.booking.events, calendar.proposal.navCount'
			);
		});
	});

	it('takes the number the calendar reports, and shows none at 0', async () => {
		apiGetCalendarProposals.mockResolvedValue(proposals(1));
		const { container } = renderNavigation();
		await waitFor(() => expect(count(container)).toBe('1'));
		act(() => publishReceivedProposalCount(3));
		expect(count(container)).toBe('3');
		act(() => publishReceivedProposalCount(0));
		expect(count(container)).toBeNull();
	});

	it('keeps the last number when a reload fails', async () => {
		apiGetCalendarProposals.mockResolvedValueOnce(proposals(2));
		const { container } = renderNavigation();
		await waitFor(() => expect(count(container)).toBe('2'));
		apiGetCalendarProposals.mockRejectedValueOnce(new Error('503'));
		act(() => {
			document.dispatchEvent(new Event('visibilitychange'));
		});
		await act(async () => {
			await Promise.resolve();
		});
		expect(apiGetCalendarProposals).toHaveBeenCalledTimes(2);
		expect(count(container)).toBe('2');
	});

	it('never asks as an advice seeker, nor without "Meine Termine"', async () => {
		renderNavigation('asker');
		cleanup();
		renderNavigation('consultant', [SESSIONS]);
		await act(async () => {
			await Promise.resolve();
		});
		expect(apiGetCalendarProposals).not.toHaveBeenCalled();
	});
});
