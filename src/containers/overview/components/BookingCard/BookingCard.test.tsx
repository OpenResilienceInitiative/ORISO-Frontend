// @vitest-environment oriso-jsdom
/**
 * "Bevorstehende Termine" reads the counsellor's next own appointments from
 * the calendar, the same selection as "Als Nächstes", and never asks the
 * removed appointment service (FE#2258, review 5909821771).
 */
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import * as calendarApi from '../../../../api/apiCalendar';
import type { CalendarEntryDTO } from '../../../../api/apiCalendar';
import { BookingCard } from './BookingCard';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options ? `${key} ${JSON.stringify(options)}` : key,
		i18n: { language: 'de' }
	})
}));
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../../../globalState', async () => {
	const React = await import('react');
	return {
		UserDataContext: React.createContext({ userData: { userId: 'me' } })
	};
});
vi.mock('../../../../api/apiCalendar', () => ({
	apiGetCalendarEntries: vi.fn()
}));
const fetchSpy = vi.hoisted(() => ({ urls: [] as string[] }));
vi.mock('../../../../api/fetchData', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../../../api/fetchData')>();
	return {
		...actual,
		fetchData: (options: { url: string }) => {
			fetchSpy.urls.push(options.url);
			return Promise.resolve([]);
		}
	};
});

const api = vi.mocked(calendarApi);
const NOW = new Date(2026, 10, 16, 9);
const at = (day: number, hour: number) =>
	new Date(2026, 10, day, hour).toISOString();
const entry = (
	id: string,
	day: number,
	hour: number,
	extra: Partial<CalendarEntryDTO> = {}
): CalendarEntryDTO => ({
	id,
	type: 'APPOINTMENT',
	start: at(day, hour),
	end: at(day, hour + 1),
	ownerId: 'me',
	kind: 'VIDEO',
	title: `asker-${id}`,
	sessionId: 1,
	movable: true,
	...extra
});

afterEach(cleanup);
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(NOW);
	vi.clearAllMocks();
	fetchSpy.urls = [];
});
afterEach(() => vi.useRealTimers());

const names = () =>
	Array.from(document.querySelectorAll('.bookingEvent__askerName')).map(
		(el) => el.textContent
	);

describe('BookingCard — from the calendar (review 5909821771)', () => {
	// The old card shifted times by the zone offset; pin a zone with one.
	const runnerZone = process.env.TZ;
	beforeAll(() => {
		process.env.TZ = 'Europe/Berlin';
	});
	afterAll(() => {
		if (runnerZone === undefined) delete process.env.TZ;
		else process.env.TZ = runnerZone;
	});

	it('shows the next own appointments, nearest first, at most five', async () => {
		api.apiGetCalendarEntries.mockResolvedValue([
			entry('later', 18, 10),
			entry('past', 15, 10),
			entry('soonest', 16, 14),
			entry('colleague', 16, 15, { ownerId: 'kaya' }),
			entry('blocker', 16, 16, { type: 'BLOCKER' }),
			entry('c', 19, 10),
			entry('d', 20, 10),
			entry('e', 21, 10),
			entry('f', 22, 10)
		]);
		render(<BookingCard />);
		await waitFor(() => expect(names()).toHaveLength(5));
		expect(names()).toEqual([
			'asker-soonest',
			'asker-later',
			'asker-c',
			'asker-d',
			'asker-e'
		]);
		const [from, to] = api.apiGetCalendarEntries.mock.calls[0];
		expect(from.getTime()).toBeLessThanOrEqual(NOW.getTime());
		expect(to.getTime()).toBeGreaterThan(NOW.getTime());
		expect(
			fetchSpy.urls.some((url) => url.includes('appointservice'))
		).toBe(false);
	});

	it('shows the time of the calendar entry as it is, without a zone shift', async () => {
		api.apiGetCalendarEntries.mockResolvedValue([entry('one', 17, 14)]);
		render(<BookingCard />);
		await waitFor(() => expect(names()).toEqual(['asker-one']));
		expect(
			document.querySelector('.bookingEvent__fullDate')?.textContent
		).toContain('14:00');
	});

	it('shows the existing empty text without appointments, also when the calendar fails', async () => {
		api.apiGetCalendarEntries.mockRejectedValue(new Error('503'));
		render(<BookingCard />);
		await waitFor(() =>
			expect(api.apiGetCalendarEntries).toHaveBeenCalledTimes(1)
		);
		expect(
			await screen.findByText('overview.appointmentsEmpty')
		).toBeTruthy();
		expect(names()).toEqual([]);
	});

	it('links to the calendar', async () => {
		api.apiGetCalendarEntries.mockResolvedValue([]);
		render(<BookingCard />);
		const all = await screen.findByText('overview.viewAll');
		all.click();
		expect(navigate).toHaveBeenCalledWith('/booking/events');
	});
});
