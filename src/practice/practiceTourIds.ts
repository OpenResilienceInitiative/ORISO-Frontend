/** Flow F1: accept an enquiry and answer it. */
export const PRACTICE_ACCEPT_TOUR_ID = 'consultant-practice-accept';
/**
 * The former flow F2 "Supervisor hinzufügen". FE#2545 (Frank): folded into
 * "Fälle übergeben"; no card and no tour runs under it any more. Kept to
 * honour an earlier completion (`withFoldedPracticeProgress`).
 */
export const PRACTICE_SUPERVISION_TOUR_ID = 'consultant-practice-supervision';
/**
 * FE#2545: the Live-Chat topic tour. Where practice is open it runs in the
 * practice world (a practice live chat arrives and is accepted); elsewhere
 * the Help list keeps its explanation tour under the same id.
 */
export const PRACTICE_LIVE_CHAT_TOUR_ID = 'consultant-live-chat';
/**
 * FE#2545: the Gesprächskreis topic tour. Where practice is open the
 * counsellor creates, opens and starts a practice circle; elsewhere the Help
 * list keeps its explanation tour under the same id.
 */
export const PRACTICE_GROUP_CIRCLE_TOUR_ID = 'consultant-group-circle';
/**
 * FE#2545: the Kalender topic tour. Where practice is open the counsellor
 * enters appointments, a Terminlink, a Sperrzeit and automatic confirmation
 * in a practice calendar; elsewhere the Help list keeps its explanation tour
 * under the same id.
 */
export const PRACTICE_CALENDAR_TOUR_ID = 'consultant-calendar';
/**
 * FE#2545: the "Fälle übergeben" topic tour. Where practice is open the
 * counsellor adds a supervisor (the former F2), offers her case to a
 * colleague and requests access to a colleague's case; elsewhere the Help
 * list keeps its explanation tour under the same id.
 */
export const PRACTICE_CASE_HANDOVER_TOUR_ID = 'consultant-case-handover';

/** The flows with a practice card of their own (Help → Meine Rundgänge). */
export const PRACTICE_CARD_TOUR_IDS = [PRACTICE_ACCEPT_TOUR_ID] as const;

/**
 * The only tour ids the network guard may ever allow a progress write for.
 * Each must also be on the UserService allowlist `tutorial.tours.frontend` in
 * every environment, so adding one is a product decision, not a code change.
 * The topic tours below already are (`TutorialProgressService`).
 */
export const PRACTICE_TOUR_IDS = [
	...PRACTICE_CARD_TOUR_IDS,
	PRACTICE_LIVE_CHAT_TOUR_ID,
	PRACTICE_GROUP_CIRCLE_TOUR_ID,
	PRACTICE_CALENDAR_TOUR_ID,
	PRACTICE_CASE_HANDOVER_TOUR_ID
] as const;

export type PracticeTourId = (typeof PRACTICE_TOUR_IDS)[number];
export type PracticeCardTourId = (typeof PRACTICE_CARD_TOUR_IDS)[number];

export const isPracticeTourId = (id: unknown): id is PracticeTourId =>
	typeof id === 'string' &&
	(PRACTICE_TOUR_IDS as readonly string[]).includes(id);

/** A flow that is started only from its own practice card. */
export const isPracticeCardTourId = (id: unknown): id is PracticeCardTourId =>
	typeof id === 'string' &&
	(PRACTICE_CARD_TOUR_IDS as readonly string[]).includes(id);
