/**
 * Remembers whether a notification-setup message in the chat history is shown
 * in full or as its one-line summary (ORISO-Frontend#1700).
 *
 * It is a per-browser reading preference, not account data, so it lives in
 * localStorage rather than in the notification settings the server keeps.
 * The key holds only a one-way hash of the account id plus the id of the
 * message — never an e-mail address, user name or the raw account id — so two
 * accounts in one browser do not share a state.
 */
export type NotificationSetupCollapseState = 'collapsed' | 'expanded';

const KEY_PREFIX = 'oriso.notificationSetup.';

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

export const readNotificationSetupCollapseState = (
	accountId: string | undefined,
	messageId: string
): NotificationSetupCollapseState | undefined => {
	try {
		const stored = window.localStorage.getItem(
			keyFor(accountId, messageId)
		);
		return stored === 'collapsed' || stored === 'expanded'
			? stored
			: undefined;
	} catch {
		// Blocked site data: the message simply follows its channel state.
		return undefined;
	}
};

export const writeNotificationSetupCollapseState = (
	accountId: string | undefined,
	messageId: string,
	state: NotificationSetupCollapseState
): void => {
	try {
		window.localStorage.setItem(keyFor(accountId, messageId), state);
	} catch {
		// Not remembering is fine; the view still follows the person's click.
	}
};
