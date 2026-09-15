/**
 * Display filter — Zeitstrahl helpers (#1377 slice 3, spec §5.1/§6.3).
 *
 * Pure functions over feed rows: which kind a row belongs to, which rows
 * the effective filter shows, per-kind unread counts for the chips, and the
 * v1 badge formula. No React, no transport.
 */

import {
	KNOWN_EVENT_TYPES,
	getEventDescriptor
} from '../../components/notificationsCenter/eventDescriptors';
import {
	TIMELINE_KIND_ORDER,
	TimelineKindId,
	timelineKindOf
} from '../../components/notificationsCenter/timelineFilter';
import {
	OTHER_KIND_ID,
	resolveKindSetting
} from '../../components/displayFilter/displayFilterTypes';
import { DisplayFilter } from './model';

export { TIMELINE_KIND_ORDER, timelineKindOf };
export type { TimelineKindId };

/** Only seeded types can be hidden per type; "Sonstiges" never is (§5.1). */
const SEEDED_EVENT_TYPES: ReadonlySet<string> = new Set(KNOWN_EVENT_TYPES);

export interface TimelineFilterableRow {
	id: string;
	eventType?: string | null;
	readAt?: string | null;
}

/** Rows of a hidden kind, or of a per-event-type hidden type, are out. */
export const isTimelineRowVisible = (
	row: { eventType?: string | null },
	filter: DisplayFilter
): boolean => {
	const kind = timelineKindOf(row);
	if (!resolveKindSetting(filter, kind).show) {
		return false;
	}
	return !(
		row.eventType &&
		SEEDED_EVENT_TYPES.has(row.eventType) &&
		filter.hiddenEventTypes?.includes(row.eventType)
	);
};

export const applyTimelineFilter = <T extends { eventType?: string | null }>(
	rows: ReadonlyArray<T>,
	filter: DisplayFilter
): T[] => rows.filter((row) => isTimelineRowVisible(row, filter));

/**
 * True when the profile hides some (not all) event types of a shown kind:
 * the dialog renders the Show checkbox as "mixed" (§5.1).
 */
export const isTimelineKindPartiallyHidden = (
	filter: DisplayFilter,
	kind: TimelineKindId
): boolean => {
	if (kind === OTHER_KIND_ID || !resolveKindSetting(filter, kind).show) {
		return false;
	}
	const hidden = new Set(filter.hiddenEventTypes ?? []);
	if (hidden.size === 0) {
		return false;
	}
	const types = KNOWN_EVENT_TYPES.filter(
		(type) => getEventDescriptor(type).family === kind
	);
	const hiddenCount = types.filter((type) => hidden.has(type)).length;
	return hiddenCount > 0 && hiddenCount < types.length;
};

/** Unread rows per kind (drives the pill badges, §5.1). */
export const timelineUnreadByKind = (
	rows: ReadonlyArray<TimelineFilterableRow>
): Partial<Record<TimelineKindId, number>> => {
	const counts: Partial<Record<TimelineKindId, number>> = {};
	rows.forEach((row) => {
		if (row.readAt) {
			return;
		}
		const kind = timelineKindOf(row);
		counts[kind] = (counts[kind] ?? 0) + 1;
	});
	return counts;
};

/** Client-only rows (incoming calls, toasts) the server never counts. */
export const isLocalTimelineRow = (row: { id: string }): boolean =>
	row.id.startsWith('local-');

export interface TimelineBadge {
	/** What the rail shows (spec §6.3 v1 formula). */
	visibleUnreadCount: number;
	/** Unread server rows in the loaded pages the filter hides. */
	hiddenServerUnreadInLoadedPages: number;
}

/**
 * Spec §6.3 v1:
 *
 *     visibleUnreadCount =
 *         max(serverTotal − hiddenServerUnreadInLoadedPages,
 *             visibleServerUnreadInLoadedPages)
 *         + visibleLocalUnread
 *
 * `serverTotal` is the last API `unreadCount` as received (never the
 * locally incremented counter). The `max` clamp keeps the badge at or above
 * the unread rows on screen when a page-0 refresh lowered the total while
 * retained older rows stay locally unread.
 */
export const computeTimelineBadge = (
	rows: ReadonlyArray<TimelineFilterableRow>,
	filter: DisplayFilter,
	serverTotal: number,
	options: {
		/**
		 * Slice 7: the server already left the hidden event types out of
		 * `serverTotal` (v2 badge). Nothing is subtracted and the "up to N
		 * hidden" hint is off; the clamp against visible rows still applies.
		 */
		serverTotalExcludesHidden?: boolean;
	} = {}
): TimelineBadge => {
	let hiddenServer = 0;
	let visibleServer = 0;
	let visibleLocal = 0;
	rows.forEach((row) => {
		if (row.readAt) {
			return;
		}
		const visible = isTimelineRowVisible(row, filter);
		if (isLocalTimelineRow(row)) {
			if (visible) {
				visibleLocal += 1;
			}
		} else if (visible) {
			visibleServer += 1;
		} else {
			hiddenServer += 1;
		}
	});
	const total = Math.max(0, serverTotal);
	if (options.serverTotalExcludesHidden) {
		return {
			visibleUnreadCount: Math.max(total, visibleServer) + visibleLocal,
			hiddenServerUnreadInLoadedPages: 0
		};
	}
	return {
		visibleUnreadCount:
			Math.max(total - hiddenServer, visibleServer) + visibleLocal,
		hiddenServerUnreadInLoadedPages: hiddenServer
	};
};

/**
 * Slice 7: the seeded event types the effective filter hides — every type
 * of a hidden family plus the profile's per-type list — sorted so two
 * equal filters produce the same request and the same echo. Unseeded types
 * are "Sonstiges", which cannot be hidden, so they never appear here.
 */
export const hiddenTimelineEventTypes = (filter: DisplayFilter): string[] => {
	const hidden = new Set<string>(
		(filter.hiddenEventTypes ?? []).filter((type) =>
			SEEDED_EVENT_TYPES.has(type)
		)
	);
	KNOWN_EVENT_TYPES.forEach((type) => {
		if (!resolveKindSetting(filter, getEventDescriptor(type).family).show) {
			hidden.add(type);
		}
	});
	return Array.from(hidden).sort();
};

/** Ids the auto-read pass must PATCH: hidden, unread, server-known (§6.1). */
export const hiddenUnreadServerIds = (
	rows: ReadonlyArray<TimelineFilterableRow>,
	filter: DisplayFilter
): string[] =>
	rows
		.filter(
			(row) =>
				!row.readAt &&
				!isLocalTimelineRow(row) &&
				!isTimelineRowVisible(row, filter)
		)
		.map((row) => row.id);

/** Local rows the auto-read pass completes without a request (§6.1). */
export const hiddenUnreadLocalIds = (
	rows: ReadonlyArray<TimelineFilterableRow>,
	filter: DisplayFilter
): string[] =>
	rows
		.filter(
			(row) =>
				!row.readAt &&
				isLocalTimelineRow(row) &&
				!isTimelineRowVisible(row, filter)
		)
		.map((row) => row.id);
