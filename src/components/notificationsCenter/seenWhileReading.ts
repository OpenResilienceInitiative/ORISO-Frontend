/**
 * #1824 (D1): while a room's preview is visible, activity events that arrive
 * for that room count as seen. Activity read only: this selects event ids for
 * `markNotificationAsRead` and never touches Matrix read receipts.
 *
 * Only events that were not in the feed when the preview opened qualify
 * (opening alone reads nothing), and nothing is selected while "unread only"
 * is on: marking the selected card read would drop it from the list, move the
 * selection to the next card and cascade through the feed (#845).
 */
export const selectActivityEventsSeenWhileReading = ({
	feed,
	visibleRoomId,
	knownIds,
	resolveRoomId,
	isMessageEvent,
	unreadOnly
}: {
	feed: ReadonlyArray<{ id: string; readAt?: unknown }>;
	visibleRoomId: string | null;
	knownIds: ReadonlySet<string>;
	resolveRoomId: (item: any) => string | null;
	isMessageEvent: (item: any) => boolean;
	unreadOnly: boolean;
}): string[] =>
	visibleRoomId && !unreadOnly
		? feed
				.filter(
					(item) =>
						!item.readAt &&
						!knownIds.has(item.id) &&
						isMessageEvent(item) &&
						resolveRoomId(item) === visibleRoomId
				)
				.map((item) => item.id)
		: [];
