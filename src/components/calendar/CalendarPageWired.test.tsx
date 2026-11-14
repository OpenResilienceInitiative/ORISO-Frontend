// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import * as calendarApi from '../../api/apiCalendar';
import * as appointmentApi from '../../api/apiSessionAppointments';
import type { CalendarPageProps } from './CalendarPage';
import { CalendarPageWired } from './CalendarPageWired';

let props: CalendarPageProps;
vi.mock('./CalendarPage', () => ({
	CalendarPage: (p: CalendarPageProps) => {
		props = p;
		return null;
	}
}));
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ untilM: false })
}));
const sendNotice = vi.fn(() => Promise.resolve());
vi.mock('../sessionsList/timeline/useAppointmentNotice', () => ({
	useAppointmentNotice: () => sendNotice
}));
let consultant = true;
vi.mock('../../globalState', async () => {
	const React = await import('react');
	return {
		AUTHORITIES: { CONSULTANT_DEFAULT: 'CONSULTANT_DEFAULT' },
		hasUserAuthority: () => consultant,
		UserDataContext: React.createContext({
			userData: { userId: 'me' }
		})
	};
});
vi.mock('../../api/apiCalendar', () => ({
	apiGetCalendarEntries: vi.fn(),
	apiGetCalendarColleagues: vi.fn(),
	apiGetColleagueCalendarEntries: vi.fn(),
	apiGetCalendarSync: vi.fn(),
	apiGetCalendarWorkingHours: vi.fn(),
	apiSetCalendarWorkingHours: vi.fn(),
	apiPutWorkingDayException: vi.fn(),
	apiDeleteWorkingDayException: vi.fn(),
	apiCreateCalendarBlocker: vi.fn(),
	apiMoveCalendarBlocker: vi.fn(),
	apiDeleteCalendarBlocker: vi.fn(),
	apiResetCalendarFeed: vi.fn(),
	apiSaveCalendarImport: vi.fn(),
	apiRemoveCalendarImport: vi.fn()
}));
vi.mock('../../api/apiSessionAppointments', () => ({
	apiCreateSessionAppointment: vi.fn(() => Promise.resolve({})),
	apiMoveSessionAppointment: vi.fn(() => Promise.resolve({})),
	apiCancelSessionAppointment: vi.fn(() => Promise.resolve({}))
}));
vi.mock('../../api/apiGetConsultantSessionList', () => ({
	apiGetConsultantSessionList: vi.fn(() =>
		Promise.resolve({
			sessions: [
				{
					session: { id: 4401, matrixRoomId: '!room:oriso' },
					user: { username: 'ruhiges_yak' }
				},
				{ session: { id: 9 }, chat: { id: 9 } }
			]
		})
	)
}));
vi.mock('../../api/apiGetAskerSessionList', () => ({
	apiGetAskerSessionList: vi.fn(() => Promise.resolve({ sessions: [] }))
}));

const api = vi.mocked(calendarApi);
const appointments = vi.mocked(appointmentApi);

const OWN = {
	id: 'a1',
	type: 'APPOINTMENT' as const,
	start: '2026-11-16T09:00:00Z',
	end: '2026-11-16T10:00:00Z',
	ownerId: 'me',
	kind: 'VIDEO' as const,
	title: 'ruhiges_yak',
	sessionId: 4401,
	movable: true
};

const showWeek = () =>
	act(() =>
		props.onRangeChange?.(new Date(2026, 10, 16), new Date(2026, 10, 23))
	);

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});
beforeEach(() => {
	vi.clearAllMocks();
	// Monday of the week the tests show: the next days are inside it.
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(2026, 10, 16, 8));
	consultant = true;
	api.apiGetCalendarEntries.mockResolvedValue([OWN]);
	api.apiGetCalendarColleagues.mockResolvedValue({
		visibilityScope: 'TENANT',
		showAskerUsernames: false,
		colleagues: [
			{
				id: 'kaya',
				displayName: 'A. Kaya',
				agencyName: 'Nord',
				relation: 'SAME_AGENCY'
			}
		]
	});
	api.apiGetCalendarSync.mockResolvedValue({
		feedUrl: 'https://app.test/service/users/calendar/feed/f/s.ics',
		importConfigured: false
	});
	api.apiGetCalendarWorkingHours.mockResolvedValue({
		windows: [
			{ weekday: 2, start: '08:00', end: '16:00' },
			{ weekday: 1, start: '08:00', end: '18:00' }
		]
	});
});

describe('CalendarPageWired', () => {
	it('loads the visible range with a week of margin and maps the entries', async () => {
		render(<CalendarPageWired />);
		expect(props.state).toBe('loading');
		await showWeek();
		await waitFor(() => expect(props.state).toBe('ready'));
		const [from, to] = api.apiGetCalendarEntries.mock.calls[0];
		expect(from).toEqual(new Date(2026, 10, 9));
		expect(to).toEqual(new Date(2026, 10, 30));
		expect(props.entries).toEqual([
			expect.objectContaining({
				id: 'a1',
				kind: 'video',
				sessionId: 4401
			})
		]);
		await waitFor(() =>
			expect(props.visibility).toEqual({
				scope: 'TENANT',
				showUsernames: false
			})
		);
		expect(props.feed?.url).toContain('/calendar/feed/');
		// Group chats are no conversation for a 1:1 appointment.
		await waitFor(() =>
			expect(props.conversations).toEqual([
				expect.objectContaining({ sessionId: 4401 })
			])
		);
	});

	it('does not reload when paging inside the loaded window', async () => {
		render(<CalendarPageWired />);
		await showWeek();
		await act(() =>
			props.onRangeChange?.(
				new Date(2026, 10, 17),
				new Date(2026, 10, 24)
			)
		);
		expect(api.apiGetCalendarEntries).toHaveBeenCalledTimes(1);
	});

	it('shows the error state when the calendar cannot load', async () => {
		api.apiGetCalendarEntries.mockRejectedValue(new Error('500'));
		render(<CalendarPageWired />);
		await showWeek();
		await waitFor(() => expect(props.state).toBe('error'));
	});

	it('creates an appointment with its kind and tells the advice seeker', async () => {
		render(<CalendarPageWired />);
		await showWeek();
		await waitFor(() => expect(props.conversations).toHaveLength(1));
		const start = new Date('2026-11-17T09:00:00Z');
		const end = new Date('2026-11-17T10:00:00Z');
		await act(() =>
			props.onCreate?.([
				{
					type: 'appointment',
					start,
					end,
					kind: 'phone',
					sessionId: 4401
				}
			])
		);
		expect(appointments.apiCreateSessionAppointment).toHaveBeenCalledWith(
			4401,
			{
				startTime: start.toISOString(),
				endTime: end.toISOString(),
				kind: 'PHONE'
			}
		);
		expect(sendNotice).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 'created',
				sessionId: 4401,
				matrixRoomId: '!room:oriso'
			})
		);
	});

	it('loads the working hours sorted and saves them through UserService', async () => {
		render(<CalendarPageWired />);
		await waitFor(() =>
			expect(props.workingHours).toEqual([
				{ weekday: 1, start: '08:00', end: '18:00' },
				{ weekday: 2, start: '08:00', end: '16:00' }
			])
		);
		api.apiSetCalendarWorkingHours.mockResolvedValue({
			windows: [{ weekday: 5, start: '09:00', end: '13:00' }]
		});
		await act(() =>
			props.onSaveWorkingHours?.(
				[
					{ weekday: 5, start: '09:00', end: '13:00' },
					{ weekday: 6, start: '18:00', end: '09:00' }
				],
				null
			)
		);
		// A window that ends before it starts never reaches the backend.
		expect(api.apiSetCalendarWorkingHours).toHaveBeenCalledWith({
			windows: [{ weekday: 5, start: '09:00', end: '13:00' }],
			holidayRegion: null
		});
		await waitFor(() =>
			expect(props.workingHours).toEqual([
				{ weekday: 5, start: '09:00', end: '13:00' }
			])
		);
	});

	it('shades nothing when the working hours cannot load and rejects a failed save', async () => {
		api.apiGetCalendarWorkingHours.mockRejectedValue(new Error('404'));
		api.apiSetCalendarWorkingHours.mockRejectedValue(new Error('500'));
		render(<CalendarPageWired />);
		await showWeek();
		await waitFor(() => expect(props.state).toBe('ready'));
		expect(props.workingHours).toBeUndefined();
		await expect(
			props.onSaveWorkingHours?.(
				[{ weekday: 1, start: '08:00', end: '18:00' }],
				null
			)
		).rejects.toThrow('500');
	});

	it('saves the holiday region with the hours and puts it back when that fails', async () => {
		api.apiGetCalendarWorkingHours.mockResolvedValue({
			windows: [{ weekday: 1, start: '08:00', end: '16:00' }],
			holidayRegion: 'NW',
			exceptions: [
				{
					date: '2026-11-18',
					windows: [{ start: '10:00', end: '14:00' }]
				}
			]
		} as never);
		render(<CalendarPageWired />);
		await waitFor(() => expect(props.holidayRegion).toBe('NW'));
		expect(props.dayExceptions).toEqual({
			'2026-11-18': [{ start: '10:00', end: '14:00' }]
		});
		api.apiSetCalendarWorkingHours.mockResolvedValue({
			windows: [{ weekday: 1, start: '08:00', end: '16:00' }],
			holidayRegion: 'SN'
		} as never);
		await act(() =>
			props.onSaveWorkingHours?.(
				[{ weekday: 1, start: '08:00', end: '16:00' }],
				'SN'
			)
		);
		expect(api.apiSetCalendarWorkingHours).toHaveBeenLastCalledWith({
			windows: [{ weekday: 1, start: '08:00', end: '16:00' }],
			holidayRegion: 'SN'
		});
		expect(props.holidayRegion).toBe('SN');
		// An answer without exceptions keeps the ones already loaded.
		expect(props.dayExceptions).toEqual({
			'2026-11-18': [{ start: '10:00', end: '14:00' }]
		});

		let fail: (error: Error) => void = () => undefined;
		api.apiSetCalendarWorkingHours.mockReturnValue(
			new Promise((_, reject) => {
				fail = reject;
			}) as never
		);
		let saving: Promise<void> | undefined;
		act(() => {
			saving = props.onSaveWorkingHours?.(
				[{ weekday: 1, start: '07:00', end: '16:00' }],
				null
			);
		});
		// Shown at once ...
		expect(props.holidayRegion).toBeNull();
		expect(props.workingHours).toEqual([
			{ weekday: 1, start: '07:00', end: '16:00' }
		]);
		await act(async () => {
			fail(new Error('500'));
			await expect(saving).rejects.toThrow('500');
		});
		// ... and back when the save failed.
		expect(props.holidayRegion).toBe('SN');
		expect(props.workingHours).toEqual([
			{ weekday: 1, start: '08:00', end: '16:00' }
		]);
	});

	it('saves and removes a day exception at once, and goes back when that fails', async () => {
		render(<CalendarPageWired />);
		await waitFor(() => expect(props.workingHours).toHaveLength(2));
		api.apiPutWorkingDayException.mockResolvedValue({
			date: '2026-11-17',
			windows: [{ start: '09:30', end: '16:00' }]
		} as never);
		await act(() =>
			props.onSaveDayException?.('2026-11-17', [
				{ start: '09:30', end: '16:00' }
			])
		);
		expect(api.apiPutWorkingDayException).toHaveBeenCalledWith(
			'2026-11-17',
			[{ start: '09:30', end: '16:00' }]
		);
		expect(props.dayExceptions).toEqual({
			'2026-11-17': [{ start: '09:30', end: '16:00' }]
		});

		api.apiPutWorkingDayException.mockRejectedValue(new Error('409'));
		await act(async () => {
			await expect(
				props.onSaveDayException?.('2026-11-17', [
					{ start: '11:00', end: '16:00' }
				])
			).rejects.toThrow('409');
		});
		expect(props.dayExceptions).toEqual({
			'2026-11-17': [{ start: '09:30', end: '16:00' }]
		});

		api.apiDeleteWorkingDayException.mockRejectedValueOnce(
			new Error('500')
		);
		await act(async () => {
			await expect(
				props.onDeleteDayException?.('2026-11-17')
			).rejects.toThrow('500');
		});
		expect(props.dayExceptions?.['2026-11-17']).toBeDefined();
		api.apiDeleteWorkingDayException.mockResolvedValue(undefined as never);
		await act(() => props.onDeleteDayException?.('2026-11-17'));
		expect(api.apiDeleteWorkingDayException).toHaveBeenLastCalledWith(
			'2026-11-17'
		);
		expect(props.dayExceptions).toEqual({});
	});

	it('keeps the next days loaded while the grid shows another month (review 4574733789)', async () => {
		api.apiGetCalendarEntries.mockImplementation((from: Date) =>
			Promise.resolve(from.getMonth() === 10 ? [OWN] : [])
		);
		render(<CalendarPageWired />);
		await showWeek();
		await waitFor(() =>
			expect(props.entries.map((e) => e.id)).toEqual(['a1'])
		);
		// The week around today is loaded: no extra request.
		expect(api.apiGetCalendarEntries).toHaveBeenCalledTimes(1);
		await act(() =>
			props.onRangeChange?.(new Date(2027, 2, 1), new Date(2027, 2, 8))
		);
		await waitFor(() =>
			expect(api.apiGetCalendarEntries).toHaveBeenCalledTimes(3)
		);
		const near = api.apiGetCalendarEntries.mock.calls[2];
		expect(near?.[0]).toEqual(new Date(2026, 10, 16));
		expect(near?.[1]).toEqual(new Date(2026, 10, 24));
		// "Als Nächstes" and the next free hours still see today's entry.
		await waitFor(() =>
			expect(props.entries.map((e) => e.id)).toEqual(['a1'])
		);
	});

	it('returns the created blocked times so the page can undo them', async () => {
		api.apiCreateCalendarBlocker.mockResolvedValue([
			{
				...OWN,
				id: 'b9',
				type: 'BLOCKER',
				kind: null,
				sessionId: null,
				title: null
			} as never
		]);
		render(<CalendarPageWired />);
		await showWeek();
		const created = await props.onCreate?.([
			{
				type: 'blocker',
				start: new Date(2026, 10, 18, 12),
				end: new Date(2026, 10, 18, 13)
			}
		]);
		expect(created).toEqual([
			expect.objectContaining({ id: 'b9', type: 'blocker' })
		]);
	});

	it('creates a blocked-time series with one request', async () => {
		api.apiCreateCalendarBlocker.mockResolvedValue([]);
		render(<CalendarPageWired />);
		await showWeek();
		const start = new Date(2026, 10, 16, 8);
		await act(() =>
			props.onCreate?.([
				{
					type: 'blocker',
					start,
					end: new Date(2026, 10, 16, 12),
					repeat: { weekdays: [1], until: new Date(2026, 11, 14) }
				},
				{
					type: 'blocker',
					start: new Date(2026, 10, 23, 8),
					end: new Date(2026, 10, 23, 12)
				}
			])
		);
		expect(api.apiCreateCalendarBlocker).toHaveBeenCalledTimes(1);
		expect(api.apiCreateCalendarBlocker.mock.calls[0][0]).toMatchObject({
			start: start.toISOString(),
			repeat: { weekdays: [1], until: '2026-12-14' }
		});
		expect(sendNotice).not.toHaveBeenCalled();
	});

	it('moves an appointment through the conversation and a blocker through the calendar', async () => {
		render(<CalendarPageWired />);
		await showWeek();
		await waitFor(() => expect(props.conversations).toHaveLength(1));
		const start = new Date('2026-11-19T10:00:00Z');
		const end = new Date('2026-11-19T11:00:00Z');
		const own = props.entries[0];
		await act(() => props.onMove?.(own, start, end));
		expect(appointments.apiMoveSessionAppointment).toHaveBeenCalledWith(
			4401,
			'a1',
			{ startTime: start.toISOString(), endTime: end.toISOString() }
		);
		expect(sendNotice).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'moved' })
		);
		api.apiMoveCalendarBlocker.mockResolvedValue({} as never);
		await act(() =>
			props.onMove?.(
				{ ...own, id: 'b1', type: 'blocker', sessionId: undefined },
				start,
				end
			)
		);
		expect(api.apiMoveCalendarBlocker).toHaveBeenCalledWith('b1', {
			start: start.toISOString(),
			end: end.toISOString()
		});
	});

	it('rejects a failed save so the page shows the failure notice', async () => {
		appointments.apiCreateSessionAppointment.mockRejectedValueOnce(
			new Error('CONFLICT')
		);
		render(<CalendarPageWired />);
		await showWeek();
		await expect(
			props.onCreate?.([
				{
					type: 'appointment',
					start: new Date('2026-11-17T09:00:00Z'),
					end: new Date('2026-11-17T10:00:00Z'),
					kind: 'video',
					sessionId: 4401
				}
			])
		).rejects.toThrow('CONFLICT');
		expect(sendNotice).not.toHaveBeenCalled();
	});

	it('loads a colleague only once switched on', async () => {
		api.apiGetColleagueCalendarEntries.mockResolvedValue([
			{ ...OWN, id: 'k1', ownerId: 'kaya', title: null, sessionId: null }
		]);
		render(<CalendarPageWired />);
		await showWeek();
		expect(api.apiGetColleagueCalendarEntries).not.toHaveBeenCalled();
		await act(() => props.onShownColleaguesChange?.(['kaya']));
		await waitFor(() =>
			expect(props.entries.map((e) => e.id)).toEqual(['a1', 'k1'])
		);
		expect(api.apiGetColleagueCalendarEntries.mock.calls[0][0]).toBe(
			'kaya'
		);
	});

	it('gives advice seekers a read-only calendar without sync', async () => {
		consultant = false;
		render(<CalendarPageWired />);
		await showWeek();
		await waitFor(() => expect(props.state).toBe('ready'));
		expect(props.role).toBe('asker');
		expect(props.onCreate).toBeUndefined();
		expect(props.onMove).toBeUndefined();
		expect(props.feed).toBeUndefined();
		expect(api.apiGetCalendarColleagues).not.toHaveBeenCalled();
		expect(api.apiGetCalendarSync).not.toHaveBeenCalled();
		expect(api.apiGetCalendarWorkingHours).not.toHaveBeenCalled();
		expect(props.workingHours).toBeUndefined();
		expect(props.onSaveWorkingHours).toBeUndefined();
		// Proposals have no backend yet: never wired.
		expect(props.onProposeMove).toBeUndefined();
		expect(props.proposals).toBeUndefined();
	});

	it('sends a webcal import address as https and keeps only the host', async () => {
		api.apiSaveCalendarImport.mockResolvedValue({
			feedUrl: 'https://app.test/f.ics',
			importConfigured: true,
			importHost: 'p01.icloud.com'
		});
		render(<CalendarPageWired />);
		await showWeek();
		await act(() => props.onSaveImport?.('webcal://p01.icloud.com/x.ics'));
		expect(api.apiSaveCalendarImport).toHaveBeenCalledWith(
			'https://p01.icloud.com/x.ics'
		);
		await waitFor(() =>
			expect(props.busyImport).toEqual({
				host: 'p01.icloud.com',
				failed: false
			})
		);
	});
});
