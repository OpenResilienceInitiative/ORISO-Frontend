import * as React from 'react';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const WEEK = 7 * 24 * HOUR;

export type EnquiryWaitingUnit = 'minutes' | 'hours' | 'weeks';

export interface EnquiryWaitingTime {
	unit: EnquiryWaitingUnit;
	count: number;
}

/**
 * How long an open enquiry has waited (FE#2183): minutes under an hour, hours
 * up to a week (mail counselling promises an answer within 48 working hours,
 * so "47 Std." must stay readable), weeks after that.
 */
export const getEnquiryWaitingTime = (
	sinceMs: number,
	nowMs: number
): EnquiryWaitingTime | null => {
	if (!Number.isFinite(sinceMs)) {
		return null;
	}
	const elapsed = Math.max(0, nowMs - sinceMs);
	if (elapsed < HOUR) {
		return {
			unit: 'minutes',
			count: Math.max(1, Math.floor(elapsed / MINUTE))
		};
	}
	if (elapsed < WEEK) {
		return { unit: 'hours', count: Math.floor(elapsed / HOUR) };
	}
	return { unit: 'weeks', count: Math.floor(elapsed / WEEK) };
};

/** The current time, refreshed every minute while `enabled`. */
export const useMinuteClock = (enabled: boolean): number => {
	const [now, setNow] = React.useState(() => Date.now());
	React.useEffect(() => {
		if (!enabled) {
			return undefined;
		}
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), MINUTE);
		return () => window.clearInterval(timer);
	}, [enabled]);
	return now;
};
