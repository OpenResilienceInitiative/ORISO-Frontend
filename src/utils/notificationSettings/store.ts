/**
 * WP-06 Slice 6a — cross-device notification settings (store + transport).
 *
 * A tiny observable singleton so both React (via `useNotificationSettings`)
 * and plain helpers (`sendNotification`) read the same state synchronously.
 *
 * Transport: Matrix **account data** on the user's homeserver —
 *   - `org.oriso.notification_settings`                      account-wide
 *   - `org.oriso.local_notification_settings.<deviceId>`     device-scoped
 *     (MSC3890 pattern: silencing one browser/device leaves the account and
 *     every other device untouched, yet the state itself still syncs, so a
 *     settings UI on any device can list and unmute the others later.)
 *
 * Degrades gracefully: before Matrix login (or in Storybook) the store works
 * from a localStorage mirror and swaps to account data once a client attaches.
 * On first attach, legacy `BROWSER_NOTIFICATIONS` localStorage settings are
 * migrated so nobody loses their existing choices.
 */

import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
	DEFAULT_LOCAL_DEVICE_SETTINGS,
	DEFAULT_NOTIFICATION_SETTINGS,
	LocalDeviceNotificationSettings,
	NotificationSettingsUpdate,
	OrisoNotificationSettings,
	mergeNotificationSettings,
	parseLocalDeviceSettings,
	parseNotificationSettings
} from './model';

export const NOTIFICATION_SETTINGS_EVENT_TYPE =
	'org.oriso.notification_settings';
export const LOCAL_DEVICE_SETTINGS_EVENT_PREFIX =
	'org.oriso.local_notification_settings';
export const localDeviceSettingsEventType = (deviceId: string): string =>
	`${LOCAL_DEVICE_SETTINGS_EVENT_PREFIX}.${deviceId}`;

/** localStorage mirror so the store works synchronously pre-login. */
const MIRROR_STORAGE_KEY = 'ORISO_NOTIFICATION_SETTINGS';
/** Legacy per-browser settings written by notificationHelpers. */
const LEGACY_STORAGE_KEY = 'BROWSER_NOTIFICATIONS';

export interface NotificationSettingsState {
	settings: OrisoNotificationSettings;
	device: LocalDeviceNotificationSettings;
	/** Where the current state came from (defaults → mirror → account). */
	source: 'defaults' | 'mirror' | 'account';
}

type Listener = () => void;

// matrix-js-sdk v38 types account-data event types as `keyof AccountDataEvents`
// (the spec-defined set). Custom `org.oriso.*` types are legal per spec but
// need widening — kept in two tiny wrappers so the casts live in one place.
const readAccountData = (client: MatrixClient, type: string): unknown =>
	client.getAccountData(type as any)?.getContent();
const writeAccountData = (
	client: MatrixClient,
	type: string,
	content: object
): Promise<unknown> =>
	client.setAccountData(type as any, content as any).catch(() => undefined);

const readMirror = (): OrisoNotificationSettings | null => {
	try {
		const raw = localStorage.getItem(MIRROR_STORAGE_KEY);
		return raw ? parseNotificationSettings(JSON.parse(raw)) : null;
	} catch {
		return null;
	}
};

const writeMirror = (settings: OrisoNotificationSettings): void => {
	try {
		localStorage.setItem(MIRROR_STORAGE_KEY, JSON.stringify(settings));
	} catch {
		/* storage full/unavailable — mirror is best-effort */
	}
};

/** One-time migration of the legacy per-browser settings shape. */
const migrateLegacySettings = (): NotificationSettingsUpdate | null => {
	try {
		const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
		if (!raw) {
			return null;
		}
		const legacy = JSON.parse(raw) as Record<string, unknown>;
		return {
			browserNotifications: {
				enabled: legacy.enabled === true
			},
			families: {
				messages: legacy.newMessage !== false,
				requests: legacy.initialEnquiry !== false
			}
		};
	} catch {
		return null;
	}
};

class NotificationSettingsStore {
	private state: NotificationSettingsState = {
		settings: readMirror() ?? DEFAULT_NOTIFICATION_SETTINGS,
		device: DEFAULT_LOCAL_DEVICE_SETTINGS,
		source: readMirror() ? 'mirror' : 'defaults'
	};

	private listeners = new Set<Listener>();

	private client: MatrixClient | null = null;

	private accountDataHandler = (event: MatrixEvent): void => {
		const type = event.getType();
		if (type === NOTIFICATION_SETTINGS_EVENT_TYPE) {
			this.setState({
				settings: parseNotificationSettings(event.getContent()),
				source: 'account'
			});
		} else if (type === this.deviceEventType()) {
			this.setState({
				device: parseLocalDeviceSettings(event.getContent())
			});
		}
	};

	getState(): NotificationSettingsState {
		return this.state;
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private setState(partial: Partial<NotificationSettingsState>): void {
		this.state = { ...this.state, ...partial };
		if (partial.settings) {
			writeMirror(partial.settings);
		}
		this.listeners.forEach((listener) => listener());
	}

	private deviceEventType(): string | null {
		const deviceId = this.client?.getDeviceId?.();
		return deviceId ? localDeviceSettingsEventType(deviceId) : null;
	}

	/**
	 * Attach the logged-in Matrix client: hydrate from account data, subscribe
	 * to remote changes, and seed account data once (migrating any legacy
	 * per-browser settings) if this account never stored settings before.
	 */
	attachClient(client: MatrixClient): void {
		if (this.client === client) {
			return;
		}
		this.detachClient();
		this.client = client;

		const existing = readAccountData(
			client,
			NOTIFICATION_SETTINGS_EVENT_TYPE
		) as Record<string, unknown> | undefined;
		if (existing && Object.keys(existing).length > 0) {
			this.setState({
				settings: parseNotificationSettings(existing),
				source: 'account'
			});
		} else {
			// First device of this account to know about Slice 6a: seed from
			// the mirror and the legacy localStorage shape, then persist.
			const legacy = migrateLegacySettings();
			const seeded = legacy
				? mergeNotificationSettings(this.state.settings, legacy)
				: this.state.settings;
			this.setState({ settings: seeded, source: 'account' });
			void writeAccountData(
				client,
				NOTIFICATION_SETTINGS_EVENT_TYPE,
				seeded
			);
		}

		const deviceType = this.deviceEventType();
		if (deviceType) {
			const deviceContent = readAccountData(client, deviceType);
			if (deviceContent) {
				this.setState({
					device: parseLocalDeviceSettings(deviceContent)
				});
			}
		}

		client.on('accountData' as any, this.accountDataHandler);
	}

	detachClient(): void {
		if (this.client) {
			this.client.removeListener(
				'accountData' as any,
				this.accountDataHandler
			);
			this.client = null;
		}
	}

	/** Merge-update the account-wide settings (optimistic, then persist). */
	updateSettings(update: NotificationSettingsUpdate): void {
		const settings = mergeNotificationSettings(this.state.settings, update);
		this.setState({ settings });
		if (this.client) {
			void writeAccountData(
				this.client,
				NOTIFICATION_SETTINGS_EVENT_TYPE,
				settings
			);
		}
	}

	/** Silence/unsilence THIS device only (account-wide settings untouched). */
	setDeviceSilenced(silenced: boolean): void {
		const device: LocalDeviceNotificationSettings = { silenced };
		this.setState({ device });
		const deviceType = this.deviceEventType();
		if (this.client && deviceType) {
			void writeAccountData(this.client, deviceType, device);
		}
	}

	/** Test seam. */
	resetForTests(): void {
		this.detachClient();
		this.state = {
			settings: DEFAULT_NOTIFICATION_SETTINGS,
			device: DEFAULT_LOCAL_DEVICE_SETTINGS,
			source: 'defaults'
		};
		this.listeners.clear();
	}
}

export const notificationSettingsStore = new NotificationSettingsStore();
