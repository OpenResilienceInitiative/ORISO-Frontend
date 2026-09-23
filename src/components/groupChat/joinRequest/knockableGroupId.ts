import type { ExtendedSessionInterface } from '../../../globalState';
import type { GroupChatItemInterface } from '../../../globalState/interfaces';
import type { GroupChatAccess } from '../useGroupChatAccess';

/**
 * Mirrors the server's `ChatConverter.conversationTypeOf(Chat)`
 * (ORISO-UserService#1243): a stored type wins; a legacy group without one
 * is self-help only if it repeats more than once or has an interval. Not
 * `getModality`'s guess, which counts any repeat count — the app must never
 * offer a knock the server refuses with 400.
 */
const isSelfHelp = (chat: GroupChatItemInterface) =>
	chat.conversationType
		? chat.conversationType === 'SELF_HELP'
		: Boolean(chat.repetitive) ||
			(chat.repeatCount ?? 0) > 1 ||
			chat.chatInterval != null;

/**
 * The group a counsellor may knock on, or `undefined`. Only self-help groups
 * (Gesprächskreise) take knocks, never an internal team chat.
 */
export const knockableGroupId = (
	session: ExtendedSessionInterface | undefined,
	access: GroupChatAccess
): number | undefined =>
	access === 'notMember' &&
	session?.isGroup &&
	session.item &&
	isSelfHelp(session.item as GroupChatItemInterface)
		? session.item.id
		: undefined;
