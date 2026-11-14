/**
 * Per-person conveniences of the calendar, kept in this browser only: how
 * the view switch looks, which colleagues' calendars were shown last and
 * the remembered answer to "Nur an diesem Tag | Immer …" after dragging a
 * working-hours grip. Storage can be missing or blocked (private window);
 * then the defaults apply and nothing breaks.
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

const remove = (k: string) => {
	try {
		window.localStorage.removeItem(k);
	} catch {
		// Storage blocked: nothing was stored either.
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

/**
 * A moved working-hours grip applies to that date only (`day`) or to the
 * weekday from now on (`week`).
 */
export type EdgeChoice = 'day' | 'week';

/** The remembered answer ("Auswahl merken"), or null: ask every time. */
export const readEdgeChoice = (ownerId: string): EdgeChoice | null => {
	const value = read(key(ownerId, 'edgeChoice'));
	return value === 'day' || value === 'week' ? value : null;
};

/** null forgets it ("Gemerkte Auswahl vergessen"). */
export const writeEdgeChoice = (ownerId: string, choice: EdgeChoice | null) =>
	choice
		? write(key(ownerId, 'edgeChoice'), choice)
		: remove(key(ownerId, 'edgeChoice'));
