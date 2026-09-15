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
import { notificationSettingsStore } from '../../utils/notificationSettings/store';
import { setKindField } from '../../utils/notificationSettings/notificationConfig';
import { __resetSoundThrottlesForTests } from '../../utils/notificationSettings/soundPlayback';

const apiGetEventNotifications = vi.fn();
const apiMarkEventNotificationRead = vi.fn(() => Promise.resolve());

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
			<button onClick={context.refreshNotificationFeed}>refresh</button>
		</>
	);
};

const ReadAccountingProbe = () => {
	const context = useContext(NotificationsContext)!;
	return (
		<>
			<div data-testid="unread-count">
				{context.unreadNotificationCount}
			</div>
			<div data-testid="read-state">
				{context.notificationFeed
					.map(
						(item) =>
							`${item.id}:${item.readAt ? 'read' : 'unread'}`
					)
					.join(',')}
			</div>
			<button
				onClick={() =>
					context.addEventNotification({
						eventType: 'message.new',
						title: 'Local',
						text: ''
					})
				}
			>
				add-local
			</button>
			<button onClick={context.refreshNotificationFeed}>refresh</button>
			<button
				onClick={() =>
					context.markNotificationAsRead(
						context.notificationFeed.find((item) =>
							item.id.startsWith('local-')
						)!.id
					)
				}
			>
				read-local
			</button>
			<button onClick={() => context.markNotificationAsRead('1')}>
				read-one
			</button>
			<button
				onClick={() => {
					context.markNotificationAsRead('1');
					context.markNotificationAsRead('1');
				}}
			>
				read-one-twice
			</button>
			<button onClick={() => context.markNotificationAsRead('2')}>
				read-two
			</button>
			<button onClick={() => context.markNotificationAsRead('unknown')}>
				read-unknown
			</button>
		</>
	);
};

vi.mock('../../api/apiEventNotifications', () => ({
	apiGetEventNotifications: (...args: unknown[]) =>
		apiGetEventNotifications(...args),
	apiMarkEventNotificationRead: (...args: unknown[]) =>
		apiMarkEventNotificationRead(...args),
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

	it('refreshes enquiry lists for a newly submitted request below another event without a feed loop', async () => {
		const listRefresh = vi.fn();
		const listener = (event) => {
			if (event.refreshEnquiryList) listRefresh();
		};
		messageEventEmitter.on(listener);
		try {
			render(
				<NotificationsProvider>
					<PaginationProbe />
				</NotificationsProvider>
			);
			await waitFor(() =>
				expect(apiGetEventNotifications).toHaveBeenCalledTimes(1)
			);
			apiGetEventNotifications.mockResolvedValue({
				items: [
					feedItem(3, '2026-09-14T12:00:02Z'),
					{
						...feedItem(2, '2026-09-14T12:00:01Z'),
						eventType: 'request.new'
					}
				],
				unreadCount: 2
			});
			fireEvent.click(screen.getByText('refresh'));
			await waitFor(() => expect(listRefresh).toHaveBeenCalledTimes(1));
			await new Promise((resolve) => setTimeout(resolve, 500));
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(2);
			fireEvent.click(screen.getByText('refresh'));
			await waitFor(() =>
				expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
			);
			expect(listRefresh).toHaveBeenCalledTimes(1);
		} finally {
			messageEventEmitter.off(listener);
		}
	});

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

		// The client's own Matrix sync re-emits room events on
		// messageEventEmitter (there is no backend live push, see #845);
		// any such signal must refresh the feed ahead of the 15s poll.
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

describe('NotificationsProvider announcements', () => {
	const banners = vi.fn();
	const play = vi.fn(() => Promise.resolve());
	beforeEach(() => {
		apiGetEventNotifications.mockReset();
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
		banners.mockClear();
		play.mockClear();
		localStorage.clear();
		localStorage.setItem(
			'BROWSER_NOTIFICATIONS',
			JSON.stringify({
				enabled: true,
				initialEnquiry: true,
				newMessage: true
			})
		);
		notificationSettingsStore.resetForTests();
		__resetSoundThrottlesForTests();
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				notificationSettingsStore.getState().settings
					.notificationConfig,
				'requests',
				'new',
				'sound',
				'chime'
			)
		});
		vi.stubGlobal(
			'Notification',
			class {
				static permission = 'granted';
				static requestPermission = vi.fn();
				constructor(title: string, options: NotificationOptions) {
					banners(title, options);
				}
			}
		);
		vi.stubGlobal(
			'Audio',
			class {
				play = play;
			}
		);
	});
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		notificationSettingsStore.resetForTests();
	});

	it.each([false, true])(
		'only announces the matching incoming event before initialization (own=%s)',
		async (isOwnMessage) => {
			notificationSettingsStore.updateSettings({
				notificationConfig: setKindField(
					notificationSettingsStore.getState().settings
						.notificationConfig,
					'conversations',
					'standard',
					'sound',
					'chime'
				)
			});
			let resolveFeed!: (value: unknown) => void;
			apiGetEventNotifications.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveFeed = resolve;
				})
			);
			render(
				<NotificationsProvider>
					<PaginationProbe />
				</NotificationsProvider>
			);
			messageEventEmitter.emit({
				roomId: '!room',
				matrixEventId: '$live',
				isOwnMessage
			});
			resolveFeed({
				items: [
					{
						...feedItem(2, '2026-09-14T12:00:02Z'),
						params: { matrixEventId: '$backlog' }
					},
					{
						...feedItem(1, '2026-09-14T12:00:01Z'),
						params: { matrixEventId: '$live' }
					}
				],
				unreadCount: 2
			});
			await waitFor(() =>
				expect(screen.getByTestId('ids').textContent).toBe('2,1')
			);
			expect(banners).toHaveBeenCalledTimes(isOwnMessage ? 0 : 1);
			expect(play).toHaveBeenCalledTimes(isOwnMessage ? 0 : 1);
		}
	);

	it('announces each new request once, keeps private text out of banners and never replays the initial backlog', async () => {
		const old = {
			...feedItem(1, '2026-09-14T12:00:00Z'),
			eventType: 'request.new'
		};
		apiGetEventNotifications.mockResolvedValue({
			items: [old],
			unreadCount: 1
		});
		render(
			<NotificationsProvider>
				<PaginationProbe />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(screen.getByTestId('ids').textContent).toBe('1')
		);
		expect(banners).not.toHaveBeenCalled();
		expect(play).not.toHaveBeenCalled();
		apiGetEventNotifications.mockResolvedValue({
			items: [
				{
					...old,
					id: 3,
					createdAt: '2026-09-14T12:00:02Z',
					text: 'PRIVATE ENQUIRY'
				},
				{ ...old, id: 2, createdAt: '2026-09-14T12:00:01Z' },
				old
			],
			unreadCount: 3
		});
		fireEvent.click(screen.getByText('refresh'));
		await waitFor(() => expect(banners).toHaveBeenCalledTimes(2));
		expect(play).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(banners.mock.calls)).not.toContain(
			'PRIVATE ENQUIRY'
		);
		fireEvent.click(screen.getByText('refresh'));
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
		);
		expect(banners).toHaveBeenCalledTimes(2);
		expect(play).toHaveBeenCalledTimes(1);
	});

	it.each([
		['banner off', false, 'off', 1],
		['muted', true, 'temporary', 0]
	] as const)(
		'keeps the feed usable with %s',
		async (_label, globalMute, banner, sounds) => {
			notificationSettingsStore.updateSettings({
				globalMute,
				notificationConfig: setKindField(
					notificationSettingsStore.getState().settings
						.notificationConfig,
					'requests',
					'new',
					'banner',
					banner
				)
			});
			render(
				<NotificationsProvider>
					<PaginationProbe />
				</NotificationsProvider>
			);
			await waitFor(() =>
				expect(apiGetEventNotifications).toHaveBeenCalledTimes(1)
			);
			apiGetEventNotifications.mockResolvedValue({
				items: [
					{
						...feedItem(1, '2026-09-14T12:00:00Z'),
						eventType: 'request.new'
					}
				],
				unreadCount: 1
			});
			fireEvent.click(screen.getByText('refresh'));
			await waitFor(() =>
				expect(screen.getByTestId('ids').textContent).toBe('1')
			);
			expect(banners).not.toHaveBeenCalled();
			expect(play).toHaveBeenCalledTimes(sounds);
		}
	);

	it('still displays the new feed when the browser cannot construct a notification', async () => {
		vi.stubGlobal(
			'Notification',
			class {
				static permission = 'granted';
				static requestPermission = vi.fn();
				constructor() {
					throw new Error('Notification constructor unavailable');
				}
			}
		);
		render(
			<NotificationsProvider>
				<PaginationProbe />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(1)
		);
		apiGetEventNotifications.mockResolvedValue({
			items: [
				{
					...feedItem(1, '2026-09-14T12:00:00Z'),
					eventType: 'request.new'
				}
			],
			unreadCount: 1
		});
		fireEvent.click(screen.getByText('refresh'));
		await waitFor(() =>
			expect(screen.getByTestId('ids').textContent).toBe('1')
		);
	});
});

describe('NotificationsProvider read accounting', () => {
	beforeEach(() => {
		apiGetEventNotifications.mockReset();
		apiMarkEventNotificationRead.mockClear();
	});
	afterEach(() => cleanup());

	it('counts unread local rows across server polls without subtracting server rows on local read', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [feedItem(1, '2026-09-12T10:00:00Z')],
			unreadCount: 7
		});
		render(
			<NotificationsProvider>
				<ReadAccountingProbe />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(screen.getByTestId('unread-count').textContent).toBe('7')
		);
		fireEvent.click(screen.getByText('add-local'));
		expect(screen.getByTestId('unread-count').textContent).toBe('8');
		fireEvent.click(screen.getByText('refresh'));
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(2)
		);
		expect(screen.getByTestId('unread-count').textContent).toBe('8');
		fireEvent.click(screen.getByText('read-local'));
		expect(screen.getByTestId('unread-count').textContent).toBe('7');
	});

	it('decrements once when the same unread row is marked twice in one React batch', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [
				feedItem(1, '2026-09-12T10:00:00.000Z'),
				feedItem(2, '2026-09-12T09:00:00.000Z')
			],
			unreadCount: 2
		});
		render(
			<NotificationsProvider>
				<ReadAccountingProbe />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(screen.getByTestId('unread-count').textContent).toBe('2')
		);

		fireEvent.click(screen.getByText('read-one-twice'));

		expect(screen.getByTestId('unread-count').textContent).toBe('1');
		expect(screen.getByTestId('read-state').textContent).toBe(
			'1:read,2:unread'
		);
	});

	it('does not decrement for an unknown id or an already-read row', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [
				{
					...feedItem(1, '2026-09-12T10:00:00.000Z'),
					readAt: '2026-09-12T10:30:00.000Z'
				},
				feedItem(2, '2026-09-12T09:00:00.000Z')
			],
			unreadCount: 7
		});
		render(
			<NotificationsProvider>
				<ReadAccountingProbe />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(screen.getByTestId('unread-count').textContent).toBe('7')
		);

		fireEvent.click(screen.getByText('read-one'));
		fireEvent.click(screen.getByText('read-unknown'));

		expect(screen.getByTestId('unread-count').textContent).toBe('7');
		expect(screen.getByTestId('read-state').textContent).toBe(
			'1:read,2:unread'
		);
		expect(apiMarkEventNotificationRead).toHaveBeenCalledWith('unknown');
	});

	it('decrements the server total for each different unread row that transitions', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [
				feedItem(1, '2026-09-12T10:00:00.000Z'),
				feedItem(2, '2026-09-12T09:00:00.000Z')
			],
			unreadCount: 9
		});
		render(
			<NotificationsProvider>
				<ReadAccountingProbe />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(screen.getByTestId('unread-count').textContent).toBe('9')
		);

		fireEvent.click(screen.getByText('read-one'));
		fireEvent.click(screen.getByText('read-two'));

		expect(screen.getByTestId('unread-count').textContent).toBe('7');
		expect(screen.getByTestId('read-state').textContent).toBe(
			'1:read,2:read'
		);
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
		expect(apiGetEventNotifications).toHaveBeenLastCalledWith(1, 50, []);
		const ids = screen.getByTestId('ids').textContent!.split(',');
		expect(ids).toHaveLength(52);
		expect(ids.slice(-3)).toEqual(['50', '51', '52']);
	});

	// Named for what it asserts: the provider's state machine. The accessible
	// error affordance itself is rendered by NotificationsCenter and belongs in
	// that component's tests, not here.
	it('exposes a retryable error state without discarding loaded items', async () => {
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
		// Wait on the pagination state, not on a boolean: `waitFor` resolves as
		// soon as its callback stops throwing, and `getByTestId('ids')` finds
		// the probe on the very first render. The click below could therefore
		// run before page 0 arrived, while `hasOlderNotifications` was still
		// false — `loadOlderNotifications` would return early and the rejected
		// mock would be consumed by the retry instead.
		await waitFor(() =>
			expect(screen.getByTestId('pagination-state').textContent).toBe(
				'more'
			)
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
		expect(apiGetEventNotifications).toHaveBeenLastCalledWith(1, 50, []);
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
		// The provider debounces this refresh by 400ms and the test runs on
		// real timers, so waitFor's 1s default leaves too little room on a
		// loaded CI runner.
		await waitFor(() => expect(pageZeroCalls).toBe(2), { timeout: 3000 });

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
