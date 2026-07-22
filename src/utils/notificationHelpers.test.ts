// @vitest-environment jsdom
/**
 * #576 — permission gating for OS notifications: no popup without browser
 * permission + user opt-in, and the Safari-safe requestPermission wrapper.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	requestNotificationPermissionSafe,
	sendNotification
} from './notificationHelpers';

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

beforeEach(() => {
	constructed.length = 0;
	localStorage.clear();
});
afterEach(() => {
	vi.unstubAllGlobals();
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

	it('creates one when permission granted AND user opted in', () => {
		stubNotification('granted');
		localStorage.setItem(
			'BROWSER_NOTIFICATIONS',
			JSON.stringify({ enabled: true })
		);
		sendNotification('Hallo', { showAlways: true });
		expect(constructed).toHaveLength(1);
		expect(constructed[0].title).toBe('Hallo');
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
