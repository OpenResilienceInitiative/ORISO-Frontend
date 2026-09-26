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

const MEMBER_RETRY_INITIAL_DELAY_MS = 500;
const MEMBER_RETRY_MAX_DELAY_MS = 8000;
const MEMBER_RETRY_MAX_ATTEMPTS = 8;

/**
 * Members of the active session's Matrix room, in the shape the legacy
 * the room-members context provides. Sessions without a
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
		let retryAttempt = 0;
		let detachMembersListener: (() => void) | null = null;
		let refreshPromise: Promise<boolean> | null = null;

		// Resolves true only once the homeserver delivered the full membership;
		// the transport swallows a failed load and returns the partial cache.
		const refreshMembers = () => {
			if (refreshPromise) return refreshPromise;

			refreshPromise = chatTransportService
				.loadMatrixRoomMembers(matrixRoomId)
				.then((members) => {
					if (!cancelled) {
						const next = mapMembersToRoomUsers(members);
						setUsers((current) =>
							current.length === 0 && next.length === 0
								? current
								: next
						);
					}
					return Boolean(
						chatTransportService
							.getMatrixRoom(matrixRoomId)
							?.membersLoaded?.()
					);
				})
				.catch(() => false)
				.finally(() => {
					refreshPromise = null;
				});

			return refreshPromise;
		};

		const attachMembersListener = () => {
			detachMembersListener = chatTransportService.onMatrixRoomMembers(
				matrixRoomId,
				refreshMembers
			);
			return Boolean(detachMembersListener);
		};

		// The client can exist before the room reaches its sync store. Retry with
		// backoff and give up after a bound, since every message mounts this hook.
		const retryUntilComplete = (membersComplete: boolean) => {
			if (cancelled) return;
			if (membersComplete && detachMembersListener) return;
			if (retryAttempt >= MEMBER_RETRY_MAX_ATTEMPTS) return;

			const delay = Math.min(
				MEMBER_RETRY_INITIAL_DELAY_MS * 2 ** retryAttempt,
				MEMBER_RETRY_MAX_DELAY_MS
			);
			retryAttempt += 1;
			retryTimer = window.setTimeout(() => {
				retryTimer = null;
				if (!detachMembersListener) attachMembersListener();
				refreshMembers().then(retryUntilComplete);
			}, delay);
		};

		refreshMembers().then(retryUntilComplete);
		attachMembersListener();

		return () => {
			cancelled = true;
			if (retryTimer) {
				window.clearTimeout(retryTimer);
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
