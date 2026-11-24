// @vitest-environment oriso-jsdom
/**
 * The real page under the wired container, FullCalendar included: nothing
 * calls `onRangeChange` by hand. Reviews 4574733779 and 4574779921 — while
 * the first range loads, the calendar must stay mounted, or it never
 * reports its range and the spinner stays forever.
 */
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import * as calendarApi from '../../api/apiCalendar';
import * as askerListApi from '../../api/apiGetAskerSessionList';
import { CalendarPageWired } from './CalendarPageWired';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));
const user = vi.hoisted(() => ({ consultant: true, navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => user.navigate }));
/* "Direkteinladung erlauben" needs the tenant and agencies; off here. */
vi.mock('../directLinks/useDirectLinksAllowed', () => ({
	useDirectLinkMedia: () => []
}));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ untilM: false })
}));
vi.mock('../sessionsList/timeline/useAppointmentNotice', () => ({
	useAppointmentNotice: () => () => Promise.resolve()
}));
// *19: the links box has its own data hooks; not part of these tests.
vi.mock('./CalendarLinksSection', () => ({
	CalendarLinksSection: () => null
}));
vi.mock('../../globalState', async () => {
	const React = await import('react');
	return {
		AUTHORITIES: { CONSULTANT_DEFAULT: 'CONSULTANT_DEFAULT' },
		hasUserAuthority: () => user.consultant,
		UserDataContext: React.createContext({ userData: { userId: 'me' } })
	};
});
vi.mock('../../api/apiCalendar', () => ({
	apiCreateColleagueAppointment: vi.fn(() =>
		Promise.resolve({
			id: 'm1',
			type: 'APPOINTMENT',
			start: '2026-11-19T09:00:00Z',
			end: '2026-11-19T10:00:00Z',
			ownerId: 'me',
			matrixRoomId: '!pair:oriso',
			chatId: 77
		})
	),
	apiAcceptColleagueAppointment: vi.fn(() => Promise.resolve({})),
	apiDeclineColleagueAppointment: vi.fn(() => Promise.resolve()),
	apiCancelColleagueAppointment: vi.fn(() => Promise.resolve()),
	apiGetCalendarAutoAccept: vi.fn(() =>
		Promise.resolve({ colleagueIds: [] })
	),
	apiSetCalendarAutoAccept: vi.fn((dto) => Promise.resolve(dto)),
	apiGetCalendarEntries: vi.fn(),
	apiGetCalendarColleagues: vi.fn(() =>
		Promise.resolve({
			visibilityScope: 'TENANT',
			showAskerUsernames: false,
			colleagues: []
		})
	),
	apiGetColleagueCalendarEntries: vi.fn(() => Promise.resolve([])),
	apiGetCalendarSync: vi.fn(() =>
		Promise.resolve({ feedUrl: '', importConfigured: false })
	),
	apiGetCalendarWorkingHours: vi.fn(() => Promise.resolve({ windows: [] })),
	apiGetCalendarConsultationHours: vi.fn(() =>
		Promise.resolve({ windows: [] })
	),
	apiGetCalendarConsultationOnce: vi.fn(() => Promise.resolve([])),
	apiCreateCalendarConsultationOnce: vi.fn(),
	apiSetCalendarWorkingHours: vi.fn(),
	apiPutWorkingDayException: vi.fn(),
	apiDeleteWorkingDayException: vi.fn(),
	apiCreateCalendarBlocker: vi.fn(),
	apiMoveCalendarBlocker: vi.fn(),
	apiDeleteCalendarBlocker: vi.fn(),
	apiResetCalendarFeed: vi.fn(),
	apiSaveCalendarImport: vi.fn(),
	apiRemoveCalendarImport: vi.fn(),
	apiGetCalendarProposals: vi.fn(() =>
		Promise.resolve({ sent: [], received: [] })
	),
	apiCreateCalendarProposal: vi.fn(),
	apiWithdrawCalendarProposal: vi.fn(),
	apiAcceptCalendarProposal: vi.fn(),
	apiDeclineCalendarProposal: vi.fn()
}));
vi.mock('../../api/apiSessionAppointments', () => ({
	apiCreateSessionAppointment: vi.fn(),
	apiMoveSessionAppointment: vi.fn(),
	apiCancelSessionAppointment: vi.fn(),
	apiGetAppointmentSlots: vi.fn(() => Promise.resolve([])),
	apiBookAppointmentSlot: vi.fn()
}));
vi.mock('../../api/apiGetConsultantSessionList', () => ({
	apiGetConsultantSessionList: vi.fn(() => Promise.resolve({ sessions: [] }))
}));
vi.mock('../../api/apiGetAskerSessionList', () => ({
	apiGetAskerSessionList: vi.fn(() => Promise.resolve({ sessions: [] }))
}));

const api = vi.mocked(calendarApi);
const askerList = vi.mocked(askerListApi);

// jsdom lacks what FullCalendar and the split view measure with.
if (typeof window.ResizeObserver === 'undefined')
	window.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
if (!HTMLElement.prototype.scrollTo)
	HTMLElement.prototype.scrollTo = () => undefined;
if (!window.matchMedia)
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => undefined,
		removeListener: () => undefined,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		dispatchEvent: () => false
	})) as typeof window.matchMedia;

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});
beforeEach(() => {
	vi.clearAllMocks();
	user.consultant = true;
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(2026, 10, 16, 8));
	window.localStorage.clear();
});

describe('CalendarPageWired — first load (reviews 4574733779, 4574779921)', () => {
	it('mounts the calendar while loading, so it reports its range and the entries load', async () => {
		let answer: (list: never[]) => void = () => undefined;
		api.apiGetCalendarEntries.mockReturnValue(
			new Promise((resolve) => {
				answer = resolve;
			}) as never
		);
		render(<CalendarPageWired />);
		// The calendar reports its range by itself and the entries load.
		await waitFor(() =>
			expect(api.apiGetCalendarEntries).toHaveBeenCalled()
		);
		// Loading shows over the mounted calendar, not instead of it.
		expect(screen.getByTestId('calendar-loading')).toBeTruthy();
		expect(screen.getByTestId('calendar-view')).toBeTruthy();
		answer([]);
		await waitFor(() =>
			expect(screen.queryByTestId('calendar-loading')).toBeNull()
		);
		expect(screen.getByTestId('calendar-view')).toBeTruthy();
	});
});

describe('CalendarPageWired — an asker whose conversation lookup failed (review 4575945125)', () => {
	it('shows the failure with a retry, and once retried the appointment leads to its chat', async () => {
		user.consultant = false;
		api.apiGetCalendarEntries.mockResolvedValue([
			{
				id: 'a1',
				type: 'APPOINTMENT',
				start: new Date(2026, 10, 16, 10).toISOString(),
				end: new Date(2026, 10, 16, 11).toISOString(),
				ownerId: 'me',
				kind: 'VIDEO',
				title: 'B. Berater',
				sessionId: 4401
			}
		] as never);
		askerList.apiGetAskerSessionList
			.mockRejectedValueOnce(new Error('503'))
			.mockResolvedValueOnce({
				sessions: [
					{
						session: { id: 4401, matrixRoomId: '!room:oriso' },
						consultant: { displayName: 'B. Berater' }
					}
				]
			} as never);
		render(<CalendarPageWired />);
		const banner = await screen.findByTestId(
			'calendar-conversations-failed'
		);
		expect(banner.textContent).toContain(
			'calendar.conversationsFailedAsker'
		);
		await act(async () => {
			fireEvent.click(
				banner.querySelector('.calendarPage__retry') as HTMLElement
			);
		});
		await waitFor(() =>
			expect(
				screen.queryByTestId('calendar-conversations-failed')
			).toBeNull()
		);
		// "Als Nächstes" lists the appointment (the sidebar's row).
		const row = await waitFor(() => {
			const found = document.querySelector<HTMLElement>(
				'[data-cy="calendar-upcoming-a1"]'
			);
			expect(found).not.toBeNull();
			return found as HTMLElement;
		});
		fireEvent.click(row);
		// The entry's menu (round 2) in place of the details dialog.
		const start = await waitFor(() => {
			const found = document.querySelector<HTMLElement>(
				'[data-cy="calendar-entry-start"]'
			);
			expect(found).not.toBeNull();
			return found as HTMLElement;
		});
		fireEvent.click(start);
		expect(user.navigate).toHaveBeenCalledWith(
			'/sessions/user/view/!room:oriso/4401'
		);
	});
});

describe('CalendarPageWired — answering a move proposal, page included', () => {
	const own = {
		id: 'a1',
		type: 'APPOINTMENT' as const,
		start: new Date(2026, 10, 17, 9).toISOString(),
		end: new Date(2026, 10, 17, 10).toISOString(),
		ownerId: 'me',
		kind: 'VIDEO' as const,
		title: 'ruhiges_yak',
		sessionId: 4401,
		movable: true
	};
	const request = {
		id: 'p1',
		entryId: 'a1',
		start: new Date(2026, 10, 18, 14).toISOString(),
		end: new Date(2026, 10, 18, 15).toISOString(),
		entryStart: own.start,
		entryEnd: own.end,
		proposerId: 'kaya',
		proposerName: 'A. Kaya',
		approverId: 'me'
	};

	const acceptEl = () =>
		document.querySelector<HTMLElement>(
			'[data-cy="calendar-received-accept-p1"]'
		) as HTMLElement;

	beforeEach(() => {
		api.apiGetCalendarEntries.mockResolvedValue([own] as never);
		api.apiGetCalendarProposals.mockResolvedValue({
			sent: [],
			received: [request]
		} as never);
	});

	it('moves the appointment, reloads the calendar and shows the move notice', async () => {
		api.apiAcceptCalendarProposal.mockResolvedValue({
			...own,
			start: request.start,
			end: request.end
		} as never);
		render(<CalendarPageWired />);
		await waitFor(() => expect(acceptEl()).not.toBeNull());
		const loads = api.apiGetCalendarEntries.mock.calls.length;
		api.apiGetCalendarProposals.mockResolvedValue({
			sent: [],
			received: []
		} as never);
		await act(async () => {
			fireEvent.click(acceptEl());
		});
		expect(api.apiAcceptCalendarProposal).toHaveBeenCalledWith('p1');
		expect(await screen.findByText('calendar.moved')).toBeTruthy();
		await waitFor(() =>
			expect(api.apiGetCalendarEntries.mock.calls.length).toBeGreaterThan(
				loads
			)
		);
		await waitFor(() =>
			expect(
				document.querySelector('[data-cy="calendar-received-p1"]')
			).toBeNull()
		);
	});

	it('says the proposal no longer applies on a 409 and reloads', async () => {
		api.apiAcceptCalendarProposal.mockRejectedValue(
			new Error('CONFLICT') as never
		);
		render(<CalendarPageWired />);
		await waitFor(() => expect(acceptEl()).not.toBeNull());
		const loads = api.apiGetCalendarEntries.mock.calls.length;
		await act(async () => {
			fireEvent.click(acceptEl());
		});
		expect(
			await screen.findByText('calendar.proposal.noLongerValid')
		).toBeTruthy();
		expect(screen.queryByText('calendar.moved')).toBeNull();
		await waitFor(() =>
			expect(api.apiGetCalendarEntries.mock.calls.length).toBeGreaterThan(
				loads
			)
		);
	});
});
