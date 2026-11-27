import {
	PRACTICE_CALENDAR_TOUR_ID,
	PRACTICE_SUPERVISION_TOUR_ID
} from './practiceTourIds';

/**
 * The real accept controls use fromL; the supervisor plus uses fromXL. The
 * calendar keeps its compact layout up to `COMPACT_MAX_WIDTH` (960 px), and
 * that layout has no "Als Nächstes" list for the cancel step: its practice
 * flow needs `beyondCompactCalendar` (unset counts as compact).
 */
export const canStartPracticeTourInViewport = (
	tourId: string,
	{
		fromL,
		fromXL,
		beyondCompactCalendar = false
	}: { fromL: boolean; fromXL: boolean; beyondCompactCalendar?: boolean }
): boolean =>
	fromL &&
	(tourId !== PRACTICE_SUPERVISION_TOUR_ID || fromXL) &&
	(tourId !== PRACTICE_CALENDAR_TOUR_ID || beyondCompactCalendar);
