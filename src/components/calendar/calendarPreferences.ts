/**
 * Per-person conveniences of the calendar, kept in this browser only: how
 * the view switch looks and which colleagues' calendars were shown last.
 * Storage can be missing or blocked (private window); then the defaults
 * apply and nothing breaks.
 */
import type { ViewSwitcherStyle } from './calendarViews';

const key = (ownerId: string, name: string) =>
	`oriso.calendar.${name}.${ownerId || 'anonymous'}`;

const read = (k: string): string | null => {
	try {
		return window.localStorage.getItem(k);
	} catch {
		return null;
	}
};

const write = (k: string, value: string) => {
	try {
		window.localStorage.setItem(k, value);
	} catch {
		// Storage blocked: the choice lasts until the page reloads.
	}
};

export const readSwitcherStyle = (
	ownerId: string,
	fallback: ViewSwitcherStyle
): ViewSwitcherStyle => {
	const value = read(key(ownerId, 'switcher'));
	return value === 'menu' || value === 'digits' ? value : fallback;
};

export const writeSwitcherStyle = (ownerId: string, style: ViewSwitcherStyle) =>
	write(key(ownerId, 'switcher'), style);

/** How many recently shown colleagues get their own pill. */
export const MAX_RECENT_COLLEAGUES = 5;
/** Without a history, the first colleagues of the list fill the pills. */
export const DEFAULT_RECENT_COLLEAGUES = 3;

export const readRecentColleagues = (ownerId: string): string[] => {
	try {
		const parsed = JSON.parse(read(key(ownerId, 'recent')) ?? '[]');
		return Array.isArray(parsed)
			? parsed.filter((id) => typeof id === 'string')
			: [];
	} catch {
		return [];
	}
};

export const writeRecentColleagues = (ownerId: string, ids: string[]) =>
	write(key(ownerId, 'recent'), JSON.stringify(ids));

/**
 * The pills of "Kalender daneben": the last shown colleagues first (most
 * recent first), filled up from the list, only colleagues still in reach.
 */
export const recentPills = (
	recent: string[],
	colleagueIds: string[],
	max = MAX_RECENT_COLLEAGUES
) => {
	const known = recent.filter((id) => colleagueIds.includes(id));
	const fill = colleagueIds.filter((id) => !known.includes(id));
	return [
		...known,
		...fill.slice(0, Math.max(0, DEFAULT_RECENT_COLLEAGUES - known.length))
	].slice(0, max);
};

/** `id` was just shown: it moves to the front. */
export const rememberColleague = (recent: string[], id: string) =>
	[id, ...recent.filter((x) => x !== id)].slice(0, MAX_RECENT_COLLEAGUES);
