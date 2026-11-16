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
	onEntryClick?: (entry: CalendarEntry) => void;
} = {};
const mounts = vi.hoisted(() => ({ count: 0 }));
vi.mock('./CalendarView', async () => {
	const { useEffect } = await import('react');
	return {
		CalendarView: (props: typeof grid) => {
			grid.onEntryMove = props.onEntryMove;
			grid.onEntryClick = props.onEntryClick;
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
		act(() => dialog.save?.(DRAFT));
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
		act(() => dialog.save?.(DRAFT));
		act(() => dialog.save?.(DRAFT));
		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId('appointment-dialog')).toBeTruthy();
		await act(async () => store());
		expect(screen.queryByTestId('appointment-dialog')).toBeNull();
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
});

describe('CalendarPage — failed conversation lookup for askers (review 4575917412)', () => {
	it('shows askers the failure with a retry that asks again', () => {
		const onRetryConversations = vi.fn();
		page({
			role: 'asker',
			conversationsFailed: true,
			onRetryConversations
		});
		const banner = screen.getByTestId('calendar-conversations-failed');
		expect(banner.textContent).toContain(
			'calendar.conversationsFailedAsker'
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'calendar.error.retry' })
		);
		expect(onRetryConversations).toHaveBeenCalledTimes(1);
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
		act(() => {
			fireEvent.click(
				document.querySelector(
					'[data-testid="calendar-undo"]'
				) as HTMLElement
			);
		});
		expect(screen.getByText('calendar.saveFailed')).toBeTruthy();
	});
});

describe('CalendarPage — a call whose conversation cannot be found (review 4577642137)', () => {
	it('says so instead of doing nothing', async () => {
		const onStart = vi.fn(() => Promise.reject(new Error('no room')));
		page({ onStart });
		act(() => grid.onEntryClick?.(ENTRY));
		fireEvent.click(screen.getByTestId('calendar-entry-start'));
		expect(onStart).toHaveBeenCalledWith(ENTRY);
		expect(await screen.findByText('calendar.chatUnavailable')).toBeTruthy();
	});
});
