/**
 * FE#1470: a new live-chat message to a counsellor raises an in-app pop-up
 * and the Live-Chat row's tone — once — through the one feed announcement
 * path. Nothing for the seeker's row of the counsellor's own message, for a
 * chat already on screen, or while notifications are muted.
 *
 * @vitest-environment oriso-jsdom
 */

import React, { useContext } from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	NotificationsContext,
	NotificationsProvider
} from './NotificationsProvider';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';
import { setKindField } from '../../utils/notificationSettings/notificationConfig';
import { __resetSoundThrottlesForTests } from '../../utils/notificationSettings/soundPlayback';
import {
	isNotificationTypeLiveChatMessage,
	LiveChatMessageNoticeProps
} from '../../components/notifications/LiveChatMessageNotice';

const apiGetEventNotifications = vi.fn();

vi.mock('../../api/apiEventNotifications', () => ({
	apiGetEventNotifications: (...args: unknown[]) =>
		apiGetEventNotifications(...args),
	apiMarkEventNotificationRead: vi.fn(() => Promise.resolve()),
	apiMarkEventNotificationsReadByTypes: vi.fn(() =>
		Promise.reject({ status: 404 })
	),
	apiGetEventNotificationsUnreadCount: vi.fn(() =>
		Promise.resolve({ unreadCount: 0 })
	),
	apiMarkAllEventNotificationsRead: vi.fn(() => Promise.resolve()),
	apiClearEventNotifications: vi.fn(() => Promise.resolve())
}));

vi.mock('../../components/sessionCookie/accessSessionCookie', () => ({
	AUTH_SESSION_CHANGE_EVENT: 'oriso:auth-session-change',
	getValueFromCookie: () => 'fake-token'
}));

const message = (
	id: number,
	params: Record<string, unknown> = {},
	sessionId = 42
) => ({
	id,
	eventType: 'message.new',
	category: 'message' as const,
	title: '',
	text: 'PRIVATE MESSAGE TEXT',
	createdAt: new Date(Date.UTC(2026, 9, 28, 12, 0, id)).toISOString(),
	readAt: null,
	sourceSessionId: sessionId,
	actionPath: `/sessions/consultant/sessionView/!room${sessionId}/${sessionId}`,
	params: {
		sessionId,
		roomRef: `!room${sessionId}`,
		conversationType: 'LIVE_CHAT',
		recipientRole: 'consultant',
		senderName: 'Seeker 7',
		...params
	}
});

const Probe = () => {
	const context = useContext(NotificationsContext)!;
	const notices = (context.notifications as never[]).filter(
		isNotificationTypeLiveChatMessage
	) as LiveChatMessageNoticeProps[];
	return (
		<>
			<div data-testid="ids">
				{context.notificationFeed.map((item) => item.id).join(',')}
			</div>
			<div data-testid="notices">
				{notices
					.map((n) => `${n.sessionId}:${n.count}:${n.senderName}`)
					.join(',')}
			</div>
			<div data-testid="path">{notices[0]?.path ?? ''}</div>
			<button onClick={context.refreshNotificationFeed}>refresh</button>
		</>
	);
};

const banners = vi.fn();
const play = vi.fn(() => Promise.resolve());
let permission: NotificationPermission = 'granted';
let visibility: DocumentVisibilityState = 'visible';
let focused = true;

/** Mount with an empty history, then deliver `items` as new activity. */
const deliver = async (items: ReturnType<typeof message>[]) => {
	render(
		<NotificationsProvider>
			<Probe />
		</NotificationsProvider>
	);
	await waitFor(() =>
		expect(apiGetEventNotifications).toHaveBeenCalledTimes(1)
	);
	apiGetEventNotifications.mockResolvedValue({
		items,
		unreadCount: items.length
	});
	fireEvent.click(screen.getByText('refresh'));
	await waitFor(() =>
		expect(screen.getByTestId('ids').textContent).toBe(
			items.map((item) => item.id).join(',')
		)
	);
};

describe('NotificationsProvider live-chat signal (FE#1470)', () => {
	beforeEach(() => {
		apiGetEventNotifications.mockReset();
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
		banners.mockClear();
		play.mockClear();
		permission = 'granted';
		visibility = 'visible';
		focused = true;
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
		window.history.replaceState({}, '', '/sessions/consultant/sessionView');
		vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
			() => visibility
		);
		vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
		vi.stubGlobal(
			'Notification',
			class {
				static get permission() {
					return permission;
				}
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
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		notificationSettingsStore.resetForTests();
		window.history.replaceState({}, '', '/');
	});

	it('shows one pop-up and plays the Live-Chat tone once, with default settings', async () => {
		await deliver([message(1)]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'42:1:Seeker 7'
			)
		);
		expect(screen.getByTestId('path').textContent).toBe(
			'/sessions/consultant/sessionView/!room42/42'
		);
		expect(play).toHaveBeenCalledTimes(1);

		// A repeated poll of the same rows announces nothing again.
		fireEvent.click(screen.getByText('refresh'));
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
		);
		expect(screen.getByTestId('notices').textContent).toBe('42:1:Seeker 7');
		expect(play).toHaveBeenCalledTimes(1);
	});

	it('counts several messages of one chat on one pop-up, one card per chat', async () => {
		await deliver([message(3), message(2), message(1, {}, 77)]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'42:2:Seeker 7,77:1:Seeker 7'
			)
		);
	});

	it.each([
		[
			'the seeker’s row of the counsellor’s own message',
			{ recipientRole: 'user' }
		],
		[
			'an ordinary counselling chat',
			{ conversationType: 'AGENCY_COUNSELLING' }
		]
	])('raises no live-chat signal for %s', async (_label, params) => {
		await deliver([message(1, params)]);

		expect(screen.getByTestId('notices').textContent).toBe('');
		// Ordinary messages keep their factory default: no tone.
		expect(play).not.toHaveBeenCalled();
	});

	it('stays quiet for the chat already on screen', async () => {
		window.history.replaceState(
			{},
			'',
			'/sessions/consultant/sessionView/!room42/42'
		);
		await deliver([message(1)]);

		expect(screen.getByTestId('notices').textContent).toBe('');
		expect(play).not.toHaveBeenCalled();
		expect(banners).not.toHaveBeenCalled();
	});

	it('stays quiet while notifications are muted', async () => {
		notificationSettingsStore.updateSettings({ globalMute: true });
		await deliver([message(1)]);

		expect(screen.getByTestId('notices').textContent).toBe('');
		expect(play).not.toHaveBeenCalled();
	});

	it('honours the Live-Chat row: pop-up off keeps the tone, no tone keeps the pop-up', async () => {
		const config =
			notificationSettingsStore.getState().settings.notificationConfig;
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				config,
				'conversations',
				'liveChat',
				'banner',
				'off'
			)
		});
		await deliver([message(1)]);
		expect(screen.getByTestId('notices').textContent).toBe('');
		expect(play).toHaveBeenCalledTimes(1);
		cleanup();

		notificationSettingsStore.resetForTests();
		__resetSoundThrottlesForTests();
		play.mockClear();
		apiGetEventNotifications.mockReset();
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				config,
				'conversations',
				'liveChat',
				'sound',
				'none'
			)
		});
		await deliver([message(2)]);
		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'42:1:Seeker 7'
			)
		);
		expect(play).not.toHaveBeenCalled();
	});

	it('in a background tab adds the OS banner when already granted, without message text', async () => {
		visibility = 'hidden';
		focused = false;
		// Even with this chat's route open: hidden means nobody sees it.
		window.history.replaceState(
			{},
			'',
			'/sessions/consultant/sessionView/!room42/42'
		);
		await deliver([message(1)]);

		await waitFor(() => expect(banners).toHaveBeenCalledTimes(1));
		expect(JSON.stringify(banners.mock.calls)).not.toContain(
			'PRIVATE MESSAGE TEXT'
		);
		expect(screen.getByTestId('notices').textContent).toBe('42:1:Seeker 7');
		expect(play).toHaveBeenCalledTimes(1);
	});

	it('in a background tab without permission stays in-app only and never asks', async () => {
		visibility = 'hidden';
		focused = false;
		permission = 'default';
		await deliver([message(1)]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'42:1:Seeker 7'
			)
		);
		expect(banners).not.toHaveBeenCalled();
		expect(
			(Notification as unknown as { requestPermission: () => void })
				.requestPermission
		).not.toHaveBeenCalled();
		expect(play).toHaveBeenCalledTimes(1);
	});
});
