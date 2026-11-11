export const CONSULTANT_GROUP_CHAT_ROUTE =
	'/sessions/consultant/sessionView/chat/:chatId';
export const ASKER_GROUP_CHAT_ROUTE = '/sessions/user/view/chat/:chatId';

/** Only a chat id becomes a route: the value comes from the address bar. */
export const isGroupChatId = (value: unknown): value is string | number => {
	const text = String(value ?? '');
	// Beyond the safe range Number() rounds or turns Infinity: another route.
	return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text));
};

/**
 * A group in the counsellor's own session view — her waiting room with
 * "Chat starten" and Chat-Info (`JoinGroupChatView`), not the client's entry
 * room (#1499). The chat id stays distinct from one-to-one session ids.
 */
export const consultantGroupChatPath = (chatId: string | number): string =>
	CONSULTANT_GROUP_CHAT_ROUTE.replace(':chatId', String(chatId));

/** The registered participant's conversation route uses the same typed lookup. */
export const askerGroupChatPath = (chatId: string | number): string =>
	ASKER_GROUP_CHAT_ROUTE.replace(':chatId', String(chatId));
