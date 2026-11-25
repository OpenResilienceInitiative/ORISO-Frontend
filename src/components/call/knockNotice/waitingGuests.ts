import type { NotificationFeedItem } from '../../../globalState/provider/NotificationsProvider';

/** UserService `EventNotificationService.CALL_KNOCK_REQUESTED_EVENT`. */
export const CALL_KNOCK_REQUESTED = 'call.knock.requested';

/**
 * How far back a knock entry still counts. The server stops listing a knock
 * as waiting long before that; the window only keeps the app from asking
 * about conversations of last week.
 */
export const WAITING_GUEST_WINDOW_MS = 2 * 60 * 60 * 1000;

/** A conversation in which somebody knocked, as its knock entry names it. */
export interface WaitingConversation {
	sessionId: number;
	/** The conversation's Matrix room: the call starts in it. */
	roomId: string;
	isVideo: boolean;
	/** Where the conversation opens; `null` when the entry names no path. */
	path: string | null;
}

const sessionIdOf = (item: NotificationFeedItem): number | null => {
	const params = item.params as Record<string, unknown> | undefined;
	const raw = params?.sessionId ?? item.sourceSessionId;
	const id = typeof raw === 'number' ? raw : Number(raw);
	return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * The conversations with a recent knock entry, oldest entry first: where a
 * knock's conversation opens and which room its call starts in. Read or
 * unread: reading the entry does not let anybody in. Who waits is the
 * server's answer, never this list's, so nothing is cut off here.
 */
export const waitingConversations = (
	feed: ReadonlyArray<NotificationFeedItem>,
	nowMs: number
): WaitingConversation[] => {
	const byId = new Map<number, WaitingConversation & { at: number }>();
	feed.forEach((item) => {
		if (item.eventType !== CALL_KNOCK_REQUESTED) return;
		const at = Date.parse(item.createdAt);
		if (Number.isNaN(at) || nowMs - at > WAITING_GUEST_WINDOW_MS) return;
		const sessionId = sessionIdOf(item);
		const roomId = item.params?.roomRef;
		if (sessionId === null || typeof roomId !== 'string' || !roomId.trim())
			return;
		const known = byId.get(sessionId);
		// The newest entry describes the knock that may still be open.
		if (known && known.at >= at) return;
		byId.set(sessionId, {
			sessionId,
			roomId,
			isVideo: item.params?.medium === 'VIDEO',
			path: item.actionPath || null,
			at
		});
	});
	return [...byId.values()]
		.sort((left, right) => left.at - right.at)
		.map(({ at: _at, ...conversation }) => conversation);
};
