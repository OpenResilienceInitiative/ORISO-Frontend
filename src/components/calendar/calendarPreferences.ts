/**
 * Per-person conveniences of the calendar, kept in this browser only: how
 * the view switch looks, which colleagues' calendars were shown last and
 * the remembered answer to "Nur an diesem Tag | Immer …" after dragging a
 * working-hours grip. Storage can be missing or blocked (private window);
 * then the defaults apply and nothing breaks.
 */
import type { ViewSwitcherStyle } from './calendarViews';
import { SESSIONS_LIST_RESIZE } from '../sessionsList/sessionsListResize.constants';
import { snapSessionsListWidth } from '../sessionsList/resizableHandleMath';

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

/**
 * Whether the working-hours and pause grips show in one's own calendar
 * (Frank *7.2: switchable in ⋮, so they do not distract). On by default.
 */
export const readShowGrips = (ownerId: string): boolean =>
	read(key(ownerId, 'grips')) !== 'off';

export const writeShowGrips = (ownerId: string, show: boolean) =>
	write(key(ownerId, 'grips'), show ? 'on' : 'off');

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

/* ------------------------------------------------------------------ */
/* The left column, sized like "Gespräche" (Frank, prototype v15): the  */
/* icon rail, the compact list or 397–500 px, 420 px to begin with.     */
/* ------------------------------------------------------------------ */

/** The icon rail: avatar and start time per appointment. */
export const LIST_RAIL_WIDTH = 80;
export const DEFAULT_LIST_WIDTH = 420;

export type CalendarListMode = 'rail' | 'compact' | 'full';

/** The same snaps as the "Gespräche" column: 80, 220 or 397–500. */
export const snapListWidth = (width: number) =>
	snapSessionsListWidth(
		width,
		LIST_RAIL_WIDTH,
		SESSIONS_LIST_RESIZE.EXPANDED_MAX_WIDTH
	);

export const listModeOf = (width: number): CalendarListMode =>
	width < SESSIONS_LIST_RESIZE.ICON_ONLY_THRESHOLD
		? 'rail'
		: width < SESSIONS_LIST_RESIZE.EXPANDED_MIN_WIDTH
			? 'compact'
			: 'full';

export const readListWidth = (ownerId: string): number => {
	const stored = Number(read(key(ownerId, 'listWidth')));
	return stored > 0 ? snapListWidth(stored) : DEFAULT_LIST_WIDTH;
};

export const writeListWidth = (ownerId: string, width: number) =>
	write(key(ownerId, 'listWidth'), String(width));
