import * as React from 'react';
import { createContext, useCallback, useMemo, useState } from 'react';

/**
 * Shared state between the client profile's footer and the one control on the
 * page that can change something: the allocation select (ORISO-Frontend#1192).
 *
 * The footer sits in `AskerInfo`, the select three levels down in
 * `RequestSessionAssign`. Threading two callbacks through `AskerInfoContent`
 * and `AskerInfoAssign` would put footer concerns into components that have no
 * other reason to know about it, so the pair talks through a context instead —
 * the same shape the rest of the profile already uses for session and user
 * data.
 *
 * `confirmNonce` rather than a registered callback: the footer only needs to
 * say "the user pressed next", and a counter lets the select react to that in
 * an effect without either side holding a function reference to the other.
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
	/** Incremented by the footer's next button; watched by the select. */
	confirmNonce: number;
	requestConfirm: () => void;
}

export const AskerInfoActionContext =
	createContext<AskerInfoActionContextValue>({
		hasPendingChange: false,
		setHasPendingChange: () => undefined,
		confirmNonce: 0,
		requestConfirm: () => undefined
	});

export const AskerInfoActionProvider = ({
	children
}: {
	children: React.ReactNode;
}) => {
	const [hasPendingChange, setHasPendingChange] = useState(false);
	const [confirmNonce, setConfirmNonce] = useState(0);

	const requestConfirm = useCallback(
		() => setConfirmNonce((nonce) => nonce + 1),
		[]
	);

	const value = useMemo(
		() => ({
			hasPendingChange,
			setHasPendingChange,
			confirmNonce,
			requestConfirm
		}),
		[hasPendingChange, confirmNonce, requestConfirm]
	);

	return (
		<AskerInfoActionContext.Provider value={value}>
			{children}
		</AskerInfoActionContext.Provider>
	);
};
