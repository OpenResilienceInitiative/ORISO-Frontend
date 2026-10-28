import { useCallback } from 'react';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import { activityEventRoomId } from './activityEvent';
import { selectActivityEventsReadWithConversation } from './seenWhileReading';
import {
	ConversationPreviewModel,
	useConversationPreview
} from './useConversationPreview';
import { useSeenWhileReading } from './useSeenWhileReading';

export interface UseTimelineConversationInput {
	/** The selected card while it shows its conversation, else null. */
	event: NotificationFeedItem | null;
	feed: ReadonlyArray<NotificationFeedItem>;
	unreadOnly: boolean;
	markRead: (id: string) => void;
}

export interface TimelineConversation {
	/** Room, session, what the person may do there (#1824). */
	preview: ConversationPreviewModel | null;
	/** The preview's room, or the event's own while it is resolving. */
	roomId: string | null;
	/** D2: the conversation was read in `roomId`. */
	onConversationRead: (roomId: string) => void;
}

/**
 * #1888: the conversation behind the selected Timeline card, and how reading
 * it reads the Timeline.
 *
 * - D1: new cards of the room seen while the preview is open are read —
 *   never while the preview hides the conversation (#924).
 * - D2: reading the conversation reads its message cards, by the room the
 *   read happened in, so a card switched to while a send was running stays
 *   unread; under the unread filter the selected card stays in the list.
 */
export const useTimelineConversation = ({
	event,
	feed,
	unreadOnly,
	markRead
}: UseTimelineConversationInput): TimelineConversation => {
	const preview = useConversationPreview(event, { visible: Boolean(event) });
	useSeenWhileReading({
		roomId: preview?.roomId ?? null,
		threadRootId: preview?.threadRootId,
		enabled: Boolean(preview) && !preview?.capabilities.contentHidden,
		feed,
		unreadOnly,
		markRead
	});
	const selectedId = event?.id ?? null;
	const onConversationRead = useCallback(
		(roomId: string) =>
			selectActivityEventsReadWithConversation({
				feed,
				roomId,
				selectedId,
				unreadOnly
			}).forEach(markRead),
		[feed, markRead, selectedId, unreadOnly]
	);
	return {
		preview,
		roomId: preview?.roomId ?? (event ? activityEventRoomId(event) : null),
		onConversationRead
	};
};
