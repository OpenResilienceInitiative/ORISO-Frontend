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
import {
	clampVolume,
	DEFAULT_NOTIFICATION_CONFIG,
	DEFAULT_VOLUME,
	NotificationConfig,
	parseNotificationConfig
} from './notificationConfig';
import { NEVER_NOTIFY_FAMILIES } from './notificationConfig';

/** Per-family on/off switches — mirrors the timeline's event families. */
export type FamilyToggles = Record<EventFamily, boolean>;

/** Tone and volume of system notices (they have no row in the dialog). */
export interface SystemTone {
	sound: SoundId;
	volume: number;
}

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
	/**
	 * Global do-not-disturb: ISO timestamp until which all announcements
	 * (toast/sound/push) are silenced, or null. Authoritative copy lives in
	 * UserService (cross-device); auto-reverts once passed. The persisted
	 * activity feed still fills while active.
	 */
	dndUntil: string | null;
	/** Per-area notification config (Figma dialog, #576). */
	notificationConfig: NotificationConfig;
	/** Chosen next to the system switch; the switch gates banner and tone. */
	systemTone: SystemTone;
	/**
	 * Which one-time default upgrades this config has seen. Stored configs
	 * hold every row explicitly, so a changed factory default needs this to
	 * tell "never chosen" from a deliberate choice made afterwards.
	 */
	notificationConfigRevision: number;
}

/**
 * 1 (FE#1435): the "Neue Anfrage" row rings by default. A config stored
 * before carries the old silent default, upgraded once on load.
 */
export const NOTIFICATION_SETTINGS_REVISION = 1;

const upgradeNotificationConfig = (
	config: NotificationConfig,
	revision: number
): NotificationConfig =>
	revision < 1 && config.requests.new.sound === 'none'
		? {
				...config,
				requests: {
					...config.requests,
					new: {
						...config.requests.new,
						sound: DEFAULT_NOTIFICATION_CONFIG.requests.new.sound
					}
				}
			}
		: config;

/** A curated sound choice; 'none' is silent, 'default' inherits the message sound. */
export type SoundId =
	| 'none'
	| 'default'
	| 'ring'
	| 'chime'
	| 'ding'
	| 'soft'
	| 'ton-1'
	| 'ton-2'
	| 'ton-3'
	| 'ton-4'
	| 'ton-5'
	| 'ton-6'
	| 'ton-7'
	| 'ton-8'
	| 'ton-9'
	| 'ton-10'
	| 'ton-11'
	| 'ton-12';

export const SOUND_IDS: ReadonlyArray<SoundId> = [
	'none',
	'default',
	'ring',
	'chime',
	'ding',
	'soft',
	'ton-1',
	'ton-2',
	'ton-3',
	'ton-4',
	'ton-5',
	'ton-6',
	'ton-7',
	'ton-8',
	'ton-9',
	'ton-10',
	'ton-11',
	'ton-12'
];

/** The 12 vendored notification tones offered in the config dialog (issue #576). */
export const NOTIFICATION_TONE_IDS: ReadonlyArray<SoundId> = [
	'ton-1',
	'ton-2',
	'ton-3',
	'ton-4',
	'ton-5',
	'ton-6',
	'ton-7',
	'ton-8',
	'ton-9',
	'ton-10',
	'ton-11',
	'ton-12'
];

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
	dndUntil: null,
	families: defaultFamilies(),
	browserNotifications: {
		enabled: false,
		showMessagePreview: false
	},
	notificationConfig: DEFAULT_NOTIFICATION_CONFIG,
	systemTone: { sound: 'ton-2', volume: DEFAULT_VOLUME },
	notificationConfigRevision: NOTIFICATION_SETTINGS_REVISION
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

/** A stored value that is not a usable tone falls back to ton-2 at medium. */
const parseSystemTone = (raw: unknown): SystemTone => {
	const source = (raw ?? {}) as Record<string, unknown>;
	const fallback = DEFAULT_NOTIFICATION_SETTINGS.systemTone;
	return {
		sound:
			typeof source.sound === 'string'
				? (source.sound as SoundId)
				: fallback.sound,
		volume:
			typeof source.volume === 'number' && Number.isFinite(source.volume)
				? clampVolume(source.volume)
				: fallback.volume
	};
};

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
		dndUntil: typeof source.dndUntil === 'string' ? source.dndUntil : null,
		notificationConfig: upgradeNotificationConfig(
			parseNotificationConfig(source.notificationConfig),
			typeof source.notificationConfigRevision === 'number'
				? source.notificationConfigRevision
				: 0
		),
		systemTone: parseSystemTone(source.systemTone),
		notificationConfigRevision: NOTIFICATION_SETTINGS_REVISION
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
	dndUntil?: string | null;
	notificationConfig?: NotificationConfig;
	systemTone?: Partial<SystemTone>;
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
	dndUntil:
		update.dndUntil !== undefined ? update.dndUntil : current.dndUntil,
	notificationConfig:
		update.notificationConfig !== undefined
			? update.notificationConfig
			: current.notificationConfig,
	systemTone: { ...current.systemTone, ...(update.systemTone || {}) },
	notificationConfigRevision: current.notificationConfigRevision
});

/**
 * Global do-not-disturb is active while {@code dndUntil} lies in the future.
 * Pure and time-injectable so it is deterministically testable; auto-reverts
 * once the timestamp passes without any cleanup.
 */
export const isDoNotDisturbActive = (
	dndUntil: string | null | undefined,
	now: Date = new Date()
): boolean => {
	if (!dndUntil) {
		return false;
	}
	const until = new Date(dndUntil).getTime();
	return !Number.isNaN(until) && until > now.getTime();
};

/**
 * THE suppression gate — every notification surface (browser notification,
 * sound, later push) asks this one question. Suppressed when do-not-disturb is
 * active, the account is muted, this device is silenced, or the event's family
 * is switched off.
 */
export const isNotificationSuppressed = (
	settings: OrisoNotificationSettings,
	device: LocalDeviceNotificationSettings,
	family: EventFamily,
	now: Date = new Date()
): boolean => {
	if (
		isDoNotDisturbActive(settings.dndUntil, now) ||
		settings.globalMute ||
		device.silenced
	) {
		return true;
	}
	// Harmonised model (2026-07-22): some families never notify (drafts);
	// system keeps its single global switch; every other family is governed
	// per-channel by the notification config (banner / sound / email).
	if (NEVER_NOTIFY_FAMILIES.includes(family)) {
		return true;
	}
	if (family === 'system') {
		return !settings.families.system;
	}
	return false;
};
