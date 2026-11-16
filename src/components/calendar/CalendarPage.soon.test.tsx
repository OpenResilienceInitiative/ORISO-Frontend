// @vitest-environment oriso-jsdom
/**
 * "Beginnt gleich" is said in words and with a clock, not by colour alone,
 * and the grid and the side list mark the same one entry (review
 * 4577641949).
 */
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
		document.querySelectorAll<HTMLElement>('.calendarPage__entry')
	).find((el) => name.test(el.textContent ?? ''));

describe('CalendarPage — "Beginnt gleich" (review 4577641949)', () => {
	it('names it in the side list button, not only by colour', () => {
		page([own('mutige_eule', 5)]);
		const button = listButton(/mutige_eule/) as HTMLElement;
		expect(button.className).toContain('calendarPage__entry--soon');
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
		expect(
			document.querySelectorAll('.calendarPage__entry--soon')
		).toHaveLength(1);
		expect(listButton(/next/)?.textContent).toContain('calendar.soon');
		expect(listButton(/later/)?.textContent).not.toContain('calendar.soon');
		expect(screen.getAllByText('calendar.soon')).toHaveLength(2);
	});
});
