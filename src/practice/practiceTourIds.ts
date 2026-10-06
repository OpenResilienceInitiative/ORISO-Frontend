/** Flow F1: accept an enquiry and answer it. */
export const PRACTICE_ACCEPT_TOUR_ID = 'consultant-practice-accept';
/** Flow F2: add a supervisor to an accepted case. */
export const PRACTICE_SUPERVISION_TOUR_ID = 'consultant-practice-supervision';

/**
 * The only tour ids the network guard may ever allow a progress write for.
 * Each must also be on the UserService allowlist `tutorial.tours.frontend` in
 * every environment, so adding one is a product decision, not a code change.
 */
export const PRACTICE_TOUR_IDS = [
	PRACTICE_ACCEPT_TOUR_ID,
	PRACTICE_SUPERVISION_TOUR_ID
] as const;

export type PracticeTourId = (typeof PRACTICE_TOUR_IDS)[number];

export const isPracticeTourId = (id: unknown): id is PracticeTourId =>
	typeof id === 'string' &&
	(PRACTICE_TOUR_IDS as readonly string[]).includes(id);
