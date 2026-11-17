/**
 * How long a Direkteinladung stays valid after its appointment ends (#2252,
 * decision 6): from "at the end" up to 48 hours, 24 hours preset. The
 * stepper counts in minutes below one hour and in hours above, so the list
 * a click opens stays short enough to scan.
 */

export const DEFAULT_VALIDITY_MINUTES = 24 * 60;
export const MAX_VALIDITY_MINUTES = 48 * 60;

const MINUTE_STEP = 15;
const HOUR = 60;

/** 0, 15, 30, 45, then 1 h … 48 h. */
export const VALIDITY_OPTIONS: readonly number[] = [
	...Array.from({ length: HOUR / MINUTE_STEP }, (_, i) => i * MINUTE_STEP),
	...Array.from(
		{ length: MAX_VALIDITY_MINUTES / HOUR },
		(_, i) => (i + 1) * HOUR
	)
];

export type ValidityStep = 'up' | 'down';

/**
 * The next option in the given direction. Stops at both ends; a value
 * between two options moves to the neighbour in that direction.
 */
export const stepValidity = (
	minutes: number,
	direction: ValidityStep
): number => {
	if (direction === 'up') {
		return (
			VALIDITY_OPTIONS.find((option) => option > minutes) ??
			MAX_VALIDITY_MINUTES
		);
	}
	const lower = VALIDITY_OPTIONS.filter((option) => option < minutes);
	return lower.length ? lower[lower.length - 1] : 0;
};

export interface ValidityParts {
	/** `end`: valid until the appointment ends, no extra time. */
	unit: 'end' | 'minutes' | 'hours';
	count: number;
}

/** What the field says: i18n picks the words from unit and count. */
export const validityParts = (minutes: number): ValidityParts => {
	if (minutes <= 0) return { unit: 'end', count: 0 };
	/* A stored value off the hour grid (e.g. 90) is shown exactly. */
	if (minutes < HOUR || minutes % HOUR !== 0)
		return { unit: 'minutes', count: minutes };
	return { unit: 'hours', count: minutes / HOUR };
};
