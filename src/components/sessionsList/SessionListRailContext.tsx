/**
 * "Is this list currently the collapsed 80 px rail?"
 *
 * `SessionsListWrapper` already computes it (`isIconOnly`, fed by
 * `resolveStageLayout` → `STAGE_LAYOUT.RAIL_WIDTH`) but the rows are three
 * components away, and until now the rail was expressed only in CSS: the
 * `sessionsList__wrapper--iconOnly` sheet hid every field of the card and
 * rounded what was left. That is what produced the egg (a 50 % radius on a
 * 48 × 50 box) and why the rail could not carry a single piece of state.
 *
 * With this flag the row renders a different thing in the rail — the portrait
 * `SessionRailPill` — rather than a hidden version of the same thing.
 */
import * as React from 'react';
import { createContext, type ReactNode, useContext } from 'react';

const SessionListRailContext = createContext(false);

export const SessionListRailProvider = ({
	rail,
	children
}: {
	rail: boolean;
	children: ReactNode;
}) => (
	<SessionListRailContext.Provider value={rail}>
		{children}
	</SessionListRailContext.Provider>
);

/** False outside a provider — every list that never collapses stays a card list. */
export const useSessionListRail = (): boolean =>
	useContext(SessionListRailContext);
