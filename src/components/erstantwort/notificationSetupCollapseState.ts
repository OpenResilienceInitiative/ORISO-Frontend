/**
 * Remembers that the person pressed the X on a notification-setup message in
 * the chat history (ORISO-Frontend#1700), so it stays a one-line summary after
 * a reload. Nothing else is stored: whether a channel is already reachable is
 * read from the account every time, and opening the setup again clears the X.
 *
 * It is a per-browser reading preference, not account data, so it lives in
 * localStorage rather than in the notification settings the server keeps. The
 * key holds only a one-way hash of the account id plus the id of the message,
 * never an e-mail address, user name or the raw account id, so two accounts in
 * one browser do not share it.
 */
const KEY_PREFIX = 'oriso.notificationSetup.dismissed.';

/** 32-bit FNV-1a; short and stable, only meant to keep ids out of the key. */
const hash = (value: string): string => {
	let result = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		result ^= value.charCodeAt(index);
		result = Math.imul(result, 0x01000193);
	}
	return (result >>> 0).toString(36);
};

const keyFor = (accountId: string | undefined, messageId: string) =>
	`${KEY_PREFIX}${hash(accountId ?? '')}.${hash(messageId)}`;

export const readNotificationSetupDismissed = (
	accountId: string | undefined,
	messageId: string
): boolean => {
	try {
		return (
			window.localStorage.getItem(keyFor(accountId, messageId)) === '1'
		);
	} catch {
		// Blocked site data: the message simply follows its channel state.
		return false;
	}
};

export const writeNotificationSetupDismissed = (
	accountId: string | undefined,
	messageId: string,
	dismissed: boolean
): void => {
	try {
		if (dismissed) {
			window.localStorage.setItem(keyFor(accountId, messageId), '1');
		} else {
			window.localStorage.removeItem(keyFor(accountId, messageId));
		}
	} catch {
		// Not remembering is fine; the view still follows the person's click.
	}
};
