import { PRACTICE_SUPERVISION_TOUR_ID } from './practiceTourIds';

/** The real accept controls use fromL; the supervisor plus uses fromXL. */
export const canStartPracticeTourInViewport = (
	tourId: string,
	{ fromL, fromXL }: { fromL: boolean; fromXL: boolean }
): boolean => fromL && (tourId !== PRACTICE_SUPERVISION_TOUR_ID || fromXL);
