import { useEffect, useState } from 'react';
import {
	PERMISSION_DEFAULT,
	requestNotificationPermissionSafe
} from '../utils/notificationHelpers';
import { onFirstUserGesture } from '../utils/onFirstUserGesture';

/**
 * Ask for browser-notification permission — needed e.g. for incoming-call
 * popups.
 *
 * The request fires on the user's FIRST pointer/keyboard gesture, not on a
 * timer: Safari only honours `Notification.requestPermission` from inside a
 * user gesture, and Chromium down-ranks sites that prompt without one
 * (#576 Safari review).
 *
 * `enabled` withholds the request without unmounting the hook: an account still owed its password
 * and a second factor cannot receive calls, so the dialog would land over the setup gate. The
 * reported status stays truthful; only the asking waits.
 */
export const useNotificationPermission = (enabled = true) => {
	const [permissionStatus, setPermissionStatus] =
		useState<NotificationPermission>('default');

	useEffect(() => {
		if (!('Notification' in window)) {
			// Unsupported browsers cannot be asked — report a hard 'denied'
			// so consumers never treat them as requestable (#586 review).
			setPermissionStatus('denied');
			return;
		}
		setPermissionStatus(Notification.permission);
		if (!enabled || Notification.permission !== PERMISSION_DEFAULT) {
			return;
		}
		return onFirstUserGesture(() => {
			requestNotificationPermissionSafe().then(setPermissionStatus);
		});
	}, [enabled]);

	return permissionStatus;
};
