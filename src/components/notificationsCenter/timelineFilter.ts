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
import { getEventDescriptor } from './eventDescriptors/registry';

/** The active family chip: one real family, or `all`. Exactly one at a time. */
export type TimelineFamilyFilter = 'all' | EventFamily;

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
}

/** Minimal shape the filter needs from a feed item. */
export interface TimelineFilterableItem {
	eventType?: string | null;
}

const familyOf = (item: TimelineFilterableItem): EventFamily =>
	getEventDescriptor(item?.eventType).family;

const normalize = (value: string): string => value.trim().toLowerCase();

const matchesFamily = (
	item: TimelineFilterableItem,
	family: TimelineFamilyFilter
): boolean => family === 'all' || familyOf(item) === family;

/**
 * The families actually present in the feed, in canonical order. Used to render
 * only the relevant chips (plus "All") instead of every possible family.
 */
export const getFamiliesInFeed = (
	items: ReadonlyArray<TimelineFilterableItem>
): EventFamily[] => {
	const present = new Set(items.map(familyOf));
	return TIMELINE_FAMILY_ORDER.filter((family) => present.has(family));
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
		if (!matchesFamily(item, state.family)) {
			return false;
		}
		if (!query) {
			return true;
		}
		return normalize(getSearchText(item) || '').includes(query);
	});
};
