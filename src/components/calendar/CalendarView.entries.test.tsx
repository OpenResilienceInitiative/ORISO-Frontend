// @vitest-environment oriso-jsdom
/**
 * One entry in the grid (prototype v17): the person's avatar, the kind
 * icon, the title, "10:00–11:00" below it in the wide time grids, plain
 * rows in the list, and a flash when just created.
 */
import * as React from 'react';
import { useCalendarController } from '@fullcalendar/react';
import { cleanup, render, waitFor } from '@testing-library/react';
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

const at = (hour: number, minute = 0) =>
	new Date(2026, 10, 16, hour, minute).toISOString();
const KAYA: Colleague = {
	id: 'kaya',
	displayName: 'A. Kaya',
	agencyName: 'Nord',
	relation: 'sameAgency'
};
const OWN: CalendarEntry = {
	id: 'own',
	type: 'appointment',
	kind: 'video',
	title: 'mutige_eule',
	start: at(10),
	end: at(11),
	ownerId: 'me'
};
const SHORT: CalendarEntry = {
	...OWN,
	id: 'short',
	start: at(12),
	end: at(12, 30)
};
const COLLEAGUE: CalendarEntry = {
	...OWN,
	id: 'kaya-1',
	title: 'graue_gans',
	start: at(14),
	end: at(15),
	ownerId: 'kaya'
};

const Grid = (
	props: Partial<CalendarViewProps> & Pick<CalendarViewProps, 'view'>
) => {
	const controller = useCalendarController();
	return (
		<CalendarView
			controller={controller}
			role="consultant"
			ownerId="me"
			entries={[OWN, SHORT, COLLEAGUE]}
			colleagues={{ kaya: KAYA }}
			now={new Date(2026, 10, 16, 8)}
			initialDate={new Date(2026, 10, 16)}
			{...props}
		/>
	);
};
const shown = (id: string) =>
	document.querySelector<HTMLElement>(`[data-entry-id="${id}"]`);

describe('CalendarView — one entry (prototype v17)', () => {
	it('shows the advice seeker as an avatar and the time below from 45 minutes', async () => {
		render(<Grid view="workWeek" />);
		await waitFor(() => expect(shown('own')).not.toBeNull());
		const own = shown('own')!;
		expect(own.className).toContain('calEntry--appointment');
		expect(own.querySelector('.calEntry__avatar')!.textContent).toBe('ME');
		expect(own.querySelector('.calEntry__avatar')!.className).toMatch(
			/calAvatar--tone-\d/
		);
		expect(own.querySelector('.calEntry__range')!.textContent).toBe(
			'10:00–11:00'
		);
		// Half an hour has no room for a second line (a real 30-minute
		// entry, review 4589304618).
		expect(
			new Date(SHORT.end).getTime() - new Date(SHORT.start).getTime()
		).toBe(30 * 60_000);
		expect(shown('short')!.querySelector('.calEntry__range')).toBeNull();
	});

	it('shows a colleague’s entry with the colleague’s avatar, without a name prefix', async () => {
		render(<Grid view="month" />);
		await waitFor(() => expect(shown('kaya-1')).not.toBeNull());
		const entry = shown('kaya-1')!;
		expect(entry.className).toContain('calEntry--colleague');
		expect(entry.querySelector('.calEntry__avatar')!.textContent).toBe(
			'AK'
		);
		expect(
			entry.querySelector('.calEntry__title')!.textContent
		).not.toContain('A. Kaya ·');
		// The month names the start, the time grid does not.
		expect(entry.querySelector('.calEntry__time')).not.toBeNull();
	});

	it('draws the list as plain rows', async () => {
		render(<Grid view="list" />);
		await waitFor(() => expect(shown('own')).not.toBeNull());
		expect(shown('own')!.className).toContain('calEntry--listRow');
		expect(shown('own')!.querySelector('.calEntry__time')).toBeNull();
	});

	it('flashes an entry just created', async () => {
		render(<Grid view="workWeek" flashIds={['own', 'kaya-1']} />);
		await waitFor(() => expect(shown('own')).not.toBeNull());
		expect(shown('own')!.className).toContain('calEntry--flash');
		expect(shown('short')!.className).not.toContain('calEntry--flash');
	});
});
