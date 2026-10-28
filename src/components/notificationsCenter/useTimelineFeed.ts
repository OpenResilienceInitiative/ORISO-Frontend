import { useCallback, useMemo } from 'react';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import { useTimelineDrafts } from '../../hooks/useTimelineDrafts';
import { isTimelineDraftId, mergeDraftsIntoFeed } from './timelineDrafts';

/**
 * #1535: the Timeline's list is the provider feed plus the user's unsent
 * drafts. Drafts join here only, so they never ring, count as unread or reach
 * the server as a read receipt: `markRead` drops them.
 */
export const useTimelineFeed = (
	serverFeed: NotificationFeedItem[],
	markServerRead: (id: string) => void
) => {
	const drafts = useTimelineDrafts();
	const feed = useMemo(
		() => mergeDraftsIntoFeed(serverFeed, drafts),
		[serverFeed, drafts]
	);
	const markRead = useCallback(
		(id: string) => {
			if (!isTimelineDraftId(id)) markServerRead(id);
		},
		[markServerRead]
	);
	return { feed, markRead };
};
