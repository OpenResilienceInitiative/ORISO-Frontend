/**
 * Which Activity-Timeline feed events change *which sessions exist* in a
 * list, and so must make the session lists refetch (#1206, #1429).
 *
 * Since the LiveService retirement (ORISO-UserService#901) the feed poll is
 * the only channel on which these events reach the client; the session lists
 * never looked at it. The mapping mirrors the retired STOMP mapping, keyed on
 * the persisted feed event types instead.
 */
export interface ListRefreshFlags {
	refreshEnquiryList: boolean;
	refreshSessionList: boolean;
}

const LIST_REFRESH_BY_FEED_EVENT: Readonly<Record<string, ListRefreshFlags>> = {
	// A new registered enquiry enters the request list only.
	'request.new': { refreshEnquiryList: true, refreshSessionList: false },
	// An anonymous client in the waiting room is a live-chat request.
	'waiting_room.client.joined': {
		refreshEnquiryList: true,
		refreshSessionList: false
	},
	// Accepting an enquiry moves it out of every counsellor's request list
	// and into the assignee's conversation list.
	'inquiry.accepted': {
		refreshEnquiryList: true,
		refreshSessionList: true
	},
	// A finished conversation leaves both lists.
	'conversation.finished': {
		refreshEnquiryList: true,
		refreshSessionList: true
	}
};

export const listRefreshForFeedEvent = (
	eventType: string | undefined | null
): ListRefreshFlags | null =>
	LIST_REFRESH_BY_FEED_EVENT[eventType ?? ''] ?? null;

/**
 * Combined refresh flags for a batch of feed rows the client has not seen
 * before, or `null` when none of them changes list membership.
 */
export const listRefreshForFeedItems = (
	items: ReadonlyArray<{ eventType?: string | null }>
): ListRefreshFlags | null =>
	items.reduce<ListRefreshFlags | null>((flags, item) => {
		const next = listRefreshForFeedEvent(item.eventType);
		if (!next) {
			return flags;
		}
		return {
			refreshEnquiryList:
				(flags?.refreshEnquiryList ?? false) || next.refreshEnquiryList,
			refreshSessionList:
				(flags?.refreshSessionList ?? false) || next.refreshSessionList
		};
	}, null);

/**
 * Feed rows whose id the client has not applied yet. The first page-0 load
 * seeds the known set without producing "new" rows, so mounting the app never
 * triggers a refetch of lists that were just fetched.
 */
export const pickUnseenFeedItems = <T extends { id: string | number }>(
	items: ReadonlyArray<T>,
	knownIds: Set<string>
): T[] => items.filter((item) => !knownIds.has(String(item.id)));
