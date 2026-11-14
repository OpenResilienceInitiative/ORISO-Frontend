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
import * as sessionListApi from '../../api/apiGetConsultantSessionList';
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
const sessionList = vi.mocked(sessionListApi);

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

afterEach(cleanup);
beforeEach(() => {
	vi.clearAllMocks();
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

	it('keeps the newer colleague entries when an older request answers last (reviews 4574504558, 4574938514)', async () => {
		const answers: ((list: unknown[]) => void)[] = [];
		api.apiGetColleagueCalendarEntries.mockImplementation(
			() =>
				new Promise((resolve) => {
					answers.push(resolve as (list: unknown[]) => void);
				}) as never
		);
		render(<CalendarPageWired />);
		await showWeek();
		await act(() => props.onShownColleaguesChange?.(['kaya']));
		// Paging far away starts a second request for the same colleague.
		await act(() =>
			props.onRangeChange?.(new Date(2026, 11, 14), new Date(2026, 11, 21))
		);
		expect(answers).toHaveLength(2);
		await act(async () =>
			answers[1]([{ ...OWN, id: 'dec', ownerId: 'kaya', sessionId: null }])
		);
		await act(async () =>
			answers[0]([{ ...OWN, id: 'nov', ownerId: 'kaya', sessionId: null }])
		);
		expect(props.entries.map((e) => e.id)).toContain('dec');
		expect(props.entries.map((e) => e.id)).not.toContain('nov');
	});

	it('ignores an older colleague failure after a newer answer', async () => {
		const settle: { ok: (l: unknown[]) => void; fail: (e: Error) => void }[] =
			[];
		api.apiGetColleagueCalendarEntries.mockImplementation(
			() =>
				new Promise((ok, fail) => {
					settle.push({
						ok: ok as (l: unknown[]) => void,
						fail
					});
				}) as never
		);
		render(<CalendarPageWired />);
		await showWeek();
		await act(() => props.onShownColleaguesChange?.(['kaya']));
		await act(() =>
			props.onRangeChange?.(new Date(2026, 11, 14), new Date(2026, 11, 21))
		);
		await act(async () =>
			settle[1].ok([{ ...OWN, id: 'dec', ownerId: 'kaya', sessionId: null }])
		);
		await act(async () => settle[0].fail(new Error('403')));
		expect(props.entries.map((e) => e.id)).toContain('dec');
	});

	it('loads every page of conversations (review 4574779934)', async () => {
		const session = (id: number) => ({
			session: { id, matrixRoomId: `!r${id}:oriso` },
			user: { username: `u${id}` }
		});
		const page = ({ offset = 0 }) =>
			Promise.resolve({
				count: 100,
				offset,
				total: 150,
				sessions: Array.from(
					{ length: offset === 0 ? 100 : 50 },
					(_, i) => session(offset + i + 1)
				)
			}) as never;
		sessionList.apiGetConsultantSessionList
			.mockImplementationOnce(page)
			.mockImplementationOnce(page);
		render(<CalendarPageWired />);
		await waitFor(() => expect(props.conversations).toHaveLength(150));
		expect(
			sessionList.apiGetConsultantSessionList.mock.calls.map(
				([args]) => args.offset
			)
		).toEqual([0, 100]);
	});

	it('shows a failed conversation lookup and retries it (review 4574493869)', async () => {
		sessionList.apiGetConsultantSessionList.mockRejectedValueOnce(
			new Error('500')
		);
		render(<CalendarPageWired />);
		await waitFor(() => expect(props.conversationsFailed).toBe(true));
		await act(async () => props.onRetryConversations?.());
		await waitFor(() => expect(props.conversationsFailed).toBe(false));
		await waitFor(() => expect(props.conversations).toHaveLength(1));
	});

	it('reloads the entries after the import is removed (review 4574938517)', async () => {
		api.apiRemoveCalendarImport.mockResolvedValue({
			feedUrl: 'https://app.test/f.ics',
			importConfigured: false
		});
		render(<CalendarPageWired />);
		await showWeek();
		await waitFor(() => expect(props.state).toBe('ready'));
		expect(api.apiGetCalendarEntries).toHaveBeenCalledTimes(1);
		await act(async () => props.onRemoveImport?.());
		expect(api.apiGetCalendarEntries).toHaveBeenCalledTimes(2);
	});

	it('rejects failed sync actions so the dialog can say so (review 4574504562)', async () => {
		api.apiResetCalendarFeed.mockRejectedValue(new Error('500'));
		api.apiRemoveCalendarImport.mockRejectedValue(new Error('500'));
		api.apiSaveCalendarImport.mockRejectedValue(new Error('400'));
		render(<CalendarPageWired />);
		await showWeek();
		await expect(props.onResetFeed?.()).rejects.toThrow('500');
		await expect(props.onRemoveImport?.()).rejects.toThrow('500');
		await expect(props.onSaveImport?.('https://x.test/a.ics')).rejects.toThrow(
			'400'
		);
	});
});
