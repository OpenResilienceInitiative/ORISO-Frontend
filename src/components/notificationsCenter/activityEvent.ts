import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import { getEventDescriptor, isKnownEventType } from './eventDescriptors';
import { renderEventStrings } from './eventDescriptors/renderEventStrings';
import { toInterpolationValues } from './notificationActionTarget';
import type { PreviewChannelKind } from './previewCapabilities';
import { resolvePreviewChannel } from './previewChannel';

/**
 * #1824: the facts of one activity event, derived in ONE place from the feed
 * row. NotificationsCenter, the D1 rule and the conversation preview read
 * them from here instead of each parsing `params` and `actionPath` again.
 *
 * #1888 moved the session, route, case-handover and display derivations
 * here as well; the action target stays with the event descriptors.
 */
export type ActivityEventRow = Pick<
	NotificationFeedItem,
	'eventType' | 'category' | 'actionPath' | 'sourceSessionId' | 'params'
> &
	Partial<Pick<NotificationFeedItem, 'title' | 'text'>>;

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
	if (!roomSegment) {
		return null;
	}
	// A stored path is backend data: bad percent-encoding must not throw.
	try {
		return decodeURIComponent(roomSegment);
	} catch {
		return null;
	}
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

// Backend ids are positive integers written as digits; anything else is
// unusable rather than coerced ('1e3', ' 7', '1.5').
const toPositiveId = (value: unknown): number | null => {
	if (value === undefined || value === null) {
		return null;
	}
	const text = String(value);
	if (!/^\d+$/.test(text)) {
		return null;
	}
	const parsed = Number(text);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/** The counselling session of an event; never a series id. */
export const activityEventSessionId = (
	row: Pick<ActivityEventRow, 'sourceSessionId' | 'params'>
): number | null =>
	toPositiveId(row?.sourceSessionId ?? row?.params?.sourceSessionId);

const pathQuery = (path?: string | null): URLSearchParams =>
	new URLSearchParams(String(path || '').split('?')[1] || '');

/**
 * The id the conversation route carries for this event, so a route-active
 * conversation can find its card: the session, else the series id a series
 * card opens as `/session/<seriesId>` (registry.ts), else the trailing id of
 * the stored path. Selection only: never look a session up by it.
 */
export const activityEventRouteSessionId = (
	row: ActivityEventRow
): string | null => {
	const sessionId = activityEventSessionId(row);
	if (sessionId !== null) {
		return String(sessionId);
	}
	if (row?.params?.seriesId != null && row.params.seriesId !== '') {
		return String(row.params.seriesId);
	}
	const match = String(row?.actionPath || '').match(/\/(\d+)(?:\?|$)/);
	return match?.[1] || null;
};

/** The case-handover request: params first, else the stored path's query. */
export const activityEventCaseHandoverRequestId = (
	row: ActivityEventRow
): number | null => {
	const sent = row?.params?.caseHandoverRequestId;
	if (sent != null && sent !== '') {
		return toPositiveId(sent);
	}
	return toPositiveId(
		pathQuery(row?.actionPath).get('caseHandoverRequestId')
	);
};

/**
 * WP-06: the visible strings from the event descriptor's i18n templates
 * (ADR-AT-01 — the server record is text-free), falling back to the server's
 * title/text until the strict text-free migration (Slice 2).
 */
export const describeActivityEvent = (
	row: ActivityEventRow,
	translate: (key: string, options?: Record<string, unknown>) => string,
	language?: string
) => {
	const descriptor = getEventDescriptor(row?.eventType);
	const { title, text } = renderEventStrings(descriptor, translate, {
		fallbackTitle: row?.title,
		fallbackText: row?.text,
		// #846: params metadata feeds placeholders such as {{senderDisplayName}}.
		interpolation: toInterpolationValues(row?.params, language)
	});
	return { descriptor, title, text };
};

/** Where a message-like event lives: room, session, channel and thread. */
export const activityEventConversation = (
	row: ActivityEventRow
): ActivityEventConversation => {
	const channel = resolvePreviewChannel(row ?? {});
	return {
		roomId: activityEventRoomId(row),
		sessionId: activityEventSessionId(row),
		channelKind: channel.kind,
		threadRootId: channel.threadRootId
	};
};
