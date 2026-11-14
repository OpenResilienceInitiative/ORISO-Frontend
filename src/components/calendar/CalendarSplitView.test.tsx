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
import { CalendarSplitView } from './CalendarSplitView';

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
		// 08–09 and 12–16, at 48 px an hour from 07:00; not 08–16.
		expect(freeSpans(container)).toEqual([
			['48px', '48px'],
			['240px', '192px']
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
		// 48 px an hour from 07:00: 10:00 is 144 px, not 96 px (09:00).
		expect(shown.style.top).toBe('144px');
		const labels = Array.from(
			container.querySelectorAll('.calendarSplit__hour')
		).map((h) => h.textContent);
		expect(labels.slice(0, 4)).toEqual(['07:00', '08:00', '09:00', '10:00']);
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
		fireEvent.pointerDown(body, { button: 0, clientY: 144 });
		fireEvent.pointerUp(body, { clientY: 144 });
		const [range] = onSelectRange.mock.calls[0];
		expect([range.start.getHours(), range.start.getMinutes()]).toEqual([
			10, 0
		]);
		expect(range.end.getHours()).toBe(11);
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
			Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original);
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
