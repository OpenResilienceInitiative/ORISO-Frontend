// @vitest-environment oriso-jsdom
/**
 * The real page under the wired container, FullCalendar included: nothing
 * calls `onRangeChange` by hand. Reviews 4574733779 and 4574779921 — while
 * the first range loads, the calendar must stay mounted, or it never
 * reports its range and the spinner stays forever.
 */
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import * as calendarApi from '../../api/apiCalendar';
import { CalendarPageWired } from './CalendarPageWired';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ untilM: false })
}));
vi.mock('../sessionsList/timeline/useAppointmentNotice', () => ({
	useAppointmentNotice: () => () => Promise.resolve()
}));
vi.mock('../../globalState', async () => {
	const React = await import('react');
	return {
		AUTHORITIES: { CONSULTANT_DEFAULT: 'CONSULTANT_DEFAULT' },
		hasUserAuthority: () => true,
		UserDataContext: React.createContext({ userData: { userId: 'me' } })
	};
});
vi.mock('../../api/apiCalendar', () => ({
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
	apiCreateSessionAppointment: vi.fn(),
	apiMoveSessionAppointment: vi.fn(),
	apiCancelSessionAppointment: vi.fn()
}));
vi.mock('../../api/apiGetConsultantSessionList', () => ({
	apiGetConsultantSessionList: vi.fn(() => Promise.resolve({ sessions: [] }))
}));
vi.mock('../../api/apiGetAskerSessionList', () => ({
	apiGetAskerSessionList: vi.fn(() => Promise.resolve({ sessions: [] }))
}));

const api = vi.mocked(calendarApi);

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
