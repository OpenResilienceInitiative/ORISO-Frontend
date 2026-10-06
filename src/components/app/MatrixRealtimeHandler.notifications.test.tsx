// @vitest-environment jsdom
/** Matrix is the early trigger; persisted feed events own announcements. */
import React from 'react';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatrixRealtimeHandler } from './MatrixRealtimeHandler';
import { AppConfigContext, NotificationsProvider } from '../../globalState';
import { setAppConfig } from '../../utils/appConfig';
import { saveBrowserNotificationsSettings } from '../../utils/notificationHelpers';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';

const bridge = vi.hoisted(() => {
	const listeners = new Map<string, Set<(event: any) => void>>();
	return {
		on: (name: string, cb: (event: any) => void) => {
			if (!listeners.has(name)) {
				listeners.set(name, new Set());
			}
			listeners.get(name).add(cb);
		},
		off: (name: string, cb: (event: any) => void) => {
			listeners.get(name)?.delete(cb);
		},
		emit: (name: string, event: any) => {
			listeners.get(name)?.forEach((cb) => cb(event));
		},
		listenerCount: (name: string) => listeners.get(name)?.size ?? 0
	};
});

vi.mock('../../services/matrixLiveEventBridge', () => ({
	matrixLiveEventBridge: bridge
}));
const getFeed = vi.hoisted(() => vi.fn());
vi.mock('../../api/apiEventNotifications', () => ({
	apiGetEventNotifications: getFeed
}));
vi.mock('../sessionCookie/accessSessionCookie', () => ({
	AUTH_SESSION_CHANGE_EVENT: 'oriso:auth-session-change',
	getValueFromCookie: () => 'test-token'
}));
// Pulled in transitively by the notifications provider; lottie-web touches a
// canvas jsdom does not implement.
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }));

const constructed: Array<{ title: string; options: any }> = [];

class FakeNotification {
	static permission: NotificationPermission = 'granted';
	static requestPermission = () => Promise.resolve('granted');
	onshow: any;
	onclick: any;
	onclose: any;
	constructor(title: string, options: any) {
		constructed.push({ title, options });
	}
}

let appConfig: any = null;

/** Which notification panel the release toggle routes into the profile. */
const routePanel = (crossDevice: boolean) => {
	appConfig = { releaseToggles: { enableNewNotifications: crossDevice } };
	setAppConfig(appConfig);
};

const renderHandler = () =>
	render(
		<AppConfigContext.Provider value={appConfig}>
			<NotificationsProvider>
				<MatrixRealtimeHandler />
			</NotificationsProvider>
		</AppConfigContext.Provider>
	);

/** What Matrix delivers when someone else writes a message. */
const receiveDirectMessage = () =>
	act(() => {
		bridge.emit('directMessage', {
			roomId: '!room:oriso',
			timestamp: Date.now(),
			isOwnMessage: false
		});
	});

beforeEach(() => {
	getFeed.mockReset();
	getFeed.mockResolvedValue({ items: [], unreadCount: 0 });
	constructed.length = 0;
	localStorage.clear();
	notificationSettingsStore.resetForTests();
	vi.stubGlobal('Notification', FakeNotification);
	// A real message arrives while the consultant is looking elsewhere;
	// jsdom otherwise reports the document as focused and the helper — quite
	// correctly — skips the popup.
	vi.spyOn(document, 'hasFocus').mockReturnValue(false);
	routePanel(false);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	setAppConfig(null);
});

describe('MatrixRealtimeHandler → new message notification', () => {
	it('releases the authenticated subscription and installs only one on the next mount', () => {
		const first = renderHandler();
		expect(bridge.listenerCount('directMessage')).toBe(1);
		first.unmount();
		expect(bridge.listenerCount('directMessage')).toBe(0);
		const next = renderHandler();
		expect(bridge.listenerCount('directMessage')).toBe(1);
		next.unmount();
		expect(bridge.listenerCount('directMessage')).toBe(0);
	});

	it.each([false, undefined])(
		'preserves a matching incoming Matrix event while the initial feed is pending (own=%s)',
		async (isOwnMessage) => {
			saveBrowserNotificationsSettings({ enabled: true });
			let resolveFeed!: (value: unknown) => void;
			getFeed.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveFeed = resolve;
				})
			);
			renderHandler();
			act(() =>
				bridge.emit('directMessage', {
					roomId: '!room:oriso',
					eventId: '$live',
					...(isOwnMessage === undefined ? {} : { isOwnMessage })
				})
			);
			await act(async () =>
				resolveFeed({
					items: [
						{
							id: 1,
							eventType: 'message.new',
							createdAt: '2026-09-14T12:00:00Z',
							readAt: null,
							params: { matrixEventId: '$live' }
						}
					],
					unreadCount: 1
				})
			);
			await waitFor(() => expect(constructed).toHaveLength(1));
		}
	);

	it('announces an incoming Matrix message once after remount when LiveService is disabled', async () => {
		vi.stubEnv('REACT_APP_DISABLE_LIVE_WEBSOCKET', '1');
		saveBrowserNotificationsSettings({ enabled: true });
		const firstMount = renderHandler();
		firstMount.unmount();
		const secondMount = renderHandler();
		await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(2));
		getFeed.mockResolvedValue({
			items: [
				{
					id: 1,
					eventType: 'message.new',
					createdAt: '2026-09-14T12:00:00Z',
					readAt: null
				}
			],
			unreadCount: 1
		});

		receiveDirectMessage();
		await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(3));
		expect(constructed).toHaveLength(1);
		expect(bridge.listenerCount('directMessage')).toBe(1);

		secondMount.unmount();
		expect(bridge.listenerCount('directMessage')).toBe(0);
	});

	it('registers a Matrix directMessage listener', () => {
		renderHandler();
		expect(bridge.listenerCount('directMessage')).toBe(1);
	});

	// The regression: this is the exact path that stayed silent.
	it('fires once from the feed for an opt-in made in the cross-device panel', async () => {
		routePanel(true);
		notificationSettingsStore.updateSettings({
			browserNotifications: { enabled: true }
		});

		renderHandler();
		await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(1));
		getFeed.mockResolvedValue({
			items: [
				{
					id: 1,
					eventType: 'message.new',
					createdAt: '2026-09-14T12:00:00Z',
					readAt: null
				}
			],
			unreadCount: 1
		});
		receiveDirectMessage();
		await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(2));

		expect(constructed).toHaveLength(1);
		expect(constructed[0].options.eventType).toBe('message.new');
	});

	it('stays silent when the cross-device panel is switched off, even with a stale legacy key', async () => {
		routePanel(true);
		localStorage.setItem(
			'BROWSER_NOTIFICATIONS',
			JSON.stringify({ enabled: true, newMessage: true })
		);

		renderHandler();
		await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(1));
		getFeed.mockResolvedValue({
			items: [
				{
					id: 1,
					eventType: 'message.new',
					createdAt: '2026-09-14T12:00:00Z',
					readAt: null
				}
			],
			unreadCount: 1
		});
		receiveDirectMessage();
		await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(2));

		expect(constructed).toHaveLength(0);
	});

	it('fires once from the feed for an opt-in made in the legacy panel when that is the routed one', async () => {
		saveBrowserNotificationsSettings({ enabled: true });

		renderHandler();
		await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(1));
		getFeed.mockResolvedValue({
			items: [
				{
					id: 1,
					eventType: 'message.new',
					createdAt: '2026-09-14T12:00:00Z',
					readAt: null
				}
			],
			unreadCount: 1
		});
		receiveDirectMessage();
		await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(2));

		expect(constructed).toHaveLength(1);
	});

	// Dropping the call-site gate must not drop the legacy per-type switch.
	it('respects the legacy per-type switch for new messages', async () => {
		saveBrowserNotificationsSettings({ enabled: true });
		saveBrowserNotificationsSettings({ newMessage: false });

		renderHandler();
		await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(1));
		getFeed.mockResolvedValue({
			items: [
				{
					id: 1,
					eventType: 'message.new',
					createdAt: '2026-09-14T12:00:00Z',
					readAt: null
				}
			],
			unreadCount: 1
		});
		receiveDirectMessage();
		await waitFor(() => expect(getFeed).toHaveBeenCalledTimes(2));

		expect(constructed).toHaveLength(0);
	});

	it('ignores the consultant\u2019s own message', () => {
		saveBrowserNotificationsSettings({ enabled: true });

		renderHandler();
		act(() => {
			bridge.emit('directMessage', {
				roomId: '!room:oriso',
				isOwnMessage: true
			});
		});

		expect(constructed).toHaveLength(0);
	});
});

// Incoming activity must refresh other active views after the room update.
describe('active timeline refresh contract', () => {
	it.each([false, true])(
		'refreshes another active room only for incoming activity (own=%s)',
		(isOwnMessage) => {
			const refreshOtherRoom = vi.fn();
			const onMessage = (event: { roomId?: string }) => {
				if (!event.roomId || event.roomId === '!other:oriso')
					refreshOtherRoom();
			};
			messageEventEmitter.on(onMessage);
			try {
				render(<MatrixRealtimeHandler />);
				act(() =>
					bridge.emit('directMessage', {
						roomId: '!incoming:oriso',
						isOwnMessage
					})
				);
				expect(refreshOtherRoom).toHaveBeenCalledTimes(
					isOwnMessage ? 0 : 1
				);
			} finally {
				messageEventEmitter.off(onMessage);
			}
		}
	);
});
