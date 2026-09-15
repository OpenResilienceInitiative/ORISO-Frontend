/**
 * #1377 slice 3 — NotificationsProvider with the display filter: the
 * auto-read pass (spec §6.1), the badge operands and the pending-read /
 * request-ordering rules (spec §6.3).
 *
 * @vitest-environment jsdom
 */

import React, { useContext } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AUTO_READ_DEBOUNCE_MS,
	NotificationsContext,
	NotificationsProvider
} from './NotificationsProvider';
import { displayFilterStore, mirrorKey } from '../../utils/displayFilter/store';
import { DEFAULT_DISPLAY_FILTERS } from '../../utils/displayFilter/model';

const apiGetEventNotifications = vi.fn();
const apiMarkEventNotificationRead = vi.fn();
const apiMarkEventNotificationsReadByTypes = vi.fn();

vi.mock('../../api/apiEventNotifications', () => ({
	apiGetEventNotifications: (...args: unknown[]) =>
		apiGetEventNotifications(...args),
	apiMarkEventNotificationRead: (...args: unknown[]) =>
		apiMarkEventNotificationRead(...args),
	apiMarkEventNotificationsReadByTypes: (...args: unknown[]) =>
		apiMarkEventNotificationsReadByTypes(...args),
	apiMarkAllEventNotificationsRead: vi.fn(),
	apiClearEventNotifications: vi.fn(() => Promise.resolve())
}));

vi.mock('../../components/sessionCookie/accessSessionCookie', () => ({
	getValueFromCookie: () => 'fake-token'
}));

const item = (
	id: number,
	eventType: string,
	readAt: string | null = null,
	createdAt = new Date(1000 - id).toISOString()
) => ({
	id,
	eventType,
	category: 'system' as const,
	title: '',
	text: '',
	createdAt,
	readAt
});

/** A controllable request: resolve/reject it from the test. */
const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

const Probe = () => {
	const context = useContext(NotificationsContext)!;
	return (
		<>
			<div data-testid="rows">
				{context.notificationFeed
					.map((row) => `${row.id}:${row.readAt ? 'r' : 'u'}`)
					.join(',')}
			</div>
			<div data-testid="server-total">{context.serverUnreadTotal}</div>
			<div data-testid="badge">{context.visibleUnreadCount}</div>
			<div data-testid="hidden">{context.hiddenUnreadInLoadedPages}</div>
			<div data-testid="exact">
				{context.serverUnreadTotalExcludesHidden ? 'exact' : 'bound'}
			</div>
			<button onClick={() => void context.loadOlderNotifications()}>
				load
			</button>
			<button onClick={() => void context.refreshNotificationFeed()}>
				refresh
			</button>
			<button onClick={() => context.clearNotificationFeed()}>
				clear
			</button>
			<button onClick={() => context.markNotificationAsRead('1')}>
				read1
			</button>
			<button
				onClick={() =>
					context.addEventNotification({
						title: 'local',
						text: '',
						eventType: 'supervisor.added'
					})
				}
			>
				addLocal
			</button>
		</>
	);
};

/** Attach a synced fake client so writes are accepted. */
const attachStore = () => {
	const client = {
		getUserId: () => '@t:hs',
		getSyncState: () => 'PREPARED',
		getAccountData: () => ({ getContent: () => DEFAULT_DISPLAY_FILTERS }),
		setAccountData: vi.fn(() => Promise.resolve()),
		on: () => undefined,
		removeListener: () => undefined
	};
	displayFilterStore.attachClient(client as any);
};

const hideSystemAutoRead = {
	kinds: { system: { show: false, pill: false } },
	autoReadHidden: true
};

const renderProvider = () =>
	render(
		<NotificationsProvider>
			<Probe />
		</NotificationsProvider>
	);

const rows = () => screen.getByTestId('rows').textContent;

/** Advance the provider clock while React settles timer-driven updates. */
const advanceTimers = async (milliseconds: number) => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(milliseconds);
	});
};

/** RTL's real-timer polling cannot drive Vitest's fake clock. */
const waitFor = async (assertion: () => void) => {
	const pollingInterval = 50;
	const timeout = 1000;
	for (let elapsed = 0; ; elapsed += pollingInterval) {
		try {
			assertion();
			return;
		} catch (error) {
			if (elapsed >= timeout) {
				throw error;
			}
		}
		await advanceTimers(pollingInterval);
	}
};

describe('NotificationsProvider × display filter (#1377)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		apiGetEventNotifications.mockReset();
		apiMarkEventNotificationRead.mockReset();
		apiMarkEventNotificationsReadByTypes.mockReset();
		// Older server by default: the bulk endpoint does not exist.
		apiMarkEventNotificationsReadByTypes.mockRejectedValue({ status: 404 });
		displayFilterStore.resetForTests();
		localStorage.clear();
		attachStore();
	});
	afterEach(() => {
		cleanup();
		displayFilterStore.resetForTests();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('exposes the server total and the badge operands from one snapshot', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [
				item(1, 'message.new'),
				item(2, 'supervisor.added'),
				item(3, 'supervisor.added', 'x')
			],
			unreadCount: 7
		});
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u,2:u,3:r'));
		expect(screen.getByTestId('server-total').textContent).toBe('7');
		expect(screen.getByTestId('badge').textContent).toBe('7');
		act(() => {
			displayFilterStore.setSection('timeline', {
				...hideSystemAutoRead,
				autoReadHidden: false
			});
		});
		expect(screen.getByTestId('hidden').textContent).toBe('1');
		expect(screen.getByTestId('badge').textContent).toBe('6');
		expect(apiMarkEventNotificationRead).not.toHaveBeenCalled();
	});

	it('auto-read: one PATCH for the hidden server row, local row read locally, no retry', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new'), item(2, 'supervisor.added')],
			unreadCount: 2
		});
		apiMarkEventNotificationRead.mockResolvedValue({});
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u,2:u'));
		act(() => {
			screen.getByText('addLocal').click();
		});
		await waitFor(() => expect(rows()).toMatch(/^local-[^,]+:u,1:u,2:u$/));
		// From here the server answers with the row read (what the PATCH did).
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new'), item(2, 'supervisor.added', 'x')],
			unreadCount: 1
		});
		act(() => {
			displayFilterStore.setSection('timeline', hideSystemAutoRead);
		});
		await waitFor(() =>
			expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(1)
		);
		expect(apiMarkEventNotificationRead).toHaveBeenCalledWith('2');
		await waitFor(() => expect(rows()).toMatch(/^local-[^,]+:r,1:u,2:r$/));
		expect(screen.getByTestId('server-total').textContent).toBe('1');
		expect(screen.getByTestId('badge').textContent).toBe('1');
		// The next ordinary poll brings the same rows back read: no PATCH.
		const { messageEventEmitter } = await import(
			'../../services/messageEventEmitter'
		);
		messageEventEmitter.emit({});
		await waitFor(() =>
			expect(apiGetEventNotifications.mock.calls.length).toBeGreaterThan(
				2
			)
		);
		await advanceTimers(AUTO_READ_DEBOUNCE_MS);
		expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(1);
	});

	it('parks a poll that returns during a PATCH and applies the reconciliation fetch instead', async () => {
		const first = {
			items: [item(1, 'message.new'), item(2, 'supervisor.added')],
			unreadCount: 2
		};
		apiGetEventNotifications.mockResolvedValueOnce(first);
		const patch = deferred<unknown>();
		apiMarkEventNotificationRead.mockReturnValue(patch.promise);
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u,2:u'));
		act(() => {
			displayFilterStore.setSection('timeline', hideSystemAutoRead);
		});
		await waitFor(() =>
			expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(1)
		);
		// A poll started before the PATCH commits returns with the old state.
		const stale = deferred<unknown>();
		apiGetEventNotifications.mockReturnValueOnce(stale.promise);
		const reconciliation = deferred<unknown>();
		apiGetEventNotifications.mockReturnValueOnce(reconciliation.promise);
		// Force a refresh: emit through the interval would take 15s; call
		// the provider's refresh via the 400ms live-event debounce instead.
		const { messageEventEmitter } = await import(
			'../../services/messageEventEmitter'
		);
		messageEventEmitter.emit({});
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(2)
		);
		await act(async () => {
			stale.resolve({ ...first, unreadCount: 2 });
		});
		// Parked: the pre-read snapshot must not reach the feed.
		expect(rows()).toBe('1:u,2:u');
		expect(screen.getByTestId('server-total').textContent).toBe('2');
		await act(async () => {
			patch.resolve({});
		});
		await waitFor(() => expect(rows()).toBe('1:u,2:r'));
		expect(screen.getByTestId('server-total').textContent).toBe('1');
		// One reconciliation fetch was issued after the settlement …
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
		);
		await act(async () => {
			reconciliation.resolve({
				items: [
					item(1, 'message.new'),
					item(2, 'supervisor.added', 'x')
				],
				unreadCount: 1
			});
		});
		expect(rows()).toBe('1:u,2:r');
		expect(screen.getByTestId('server-total').textContent).toBe('1');
		// … and the row was never PATCHed twice.
		expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(1);
	});

	it('a persistently failing PATCH is retried once per ordinary poll, with no extra GET', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new'), item(2, 'supervisor.added')],
			unreadCount: 2
		});
		apiMarkEventNotificationRead.mockRejectedValue(new Error('500'));
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u,2:u'));
		const getsBefore = apiGetEventNotifications.mock.calls.length;
		act(() => {
			displayFilterStore.setSection('timeline', hideSystemAutoRead);
		});
		await waitFor(() =>
			expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(1)
		);
		await advanceTimers(AUTO_READ_DEBOUNCE_MS);
		// Failure → cooldown: no second PATCH and no reconciliation GET.
		expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(1);
		expect(apiGetEventNotifications.mock.calls.length).toBe(getsBefore);
		expect(rows()).toBe('1:u,2:u');
		expect(screen.getByTestId('server-total').textContent).toBe('2');
		// The next ordinary poll lifts the cooldown: exactly one more PATCH.
		const { messageEventEmitter } = await import(
			'../../services/messageEventEmitter'
		);
		messageEventEmitter.emit({});
		await waitFor(() =>
			expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(2)
		);
	});

	it('mixed batch: one reconciliation fetch, the failed row waits for the next poll', async () => {
		apiGetEventNotifications.mockResolvedValueOnce({
			items: [
				item(1, 'message.new'),
				item(2, 'supervisor.added'),
				item(3, 'supervisor.added')
			],
			unreadCount: 3
		});
		apiMarkEventNotificationRead.mockImplementation((id: string) =>
			id === '2' ? Promise.resolve({}) : Promise.reject(new Error('500'))
		);
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u,2:u,3:u'));
		apiGetEventNotifications.mockResolvedValue({
			items: [
				item(1, 'message.new'),
				item(2, 'supervisor.added', 'x'),
				item(3, 'supervisor.added')
			],
			unreadCount: 2
		});
		act(() => {
			displayFilterStore.setSection('timeline', hideSystemAutoRead);
		});
		await waitFor(() =>
			expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(2)
		);
		// Settlement with one success → exactly one reconciliation fetch …
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(2)
		);
		await waitFor(() => expect(rows()).toBe('1:u,2:r,3:u'));
		await advanceTimers(AUTO_READ_DEBOUNCE_MS);
		// … and the failed row is not re-PATCHed by it.
		expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(2);
		expect(apiGetEventNotifications).toHaveBeenCalledTimes(2);
		expect(screen.getByTestId('server-total').textContent).toBe('2');
	});

	it('two polls returning out of order: the newer wins, the older is discarded', async () => {
		const older = deferred<unknown>();
		const newer = deferred<unknown>();
		apiGetEventNotifications
			.mockReturnValueOnce(older.promise)
			.mockReturnValueOnce(newer.promise);
		renderProvider();
		const { messageEventEmitter } = await import(
			'../../services/messageEventEmitter'
		);
		messageEventEmitter.emit({});
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(2)
		);
		await act(async () => {
			newer.resolve({
				items: [item(1, 'message.new', 'x'), item(9, 'message.new')],
				unreadCount: 1
			});
		});
		await waitFor(() => expect(rows()).toBe('1:r,9:u'));
		await act(async () => {
			older.resolve({
				items: [item(1, 'message.new')],
				unreadCount: 5
			});
		});
		expect(rows()).toBe('1:r,9:u');
		expect(screen.getByTestId('server-total').textContent).toBe('1');
	});

	it('an older page contributes rows only; its total never replaces page 0’s', async () => {
		const pageZero = Array.from({ length: 50 }, (_, index) =>
			item(index + 1, 'message.new')
		);
		apiGetEventNotifications.mockImplementation((page: number) =>
			Promise.resolve(
				page === 0
					? { items: pageZero, unreadCount: 60 }
					: {
							items: [item(51, 'message.new', 'x')],
							unreadCount: 999
						}
			)
		);
		renderProvider();
		await waitFor(() =>
			expect(screen.getByTestId('server-total').textContent).toBe('60')
		);
		act(() => {
			screen.getByText('load').click();
		});
		await waitFor(() => expect(rows()).toContain('51:r'));
		expect(screen.getByTestId('server-total').textContent).toBe('60');
	});

	// ------------------------------------------------------------------
	// Slice 7: server-side exclusions and bulk read
	// ------------------------------------------------------------------

	it('asks the server to exclude the hidden event types and trusts an echoed total as exact', async () => {
		apiGetEventNotifications.mockImplementation(
			(_page: number, _perPage: number, exclude?: string[]) =>
				Promise.resolve({
					items: [
						item(1, 'message.new'),
						item(2, 'supervisor.added')
					],
					unreadCount: exclude && exclude.length > 0 ? 3 : 9,
					excludedEventTypes: exclude ? [...exclude].reverse() : []
				})
		);
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u,2:u'));
		expect(screen.getByTestId('exact').textContent).toBe('bound');
		expect(screen.getByTestId('badge').textContent).toBe('9');
		act(() => {
			displayFilterStore.setSection('timeline', {
				...hideSystemAutoRead,
				autoReadHidden: false
			});
		});
		const { messageEventEmitter } = await import(
			'../../services/messageEventEmitter'
		);
		messageEventEmitter.emit({});
		await waitFor(() =>
			expect(screen.getByTestId('exact').textContent).toBe('exact')
		);
		const lastCall = apiGetEventNotifications.mock.calls.at(-1)!;
		expect(lastCall[2]).toContain('supervisor.added');
		expect(lastCall[2]).not.toContain('message.new');
		// Exact: no subtraction of the loaded hidden row, no hint.
		expect(screen.getByTestId('badge').textContent).toBe('3');
		expect(screen.getByTestId('hidden').textContent).toBe('0');
	});

	it('an older server that ignores the parameter keeps the v1 upper bound', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new'), item(2, 'supervisor.added')],
			unreadCount: 9
		});
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u,2:u'));
		act(() => {
			displayFilterStore.setSection('timeline', {
				...hideSystemAutoRead,
				autoReadHidden: false
			});
		});
		const { messageEventEmitter } = await import(
			'../../services/messageEventEmitter'
		);
		messageEventEmitter.emit({});
		await waitFor(() =>
			expect(apiGetEventNotifications.mock.calls.length).toBeGreaterThan(
				1
			)
		);
		expect(screen.getByTestId('exact').textContent).toBe('bound');
		expect(screen.getByTestId('badge').textContent).toBe('8');
		expect(screen.getByTestId('hidden').textContent).toBe('1');
	});

	it('bulk read: one PATCH per filter change covers unloaded pages, then a reconciliation fetch', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new'), item(2, 'supervisor.added')],
			unreadCount: 40
		});
		apiMarkEventNotificationsReadByTypes.mockResolvedValue({ updated: 38 });
		apiMarkEventNotificationRead.mockResolvedValue({});
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u,2:u'));
		const getsBefore = apiGetEventNotifications.mock.calls.length;
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new'), item(2, 'supervisor.added', 'x')],
			unreadCount: 1,
			excludedEventTypes: []
		});
		act(() => {
			displayFilterStore.setSection('timeline', hideSystemAutoRead);
		});
		await waitFor(() =>
			expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(
				1
			)
		);
		expect(apiMarkEventNotificationsReadByTypes.mock.calls[0][0]).toContain(
			'supervisor.added'
		);
		// The settlement issued exactly one reconciliation fetch …
		await waitFor(() =>
			expect(apiGetEventNotifications.mock.calls.length).toBe(
				getsBefore + 1
			)
		);
		await waitFor(() => expect(rows()).toBe('1:u,2:r'));
		await advanceTimers(AUTO_READ_DEBOUNCE_MS);
		// … the same filter change does not PATCH again, and the loaded row
		// was covered by the bulk read, not PATCHed a second time per id.
		expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(1);
		expect(apiMarkEventNotificationRead).not.toHaveBeenCalled();
	});

	it("a feed reset drops pending-read bookkeeping: the next feed is not parked behind the old user's PATCH", async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new'), item(2, 'supervisor.added')],
			unreadCount: 2
		});
		const patch = deferred<unknown>();
		apiMarkEventNotificationRead.mockReturnValue(patch.promise);
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u,2:u'));
		act(() => {
			displayFilterStore.setSection('timeline', hideSystemAutoRead);
		});
		await waitFor(() =>
			expect(apiMarkEventNotificationRead).toHaveBeenCalledWith('2')
		);
		// Logout/clear while that PATCH is still in flight …
		act(() => {
			screen.getByText('clear').click();
		});
		await waitFor(() => expect(rows()).toBe(''));
		// … the next user's first page must apply, not park.
		act(() => {
			displayFilterStore.setSection('timeline', {
				kinds: {},
				autoReadHidden: false
			});
		});
		apiGetEventNotifications.mockResolvedValue({
			items: [item(7, 'message.new')],
			unreadCount: 1
		});
		act(() => {
			screen.getByText('refresh').click();
		});
		await waitFor(() => expect(rows()).toBe('7:u'));
		// The stale completion neither settles nor corrupts the new epoch.
		await act(async () => {
			patch.resolve({});
			await patch.promise;
		});
		expect(rows()).toBe('7:u');
		expect(screen.getByTestId('server-total').textContent).toBe('1');
	});

	it('no auto-read before the store is synced: a stale mirror must not read anything', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new'), item(2, 'supervisor.added')],
			unreadCount: 2
		});
		apiMarkEventNotificationRead.mockResolvedValue({});
		// Mirror says "hide system, auto-read", the client has not synced.
		displayFilterStore.resetForTests();
		localStorage.setItem(
			mirrorKey('@t:hs'),
			JSON.stringify({
				...DEFAULT_DISPLAY_FILTERS,
				sections: { timeline: hideSystemAutoRead }
			})
		);
		const handlers: Record<string, Array<(...args: any[]) => void>> = {};
		const unsynced = {
			getUserId: () => '@t:hs',
			getSyncState: () => null,
			getAccountData: () => ({
				getContent: () => DEFAULT_DISPLAY_FILTERS
			}),
			setAccountData: vi.fn(() => Promise.resolve()),
			on: (event: string, handler: (...args: any[]) => void) => {
				(handlers[event] ||= []).push(handler);
			},
			removeListener: () => undefined
		};
		displayFilterStore.attachClient(unsynced as any);
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u,2:u'));
		await advanceTimers(AUTO_READ_DEBOUNCE_MS);
		expect(apiMarkEventNotificationRead).not.toHaveBeenCalled();
		expect(apiMarkEventNotificationsReadByTypes).not.toHaveBeenCalled();
		// Account data (show everything) wins on sync: still nothing read.
		act(() => {
			(handlers.sync || []).forEach((h) => h('PREPARED', null));
		});
		await advanceTimers(AUTO_READ_DEBOUNCE_MS);
		expect(apiMarkEventNotificationRead).not.toHaveBeenCalled();
	});

	it('a filter changed while a bulk read is pending is not skipped: it runs once the first settles', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new')],
			unreadCount: 40,
			excludedEventTypes: []
		});
		const first = deferred<{ updated: number }>();
		apiMarkEventNotificationsReadByTypes
			.mockReturnValueOnce(first.promise)
			.mockResolvedValue({ updated: 2 });
		apiMarkEventNotificationRead.mockResolvedValue({});
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u'));
		act(() => {
			displayFilterStore.setSection('timeline', hideSystemAutoRead);
		});
		await waitFor(() =>
			expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(
				1
			)
		);
		act(() => {
			displayFilterStore.setSection('timeline', {
				kinds: {
					system: { show: false, pill: false },
					calls: { show: false, pill: false }
				},
				autoReadHidden: true
			});
		});
		await advanceTimers(AUTO_READ_DEBOUNCE_MS);
		expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(1);
		first.resolve({ updated: 38 });
		await waitFor(() =>
			expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(
				2
			)
		);
		expect(apiMarkEventNotificationsReadByTypes.mock.calls[1][0]).toContain(
			'call.started'
		);
	});

	it('an exact total is not reduced by the bulk read result', async () => {
		apiGetEventNotifications.mockImplementation(
			(_page: number, _perPage: number, exclude?: string[]) =>
				Promise.resolve({
					items: [item(1, 'message.new')],
					unreadCount: exclude && exclude.length > 0 ? 5 : 9,
					excludedEventTypes: exclude ? [...exclude] : []
				})
		);
		const bulk = deferred<{ updated: number }>();
		apiMarkEventNotificationsReadByTypes.mockReturnValue(bulk.promise);
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u'));
		// Exact total for "hide system" first (auto-read off).
		act(() => {
			displayFilterStore.setSection('timeline', {
				...hideSystemAutoRead,
				autoReadHidden: false
			});
		});
		const { messageEventEmitter } = await import(
			'../../services/messageEventEmitter'
		);
		messageEventEmitter.emit({});
		await waitFor(() =>
			expect(screen.getByTestId('exact').textContent).toBe('exact')
		);
		expect(screen.getByTestId('server-total').textContent).toBe('5');
		// The reconciliation fetch after the bulk read never returns, so a
		// wrong decrement would stay visible.
		apiGetEventNotifications.mockReturnValue(new Promise(() => undefined));
		act(() => {
			displayFilterStore.setSection('timeline', hideSystemAutoRead);
		});
		await waitFor(() =>
			expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(
				1
			)
		);
		bulk.resolve({ updated: 38 });
		await act(async () => {
			await bulk.promise;
		});
		expect(screen.getByTestId('server-total').textContent).toBe('5');
		expect(screen.getByTestId('badge').textContent).toBe('5');
	});

	it('marking an already-read card again does not lower the total twice', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new'), item(2, 'message.new')],
			unreadCount: 2
		});
		apiMarkEventNotificationRead.mockResolvedValue({});
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u,2:u'));
		act(() => {
			screen.getByText('read1').click();
		});
		await waitFor(() => expect(rows()).toBe('1:r,2:u'));
		expect(screen.getByTestId('server-total').textContent).toBe('1');
		act(() => {
			screen.getByText('read1').click();
		});
		await advanceTimers(0);
		expect(screen.getByTestId('server-total').textContent).toBe('1');
	});

	it('a failed bulk read is not retried in a loop: once per ordinary poll', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new')],
			unreadCount: 40,
			excludedEventTypes: []
		});
		apiMarkEventNotificationsReadByTypes.mockRejectedValue(
			new Error('CATCH_ALL')
		);
		apiMarkEventNotificationRead.mockResolvedValue({});
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u'));
		act(() => {
			displayFilterStore.setSection('timeline', hideSystemAutoRead);
		});
		await advanceTimers(AUTO_READ_DEBOUNCE_MS);
		await waitFor(() =>
			expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(
				1
			)
		);
		// Several debounce windows later: still one attempt.
		await advanceTimers(AUTO_READ_DEBOUNCE_MS * 4);
		expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(1);
		// The next ordinary poll grants exactly one retry.
		await advanceTimers(15000);
		await advanceTimers(AUTO_READ_DEBOUNCE_MS);
		await waitFor(() =>
			expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(
				2
			)
		);
		await advanceTimers(AUTO_READ_DEBOUNCE_MS * 4);
		expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(2);
	});

	it('a response for a previous exclusion set never makes the new set exact', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new')],
			unreadCount: 9,
			excludedEventTypes: []
		});
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u'));
		const late = deferred<unknown>();
		apiGetEventNotifications.mockReturnValueOnce(late.promise);
		act(() => {
			displayFilterStore.setSection('timeline', {
				...hideSystemAutoRead,
				autoReadHidden: false
			});
		});
		const { messageEventEmitter } = await import(
			'../../services/messageEventEmitter'
		);
		messageEventEmitter.emit({}); // request for set A, still in flight
		const requestedA = apiGetEventNotifications.mock.calls.at(-1)![2];
		act(() => {
			displayFilterStore.setSection('timeline', {
				kinds: {
					system: { show: false, pill: false },
					calls: { show: false, pill: false }
				},
				autoReadHidden: false
			}); // set B
		});
		late.resolve({
			items: [item(1, 'message.new')],
			unreadCount: 3,
			excludedEventTypes: [...requestedA]
		});
		await advanceTimers(0);
		await waitFor(() =>
			expect(screen.getByTestId('server-total').textContent).toBe('3')
		);
		expect(screen.getByTestId('exact').textContent).toBe('bound');
	});

	it('bulk read 404 marks the server as older and the per-id path still runs', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new'), item(2, 'supervisor.added')],
			unreadCount: 2
		});
		apiMarkEventNotificationRead.mockResolvedValue({});
		renderProvider();
		await waitFor(() => expect(rows()).toBe('1:u,2:u'));
		apiGetEventNotifications.mockResolvedValue({
			items: [item(1, 'message.new'), item(2, 'supervisor.added', 'x')],
			unreadCount: 1
		});
		act(() => {
			displayFilterStore.setSection('timeline', hideSystemAutoRead);
		});
		await waitFor(() =>
			expect(apiMarkEventNotificationRead).toHaveBeenCalledWith('2')
		);
		expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(rows()).toBe('1:u,2:r'));
		// A second filter change: no further bulk attempt after the 404.
		act(() => {
			displayFilterStore.setSection('timeline', {
				kinds: {
					system: { show: false, pill: false },
					calls: { show: false, pill: false }
				},
				autoReadHidden: true
			});
		});
		await advanceTimers(AUTO_READ_DEBOUNCE_MS);
		expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(1);
	});
});
