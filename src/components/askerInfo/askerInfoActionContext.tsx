import * as React from 'react';
import { createContext, useMemo, useState } from 'react';

/**
 * Connects the client profile's footer to the one control on the page that can
 * change something: the allocation select (ORISO-Frontend#1192, job 2).
 *
 * The footer lives in `AskerInfo`, the select three levels down in
 * `RequestSessionAssign`. Passing a setter through `AskerInfoContent` and
 * `AskerInfoAssign` would put footer concerns into two components that have no
 * other reason to know about it, so the pair talks through a context instead —
 * the same shape the rest of the profile already uses for session and user data.
 *
 * Deliberately one-directional: the select only *reports* that a different
 * consultant is now chosen. Confirming the reassignment stays where it already
 * was, in the select's own overlay, so this change does not alter the assign
 * flow itself.
 */
export interface AskerInfoActionContextValue {
	/**
	 * True once the user picked an allocation that differs from the one the
	 * session already had. Drives the next button's primary state — the design
	 * asks for primary "only if something actionable that was not set prior was
	 * set by user".
	 */
	hasPendingChange: boolean;
	setHasPendingChange: (hasPendingChange: boolean) => void;
}

export const AskerInfoActionContext =
	createContext<AskerInfoActionContextValue>({
		hasPendingChange: false,
		setHasPendingChange: () => undefined
	});

export const AskerInfoActionProvider = ({
	children
}: {
	children: React.ReactNode;
}) => {
	const [hasPendingChange, setHasPendingChange] = useState(false);

	const value = useMemo(
		() => ({ hasPendingChange, setHasPendingChange }),
		[hasPendingChange]
	);

	return (
		<AskerInfoActionContext.Provider value={value}>
			{children}
		</AskerInfoActionContext.Provider>
	);
};
