/**
 * WP-06 Slice 6a — unit coverage for the cross-device notification settings
 * (model + store transport against a mock Matrix client).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	DEFAULT_NOTIFICATION_SETTINGS,
	isDoNotDisturbActive,
	isNotificationSuppressed,
	mergeNotificationSettings,
	parseLocalDeviceSettings,
	parseNotificationSettings
} from './model';
import {
	NOTIFICATION_SETTINGS_EVENT_TYPE,
	localDeviceSettingsEventType,
	notificationSettingsStore
} from './store';

describe('WP-06 Slice 6a — notification settings model', () => {
	it('parses unknown/empty content into full defaults', () => {
		expect(parseNotificationSettings(undefined)).toEqual(
			DEFAULT_NOTIFICATION_SETTINGS
		);
		expect(parseNotificationSettings({})).toEqual(
			DEFAULT_NOTIFICATION_SETTINGS
		);
		expect(parseNotificationSettings({ junk: 1 })).toEqual(
			DEFAULT_NOTIFICATION_SETTINGS
		);
	});

	it('keeps known fields, tolerates unknown ones (forward compat)', () => {
		const parsed = parseNotificationSettings({
			globalMute: true,
			families: { messages: false, notAFamily: true },
			browserNotifications: { enabled: true, futureField: 'x' },
			futureTopLevel: {}
		});
		expect(parsed.globalMute).toBe(true);
		expect(parsed.families.messages).toBe(false);
		expect(parsed.families.calls).toBe(true); // default preserved
		expect(parsed.browserNotifications.enabled).toBe(true);
		expect(parsed.browserNotifications.showMessagePreview).toBe(false);
		expect((parsed as any).futureTopLevel).toBeUndefined();
	});

	it('merges deep-partial updates immutably', () => {
		const merged = mergeNotificationSettings(
			DEFAULT_NOTIFICATION_SETTINGS,
			{ families: { calls: false }, sounds: { enabled: false } }
		);
		expect(merged.families.calls).toBe(false);
		expect(merged.families.messages).toBe(true);
		expect(merged.sounds.enabled).toBe(false);
		expect(DEFAULT_NOTIFICATION_SETTINGS.families.calls).toBe(true);
	});

	it('suppression gate: global mute OR device silence OR family off', () => {
		const on = DEFAULT_NOTIFICATION_SETTINGS;
		const dev = { silenced: false };
		expect(isNotificationSuppressed(on, dev, 'messages')).toBe(false);
		expect(
			isNotificationSuppressed(
				{ ...on, globalMute: true },
				dev,
				'messages'
			)
		).toBe(true);
		expect(
			isNotificationSuppressed(on, { silenced: true }, 'messages')
		).toBe(true);
		expect(
			isNotificationSuppressed(
				mergeNotificationSettings(on, { families: { calls: false } }),
				dev,
				'calls'
			)
		).toBe(true);
	});

	it('parses device-scoped settings tolerantly', () => {
		expect(parseLocalDeviceSettings(undefined)).toEqual({
			silenced: false
		});
		expect(parseLocalDeviceSettings({ silenced: true })).toEqual({
			silenced: true
		});
	});
});

// --- Store transport against a mock Matrix client -------------------------

type Handler = (event: any) => void;

const makeMockClient = (deviceId = 'DEVICE_A') => {
	const accountData = new Map<string, any>();
	const handlers: Handler[] = [];
	const client = {
		getDeviceId: () => deviceId,
		getAccountData: (type: string) =>
			accountData.has(type)
				? { getContent: () => accountData.get(type) }
				: undefined,
		setAccountData: vi.fn(async (type: string, content: any) => {
			accountData.set(type, content);
		}),
		on: (_event: string, handler: Handler) => handlers.push(handler),
		removeListener: (_event: string, handler: Handler) => {
			const i = handlers.indexOf(handler);
			if (i >= 0) handlers.splice(i, 1);
		},
		/** Test helper: simulate account data arriving from another device. */
		emitAccountData: (type: string, content: any) => {
			accountData.set(type, content);
			handlers.forEach((h) =>
				h({ getType: () => type, getContent: () => content })
			);
		}
	};
	return client;
};

describe('WP-06 Slice 6a — notification settings store', () => {
	beforeEach(() => {
		notificationSettingsStore.resetForTests();
		localStorage.clear();
	});

	it('hydrates from existing account data on attach', () => {
		const client = makeMockClient();
		client.emitAccountData(NOTIFICATION_SETTINGS_EVENT_TYPE, {
			globalMute: true
		});
		notificationSettingsStore.attachClient(client as any);
		expect(notificationSettingsStore.getState().settings.globalMute).toBe(
			true
		);
		expect(notificationSettingsStore.getState().source).toBe('account');
	});

	it('seeds account data from legacy BROWSER_NOTIFICATIONS on first attach', () => {
		localStorage.setItem(
			'BROWSER_NOTIFICATIONS',
			JSON.stringify({
				enabled: true,
				newMessage: false,
				initialEnquiry: true
			})
		);
		const client = makeMockClient();
		notificationSettingsStore.attachClient(client as any);
		const { settings } = notificationSettingsStore.getState();
		expect(settings.browserNotifications.enabled).toBe(true);
		expect(settings.families.messages).toBe(false);
		expect(settings.families.requests).toBe(true);
		expect(client.setAccountData).toHaveBeenCalledWith(
			NOTIFICATION_SETTINGS_EVENT_TYPE,
			expect.objectContaining({
				browserNotifications: expect.objectContaining({ enabled: true })
			})
		);
	});

	it('updateSettings persists to account data and notifies subscribers', () => {
		const client = makeMockClient();
		notificationSettingsStore.attachClient(client as any);
		const listener = vi.fn();
		notificationSettingsStore.subscribe(listener);
		notificationSettingsStore.updateSettings({ globalMute: true });
		expect(listener).toHaveBeenCalled();
		expect(client.setAccountData).toHaveBeenLastCalledWith(
			NOTIFICATION_SETTINGS_EVENT_TYPE,
			expect.objectContaining({ globalMute: true })
		);
	});

	it('device silence writes ONLY the device-scoped event type', () => {
		const client = makeMockClient('DEVICE_B');
		notificationSettingsStore.attachClient(client as any);
		client.setAccountData.mockClear();
		notificationSettingsStore.setDeviceSilenced(true);
		expect(notificationSettingsStore.getState().device.silenced).toBe(true);
		expect(client.setAccountData).toHaveBeenCalledTimes(1);
		expect(client.setAccountData).toHaveBeenCalledWith(
			localDeviceSettingsEventType('DEVICE_B'),
			{ silenced: true }
		);
	});

	it('applies settings synced in from ANOTHER device (accountData event)', () => {
		const client = makeMockClient();
		notificationSettingsStore.attachClient(client as any);
		client.emitAccountData(NOTIFICATION_SETTINGS_EVENT_TYPE, {
			families: { calls: false }
		});
		expect(
			notificationSettingsStore.getState().settings.families.calls
		).toBe(false);
		// … but a foreign device's silence event does not silence THIS device.
		client.emitAccountData(localDeviceSettingsEventType('OTHER_DEVICE'), {
			silenced: true
		});
		expect(notificationSettingsStore.getState().device.silenced).toBe(
			false
		);
	});

	it('works without a client (mirror/defaults) and mirrors to localStorage', () => {
		notificationSettingsStore.updateSettings({
			sounds: { enabled: false }
		});
		expect(
			notificationSettingsStore.getState().settings.sounds.enabled
		).toBe(false);
		const mirrored = JSON.parse(
			localStorage.getItem('ORISO_NOTIFICATION_SETTINGS') || '{}'
		);
		expect(mirrored.sounds.enabled).toBe(false);
	});
});

describe('global do-not-disturb', () => {
	it('isDoNotDisturbActive is true while dndUntil is in the future', () => {
		const now = new Date('2026-07-18T10:00:00Z');
		expect(isDoNotDisturbActive('2026-07-18T11:00:00Z', now)).toBe(true);
	});

	it('isDoNotDisturbActive auto-reverts once dndUntil has passed', () => {
		const now = new Date('2026-07-18T10:00:00Z');
		expect(isDoNotDisturbActive('2026-07-18T09:00:00Z', now)).toBe(false);
	});

	it('isDoNotDisturbActive is false for null/empty', () => {
		expect(isDoNotDisturbActive(null, new Date())).toBe(false);
		expect(isDoNotDisturbActive('', new Date())).toBe(false);
	});

	it('suppresses every family while DND is active, even with mute off and family on', () => {
		const now = new Date('2026-07-18T10:00:00Z');
		const settings = {
			...DEFAULT_NOTIFICATION_SETTINGS,
			dndUntil: '2026-07-18T11:00:00Z'
		};
		expect(
			isNotificationSuppressed(
				settings,
				{ silenced: false },
				'messages',
				now
			)
		).toBe(true);
	});

	it('does not suppress once DND has expired (family still on)', () => {
		const now = new Date('2026-07-18T10:00:00Z');
		const settings = {
			...DEFAULT_NOTIFICATION_SETTINGS,
			dndUntil: '2026-07-18T09:00:00Z'
		};
		expect(
			isNotificationSuppressed(
				settings,
				{ silenced: false },
				'messages',
				now
			)
		).toBe(false);
	});
});
