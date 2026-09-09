// @vitest-environment jsdom
/**
 * #1211 — the new-message browser notification driven through the REAL
 * WebsocketHandler path, not by calling the helper directly.
 *
 * That distinction is the point of this file. The bug was in the call site:
 * it repeated the opt-in check against the legacy localStorage key, so with
 * the cross-device panel routed (`enableNewNotifications`) an opt-in made in
 * the only panel the user can see never produced a popup. A test that calls
 * `sendNotification` itself walks straight past the gate that was wrong.
 */
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebsocketHandler } from './WebsocketHandler';
import {
	AppConfigContext,
	NotificationsContext,
	WebsocketConnectionDeactivatedContext
} from '../../globalState';
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
vi.mock('../../services/messageEventEmitter', () => ({
	messageEventEmitter: { emit: vi.fn() }
}));
// A stub transport: `connect` never fires its callback, so nothing subscribes
// and the component's own Matrix listener is all that drives the test.
vi.mock('@stomp/stompjs', () => ({
	Stomp: {
		over: () => ({
			debug: () => {},
			reconnect_delay: 0,
			connect: () => {},
			disconnect: () => {},
			deactivate: () => {}
		})
	}
}));
vi.mock('sockjs-client', () => ({ default: class SockJSStub {} }));
vi.mock('../incomingVideoCall/IncomingVideoCall', () => ({
	NOTIFICATION_TYPE_CALL: 'call'
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
			<NotificationsContext.Provider
				value={{ addNotification: () => {} } as any}
			>
				<WebsocketConnectionDeactivatedContext.Provider
					value={
						{ setWebsocketConnectionDeactivated: () => {} } as any
					}
				>
					<WebsocketHandler disconnect={false} />
				</WebsocketConnectionDeactivatedContext.Provider>
			</NotificationsContext.Provider>
		</AppConfigContext.Provider>
	);

/** What LiveService/Matrix delivers when someone else writes a message. */
const receiveDirectMessage = () =>
	act(() => {
		bridge.emit('directMessage', {
			roomId: '!room:oriso',
			timestamp: Date.now(),
			isOwnMessage: false
		});
	});

beforeEach(() => {
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
	vi.restoreAllMocks();
	setAppConfig(null);
});

describe('WebsocketHandler → new message notification', () => {
	it('registers a Matrix directMessage listener', () => {
		renderHandler();
		expect(bridge.listenerCount('directMessage')).toBe(1);
	});

	// The regression: this is the exact path that stayed silent.
	it('leaves cross-device delivery to the event provider to avoid duplicate popups', () => {
		routePanel(true);
		notificationSettingsStore.updateSettings({
			browserNotifications: { enabled: true }
		});

		renderHandler();
		receiveDirectMessage();

		expect(constructed).toHaveLength(0);
	});

	it('stays silent when the cross-device panel is switched off, even with a stale legacy key', () => {
		routePanel(true);
		localStorage.setItem(
			'BROWSER_NOTIFICATIONS',
			JSON.stringify({ enabled: true, newMessage: true })
		);

		renderHandler();
		receiveDirectMessage();

		expect(constructed).toHaveLength(0);
	});

	it('fires for an opt-in made in the legacy panel when that is the routed one', () => {
		saveBrowserNotificationsSettings({ enabled: true });

		renderHandler();
		receiveDirectMessage();

		expect(constructed).toHaveLength(1);
	});

	// Dropping the call-site gate must not drop the legacy per-type switch.
	it('respects the legacy per-type switch for new messages', () => {
		saveBrowserNotificationsSettings({ enabled: true });
		saveBrowserNotificationsSettings({ newMessage: false });

		renderHandler();
		receiveDirectMessage();

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
