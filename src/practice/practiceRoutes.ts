import { practiceMatrixId, practiceNumericId } from './practiceIds';

/**
 * Ids and routes of the one practice case, kept in one place so the tours,
 * fixtures and tests cannot drift apart. Flow F1 opens it as an enquiry, flow
 * F2 starts on it already accepted (the fixtures serve both start states).
 */
export const PRACTICE_ENQUIRY_SESSION_ID = practiceNumericId(1);
export const PRACTICE_ENQUIRY_ROOM_ID = practiceMatrixId('!', '1');
export const PRACTICE_ACCEPTED_SESSION_ID = PRACTICE_ENQUIRY_SESSION_ID;
export const PRACTICE_ACCEPTED_ROOM_ID = PRACTICE_ENQUIRY_ROOM_ID;

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
 * `AcceptAssign.redirectToAcceptedSession` does: where F2 starts and where
 * the accept in F1 lands.
 */
export const practiceAcceptedSessionRoute = (
	sessionId: number = PRACTICE_ACCEPTED_SESSION_ID,
	roomId: string = PRACTICE_ACCEPTED_ROOM_ID
): string => `${MY_SESSIONS_ROUTE}/${encodeURIComponent(roomId)}/${sessionId}`;
