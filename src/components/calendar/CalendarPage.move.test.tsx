// @vitest-environment oriso-jsdom
/**
 * A drag runs the checks creating has: an appointment never moves into
 * the past, and a move onto other entries asks first. Refused or not
 * confirmed, the entry goes back and nothing says it moved (review
 * 4577641945). The grid is a stub that hands out its move callback.
 */
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
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

const grid: {
	onEntryMove?: (entry: CalendarEntry, start: Date, end: Date) => unknown;
} = {};
vi.mock('./CalendarView', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./CalendarView')>();
	return {
		...actual,
		CalendarView: (props: typeof grid) => {
			grid.onEntryMove = props.onEntryMove;
			return <div data-testid="calendar-view" />;
		}
	};
});

afterEach(cleanup);
if (!HTMLElement.prototype.scrollTo)
	HTMLElement.prototype.scrollTo = () => undefined;

const NOW = new Date(2026, 10, 16, 9);
const at = (hour: number) => new Date(2026, 10, 17, hour);
const appointment = (
	id: string,
	from: Date,
	to: Date,
	type: CalendarEntry['type'] = 'appointment'
): CalendarEntry => ({
	id,
	type,
	...(type === 'appointment' && { kind: 'video' as const }),
	title: id,
	start: from.toISOString(),
	end: to.toISOString(),
	ownerId: 'me'
});
const MOVED = appointment('moved', at(10), at(11));
const OTHER = appointment('other', at(14), at(15));

const page = (onMove = vi.fn(() => true), entries = [MOVED, OTHER]) => {
	render(
		<CalendarPage
			role="consultant"
			ownerId="me"
			now={NOW}
			entries={entries}
			onMove={onMove}
		/>
	);
	return onMove;
};

const drag = async (entry: CalendarEntry, start: Date, end: Date) => {
	let result: unknown;
	await act(async () => {
		result = grid.onEntryMove?.(entry, start, end);
	});
	return result;
};

describe('CalendarPage — a drag into the past (review 4577641945)', () => {
	it('puts an appointment back and says why, without "verschoben"', async () => {
		const onMove = page();
		const result = await drag(
			MOVED,
			new Date(2026, 10, 15, 10),
			new Date(2026, 10, 15, 11)
		);
		expect(result).toBe(false);
		expect(onMove).not.toHaveBeenCalled();
		expect(screen.getByText('calendar.movePast')).toBeTruthy();
		expect(screen.queryByText('calendar.moved')).toBeNull();
	});

	it('lets a blocker move into the past, as one can be created there', async () => {
		const blocker = appointment('b', at(10), at(11), 'blocker');
		const onMove = page(
			vi.fn(() => true),
			[blocker]
		);
		await drag(
			blocker,
			new Date(2026, 10, 15, 10),
			new Date(2026, 10, 15, 11)
		);
		expect(onMove).toHaveBeenCalledTimes(1);
	});
});

describe('CalendarPage — a drag onto other entries (review 4577641945)', () => {
	it('asks first and moves only once confirmed', async () => {
		const onMove = page();
		let result: Promise<unknown> | undefined;
		act(() => {
			result = grid.onEntryMove?.(
				MOVED,
				at(14),
				at(15)
			) as Promise<unknown>;
		});
		expect(
			screen.getByTestId('calendar-move-conflict').textContent
		).toContain('calendar.dialog.conflict');
		expect(onMove).not.toHaveBeenCalled();
		await act(async () => {
			fireEvent.click(screen.getByTestId('calendar-move-anyway'));
			await result;
		});
		expect(await result).toBe(true);
		expect(onMove).toHaveBeenCalledWith(MOVED, at(14), at(15));
		expect(screen.getByText('calendar.moved')).toBeTruthy();
	});

	it('puts it back without a notice when the counsellor cancels', async () => {
		const onMove = page();
		let result: Promise<unknown> | undefined;
		act(() => {
			result = grid.onEntryMove?.(
				MOVED,
				at(14),
				at(15)
			) as Promise<unknown>;
		});
		await act(async () => {
			fireEvent.click(screen.getByTestId('calendar-move-cancel'));
			await result;
		});
		expect(await result).toBe(false);
		expect(onMove).not.toHaveBeenCalled();
		expect(screen.queryByText('calendar.moved')).toBeNull();
	});

	it('moves at once onto free time', async () => {
		const onMove = page();
		expect(await drag(MOVED, at(16), at(17))).toBe(true);
		expect(onMove).toHaveBeenCalledTimes(1);
	});
});
