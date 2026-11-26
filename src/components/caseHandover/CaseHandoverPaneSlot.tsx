import * as React from 'react';
import { createContext, useContext, useState } from 'react';

/**
 * The detail pane element the session list may render the multi-case request
 * into (FE#2040): selecting cases in the list loads the reason step into the
 * existing right pane, like an appointment, instead of opening a pop-up.
 * `null` when no pane is mounted (tests, standalone lists); callers then
 * render the request in place.
 */
const CaseHandoverPaneSlotContext = createContext<{
	slot: HTMLElement | null;
	setSlot: (element: HTMLElement | null) => void;
}>({ slot: null, setSlot: () => undefined });

export const CaseHandoverPaneSlotProvider = ({
	children
}: {
	children: React.ReactNode;
}) => {
	const [slot, setSlot] = useState<HTMLElement | null>(null);
	const value = React.useMemo(() => ({ slot, setSlot }), [slot]);
	return (
		<CaseHandoverPaneSlotContext.Provider value={value}>
			{children}
		</CaseHandoverPaneSlotContext.Provider>
	);
};

/** Mount point inside the detail pane; covers the routed detail while filled. */
export const CaseHandoverPaneSlot = () => {
	const { setSlot } = useContext(CaseHandoverPaneSlotContext);
	return <div className="contentWrapper__caseHandoverSlot" ref={setSlot} />;
};

export const useCaseHandoverPaneSlot = () =>
	useContext(CaseHandoverPaneSlotContext).slot;
