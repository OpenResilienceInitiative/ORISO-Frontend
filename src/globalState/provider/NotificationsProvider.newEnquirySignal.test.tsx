/**
 * FE#1435: a new enquiry raises an in-app pop-up and the "Neue Anfrage"
 * row's tone — once — through the one feed announcement path. One card for
 * several enquiries; no pop-up while Anfragen is on screen or while the row's
 * pop-up is off; nothing at all while notifications are muted.
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
	ENQUIRY_LIST_PATH,
	isNotificationTypeNewEnquiry,
	NewEnquiryNoticeProps
} from '../../components/notifications/NewEnquiryNotice';
import { messageEventEmitter } from '../../services/messageEventEmitter';

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

const enquiry = (id: number, sessionId = 246, eventType = 'request.new') => ({
	id,
	eventType,
	category: 'system' as const,
	title: 'New client request',
	text: 'A new client request is waiting.',
	createdAt: new Date(Date.UTC(2026, 9, 28, 12, 0, id)).toISOString(),
	readAt: null,
	sourceSessionId: sessionId,
	actionPath: `/sessions/consultant/sessionPreview/!room${sessionId}/${sessionId}`,
	params: { sessionId, agencyId: 2, topicId: 14 }
});

const Probe = () => {
	const context = useContext(NotificationsContext)!;
	const notices = (context.notifications as never[]).filter(
		isNotificationTypeNewEnquiry
	) as NewEnquiryNoticeProps[];
	return (
		<>
			<div data-testid="ids">
				{context.notificationFeed.map((item) => item.id).join(',')}
			</div>
			<div data-testid="notices">
				{notices.map((n) => `${n.count}:${n.path}`).join(',')}
			</div>
			<button onClick={context.refreshNotificationFeed}>refresh</button>
		</>
	);
};

const banners = vi.fn();
const play = vi.fn(() => Promise.resolve());
let visibility: DocumentVisibilityState = 'visible';

const deliver = async (items: ReturnType<typeof enquiry>[]) => {
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

describe('NotificationsProvider new-enquiry signal (FE#1435)', () => {
	beforeEach(() => {
		apiGetEventNotifications.mockReset();
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
		banners.mockClear();
		play.mockClear();
		visibility = 'visible';
		localStorage.clear();
		notificationSettingsStore.resetForTests();
		__resetSoundThrottlesForTests();
		window.history.replaceState({}, '', '/sessions/consultant/sessionView');
		vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
			() => visibility
		);
		vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
		vi.stubGlobal(
			'Notification',
			class {
				static get permission() {
					return 'default';
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

	it('shows the pop-up for that enquiry and plays the tone once, with default settings', async () => {
		const refreshes = vi.fn();
		messageEventEmitter.on(refreshes);
		await deliver([enquiry(1)]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'1:/sessions/consultant/sessionPreview/!room246/246'
			)
		);
		expect(play).toHaveBeenCalledTimes(1);
		// The enquiry badge and an open list reload on the same signal.
		expect(refreshes).toHaveBeenCalledWith(
			expect.objectContaining({ refreshEnquiryList: true })
		);
		messageEventEmitter.off(refreshes);

		// A repeated poll of the same rows announces nothing again.
		fireEvent.click(screen.getByText('refresh'));
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
		);
		expect(screen.getByTestId('notices').textContent).toBe(
			'1:/sessions/consultant/sessionPreview/!room246/246'
		);
		expect(play).toHaveBeenCalledTimes(1);
	});

	it('counts several enquiries, live chat included, on one card that opens the list', async () => {
		await deliver([
			enquiry(3, 230),
			enquiry(2, 77, 'waiting_room.client.joined'),
			enquiry(1, 246)
		]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				`3:${ENQUIRY_LIST_PATH}`
			)
		);
	});

	it('plays the tone but shows no pop-up while Anfragen is on screen', async () => {
		window.history.replaceState({}, '', ENQUIRY_LIST_PATH);
		await deliver([enquiry(1)]);

		await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
		expect(screen.getByTestId('notices').textContent).toBe('');
	});

	it('shows the pop-up when Anfragen is open in a background tab', async () => {
		window.history.replaceState({}, '', ENQUIRY_LIST_PATH);
		visibility = 'hidden';
		await deliver([enquiry(1)]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).not.toBe('')
		);
	});

	it('stays quiet while notifications are muted', async () => {
		notificationSettingsStore.updateSettings({ globalMute: true });
		await deliver([enquiry(1)]);

		expect(screen.getByTestId('notices').textContent).toBe('');
		expect(play).not.toHaveBeenCalled();
	});

	it('honours the "Neue Anfrage" row: pop-up off keeps the tone, no tone keeps the pop-up', async () => {
		const config =
			notificationSettingsStore.getState().settings.notificationConfig;
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				config,
				'requests',
				'new',
				'banner',
				'off'
			)
		});
		await deliver([enquiry(1)]);
		await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
		expect(screen.getByTestId('notices').textContent).toBe('');
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
				'requests',
				'new',
				'sound',
				'none'
			)
		});
		await deliver([enquiry(2)]);
		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).not.toBe('')
		);
		expect(play).not.toHaveBeenCalled();
	});

	it('raises no enquiry pop-up for an advice seeker’s own events', async () => {
		await deliver([
			{
				...enquiry(1),
				eventType: 'request.denied',
				actionPath: '/sessions/user/view/!room246/246'
			}
		]);
		expect(screen.getByTestId('notices').textContent).toBe('');
	});
});
