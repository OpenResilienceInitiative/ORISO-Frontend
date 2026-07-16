/**
 * WP-06 Slice 6a — cross-device notification settings (model).
 *
 * Pure module (no React, no matrix-js-sdk): the settings shape, tolerant
 * parsing, partial merging and the single suppression gate. Transport lives in
 * `accountData.ts`/`store.ts`.
 *
 * Pattern adapted from Element Web's `models/notificationsettings` (AGPL —
 * pattern reimplemented, no code copied): preferences are a plain serialisable
 * object persisted in Matrix **account data**, so every device/browser of the
 * same user reads and writes the same state. Device-scoped silencing follows
 * the MSC3890 idea of a per-device account-data event.
 */

import { EventFamily } from '../../components/notificationsCenter/eventDescriptors/types';

/** Per-family on/off switches — mirrors the timeline's event families. */
export type FamilyToggles = Record<EventFamily, boolean>;

export interface OrisoNotificationSettings {
	/** Master mute across every device (account-wide). */
	globalMute: boolean;
	/** Which event families may notify at all. */
	families: FamilyToggles;
	browserNotifications: {
		/** Whether browser (Web Notification API) notifications are wanted. */
		enabled: boolean;
		/**
		 * Whether browser notifications may contain message content. Off by
		 * default: in a counselling context the preview on a lock screen is a
		 * privacy risk (Element ships the same toggle).
		 */
		showMessagePreview: boolean;
	};
	sounds: {
		/** Whether notification sounds play at all. */
		enabled: boolean;
	};
}

export const ALL_FAMILIES: ReadonlyArray<EventFamily> = [
	'requests',
	'messages',
	'drafts',
	'handover',
	'calls',
	'system',
	'appointments'
];

const defaultFamilies = (): FamilyToggles =>
	ALL_FAMILIES.reduce((acc, family) => {
		acc[family] = true;
		return acc;
	}, {} as FamilyToggles);

export const DEFAULT_NOTIFICATION_SETTINGS: OrisoNotificationSettings = {
	globalMute: false,
	families: defaultFamilies(),
	browserNotifications: {
		enabled: false,
		showMessagePreview: false
	},
	sounds: {
		enabled: true
	}
};

/** Device-scoped state (one account-data event per device, MSC3890 pattern). */
export interface LocalDeviceNotificationSettings {
	/** "Silence this device/browser" without touching account-wide settings. */
	silenced: boolean;
}

export const DEFAULT_LOCAL_DEVICE_SETTINGS: LocalDeviceNotificationSettings = {
	silenced: false
};

const asBoolean = (value: unknown, fallback: boolean): boolean =>
	typeof value === 'boolean' ? value : fallback;

/**
 * Parse untrusted content (account data / localStorage) into a full settings
 * object. Unknown fields are ignored, missing fields fall back to defaults —
 * old clients can always read what newer clients wrote and vice versa.
 */
export const parseNotificationSettings = (
	raw: unknown
): OrisoNotificationSettings => {
	const source = (raw ?? {}) as Record<string, any>;
	const families = defaultFamilies();
	if (source.families && typeof source.families === 'object') {
		ALL_FAMILIES.forEach((family) => {
			families[family] = asBoolean(
				source.families[family],
				families[family]
			);
		});
	}
	return {
		globalMute: asBoolean(
			source.globalMute,
			DEFAULT_NOTIFICATION_SETTINGS.globalMute
		),
		families,
		browserNotifications: {
			enabled: asBoolean(
				source.browserNotifications?.enabled,
				DEFAULT_NOTIFICATION_SETTINGS.browserNotifications.enabled
			),
			showMessagePreview: asBoolean(
				source.browserNotifications?.showMessagePreview,
				DEFAULT_NOTIFICATION_SETTINGS.browserNotifications
					.showMessagePreview
			)
		},
		sounds: {
			enabled: asBoolean(
				source.sounds?.enabled,
				DEFAULT_NOTIFICATION_SETTINGS.sounds.enabled
			)
		}
	};
};

export const parseLocalDeviceSettings = (
	raw: unknown
): LocalDeviceNotificationSettings => ({
	silenced: asBoolean(
		(raw as Record<string, any>)?.silenced,
		DEFAULT_LOCAL_DEVICE_SETTINGS.silenced
	)
});

/** Deep-partial of the settings shape, for merge updates. */
export type NotificationSettingsUpdate = {
	globalMute?: boolean;
	families?: Partial<FamilyToggles>;
	browserNotifications?: Partial<
		OrisoNotificationSettings['browserNotifications']
	>;
	sounds?: Partial<OrisoNotificationSettings['sounds']>;
};

/** Immutably merge a partial update into full settings. */
export const mergeNotificationSettings = (
	current: OrisoNotificationSettings,
	update: NotificationSettingsUpdate
): OrisoNotificationSettings => ({
	globalMute: update.globalMute ?? current.globalMute,
	families: { ...current.families, ...(update.families || {}) },
	browserNotifications: {
		...current.browserNotifications,
		...(update.browserNotifications || {})
	},
	sounds: { ...current.sounds, ...(update.sounds || {}) }
});

/**
 * THE suppression gate — every notification surface (browser notification,
 * sound, later push) asks this one question. Suppressed when the account is
 * muted, this device is silenced, or the event's family is switched off.
 */
export const isNotificationSuppressed = (
	settings: OrisoNotificationSettings,
	device: LocalDeviceNotificationSettings,
	family: EventFamily
): boolean =>
	settings.globalMute || device.silenced || !settings.families[family];
