/**
 * FE#779: mention and case-handover events raise one in-app pop-up card per
 * conversation (and kind), the row's tone and at most one OS banner, all from
 * the one feed announcement path. Ordinary messages get no pop-up.
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

const NOTICE_TYPE = 'eventNotice';
type Notice = {
	notificationType: string;
	kind: string;
	sessionId: string;
	actorName: string | null;
	count: number;
	path: string | null;
};

const mention = (
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
		conversationType: 'AGENCY_COUNSELLING',
		recipientRole: 'consultant',
		senderName: 'Kollegin Weber',
		mentioned: true,
		...params
	}
});

const handover = (
	id: number,
	params: Record<string, unknown> = {},
	sessionId = 42,
	eventType = 'case.handover.offer.received'
) => ({
	...mention(
		id,
		{ mentioned: false, senderName: null, ...params },
		sessionId
	),
	eventType,
	category: 'system' as const
});

const Probe = () => {
	const context = useContext(NotificationsContext)!;
	const notices = (context.notifications as unknown as Notice[]).filter(
		(n) => n.notificationType === NOTICE_TYPE
	);
	return (
		<>
			<div data-testid="ids">
				{context.notificationFeed.map((item) => item.id).join(',')}
			</div>
			<div data-testid="notices">
				{notices
					.map(
						(n) =>
							`${n.kind}:${n.sessionId}:${n.count}:${n.actorName}`
					)
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

type Item = ReturnType<typeof mention>;

/** Mount with an empty history, then deliver `items` as new activity. */
const deliver = async (items: Item[]) => {
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
		expect(
			screen.getByTestId('ids').textContent?.split(',').sort()
		).toEqual(items.map((item) => String(item.id)).sort())
	);
};

/** Tones for the rows under test, whatever the factory defaults are. */
const withTones = () => {
	let config =
		notificationSettingsStore.getState().settings.notificationConfig;
	for (const kind of ['mention', 'handover', 'standard'] as const) {
		config = setKindField(config, 'conversations', kind, 'sound', 'ton-1');
	}
	notificationSettingsStore.updateSettings({ notificationConfig: config });
};

describe('NotificationsProvider mention + handover pop-up (FE#779)', () => {
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

	it('shows one mention card with the sender and plays the mention tone once', async () => {
		withTones();
		await deliver([mention(1)]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'mention:42:1:Kollegin Weber'
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
		expect(screen.getByTestId('notices').textContent).toBe(
			'mention:42:1:Kollegin Weber'
		);
		expect(play).toHaveBeenCalledTimes(1);
	});

	it.each([
		['case.handover.offer.received'],
		['case.handover.consent.requested']
	])('shows a handover card for %s', async (eventType) => {
		withTones();
		await deliver([
			handover(1, { initiatorName: 'Kollege Braun' }, 42, eventType)
		]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'handover:42:1:Kollege Braun'
			)
		);
		expect(play).toHaveBeenCalledTimes(1);
	});

	it('counts several events of one conversation on one card, one card per conversation and kind', async () => {
		await deliver([
			mention(4),
			mention(3),
			mention(2, {}, 77),
			handover(1)
		]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'mention:42:2:Kollegin Weber,mention:77:1:Kollegin Weber,handover:42:1:null'
			)
		);
	});

	it.each([
		['an ordinary counselling message', { mentioned: false }],
		[
			'an ordinary group message',
			{ mentioned: false, conversationType: 'GROUP' }
		],
		['the asker’s row', { recipientRole: 'user' }]
	])('raises no card for %s', async (_label, params) => {
		withTones();
		await deliver([mention(1, params)]);

		expect(screen.getByTestId('notices').textContent).toBe('');
	});

	it('keeps a live-chat mention on the live-chat card only', async () => {
		await deliver([mention(1, { conversationType: 'LIVE_CHAT' })]);

		expect(screen.getByTestId('notices').textContent).toBe('');
	});

	it('stays quiet for the conversation already on screen', async () => {
		window.history.replaceState(
			{},
			'',
			'/sessions/consultant/sessionView/!room42/42'
		);
		await deliver([mention(1), handover(2)]);

		expect(screen.getByTestId('notices').textContent).toBe('');
		expect(banners).not.toHaveBeenCalled();
	});

	it('stays quiet while notifications are muted', async () => {
		withTones();
		notificationSettingsStore.updateSettings({ globalMute: true });
		await deliver([mention(1), handover(2)]);

		expect(screen.getByTestId('notices').textContent).toBe('');
		expect(play).not.toHaveBeenCalled();
	});

	it('honours the row: pop-up off keeps tone and sends no banner, no tone keeps the card', async () => {
		withTones();
		const config =
			notificationSettingsStore.getState().settings.notificationConfig;
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				config,
				'conversations',
				'mention',
				'banner',
				'off'
			)
		});
		visibility = 'hidden';
		focused = false;
		await deliver([mention(1)]);
		expect(screen.getByTestId('notices').textContent).toBe('');
		expect(banners).not.toHaveBeenCalled();
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
				notificationSettingsStore.getState().settings
					.notificationConfig,
				'conversations',
				'mention',
				'sound',
				'none'
			)
		});
		await deliver([mention(2)]);
		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'mention:42:1:Kollegin Weber'
			)
		);
		expect(play).not.toHaveBeenCalled();
	});

	it('in a background tab raises exactly one OS banner per event, without message text, and keeps the card', async () => {
		withTones();
		visibility = 'hidden';
		focused = false;
		// Even with this conversation’s route open: hidden means nobody sees it.
		window.history.replaceState(
			{},
			'',
			'/sessions/consultant/sessionView/!room42/42'
		);
		await deliver([mention(1), handover(2, {}, 77)]);

		await waitFor(() => expect(banners).toHaveBeenCalledTimes(2));
		expect(JSON.stringify(banners.mock.calls)).not.toContain(
			'PRIVATE MESSAGE TEXT'
		);
		expect(screen.getByTestId('notices').textContent).toBe(
			'mention:42:1:Kollegin Weber,handover:77:1:null'
		);

		// A repeated poll must not banner again.
		fireEvent.click(screen.getByText('refresh'));
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
		);
		expect(banners).toHaveBeenCalledTimes(2);
	});

	it('in a background tab without permission stays in-app only and never asks', async () => {
		withTones();
		visibility = 'hidden';
		focused = false;
		permission = 'default';
		await deliver([mention(1)]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'mention:42:1:Kollegin Weber'
			)
		);
		expect(banners).not.toHaveBeenCalled();
		expect(
			(Notification as unknown as { requestPermission: () => void })
				.requestPermission
		).not.toHaveBeenCalled();
		expect(play).toHaveBeenCalledTimes(1);
	});

	it.each([
		['an ordinary counselling message', mention(1, { mentioned: false })],
		[
			'a group message',
			mention(1, { mentioned: false, conversationType: 'GROUP' })
		],
		['a mention', mention(1)],
		['a handover', handover(1)]
	])(
		'raises exactly one OS banner for %s in a background tab, however often it is polled',
		async (_label, item) => {
			withTones();
			visibility = 'hidden';
			focused = false;
			await deliver([item]);

			await waitFor(() => expect(banners).toHaveBeenCalledTimes(1));
			for (let poll = 3; poll <= 4; poll += 1) {
				fireEvent.click(screen.getByText('refresh'));
				await waitFor(() =>
					expect(apiGetEventNotifications).toHaveBeenCalledTimes(poll)
				);
			}
			expect(banners).toHaveBeenCalledTimes(1);
		}
	);

	it('sends no OS banner for a row whose pop-up column is off, but keeps the tone', async () => {
		withTones();
		const config =
			notificationSettingsStore.getState().settings.notificationConfig;
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				config,
				'conversations',
				'standard',
				'banner',
				'off'
			)
		});
		visibility = 'hidden';
		focused = false;
		await deliver([mention(1, { mentioned: false })]);

		expect(play).toHaveBeenCalledTimes(1);
		expect(banners).not.toHaveBeenCalled();
	});
});
