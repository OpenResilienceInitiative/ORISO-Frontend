/**
 * Where a failed send belongs (review B2 D-2). A composer sends to ONE of
 * three places — the client chat, a thread of it, or another room (the
 * supervision side room, `targetRoomId`) — and its "Sending message failed"
 * card plus the retry must stay in exactly that place. No React, no DOM.
 */
export interface FailedSendTargetFields {
	threadRootId?: string | null;
	/** The room the composer was told to send to; empty = the session's own room. */
	targetRoomId?: string | null;
}

export type FailedSendTarget =
	| { kind: 'main' }
	| { kind: 'thread'; rootId: string }
	| { kind: 'room'; roomId: string };

export const failedSendBelongsTo = (
	failed: FailedSendTargetFields,
	target: FailedSendTarget
): boolean => {
	const threadRootId = failed.threadRootId || null;
	const targetRoomId = failed.targetRoomId || null;
	switch (target.kind) {
		case 'main':
			return !threadRootId && !targetRoomId;
		case 'thread':
			return !targetRoomId && threadRootId === target.rootId;
		case 'room':
			return targetRoomId === target.roomId;
		default:
			return false;
	}
};
