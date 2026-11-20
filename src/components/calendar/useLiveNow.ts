import { useEffect, useState } from 'react';

/** How often the live calendar re-reads the clock. */
export const LIVE_NOW_INTERVAL_MS = 30_000;

/**
 * "Now" for the calendar: the fixed date when Storybook or a test passes
 * one, otherwise the clock, refreshed every {@link LIVE_NOW_INTERVAL_MS} so
 * upcoming entries, the "soon" state, dialog validation and "today" stay
 * current while the page is open (also over midnight).
 */
export const useLiveNow = (fixedNow?: Date) => {
	const [live, setLive] = useState(() => new Date());
	useEffect(() => {
		if (fixedNow) return undefined;
		const timer = window.setInterval(
			() => setLive(new Date()),
			LIVE_NOW_INTERVAL_MS
		);
		return () => window.clearInterval(timer);
	}, [fixedNow]);
	return fixedNow ?? live;
};
