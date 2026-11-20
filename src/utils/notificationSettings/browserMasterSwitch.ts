/**
 * FE#1211 (Frank, 18 Nov): whether browser banners are on in this browser.
 *
 * The stored switch defaulted to off in every new browser, so nobody got a
 * banner until they found "Benachrichtigungen in diesem Browser erhalten".
 * Once the browser has granted permission the switch now counts as on, until
 * the user decides otherwise here; that decision is remembered per browser.
 */
const CHOICE_KEY = 'oriso.browserNotifications.choice';

type Choice = 'on' | 'off';

const readChoice = (): Choice | null => {
	try {
		const value = localStorage.getItem(CHOICE_KEY);
		return value === 'on' || value === 'off' ? value : null;
	} catch {
		return null;
	}
};

/** Call wherever the user flips the switch in this browser. */
export const recordBrowserNotificationsChoice = (enabled: boolean): void => {
	try {
		localStorage.setItem(CHOICE_KEY, enabled ? 'on' : 'off');
	} catch {
		/* storage unavailable: the permission default still applies */
	}
};

const currentPermission = (): NotificationPermission =>
	typeof window !== 'undefined' && 'Notification' in window
		? Notification.permission
		: 'denied';

export const effectiveBrowserNotificationsEnabled = (
	stored: boolean,
	permission: NotificationPermission = currentPermission()
): boolean => {
	if (permission !== 'granted') {
		return false;
	}
	const choice = readChoice();
	return choice === null ? true : choice === 'on' && stored;
};
