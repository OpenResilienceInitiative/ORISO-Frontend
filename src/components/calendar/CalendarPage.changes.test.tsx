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
	/** The latest props, for what the page hands the grid. */
	last?: Record<string, unknown>;
	onEntryOpen?: (
		entry: CalendarEntry,
		anchor: HTMLElement,
		mode: 'list' | 'move'
	) => void;
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
			grid.last = props as Record<string, unknown>;
			grid.onEntryOpen = props.onEntryOpen;
			useEffect(() => {
				mounts.count += 1;
			}, []);
			return <div data-testid="calendar-view" />;
		}
	};
});

/* The dialog stub hands out its save, so a test can save twice, and what
   it was opened with. */
const dialog: {
	save?: (draft: unknown) => void;
	close?: () => void;
	props?: Record<string, unknown>;
} = {};
vi.mock('./NewEntryDialog', () => ({
	NewEntryDialog: (props: {
		onSaveAppointment: (draft: unknown) => void;
		onClose: () => void;
	}) => {
		dialog.save = props.onSaveAppointment;
		dialog.close = props.onClose;
		dialog.props = props as unknown as Record<string, unknown>;
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

describe('CalendarPage — creating onto own entries asks first (review 4582758042)', () => {
	/** Tomorrow 14:00 to 15:00 is taken. */
	const TAKEN: CalendarEntry = {
		...ENTRY,
		id: 'taken',
		start: new Date(2026, 10, 17, 14).toISOString(),
		end: new Date(2026, 10, 17, 15).toISOString()
	};
	const WEEK = [1, 2, 3, 4, 5].map((weekday) => ({
		weekday,
		start: '08:00',
		end: '18:00'
	}));
	const conversations = [{ sessionId: 4401, username: 'ruhiges_yak' }];
	const input = () =>
		document.querySelector(
			'[data-cy="calendar-quick-input"]'
		) as HTMLInputElement;
	const quick = async (line: string) => {
		fireEvent.change(input(), { target: { value: line } });
		await act(async () => {
			fireEvent.submit(input().form as HTMLFormElement);
		});
	};
	const question = () => screen.queryByTestId('calendar-create-conflict');

	it('quick entry onto a taken time asks first and saves only with "Trotzdem anlegen"', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		page({ onCreate, conversations, entries: [ENTRY, TAKEN] });
		await quick('morgen 14 Uhr Video ruhiges');

		expect(onCreate).not.toHaveBeenCalled();
		expect(question()?.textContent).toContain('calendar.dialog.conflict');
		expect(within(question()!).getByText('calendar.create')).toBeTruthy();
		expect(screen.getByTestId('calendar-create-anyway').textContent).toBe(
			'calendar.dialog.saveAnyway'
		);

		await act(async () => {
			fireEvent.click(screen.getByTestId('calendar-create-anyway'));
		});
		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(onCreate).toHaveBeenCalledWith([
			{
				type: 'appointment',
				kind: 'video',
				start: new Date(2026, 10, 17, 14),
				end: new Date(2026, 10, 17, 15),
				sessionId: 4401
			}
		]);
		expect(question()).toBeNull();
		// Saved: the draft goes.
		await waitFor(() => expect(input().value).toBe(''));
	});

	it('saves nothing when the question is cancelled, and keeps the draft', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		page({ onCreate, conversations, entries: [ENTRY, TAKEN] });
		await quick('morgen 14 Uhr Video ruhiges');
		await act(async () => {
			fireEvent.click(screen.getByTestId('calendar-create-cancel'));
		});

		expect(onCreate).not.toHaveBeenCalled();
		expect(question()).toBeNull();
		expect(input().value).toBe('morgen 14 Uhr Video ruhiges');
	});

	it('saves a free time without a question', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		page({ onCreate, conversations, entries: [ENTRY, TAKEN] });
		await quick('morgen 16 Uhr Video ruhiges');

		expect(question()).toBeNull();
		expect(onCreate).toHaveBeenCalledTimes(1);
	});

	it('asks when a suggested free hour is lengthened into a taken one; unchanged, it saves at once', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		const offered = async () => {
			fireEvent.change(input(), {
				target: { value: 'Video ruhiges' }
			});
			// The first free hour today ends where "mutige_eule" begins.
			fireEvent.click(
				document.querySelector(
					'[data-cy="calendar-quick-free"]'
				) as HTMLElement
			);
		};
		page({
			onCreate,
			conversations,
			now: new Date(2026, 10, 16, 8, 30),
			workingHours: WEEK
		});
		await offered();
		await act(async () => {
			fireEvent.submit(input().form as HTMLFormElement);
		});
		expect(question()).toBeNull();
		expect(onCreate).toHaveBeenCalledTimes(1);
		const [free] = (
			onCreate.mock.calls[0] as unknown as [{ start: Date; end: Date }[]]
		)[0];
		expect(free.end.getTime()).toBeLessThanOrEqual(
			new Date(ENTRY.start).getTime()
		);

		onCreate.mockClear();
		await waitFor(() => expect(input().value).toBe(''));
		await offered();
		fireEvent.mouseDown(
			screen.getByRole('combobox', { name: 'calendar.quick.duration' })
		);
		// 120 minutes reach into "mutige_eule".
		fireEvent.click((await screen.findAllByRole('option'))[4]);
		await act(async () => {
			fireEvent.submit(input().form as HTMLFormElement);
		});
		expect(onCreate).not.toHaveBeenCalled();
		expect(question()?.textContent).toContain('calendar.dialog.conflict');
	});

	it('does not ask again for a dialog save: the dialog has shown its own note', async () => {
		const onCreate = vi.fn(() => Promise.resolve());
		page({ onCreate, conversations, entries: [ENTRY, TAKEN] });
		fireEvent.click(
			document.querySelector('[data-cy="calendar-create"]') as HTMLElement
		);
		const onto = {
			type: 'appointment',
			kind: 'video',
			start: new Date(2026, 10, 17, 14),
			end: new Date(2026, 10, 17, 15),
			sessionId: 4401
		};
		// Not awaited: a second question would leave the save waiting.
		await act(async () => {
			dialog.save?.(onto);
		});

		expect(question()).toBeNull();
		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(onCreate).toHaveBeenCalledWith([onto]);
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

describe('CalendarPage — a colleague calendar still loading (review 4576313280)', () => {
	const ids = (key: string) =>
		((grid.last?.[key] as { id: string }[] | undefined) ?? []).map(
			(c) => c.id
		);

	it('leaves them out of the bands and says they are loading, without the failure banner', () => {
		page({
			colleagues: [
				{ id: 'kaya', displayName: 'A. Kaya' },
				{ id: 'demir', displayName: 'E. Demir' }
			],
			initialShownColleagues: ['kaya', 'demir'],
			loadingCalendars: ['kaya']
		});
		expect(ids('bandPeople')).toEqual(['demir']);
		expect(ids('loading')).toEqual(['kaya']);
		expect(ids('unavailable')).toEqual([]);
		expect(screen.queryByTestId('calendar-colleagues-failed')).toBeNull();
	});
});

describe("CalendarPage — one's own calendar still loading (review 4576368852)", () => {
	it('marks one\'s own column as loading in the split view, so nothing is "alle frei"', () => {
		page({ initialView: 'split', loadingCalendars: ['me'] });
		expect(screen.getByText('calendar.colleagueLoadingShort')).toBeTruthy();
		expect(screen.queryByTestId('calendar-colleagues-failed')).toBeNull();
	});
});

describe('CalendarPage — saved hours not loaded (review 4581640874)', () => {
	const freeSpans = () =>
		document.querySelectorAll('.calendarSplit__free').length;

	it('shows nothing as "alle frei" while the saved hours are unknown', () => {
		page({ initialView: 'split', workingHoursLoaded: false });
		expect(screen.getByTestId('calendar-split-view')).toBeTruthy();
		expect(freeSpans()).toBe(0);
	});

	it('still shows "alle frei" once they are in, also when none are saved', () => {
		page({ initialView: 'split', workingHoursLoaded: true });
		expect(freeSpans()).toBeGreaterThan(0);
	});
});

describe('CalendarPage — bands count what the kind filter hides (review 4576423989)', () => {
	it('hands the grid a hidden colleague blocker for the bands, not for display', async () => {
		const kayaCall: CalendarEntry = {
			id: 'kaya-call',
			type: 'appointment',
			kind: 'phone',
			start: new Date(2026, 10, 16, 10).toISOString(),
			end: new Date(2026, 10, 16, 12).toISOString(),
			ownerId: 'kaya'
		};
		const bergBlock: CalendarEntry = {
			id: 'berg-block',
			type: 'blocker',
			start: new Date(2026, 10, 16, 10).toISOString(),
			end: new Date(2026, 10, 16, 12).toISOString(),
			ownerId: 'berg'
		};
		page({
			entries: [ENTRY, kayaCall, bergBlock],
			colleagues: [
				{ id: 'kaya', displayName: 'A. Kaya' },
				{ id: 'berg', displayName: 'C. Berg' }
			],
			initialShownColleagues: ['kaya', 'berg']
		});
		const byCy = (name: string) =>
			document.querySelector(`[data-cy="${name}"]`) as HTMLElement | null;
		fireEvent.click(byCy('calendar-kinds-button') as HTMLElement);
		await waitFor(() =>
			expect(byCy('calendar-kinds-blocker')).not.toBeNull()
		);
		expect(
			byCy('calendar-kinds-button')?.querySelector(
				'.displayFilterButton__dot'
			)
		).toBeNull();
		fireEvent.click(byCy('calendar-kinds-blocker') as HTMLElement);
		// The search field's filter button carries the dot (prototype v17).
		await waitFor(() =>
			expect(
				byCy('calendar-kinds-button')?.querySelector(
					'.displayFilterButton__dot'
				)
			).not.toBeNull()
		);
		const ids = (key: string) =>
			((grid.last?.[key] as CalendarEntry[] | undefined) ?? []).map(
				(e) => e.id
			);
		await waitFor(() => expect(ids('entries')).not.toContain('berg-block'));
		expect(ids('entries')).toEqual(['a1', 'kaya-call']);
		expect(ids('busyEntries')).toEqual(['a1', 'kaya-call', 'berg-block']);
	});
});

describe('CalendarPage — a call whose conversation cannot be found (review 4577642137)', () => {
	it('says so instead of doing nothing', async () => {
		const onStart = vi.fn(() => Promise.reject(new Error('no room')));
		page({ onStart });
		act(() => grid.onEntryOpen?.(ENTRY, document.body, 'list'));
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-entry-start"]'
			) as HTMLElement
		);
		expect(onStart).toHaveBeenCalledWith(ENTRY);
		expect(
			await screen.findByText('calendar.chatUnavailable')
		).toBeTruthy();
	});
});

describe('CalendarPage — "Absagen" asks first (test C10)', () => {
	it('cancels only after the confirmation', async () => {
		const onCancelAppointment = vi.fn(() => Promise.resolve());
		page({ onCancelAppointment });
		act(() => grid.onEntryOpen?.(ENTRY, document.body, 'list'));
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-entry-cancel"]'
			) as HTMLElement
		);
		expect(onCancelAppointment).not.toHaveBeenCalled();
		expect(screen.getByText('calendar.cancelAsk.title')).toBeTruthy();
		fireEvent.click(screen.getByText('calendar.cancelAsk.keep'));
		expect(onCancelAppointment).not.toHaveBeenCalled();
		act(() => grid.onEntryOpen?.(ENTRY, document.body, 'list'));
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-entry-cancel"]'
			) as HTMLElement
		);
		fireEvent.click(screen.getByTestId('calendar-cancel-confirm'));
		expect(onCancelAppointment).toHaveBeenCalledWith(ENTRY);
		expect(await screen.findByText('calendar.cancelled')).toBeTruthy();
	});
});

describe('CalendarPage — "Zum Chat" whose conversation cannot be found (review 4577642137)', () => {
	it('says so from the menu, also when "Als Nächstes" opened it', async () => {
		const onOpenChat = vi.fn(() => Promise.reject(new Error('no room')));
		const withChat = { ...ENTRY, sessionId: 7 };
		page({ onOpenChat, entries: [withChat] });
		// No extra chat button beside the row (Frank *4).
		expect(
			document.querySelector(
				`[data-cy="calendar-upcoming-chat-${withChat.id}"]`
			)
		).toBeNull();
		fireEvent.click(
			document.querySelector(
				`[data-cy="calendar-upcoming-${withChat.id}"]`
			) as HTMLElement
		);
		fireEvent.click(
			(await waitFor(() => {
				const item = document.querySelector(
					'[data-cy="calendar-entry-chat"]'
				);
				expect(item).not.toBeNull();
				return item;
			})) as HTMLElement
		);
		expect(onOpenChat).toHaveBeenCalledWith(withChat);
		expect(
			await screen.findByText('calendar.chatUnavailable')
		).toBeTruthy();
		fireEvent.click(screen.getByLabelText('app.close'));
		act(() => grid.onEntryOpen?.(withChat, document.body, 'list'));
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-entry-chat"]'
			) as HTMLElement
		);
		expect(onOpenChat).toHaveBeenCalledTimes(2);
		expect(
			await screen.findByText('calendar.chatUnavailable')
		).toBeTruthy();
	});
});

describe('CalendarPage — the slot menu, prototype v17 (#115, #116)', () => {
	const byCy = (name: string) =>
		document.querySelector(`[data-cy="${name}"]`) as HTMLElement | null;
	const select = () =>
		act(() =>
			(
				grid.last?.onSelectRange as (
					range: { start: Date; end: Date },
					anchor: { x: number; y: number }
				) => void
			)({ start: START, end: END }, { x: 20, y: 20 })
		);

	it('asks "Mit wem?" in the same card and enters the appointment with the person picked', async () => {
		const onCreate = vi.fn(() => Promise.resolve([]));
		page({
			onCreate,
			conversations: [
				{ sessionId: 7, username: 'mutige_eule' },
				{ sessionId: 8, username: 'stiller_fuchs' }
			]
		});
		select();
		fireEvent.click(byCy('calendar-slot-phone') as HTMLElement);
		const search = byCy('calendar-slot-search') as HTMLInputElement;
		expect(search).not.toBeNull();
		expect(byCy('calendar-menu-slot')?.getAttribute('role')).toBe('dialog');
		fireEvent.change(search, { target: { value: 'stiller' } });
		expect(byCy('calendar-slot-person-7')).toBeNull();
		await act(async () => {
			fireEvent.click(byCy('calendar-slot-person-8') as HTMLElement);
		});
		expect(onCreate).toHaveBeenCalledWith([
			{
				type: 'appointment',
				start: START,
				end: END,
				kind: 'phone',
				sessionId: 8
			}
		]);
		expect(screen.queryByTestId('appointment-dialog')).toBeNull();
	});

	it('says when nobody matches and opens the full dialog from "Mehr Angaben …"', () => {
		page({ conversations: [{ sessionId: 7, username: 'mutige_eule' }] });
		select();
		fireEvent.click(byCy('calendar-slot-video') as HTMLElement);
		fireEvent.change(byCy('calendar-slot-search') as HTMLElement, {
			target: { value: 'niemand' }
		});
		expect(screen.getByText('calendar.slotMenu.noneFound')).toBeTruthy();
		fireEvent.click(byCy('calendar-slot-more') as HTMLElement);
		expect(screen.getByTestId('appointment-dialog')).toBeTruthy();
		expect(dialog.props?.initialTab).toBe('appointment');
		expect(dialog.props?.slot).toEqual({
			start: START,
			end: END,
			kind: 'video'
		});
	});

	it('"Wöchentlich …" takes the single blocker back and opens the blocker form with its weekday', async () => {
		const created: CalendarEntry = {
			id: 'b1',
			type: 'blocker',
			start: START.toISOString(),
			end: END.toISOString(),
			ownerId: 'me'
		};
		const removed: CalendarEntry[] = [];
		const onRemoveBlocker = vi.fn((entry: CalendarEntry) => {
			removed.push(entry);
			return Promise.resolve();
		});
		page({
			onCreate: () => Promise.resolve([created]),
			onRemoveBlocker
		});
		select();
		await act(async () => {
			fireEvent.click(byCy('calendar-slot-blocker') as HTMLElement);
		});
		expect(screen.getByText('calendar.blocker.createdSingle')).toBeTruthy();
		await act(async () => {
			fireEvent.click(await screen.findByTestId('calendar-weekly'));
		});
		expect(onRemoveBlocker).toHaveBeenCalledTimes(1);
		expect(removed).toEqual([created]);
		expect(dialog.props?.initialTab).toBe('blocker');
		expect(dialog.props?.slot).toEqual({ start: START, end: END });
		// 16 November 2026 is a Monday.
		expect(dialog.props?.initialWeekdays).toEqual([1]);
		expect(screen.queryByTestId('calendar-weekly')).toBeNull();
	});

	it('offers no "Wöchentlich …" for an appointment', async () => {
		page({
			onCreate: () => Promise.resolve([]),
			conversations: [{ sessionId: 7, username: 'mutige_eule' }]
		});
		select();
		fireEvent.click(byCy('calendar-slot-video') as HTMLElement);
		await act(async () => {
			fireEvent.click(byCy('calendar-slot-person-7') as HTMLElement);
		});
		expect(screen.getByText('calendar.created')).toBeTruthy();
		expect(screen.queryByTestId('calendar-weekly')).toBeNull();
	});
});

describe('CalendarPage — "Sperrzeit mit Wiederholung" in ⋮ (prototype v17, #122)', () => {
	it('opens the blocker tab of "Neuer Eintrag"', () => {
		page({ onCreate: () => Promise.resolve([]) });
		fireEvent.click(
			document.querySelector('[data-cy="calendar-settings"]') as Element
		);
		fireEvent.click(
			document.querySelector(
				'[data-cy="calendar-settings-repeat-blocker"]'
			) as Element
		);
		expect(screen.getByTestId('appointment-dialog')).toBeTruthy();
		expect(dialog.props?.initialTab).toBe('blocker');
		expect(dialog.props?.slot).toBeUndefined();
	});
});
