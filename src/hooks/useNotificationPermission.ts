import { useEffect, useState } from 'react';
import {
	PERMISSION_DEFAULT,
	requestNotificationPermissionSafe
} from '../utils/notificationHelpers';

/**
 * Ask for browser-notification permission — needed e.g. for incoming-call
 * popups.
 *
 * The request fires on the user's FIRST pointer/keyboard gesture, not on a
 * timer: Safari only honours `Notification.requestPermission` from inside a
 * user gesture, and Chromium down-ranks sites that prompt without one
 * (#576 Safari review).
 */
export const useNotificationPermission = () => {
	const [permissionStatus, setPermissionStatus] =
		useState<NotificationPermission>('default');

	useEffect(() => {
		if (!('Notification' in window)) {
			return;
		}
		setPermissionStatus(Notification.permission);
		if (Notification.permission !== PERMISSION_DEFAULT) {
			return;
		}

		const remove = () => {
			window.removeEventListener('pointerdown', ask, true);
			window.removeEventListener('keydown', ask, true);
		};
		const ask = () => {
			remove();
			requestNotificationPermissionSafe().then(setPermissionStatus);
		};
		window.addEventListener('pointerdown', ask, true);
		window.addEventListener('keydown', ask, true);
		return remove;
	}, []);

	return permissionStatus;
};
