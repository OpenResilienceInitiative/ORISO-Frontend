// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { CalendarPage } from './CalendarPage';
import type { CalendarEntry } from './calendarModel';
import { LIVE_NOW_INTERVAL_MS } from './useLiveNow';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

// jsdom lacks what FullCalendar measures with.
if (typeof window.ResizeObserver === 'undefined')
	window.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
if (!HTMLElement.prototype.scrollTo)
	HTMLElement.prototype.scrollTo = () => undefined;

const NOW = new Date(2026, 10, 16, 9, 0);

const appointment = (over: Partial<CalendarEntry>): CalendarEntry => ({
	id: 'a1',
	type: 'appointment',
	kind: 'video',
	title: 'mutige_eule',
	start: new Date(2026, 10, 16, 8, 30).toISOString(),
	end: new Date(2026, 10, 16, 9, 1).toISOString(),
	ownerId: 'me',
	...over
});

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
	vi.setSystemTime(NOW);
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('CalendarPage — live clock without a fixed now', () => {
	it('drops an appointment from "upcoming" once it has ended', () => {
		render(
			<CalendarPage role="consultant" ownerId="me" entries={[appointment({})]} />
		);
		expect(screen.queryByText('calendar.upcomingEmpty')).toBeNull();
		act(() => {
			vi.advanceTimersByTime(2 * LIVE_NOW_INTERVAL_MS);
		});
		expect(screen.getByText('calendar.upcomingEmpty')).toBeTruthy();
	});

	it('keeps a fixed now for stories and tests', () => {
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[appointment({})]}
			/>
		);
		act(() => {
			vi.advanceTimersByTime(4 * LIVE_NOW_INTERVAL_MS);
		});
		expect(screen.queryByText('calendar.upcomingEmpty')).toBeNull();
	});
});

describe('CalendarPage — display filter', () => {
	it('keeps a selected kind on offer after its entries are gone', () => {
		const video = appointment({ id: 'v', kind: 'video' });
		const phone = appointment({ id: 'p', kind: 'phone' });
		const { container, rerender } = render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[video, phone]}
			/>
		);
		const chip = () =>
			container.querySelector('[data-cy="calendar-filter-video"]');
		fireEvent.click(chip() as Element);
		rerender(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[phone]}
			/>
		);
		expect(chip()).not.toBeNull();
		expect(chip()?.getAttribute('aria-pressed')).toBe('true');
		fireEvent.click(chip() as Element);
		expect(chip()).toBeNull();
	});
});
