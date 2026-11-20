import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGetConsultantEnquiryCount } from '../../api/apiGetConsultantSessionList';
import { messageEventEmitter } from '../../services/messageEventEmitter';

/**
 * Fallback only (FE#1435): a colleague's takeover normally arrives as the
 * Matrix acceptance notice (`enquiryAccepted`); this re-check covers a missed
 * notice and enquiries without one (anonymous live chat).
 */
export const ENQUIRY_COUNT_POLL_MS = 30000;

/**
 * Open enquiries for the "Anfragen" nav badge (FE#1435): null until the
 * first answer. Reloads on the enquiry-list refresh signal (a new enquiry in
 * the feed, an enquiry accepted or denied here), on the Matrix acceptance
 * notice (a colleague took an enquiry), on a visible poll and when the tab
 * becomes visible again. A failed reload keeps the last count.
 */
export const useOpenEnquiryCount = (enabled: boolean): number | null => {
	const [count, setCount] = useState<number | null>(null);
	const inFlight = useRef(false);
	const rerun = useRef(false);
	const mounted = useRef(true);

	const load = useCallback(async () => {
		if (inFlight.current) {
			// A signal during a request must still be reflected afterwards.
			rerun.current = true;
			return;
		}
		inFlight.current = true;
		try {
			do {
				rerun.current = false;
				try {
					const next = await apiGetConsultantEnquiryCount();
					if (mounted.current) setCount(next);
				} catch {
					// Keep the last known count; the next trigger retries.
				}
			} while (rerun.current && mounted.current);
		} finally {
			inFlight.current = false;
		}
	}, []);

	useEffect(() => {
		mounted.current = true;
		if (!enabled) return;
		void load();
		const onEvent = (data: {
			refreshEnquiryList?: boolean;
			sessionId?: number;
			enquiryAccepted?: boolean;
		}) => {
			if (
				data?.refreshEnquiryList ||
				data?.sessionId ||
				data?.enquiryAccepted
			)
				void load();
		};
		const isVisible = () => document.visibilityState !== 'hidden';
		const onVisibility = () => {
			if (isVisible()) void load();
		};
		messageEventEmitter.on(onEvent);
		document.addEventListener('visibilitychange', onVisibility);
		const interval = window.setInterval(() => {
			if (isVisible()) void load();
		}, ENQUIRY_COUNT_POLL_MS);
		return () => {
			mounted.current = false;
			messageEventEmitter.off(onEvent);
			document.removeEventListener('visibilitychange', onVisibility);
			window.clearInterval(interval);
		};
	}, [enabled, load]);

	return enabled ? count : null;
};
