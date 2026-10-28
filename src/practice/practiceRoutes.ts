import {
	PRACTICE_ENQUIRY_SESSION_ID,
	PRACTICE_MAIN_ROOM_ID
} from './practiceIds';

/**
 * Routes of the one practice case. Flow F1 opens it as an enquiry, flow F2
 * starts on it already accepted (the fixtures serve both start states).
 */

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
export const practiceAcceptedSessionRoute = (): string =>
	`${MY_SESSIONS_ROUTE}/${encodeURIComponent(PRACTICE_MAIN_ROOM_ID)}/${PRACTICE_ENQUIRY_SESSION_ID}`;
