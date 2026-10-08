// @vitest-environment jsdom
import React, { useContext } from 'react';
import i18n from 'i18next';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';
import { MarkAllReadButton } from '../../components/notificationsCenter/MarkAllReadButton';
import {
	act,
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
const apiMarkAllEventNotificationsRead = vi.fn(() => Promise.resolve());
const apiClearEventNotifications = vi.fn(() => Promise.resolve());
const deferred = () => {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
};
const authSession = vi.hoisted(() => ({
	token: 'fake-token' as string | null
}));

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

const ConfirmedReadProbe = () => {
	const context = useContext(NotificationsContext)!;
	return (
		<button
			onClick={() => void context.markNotificationsReadConfirmed(['1'])}
		>
			confirmed-read
		</button>
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
			<MarkAllReadButton
				hasUnread={context.hasUnreadNotifications}
				onClick={context.markAllNotificationsAsRead}
				label="read-all"
				busy={context.isMarkingAllRead || context.isClearingFeed}
			/>
			<div data-testid="mutation-status">
				{String(context.isMarkingAllRead)}:
				{String(context.isClearingFeed)}
			</div>
			<div data-testid="feedback">
				{JSON.stringify(context.notifications)}
			</div>
			<button onClick={context.clearNotificationFeed}>clear</button>
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
	apiMarkAllEventNotificationsRead: (...args: unknown[]) =>
		apiMarkAllEventNotificationsRead(...args),
	apiClearEventNotifications: (...args: unknown[]) =>
		apiClearEventNotifications(...args)
}));

vi.mock('../../components/sessionCookie/accessSessionCookie', () => ({
	AUTH_SESSION_CHANGE_EVENT: 'oriso:auth-session-change',
	getValueFromCookie: () => authSession.token
}));

describe('NotificationsProvider real-time refresh (#473)', () => {
	beforeEach(() => {
		authSession.token = 'fake-token';
		apiGetEventNotifications.mockReset();
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
	});

	it('drops the feed immediately when the auth session is cleared', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [feedItem(1, '2026-09-17T10:00:00Z')],
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

		authSession.token = null;
		window.dispatchEvent(new Event('oriso:auth-session-change'));

		await waitFor(() =>
			expect(screen.getByTestId('ids').textContent).toBe('')
		);
	});

	// The provider subscribes to a singleton emitter — unmount it between cases so
	// stale listeners don't fire on the next test's emit.
	afterEach(() => cleanup());

	it('reconciles a finished conversation in the first feed after the list loaded', async () => {
		apiGetEventNotifications.mockResolvedValue({
			items: [
				{
					...feedItem(1, '2026-10-06T12:00:00Z'),
					eventType: 'conversation.finished'
				}
			],
			unreadCount: 1
		});
		const listRefresh = vi.fn();
		messageEventEmitter.on(listRefresh);
		try {
			render(
				<NotificationsProvider>
					<PaginationProbe />
				</NotificationsProvider>
			);
			await waitFor(() =>
				expect(listRefresh).toHaveBeenCalledWith({
					refreshEnquiryList: true,
					refreshSessionList: true,
					source: 'notification-feed'
				})
			);
			expect(listRefresh).toHaveBeenCalledTimes(1);
			fireEvent.click(screen.getByText('refresh'));
			await waitFor(() =>
				expect(apiGetEventNotifications).toHaveBeenCalledTimes(2)
			);
			expect(listRefresh).toHaveBeenCalledTimes(1);
		} finally {
			messageEventEmitter.off(listRefresh);
		}
	});

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

	it('reconciles a newly accepted session once without replaying history or refreshing counsellor lists', async () => {
		const accepted = (id: number, sourceSessionId: number) => ({
			...feedItem(id, '2026-09-28T12:00:00Z'),
			eventType: 'inquiry.accepted',
			sourceSessionId
		});
		apiGetEventNotifications.mockResolvedValue({
			items: [accepted(1, 4)],
			unreadCount: 1
		});
		const signals = vi.fn();
		messageEventEmitter.on(signals);
		try {
			render(
				<NotificationsProvider>
					<PaginationProbe />
				</NotificationsProvider>
			);
			await waitFor(() =>
				expect(screen.getByTestId('ids').textContent).toBe('1')
			);
			expect(signals).not.toHaveBeenCalled();
			apiGetEventNotifications.mockResolvedValue({
				items: [accepted(2, 7), accepted(1, 4)],
				unreadCount: 2
			});
			fireEvent.click(screen.getByText('refresh'));
			await waitFor(() =>
				expect(signals).toHaveBeenCalledWith({
					changedSessionId: 7,
					source: 'notification-feed'
				})
			);
			fireEvent.click(screen.getByText('refresh'));
			await waitFor(() =>
				expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
			);
			await new Promise((resolve) => setTimeout(resolve, 500));
			expect(signals).toHaveBeenCalledTimes(1);
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(3);
		} finally {
			messageEventEmitter.off(signals);
		}
	});

	it('reconciles denied enquiry history on initial load and a new denial once without replaying notification banners', async () => {
		const AnnouncementCount = () => (
			<output data-testid="denied-banner-count">
				{useContext(NotificationsContext)!.notifications.length}
			</output>
		);
		const denied = (id: number, sourceSessionId: number) => ({
			...feedItem(id, '2026-10-08T12:00:00Z'),
			eventType: 'request.denied',
			sourceSessionId
		});
		apiGetEventNotifications.mockResolvedValue({
			items: [denied(1, 4711)],
			unreadCount: 1
		});
		const signals = vi.fn();
		messageEventEmitter.on(signals);
		try {
			render(
				<NotificationsProvider>
					<PaginationProbe />
					<AnnouncementCount />
				</NotificationsProvider>
			);
			await waitFor(() =>
				expect(screen.getByTestId('ids').textContent).toBe('1')
			);
			expect(screen.getByTestId('denied-banner-count').textContent).toBe(
				'0'
			);
			expect(signals).toHaveBeenCalledWith({
				changedSessionId: 4711,
				refreshEnquiryList: true,
				refreshSessionList: true,
				source: 'notification-feed'
			});
			expect(signals).toHaveBeenCalledTimes(1);
			apiGetEventNotifications.mockResolvedValue({
				items: [denied(2, 4712), denied(1, 4711)],
				unreadCount: 2
			});
			fireEvent.click(screen.getByText('refresh'));
			await waitFor(() => expect(signals).toHaveBeenCalledTimes(2));
			expect(signals).toHaveBeenLastCalledWith({
				changedSessionId: 4712,
				refreshEnquiryList: true,
				refreshSessionList: true,
				source: 'notification-feed'
			});
			fireEvent.click(screen.getByText('refresh'));
			await waitFor(() =>
				expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
			);
			expect(signals).toHaveBeenCalledTimes(2);
		} finally {
			messageEventEmitter.off(signals);
		}
	});

	it.each([
		['waiting_room.client.joined', { refreshEnquiryList: true }],
		[
			'conversation.finished',
			{ refreshEnquiryList: true, refreshSessionList: true }
		]
	])(
		'refreshes lists once for a new %s event without replaying history',
		async (eventType, flags) => {
			const item = (id: number) => ({
				...feedItem(id, '2026-10-06T12:00:00Z'),
				eventType
			});
			apiGetEventNotifications.mockResolvedValue({
				items: [item(1)],
				unreadCount: 1
			});
			const signals = vi.fn();
			messageEventEmitter.on(signals);
			try {
				render(
					<NotificationsProvider>
						<PaginationProbe />
					</NotificationsProvider>
				);
				await waitFor(() =>
					expect(screen.getByTestId('ids').textContent).toBe('1')
				);
				if (eventType === 'conversation.finished') {
					expect(signals).toHaveBeenCalledTimes(1);
				} else {
					expect(signals).not.toHaveBeenCalled();
				}
				signals.mockClear();
				apiGetEventNotifications.mockResolvedValue({
					items: [item(2), item(1)],
					unreadCount: 2
				});
				fireEvent.click(screen.getByText('refresh'));
				await waitFor(() =>
					expect(signals).toHaveBeenCalledWith({
						...flags,
						source: 'notification-feed'
					})
				);
				fireEvent.click(screen.getByText('refresh'));
				await waitFor(() =>
					expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
				);
				expect(signals).toHaveBeenCalledTimes(1);
			} finally {
				messageEventEmitter.off(signals);
			}
		}
	);

	it.each(['waiting_room.client.joined', 'conversation.finished'])(
		'handles a new %s event during mark-read reconciliation',
		async (eventType) => {
			apiGetEventNotifications.mockResolvedValue({
				items: [feedItem(1, '2026-10-06T12:00:00Z')],
				unreadCount: 1
			});
			const signals = vi.fn();
			messageEventEmitter.on(signals);
			try {
				render(
					<NotificationsProvider>
						<ReadAccountingProbe />
						<ConfirmedReadProbe />
					</NotificationsProvider>
				);
				await waitFor(() =>
					expect(screen.getByTestId('read-state').textContent).toBe(
						'1:unread'
					)
				);
				apiGetEventNotifications.mockResolvedValue({
					items: [
						{ ...feedItem(2, '2026-10-06T12:00:01Z'), eventType },
						feedItem(1, '2026-10-06T12:00:00Z')
					],
					unreadCount: 1
				});
				fireEvent.click(screen.getByText('confirmed-read'));
				await waitFor(() =>
					expect(signals).toHaveBeenCalledWith(
						expect.objectContaining({
							refreshEnquiryList: true,
							source: 'notification-feed'
						})
					)
				);
			} finally {
				messageEventEmitter.off(signals);
			}
		}
	);

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

	// #876 (Frank, 2 Oct 2026): a planned maintenance notice always stays in
	// the feed; a switched-off browser channel only suppresses the pop-up.
	it.each([
		['on', true, 1],
		['off', false, 0]
	] as const)(
		'keeps a planned service notice in the feed with the system channel %s',
		async (_label, system, expectedBanners) => {
			notificationSettingsStore.updateSettings({ families: { system } });
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
						eventType: 'service.notice.planned',
						category: 'system',
						title: 'Planned maintenance',
						text: 'Planned maintenance on 2026-10-15 from 22:00 to 23:30. Current status: https://status.example.org/',
						params: {
							campaignKey: 'maint-2026-10-15',
							maintenanceDate: '2026-10-15',
							maintenanceStart: '22:00',
							maintenanceEnd: '23:30',
							statusUrl: 'https://status.example.org/'
						}
					}
				],
				unreadCount: 1
			});
			fireEvent.click(screen.getByText('refresh'));
			await waitFor(() =>
				expect(screen.getByTestId('ids').textContent).toBe('1')
			);
			expect(banners).toHaveBeenCalledTimes(expectedBanners);
			if (expectedBanners) {
				expect(banners.mock.calls[0][1]).toMatchObject({
					family: 'system',
					eventType: 'service.notice.planned'
				});
			}
			expect(JSON.stringify(banners.mock.calls)).not.toContain(
				'status.example.org'
			);
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

	it.each([
		[
			'mapped recipient',
			'message.new',
			'user',
			'conversations',
			'standard'
		],
		[
			'mail-unmapped event',
			'inquiry.accepted',
			'user',
			'requests',
			'standard'
		],
		[
			'unknown recipient',
			'message.new',
			'future-role',
			'conversations',
			'standard'
		]
	] as const)(
		'keeps %s in the feed and browser channel independently of legacy email flags',
		async (_label, eventType, recipientRole, area, kind) => {
			let config =
				notificationSettingsStore.getState().settings
					.notificationConfig;
			config = setKindField(config, area, kind, 'sound', 'chime');
			config = setKindField(config, area, kind, 'banner', 'persistent');
			// This old Matrix config flag is not an SMTP preference. It must
			// never decide whether a browser banner or sound may be delivered.
			config = setKindField(config, area, kind, 'email', false);
			notificationSettingsStore.updateSettings({
				notificationConfig: config
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
						eventType,
						title: 'PRIVATE PERSON',
						text: 'PRIVATE COUNSELLING CONTENT',
						params: { recipientRole }
					}
				],
				unreadCount: 1
			});
			fireEvent.click(screen.getByText('refresh'));
			await waitFor(() =>
				expect(screen.getByTestId('ids').textContent).toBe('1')
			);
			expect(banners).toHaveBeenCalledTimes(1);
			expect(banners.mock.calls[0][1].requireInteraction).toBe(true);
			expect(play).toHaveBeenCalledTimes(1);
			expect(JSON.stringify(banners.mock.calls)).not.toContain('PRIVATE');
			fireEvent.click(screen.getByText('refresh'));
			await waitFor(() =>
				expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
			);
			expect(banners).toHaveBeenCalledTimes(1);
			expect(play).toHaveBeenCalledTimes(1);
		}
	);
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

		apiGetEventNotifications.mockResolvedValue({
			items: [
				{
					...feedItem(1, '2026-09-12T10:00:00.000Z'),
					readAt: '2026-09-12T11:00:00Z'
				},
				feedItem(2, '2026-09-12T09:00:00.000Z')
			],
			unreadCount: 1
		});
		await act(async () =>
			fireEvent.click(screen.getByText('read-one-twice'))
		);

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

		await act(async () => {
			fireEvent.click(screen.getByText('read-one'));
			fireEvent.click(screen.getByText('read-unknown'));
		});

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

		apiGetEventNotifications.mockResolvedValue({
			items: [
				{
					...feedItem(1, '2026-09-12T10:00:00.000Z'),
					readAt: '2026-09-12T11:00:00Z'
				},
				{
					...feedItem(2, '2026-09-12T09:00:00.000Z'),
					readAt: '2026-09-12T11:00:00Z'
				}
			],
			unreadCount: 7
		});
		await act(async () => {
			fireEvent.click(screen.getByText('read-one'));
			fireEvent.click(screen.getByText('read-two'));
		});

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

describe('NotificationsProvider confirmed persistence', () => {
	beforeEach(() => {
		authSession.token = 'fake-token';
		apiGetEventNotifications.mockReset();
		apiMarkEventNotificationRead.mockReset().mockResolvedValue(undefined);
		apiMarkAllEventNotificationsRead
			.mockReset()
			.mockResolvedValue(undefined);
		apiClearEventNotifications.mockReset().mockResolvedValue(undefined);
		apiGetEventNotifications.mockResolvedValue({
			items: [feedItem(1, '2026-09-12T10:00:00Z')],
			unreadCount: 1
		});
	});
	afterEach(() => cleanup());
	const mountFeed = async () => {
		const view = render(
			<NotificationsProvider>
				<ReadAccountingProbe />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(screen.getByTestId('read-state').textContent).toBe(
				'1:unread'
			)
		);
		return view;
	};
	const expectUnread = () => {
		expect(screen.getByTestId('read-state').textContent).toBe('1:unread');
		expect(screen.getByTestId('unread-count').textContent).toBe('1');
	};
	it('keeps an individual read pending and submits duplicate clicks only once', async () => {
		const request = deferred();
		apiMarkEventNotificationRead.mockReturnValue(request.promise);
		await mountFeed();
		fireEvent.click(screen.getByText('read-one-twice'));
		expectUnread();
		expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(1);
		apiGetEventNotifications.mockResolvedValue({
			items: [
				{
					...feedItem(1, '2026-09-12T10:00:00Z'),
					readAt: '2026-09-12T11:00:00Z'
				}
			],
			unreadCount: 0
		});
		await act(async () => request.resolve());
		await waitFor(() =>
			expect(screen.getByTestId('read-state').textContent).toBe('1:read')
		);
		expect(screen.getByTestId('unread-count').textContent).toBe('0');
	});
	it('preserves an unread row after rejection and permits an explicit retry without a poll', async () => {
		apiMarkEventNotificationRead.mockRejectedValueOnce(
			new Error('network unavailable')
		);
		await mountFeed();
		await act(async () => fireEvent.click(screen.getByText('read-one')));
		expectUnread();
		apiGetEventNotifications.mockResolvedValue({
			items: [
				{
					...feedItem(1, '2026-09-12T10:00:00Z'),
					readAt: '2026-09-12T11:00:00Z'
				}
			],
			unreadCount: 0
		});
		await act(async () => fireEvent.click(screen.getByText('read-one')));
		expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(2);
		await waitFor(() =>
			expect(screen.getByTestId('read-state').textContent).toBe('1:read')
		);
	});
	it('parks a stale poll during an individual read and reconciles only after acknowledgement', async () => {
		const request = deferred();
		apiMarkEventNotificationRead.mockReturnValue(request.promise);
		await mountFeed();
		fireEvent.click(screen.getByText('read-one'));
		await act(async () => fireEvent.click(screen.getByText('refresh')));
		expectUnread();
		apiGetEventNotifications.mockResolvedValue({
			items: [
				{
					...feedItem(1, '2026-09-12T10:00:00Z'),
					readAt: '2026-09-12T11:00:00Z'
				}
			],
			unreadCount: 0
		});
		await act(async () => request.resolve());
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
		);
		expect(screen.getByTestId('read-state').textContent).toBe('1:read');
	});
	it('keeps read-all pending, deduplicates clicks and preserves unread after rejection', async () => {
		const request = deferred();
		apiMarkAllEventNotificationsRead.mockReturnValueOnce(request.promise);
		await mountFeed();
		fireEvent.click(screen.getByRole('button', { name: 'read-all' }));
		fireEvent.click(screen.getByRole('button', { name: 'read-all' }));
		expectUnread();
		expect(apiMarkAllEventNotificationsRead).toHaveBeenCalledTimes(1);
		await act(async () =>
			request.reject(new Error('read-all unavailable'))
		);
		expectUnread();
		apiGetEventNotifications.mockResolvedValue({
			items: [
				{
					...feedItem(1, '2026-09-12T10:00:00Z'),
					readAt: '2026-09-12T11:00:00Z'
				}
			],
			unreadCount: 0
		});
		await act(async () =>
			fireEvent.click(screen.getByRole('button', { name: 'read-all' }))
		);
		await waitFor(() =>
			expect(screen.getByTestId('read-state').textContent).toBe('1:read')
		);
		expect(apiMarkAllEventNotificationsRead).toHaveBeenCalledTimes(2);
	});
	it('preserves a clear pending or rejected, deduplicates clicks and permits retry', async () => {
		const request = deferred();
		apiClearEventNotifications.mockReturnValueOnce(request.promise);
		await mountFeed();
		fireEvent.click(screen.getByText('clear'));
		fireEvent.click(screen.getByText('clear'));
		expectUnread();
		expect(apiClearEventNotifications).toHaveBeenCalledTimes(1);
		await act(async () => request.reject(new Error('clear unavailable')));
		expectUnread();
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
		await act(async () => fireEvent.click(screen.getByText('clear')));
		expect(apiClearEventNotifications).toHaveBeenCalledTimes(2);
		await waitFor(() =>
			expect(screen.getByTestId('read-state').textContent).toBe('')
		);
	});
	it('does not let a late read-all acknowledgement mutate a replacement auth session', async () => {
		const request = deferred();
		apiMarkAllEventNotificationsRead.mockReturnValue(request.promise);
		await mountFeed();
		fireEvent.click(screen.getByRole('button', { name: 'read-all' }));
		authSession.token = null;
		await act(async () =>
			window.dispatchEvent(new Event('oriso:auth-session-change'))
		);
		authSession.token = 'replacement-token';
		apiGetEventNotifications.mockResolvedValue({
			items: [feedItem(2, '2026-09-12T12:00:00Z')],
			unreadCount: 1
		});
		await act(async () =>
			window.dispatchEvent(new Event('oriso:auth-session-change'))
		);
		await waitFor(() =>
			expect(screen.getByTestId('read-state').textContent).toBe(
				'2:unread'
			)
		);
		await act(async () => request.resolve());
		expect(screen.getByTestId('read-state').textContent).toBe('2:unread');
		expect(screen.getByTestId('unread-count').textContent).toBe('1');
	});
	it('does not let a late clear acknowledgement erase a replacement auth session', async () => {
		const request = deferred();
		apiClearEventNotifications.mockReturnValue(request.promise);
		await mountFeed();
		fireEvent.click(screen.getByText('clear'));
		authSession.token = null;
		await act(async () =>
			window.dispatchEvent(new Event('oriso:auth-session-change'))
		);
		authSession.token = 'replacement-token';
		apiGetEventNotifications.mockResolvedValue({
			items: [feedItem(2, '2026-09-12T12:00:00Z')],
			unreadCount: 1
		});
		await act(async () =>
			window.dispatchEvent(new Event('oriso:auth-session-change'))
		);
		await waitFor(() =>
			expect(screen.getByTestId('read-state').textContent).toBe(
				'2:unread'
			)
		);
		await act(async () => request.resolve());
		expect(screen.getByTestId('read-state').textContent).toBe('2:unread');
	});
	it('keeps acknowledged read state when the provider reloads from the server', async () => {
		const view = await mountFeed();
		apiGetEventNotifications.mockResolvedValue({
			items: [
				{
					...feedItem(1, '2026-09-12T10:00:00Z'),
					readAt: '2026-09-12T11:00:00Z'
				}
			],
			unreadCount: 0
		});
		await act(async () => fireEvent.click(screen.getByText('read-one')));
		await waitFor(() =>
			expect(screen.getByTestId('read-state').textContent).toBe('1:read')
		);
		view.unmount();
		render(
			<NotificationsProvider>
				<ReadAccountingProbe />
			</NotificationsProvider>
		);
		await waitFor(() =>
			expect(screen.getByTestId('read-state').textContent).toBe('1:read')
		);
		expect(screen.getByTestId('unread-count').textContent).toBe('0');
	});
	it('does not refetch after a pending read succeeds on an unmounted provider', async () => {
		const request = deferred();
		apiMarkEventNotificationRead.mockReturnValue(request.promise);
		const view = await mountFeed();
		fireEvent.click(screen.getByText('read-one'));
		view.unmount();
		const fetches = apiGetEventNotifications.mock.calls.length;
		await act(async () => request.resolve());
		expect(apiGetEventNotifications).toHaveBeenCalledTimes(fetches);
	});
	it('keeps new server activity unread when it arrives after read-all took effect', async () => {
		const request = deferred();
		apiMarkAllEventNotificationsRead.mockReturnValue(request.promise);
		await mountFeed();
		fireEvent.click(screen.getByRole('button', { name: 'read-all' }));
		apiGetEventNotifications.mockResolvedValue({
			items: [
				feedItem(2, '2026-09-12T12:00:00Z'),
				{
					...feedItem(1, '2026-09-12T10:00:00Z'),
					readAt: '2026-09-12T11:00:00Z'
				}
			],
			unreadCount: 1
		});
		await act(async () => fireEvent.click(screen.getByText('refresh')));
		expectUnread();
		await act(async () => request.resolve());
		await waitFor(() =>
			expect(screen.getByTestId('read-state').textContent).toBe(
				'2:unread,1:read'
			)
		);
		expect(screen.getByTestId('unread-count').textContent).toBe('1');
	});
	it('keeps local activity created during read-all unread', async () => {
		const request = deferred();
		apiMarkAllEventNotificationsRead.mockReturnValue(request.promise);
		await mountFeed();
		fireEvent.click(screen.getByRole('button', { name: 'read-all' }));
		fireEvent.click(screen.getByText('add-local'));
		apiGetEventNotifications.mockResolvedValue({
			items: [
				{
					...feedItem(1, '2026-09-12T10:00:00Z'),
					readAt: '2026-09-12T11:00:00Z'
				}
			],
			unreadCount: 0
		});
		await act(async () => request.resolve());
		await waitFor(() =>
			expect(screen.getByTestId('unread-count').textContent).toBe('1')
		);
		expect(screen.getByTestId('read-state').textContent).toMatch(
			/local-.*:unread/
		);
	});
	it('preserves pagination after clear rejection and applies an older page parked while clearing', async () => {
		const newest = Array.from({ length: 50 }, (_, index) =>
			feedItem(index + 1, new Date(100 - index).toISOString())
		);
		apiGetEventNotifications
			.mockResolvedValueOnce({ items: newest, unreadCount: 51 })
			.mockResolvedValue({
				items: [feedItem(51, new Date(1).toISOString())],
				unreadCount: 51
			});
		const request = deferred();
		apiClearEventNotifications.mockReturnValue(request.promise);
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
		fireEvent.click(screen.getByText('clear'));
		await act(async () => fireEvent.click(screen.getByText('load')));
		expect(screen.getByTestId('ids').textContent!.split(',')).toHaveLength(
			50
		);
		await act(async () => request.reject(new Error('clear unavailable')));
		expect(screen.getByTestId('ids').textContent!.split(',')).toHaveLength(
			51
		);
		expect(screen.getByTestId('ids').textContent).toContain('51');
		expect(screen.getByTestId('pagination-state').textContent).toBe('end');
	});
	const tokenFor = (claims: Record<string, unknown>) =>
		`header.${btoa(JSON.stringify(claims))}.signature`;
	const identity = { sub: 'user-a', session_state: 'session-a', tenantId: 2 };
	it.each(['read-one', 'read-all', 'clear'])(
		'isolates pending %s from direct nonempty account replacement',
		async (action) => {
			authSession.token = tokenFor({ ...identity, iat: 1 });
			const request = deferred();
			if (action === 'read-one')
				apiMarkEventNotificationRead.mockReturnValue(request.promise);
			if (action === 'read-all')
				apiMarkAllEventNotificationsRead.mockReturnValue(
					request.promise
				);
			if (action === 'clear')
				apiClearEventNotifications.mockReturnValue(request.promise);
			await mountFeed();
			fireEvent.click(screen.getByRole('button', { name: action }));
			authSession.token = tokenFor({
				...identity,
				sub: 'user-b',
				iat: 2
			});
			apiGetEventNotifications.mockResolvedValue({
				items: [feedItem(2, '2026-09-12T12:00:00Z')],
				unreadCount: 1
			});
			await act(async () =>
				window.dispatchEvent(new Event('oriso:auth-session-change'))
			);
			await waitFor(() =>
				expect(screen.getByTestId('read-state').textContent).toBe(
					'2:unread'
				)
			);
			await act(async () => request.resolve());
			expect(screen.getByTestId('read-state').textContent).toBe(
				'2:unread'
			);
			expect(screen.getByTestId('unread-count').textContent).toBe('1');
		}
	);
	it.each([{ session_state: 'new-session' }, { tenantId: 3 }])(
		'isolates a pending clear on a changed login session or tenant %o',
		async (change) => {
			authSession.token = tokenFor({ ...identity, iat: 1 });
			const request = deferred();
			apiClearEventNotifications.mockReturnValue(request.promise);
			await mountFeed();
			fireEvent.click(screen.getByText('clear'));
			authSession.token = tokenFor({ ...identity, ...change, iat: 2 });
			apiGetEventNotifications.mockResolvedValue({
				items: [feedItem(2, '2026-09-12T12:00:00Z')],
				unreadCount: 1
			});
			await act(async () =>
				window.dispatchEvent(new Event('oriso:auth-session-change'))
			);
			await waitFor(() =>
				expect(screen.getByTestId('read-state').textContent).toBe(
					'2:unread'
				)
			);
			await act(async () => request.resolve());
			expect(screen.getByTestId('read-state').textContent).toBe(
				'2:unread'
			);
		}
	);
	it.each(['same-token', 'refresh'])(
		'preserves a valid pending mutation after a %s auth event',
		async (change) => {
			authSession.token = tokenFor({ ...identity, iat: 1 });
			const request = deferred();
			apiMarkEventNotificationRead.mockReturnValue(request.promise);
			await mountFeed();
			fireEvent.click(screen.getByText('read-one'));
			if (change === 'refresh')
				authSession.token = tokenFor({ ...identity, iat: 2 });
			await act(async () =>
				window.dispatchEvent(new Event('oriso:auth-session-change'))
			);
			expectUnread();
			apiGetEventNotifications.mockResolvedValue({
				items: [
					{
						...feedItem(1, '2026-09-12T10:00:00Z'),
						readAt: '2026-09-12T11:00:00Z'
					}
				],
				unreadCount: 0
			});
			await act(async () => request.resolve());
			await waitFor(() =>
				expect(screen.getByTestId('read-state').textContent).toBe(
					'1:read'
				)
			);
			expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(1);
			expect(screen.getByTestId('unread-count').textContent).toBe('0');
		}
	);

	it.each(['read-all', 'clear'])(
		'preserves individual read intent while %s is pending and later fails',
		async (action) => {
			const bulk = deferred();
			const individual = deferred();
			if (action === 'read-all')
				apiMarkAllEventNotificationsRead.mockReturnValue(bulk.promise);
			else apiClearEventNotifications.mockReturnValue(bulk.promise);
			apiMarkEventNotificationRead.mockReturnValue(individual.promise);
			await mountFeed();
			fireEvent.click(screen.getByRole('button', { name: action }));
			fireEvent.click(screen.getByText('read-one-twice'));
			expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(1);
			expectUnread();
			await act(async () => bulk.reject(new Error('bulk unavailable')));
			expectUnread();
			apiGetEventNotifications.mockResolvedValue({
				items: [
					{
						...feedItem(1, '2026-09-12T10:00:00Z'),
						readAt: '2026-09-12T11:00:00Z'
					}
				],
				unreadCount: 0
			});
			await act(async () => individual.resolve());
			await waitFor(() =>
				expect(screen.getByTestId('read-state').textContent).toBe(
					'1:read'
				)
			);
			expect(screen.getByTestId('unread-count').textContent).toBe('0');
		}
	);
	it.each(['read-all', 'clear'])(
		'safely settles an individual read after successful pending %s',
		async (action) => {
			const bulk = deferred();
			const individual = deferred();
			if (action === 'read-all')
				apiMarkAllEventNotificationsRead.mockReturnValue(bulk.promise);
			else apiClearEventNotifications.mockReturnValue(bulk.promise);
			apiMarkEventNotificationRead.mockReturnValue(individual.promise);
			await mountFeed();
			fireEvent.click(screen.getByRole('button', { name: action }));
			fireEvent.click(screen.getByText('read-one'));
			expect(apiMarkEventNotificationRead).toHaveBeenCalledTimes(1);
			apiGetEventNotifications.mockResolvedValue({
				items:
					action === 'clear'
						? []
						: [
								{
									...feedItem(1, '2026-09-12T10:00:00Z'),
									readAt: '2026-09-12T11:00:00Z'
								}
							],
				unreadCount: 0
			});
			await act(async () => bulk.resolve());
			await act(async () => individual.resolve());
			await waitFor(() =>
				expect(screen.getByTestId('read-state').textContent).toBe(
					action === 'clear' ? '' : '1:read'
				)
			);
			expect(screen.getByTestId('unread-count').textContent).toBe('0');
		}
	);

	it('invalidates pending reads when an opaque nonempty token is replaced directly', async () => {
		const request = deferred();
		apiMarkEventNotificationRead.mockReturnValue(request.promise);
		await mountFeed();
		fireEvent.click(screen.getByText('read-one'));
		authSession.token = 'replacement-opaque-token';
		apiGetEventNotifications.mockResolvedValue({
			items: [feedItem(2, '2026-09-12T12:00:00Z')],
			unreadCount: 1
		});
		await act(async () =>
			window.dispatchEvent(new Event('oriso:auth-session-change'))
		);
		await waitFor(() =>
			expect(screen.getByTestId('read-state').textContent).toBe(
				'2:unread'
			)
		);
		await act(async () => request.resolve());
		expect(screen.getByTestId('read-state').textContent).toBe('2:unread');
	});
	it.each(['read-all', 'clear'])(
		'exposes truthful pending state and disables the bulk toolbar during %s',
		async (action) => {
			const pending = deferred();
			if (action === 'read-all')
				apiMarkAllEventNotificationsRead.mockReturnValue(
					pending.promise
				);
			else apiClearEventNotifications.mockReturnValue(pending.promise);
			await mountFeed();
			fireEvent.click(screen.getByRole('button', { name: action }));
			expect(screen.getByTestId('mutation-status').textContent).toBe(
				action === 'read-all' ? 'true:false' : 'false:true'
			);
			const toolbar = screen.getByRole('button', { name: 'read-all' });
			expect(toolbar.hasAttribute('disabled')).toBe(true);
			expect(toolbar.getAttribute('aria-busy')).toBe('true');
			await act(async () =>
				pending.reject(new Error('private provider failure'))
			);
			expect(screen.getByTestId('mutation-status').textContent).toBe(
				'false:false'
			);
			expect(toolbar.hasAttribute('disabled')).toBe(false);
			expect(toolbar.getAttribute('aria-busy')).toBe('false');
		}
	);
	it.each([
		[
			'en',
			'read-one',
			'The notification could not be marked as read. Please try again.'
		],
		[
			'en',
			'read-all',
			'Notifications could not be marked as read. Please try again.'
		],
		['en', 'clear', 'Activity could not be cleared. Please try again.'],
		[
			'de',
			'read-one',
			'Die Benachrichtigung konnte nicht als gelesen markiert werden. Bitte erneut versuchen.'
		],
		[
			'de',
			'read-all',
			'Benachrichtigungen konnten nicht als gelesen markiert werden. Bitte erneut versuchen.'
		],
		[
			'de',
			'clear',
			'Aktivität konnte nicht gelöscht werden. Bitte erneut versuchen.'
		]
	])(
		'reports a localized %s retry message after rejected %s',
		async (language, action, expected) => {
			await i18n.init({
				lng: language,
				resources: { de: { translation: de }, en: { translation: en } },
				interpolation: { escapeValue: false }
			});
			const failure = new Error(
				'private SMTP reply user@example.org credential-canary'
			);
			if (action === 'read-one')
				apiMarkEventNotificationRead.mockRejectedValue(failure);
			if (action === 'read-all')
				apiMarkAllEventNotificationsRead.mockRejectedValue(failure);
			if (action === 'clear')
				apiClearEventNotifications.mockRejectedValue(failure);
			await mountFeed();
			await act(async () =>
				fireEvent.click(screen.getByRole('button', { name: action }))
			);
			expectUnread();
			expect(screen.getByTestId('feedback').textContent).toContain(
				expected
			);
			expect(screen.getByTestId('feedback').textContent).toContain(
				'"announce":"alert"'
			);
			expect(screen.getByTestId('feedback').textContent).not.toContain(
				'user@example.org'
			);
			expect(screen.getByTestId('feedback').textContent).not.toContain(
				'credential-canary'
			);
		}
	);
	it('does not report a stale mutation failure into another account or reset its pending state', async () => {
		const old = deferred();
		const current = deferred();
		apiClearEventNotifications
			.mockReturnValueOnce(old.promise)
			.mockReturnValueOnce(current.promise);
		await mountFeed();
		fireEvent.click(screen.getByText('clear'));
		authSession.token = 'new-account-token';
		apiGetEventNotifications.mockResolvedValue({
			items: [feedItem(2, '2026-09-12T12:00:00Z')],
			unreadCount: 1
		});
		await act(async () =>
			window.dispatchEvent(new Event('oriso:auth-session-change'))
		);
		await waitFor(() =>
			expect(screen.getByTestId('read-state').textContent).toBe(
				'2:unread'
			)
		);
		fireEvent.click(screen.getByText('clear'));
		await act(async () => old.reject(new Error('old account failure')));
		expect(screen.getByTestId('mutation-status').textContent).toBe(
			'false:true'
		);
		expect(screen.getByTestId('feedback').textContent).toBe('[]');
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
		await act(async () => current.resolve());
		expect(screen.getByTestId('mutation-status').textContent).toBe(
			'false:false'
		);
	});
});
