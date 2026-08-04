/**
 * Pure queue logic for the timeline's "Next notification" button (#845).
 *
 * Scans forward from the anchor item, then wraps around — but the
 * wrap-around must never return the anchor itself: the old inclusive
 * loop made the button "advance" to the already-selected card, mark it
 * read invisibly and then die on the second click.
 */
export interface QueueItem {
	id: string;
	readAt?: string | null;
}

export const getNextNotificationId = (
	feed: readonly QueueItem[],
	fromId: string | null,
	unreadOnly: boolean
): string | null => {
	if (feed.length === 0) {
		return null;
	}
	const startIndex = fromId
		? feed.findIndex((item) => item.id === fromId)
		: -1;
	const matchesRule = (item: QueueItem) => !unreadOnly || !item.readAt;

	for (let i = startIndex + 1; i < feed.length; i++) {
		if (matchesRule(feed[i])) {
			return feed[i].id;
		}
	}
	for (let i = 0; i < startIndex; i++) {
		if (matchesRule(feed[i])) {
			return feed[i].id;
		}
	}
	return null;
};
