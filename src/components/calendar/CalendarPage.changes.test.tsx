// @vitest-environment oriso-jsdom
/**
 * What the page does with the result of a change callback: the grid puts a
 * refused or failed move back, and a failed undo says so (reviews
 * 4574504554, 4574493862, 4574504572). The grid is a stub that hands out
 * its callbacks.
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
	onEntryMove?: (
		entry: CalendarEntry,
		start: Date,
		end: Date
	) => unknown;
} = {};
vi.mock('./CalendarView', () => ({
	CalendarView: (props: typeof grid) => {
		grid.onEntryMove = props.onEntryMove;
		return <div data-testid="calendar-view" />;
	}
}));

afterEach(cleanup);

const ENTRY: CalendarEntry = {
	id: 'a1',
	type: 'appointment',
	kind: 'video',
	title: 'mutige_eule',
	start: new Date(2026, 10, 16, 10).toISOString(),
	end: new Date(2026, 10, 16, 11).toISOString(),
	ownerId: 'me'
};
const START = new Date(2026, 10, 16, 14);
const END = new Date(2026, 10, 16, 15);

const page = (props: Partial<React.ComponentProps<typeof CalendarPage>>) =>
	render(
		<CalendarPage
			role="consultant"
			ownerId="me"
			now={new Date(2026, 10, 16, 9)}
			entries={[ENTRY]}
			{...props}
		/>
	);

const moveTo = async () => {
	let result: unknown;
	await act(async () => {
		result = await grid.onEntryMove?.(ENTRY, START, END);
	});
	return result;
};

describe('CalendarPage — a move and its result', () => {
	it('tells the grid the move went through', async () => {
		page({ onMove: () => Promise.resolve() });
		expect(await moveTo()).toBe(true);
		expect(screen.getByText('calendar.moved')).toBeTruthy();
	});

	it('tells the grid to put the entry back when saving fails', async () => {
		page({ onMove: () => Promise.reject(new Error('500')) });
		expect(await moveTo()).toBe(false);
		expect(screen.getByText('calendar.saveFailed')).toBeTruthy();
	});

	it('tells the grid to put the entry back when the move is refused', async () => {
		page({ onMove: () => false });
		expect(await moveTo()).toBe(false);
		expect(screen.queryByText('calendar.moved')).toBeNull();
	});
});

describe('CalendarPage — undo', () => {
	it('shows the failure notice when undoing fails', async () => {
		const onMove = vi
			.fn()
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('500'));
		page({ onMove });
		await moveTo();
		await act(async () => {
			fireEvent.click(
				document.querySelector(
					'[data-testid="calendar-undo"]'
				) as HTMLElement
			);
		});
		expect(onMove).toHaveBeenCalledTimes(2);
		expect(onMove.mock.calls[1][1]).toEqual(new Date(ENTRY.start));
		expect(screen.getByText('calendar.saveFailed')).toBeTruthy();
	});

	it('closes the notice when undoing works', async () => {
		page({ onMove: () => Promise.resolve() });
		await moveTo();
		await act(async () => {
			fireEvent.click(
				document.querySelector(
					'[data-testid="calendar-undo"]'
				) as HTMLElement
			);
		});
		expect(screen.queryByText('calendar.moved')).toBeNull();
		expect(screen.queryByText('calendar.saveFailed')).toBeNull();
	});
});

describe('CalendarPage — loading and lookups', () => {
	it('keeps the grid mounted under the spinner while loading (review 4574493856)', () => {
		page({ state: 'loading' });
		expect(screen.getByTestId('calendar-view')).toBeTruthy();
		expect(screen.getByTestId('calendar-loading')).toBeTruthy();
	});

	it('says when the conversations could not be loaded, with a retry (review 4574493869)', () => {
		const onRetryConversations = vi.fn();
		page({ conversationsFailed: true, onRetryConversations });
		const banner = screen.getByTestId('calendar-conversations-failed');
		expect(banner.textContent).toContain('calendar.conversationsFailed');
		fireEvent.click(screen.getByText('calendar.error.retry'));
		expect(onRetryConversations).toHaveBeenCalledTimes(1);
	});
});
