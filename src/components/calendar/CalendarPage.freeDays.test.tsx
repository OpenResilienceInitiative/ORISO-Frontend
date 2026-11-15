// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { CalendarPage } from './CalendarPage';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

/* The dial and calendar have their own tests. */
vi.mock('../form/OrisoTimePicker', () => ({
	OrisoTimePicker: () => null
}));
vi.mock('../form/OrisoDatePicker', () => ({
	OrisoDatePicker: () => null
}));
vi.mock('../form/OrisoCalendar', () => ({
	OrisoCalendar: () => null
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

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
	vi.setSystemTime(NOW);
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const cy = (name: string) =>
	document.querySelector<HTMLElement>(`[data-cy="${name}"]`);

describe('CalendarPage — "Freie Tage eintragen …" in ⋮ (Frank, prototype v16)', () => {
	it('opens the blocker dialog all day, from tomorrow to the day after', () => {
		const onCreate = vi.fn(() => true);
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[]}
				onCreate={onCreate}
			/>
		);
		fireEvent.click(cy('calendar-settings') as Element);
		const item = cy('calendar-settings-free-days');
		expect(item?.textContent).toContain('calendar.settings.freeDays');
		expect(item?.textContent).toContain('calendar.settings.freeDaysHint');
		fireEvent.click(item as Element);

		expect(screen.getByTestId('calendar-blocker-dialog')).toBeTruthy();
		expect(
			(
				screen.getByRole('switch', {
					name: 'calendar.blocker.allDay'
				}) as HTMLInputElement
			).checked
		).toBe(true);
		fireEvent.click(screen.getByTestId('calendar-blocker-save'));
		expect(onCreate).toHaveBeenCalledTimes(1);
		const [[drafts]] = onCreate.mock.calls as unknown as [
			[{ start: Date; end: Date; allDay?: boolean; type: string }[]]
		];
		expect(drafts).toHaveLength(1);
		expect(drafts[0]).toMatchObject({ type: 'blocker', allDay: true });
		// Tuesday 17 November, the whole day: up to the day after.
		expect(drafts[0].start).toEqual(new Date(2026, 10, 17));
		expect(drafts[0].end).toEqual(new Date(2026, 10, 17, 23, 59, 59, 999));
	});

	it('is not offered when the calendar cannot create entries', () => {
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[]}
			/>
		);
		fireEvent.click(cy('calendar-settings') as Element);
		expect(cy('calendar-settings-free-days')).toBeNull();
	});
});
