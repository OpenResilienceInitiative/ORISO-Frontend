/**
 * WP-06 Activity Timeline — global list-item selection (Slice 0b).
 *
 * Single, route-derived source of truth for "which list item is active". Pure
 * functions (no React) so they can be unit-tested in isolation; the
 * `useActiveListItem` hook is a thin wrapper over `deriveActiveSelection`.
 *
 * Replaces the per-component active flags that drift apart and let several
 * items go "red" at once (CONTEXT.md "Active item"): `SessionListItemComponent`
 * computed `activeSession.rid === groupIdFromParam || activeSession.item.id ===
 * sessionIdFromParam` itself, which also failed to match Matrix rooms (the
 * `/session/:sessionId` route) so entering a chat room did not activate it.
 *
 * Invariant: exactly one active item. The active identity is derived once from
 * the URL and every list item compares against it, so two items cannot both be
 * active unless their identities collide (they don't — sessionId and groupId
 * are unique per conversation).
 */

import { matchPath } from 'react-router-dom';

/** The active conversation/request identity derived from the current route. */
export interface ActiveListSelection {
	/** RC group id / Matrix room id of the active conversation, if any. */
	groupId: string | null;
	/** Numeric session id (as string) of the active conversation, if any. */
	sessionId: string | null;
}

/** Identity of a single rendered list item, compared against the selection. */
export interface ListItemIdentity {
	/** RC group id (a.k.a. `rid`) or Matrix room id. */
	groupId?: string | number | null;
	/** Alias for `groupId` (matches `activeSession.rid`). */
	rid?: string | number | null;
	/** Numeric session id. */
	sessionId?: string | number | null;
}

/**
 * Session routes that carry an active conversation, most specific first. The
 * `write/` and `session/` literals must precede the generic `:rcGroupId`
 * patterns so those literal segments are never mistaken for a group id.
 * Covers consultant (`sessionView` / `sessionPreview`) and asker (`view`).
 */
const SESSION_ROUTE_PATTERNS: ReadonlyArray<string> = [
	'/sessions/:userType/:listType/write/:sessionId',
	'/sessions/:userType/:listType/session/:sessionId',
	'/sessions/:userType/:listType/:rcGroupId/:sessionId',
	'/sessions/:userType/:listType/:rcGroupId'
];

const EMPTY_SELECTION: ActiveListSelection = { groupId: null, sessionId: null };

const norm = (value: string | number | null | undefined): string | null => {
	const str = value == null ? '' : String(value).trim();
	return str.length ? str : null;
};

/**
 * Derive the active conversation identity from a pathname. Returns
 * `{ groupId: null, sessionId: null }` when no conversation is open (e.g. on a
 * bare list view or the timeline).
 */
export const deriveActiveSelection = (
	pathname: string
): ActiveListSelection => {
	if (!pathname) {
		return EMPTY_SELECTION;
	}
	for (const path of SESSION_ROUTE_PATTERNS) {
		// react-router v7: matchPath(pattern, pathname) — pattern first, and
		// `end: false` replaces v5's `exact: false` (prefix match).
		const match = matchPath<'rcGroupId' | 'sessionId', string>(
			{ path, end: false },
			pathname
		);
		if (match) {
			return {
				groupId: norm(match.params.rcGroupId),
				sessionId: norm(match.params.sessionId)
			};
		}
	}
	return EMPTY_SELECTION;
};

/**
 * Whether a given list item is the active one. Compares by sessionId first
 * (unique per conversation), then by groupId/rid. Normalises string vs number
 * so a numeric `item.id` matches the string route param — the mismatch that
 * previously left Matrix rooms un-highlighted.
 */
export const isListItemActive = (
	selection: ActiveListSelection | null | undefined,
	identity: ListItemIdentity
): boolean => {
	if (!selection) {
		return false;
	}
	const itemSessionId = norm(identity.sessionId);
	if (
		selection.sessionId != null &&
		itemSessionId != null &&
		itemSessionId === selection.sessionId
	) {
		return true;
	}
	const itemGroupId = norm(identity.groupId ?? identity.rid);
	if (
		selection.groupId != null &&
		itemGroupId != null &&
		itemGroupId === selection.groupId
	) {
		return true;
	}
	return false;
};

/**
 * Pick the single active key for a list whose items have their own key space
 * (e.g. the Activity Timeline, keyed by notification id) but should still defer
 * to the global route-derived conversation selection.
 *
 * Returns exactly one key (or null) by construction, so a list using it cannot
 * light up two items at once (CONTEXT.md "Active item" exactly-one invariant):
 *   1. if the route has an active conversation, the FIRST item whose identity
 *      matches it wins — the timeline follows the globally-active conversation;
 *   2. otherwise the list's own `fallbackKey` (its in-page selection) is used.
 *
 * Pure (no React) so it is unit-testable; the timeline calls it with the route
 * `selection` from {@link useActiveListItem}. On a standalone list route (no
 * conversation open, e.g. `/notifications`) the selection is empty, so the
 * fallback is always returned and behaviour is unchanged.
 */
export const pickActiveItemKey = <T>(
	items: ReadonlyArray<T>,
	selection: ActiveListSelection | null | undefined,
	getIdentity: (item: T) => ListItemIdentity,
	getKey: (item: T) => string | number | null | undefined,
	fallbackKey?: string | number | null
): string | null => {
	if (
		selection &&
		(selection.sessionId != null || selection.groupId != null)
	) {
		for (const item of items) {
			if (isListItemActive(selection, getIdentity(item))) {
				const key = getKey(item);
				if (key != null && String(key).length) {
					return String(key);
				}
			}
		}
	}
	return fallbackKey != null && String(fallbackKey).length
		? String(fallbackKey)
		: null;
};
