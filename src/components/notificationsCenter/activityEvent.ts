import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import { getEventDescriptor, isKnownEventType } from './eventDescriptors';
import type { PreviewChannelKind } from './previewCapabilities';
import { resolvePreviewChannel } from './previewChannel';

/**
 * #1824: the facts of one activity event, derived in ONE place from the feed
 * row. NotificationsCenter, the D1 rule and the conversation preview read
 * them from here instead of each parsing `params` and `actionPath` again.
 *
 * The rest of the row's derivations (display text, case-handover request,
 * action target) still live in NotificationsCenter; moving them here is the
 * follow-up refactor.
 */
export type ActivityEventRow = Pick<
	NotificationFeedItem,
	'eventType' | 'category' | 'actionPath' | 'sourceSessionId' | 'params'
>;

export type ActivityEventCategory = 'system' | 'message';

export interface ActivityEventConversation {
	/** The Matrix room the event happened in (main, side or team room). */
	roomId: string | null;
	/** The counselling session; never a series id. */
	sessionId: number | null;
	channelKind: PreviewChannelKind | null;
	threadRootId: string | null;
}

/**
 * #847: params.roomRef when the backend sent it (#846), else the room segment
 * of the stored actionPath (/sessions/<role>/<list>/<roomId>/<sessionId>).
 */
export const activityEventRoomId = (row: ActivityEventRow): string | null => {
	if (row?.params?.roomRef) {
		return String(row.params.roomRef);
	}
	const path = row?.actionPath;
	if (!path) {
		return null;
	}
	const roomSegment = String(path)
		.split('?')[0]
		.split('/')
		.filter(Boolean)
		.find(
			(segment) => segment.startsWith('!') || segment.startsWith('%21')
		);
	return roomSegment ? decodeURIComponent(roomSegment) : null;
};

/**
 * WP-06: registry-driven for known event types; unknown or local-only types
 * keep the legacy heuristic (the row's own category, or a thread link).
 */
export const activityEventCategory = (
	row: ActivityEventRow
): ActivityEventCategory => {
	if (isKnownEventType(row?.eventType)) {
		return getEventDescriptor(row.eventType).category;
	}
	if (row?.category === 'message') {
		return 'message';
	}
	return resolvePreviewChannel(row ?? {}).threadRootId ? 'message' : 'system';
};

export const isMessageActivityEvent = (row: ActivityEventRow): boolean =>
	activityEventCategory(row) === 'message';

const toSessionId = (value: unknown): number | null => {
	if (value === undefined || value === null || value === '') {
		return null;
	}
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/** Where a message-like event lives: room, session, channel and thread. */
export const activityEventConversation = (
	row: ActivityEventRow
): ActivityEventConversation => {
	const channel = resolvePreviewChannel(row ?? {});
	return {
		roomId: activityEventRoomId(row),
		sessionId: toSessionId(
			row?.sourceSessionId ?? row?.params?.sourceSessionId
		),
		channelKind: channel.kind,
		threadRootId: channel.threadRootId
	};
};
