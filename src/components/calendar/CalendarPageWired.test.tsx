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
import * as askerListApi from '../../api/apiGetAskerSessionList';
import type { CalendarPageProps } from './CalendarPage';
import { CalendarPageWired } from './CalendarPageWired';
import { TooManyDayExceptions } from './calendarWorkingHours';

let props: CalendarPageProps;
vi.mock('./CalendarPage', () => ({
	CalendarPage: (p: CalendarPageProps) => {
		props = p;
		return null;
	}
}));
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
// The screen width the media queries answer for. react-responsive takes
// window.matchMedia when it loads, so the stand-in goes in first.
const screen = vi.hoisted(() => {
	const state = { width: 1440 };
	window.matchMedia = ((query: string) => {
		const max = /max-width:\s*(\d+)/.exec(query);
		const min = /min-width:\s*(\d+)/.exec(query);
		return {
			matches:
				(!max || state.width <= Number(max[1])) &&
				(!min || state.width >= Number(min[1])),
			media: query,
			onchange: null,
			addListener: () => undefined,
			removeListener: () => undefined,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			dispatchEvent: () => false
		};
	}) as unknown as typeof window.matchMedia;
	return state;
});
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
const sessionList = vi.mocked(sessionListApi);
const askerList = vi.mocked(askerListApi);

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
	screen.width = 1440;
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

describe('CalendarPageWired — phone and tablet layout (prototype v15)', () => {
	it.each([
		[390, true, true],
		[599, true, true],
		[600, true, false],
		[820, true, false],
		[960, true, false],
		[961, false, false],
		[1440, false, false]
	])(
		'at %i px: phone layout %s, at most three days %s',
		(width, compact, phone) => {
			screen.width = width;
			render(<CalendarPageWired />);
			expect(props.compact).toBe(compact);
			expect(props.phone).toBe(phone);
		}
	);
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

	it('opens the schedule for editing only once it has loaded (review 4574779938)', async () => {
		let answer: (dto: unknown) => void = () => undefined;
		api.apiGetCalendarWorkingHours.mockReturnValueOnce(
			new Promise((resolve) => {
				answer = resolve;
			}) as never
		);
		render(<CalendarPageWired />);
		expect(props.workingHoursLoaded).toBe(false);
		await act(async () => {
			answer({ windows: [{ weekday: 1, start: '08:00', end: '16:00' }] });
		});
		expect(props.workingHoursLoaded).toBe(true);
	});

	it('keeps the schedule closed when it cannot load (review 4574779938)', async () => {
		api.apiGetCalendarWorkingHours.mockRejectedValueOnce(new Error('503'));
		render(<CalendarPageWired />);
		await showWeek();
		await waitFor(() => expect(props.state).toBe('ready'));
		expect(props.workingHoursLoaded).toBe(false);
	});

	it('keeps an edit when the first read answers after it (review 4574779933)', async () => {
		let answer: (dto: unknown) => void = () => undefined;
		api.apiGetCalendarWorkingHours.mockReturnValueOnce(
			new Promise((resolve) => {
				answer = resolve;
			}) as never
		);
		api.apiPutWorkingDayException.mockResolvedValue({
			date: '2026-11-17',
			windows: [{ start: '09:30', end: '16:00' }]
		} as never);
		render(<CalendarPageWired />);
		await act(() =>
			props.onSaveDayException?.('2026-11-17', [
				{ start: '09:30', end: '16:00' }
			])
		);
		await act(async () => {
			answer({
				windows: [{ weekday: 1, start: '08:00', end: '16:00' }],
				exceptions: []
			});
		});
		expect(props.dayExceptions).toEqual({
			'2026-11-17': [{ start: '09:30', end: '16:00' }]
		});
	});

	describe('weekly hours and day exceptions saved side by side', () => {
		const pending = () => {
			let settle = {
				resolve: (_: unknown) => undefined as void,
				reject: (_: Error) => undefined as void
			};
			const promise = new Promise((resolve, reject) => {
				settle = { resolve, reject };
			});
			return { promise, settle: () => settle };
		};
		const loaded = async () => {
			render(<CalendarPageWired />);
			await waitFor(() => expect(props.workingHours).toHaveLength(2));
		};
		const saveDay = async (date: string, start: string) => {
			api.apiPutWorkingDayException.mockResolvedValueOnce({
				date,
				windows: [{ start, end: '16:00' }]
			} as never);
			await act(() =>
				props.onSaveDayException?.(date, [{ start, end: '16:00' }])
			);
		};

		it('keeps a day saved while the weekly save runs (review 4574981869)', async () => {
			await loaded();
			const weekly = pending();
			api.apiSetCalendarWorkingHours.mockReturnValueOnce(
				weekly.promise as never
			);
			let saving: Promise<void> | undefined;
			act(() => {
				saving = props.onSaveWorkingHours?.(
					[{ weekday: 1, start: '07:00', end: '16:00' }],
					null
				);
			});
			await saveDay('2026-11-18', '10:00');
			// The weekly answer's exceptions predate the day save.
			await act(async () => {
				weekly.settle().resolve({
					windows: [{ weekday: 1, start: '07:00', end: '16:00' }],
					holidayRegion: null,
					exceptions: []
				});
				await saving;
			});
			expect(props.workingHours).toEqual([
				{ weekday: 1, start: '07:00', end: '16:00' }
			]);
			expect(props.dayExceptions).toEqual({
				'2026-11-18': [{ start: '10:00', end: '16:00' }]
			});
		});

		it('puts back only the weekly hours when the weekly save fails (review 4574981870)', async () => {
			await loaded();
			const weekly = pending();
			api.apiSetCalendarWorkingHours.mockReturnValueOnce(
				weekly.promise as never
			);
			let saving: Promise<void> | undefined;
			act(() => {
				saving = props.onSaveWorkingHours?.(
					[{ weekday: 1, start: '07:00', end: '16:00' }],
					'SN'
				);
			});
			await saveDay('2026-11-18', '10:00');
			await act(async () => {
				weekly.settle().reject(new Error('500'));
				await expect(saving).rejects.toThrow('500');
			});
			expect(props.workingHours).toEqual([
				{ weekday: 1, start: '08:00', end: '18:00' },
				{ weekday: 2, start: '08:00', end: '16:00' }
			]);
			expect(props.holidayRegion).toBeNull();
			expect(props.dayExceptions).toEqual({
				'2026-11-18': [{ start: '10:00', end: '16:00' }]
			});
		});

		it('rolls a failed weekly save back to the newest stored hours, not a late older answer (review 4575297349)', async () => {
			await loaded();
			const a = pending();
			const hoursA = [{ weekday: 1, start: '07:00', end: '16:00' }];
			const hoursB = [{ weekday: 1, start: '09:00', end: '17:00' }];
			const hoursC = [{ weekday: 1, start: '10:00', end: '18:00' }];
			api.apiSetCalendarWorkingHours
				.mockReturnValueOnce(a.promise as never)
				.mockResolvedValueOnce({
					windows: hoursB,
					holidayRegion: null,
					exceptions: []
				} as never)
				.mockRejectedValueOnce(new Error('500'));
			let saveA: Promise<void> | undefined;
			let saveB: Promise<void> | undefined;
			act(() => {
				saveA = props.onSaveWorkingHours?.(hoursA, null);
				saveB = props.onSaveWorkingHours?.(hoursB, null);
			});
			// B waits for A (review 4577586476); A answers, then B.
			await act(async () => {
				a.settle().resolve({
					windows: hoursA,
					holidayRegion: null,
					exceptions: []
				});
				await saveA;
				await saveB;
			});
			await act(async () => {
				await expect(
					props.onSaveWorkingHours?.(hoursC, null)
				).rejects.toThrow('500');
			});
			expect(props.workingHours).toEqual(hoursB);
		});

		it('rolls a failed day save back to the newest stored day, not a late older answer (review 4575297349)', async () => {
			await loaded();
			const a = pending();
			api.apiPutWorkingDayException.mockReturnValueOnce(
				a.promise as never
			);
			let saveA: Promise<void> | undefined;
			let saveB: Promise<void> | undefined;
			api.apiPutWorkingDayException.mockResolvedValueOnce({
				date: '2026-11-18',
				windows: [{ start: '11:00', end: '16:00' }]
			} as never);
			act(() => {
				saveA = props.onSaveDayException?.('2026-11-18', [
					{ start: '09:00', end: '16:00' }
				]);
				saveB = props.onSaveDayException?.('2026-11-18', [
					{ start: '11:00', end: '16:00' }
				]);
			});
			await act(async () => {
				a.settle().resolve({
					date: '2026-11-18',
					windows: [{ start: '09:00', end: '16:00' }]
				});
				await saveA;
				await saveB;
			});
			api.apiPutWorkingDayException.mockRejectedValueOnce(
				new Error('500')
			);
			await act(async () => {
				await expect(
					props.onSaveDayException?.('2026-11-18', [
						{ start: '12:00', end: '16:00' }
					])
				).rejects.toThrow('500');
			});
			expect(props.dayExceptions).toEqual({
				'2026-11-18': [{ start: '11:00', end: '16:00' }]
			});
		});

		it('lets an older failure of a day not undo its newer save (review 4574981875)', async () => {
			await loaded();
			const older = pending();
			api.apiPutWorkingDayException.mockReturnValueOnce(
				older.promise as never
			);
			let first: Promise<void> | undefined;
			let second: Promise<void> | undefined;
			api.apiPutWorkingDayException.mockResolvedValueOnce({
				date: '2026-11-18',
				windows: [{ start: '11:00', end: '16:00' }]
			} as never);
			act(() => {
				first = props.onSaveDayException?.('2026-11-18', [
					{ start: '09:00', end: '16:00' }
				]);
				second = props.onSaveDayException?.('2026-11-18', [
					{ start: '11:00', end: '16:00' }
				]);
			});
			await act(async () => {
				older.settle().reject(new Error('409'));
				await expect(first).rejects.toThrow('409');
				await second;
			});
			expect(props.dayExceptions).toEqual({
				'2026-11-18': [{ start: '11:00', end: '16:00' }]
			});
		});
	});

	it('turns a 409 for a day into the limit of own days (review 4577586484)', async () => {
		render(<CalendarPageWired />);
		await waitFor(() => expect(props.workingHours).toHaveLength(2));
		api.apiPutWorkingDayException.mockRejectedValueOnce(
			new Error('CONFLICT')
		);
		await act(async () => {
			await expect(
				props.onSaveDayException?.('2026-11-18', [
					{ start: '09:00', end: '16:00' }
				])
			).rejects.toBeInstanceOf(TooManyDayExceptions);
		});
	});

	describe('saves in click order (review 4577586476)', () => {
		const deferred = () => {
			let resolve: (value: unknown) => void = () => undefined;
			let reject: (error: Error) => void = () => undefined;
			const promise = new Promise((res, rej) => {
				resolve = res;
				reject = rej;
			});
			return { promise, resolve, reject };
		};
		const loaded = async () => {
			render(<CalendarPageWired />);
			await waitFor(() => expect(props.workingHours).toHaveLength(2));
		};
		const MONDAY_A = [{ weekday: 1, start: '07:00', end: '16:00' }];
		const MONDAY_B = [
			{ weekday: 1, start: '07:00', end: '16:00' },
			{ weekday: 2, start: '08:00', end: '15:00' }
		];

		it('sends a weekly save only after the one before it has answered', async () => {
			await loaded();
			const a = deferred();
			api.apiSetCalendarWorkingHours
				.mockReturnValueOnce(a.promise as never)
				.mockResolvedValueOnce({
					windows: MONDAY_B,
					holidayRegion: null,
					exceptions: []
				} as never);
			let saveA: Promise<void> | undefined;
			let saveB: Promise<void> | undefined;
			act(() => {
				saveA = props.onSaveWorkingHours?.(MONDAY_A, null);
				saveB = props.onSaveWorkingHours?.(MONDAY_B, null);
			});
			await act(async () => undefined);
			expect(api.apiSetCalendarWorkingHours).toHaveBeenCalledTimes(1);
			// Both show at once; only the requests wait.
			expect(props.workingHours).toEqual(MONDAY_B);
			await act(async () => {
				a.resolve({
					windows: MONDAY_A,
					holidayRegion: null,
					exceptions: []
				});
				await saveA;
				await saveB;
			});
			expect(api.apiSetCalendarWorkingHours).toHaveBeenCalledTimes(2);
			expect(
				api.apiSetCalendarWorkingHours.mock.calls[1][0].windows
			).toEqual(MONDAY_B);
			expect(props.workingHours).toEqual(MONDAY_B);
		});

		it('still sends the next weekly save when the one before it failed', async () => {
			await loaded();
			const a = deferred();
			api.apiSetCalendarWorkingHours
				.mockReturnValueOnce(a.promise as never)
				.mockResolvedValueOnce({
					windows: MONDAY_B,
					holidayRegion: null,
					exceptions: []
				} as never);
			let saveA: Promise<void> | undefined;
			let saveB: Promise<void> | undefined;
			act(() => {
				saveA = props.onSaveWorkingHours?.(MONDAY_A, null);
				saveB = props.onSaveWorkingHours?.(MONDAY_B, null);
			});
			await act(async () => {
				a.reject(new Error('500'));
				await expect(saveA).rejects.toThrow('500');
				await saveB;
			});
			expect(api.apiSetCalendarWorkingHours).toHaveBeenCalledTimes(2);
			expect(props.workingHours).toEqual(MONDAY_B);
		});

		it('sends the saves of one date in order, and another date at once', async () => {
			await loaded();
			const first = deferred();
			api.apiPutWorkingDayException
				.mockReturnValueOnce(first.promise as never)
				.mockResolvedValueOnce({
					date: '2026-11-19',
					windows: [{ start: '10:00', end: '16:00' }]
				} as never);
			api.apiDeleteWorkingDayException.mockResolvedValueOnce(
				undefined as never
			);
			let put: Promise<void> | undefined;
			let removal: Promise<void> | undefined;
			let other: Promise<void> | undefined;
			act(() => {
				put = props.onSaveDayException?.('2026-11-18', [
					{ start: '09:00', end: '16:00' }
				]);
				removal = props.onDeleteDayException?.('2026-11-18');
				other = props.onSaveDayException?.('2026-11-19', [
					{ start: '10:00', end: '16:00' }
				]);
			});
			await act(async () => {
				await other;
			});
			expect(api.apiPutWorkingDayException).toHaveBeenCalledTimes(2);
			expect(api.apiDeleteWorkingDayException).not.toHaveBeenCalled();
			await act(async () => {
				first.resolve({
					date: '2026-11-18',
					windows: [{ start: '09:00', end: '16:00' }]
				});
				await put;
				await removal;
			});
			expect(api.apiDeleteWorkingDayException).toHaveBeenCalledWith(
				'2026-11-18'
			);
			expect(props.dayExceptions).toEqual({
				'2026-11-19': [{ start: '10:00', end: '16:00' }]
			});
		});
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

	it('marks a shown colleague as loading until their range is in, also after paging (review 4576313280)', async () => {
		const answers: ((list: never[]) => void)[] = [];
		api.apiGetColleagueCalendarEntries.mockImplementation(
			() => new Promise((resolve) => answers.push(resolve))
		);
		// Only the colleagues here; one's own calendar has its own test.
		const colleaguesLoading = () =>
			(props.loadingCalendars ?? []).filter((id) => id !== 'me');
		render(<CalendarPageWired />);
		await showWeek();
		await act(() => props.onShownColleaguesChange?.(['kaya']));
		expect(colleaguesLoading()).toEqual(['kaya']);
		await act(async () => answers[0]([]));
		await waitFor(() => expect(colleaguesLoading()).toEqual([]));
		// Another month: the old entries say nothing about it.
		await act(() =>
			props.onRangeChange?.(new Date(2027, 2, 1), new Date(2027, 2, 8))
		);
		expect(colleaguesLoading()).toEqual(['kaya']);
		await act(async () => answers[1]([]));
		await waitFor(() => expect(colleaguesLoading()).toEqual([]));
		// Switched off while loading: no longer anyone's concern.
		await act(() =>
			props.onRangeChange?.(new Date(2027, 5, 1), new Date(2027, 5, 8))
		);
		expect(colleaguesLoading()).toEqual(['kaya']);
		await act(() => props.onShownColleaguesChange?.([]));
		expect(colleaguesLoading()).toEqual([]);
	});

	it('marks its own calendar as loading while another range is on its way (review 4576368852)', async () => {
		render(<CalendarPageWired />);
		await showWeek();
		await waitFor(() => expect(props.loadingCalendars ?? []).toEqual([]));
		let answer!: (list: (typeof OWN)[]) => void;
		api.apiGetCalendarEntries.mockImplementation((from: Date) =>
			// The loaded window around March; this week's comes apart.
			from.getFullYear() === 2027
				? new Promise((resolve) => {
						answer = resolve;
					})
				: Promise.resolve([OWN])
		);
		await act(() =>
			props.onRangeChange?.(new Date(2027, 2, 1), new Date(2027, 2, 8))
		);
		// The previous range's own entries say nothing about this one.
		expect(props.loadingCalendars).toContain('me');
		await act(async () =>
			answer([
				{
					...OWN,
					id: 'm1',
					start: '2027-03-02T09:00:00Z',
					end: '2027-03-02T10:00:00Z'
				}
			])
		);
		await waitFor(() =>
			expect(props.loadingCalendars ?? []).not.toContain('me')
		);
		expect(props.entries.map((e) => e.id)).toContain('m1');
	});

	it('says the next free hours are unknown while this week did not load, and tries again (review 4576313283)', async () => {
		let nearCalls = 0;
		api.apiGetCalendarEntries.mockImplementation((from: Date, to: Date) => {
			if (from.getFullYear() === 2027) return Promise.resolve([]);
			if (to.getTime() === new Date(2026, 10, 24).getTime()) {
				nearCalls += 1;
				return nearCalls < 3
					? Promise.reject(new Error('503'))
					: Promise.resolve([OWN]);
			}
			return Promise.resolve([OWN]);
		});
		render(<CalendarPageWired />);
		await showWeek();
		await waitFor(() => expect(props.freeHoursState).toBe('ready'));
		await act(() =>
			props.onRangeChange?.(new Date(2027, 2, 1), new Date(2027, 2, 8))
		);
		await waitFor(() => expect(props.freeHoursState).toBe('failed'));
		expect(props.entries.map((e) => e.id)).toEqual([]);
		// The retry next to the free hours.
		await act(async () => props.onRetryFreeHours?.());
		await waitFor(() => expect(nearCalls).toBe(2));
		await waitFor(() => expect(props.freeHoursState).toBe('failed'));
		// Paging inside the loaded month tries again as well.
		await act(() =>
			props.onRangeChange?.(new Date(2027, 2, 2), new Date(2027, 2, 3))
		);
		await waitFor(() => expect(props.freeHoursState).toBe('ready'));
		expect(nearCalls).toBe(3);
		expect(props.entries.map((e) => e.id)).toEqual(['a1']);
	});

	it('keeps a colleague whose calendar did not load apart from an empty one (review 4575917303)', async () => {
		api.apiGetColleagueCalendarEntries
			.mockRejectedValueOnce(new Error('503'))
			.mockResolvedValueOnce([]);
		render(<CalendarPageWired />);
		await showWeek();
		await act(() => props.onShownColleaguesChange?.(['kaya']));
		await waitFor(() => expect(props.failedColleagues).toEqual(['kaya']));
		// Retry: loaded, even if empty, it no longer counts as missing.
		await act(async () => props.onRetryColleagues?.());
		await waitFor(() => expect(props.failedColleagues).toEqual([]));
		expect(api.apiGetColleagueCalendarEntries).toHaveBeenCalledTimes(2);
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
			props.onRangeChange?.(
				new Date(2026, 11, 14),
				new Date(2026, 11, 21)
			)
		);
		expect(answers).toHaveLength(2);
		await act(async () =>
			answers[1]([
				{ ...OWN, id: 'dec', ownerId: 'kaya', sessionId: null }
			])
		);
		await act(async () =>
			answers[0]([
				{ ...OWN, id: 'nov', ownerId: 'kaya', sessionId: null }
			])
		);
		expect(props.entries.map((e) => e.id)).toContain('dec');
		expect(props.entries.map((e) => e.id)).not.toContain('nov');
	});

	it('ignores an older colleague failure after a newer answer', async () => {
		const settle: {
			ok: (l: unknown[]) => void;
			fail: (e: Error) => void;
		}[] = [];
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
			props.onRangeChange?.(
				new Date(2026, 11, 14),
				new Date(2026, 11, 21)
			)
		);
		await act(async () =>
			settle[1].ok([
				{ ...OWN, id: 'dec', ownerId: 'kaya', sessionId: null }
			])
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

	it('shows a failed asker lookup with the retry, not as no conversations', async () => {
		consultant = false;
		// The shared helper hides failures as an empty list unless asked
		// strictly (review 4575159306).
		askerList.apiGetAskerSessionList.mockImplementationOnce(((options?: {
			strict?: boolean;
		}) =>
			options?.strict
				? Promise.reject(new Error('503'))
				: Promise.resolve({ sessions: [] })) as never);
		render(<CalendarPageWired />);
		await waitFor(() => expect(props.conversationsFailed).toBe(true));
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
		await expect(
			props.onSaveImport?.('https://x.test/a.ics')
		).rejects.toThrow('400');
	});
});
