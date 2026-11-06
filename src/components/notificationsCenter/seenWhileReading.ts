import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import {
	activityEventConversation,
	activityEventRoomId,
	isMessageActivityEvent
} from './activityEvent';

type FeedRow = Pick<
	NotificationFeedItem,
	| 'id'
	| 'createdAt'
	| 'readAt'
	| 'eventType'
	| 'category'
	| 'actionPath'
	| 'sourceSessionId'
	| 'params'
>;

const EPOCH = new Date(0).toISOString();

const isLater = (createdAt: string | undefined, since: string) =>
	Boolean(createdAt) && Date.parse(createdAt!) > Date.parse(since);

/**
 * #1824 (D1): the baseline of a preview — the newest activity event of the
 * room at the moment it opened. Server timestamps on both sides, so a skewed
 * device clock cannot shift it.
 */
export const latestActivityInRoom = (
	feed: ReadonlyArray<FeedRow>,
	roomId: string
): string =>
	feed
		.filter((row) => activityEventRoomId(row) === roomId)
		.reduce(
			(latest, row) =>
				isLater(row.createdAt, latest) ? row.createdAt : latest,
			EPOCH
		);

/**
 * #1824 (D1): while a room's preview is visible, message events that arrive
 * for that room count as seen. Activity read only: this selects ids for
 * `markNotificationAsRead` and never touches Matrix read receipts.
 *
 * Only events newer than the baseline qualify, so opening alone reads
 * nothing and older events loaded later (paging) stay unread. Nothing is
 * selected while "unread only" is on: marking the selected card read would
 * drop it from the list, move the selection and cascade (#845).
 */
export const selectActivityEventsSeenWhileReading = ({
	feed,
	visibleRoomId,
	threadRootId = null,
	since,
	unreadOnly
}: {
	feed: ReadonlyArray<FeedRow>;
	visibleRoomId: string | null;
	/** While a thread is shown, only that thread's events count. */
	threadRootId?: string | null;
	since: string | null;
	unreadOnly: boolean;
}): string[] =>
	visibleRoomId && since && !unreadOnly
		? feed
				.filter(
					(row) =>
						!row.readAt &&
						isLater(row.createdAt, since) &&
						isMessageActivityEvent(row) &&
						activityEventRoomId(row) === visibleRoomId &&
						(!threadRootId ||
							activityEventConversation(row).threadRootId ===
								threadRootId)
				)
				.map((row) => row.id)
		: [];

/**
 * #1824 (D2): reading a conversation from the preview reads its message
 * events in the Timeline. Under "unread only" the selected card stays: it
 * would otherwise leave the list and move the selection (#845).
 */
export const selectActivityEventsReadWithConversation = ({
	feed,
	roomId,
	selectedId,
	unreadOnly
}: {
	feed: ReadonlyArray<FeedRow>;
	roomId: string;
	selectedId: string | null;
	unreadOnly: boolean;
}): string[] =>
	feed
		.filter(
			(row) =>
				!row.readAt &&
				isMessageActivityEvent(row) &&
				activityEventRoomId(row) === roomId &&
				!(unreadOnly && row.id === selectedId)
		)
		.map((row) => row.id);
