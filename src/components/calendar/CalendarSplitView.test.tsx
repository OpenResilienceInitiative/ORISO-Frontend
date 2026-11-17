// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import type { CalendarEntry } from './calendarModel';
import { CalendarSplitView, SPLIT_HOUR_PX } from './CalendarSplitView';

/** Pixels for `hours` hours down the axis at the starting zoom. */
const px = (hours: number) => hours * SPLIT_HOUR_PX;

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

// jsdom has no element scrolling.
if (!HTMLElement.prototype.scrollTo)
	HTMLElement.prototype.scrollTo = () => undefined;
// jsdom has no PointerEvent; a MouseEvent carries clientY and button.
if (typeof window.PointerEvent === 'undefined')
	Object.defineProperty(window, 'PointerEvent', {
		configurable: true,
		value: class PointerEvent extends MouseEvent {
			pointerId = 1;
		}
	});

const MONDAY = new Date(2026, 10, 16);
const HOURS = { hours: [{ weekday: 1, start: '08:00', end: '16:00' }] };
/** A blocked time the display filter hides. */
const HIDDEN: CalendarEntry = {
	id: 'b1',
	type: 'blocker',
	start: new Date(2026, 10, 16, 9).toISOString(),
	end: new Date(2026, 10, 16, 12).toISOString(),
	ownerId: 'me'
};

const freeSpans = (container: HTMLElement) =>
	Array.from(
		container.querySelectorAll<HTMLElement>('.calendarSplit__free')
	).map((span) => [span.style.top, span.style.height]);

describe('CalendarSplitView — "alle frei"', () => {
	it('counts an entry the display filter hides as busy (review 4574733782)', () => {
		const { container } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[]}
				entries={[]}
				busyEntries={[HIDDEN]}
				now={new Date(2026, 10, 16, 7)}
				workingPlan={HOURS}
			/>
		);
		// 08–09 and 12–16, from 07:00; not 08–16.
		expect(freeSpans(container)).toEqual([
			[`${px(1)}px`, `${px(1)}px`],
			[`${px(5)}px`, `${px(4)}px`]
		]);
	});

	it('falls back to the shown entries without busy entries', () => {
		const { container } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[]}
				entries={[HIDDEN]}
				now={new Date(2026, 10, 16, 7)}
				workingPlan={HOURS}
			/>
		);
		expect(freeSpans(container)).toHaveLength(2);
	});
});

describe('CalendarSplitView — clock time on a daylight-saving day (reviews 4574775720, 4574938519)', () => {
	const runnerZone = process.env.TZ;
	beforeAll(() => {
		process.env.TZ = 'Europe/Berlin';
	});
	afterAll(() => {
		if (runnerZone === undefined) delete process.env.TZ;
		else process.env.TZ = runnerZone;
	});

	// Sunday 28 March 2027: clocks go from 02:00 to 03:00.
	const props = () => {
		const day = new Date(2027, 2, 28);
		const entry: CalendarEntry = {
			id: 'a1',
			type: 'appointment',
			start: new Date(2027, 2, 28, 10).toISOString(),
			end: new Date(2027, 2, 28, 11).toISOString(),
			ownerId: 'me'
		};
		return { day, entry };
	};

	it('places a 10:00 entry on the 10:00 line', () => {
		const { day, entry } = props();
		const { container } = render(
			<CalendarSplitView
				day={day}
				role="consultant"
				ownerId="me"
				colleagues={[]}
				entries={[entry]}
				now={new Date(2027, 2, 27, 7)}
			/>
		);
		const shown = container.querySelector<HTMLElement>(
			'[data-cy="calendar-split-entry-a1"]'
		) as HTMLElement;
		// Three hours below 07:00 is 10:00, not two (09:00).
		expect(shown.style.top).toBe(`${px(3)}px`);
		const labels = Array.from(
			container.querySelectorAll('.calendarSplit__hour')
		).map((h) => h.textContent);
		expect(labels.slice(0, 4)).toEqual([
			'07:00',
			'08:00',
			'09:00',
			'10:00'
		]);
	});

	it('selects 10:00 when the 10:00 line is dragged', () => {
		const { day } = props();
		const onSelectRange = vi.fn();
		const { container } = render(
			<CalendarSplitView
				day={day}
				role="consultant"
				ownerId="me"
				colleagues={[]}
				entries={[]}
				now={new Date(2027, 2, 27, 7)}
				onSelectRange={onSelectRange}
			/>
		);
		const body = container.querySelector(
			'.calendarSplit__column--own .calendarSplit__body'
		) as HTMLElement;
		body.getBoundingClientRect = () =>
			({ top: 0, left: 0, width: 200, height: 672 }) as DOMRect;
		fireEvent.pointerDown(body, { button: 0, clientY: px(3) });
		fireEvent.pointerUp(body, { clientY: px(3) });
		const [range] = onSelectRange.mock.calls[0];
		expect([range.start.getHours(), range.start.getMinutes()]).toEqual([
			10, 0
		]);
		expect(range.end.getHours()).toBe(11);
	});
});

describe('CalendarSplitView — the hour the spring clock change skips (review 4575941074)', () => {
	const runnerZone = process.env.TZ;
	beforeAll(() => {
		process.env.TZ = 'Europe/Berlin';
	});
	afterAll(() => {
		if (runnerZone === undefined) delete process.env.TZ;
		else process.env.TZ = runnerZone;
	});

	it('opens no menu for a click at 02:30 on 28 March 2027, but does at 04:00', () => {
		const day = new Date(2027, 2, 28);
		// An entry at 01:00 widens the axis to start at 01:00.
		const early: CalendarEntry = {
			id: 'early',
			type: 'appointment',
			kind: 'phone',
			start: new Date(2027, 2, 28, 1).toISOString(),
			end: new Date(2027, 2, 28, 1, 30).toISOString(),
			ownerId: 'me'
		};
		const onSelectRange = vi.fn();
		const { container } = render(
			<CalendarSplitView
				day={day}
				role="consultant"
				ownerId="me"
				colleagues={[]}
				entries={[early]}
				now={new Date(2027, 2, 27, 7)}
				onSelectRange={onSelectRange}
			/>
		);
		const body = container.querySelector(
			'.calendarSplit__column--own .calendarSplit__body'
		) as HTMLElement;
		body.getBoundingClientRect = () =>
			({ top: 0, left: 0, width: 200, height: 1104 }) as DOMRect;
		const labels = Array.from(
			container.querySelectorAll('.calendarSplit__hour')
		).map((h) => h.textContent);
		expect(labels[0]).toBe('01:00');
		// 02:30 is 1.5 hours below 01:00.
		fireEvent.pointerDown(body, { button: 0, clientY: px(1.5) });
		fireEvent.pointerUp(body, { clientY: px(1.5) });
		expect(onSelectRange).not.toHaveBeenCalled();
		// 04:00, after the gap, still opens the menu with an hour.
		fireEvent.pointerDown(body, { button: 0, clientY: px(3) });
		fireEvent.pointerUp(body, { clientY: px(3) });
		expect(onSelectRange).toHaveBeenCalledTimes(1);
		const [range] = onSelectRange.mock.calls[0];
		expect([range.start.getHours(), range.start.getMinutes()]).toEqual([
			4, 0
		]);
		expect(range.end.getTime() - range.start.getTime()).toBe(3600000);
	});
});

describe("CalendarSplitView — one's own calendar still loading (review 4576368852)", () => {
	it('marks nothing "alle frei" and says one\'s own calendar is loading', () => {
		const { container, getByText } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[{ id: 'kaya', displayName: 'A. Kaya' }]}
				entries={[]}
				unavailable={['me']}
				loading={['me']}
				now={new Date(2026, 10, 16, 7)}
				workingPlan={HOURS}
			/>
		);
		expect(freeSpans(container)).toEqual([]);
		expect(getByText('calendar.colleagueLoadingShort')).toBeTruthy();
	});
});

describe('CalendarSplitView — a drag over the skipped DST hour (review 4575941074)', () => {
	// Only Europe/Berlin skips 02:00–03:00 on 28 March 2027; pin it, so
	// the suite means the same on a runner in UTC (review 4576421331).
	const runnerZone = process.env.TZ;
	beforeAll(() => {
		process.env.TZ = 'Europe/Berlin';
	});
	afterAll(() => {
		if (runnerZone === undefined) delete process.env.TZ;
		else process.env.TZ = runnerZone;
	});

	const drag = (fromHours: number, toHours: number) => {
		const onSelectRange = vi.fn();
		const { container } = render(
			<CalendarSplitView
				day={new Date(2027, 2, 28)}
				role="consultant"
				ownerId="me"
				colleagues={[]}
				entries={[
					{
						id: 'early',
						type: 'appointment',
						kind: 'phone',
						start: new Date(2027, 2, 28, 1).toISOString(),
						end: new Date(2027, 2, 28, 1, 30).toISOString(),
						ownerId: 'me'
					}
				]}
				now={new Date(2027, 2, 27, 7)}
				onSelectRange={onSelectRange}
			/>
		);
		const body = container.querySelector(
			'.calendarSplit__column--own .calendarSplit__body'
		) as HTMLElement;
		body.getBoundingClientRect = () =>
			({ top: 0, left: 0, width: 200, height: 1104 }) as DOMRect;
		// The axis starts at 01:00; the drag runs `fromHours` to `toHours` below it.
		fireEvent.pointerDown(body, { button: 0, clientY: px(fromHours) });
		fireEvent.pointerMove(body, { clientY: px(toHours) });
		fireEvent.pointerUp(body, { clientY: px(toHours) });
		return onSelectRange;
	};

	it('offers nothing for a drag that starts at 02:30 and ends at 04:00', () => {
		expect(drag(1.5, 3)).not.toHaveBeenCalled();
	});

	it('offers nothing for a drag from 02:15 to 03:45', () => {
		expect(drag(1.25, 2.75)).not.toHaveBeenCalled();
	});

	it('offers a drag from 01:30 to 04:00: it spans the gap, but both ends exist', () => {
		// Policy (review 4576421331): only an end inside the skipped hour
		// is refused. Both 01:30 and 04:00 exist on the clock, so the
		// range keeps them; it lasts 1.5 hours of real time.
		const onSelectRange = drag(0.5, 2.75);
		expect(onSelectRange).toHaveBeenCalledTimes(1);
		const [range] = onSelectRange.mock.calls[0];
		expect(range.start.getDate()).toBe(28);
		expect([range.start.getHours(), range.start.getMinutes()]).toEqual([
			1, 30
		]);
		expect([range.end.getHours(), range.end.getMinutes()]).toEqual([4, 0]);
		expect(range.end.getTime() - range.start.getTime()).toBe(90 * 60000);
	});

	it('still offers a drag from 04:00 to 05:00, after the gap', () => {
		const onSelectRange = drag(3, 4);
		expect(onSelectRange).toHaveBeenCalledTimes(1);
		const [range] = onSelectRange.mock.calls[0];
		expect([range.start.getHours(), range.end.getHours()]).toEqual([4, 5]);
		expect(range.end.getMinutes()).toBe(15);
	});
});

describe('CalendarSplitView — heads of equal height (review 4574775727)', () => {
	const allDay = (id: string, ownerId: string): CalendarEntry => ({
		id,
		type: 'blocker',
		allDay: true,
		start: new Date(2026, 10, 16).toISOString(),
		end: new Date(2026, 10, 17).toISOString(),
		ownerId
	});
	const original = Object.getOwnPropertyDescriptor(
		HTMLElement.prototype,
		'offsetHeight'
	);
	afterAll(() => {
		if (original)
			Object.defineProperty(
				HTMLElement.prototype,
				'offsetHeight',
				original
			);
	});

	it('starts every timed body at the offset of the tallest head', () => {
		// A head is 44 px, and 26 px more for each all-day entry in it.
		Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
			configurable: true,
			get(this: HTMLElement) {
				if (!this.classList.contains('calendarSplit__head')) return 0;
				return 44 + 26 * this.querySelectorAll('.calEntry').length;
			}
		});
		const { container } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[
					{
						id: 'kaya',
						displayName: 'Kaya Brandt',
						agencyName: 'Beratungsstelle Nord',
						relation: 'sameAgency'
					}
				]}
				entries={[allDay('d1', 'kaya'), allDay('d2', 'kaya')]}
				now={new Date(2026, 10, 16, 7)}
			/>
		);
		const heads = Array.from(
			container.querySelectorAll<HTMLElement>('.calendarSplit__head')
		);
		expect(heads).toHaveLength(2);
		expect(heads.map((h) => h.style.minHeight)).toEqual(['96px', '96px']);
	});
});

describe('CalendarSplitView — entries outside 07:00–21:00 (review 4575253322)', () => {
	it('widens the axis, so an early colleague entry and a late own one show', () => {
		const early: CalendarEntry = {
			id: 'early',
			type: 'appointment',
			kind: 'phone',
			start: new Date(2026, 10, 16, 5, 30).toISOString(),
			end: new Date(2026, 10, 16, 6, 30).toISOString(),
			ownerId: 'kaya'
		};
		const late: CalendarEntry = {
			id: 'late',
			type: 'appointment',
			kind: 'video',
			start: new Date(2026, 10, 16, 22).toISOString(),
			end: new Date(2026, 10, 16, 23).toISOString(),
			ownerId: 'me'
		};
		const { container } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[
					{
						id: 'kaya',
						displayName: 'A. Kaya',
						agencyName: 'Nord',
						relation: 'sameAgency'
					}
				]}
				entries={[early, late]}
				now={new Date(2026, 10, 16, 9)}
				workingPlan={HOURS}
			/>
		);
		const top = (id: string) =>
			container.querySelector<HTMLElement>(
				`[data-cy="calendar-split-entry-${id}"]`
			)?.style.top;
		// The axis starts at 05:00 and runs to 23:00.
		expect(top('early')).toBe(`${px(0.5)}px`);
		expect(top('late')).toBe(`${px(17)}px`);
	});
});

describe('CalendarSplitView — proposals outside 07:00–21:00 (review 4581640880)', () => {
	const KAYA = {
		id: 'kaya',
		displayName: 'A. Kaya',
		agencyName: 'Nord',
		relation: 'sameAgency' as const
	};
	const at = (hour: number) => new Date(2026, 10, 16, hour).toISOString();
	const kayaCall: CalendarEntry = {
		id: 'kaya-call',
		type: 'appointment',
		kind: 'phone',
		start: at(10),
		end: at(11),
		ownerId: 'kaya'
	};
	const proposal = (id: string, from: number, to: number) => ({
		proposal: {
			id,
			entryId: 'kaya-call',
			start: at(from),
			end: at(to),
			proposerId: 'me',
			approverId: 'kaya'
		},
		entry: kayaCall
	});
	const dashed = (container: HTMLElement) =>
		Array.from(
			container.querySelectorAll<HTMLElement>('.calEntry--proposal')
		).map((el) => el.style.top);

	it.each([
		['before 07:00', 5, 6, '0px'],
		['after 21:00', 22, 23, `${px(15)}px`]
	])(
		'widens the axis to a proposal %s, so it is drawn at its time',
		(_when, from, to, top) => {
			const { container } = render(
				<CalendarSplitView
					day={MONDAY}
					role="consultant"
					ownerId="me"
					colleagues={[KAYA]}
					entries={[kayaCall]}
					proposals={[proposal('p1', from, to)]}
					now={new Date(2026, 10, 16, 9)}
					workingPlan={HOURS}
				/>
			);
			expect(dashed(container)).toEqual([top]);
		}
	);
});

describe('CalendarSplitView — a colleague whose calendar did not load (review 4575917303)', () => {
	const KAYA = { id: 'kaya', displayName: 'A. Kaya' };
	it('marks nothing "alle frei" and says the calendar is missing', () => {
		const { container, getByText } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[KAYA]}
				entries={[]}
				unavailable={['kaya']}
				now={new Date(2026, 10, 16, 7)}
				workingPlan={HOURS}
			/>
		);
		expect(freeSpans(container)).toEqual([]);
		expect(getByText('calendar.colleagueFailedShort')).toBeTruthy();
	});

	it('still shows free time once every calendar is there', () => {
		const { container } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[KAYA]}
				entries={[]}
				now={new Date(2026, 10, 16, 7)}
				workingPlan={HOURS}
			/>
		);
		expect(freeSpans(container).length).toBeGreaterThan(0);
	});
});

describe('CalendarSplitView — a colleague whose calendar is still loading (review 4576313280)', () => {
	const KAYA = { id: 'kaya', displayName: 'A. Kaya' };
	it('marks nothing "alle frei" and says the calendar is loading, not missing', () => {
		const { container, getByText, queryByText } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[KAYA]}
				entries={[]}
				unavailable={['kaya']}
				loading={['kaya']}
				now={new Date(2026, 10, 16, 7)}
				workingPlan={HOURS}
			/>
		);
		expect(freeSpans(container)).toEqual([]);
		expect(getByText('calendar.colleagueLoadingShort')).toBeTruthy();
		expect(queryByText('calendar.colleagueFailedShort')).toBeNull();
	});
});

describe('CalendarSplitView — grips only where own hours are kept (review 4577586484)', () => {
	const grips = (day: Date) => {
		const { container, unmount } = render(
			<CalendarSplitView
				day={day}
				role="consultant"
				ownerId="me"
				colleagues={[]}
				entries={[]}
				now={new Date(2026, 10, 16, 7)}
				workingPlan={{
					hours: [1, 2, 3, 4, 5].map((weekday) => ({
						weekday,
						start: '08:00',
						end: '16:00'
					}))
				}}
				onEdgeChange={vi.fn()}
			/>
		);
		const count = container.querySelectorAll('[data-grip]').length;
		unmount();
		return count;
	};

	it('draws them within today − 62 to today + 400 days, and not beyond', () => {
		expect(grips(new Date(2026, 10, 16))).toBeGreaterThan(0);
		// 400 days ahead is Tuesday 21 December 2027.
		expect(grips(new Date(2027, 11, 21))).toBeGreaterThan(0);
		expect(grips(new Date(2027, 11, 22))).toBe(0);
		// 62 days back is Tuesday 15 September 2026.
		expect(grips(new Date(2026, 8, 15))).toBeGreaterThan(0);
		expect(grips(new Date(2026, 8, 14))).toBe(0);
	});
});

describe('CalendarSplitView — the time in the entry name (review 4589304613)', () => {
	it('names a 30-minute own appointment with its time, though the box shows none', () => {
		const short: CalendarEntry = {
			id: 'a1',
			type: 'appointment',
			kind: 'video',
			title: 'mutige_eule',
			start: new Date(2026, 10, 16, 10).toISOString(),
			end: new Date(2026, 10, 16, 10, 30).toISOString(),
			ownerId: 'me'
		};
		const { container } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[]}
				entries={[short]}
				now={new Date(2026, 10, 16, 7)}
			/>
		);
		const button = container.querySelector<HTMLElement>(
			'[data-cy="calendar-split-entry-a1"]'
		)!;
		// No visible range below 45 minutes …
		expect(button.querySelector('.calEntry__range')).toBeNull();
		// … but the name says title and time.
		const name = button.getAttribute('aria-label') ?? '';
		expect(name).toContain('mutige_eule');
		expect(name).toContain('10:00');
		expect(name).toContain('10:30');
	});

	it('says a waiting request is one in its name, as the day grid does (FE#2287)', () => {
		const request: CalendarEntry = {
			id: 'q1',
			type: 'appointment',
			kind: 'video',
			title: 'leise_lerche',
			start: new Date(2026, 10, 16, 11).toISOString(),
			end: new Date(2026, 10, 16, 12).toISOString(),
			ownerId: 'me',
			requested: true
		};
		const { container } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[]}
				entries={[request]}
				now={new Date(2026, 10, 16, 7)}
			/>
		);
		const name =
			container
				.querySelector<HTMLElement>(
					'[data-cy="calendar-split-entry-q1"]'
				)!
				.getAttribute('aria-label') ?? '';
		expect(name).toContain('leise_lerche');
		expect(name).toContain('calendar.appointmentRequest.status');
		expect(name).toContain('11:00');
	});
});

describe('CalendarSplitView — opened from a band (Frank *16.2)', () => {
	const KAYA = { id: 'kaya', displayName: 'A. Kaya' };
	const BERG = { id: 'berg', displayName: 'C. Berg' };

	it('starts an hour before the band instead of at 08:00', () => {
		const scrollTo = vi.spyOn(HTMLElement.prototype, 'scrollTo');
		render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[KAYA, BERG]}
				entries={[]}
				now={new Date(2026, 10, 16, 7)}
				workingPlan={HOURS}
				startMinutes={10 * 60}
			/>
		);
		// The axis begins at 07:00: 10:00 is three hours down.
		expect(scrollTo).toHaveBeenCalledWith({ top: px(3) });
		scrollTo.mockRestore();
	});

	it('marks the colleague whose calendar was asked for, by more than colour', () => {
		const { container } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[KAYA, BERG]}
				entries={[]}
				now={new Date(2026, 10, 16, 7)}
				workingPlan={HOURS}
				markedOwner="kaya"
			/>
		);
		const column = (id: string) =>
			container.querySelector(`[data-cy="calendar-split-column-${id}"]`)!;
		expect(column('kaya').classList).toContain(
			'calendarSplit__column--marked'
		);
		expect(column('berg').classList).not.toContain(
			'calendarSplit__column--marked'
		);
		// For a screen reader, too.
		expect(
			column('kaya')
				.querySelector('.calendarSplit__person')
				?.getAttribute('aria-current')
		).toBe('true');
	});
});

describe('CalendarSplitView — own working hours stay in the own column', () => {
	// Frank, 2026-11-17: moving one's own pause ("Immer") moved it for every
	// colleague too. One's working hours and pause are one's own; a
	// colleague's column is not shaded with them.
	it('shades off-hours and the pause only in the own column', () => {
		const { container } = render(
			<CalendarSplitView
				day={MONDAY}
				role="consultant"
				ownerId="me"
				colleagues={[
					{
						id: 'kaya',
						displayName: 'A. Kaya',
						agencyName: 'Nord',
						relation: 'sameAgency'
					}
				]}
				entries={[]}
				now={new Date(2026, 10, 16, 7)}
				workingPlan={{
					hours: [
						{ weekday: 1, start: '08:00', end: '12:00' },
						{ weekday: 1, start: '12:30', end: '16:00' }
					]
				}}
			/>
		);
		const bodies = Array.from(
			container.querySelectorAll<HTMLElement>('.calendarSplit__body')
		);
		expect(bodies).toHaveLength(2);
		const shaded = (body: HTMLElement) =>
			body.querySelectorAll('.calendarSplit__offHours').length;
		expect(shaded(bodies[0])).toBeGreaterThan(0);
		expect(
			bodies[0].querySelector('.calendarSplit__offHours--break')
		).not.toBeNull();
		expect(shaded(bodies[1])).toBe(0);
	});
});

describe('CalendarSplitView — scrolls to a chosen time (review 4594744890)', () => {
	it('starts at the focus time instead of 08:00, and follows a new one', () => {
		const calls: number[] = [];
		const spy = vi
			.spyOn(HTMLElement.prototype, 'scrollTo')
			.mockImplementation(function (
				this: HTMLElement,
				options?: ScrollToOptions | number
			) {
				if (typeof options === 'object' && options.top !== undefined)
					calls.push(options.top);
			});
		const props = {
			day: MONDAY,
			role: 'consultant' as const,
			ownerId: 'me',
			colleagues: [],
			entries: [],
			now: new Date(2026, 10, 16, 7),
			workingPlan: HOURS
		};
		const { rerender } = render(
			<CalendarSplitView
				{...props}
				focusTime={new Date(2026, 10, 16, 18)}
			/>
		);
		const at18 = calls[calls.length - 1];
		rerender(
			<CalendarSplitView
				{...props}
				focusTime={new Date(2026, 10, 16, 19)}
			/>
		);
		const at19 = calls[calls.length - 1];
		spy.mockRestore();
		expect(at19 - at18).toBe(px(1));
		// Later than the 08:00 start.
		expect(at18).toBeGreaterThan(px(8 - 7));
	});
});
