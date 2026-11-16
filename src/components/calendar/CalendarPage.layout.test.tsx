// @vitest-environment oriso-jsdom
/**
 * Phone and tablet (Frank, prototype v15): both use the phone layout. The
 * search sits at the very top, the working hours live in ⋮, there is no
 * "Als Nächstes", and the bottom sheet only appears while requests are
 * open. The tablet keeps the work week, the phone keeps three days.
 */
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarPage, type CalendarPageProps } from './CalendarPage';
import type { CalendarEntry } from './calendarModel';
import type { MoveProposal } from './calendarActions';
import type { WorkingHours } from './calendarWorkingHours';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

if (typeof window.ResizeObserver === 'undefined')
	window.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
if (!HTMLElement.prototype.scrollTo)
	HTMLElement.prototype.scrollTo = () => undefined;

afterEach(() => {
	cleanup();
	localStorage.clear();
});

const NOW = new Date(2026, 10, 16, 9, 0);
const OWN: CalendarEntry = {
	id: 'a1',
	type: 'appointment',
	kind: 'video',
	title: 'mutige_eule',
	sessionId: 4402,
	start: new Date(2026, 10, 16, 11, 0).toISOString(),
	end: new Date(2026, 10, 16, 12, 0).toISOString(),
	ownerId: 'me'
};
const KAYA: CalendarEntry = {
	id: 'k1',
	type: 'appointment',
	kind: 'phone',
	title: 'graue_gans',
	start: new Date(2026, 10, 17, 10, 0).toISOString(),
	end: new Date(2026, 10, 17, 11, 0).toISOString(),
	ownerId: 'kaya'
};
const REQUEST: MoveProposal = {
	id: 'p1',
	entryId: 'k1',
	start: new Date(2026, 10, 17, 14, 0).toISOString(),
	end: new Date(2026, 10, 17, 15, 0).toISOString()
};
const HOURS: WorkingHours = [
	{ weekday: 1, start: '08:00', end: '17:00' },
	{ weekday: 2, start: '08:00', end: '17:00' }
];

const page = (props: Partial<CalendarPageProps> = {}) => {
	const all: CalendarPageProps = {
		role: 'consultant',
		ownerId: 'me',
		now: NOW,
		entries: [OWN, KAYA],
		colleagues: [{ id: 'kaya', displayName: 'A. Kaya' }],
		initialShownColleagues: ['kaya'],
		workingHours: HOURS,
		workingHoursLoaded: true,
		onCreate: () => true,
		onSaveWorkingHours: () => true,
		onProposeMove: () => undefined,
		compact: true,
		...props
	} as CalendarPageProps;
	return render(<CalendarPage {...all} />);
};

const stage = () => document.querySelector<HTMLElement>('.calendarStage')!;
const viewButton = () =>
	document.querySelector<HTMLElement>('[data-cy="calendar-view-menu"]')!;
const cy = (id: string) =>
	document.querySelector<HTMLElement>(`[data-cy="${id}"]`);

describe('CalendarPage — phone and tablet', () => {
	it('puts the search at the very top, with "Was anzeigen" in it', () => {
		page({ phone: false });
		const search = stage().firstElementChild as HTMLElement;
		expect(search.className).toBe('calendarStage__search');
		expect(within(search).getByRole('searchbox')).toBeTruthy();
		expect(
			search.querySelector('[data-cy="calendar-kinds-button"]')
		).not.toBeNull();
	});

	it('finds an entry from the top search and moves the calendar there (prototype v17)', () => {
		const later: CalendarEntry = {
			...OWN,
			id: 'a2',
			title: 'stille_robbe',
			start: new Date(2026, 11, 3, 15, 0).toISOString(),
			end: new Date(2026, 11, 3, 16, 0).toISOString()
		};
		const onRangeChange = vi.fn();
		page({
			phone: false,
			entries: [OWN, KAYA, later],
			initialView: 'month',
			onRangeChange
		});
		const search = stage().firstElementChild as HTMLElement;
		fireEvent.change(within(search).getByRole('searchbox'), {
			target: { value: 'robbe' }
		});
		const results = search.querySelector<HTMLElement>(
			'.calendarSearch__results'
		)!;
		fireEvent.click(
			within(results).getByRole('button', { name: /stille_robbe/ })
		);
		// The days with times, standing on that day; no action menu, and
		// the results close.
		expect(viewButton().textContent).toContain('calendar.views.workWeek');
		const [start, end] = onRangeChange.mock.calls.at(-1) as [Date, Date];
		const day = new Date(later.start).getTime();
		expect(start.getTime()).toBeLessThanOrEqual(day);
		expect(end.getTime()).toBeGreaterThan(day);
		expect(cy('calendar-menu-entry')).toBeNull();
		expect(search.querySelector('.calendarSearch__results')).toBeNull();
	});

	it.each(['month', 'workWeek'] as const)(
		'opens the whole week for a weekend entry found from %s (review 4589150187)',
		(initialView) => {
			// Saturday, 5 December 2026: the work week hides it.
			const saturday: CalendarEntry = {
				...OWN,
				id: 'a3',
				title: 'stille_robbe',
				start: new Date(2026, 11, 5, 15, 0).toISOString(),
				end: new Date(2026, 11, 5, 16, 0).toISOString()
			};
			const onRangeChange = vi.fn();
			page({
				phone: false,
				entries: [OWN, KAYA, saturday],
				initialView,
				onRangeChange
			});
			const search = stage().firstElementChild as HTMLElement;
			fireEvent.change(within(search).getByRole('searchbox'), {
				target: { value: 'robbe' }
			});
			fireEvent.click(
				within(
					search.querySelector<HTMLElement>(
						'.calendarSearch__results'
					)!
				).getByRole('button', { name: /stille_robbe/ })
			);
			expect(viewButton().textContent).toContain('calendar.views.week');
			expect(viewButton().textContent).not.toContain(
				'calendar.views.workWeek'
			);
			const [start, end] = onRangeChange.mock.calls.at(-1) as [
				Date,
				Date
			];
			const day = new Date(saturday.start).getTime();
			expect(start.getTime()).toBeLessThanOrEqual(day);
			expect(end.getTime()).toBeGreaterThan(day);
		}
	);

	it('shows no "Als Nächstes", no hours line and no sheet without open requests', () => {
		page({ phone: false });
		expect(cy('calendar-upcoming')).toBeNull();
		expect(cy('calendar-working-hours')).toBeNull();
		expect(cy('calendar-sheet')).toBeNull();
		expect(
			screen
				.getByTestId('calendar-page')
				.classList.contains('calendarPage--sheet')
		).toBe(false);
	});

	it('brings the sheet up for open requests, with only them and quick entry', () => {
		page({ phone: false, proposals: [REQUEST] });
		const sheet = cy('calendar-sheet')!;
		expect(sheet).not.toBeNull();
		expect(
			sheet.querySelector('[data-cy="calendar-request-p1"]')
		).not.toBeNull();
		expect(
			sheet.querySelector('[data-cy="calendar-quick-toggle"]')
		).not.toBeNull();
		expect(sheet.querySelector('[data-cy="calendar-upcoming"]')).toBeNull();
		expect(
			sheet.querySelector('[data-cy="calendar-working-hours"]')
		).toBeNull();
		expect(sheet.querySelector('.calendarSide__search')).toBeNull();
		expect(
			screen
				.getByTestId('calendar-page')
				.classList.contains('calendarPage--sheet')
		).toBe(true);
	});

	it('keeps the working hours in ⋮ as "Arbeitszeit festlegen", with the hours', () => {
		page({ phone: false });
		fireEvent.click(cy('calendar-settings')!);
		const item = cy('calendar-settings-working-hours')!;
		expect(item.textContent).toContain('calendar.workingHours.title');
		expect(item.textContent).not.toContain('calendar.workingHours.none');
	});

	it('keeps the work week on the tablet', () => {
		page({ phone: false });
		expect(viewButton().textContent).toContain('calendar.views.workWeek');
		fireEvent.click(viewButton());
		const menu = cy('calendar-menu-view')!;
		expect(within(menu).getByText('calendar.views.workWeek')).toBeTruthy();
		expect(within(menu).getByText('calendar.views.week')).toBeTruthy();
	});

	it('keeps three days on the phone: five or seven days become three, and back', () => {
		const { rerender } = page({ phone: false, initialView: 'workWeek' });
		const props = (phone: boolean) =>
			({
				role: 'consultant',
				ownerId: 'me',
				now: NOW,
				entries: [OWN, KAYA],
				compact: true,
				phone,
				initialView: 'workWeek'
			}) as CalendarPageProps;
		rerender(<CalendarPage {...props(true)} />);
		expect(viewButton().textContent).toContain('calendar.views.threeDays');
		rerender(<CalendarPage {...props(false)} />);
		expect(viewButton().textContent).toContain('calendar.views.workWeek');
	});

	it('opens the phone on three days, without five- or seven-day views', () => {
		page();
		expect(viewButton().textContent).toContain('calendar.views.threeDays');
		fireEvent.click(viewButton());
		const menu = cy('calendar-menu-view')!;
		expect(within(menu).queryByText('calendar.views.workWeek')).toBeNull();
		expect(within(menu).getByText('calendar.views.threeDays')).toBeTruthy();
	});
});
