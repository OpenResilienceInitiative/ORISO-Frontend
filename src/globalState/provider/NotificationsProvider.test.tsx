// @vitest-environment jsdom
import React, { useContext } from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	NotificationsContext,
	NotificationsProvider
} from './NotificationsProvider';
import { messageEventEmitter } from '../../services/messageEventEmitter';

const apiGetEventNotifications = vi.fn();

const feedItem = (id: number, createdAt: string) => ({
	id,
	eventType: 'message.new',
	category: 'message' as const,
	title: '',
	text: '',
	createdAt,
	readAt: null
});

const PaginationProbe = () => {
	const context = useContext(NotificationsContext)!;
	return (
		<>
			<div data-testid="ids">
				{context.notificationFeed.map((item) => item.id).join(',')}
			</div>
			<div data-testid="pagination-state">
				{context.isLoadingOlderNotifications
					? 'loading'
					: context.olderNotificationsError
						? 'error'
						: context.hasOlderNotifications
							? 'more'
							: 'end'}
			</div>
			<button onClick={() => void context.loadOlderNotifications()}>
				load
			</button>
			<button onClick={context.clearNotificationFeed}>clear</button>
		</>
	);
};

vi.mock('../../api/apiEventNotifications', () => ({
	apiGetEventNotifications: (...args: unknown[]) =>
		apiGetEventNotifications(...args),
	apiMarkEventNotificationRead: vi.fn(),
	apiMarkAllEventNotificationsRead: vi.fn(),
	apiClearEventNotifications: vi.fn(() => Promise.resolve())
}));

vi.mock('../../components/sessionCookie/accessSessionCookie', () => ({
	getValueFromCookie: () => 'fake-token'
}));

describe('NotificationsProvider real-time refresh (#473)', () => {
	beforeEach(() => {
		apiGetEventNotifications.mockReset();
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
	});

	// The provider subscribes to a singleton emitter — unmount it between cases so
	// stale listeners don't fire on the next test's emit.
	afterEach(() => cleanup());

	it('refetches the feed when a live directMessage event fires, without waiting for the 15s poll', async () => {
		render(
			<NotificationsProvider>
				<div />
			</NotificationsProvider>
		);

		// Initial mount fetch — let it settle, then isolate the live-event refetch.
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalled()
		);
		apiGetEventNotifications.mockClear();

		// The backend fires a `directMessage` live event to the recipient whenever a
		// notification is persisted; the websocket handler re-emits it on messageEventEmitter.
		messageEventEmitter.emit({});

		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(1)
		);
	});

	it('collapses a burst of live events into a single debounced refetch', async () => {
		render(
			<NotificationsProvider>
				<div />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalled()
		);
		apiGetEventNotifications.mockClear();

		messageEventEmitter.emit({});
		messageEventEmitter.emit({});
		messageEventEmitter.emit({});

		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(1)
		);
		// Give any un-debounced extra calls a chance to (wrongly) fire.
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(apiGetEventNotifications).toHaveBeenCalledTimes(1);
	});
});

describe('NotificationsProvider older activity pages (#930)', () => {
	beforeEach(() => apiGetEventNotifications.mockReset());
	afterEach(() => cleanup());

	it('appends older pages with stable id deduplication and deterministic order', async () => {
		const newestPage = Array.from({ length: 50 }, (_, index) =>
			feedItem(
				index + 1,
				new Date(Date.UTC(2026, 0, 1, 0, 0, 100 - index)).toISOString()
			)
		);
		apiGetEventNotifications
			.mockResolvedValueOnce({ items: newestPage, unreadCount: 50 })
			.mockResolvedValueOnce({
				items: [
					newestPage[49],
					feedItem(51, '2025-12-31T23:59:00.000Z'),
					feedItem(52, '2025-12-31T23:58:00.000Z')
				],
				unreadCount: 52
			});

		render(
			<NotificationsProvider>
				<PaginationProbe />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(screen.getByTestId('pagination-state').textContent).toBe(
				'more'
			)
		);

		fireEvent.click(screen.getByText('load'));

		await waitFor(() =>
			expect(screen.getByTestId('pagination-state').textContent).toBe(
				'end'
			)
		);
		expect(apiGetEventNotifications).toHaveBeenLastCalledWith(1, 50);
		const ids = screen.getByTestId('ids').textContent!.split(',');
		expect(ids).toHaveLength(52);
		expect(ids.slice(-3)).toEqual(['50', '51', '52']);
	});

	it('exposes an accessible retryable error without discarding loaded items', async () => {
		const newestPage = Array.from({ length: 50 }, (_, index) =>
			feedItem(index + 1, new Date(100 - index).toISOString())
		);
		apiGetEventNotifications
			.mockResolvedValueOnce({ items: newestPage, unreadCount: 50 })
			.mockRejectedValueOnce(new Error('temporary'))
			.mockResolvedValueOnce({
				items: [feedItem(51, new Date(1).toISOString())],
				unreadCount: 51
			});
		render(
			<NotificationsProvider>
				<PaginationProbe />
			</NotificationsProvider>
		);
		await waitFor(() =>
			screen.getByTestId('ids').textContent?.includes('50')
		);

		fireEvent.click(screen.getByText('load'));
		await waitFor(() =>
			expect(screen.getByTestId('pagination-state').textContent).toBe(
				'error'
			)
		);
		expect(screen.getByTestId('ids').textContent!.split(',')).toHaveLength(
			50
		);

		fireEvent.click(screen.getByText('load'));
		await waitFor(() =>
			expect(screen.getByTestId('pagination-state').textContent).toBe(
				'end'
			)
		);
		expect(screen.getByTestId('ids').textContent).toContain('51');
		expect(apiGetEventNotifications).toHaveBeenLastCalledWith(1, 50);
	});

	it('keeps a live prepend and an overlapping older page without duplicates', async () => {
		const newestPage = Array.from({ length: 50 }, (_, index) =>
			feedItem(index + 1, new Date(100 - index).toISOString())
		);
		let resolveOlder!: (value: unknown) => void;
		const olderPage = new Promise((resolve) => {
			resolveOlder = resolve;
		});
		let pageZeroCalls = 0;
		apiGetEventNotifications.mockImplementation((page: number) => {
			if (page === 1) return olderPage;
			pageZeroCalls += 1;
			return Promise.resolve({
				items:
					pageZeroCalls === 1
						? newestPage
						: [
								feedItem(999, new Date(200).toISOString()),
								...newestPage.slice(0, 49)
							],
				unreadCount: 51
			});
		});

		render(
			<NotificationsProvider>
				<PaginationProbe />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(screen.getByTestId('pagination-state').textContent).toBe(
				'more'
			)
		);
		fireEvent.click(screen.getByText('load'));
		messageEventEmitter.emit({});
		await waitFor(() => expect(pageZeroCalls).toBe(2));

		resolveOlder({
			items: [newestPage[49], feedItem(51, new Date(1).toISOString())],
			unreadCount: 52
		});
		await waitFor(() =>
			expect(screen.getByTestId('pagination-state').textContent).toBe(
				'end'
			)
		);

		const ids = screen.getByTestId('ids').textContent!.split(',');
		expect(ids[0]).toBe('999');
		expect(ids).toContain('51');
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('does not restore cleared items from an older-page request still in flight', async () => {
		const newestPage = Array.from({ length: 50 }, (_, index) =>
			feedItem(index + 1, new Date(100 - index).toISOString())
		);
		let resolveOlder!: (value: unknown) => void;
		apiGetEventNotifications
			.mockResolvedValueOnce({ items: newestPage, unreadCount: 50 })
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveOlder = resolve;
					})
			);
		render(
			<NotificationsProvider>
				<PaginationProbe />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(screen.getByTestId('pagination-state').textContent).toBe(
				'more'
			)
		);

		fireEvent.click(screen.getByText('load'));
		fireEvent.click(screen.getByText('clear'));
		resolveOlder({
			items: [feedItem(51, new Date(1).toISOString())],
			unreadCount: 51
		});

		await waitFor(() =>
			expect(screen.getByTestId('pagination-state').textContent).toBe(
				'end'
			)
		);
		expect(screen.getByTestId('ids').textContent).toBe('');
	});
});
