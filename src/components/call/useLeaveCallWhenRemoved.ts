import { useEffect, useRef } from 'react';
import { chatTransportService } from '../../services/chatTransportService';
import type { CallData } from '../../services/CallManager';

export type CallRemoval = 'ban' | 'leave';

/**
 * The conversation a moderator removes people from: the group chat room
 * (`signalRoomId`), not the dedicated Element Call media room. 1:1 calls are
 * not watched — nobody is removed from a one-to-one chat.
 */
export const groupConversationRoomOf = (
	callData: Pick<CallData, 'isGroup' | 'signalRoomId'> | null | undefined
): string | null =>
	callData?.isGroup ? (callData.signalRoomId ?? null) : null;

/**
 * Ends this person's part in a running group call once they are no longer a
 * member of the call's conversation (ORISO-Admin#1518 follow-up).
 *
 * A moderator's "remove" bans the person from the Gesprächskreis's Matrix
 * room. That stops new call tokens (the call policy needs room membership)
 * but did not touch a call already running, so the removed person could
 * stay in it. Their own app sees the ban on its Matrix sync and leaves.
 *
 * `clientGeneration` changes when the Matrix client is replaced (token
 * refresh); the old client's listeners go with it, so the watch re-attaches.
 *
 * A stopped conversation (tombstone) is not handled here: stopping a
 * Gesprächskreis ends its call through the call lifecycle itself.
 */
export const useLeaveCallWhenRemoved = (
	conversationRoomId: string | null | undefined,
	isInGroupCall: boolean,
	onRemoved: (reason: CallRemoval) => void,
	clientGeneration = 0
): void => {
	const onRemovedRef = useRef(onRemoved);
	onRemovedRef.current = onRemoved;

	useEffect(() => {
		if (!conversationRoomId || !isInGroupCall) return undefined;
		const stop = chatTransportService.onMatrixRoomLifecycle(
			conversationRoomId,
			(change) => {
				if (change.type !== 'myMembership') return;
				if (
					change.membership === 'ban' ||
					change.membership === 'leave'
				) {
					onRemovedRef.current(change.membership);
				}
			}
		);
		return (): void => stop?.();
	}, [conversationRoomId, isInGroupCall, clientGeneration]);
};
