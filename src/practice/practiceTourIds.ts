/**
 * Tour ids of the practice flows (spec section 6). They are the only ids the
 * network guard may ever allow a progress write for, and they must also be on
 * the UserService allowlist `tutorial.tours.frontend` in every environment.
 * Adding one here is a spec change.
 */
export const PRACTICE_TOUR_IDS = [
	'consultant-practice-accept',
	'consultant-practice-supervision'
] as const;

export type PracticeTourId = (typeof PRACTICE_TOUR_IDS)[number];

export const isPracticeTourId = (id: unknown): id is PracticeTourId =>
	typeof id === 'string' &&
	(PRACTICE_TOUR_IDS as readonly string[]).includes(id);
