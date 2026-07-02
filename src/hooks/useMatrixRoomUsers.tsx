import { useContext, useEffect, useMemo, useState } from 'react';
import { ActiveSessionContext } from '../globalState';
import { chatTransportService } from '../services/chatTransportService';

export type RoomUser = {
	_id: string;
	username: string;
	displayName?: string;
};

/**
 * Members of the active session's Matrix room, in the shape the legacy
 * Rocket.Chat users-of-room context used to provide. Sessions without a
 * Matrix room yield an empty list (graceful degradation).
 */
export const useMatrixRoomUsers = (): {
	users: RoomUser[];
	moderators: string[];
} => {
	const { activeSession } = useContext(ActiveSessionContext);
	const [users, setUsers] = useState<RoomUser[]>([]);

	const matrixRoomId = useMemo(
		() => chatTransportService.resolveSession(activeSession).matrixRoomId,
		[activeSession]
	);

	useEffect(() => {
		if (!matrixRoomId) {
			setUsers([]);
			return;
		}

		const room = chatTransportService.getMatrixRoom(matrixRoomId);
		const members = room?.getMembers?.() || [];
		setUsers(
			members
				.filter((member: any) => Boolean(member?.userId))
				.map((member: any) => {
					const userId = `${member.userId}`;
					const localPart = userId.split(':')[0].replace(/^@/, '');
					return {
						_id: userId,
						username: localPart,
						displayName:
							member?.name || member?.rawDisplayName || localPart
					};
				})
		);
	}, [matrixRoomId]);

	const moderators = useMemo(() => {
		const chatModerators: string[] =
			(activeSession?.item as any)?.moderators || [];
		return chatModerators;
	}, [activeSession?.item]);

	return { users, moderators };
};
