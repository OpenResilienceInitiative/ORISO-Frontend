// @vitest-environment oriso-jsdom
/**
 * "Immer <Wochentag>" on a date with its own hours saves the weekly hours,
 * then the date. When the date fails, the weekly hours go back and the
 * notice says so, with a retry (review 4577586478). A date at the limit
 * of own days says what to do (review 4577586484).
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
import {
	TooManyDayExceptions,
	type WorkingHours
} from './calendarWorkingHours';
import type { HolidayRegion } from './calendarHolidays';

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

const findCy = (name: string) =>
	waitFor(() => {
		const el = document.querySelector<HTMLElement>(`[data-cy="${name}"]`);
		expect(el).not.toBeNull();
		return el as HTMLElement;
	});
const deferred = () => {
	let resolve: (value?: unknown) => void = () => undefined;
	const promise = new Promise((res) => {
		resolve = res;
	});
	return { promise, resolve };
};
const flush = () => act(async () => undefined);

/** Every Monday 08:00–18:00; this Monday 09:00–17:00 of its own. */
const WEEKLY: WorkingHours = [{ weekday: 1, start: '08:00', end: '18:00' }];
const OWN = { [MONDAY]: [{ start: '09:00', end: '17:00' }] };
const MOVED_WEEK: WorkingHours = [{ weekday: 1, start: '08:00', end: '16:45' }];

/** The end grip a quarter hour earlier, for every Monday. */
const endForEveryMonday = async () => {
	fireEvent.keyDown(await grip('end'), { key: 'ArrowUp' });
	await act(async () => {
		fireEvent.click(await findCy('calendar-edge-week'));
	});
};

describe('CalendarPage — "Immer <Wochentag>" on a date with its own hours (review 4577586478)', () => {
	it('saves the date only after the weekly hours, and puts the week back when the date fails', async () => {
		const weekly = deferred();
		const onSaveWorkingHours = vi
			.fn()
			.mockReturnValueOnce(weekly.promise)
			.mockResolvedValue(undefined);
		const onSaveDayException = vi.fn(() =>
			Promise.reject(new Error('500'))
		);
		page({
			workingHours: WEEKLY,
			dayExceptions: OWN,
			onSaveWorkingHours,
			onSaveDayException
		});
		await endForEveryMonday();
		expect(onSaveWorkingHours).toHaveBeenCalledWith(MOVED_WEEK, null);
		expect(onSaveDayException).not.toHaveBeenCalled();
		await act(async () => {
			weekly.resolve();
		});
		await flush();
		expect(onSaveDayException).toHaveBeenCalledWith(MONDAY, [
			{ start: '09:00', end: '16:45' }
		]);
		// The week goes back to what it was.
		expect(onSaveWorkingHours).toHaveBeenLastCalledWith(WEEKLY, null);
		const notice = await screen.findByText(/calendar\.grip\.weekUndone/);
		expect(notice.textContent).toContain(
			'"weekdays":"calendar.grip.weekdays.1"'
		);
		expect(screen.queryByText(/calendar\.grip\.savedWeek/)).toBeNull();
		// Try again: the same change once more.
		await act(async () => {
			fireEvent.click(await screen.findByTestId('calendar-retry'));
		});
		await flush();
		expect(onSaveWorkingHours).toHaveBeenNthCalledWith(3, MOVED_WEEK, null);
	});

	it('says only part was saved when the week cannot go back either', async () => {
		const onSaveWorkingHours = vi
			.fn()
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('500'));
		page({
			workingHours: WEEKLY,
			dayExceptions: OWN,
			onSaveWorkingHours,
			onSaveDayException: vi.fn(() => Promise.reject(new Error('500')))
		});
		await endForEveryMonday();
		expect(
			await screen.findByText(/calendar\.grip\.weekOnly/)
		).toBeTruthy();
		expect(screen.getByTestId('calendar-retry')).toBeTruthy();
	});

	it('does the same for "Pause löschen" for every Monday, and names the limit of own days', async () => {
		const onSaveWorkingHours = vi.fn(() => Promise.resolve());
		const onSaveDayException = vi.fn(() =>
			Promise.reject(new TooManyDayExceptions())
		);
		page({
			workingHours: WEEKLY,
			dayExceptions: {
				[MONDAY]: [
					{ start: '09:00', end: '12:00' },
					{ start: '13:00', end: '17:00' }
				]
			},
			onSaveWorkingHours,
			onSaveDayException
		});
		fireEvent.keyDown(await grip('pauseStart'), { key: 'Delete' });
		fireEvent.click(await findCy('calendar-pause-scope-week'));
		await act(async () => {
			fireEvent.click(await findCy('calendar-pause-delete'));
		});
		await flush();
		expect(onSaveDayException).toHaveBeenCalledWith(MONDAY, [
			{ start: '09:00', end: '17:00' }
		]);
		expect(onSaveWorkingHours).toHaveBeenCalledTimes(2);
		expect(onSaveWorkingHours).toHaveBeenLastCalledWith(WEEKLY, null);
		const notice = await screen.findByText(/calendar\.grip\.weekUndone/);
		expect(notice.textContent).toContain(
			'calendar.grip.tooManyDays {"max":400}'
		);
		// The same change would fail again: no retry.
		expect(screen.queryByTestId('calendar-retry')).toBeNull();
	});
});

describe('CalendarPage — a failed date puts back only its own weekday (review 4581369172)', () => {
	/** The host the page saves through: what is saved is shown at once. */
	const host: {
		setRegion?: (region: HolidayRegion | null) => void;
	} = {};
	const Host = ({
		onSaveWorkingHours,
		onSaveDayException
	}: {
		onSaveWorkingHours: (
			hours: WorkingHours,
			region: HolidayRegion | null
		) => unknown;
		onSaveDayException: () => Promise<unknown>;
	}) => {
		const [hours, setHours] = React.useState<WorkingHours>([
			...WEEKLY,
			{ weekday: 2, start: '08:00', end: '18:00' }
		]);
		const [region, setRegion] = React.useState<HolidayRegion | null>('SN');
		host.setRegion = setRegion;
		return (
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={new Date(2026, 10, 16, 9)}
				entries={[]}
				initialView="workWeek"
				workingHours={hours}
				holidayRegion={region}
				dayExceptions={OWN}
				onSaveWorkingHours={(next, nextRegion) => {
					setHours(next);
					setRegion(nextRegion);
					return Promise.resolve(
						onSaveWorkingHours(next, nextRegion)
					);
				}}
				onSaveDayException={onSaveDayException}
				onDeleteDayException={vi.fn()}
			/>
		);
	};

	it('keeps another weekday and the region saved while the date was on its way', async () => {
		const day = deferred();
		const onSaveWorkingHours = vi.fn();
		render(
			<Host
				onSaveWorkingHours={onSaveWorkingHours}
				onSaveDayException={() => day.promise}
			/>
		);
		// 1. "Immer montags" on a Monday with its own hours: the week is
		//    saved, the date is still on its way.
		await endForEveryMonday();
		await flush();
		expect(onSaveWorkingHours).toHaveBeenLastCalledWith(
			[
				{ weekday: 1, start: '08:00', end: '16:45' },
				{ weekday: 2, start: '08:00', end: '18:00' }
			],
			'SN'
		);
		// 2. Meanwhile Tuesday is saved for every week, and the region
		//    changes (the dialog).
		fireEvent.keyDown(
			await waitFor(() => {
				const el = document.querySelector<HTMLElement>(
					'[data-grip="2026-11-17-end"]'
				);
				expect(el).not.toBeNull();
				return el as HTMLElement;
			}),
			{ key: 'ArrowUp' }
		);
		await act(async () => {
			fireEvent.click(await findCy('calendar-edge-week'));
		});
		await act(async () => host.setRegion?.('BY'));
		// 3. The date fails: only Monday goes back.
		await act(async () => {
			day.resolve(Promise.reject(new Error('500')));
		});
		await flush();
		expect(onSaveWorkingHours).toHaveBeenLastCalledWith(
			[
				{ weekday: 1, start: '08:00', end: '18:00' },
				{ weekday: 2, start: '08:00', end: '17:45' }
			],
			'BY'
		);
		expect(
			await screen.findByText(/calendar\.grip\.weekUndone/)
		).toBeTruthy();
	});
});

describe('CalendarPage — the limit of own days (review 4577586484)', () => {
	it('says how many own days are allowed when a day save hits it', async () => {
		page({
			onSaveDayException: vi.fn(() =>
				Promise.reject(new TooManyDayExceptions())
			)
		});
		fireEvent.keyDown(await grip('end'), { key: 'ArrowUp' });
		await act(async () => {
			fireEvent.click(await findCy('calendar-edge-day'));
		});
		expect(
			await screen.findByText('calendar.grip.tooManyDays {"max":400}')
		).toBeTruthy();
	});
});
