/**
 * WP-06 Activity Timeline — client-side timeline filter (Slice 1).
 *
 * Pure helpers backing the timeline's family filter chips and search box. The
 * family of an event comes from the event-descriptor registry (Slice 0a), so a
 * single source of truth drives both the card iconography and the chips.
 *
 * Search is **client-side only** over already-rendered strings (ADR-AT-01: the
 * server stores no display text and there is no server full-text search). The
 * caller supplies `getSearchText` so this module stays free of i18n/React.
 */

import { EventFamily } from './eventDescriptors/types';
import {
	getEventDescriptor,
	isKnownEventType
} from './eventDescriptors/registry';

/** The catch-all kind for event types without a seeded family (#1377 §5.1). */
export const OTHER_TIMELINE_KIND = 'other';
export type TimelineKindId = EventFamily | typeof OTHER_TIMELINE_KIND;

/**
 * The active family chip: one real family, `all`, or `null`. No chip selected
 * (`null`) means "no filter" — identical to `all`, which is kept for backward
 * compatibility but is no longer rendered as its own chip (design feedback
 * 2026-07-12: the default state IS "all"; a dedicated chip only duplicates it).
 */
export type TimelineFamilyFilter = 'all' | TimelineKindId | null;

/**
 * Canonical chip order. Mirrors the registry families; `appointments` is
 * included for completeness but is deferred (no event types seeded yet), so it
 * only ever appears if such an event is present.
 */
export const TIMELINE_FAMILY_ORDER: ReadonlyArray<EventFamily> = [
	'requests',
	'messages',
	'drafts',
	'handover',
	'calls',
	'system',
	'appointments'
];

export interface TimelineFilterState {
	family: TimelineFamilyFilter;
	query: string;
	/**
	 * Only keep unread items. A separate dimension on purpose: it composes
	 * with the family chip AND the search query (feedback 2026-07-12 — the
	 * chips act as refinements on top of the search, not as modes).
	 */
	unreadOnly?: boolean;
	/**
	 * Kinds whose own pill is off and that therefore travel with the
	 * Sonstiges chip (Frank 2026-09-16, `kindsUnderOther`).
	 */
	bundledUnderOther?: ReadonlyArray<string>;
}

/** Minimal shape the filter needs from a feed item. */
export interface TimelineFilterableItem {
	eventType?: string | null;
	readAt?: string | null;
}

/**
 * The kind of a row: its seeded family, or "Sonstiges" for an unseeded event
 * type (#1377 §5.1 — the registry renders such a row as a generic system
 * card, but the filter must never let it vanish under "System").
 */
export const timelineKindOf = (item: TimelineFilterableItem): TimelineKindId =>
	isKnownEventType(item?.eventType)
		? getEventDescriptor(item.eventType).family
		: OTHER_TIMELINE_KIND;

/** Chip/dialog order: the families, then the catch-all. */
export const TIMELINE_KIND_ORDER: ReadonlyArray<TimelineKindId> = [
	...TIMELINE_FAMILY_ORDER,
	OTHER_TIMELINE_KIND
];

const familyOf = timelineKindOf;

const normalize = (value: string): string => value.trim().toLowerCase();

const matchesFamily = (
	item: TimelineFilterableItem,
	family: TimelineFamilyFilter,
	bundledUnderOther: ReadonlyArray<string> = []
): boolean => {
	if (family === null || family === 'all') {
		return true;
	}
	const kind = familyOf(item);
	if (family === OTHER_TIMELINE_KIND) {
		return kind === OTHER_TIMELINE_KIND || bundledUnderOther.includes(kind);
	}
	return kind === family;
};

/**
 * The families actually present in the feed, in canonical order. Used to render
 * only the relevant chips (plus "All") instead of every possible family.
 */
export const getFamiliesInFeed = (
	items: ReadonlyArray<TimelineFilterableItem>
): TimelineKindId[] => {
	const present = new Set(items.map(familyOf));
	return TIMELINE_KIND_ORDER.filter((family) => present.has(family));
};

/**
 * Filter the feed by the active family chip and the search query. The query is
 * a case-insensitive substring match over `getSearchText(item)` (the
 * client-rendered title/text); an empty/whitespace query matches everything.
 */
export const filterTimelineItems = <T extends TimelineFilterableItem>(
	items: ReadonlyArray<T>,
	state: TimelineFilterState,
	getSearchText: (item: T) => string
): T[] => {
	const query = normalize(state.query || '');
	return items.filter((item) => {
		if (!matchesFamily(item, state.family, state.bundledUnderOther)) {
			return false;
		}
		if (state.unreadOnly && item.readAt) {
			return false;
		}
		if (!query) {
			return true;
		}
		return normalize(getSearchText(item) || '').includes(query);
	});
};
