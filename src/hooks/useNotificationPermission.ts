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
 * `enabled` withholds the request without unmounting the hook: an account
 * still owed its own password and a second factor cannot receive calls yet, so
 * the dialog would land over the account-setup gate — the screen that exists
 * to say the account is not usable. The reported status stays truthful
 * meanwhile; only the asking waits (#1481).
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
