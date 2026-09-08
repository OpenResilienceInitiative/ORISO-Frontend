// @vitest-environment jsdom
/**
 * #576 — permission gating for OS notifications: no popup without browser
 * permission + user opt-in, and the Safari-safe requestPermission wrapper.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	requestNotificationPermissionSafe,
	saveBrowserNotificationsSettings,
	sendNotification
} from './notificationHelpers';
import { notificationSettingsStore } from './notificationSettings/store';
import { setKindField } from './notificationSettings/notificationConfig';
import { setAppConfig } from './appConfig';

const constructed: Array<{ title: string; options: any }> = [];

/** Installs a fake `Notification` global with the given permission state. */
const stubNotification = (
	permission: NotificationPermission,
	opts: { promise?: boolean; callback?: boolean } = { promise: true }
) => {
	class FakeNotification {
		static permission = permission;
		static requestPermission(cb?: (p: NotificationPermission) => void) {
			if (opts.callback) {
				cb && cb('granted');
				return undefined; // legacy Safari: no promise returned
			}
			return Promise.resolve('granted' as NotificationPermission);
		}
		onshow: any;
		onclick: any;
		onclose: any;
		constructor(title: string, options: any) {
			constructed.push({ title, options });
		}
	}
	vi.stubGlobal('Notification', FakeNotification);
};

/**
 * Which notification panel the `enableNewNotifications` release toggle routes
 * into the profile — and therefore which storage owns the opt-in (#1211).
 */
const routePanel = (crossDevice: boolean) =>
	setAppConfig({
		releaseToggles: { enableNewNotifications: crossDevice }
	} as any);

beforeEach(() => {
	constructed.length = 0;
	localStorage.clear();
	// The store is a module singleton, so opt-in state would otherwise leak
	// from one test into the next.
	notificationSettingsStore.resetForTests();
	routePanel(false);
});
afterEach(() => {
	vi.unstubAllGlobals();
	setAppConfig(null);
});

describe('sendNotification permission gate', () => {
	it('does NOT create an OS notification without browser permission', () => {
		stubNotification('denied');
		localStorage.setItem(
			'BROWSER_NOTIFICATIONS',
			JSON.stringify({ enabled: true })
		);
		sendNotification('Hallo', { showAlways: true });
		expect(constructed).toHaveLength(0);
	});

	it('does NOT create one when the user opt-in toggle is off', () => {
		stubNotification('granted');
		// default localStorage → enabled: false
		sendNotification('Hallo', { showAlways: true });
		expect(constructed).toHaveLength(0);
	});

	it('persistent banner mode sets requireInteraction on the OS popup', () => {
		stubNotification('granted');
		routePanel(true);
		notificationSettingsStore.updateSettings({
			browserNotifications: { enabled: true }
		});
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				notificationSettingsStore.getState().settings
					.notificationConfig,
				'conversations',
				'standard',
				'banner',
				'persistent'
			)
		});
		sendNotification('Hallo', {
			showAlways: true,
			family: 'messages',
			eventType: 'message.new'
		});
		expect(constructed).toHaveLength(1);
		expect(constructed[0].options.requireInteraction).toBe(true);
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				notificationSettingsStore.getState().settings
					.notificationConfig,
				'conversations',
				'standard',
				'banner',
				'temporary'
			)
		});
	});

	it('banner channel off for the event row suppresses the OS popup', () => {
		stubNotification('granted');
		routePanel(true);
		// Opt in for real, so the assertion below is about the banner channel
		// rather than about the opt-in gate stopping it first.
		notificationSettingsStore.updateSettings({
			browserNotifications: { enabled: true }
		});
		const { settings } = notificationSettingsStore.getState();
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				settings.notificationConfig,
				'conversations',
				'standard',
				'banner',
				'off'
			)
		});
		sendNotification('Hallo', {
			showAlways: true,
			family: 'messages',
			eventType: 'message.new'
		});
		expect(constructed).toHaveLength(0);
		// restore for later tests
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				notificationSettingsStore.getState().settings
					.notificationConfig,
				'conversations',
				'standard',
				'banner',
				'temporary'
			)
		});
	});

	it('creates one when permission granted AND user opted in', () => {
		stubNotification('granted');
		saveBrowserNotificationsSettings({ enabled: true });
		sendNotification('Hallo', { showAlways: true });
		expect(constructed).toHaveLength(1);
		expect(constructed[0].title).toBe('Hallo');
	});

	/*
	 * #1211. The cross-device panel (release toggle `enableNewNotifications`)
	 * writes the settings store; the legacy per-browser panel writes
	 * localStorage and is unreachable while that toggle is on. The gate read
	 * localStorage only, so opting in through the panel the user can actually
	 * see never delivered anything.
	 */
	it('honours an opt-in that came from the settings store', () => {
		stubNotification('granted');
		routePanel(true);
		notificationSettingsStore.updateSettings({
			browserNotifications: { enabled: true }
		});

		sendNotification('Hallo', { showAlways: true });

		expect(constructed).toHaveLength(1);
	});

	it('lets the settings store turn notifications back off', () => {
		stubNotification('granted');
		routePanel(true);
		// A migrated user whose stale legacy key still says "enabled".
		localStorage.setItem(
			'BROWSER_NOTIFICATIONS',
			JSON.stringify({ enabled: true })
		);
		notificationSettingsStore.updateSettings({
			browserNotifications: { enabled: false }
		});

		sendNotification('Hallo', { showAlways: true });

		expect(constructed).toHaveLength(0);
	});

	// The legacy panel is still the only UI when the release toggle is off, so
	// it is the one that decides while that is the case.
	it('still honours the legacy panel toggle', () => {
		stubNotification('granted');
		saveBrowserNotificationsSettings({ enabled: true });

		sendNotification('Hallo', { showAlways: true });

		expect(constructed).toHaveLength(1);
	});

	it('ignores the store while the legacy panel is the routed one', () => {
		stubNotification('granted');
		// Nothing the user could have switched on: the cross-device panel is
		// not rendered, so its state must not decide.
		notificationSettingsStore.updateSettings({
			browserNotifications: { enabled: true }
		});

		sendNotification('Hallo', { showAlways: true });

		expect(constructed).toHaveLength(0);
	});

	// The per-type switches only exist in the legacy panel; dropping the
	// call-site gates must not drop them with it.
	it('keeps the legacy per-type switches working', () => {
		stubNotification('granted');
		saveBrowserNotificationsSettings({ enabled: true });
		saveBrowserNotificationsSettings({ newMessage: false });

		sendNotification('Neue Nachricht', {
			showAlways: true,
			family: 'messages',
			eventType: 'message.new'
		});
		expect(constructed).toHaveLength(0);

		// … and the other switch is untouched.
		sendNotification('Neue Anfrage', {
			showAlways: true,
			family: 'requests',
			eventType: 'request.new'
		});
		expect(constructed).toHaveLength(1);
	});
});

describe('requestNotificationPermissionSafe', () => {
	it('resolves via the promise form (modern browsers)', async () => {
		stubNotification('default', { promise: true });
		await expect(requestNotificationPermissionSafe()).resolves.toBe(
			'granted'
		);
	});

	it('resolves via the legacy callback form (old Safari)', async () => {
		stubNotification('default', { callback: true });
		await expect(requestNotificationPermissionSafe()).resolves.toBe(
			'granted'
		);
	});

	it('resolves even when requestPermission throws synchronously', async () => {
		class ThrowingNotification {
			static permission: NotificationPermission = 'default';
			static requestPermission() {
				throw new Error('boom');
			}
		}
		vi.stubGlobal('Notification', ThrowingNotification);
		await expect(requestNotificationPermissionSafe()).resolves.toBe(
			'denied'
		);
	});

	it('falls back to the current permission when the promise rejects', async () => {
		class RejectingNotification {
			static permission: NotificationPermission = 'default';
			static requestPermission() {
				return Promise.reject(new Error('boom'));
			}
		}
		vi.stubGlobal('Notification', RejectingNotification);
		await expect(requestNotificationPermissionSafe()).resolves.toBe(
			'default'
		);
	});

	it("resolves 'denied' when notifications are unsupported", async () => {
		vi.stubGlobal('Notification', undefined);
		// isSupported() checks 'Notification' in window — delete outright
		// @ts-expect-error test override
		delete window.Notification;
		await expect(requestNotificationPermissionSafe()).resolves.toBe(
			'denied'
		);
	});
});
