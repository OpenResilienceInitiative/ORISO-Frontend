// @vitest-environment oriso-jsdom
/**
 * Co-access (UserService#1655): an appointment of a conversation one has
 * co-access to is in one's own calendar and, with the same id, in the
 * responsible colleague's. Each copy keeps its own name and peek.
 */
import * as React from 'react';
import { useCalendarController } from '@fullcalendar/react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
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
const at = (hour: number) => new Date(2026, 10, 16, hour).toISOString();
/** One's own copy: the advice seeker's name, movable. */
const MINE: CalendarEntry = {
	id: 'a1',
	type: 'appointment',
	kind: 'video',
	title: 'ruhiges_yak',
	sessionId: 4401,
	start: at(10),
	end: at(11),
	ownerId: 'me',
	movable: true
};
/** The same appointment in A. Kaya's calendar, redacted. */
const KAYAS: CalendarEntry = {
	...MINE,
	title: undefined,
	sessionId: undefined,
	ownerId: 'kaya',
	movable: false
};

const Grid = (props: Partial<CalendarViewProps>) => {
	const controller = useCalendarController();
	return (
		<CalendarView
			controller={controller}
			role="consultant"
			ownerId="me"
			view="month"
			entries={[MINE, KAYAS]}
			colleagues={{ kaya: KAYA }}
			now={new Date(2026, 10, 16, 8)}
			initialDate={new Date(2026, 10, 16)}
			{...props}
		/>
	);
};

const copyOf = (owner: string) =>
	document.querySelector<HTMLElement>(
		`[data-entry-id="a1"][data-owner="${owner}"]`
	);

describe('CalendarView — one appointment in two calendars (co-access)', () => {
	it('shows both copies and names each as its own calendar shows it, also after a render', async () => {
		const { rerender } = render(<Grid />);
		await waitFor(() => {
			expect(copyOf('me')).not.toBeNull();
			expect(copyOf('kaya')).not.toBeNull();
		});
		// A later render refreshes the names; each keeps its own.
		rerender(<Grid highlight={{ owner: 'me' }} />);
		await act(async () => undefined);
		expect(copyOf('me')?.getAttribute('aria-label')).not.toContain(
			'A. Kaya'
		);
		expect(copyOf('kaya')?.getAttribute('aria-label')).toContain('A. Kaya');
	});
});
