import { useContext, useEffect, useMemo, useState } from 'react';
import { ActiveSessionContext } from '../globalState';
import { chatTransportService } from '../services/chatTransportService';

export type RoomUser = {
	_id: string;
	username: string;
	displayName?: string;
};

const mapMembersToRoomUsers = (members: any[]): RoomUser[] =>
	members
		.filter((member: any) => Boolean(member?.userId))
		.map((member: any) => {
			const userId = `${member.userId}`;
			const localPart = userId.split(':')[0].replace(/^@/, '');
			return {
				_id: userId,
				username: localPart,
				displayName: member?.name || member?.rawDisplayName || localPart
			};
		});

/**
 * Members of the active session's Matrix room, in the shape the legacy
 * Rocket.Chat users-of-room context used to provide. Sessions without a
 * Matrix room yield an empty list (graceful degradation).
 *
 * The Matrix client syncs with lazyLoadMembers, so the local member cache
 * can be partial. The hook loads the full membership from the homeserver
 * (loadMembersIfNeeded) before reading and re-reads on membership updates
 * (RoomState.members / RoomMember.membership).
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

		let cancelled = false;
		let retryTimer: number | null = null;
		let detachMembersListener: (() => void) | null = null;

		const refreshMembers = () => {
			chatTransportService
				.loadMatrixRoomMembers(matrixRoomId)
				.then((members) => {
					if (!cancelled) {
						setUsers(mapMembersToRoomUsers(members));
					}
				})
				.catch(() => {
					// keep the previous member state on transient errors
				});
		};

		const attachMembersListener = () => {
			detachMembersListener = chatTransportService.onMatrixRoomMembers(
				matrixRoomId,
				refreshMembers
			);
			return Boolean(detachMembersListener);
		};

		refreshMembers();

		// The Matrix client may not be initialized yet (e.g. right after
		// login) — retry until it is, then re-read the members once.
		if (!attachMembersListener()) {
			retryTimer = window.setInterval(() => {
				if (attachMembersListener()) {
					if (retryTimer) {
						window.clearInterval(retryTimer);
						retryTimer = null;
					}
					refreshMembers();
				}
			}, 500);
		}

		return () => {
			cancelled = true;
			if (retryTimer) {
				window.clearInterval(retryTimer);
			}
			detachMembersListener?.();
		};
	}, [matrixRoomId]);

	const moderators = useMemo(() => {
		const chatModerators: string[] =
			(activeSession?.item as any)?.moderators || [];
		return chatModerators;
	}, [activeSession?.item]);

	return { users, moderators };
};
