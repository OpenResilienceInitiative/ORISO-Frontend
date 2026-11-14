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
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { allStored, CalendarPage } from './CalendarPage';
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
const mounts = vi.hoisted(() => ({ count: 0 }));
vi.mock('./CalendarView', async (importOriginal) => {
	const { useEffect } = await import('react');
	// The split view reuses the grid's helpers; only the grid is a stub.
	const actual = await importOriginal<typeof import('./CalendarView')>();
	return {
		...actual,
		CalendarView: (props: typeof grid) => {
			grid.onEntryMove = props.onEntryMove;
			useEffect(() => {
				mounts.count += 1;
			}, []);
			return <div data-testid="calendar-view" />;
		}
	};
});

/* The dialog stub hands out its save, so a test can save twice. */
const dialog: { save?: (draft: unknown) => void; close?: () => void } = {};
vi.mock('./AppointmentDialog', () => ({
	AppointmentDialog: (props: {
		onSave: (draft: unknown) => void;
		onClose: () => void;
	}) => {
		dialog.save = props.onSave;
		dialog.close = props.onClose;
		return <div data-testid="appointment-dialog" />;
	}
}));

afterEach(cleanup);

// jsdom has no element scrolling (the split view scrolls to the morning).
if (!HTMLElement.prototype.scrollTo)
	HTMLElement.prototype.scrollTo = () => undefined;

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

describe('CalendarPage — a failed load (review 4575159303)', () => {
	it('keeps the grid mounted through the failure, so the chosen view survives the retry', () => {
		mounts.count = 0;
		const { rerender } = page({ state: 'ready' });
		const at = (state: 'ready' | 'error') => (
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={new Date(2026, 10, 16, 9)}
				entries={[ENTRY]}
				state={state}
			/>
		);
		rerender(at('error'));
		expect(screen.getByRole('alert').textContent).toContain(
			'calendar.error.title'
		);
		rerender(at('ready'));
		expect(screen.getByTestId('calendar-view')).toBeTruthy();
		expect(mounts.count).toBe(1);
	});
});

describe('CalendarPage — creating (review 4575214168)', () => {
	const DRAFT = {
		type: 'appointment',
		kind: 'video',
		start: new Date(2026, 10, 17, 10),
		end: new Date(2026, 10, 17, 11),
		sessionId: 1
	};
	const openDialog = () =>
		fireEvent.click(
			document.querySelector('[data-cy="calendar-create"]') as HTMLElement
		);

	it('keeps the dialog open when saving fails', async () => {
		page({ onCreate: () => Promise.reject(new Error('500')) });
		openDialog();
		await act(async () => dialog.save?.(DRAFT));
		expect(screen.getByTestId('appointment-dialog')).toBeTruthy();
		expect(screen.getByText('calendar.saveFailed')).toBeTruthy();
	});

	it('keeps the dialog open when the host refuses', () => {
		page({ onCreate: () => false });
		openDialog();
		act(() => {
			dialog.save?.(DRAFT);
		});
		expect(screen.getByTestId('appointment-dialog')).toBeTruthy();
	});

	it('creates once while saving and closes once it is stored', async () => {
		let store: () => void = () => undefined;
		const onCreate = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					store = resolve;
				})
		);
		page({ onCreate });
		openDialog();
		act(() => {
			dialog.save?.(DRAFT);
		});
		act(() => {
			dialog.save?.(DRAFT);
		});
		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId('appointment-dialog')).toBeTruthy();
		await act(async () => store());
		await waitFor(() =>
			expect(screen.queryByTestId('appointment-dialog')).toBeNull()
		);
	});

	it('leaves a dialog opened while an earlier one was saving (review 4575868938)', async () => {
		let store: () => void = () => undefined;
		page({
			onCreate: () =>
				new Promise<void>((resolve) => {
					store = resolve;
				})
		});
		openDialog();
		act(() => {
			dialog.save?.(DRAFT);
		});
		// Cancelled while saving, and a new one opened.
		act(() => dialog.close?.());
		expect(screen.queryByTestId('appointment-dialog')).toBeNull();
		openDialog();
		await act(async () => store());
		expect(screen.getByTestId('appointment-dialog')).toBeTruthy();
	});

	it('leaves a dialog opened while a quick entry was saving (review 4575941071)', async () => {
		let store: () => void = () => undefined;
		const onCreate = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					store = resolve;
				})
		);
		page({
			onCreate,
			conversations: [{ sessionId: 4401, username: 'ruhiges_yak' }]
		});
		const input = document.querySelector(
			'[data-cy="calendar-quick-input"]'
		) as HTMLInputElement;
		fireEvent.change(input, {
			target: { value: 'morgen 14 Uhr Video ruhiges' }
		});
		await act(async () => {
			fireEvent.submit(input.form as HTMLFormElement);
		});
		expect(onCreate).toHaveBeenCalledTimes(1);
		openDialog();
		await act(async () => store());
		expect(screen.getByTestId('appointment-dialog')).toBeTruthy();
	});
});

describe('CalendarPage — the grid under a failed load (review 4575868941)', () => {
	it('takes the covered grid out of reach and keeps the retry outside it', () => {
		page({ state: 'error' });
		const covered = screen.getByTestId('calendar-covered');
		expect(covered.hasAttribute('inert')).toBe(true);
		expect(covered.contains(screen.getByTestId('calendar-view'))).toBe(
			true
		);
		const retry = screen.getByRole('button', {
			name: 'calendar.error.retry'
		});
		expect(covered.contains(retry)).toBe(false);
	});

	it('covers the split view and the banners as well (review 4575941073)', () => {
		page({
			state: 'error',
			initialView: 'split',
			conversationsFailed: true,
			onRetryConversations: vi.fn()
		});
		const covered = screen.getByTestId('calendar-covered');
		expect(covered.hasAttribute('inert')).toBe(true);
		expect(covered.querySelector('.calendarSplit')).not.toBeNull();
		expect(
			covered.contains(
				screen.getByTestId('calendar-conversations-failed')
			)
		).toBe(true);
		const retry = within(screen.getByTestId('calendar-error')).getByRole(
			'button',
			{ name: 'calendar.error.retry' }
		);
		expect(covered.contains(retry)).toBe(false);
	});

	it('gives the grid back once loaded', () => {
		page({ state: 'ready' });
		expect(
			screen.getByTestId('calendar-covered').hasAttribute('inert')
		).toBe(false);
	});
});

describe('CalendarPage — undo refused at once (review 4575297344)', () => {
	it('shows the failure notice when undo returns false', async () => {
		const onMove = vi
			.fn()
			.mockResolvedValueOnce(undefined)
			.mockReturnValueOnce(false);
		page({ onMove });
		await moveTo();
		fireEvent.click(await screen.findByTestId('calendar-undo'));
		expect(await screen.findByText('calendar.saveFailed')).toBeTruthy();
	});
});

describe('allStored — Undo of several changes (reviews 4575297339, 4575253325)', () => {
	it('reports a refused removal among several as not undone', async () => {
		expect(
			await allStored([Promise.resolve(), false, Promise.resolve(true)])
		).toBe(false);
		expect(await allStored([Promise.resolve(false), undefined])).toBe(
			false
		);
	});

	it('rejects when one restoration fails, so Undo says so', async () => {
		await expect(
			allStored([Promise.resolve(), Promise.reject(new Error('500'))])
		).rejects.toThrow('500');
	});

	it('is stored when every part is', async () => {
		expect(await allStored([Promise.resolve(), undefined, true])).toBe(
			true
		);
	});
});

describe('CalendarPage — a colleague calendar that did not load (review 4575917303)', () => {
	it('says whose calendar is missing, with a retry', () => {
		const onRetryColleagues = vi.fn();
		page({
			colleagues: [
				{ id: 'kaya', displayName: 'A. Kaya' },
				{ id: 'demir', displayName: 'E. Demir' }
			],
			initialShownColleagues: ['kaya', 'demir'],
			failedColleagues: ['kaya'],
			onRetryColleagues
		});
		const banner = screen.getByTestId('calendar-colleagues-failed');
		expect(banner.textContent).toContain('calendar.colleagueFailed');
		fireEvent.click(
			within(banner).getByRole('button', { name: 'calendar.error.retry' })
		);
		expect(onRetryColleagues).toHaveBeenCalledTimes(1);
	});

	it('says nothing for a colleague who is not shown', () => {
		page({
			colleagues: [{ id: 'kaya', displayName: 'A. Kaya' }],
			failedColleagues: ['kaya']
		});
		expect(screen.queryByTestId('calendar-colleagues-failed')).toBeNull();
	});
});
