import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import {
	ActiveListSelection,
	pickActiveItemKey
} from '../../utils/listItemSelection';
import {
	activityEventRouteSessionId,
	isMessageActivityEvent
} from './activityEvent';
import { getNextNotificationId } from './notificationQueue';

export interface UseActivityTimelineInput {
	/** The cards the list shows, after display filter, chips and search. */
	feed: NotificationFeedItem[];
	/** The route's active conversation (useActiveListItem). */
	routeSelection: ActiveListSelection | null;
	/** Below the large breakpoint, where selecting opens the conversation. */
	isPhone: boolean;
	unreadOnly: boolean;
	markRead: (id: string) => void;
}

export interface ActivityTimeline {
	/** The ONE card shown, opened and advanced from. */
	selectedId: string | null;
	selectedEvent: NotificationFeedItem | null;
	select: (id: string) => void;
	/** The next unread card after the shown one, wrapping around (#845). */
	nextUnreadId: string | null;
	/** Whether the selected message card shows its conversation. */
	conversationShown: boolean;
	toggleConversation: () => void;
}

/**
 * #1888: which Timeline card is the selected one, and what follows from it.
 *
 * - Desktop keeps the first visible card selected so the detail pane is never
 *   empty; a phone selects nothing, because selecting opens the conversation
 *   there (design feedback 2026-07-12).
 * - The selection stays inside the visible feed.
 * - A route-active conversation's card wins over the in-page selection
 *   (WP-06 Slice 0b), so exactly one card is selected.
 * - #845: on desktop the shown card is read (Slack semantics), except under
 *   the unread filter, where reading would drop it from the list and
 *   cascade-read the feed one selection at a time.
 * - Display, Open and Next all anchor on the same card.
 * - A message card shows its conversation (preview-first, design feedback
 *   2026-07-12); closing it holds for that card only, and a feed refresh
 *   does not reopen it.
 */
export const useActivityTimeline = ({
	feed,
	routeSelection,
	isPhone,
	unreadOnly,
	markRead
}: UseActivityTimelineInput): ActivityTimeline => {
	const [pickedId, setPickedId] = useState<string | null>(
		isPhone ? null : (feed[0]?.id ?? null)
	);

	const inPageId = useMemo(() => {
		if (pickedId && feed.some((item) => item.id === pickedId)) {
			return pickedId;
		}
		return isPhone ? null : (feed[0]?.id ?? null);
	}, [feed, pickedId, isPhone]);

	useEffect(() => {
		if (pickedId !== inPageId) {
			setPickedId(inPageId);
		}
	}, [inPageId, pickedId]);

	const selectedId = useMemo(
		() =>
			pickActiveItemKey(
				feed,
				routeSelection,
				(item) => ({ sessionId: activityEventRouteSessionId(item) }),
				(item) => item.id,
				inPageId
			),
		[feed, routeSelection, inPageId]
	);

	const selectedEvent = useMemo(
		() => feed.find((item) => item.id === selectedId) || null,
		[feed, selectedId]
	);

	useEffect(() => {
		if (isPhone || unreadOnly) {
			return;
		}
		if (selectedEvent && !selectedEvent.readAt) {
			markRead(selectedEvent.id);
		}
	}, [isPhone, unreadOnly, selectedEvent, markRead]);

	const select = useCallback((id: string) => setPickedId(id), []);

	const [conversation, setConversation] = useState({
		forId: selectedId,
		open: true
	});
	const conversationOpen =
		conversation.forId === selectedId ? conversation.open : true;
	const toggleConversation = useCallback(
		() => setConversation({ forId: selectedId, open: !conversationOpen }),
		[selectedId, conversationOpen]
	);

	return {
		selectedId,
		selectedEvent,
		select,
		nextUnreadId: getNextNotificationId(feed, selectedId, true),
		conversationShown: Boolean(
			conversationOpen &&
				selectedEvent &&
				isMessageActivityEvent(selectedEvent)
		),
		toggleConversation
	};
};
