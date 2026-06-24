/**
 * WP-06 Activity Timeline — selection controller hook (Slice 0b).
 *
 * Route-derived single source of truth for the active list item. Used by the
 * conversation list, the request list and the Activity Timeline so the
 * exactly-one-active invariant holds across all of them, instead of each
 * component computing (and drifting on) its own flag. See
 * `utils/listItemSelection` and CONTEXT.md "Active item".
 */

import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
	ActiveListSelection,
	ListItemIdentity,
	deriveActiveSelection,
	isListItemActive
} from '../utils/listItemSelection';

export interface UseActiveListItem {
	/** The active conversation identity derived from the current route. */
	selection: ActiveListSelection;
	/** Whether the given list item is the (single) active one. */
	isActive: (identity: ListItemIdentity) => boolean;
}

export const useActiveListItem = (): UseActiveListItem => {
	const { pathname } = useLocation();
	const selection = useMemo(
		() => deriveActiveSelection(pathname),
		[pathname]
	);
	const isActive = useMemo(
		() => (identity: ListItemIdentity) =>
			isListItemActive(selection, identity),
		[selection]
	);
	return { selection, isActive };
};
