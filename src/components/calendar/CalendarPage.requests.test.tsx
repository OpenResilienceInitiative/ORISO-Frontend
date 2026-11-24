// @vitest-environment oriso-jsdom
/**
 * An advice seeker's appointment request (FE#2287, Frank 17 Nov 2026): it is
 * in the counsellor's calendar, dashed like a move proposal, and answered
 * the same way: a click opens the menu that answers a proposal, with
 * "Bestätigen" and "Ablehnen". The grid is a stub that hands out its
 * callbacks.
 */
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarPage, type CalendarPageProps } from './CalendarPage';
import { RequestedTimeTaken } from './calendarActions';
import type { CalendarEntry } from './calendarModel';
import type { MenuAnchor } from './CalendarView';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) =>
			values
				? `${key}(${Object.entries(values)
						.map(([k, v]) => `${k}=${String(v)}`)
						.join(';')})`
				: key,
		i18n: { language: 'de' }
	})
}));

const grid: {
	entries?: CalendarEntry[];
	onEntryOpen?: (
		entry: CalendarEntry,
		anchor: MenuAnchor,
		mode: 'list' | 'move'
	) => void;
} = {};
vi.mock('./CalendarView', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./CalendarView')>();
	return {
		...actual,
		CalendarView: (props: typeof grid) => {
			grid.entries = props.entries;
			grid.onEntryOpen = props.onEntryOpen;
			return <div data-testid="calendar-view" />;
		}
	};
});

afterEach(cleanup);
if (!HTMLElement.prototype.scrollTo)
	HTMLElement.prototype.scrollTo = () => undefined;

const NOW = new Date(2026, 10, 16, 9);
const at = (day: number, hour: number) =>
	new Date(2026, 10, day, hour).toISOString();

const REQUEST: CalendarEntry = {
	id: 'r1',
	type: 'appointment',
	kind: 'video',
	title: 'ruhiges_yak',
	sessionId: 4401,
	start: at(17, 14),
	end: at(17, 15),
	ownerId: 'me',
	movable: false,
	requested: true
};

const page = (props: Partial<CalendarPageProps> = {}) =>
	render(
		<CalendarPage
			role="consultant"
			ownerId="me"
			now={NOW}
			entries={[REQUEST]}
			colleagues={[]}
			onConfirmRequest={vi.fn()}
			onDeclineRequest={vi.fn()}
			{...props}
		/>
	);

const byCy = (name: string) =>
	document.querySelector<HTMLElement>(`[data-cy="${name}"]`);

const openRequest = () =>
	act(() => grid.onEntryOpen?.(REQUEST, { x: 10, y: 10 }, 'list'));

describe('CalendarPage — an advice seeker’s appointment request (FE#2287)', () => {
	it('is in the grid like any appointment of the counsellor', () => {
		page();
		expect(grid.entries?.map((e) => e.id)).toContain('r1');
	});

	it('opens the menu that answers a proposal: who asks, for when, confirm or decline', () => {
		page();
		openRequest();
		const menu = byCy('calendar-menu-appointmentRequest') as HTMLElement;
		expect(menu).not.toBeNull();
		expect(menu.textContent).toContain(
			'calendar.appointmentRequest.from(name=ruhiges_yak)'
		);
		expect(menu.textContent).toMatch(/14:00–15:00/);
		expect(
			within(menu).getByRole('menuitem', {
				name: /calendar\.appointmentRequest\.confirm/
			})
		).toBeTruthy();
		expect(
			within(menu).getByRole('menuitem', {
				name: /calendar\.appointmentRequest\.decline/
			})
		).toBeTruthy();
		// Same buttons as for a proposal.
		expect(byCy('calendar-request-accept')).not.toBeNull();
		expect(byCy('calendar-request-decline')).not.toBeNull();
	});

	it('confirms: the handler gets the request, the page says so', async () => {
		const onConfirmRequest = vi.fn(() => Promise.resolve());
		page({ onConfirmRequest });
		openRequest();
		await act(async () => {
			fireEvent.click(byCy('calendar-request-accept') as HTMLElement);
		});
		expect(onConfirmRequest).toHaveBeenCalledWith(REQUEST);
		expect(
			screen.getByText(
				/^calendar\.appointmentRequest\.confirmed\(date=.*14:00–15:00\)$/
			)
		).toBeTruthy();
	});

	it('declines: the handler gets the request, the page says so', async () => {
		const onDeclineRequest = vi.fn(() => Promise.resolve());
		page({ onDeclineRequest });
		openRequest();
		await act(async () => {
			fireEvent.click(byCy('calendar-request-decline') as HTMLElement);
		});
		expect(onDeclineRequest).toHaveBeenCalledWith(REQUEST);
		expect(
			screen.getByText(
				/^calendar\.appointmentRequest\.declined\(date=.*14:00–15:00\)$/
			)
		).toBeTruthy();
	});

	it('says the time is taken when confirming is refused for that', async () => {
		page({
			onConfirmRequest: () => Promise.reject(new RequestedTimeTaken())
		});
		openRequest();
		await act(async () => {
			fireEvent.click(byCy('calendar-request-accept') as HTMLElement);
		});
		expect(
			screen.getByText('sessionList.timeline.appointment.request.taken')
		).toBeTruthy();
	});

	it('shows the usual failure notice for any other failure', async () => {
		page({ onDeclineRequest: () => Promise.reject(new Error('down')) });
		openRequest();
		await act(async () => {
			fireEvent.click(byCy('calendar-request-decline') as HTMLElement);
		});
		expect(screen.getByText('calendar.saveFailed')).toBeTruthy();
	});

	it('offers no answer without the callbacks, e.g. to an advice seeker', () => {
		page({ onConfirmRequest: undefined, onDeclineRequest: undefined });
		openRequest();
		expect(byCy('calendar-menu-appointmentRequest')).not.toBeNull();
		expect(byCy('calendar-request-accept')).toBeNull();
		expect(byCy('calendar-request-decline')).toBeNull();
	});
});
