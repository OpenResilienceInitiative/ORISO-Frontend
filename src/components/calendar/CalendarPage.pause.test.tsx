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
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarPage } from './CalendarPage';
import { CalendarWorkGrip } from './CalendarWorkGrip';
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
// jsdom has no PointerEvent; a MouseEvent carries clientY and button.
if (typeof window.PointerEvent === 'undefined')
	Object.defineProperty(window, 'PointerEvent', {
		configurable: true,
		value: class PointerEvent extends MouseEvent {
			pointerId = 1;
		}
	});
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

describe('CalendarPage — grips switchable in ⋮ (Frank *7.2)', () => {
	it('hides the working-hours and pause grips and remembers it', async () => {
		page();
		await grip('pauseStart');
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-settings"]'
			) as HTMLElement
		);
		const toggle = await waitFor(() => {
			const el = document.querySelector<HTMLElement>(
				'[data-cy="calendar-settings-grips"]'
			);
			expect(el).not.toBeNull();
			return el as HTMLElement;
		});
		expect(toggle.getAttribute('aria-checked')).toBe('true');
		fireEvent.click(toggle);
		await waitFor(() =>
			expect(document.querySelector('[data-grip]')).toBeNull()
		);
		cleanup();
		page();
		// Still off after a reload.
		await waitFor(() =>
			expect(
				document.querySelector('[data-testid="calendar-view"]')
			).not.toBeNull()
		);
		await act(() => new Promise((done) => window.setTimeout(done, 50)));
		expect(document.querySelector('[data-grip]')).toBeNull();
	});
});

const findCy = (cy: string) =>
	waitFor(() => {
		const el = document.querySelector<HTMLElement>(`[data-cy="${cy}"]`);
		expect(el).not.toBeNull();
		return el as HTMLElement;
	});

describe('CalendarPage — deleting or moving the pause (Frank, prototype v16)', () => {
	it('offers "Pause löschen" on Delete and deletes it for this day, with undo', async () => {
		const onSaveDayException = vi.fn(() => Promise.resolve());
		const onDeleteDayException = vi.fn(() => Promise.resolve());
		page({ onSaveDayException, onDeleteDayException });
		fireEvent.keyDown(await grip('pauseStart'), { key: 'Delete' });
		expect((await findCy('calendar-menu-pause')).textContent).toContain(
			'calendar.grip.pauseTitle {"start":"12:00","end":"13:00"}'
		);
		await act(async () => {
			fireEvent.click(await findCy('calendar-pause-delete'));
		});
		expect(onSaveDayException).toHaveBeenCalledWith(MONDAY, [
			{ start: '08:00', end: '16:00' }
		]);
		expect(document.body.textContent).toContain(
			'calendar.grip.pauseDeletedDay'
		);
		await act(async () => {
			fireEvent.click(await screen.findByTestId('calendar-undo'));
		});
		expect(onDeleteDayException).toHaveBeenCalledWith(MONDAY);
	});

	it('moves the whole pause, same length, for every Monday', async () => {
		const onSaveWorkingHours = vi.fn(() => Promise.resolve());
		page({ onSaveWorkingHours });
		// Pulled onto the pause end at 13:00: the pause would start there.
		fireEvent.keyDown(await grip('pauseStart'), { key: 'Backspace' });
		expect((await findCy('calendar-pause-move')).textContent).toContain(
			'calendar.grip.pauseMove {"start":"13:00","end":"14:00"}'
		);
		fireEvent.click(await findCy('calendar-pause-scope-week'));
		await act(async () => {
			fireEvent.click(await findCy('calendar-pause-move'));
		});
		expect(onSaveWorkingHours).toHaveBeenCalledWith(
			[
				{ weekday: 1, start: '08:00', end: '13:00' },
				{ weekday: 1, start: '14:00', end: '16:00' }
			],
			null
		);
	});
});

describe('CalendarPage — a pause of a day with its own hours, for every Monday (review 4576346783)', () => {
	/** Every Monday 08:00–18:00 without a pause; this one has its own. */
	const WEEKLY: WorkingHours = [{ weekday: 1, start: '08:00', end: '18:00' }];
	const OWN = {
		[MONDAY]: [
			{ start: '09:00', end: '12:00' },
			{ start: '13:00', end: '17:00' }
		]
	};

	it('leaves the weekly hours as they are when the pause is deleted for every Monday', async () => {
		const onSaveWorkingHours = vi.fn(() => Promise.resolve());
		page({
			workingHours: WEEKLY,
			dayExceptions: OWN,
			onSaveWorkingHours,
			onSaveDayException: vi.fn(() => Promise.resolve())
		});
		fireEvent.keyDown(await grip('pauseStart'), { key: 'Delete' });
		fireEvent.click(await findCy('calendar-pause-scope-week'));
		await act(async () => {
			fireEvent.click(await findCy('calendar-pause-delete'));
		});
		expect(onSaveWorkingHours).toHaveBeenCalledWith(WEEKLY, null);
	});

	it('moves only the pause into the weekly hours, keeping their start and end', async () => {
		const onSaveWorkingHours = vi.fn(() => Promise.resolve());
		page({
			workingHours: WEEKLY,
			dayExceptions: OWN,
			onSaveWorkingHours,
			onSaveDayException: vi.fn(() => Promise.resolve())
		});
		fireEvent.keyDown(await grip('pauseStart'), { key: 'Backspace' });
		fireEvent.click(await findCy('calendar-pause-scope-week'));
		await act(async () => {
			fireEvent.click(await findCy('calendar-pause-move'));
		});
		expect(onSaveWorkingHours).toHaveBeenCalledWith(
			[
				{ weekday: 1, start: '08:00', end: '13:00' },
				{ weekday: 1, start: '14:00', end: '18:00' }
			],
			null
		);
	});

	it("moves a pause edge for every Monday without taking the day's start and end", async () => {
		const onSaveWorkingHours = vi.fn(() => Promise.resolve());
		page({
			workingHours: WEEKLY,
			dayExceptions: OWN,
			onSaveWorkingHours,
			onSaveDayException: vi.fn(() => Promise.resolve())
		});
		fireEvent.keyDown(await grip('pauseEnd'), { key: 'ArrowUp' });
		await act(async () => {
			fireEvent.click(await findCy('calendar-edge-week'));
		});
		expect(onSaveWorkingHours).toHaveBeenCalledWith(
			[
				{ weekday: 1, start: '08:00', end: '12:00' },
				{ weekday: 1, start: '12:45', end: '18:00' }
			],
			null
		);
	});
});

describe('CalendarWorkGrip — a pause grip pulled past the other one', () => {
	const geometry = {
		top: 0,
		left: 0,
		width: 100,
		height: 1440,
		firstMinute: 0,
		lastMinute: 1440
	};

	it('says "löschen oder verschieben" while dragging and reports the drop', () => {
		const onChange = vi.fn();
		render(
			<CalendarWorkGrip
				edge="pauseStart"
				day={new Date(2026, 10, 16)}
				time="12:00"
				windows={[
					{ start: '08:00', end: '12:00' },
					{ start: '13:00', end: '16:00' }
				]}
				measure={() => geometry}
				onChange={onChange}
			/>
		);
		const el = document.querySelector('.calendarGrip') as HTMLElement;
		// One pixel a minute: 13:30 is past the pause end.
		fireEvent.pointerDown(el, { button: 0, clientY: 720 });
		fireEvent.pointerMove(el, { clientY: 810 });
		expect(
			document.querySelector('[data-cy="calendar-grip-ghost"]')
				?.textContent
		).toBe('calendar.grip.pauseCrossed');
		fireEvent.pointerUp(el, { clientY: 810 });
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				edge: 'pauseStart',
				from: '12:00',
				to: '13:30'
			}),
			expect.anything()
		);
	});
});
