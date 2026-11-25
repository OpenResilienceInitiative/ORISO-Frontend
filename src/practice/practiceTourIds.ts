/**
 * FE#2545: the Einführung. Where practice can run it is a first look around
 * the workspace while a practice enquiry is opened, accepted and answered
 * (it absorbed the old card F1 "Übung: Anfrage annehmen",
 * `consultant-practice-accept`); elsewhere, and for the auto-start, the
 * watch-only Einführung runs under the same id.
 */
export const PRACTICE_INTRO_TOUR_ID = 'consultant-walkthrough';
/**
 * FE#2545: the Supervision topic tour. The id of the old card F2 ("Übung:
 * Supervision hinzufügen"), already on the UserService allowlist; version 2
 * shows it as new. It has no card any more and runs from Help → Rundgänge.
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
 * The only tour ids the network guard may ever allow a progress write for.
 * Each must also be on the UserService allowlist `tutorial.tours.frontend` in
 * every environment, so adding one is a product decision, not a code change.
 * The topic tours below already are (`TutorialProgressService`).
 */
export const PRACTICE_TOUR_IDS = [
	PRACTICE_INTRO_TOUR_ID,
	PRACTICE_SUPERVISION_TOUR_ID,
	PRACTICE_LIVE_CHAT_TOUR_ID,
	PRACTICE_GROUP_CIRCLE_TOUR_ID,
	PRACTICE_CALENDAR_TOUR_ID
] as const;

export type PracticeTourId = (typeof PRACTICE_TOUR_IDS)[number];

export const isPracticeTourId = (id: unknown): id is PracticeTourId =>
	typeof id === 'string' &&
	(PRACTICE_TOUR_IDS as readonly string[]).includes(id);
