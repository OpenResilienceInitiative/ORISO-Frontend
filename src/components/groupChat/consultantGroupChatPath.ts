import { getSessionNavigationPath } from '../sessionsListItem/sessionsListItemHelpers';

/** Only a chat id becomes a route: the value comes from the address bar. */
export const isGroupChatId = (value: unknown): value is string | number =>
	/^[1-9]\d*$/.test(String(value ?? ''));

/**
 * A group in the counsellor's own session view — her waiting room with
 * "Chat starten" and Chat-Info (`JoinGroupChatView`), not the client's entry
 * room (#1499). Same route the session list opens for a group without a room.
 */
export const consultantGroupChatPath = (chatId: string | number): string =>
	getSessionNavigationPath({
		listPath: '/sessions/consultant/sessionView',
		sessionId: Number(chatId),
		isGroup: true,
		isAsker: false,
		isEmptyEnquiry: false,
		tabSuffix: ''
	});
