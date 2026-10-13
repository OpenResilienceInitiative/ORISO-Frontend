import { useCallback, useEffect, useState } from 'react';
import { apiGetGroupChatInfo, FETCH_ERRORS } from '../../api';

export type GroupChatAccess =
	| 'member'
	| 'checking'
	| 'notMember'
	| 'unavailable';

interface GroupChatAccessInput {
	chatId?: number;
	isGroup: boolean;
	subscribed?: boolean;
	isConsultant: boolean;
}

/**
 * Whether a counsellor may open a group she is not in the room of (#1499).
 *
 * `/users/chat/room/<id>` returns a group to every counsellor, but the server
 * refuses the group itself (`/users/chat/<id>`, 403) to one of another
 * Beratungsstelle. Only a readable answer for this group means "member"; any
 * other outcome is "unavailable" with a retry, never the moderator room.
 */
export const useGroupChatAccess = ({
	chatId,
	isGroup,
	subscribed,
	isConsultant
}: GroupChatAccessInput): {
	access: GroupChatAccess;
	retry: () => void;
} => {
	const needsCheck = isGroup && isConsultant && !subscribed && !!chatId;
	const [attempt, setAttempt] = useState(0);
	const [result, setResult] = useState<{
		chatId?: number;
		attempt?: number;
		access: GroupChatAccess;
	}>({ access: 'member' });

	useEffect(() => {
		if (!needsCheck) {
			return;
		}
		let cancelled = false;
		apiGetGroupChatInfo(chatId)
			.then((info) =>
				info?.id === chatId
					? ('member' as const)
					: ('unavailable' as const)
			)
			.catch((error) =>
				error?.message === FETCH_ERRORS.FORBIDDEN
					? ('notMember' as const)
					: ('unavailable' as const)
			)
			.then((access) => {
				if (!cancelled) {
					setResult({ chatId, attempt, access });
				}
			});
		return () => {
			cancelled = true;
		};
	}, [needsCheck, chatId, attempt]);

	const retry = useCallback(() => setAttempt((count) => count + 1), []);

	if (!needsCheck) {
		return { access: 'member', retry };
	}
	return {
		access:
			result.chatId === chatId && result.attempt === attempt
				? result.access
				: 'checking',
		retry
	};
};
