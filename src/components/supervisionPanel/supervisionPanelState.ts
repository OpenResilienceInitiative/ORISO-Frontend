/**
 * B2 — pure helpers behind the supervision side channel.
 *
 * The panel state itself is DERIVED from the URL since B2
 * (`utils/channelRoute.ts`: `?channel=supervision`), so there is no state
 * machine here any more. What stays is the message bookkeeping the host
 * (`SessionItemComponent`) needs: the unread count, the client-timeline
 * safety net and the "new message" detection. Free of React and Matrix so
 * the rules are unit-tested and ported 1:1.
 *
 * "Unread" = side-room messages from someone else that arrived after the
 * channel was last on screen; while it is on screen the count is 0.
 */

/** The minimal shape the helpers below read from a timeline item. */
export interface SideRoomMessageLike {
	_id: string;
	/** `prepareMessages` stores the epoch ms as a string in `messageTime`. */
	messageTime?: string;
	userId?: string;
	rid?: string;
}

const messageTs = (message: SideRoomMessageLike): number => {
	const parsed = Number(message.messageTime);
	return Number.isFinite(parsed) ? parsed : 0;
};

/** What the unread count needs to know about the channel's visibility. */
export interface SideRoomViewState {
	/** `expanded` = the channel is on screen. */
	status: 'expanded' | 'collapsed';
	/** Epoch ms of the last time the channel was on screen. */
	lastExpandedAt: number;
}

/**
 * Side-room messages from someone else that arrived after `lastExpandedAt`.
 * Own messages never count, and a shown channel always reports 0.
 */
export const countUnreadSideRoomMessages = (
	messages: ReadonlyArray<SideRoomMessageLike> | null | undefined,
	state: SideRoomViewState,
	isOwn: (userId: string) => boolean
): number => {
	if (!messages || state.status === 'expanded') {
		return 0;
	}
	return messages.filter(
		(message) =>
			messageTs(message) > state.lastExpandedAt &&
			!isOwn(message.userId || '')
	).length;
};

/**
 * Message split safety net: the client-facing timeline must never contain
 * side-room events. `SessionStream` keeps the rooms apart at load time and
 * stamps `rid` on side-room items; this drops anything that still carries
 * the side room id.
 */
export const excludeSideRoomMessages = <T extends SideRoomMessageLike>(
	messages: ReadonlyArray<T> | null | undefined,
	supervisionRoomId: string | null | undefined
): T[] => {
	if (!messages) {
		return [];
	}
	if (!supervisionRoomId) {
		return [...messages];
	}
	return messages.filter((message) => message.rid !== supervisionRoomId);
};

/**
 * Messages not seen before (by id). The caller keeps `knownIds` and decides
 * whether the first hydration counts (it should not: history is not "new").
 */
export const findUnseenMessages = <T extends SideRoomMessageLike>(
	messages: ReadonlyArray<T> | null | undefined,
	knownIds: ReadonlySet<string>
): T[] => (messages || []).filter((message) => !knownIds.has(message._id));
