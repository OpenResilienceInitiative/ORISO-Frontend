import { useEffect, useRef } from 'react';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import {
	latestActivityInRoom,
	selectActivityEventsSeenWhileReading
} from './seenWhileReading';

/**
 * #1824 (D1): while `roomId`'s preview is visible (`enabled`), activity
 * events that arrive for that room are marked read in the Timeline — never
 * the ones already there when it opened, never older ones loaded later, and
 * nothing under "unread only" (#845). Activity read only; no Matrix receipt.
 */
export const useSeenWhileReading = ({
	roomId,
	threadRootId = null,
	enabled,
	feed,
	unreadOnly,
	markRead
}: {
	roomId: string | null;
	threadRootId?: string | null;
	enabled: boolean;
	feed: ReadonlyArray<NotificationFeedItem>;
	unreadOnly: boolean;
	markRead: (id: string) => void;
}) => {
	const baseline = useRef<{ roomId: string; since: string } | null>(null);
	const marked = useRef(new Set<string>());

	useEffect(() => {
		if (!enabled || !roomId) {
			baseline.current = null;
			return;
		}
		if (baseline.current?.roomId !== roomId) {
			baseline.current = {
				roomId,
				since: latestActivityInRoom(feed, roomId)
			};
			marked.current = new Set();
			return;
		}
		selectActivityEventsSeenWhileReading({
			feed,
			visibleRoomId: roomId,
			threadRootId,
			since: baseline.current.since,
			unreadOnly
		})
			.filter((id) => !marked.current.has(id))
			.forEach((id) => {
				marked.current.add(id);
				markRead(id);
			});
	}, [enabled, roomId, threadRootId, feed, unreadOnly, markRead]);
};
