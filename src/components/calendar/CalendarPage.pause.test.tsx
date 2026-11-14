// @vitest-environment oriso-jsdom
/**
 * The pause of a working day has grips like its start and end (Frank,
 * prototype v15): arrow keys move it in quarter hours, then "Nur an
 * diesem Tag" or "Immer <Wochentag>"; the pause stays at least a quarter
 * hour long and inside the working time.
 */
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarPage } from './CalendarPage';
import type { WorkingHours } from './calendarWorkingHours';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options ? `${key} ${JSON.stringify(options)}` : key,
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
window.requestAnimationFrame ??= (cb: FrameRequestCallback) =>
	window.setTimeout(() => cb(0), 0);

afterEach(() => {
	cleanup();
	window.localStorage.clear();
});

/** Monday 08:00–12:00 and 13:00–16:00: a pause from 12:00 to 13:00. */
const HOURS: WorkingHours = [
	{ weekday: 1, start: '08:00', end: '12:00' },
	{ weekday: 1, start: '13:00', end: '16:00' }
];
const MONDAY = '2026-11-16';

const page = (props: Partial<React.ComponentProps<typeof CalendarPage>> = {}) =>
	render(
		<CalendarPage
			role="consultant"
			ownerId="me"
			now={new Date(2026, 10, 16, 9)}
			entries={[]}
			initialView="workWeek"
			workingHours={HOURS}
			onSaveWorkingHours={vi.fn()}
			onSaveDayException={vi.fn()}
			onDeleteDayException={vi.fn()}
			{...props}
		/>
	);

const grip = (edge: string) =>
	waitFor(() => {
		const el = document.querySelector<HTMLElement>(
			`[data-grip="${MONDAY}-${edge}"]`
		);
		expect(el).not.toBeNull();
		return el as HTMLElement;
	});

describe('CalendarPage — grips on the pause', () => {
	it('shows grips where the pause starts and ends', async () => {
		page();
		expect((await grip('pauseStart')).getAttribute('aria-label')).toContain(
			'"time":"12:00"'
		);
		expect((await grip('pauseEnd')).getAttribute('aria-label')).toContain(
			'"time":"13:00"'
		);
	});

	it('moves the pause start a quarter hour for this day only', async () => {
		const onSaveDayException = vi.fn(() => Promise.resolve());
		page({ onSaveDayException });
		fireEvent.keyDown(await grip('pauseStart'), { key: 'ArrowDown' });
		const day = await waitFor(() => {
			const el = document.querySelector<HTMLElement>(
				'[data-cy="calendar-edge-day"]'
			);
			expect(el).not.toBeNull();
			return el as HTMLElement;
		});
		await act(async () => {
			fireEvent.click(day);
		});
		expect(onSaveDayException).toHaveBeenCalledWith(MONDAY, [
			{ start: '08:00', end: '12:15' },
			{ start: '13:00', end: '16:00' }
		]);
	});

	it('moves the pause end for every Monday', async () => {
		const onSaveWorkingHours = vi.fn(() => Promise.resolve());
		page({ onSaveWorkingHours });
		fireEvent.keyDown(await grip('pauseEnd'), { key: 'ArrowUp' });
		const week = await waitFor(() => {
			const el = document.querySelector<HTMLElement>(
				'[data-cy="calendar-edge-week"]'
			);
			expect(el).not.toBeNull();
			return el as HTMLElement;
		});
		await act(async () => {
			fireEvent.click(week);
		});
		expect(onSaveWorkingHours).toHaveBeenCalledWith(
			[
				{ weekday: 1, start: '08:00', end: '12:00' },
				{ weekday: 1, start: '12:45', end: '16:00' }
			],
			null
		);
	});

	it('keeps the pause at least a quarter hour long with the arrow keys', async () => {
		page({
			workingHours: [
				{ weekday: 1, start: '08:00', end: '12:00' },
				{ weekday: 1, start: '12:15', end: '16:00' }
			]
		});
		fireEvent.keyDown(await grip('pauseStart'), { key: 'ArrowDown' });
		fireEvent.keyDown(await grip('pauseEnd'), { key: 'ArrowUp' });
		expect(
			document.querySelector('[data-cy="calendar-menu-edge"]')
		).toBeNull();
	});
});
