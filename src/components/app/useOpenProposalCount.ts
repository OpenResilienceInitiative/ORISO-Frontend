import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGetCalendarProposals } from '../../api/apiCalendar';
import { onReceivedProposalCount } from '../calendar/calendarProposalCount';

/** Fallback re-check; the calendar reports its own changes at once. */
export const PROPOSAL_COUNT_POLL_MS = 60000;

/**
 * Move proposals waiting for the counsellor (contract "move proposals v1"),
 * for the count on "Meine Termine": null until the first answer. Loads when
 * shown, when the tab becomes visible again and on a visible poll; takes the
 * calendar's own count whenever the calendar loads or answers proposals. A
 * failed load keeps the last count.
 */
export const useOpenProposalCount = (enabled: boolean): number | null => {
	const [count, setCount] = useState<number | null>(null);
	const mounted = useRef(true);
	const request = useRef(0);

	const load = useCallback(() => {
		const generation = ++request.current;
		apiGetCalendarProposals().then(
			(dto) => {
				if (mounted.current && generation === request.current)
					setCount(dto?.received?.length ?? 0);
			},
			// Keep the last known count; the next trigger retries.
			() => undefined
		);
	}, []);

	useEffect(() => {
		mounted.current = true;
		if (!enabled) return undefined;
		load();
		const isVisible = () => document.visibilityState !== 'hidden';
		const onVisibility = () => {
			if (isVisible()) load();
		};
		const stopListening = onReceivedProposalCount((next) => {
			// The calendar's count is newer than any load still on its way.
			request.current += 1;
			setCount(next);
		});
		document.addEventListener('visibilitychange', onVisibility);
		const interval = window.setInterval(() => {
			if (isVisible()) load();
		}, PROPOSAL_COUNT_POLL_MS);
		return () => {
			mounted.current = false;
			stopListening();
			document.removeEventListener('visibilitychange', onVisibility);
			window.clearInterval(interval);
		};
	}, [enabled, load]);

	return enabled ? count : null;
};
