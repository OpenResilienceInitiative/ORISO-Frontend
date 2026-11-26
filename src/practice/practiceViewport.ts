import { PRACTICE_CASE_HANDOVER_TOUR_ID } from './practiceTourIds';

/**
 * The real accept controls use fromL. "Fälle übergeben" keeps the former
 * F2's fromXL, where the real supervisor plus is interactive.
 */
export const canStartPracticeTourInViewport = (
	tourId: string,
	{ fromL, fromXL }: { fromL: boolean; fromXL: boolean }
): boolean => fromL && (tourId !== PRACTICE_CASE_HANDOVER_TOUR_ID || fromXL);
