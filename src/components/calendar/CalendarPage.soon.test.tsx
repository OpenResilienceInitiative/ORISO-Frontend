// @vitest-environment oriso-jsdom
/**
 * "Beginnt gleich" is said in words and with a clock, not by colour alone,
 * and the grid and the side list mark the same one entry (review
 * 4577641949).
 */
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarPage } from './CalendarPage';
import type { CalendarEntry } from './calendarModel';

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

afterEach(cleanup);

const NOW = new Date(2026, 10, 16, 9, 50);
const own = (
	id: string,
	fromMinutes: number,
	type: CalendarEntry['type'] = 'appointment'
): CalendarEntry => ({
	id,
	type,
	...(type === 'appointment' && { kind: 'video' as const }),
	title: id,
	start: new Date(NOW.getTime() + fromMinutes * 60_000).toISOString(),
	end: new Date(NOW.getTime() + (fromMinutes + 45) * 60_000).toISOString(),
	ownerId: 'me'
});

const page = (entries: CalendarEntry[]) =>
	render(
		<CalendarPage
			role="consultant"
			ownerId="me"
			now={NOW}
			entries={entries}
			initialView="week"
		/>
	);

const gridSoon = () =>
	Array.from(document.querySelectorAll('.calEntry--soon')).map(
		(el) => el.querySelector('.calEntry__title')?.textContent
	);
const listButton = (name: RegExp) =>
	Array.from(
		document.querySelectorAll<HTMLElement>(
			'[data-cy="calendar-upcoming"] button.tlp__entry'
		)
	).find((el) => name.test(el.textContent ?? ''));
const byCy = (name: string) =>
	document.querySelector(`[data-cy="${name}"]`) as HTMLElement | null;

describe('CalendarPage — "Beginnt gleich" (review 4577641949)', () => {
	it('names it in the side list button, not only by colour', () => {
		page([own('mutige_eule', 5)]);
		const button = listButton(/mutige_eule/) as HTMLElement;
		expect(button.className).toContain('tlp__entry--soon');
		// The accessible name carries it: the button's text includes it.
		expect(
			screen
				.getAllByRole('button', { name: /mutige_eule.*calendar\.soon/ })
				.includes(button)
		).toBe(true);
	});

	it('says it in the grid entry too', async () => {
		page([own('mutige_eule', 5)]);
		await waitFor(() => expect(gridSoon()).toEqual(['mutige_eule']));
		const entry = document.querySelector('.calEntry--soon') as HTMLElement;
		expect(entry.textContent).toContain('calendar.soon');
	});

	it('marks one entry, the next, in the grid and the list alike, a group date included', async () => {
		page([own('later', 10), own('next', 5, 'group')]);
		await waitFor(() => expect(gridSoon()).toEqual(['next']));
		expect(document.querySelectorAll('.tlp__entry--soon')).toHaveLength(1);
		expect(listButton(/next/)?.textContent).toContain('calendar.soon');
		expect(listButton(/later/)?.textContent).not.toContain('calendar.soon');
		expect(screen.getAllByText('calendar.soon')).toHaveLength(2);
	});

	it('marks no other entry in the grid when the kind filter hides the soon one', async () => {
		page([own('next', 5, 'group'), own('later', 10)]);
		await waitFor(() => expect(gridSoon()).toEqual(['next']));
		fireEvent.click(byCy('calendar-kinds-button') as HTMLElement);
		await waitFor(() =>
			expect(byCy('display-filter-show-group')).not.toBeNull()
		);
		fireEvent.click(byCy('display-filter-show-group') as HTMLElement);
		// Hidden in both: "later" is now first in the list and the grid.
		await waitFor(() => expect(gridSoon()).toEqual(['later']));
		expect(listButton(/later/)?.className).toContain('tlp__entry--soon');
		expect(listButton(/next/)).toBeUndefined();
	});

	it('marks none in the grid when the chips leave the soon one out of it', async () => {
		page([own('next', 5, 'group'), own('later', 10)]);
		await waitFor(() => expect(gridSoon()).toEqual(['next']));
		// "Nur Video" narrows the grid; "Als Nächstes" still starts with
		// the group date, so the grid must not pick "later" instead.
		fireEvent.click(byCy('calendar-filter-video') as HTMLElement);
		await waitFor(() =>
			expect(document.querySelectorAll('.calEntry')).toHaveLength(1)
		);
		expect(gridSoon()).toEqual([]);
		expect(listButton(/next/)?.className).toContain('tlp__entry--soon');
	});
});

describe('CalendarPage — an entry chosen while a kind filter hides it (review 4589150199)', () => {
	it('shows its kind again, so the calendar does not land on nothing', async () => {
		page([own('next', 5, 'group'), own('later', 10)]);
		fireEvent.click(byCy('calendar-filter-video') as HTMLElement);
		await waitFor(() =>
			expect(document.querySelectorAll('.calEntry')).toHaveLength(1)
		);
		// "Als Nächstes" still lists the group date the chips hide.
		fireEvent.click(listButton(/next/) as HTMLElement);
		fireEvent.click(byCy('calendar-entry-show') as HTMLElement);
		await waitFor(() =>
			expect(document.querySelectorAll('.calEntry')).toHaveLength(2)
		);
	});
});

describe('CalendarPage — an own entry chosen while "ich" is muted (review 4589661566)', () => {
	it('unmutes its owner, so the entry can be opened where it lands', async () => {
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[own('next', 5)]}
				initialView="week"
				colleagues={[
					{
						id: 'kaya',
						displayName: 'A. Kaya',
						agencyName: 'Nord',
						relation: 'sameAgency'
					}
				]}
				initialShownColleagues={['kaya']}
			/>
		);
		fireEvent.click(byCy('calendar-person-me') as HTMLElement);
		await waitFor(() =>
			expect(document.querySelector('.calEntry--muted')).not.toBeNull()
		);
		fireEvent.click(listButton(/next/) as HTMLElement);
		fireEvent.click(byCy('calendar-entry-show') as HTMLElement);
		await waitFor(() =>
			expect(document.querySelector('.calEntry--muted')).toBeNull()
		);
	});
});

describe('CalendarPage — a colleague entry chosen in search (review 4594535280)', () => {
	it('lands side by side, where the entry is drawn on its own', async () => {
		const theirs: CalendarEntry = {
			...own('kaya-call', 120),
			ownerId: 'kaya',
			title: 'mutige_eule'
		};
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={NOW}
				entries={[own('next', 5), theirs]}
				initialView="week"
				colleagues={[
					{
						id: 'kaya',
						displayName: 'A. Kaya',
						agencyName: 'Nord',
						relation: 'sameAgency'
					}
				]}
				initialShownColleagues={['kaya']}
			/>
		);
		fireEvent.change(
			screen.getAllByPlaceholderText('calendar.search.placeholder')[0],
			{ target: { value: 'Kaya' } }
		);
		fireEvent.click(byCy('calendar-search-kaya-call') as HTMLElement);
		await waitFor(() =>
			expect(screen.queryByTestId('calendar-split-view')).not.toBeNull()
		);
		expect(byCy('calendar-split-entry-kaya-call')).not.toBeNull();
	});
});
