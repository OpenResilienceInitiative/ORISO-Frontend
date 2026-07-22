import { v4 as uuidv4 } from 'uuid';
import { isNotificationSuppressed } from './notificationSettings/model';
import { notificationSettingsStore } from './notificationSettings/store';
import { EventFamily } from '../components/notificationsCenter/eventDescriptors/types';

type ExtraNotificationOptions = {
	showAlways?: boolean;
	onclick?: Function;
	onclose?: Function;
	onshow?: Function;
	/**
	 * WP-06 Slice 6a: the event family this notification belongs to — checked
	 * against the cross-device settings (global mute, per-family toggles,
	 * device silence). Defaults to `messages` for the legacy call sites.
	 */
	family?: EventFamily;
};

export const PERMISSION_GRANTED = 'granted';
export const PERMISSION_DEFAULT = 'default';

export const isSupported = () => {
	return 'Notification' in window && Notification.requestPermission;
};

export const hasPermissions = (permission: NotificationPermission) => {
	return Notification.permission === permission;
};

export const requestPermissions = () => {
	// Only ask for notification if not denied or granted already
	if (isSupported() && hasPermissions(PERMISSION_DEFAULT)) {
		Notification.requestPermission().then((permission) => {
			if (permission === PERMISSION_GRANTED) {
				sendNotification('Benachrichtigungen aktiviert!');
			}
		});
	}
};

export const sendNotification = (
	title: string,
	opts?: NotificationOptions & ExtraNotificationOptions
): void => {
	// If permissions not granted just ignore the notification because we only asking consultants
	if (
		!isSupported() ||
		!hasPermissions(PERMISSION_GRANTED) ||
		!browserNotificationsSettings().enabled
	) {
		return;
	}

	const options = opts || {};

	// WP-06 Slice 6a: honour the cross-device settings (account-wide mute,
	// per-family toggles and the per-device silence switch).
	const { settings, device } = notificationSettingsStore.getState();
	if (
		isNotificationSuppressed(settings, device, options.family || 'messages')
	) {
		return;
	}

	// If always is false and window has the focus do not send any notification
	if (!options.showAlways && document.hasFocus()) {
		return;
	}

	const notification = new Notification(title, {
		...options,
		tag: uuidv4(),
		icon: '/logo192.png'
	});

	notification.onshow = () => {
		// Sound obeys its own cross-device toggle (Slice 6a).
		// Sound is now driven decoupled from the OS popup (see soundPlayback.ts,
		// issue #576) so it also plays with the tab focused; no sound here.
		options.onshow && options.onshow(notification);
	};

	notification.onclick = () => {
		options.onclick && options.onclick(notification);
		notification.close();
	};

	notification.onclose = () => {
		options.onclose && options.onclose(notification);
	};
};

export const saveBrowserNotificationsSettings = (settings: {
	enabled?: boolean;
	initialEnquiry?: boolean;
	newMessage?: boolean;
	visited?: boolean;
}) => {
	const currentSettings = browserNotificationsSettings();
	// If is first time setting up the settings, set the default values to true
	if (Object.keys(currentSettings).length === 1) {
		currentSettings.newMessage = true;
		currentSettings.initialEnquiry = true;
	}
	localStorage.setItem(
		'BROWSER_NOTIFICATIONS',
		JSON.stringify({ ...currentSettings, ...settings })
	);
};

export const browserNotificationsSettings = (): {
	enabled: boolean;
	initialEnquiry: boolean;
	newMessage: boolean;
	visited: boolean;
} => {
	return JSON.parse(
		localStorage.getItem('BROWSER_NOTIFICATIONS') || '{ "enabled": false }'
	);
};

export const isBrowserNotificationTypeEnabled = (
	type: 'initialEnquiry' | 'newMessage'
) => {
	return (
		browserNotificationsSettings().enabled &&
		browserNotificationsSettings()[type]
	);
};
