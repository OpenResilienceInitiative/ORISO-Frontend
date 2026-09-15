/**
 * #1377 slice 3 — NotificationsProvider with the display filter: the
 * auto-read pass (spec §6.1), the badge operands and the pending-read /
 * request-ordering rules (spec §6.3).
 *
 * @vitest-environment jsdom
 */

import React, { useContext } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	NotificationsContext,
	NotificationsProvider
} from './NotificationsProvider';
import { displayFilterStore } from '../../utils/displayFilter/store';
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

describe('NotificationsProvider × display filter (#1377)', () => {
	beforeEach(() => {
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
		await new Promise((resolve) => setTimeout(resolve, 400));
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
		await new Promise((resolve) => setTimeout(resolve, 400));
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
		await new Promise((resolve) => setTimeout(resolve, 400));
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
		await new Promise((resolve) => setTimeout(resolve, 400));
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
		patch.resolve({});
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(rows()).toBe('7:u');
		expect(screen.getByTestId('server-total').textContent).toBe('1');
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
		await new Promise((resolve) => setTimeout(resolve, 400));
		expect(apiMarkEventNotificationsReadByTypes).toHaveBeenCalledTimes(1);
	});
});
