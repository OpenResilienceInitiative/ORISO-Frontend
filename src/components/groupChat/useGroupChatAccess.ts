import { useEffect, useState } from 'react';
import { apiGetGroupChatInfo, FETCH_ERRORS } from '../../api';

export type GroupChatAccess = 'member' | 'checking' | 'notMember';

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
 * Beratungsstelle. Only that refusal means "not a member"; any other error
 * keeps today's view, since the server still guards start and join.
 */
export const useGroupChatAccess = ({
	chatId,
	isGroup,
	subscribed,
	isConsultant
}: GroupChatAccessInput): GroupChatAccess => {
	const needsCheck = isGroup && isConsultant && !subscribed && !!chatId;
	const [result, setResult] = useState<{
		chatId?: number;
		access: GroupChatAccess;
	}>({ access: 'member' });

	useEffect(() => {
		if (!needsCheck) {
			return;
		}
		let cancelled = false;
		apiGetGroupChatInfo(chatId)
			.then(() => 'member' as const)
			.catch((error) =>
				error?.message === FETCH_ERRORS.FORBIDDEN
					? ('notMember' as const)
					: ('member' as const)
			)
			.then((access) => {
				if (!cancelled) {
					setResult({ chatId, access });
				}
			});
		return () => {
			cancelled = true;
		};
	}, [needsCheck, chatId]);

	if (!needsCheck) {
		return 'member';
	}
	return result.chatId === chatId ? result.access : 'checking';
};
