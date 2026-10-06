import { practiceMatrixId, practiceNumericId } from './practiceIds';

/**
 * Ids and routes of the two practice start states, kept in one place so the
 * tours, fixtures and tests cannot drift apart. Sequence 1 is the open
 * enquiry of flow F1, sequence 2 the already accepted case of flow F2.
 */
export const PRACTICE_ENQUIRY_SESSION_ID = practiceNumericId(1);
export const PRACTICE_ACCEPTED_SESSION_ID = practiceNumericId(2);
export const PRACTICE_ENQUIRY_ROOM_ID = practiceMatrixId('!', '1');
export const PRACTICE_ACCEPTED_ROOM_ID = practiceMatrixId('!', '2');

/** The consultant enquiries list (the real route, not a practice copy). */
export const PRACTICE_ENQUIRIES_ROUTE = '/sessions/consultant/sessionPreview';

const MY_SESSIONS_ROUTE = '/sessions/consultant/sessionView';

/**
 * Where a click on the practice enquiry card lands: a card whose room id is a
 * Matrix id navigates to `/session/:id`, not to the room-id route
 * (`getSessionNavigationPath`).
 */
export const practiceEnquirySessionRoute = (): string =>
	`${PRACTICE_ENQUIRIES_ROUTE}/session/${PRACTICE_ENQUIRY_SESSION_ID}`;

/**
 * An accepted case in "My consultations", addressed by its room id as
 * `AcceptAssign.redirectToAcceptedSession` does. Defaults to the F2 start
 * case; pass the enquiry ids for the case a fresh accept moves over.
 */
export const practiceAcceptedSessionRoute = (
	sessionId: number = PRACTICE_ACCEPTED_SESSION_ID,
	roomId: string = PRACTICE_ACCEPTED_ROOM_ID
): string => `${MY_SESSIONS_ROUTE}/${encodeURIComponent(roomId)}/${sessionId}`;
