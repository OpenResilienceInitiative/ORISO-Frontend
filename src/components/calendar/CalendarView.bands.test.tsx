// @vitest-environment oriso-jsdom
/**
 * Colleagues in the time grid fold into "k von n belegt" bands; month and
 * list keep single entries (Frank, prototype v15; review 4575917303 for a
 * colleague whose calendar did not load).
 */
import * as React from 'react';
import { useCalendarController } from '@fullcalendar/react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CalendarEntry, Colleague } from './calendarModel';
import { CalendarView, type CalendarViewProps } from './CalendarView';

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

afterEach(cleanup);

const KAYA: Colleague = {
	id: 'kaya',
	displayName: 'A. Kaya',
	agencyName: 'Nord',
	relation: 'sameAgency'
};
const BERG: Colleague = {
	id: 'berg',
	displayName: 'C. Berg',
	agencyName: 'Nord',
	relation: 'sameAgency'
};
const at = (hour: number) => new Date(2026, 10, 16, hour).toISOString();
const appointment = (
	id: string,
	ownerId: string,
	from: number,
	to: number
): CalendarEntry => ({
	id,
	type: 'appointment',
	kind: 'video',
	title: id,
	start: at(from),
	end: at(to),
	ownerId
});
const ENTRIES = [
	appointment('own', 'me', 9, 10),
	appointment('kaya-1', 'kaya', 10, 12),
	appointment('berg-1', 'berg', 11, 13)
];

const Grid = (
	props: Partial<CalendarViewProps> & Pick<CalendarViewProps, 'view'>
) => {
	const controller = useCalendarController();
	return (
		<CalendarView
			controller={controller}
			role="consultant"
			ownerId="me"
			entries={ENTRIES}
			colleagues={{ kaya: KAYA, berg: BERG }}
			bandPeople={[KAYA, BERG]}
			now={new Date(2026, 10, 16, 8)}
			initialDate={new Date(2026, 10, 16)}
			{...props}
		/>
	);
};

const bandLabels = () =>
	Array.from(
		document.querySelectorAll<HTMLElement>('[data-cy="calendar-band"]')
	).map((band) => band.textContent);
const shownEntry = (id: string) =>
	document.querySelector(`[data-entry-id="${id}"]`);

describe('CalendarView — colleagues as bands in the time grid', () => {
	it('folds colleague entries into "k von n belegt" and keeps one’s own', async () => {
		render(<Grid view="workWeek" />);
		await waitFor(() => expect(shownEntry('own')).not.toBeNull());
		expect(bandLabels()).toEqual([
			'calendar.bandSome {"busy":1,"total":2}',
			'calendar.bandSome {"busy":2,"total":2}',
			'calendar.bandSome {"busy":1,"total":2}'
		]);
		expect(shownEntry('kaya-1')).toBeNull();
		expect(shownEntry('berg-1')).toBeNull();
		// Darker where everyone shown is busy.
		const all = document.querySelectorAll('.calendarView__band--all');
		expect(all).toHaveLength(1);
	});

	it('names the one colleague shown', async () => {
		render(
			<Grid
				view="day"
				entries={ENTRIES.filter((e) => e.ownerId !== 'berg')}
				bandPeople={[KAYA]}
			/>
		);
		await waitFor(() => expect(bandLabels()).toHaveLength(1));
		expect(bandLabels()[0]).toBe('calendar.bandOne {"name":"A. Kaya"}');
	});

	it('tells who is busy and who is free on hover', async () => {
		render(<Grid view="workWeek" />);
		await waitFor(() => expect(bandLabels()).toHaveLength(3));
		const first = document.querySelector(
			'[data-cy="calendar-band"]'
		) as HTMLElement;
		act(() => {
			fireEvent.mouseOver(first);
		});
		const peek = await screen.findByText(/calendar\.bandBusy/);
		expect(peek.textContent).toContain('A. Kaya');
		expect(screen.getByText(/calendar\.bandFree/).textContent).toContain(
			'C. Berg'
		);
	});

	it('never darkens a band while a shown calendar did not load', async () => {
		render(
			<Grid
				view="workWeek"
				entries={ENTRIES.filter((e) => e.ownerId !== 'berg')}
				bandPeople={[KAYA]}
				unavailable={[BERG]}
			/>
		);
		await waitFor(() => expect(bandLabels()).toHaveLength(1));
		expect(document.querySelector('.calendarView__band--all')).toBeNull();
	});

	it('keeps single colleague entries in month and list', async () => {
		render(<Grid view="month" />);
		await waitFor(() => expect(shownEntry('kaya-1')).not.toBeNull());
		expect(bandLabels()).toEqual([]);
	});
});
