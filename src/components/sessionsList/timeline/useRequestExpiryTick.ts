import { useEffect, useState } from 'react';
import type { SessionAppointment } from '../../../api/apiSessionAppointments';
import { pendingRequests } from './conversationAppointments';

/** The longest delay `setTimeout` honours (2^31 - 1 ms). */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/**
 * A request expires at its start (FE#2287): the caller renders again then,
 * without waiting for another update. Uses `pendingRequests`, so every
 * surface that shows requests agrees on the boundary.
 */
export const useRequestExpiryTick = (
	appointments: SessionAppointment[] | 'error' | undefined
): void => {
	const [expiryTick, setExpiryTick] = useState(0);
	useEffect(() => {
		if (!Array.isArray(appointments)) return undefined;
		const now = Date.now();
		const nextStart = pendingRequests(appointments, new Date(now))
			.map((a) => new Date(a.startTime).getTime())
			.sort((a, b) => a - b)[0];
		if (nextStart === undefined) return undefined;
		/* Browsers fire a delay above 2^31 - 1 ms (24.8 days) at once. A capped
		   wake-up only renders again, which sets the timer for what is left;
		   whether the request expired is always read from the clock. */
		const timer = window.setTimeout(
			() => setExpiryTick((n) => n + 1),
			Math.min(nextStart - now + 1, MAX_TIMER_DELAY_MS)
		);
		return () => window.clearTimeout(timer);
	}, [appointments, expiryTick]);
};
