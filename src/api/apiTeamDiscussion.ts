/**
 * FE#514 / ADR-016 — Team-Besprechung endpoints (UserService US#473).
 * The discussion is a separate Matrix room per open enquiry; the advice seeker
 * is never a member. GET returns 204 (→ null here) while no discussion exists.
 */
import { endpoints } from '../resources/scripts/endpoints';
import {
	fetchData,
	FETCH_METHODS,
	FETCH_ERRORS,
	FETCH_SUCCESS
} from './fetchData';

/**
 * OPEN: writable. CLOSED (FE#2491): a counsellor switched the team chat off
 * for this still open enquiry — read-only for everyone until switched on
 * again. ARCHIVED: read-only for good after accept (ADR-016).
 */
export type TeamDiscussionStatus = 'OPEN' | 'CLOSED' | 'ARCHIVED';

export interface TeamDiscussion {
	matrixRoomId: string;
	status: TeamDiscussionStatus;
	archiveDate?: string | null;
	closedDate?: string | null;
}

const normalizeStatus = (status: unknown): TeamDiscussionStatus =>
	status === 'ARCHIVED' || status === 'CLOSED' ? status : 'OPEN';

export const normalize = (response: any): TeamDiscussion | null =>
	response?.matrixRoomId
		? {
				matrixRoomId: response.matrixRoomId,
				status: normalizeStatus(response.status),
				archiveDate: response.archiveDate ?? null,
				closedDate: response.closedDate ?? null
			}
		: null;

/** Existing discussion or null — never creates one. */
export const apiGetTeamDiscussion = async (
	sessionId: number
): Promise<TeamDiscussion | null> =>
	fetchData({
		url: endpoints.teamDiscussion(sessionId),
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.FORBIDDEN]
	}).then(normalize);

/**
 * Switches the team chat on and joins the caller: creates the room, joins an
 * OPEN one, REOPENS a CLOSED one (FE#2491) and read-only joins an ARCHIVED
 * one. Because of the reopen, never call this just to look at a CLOSED room.
 */
export const apiOpenTeamDiscussion = async (
	sessionId: number
): Promise<TeamDiscussion | null> =>
	fetchData({
		url: endpoints.teamDiscussion(sessionId),
		method: FETCH_METHODS.POST,
		// CONTENT: fetchData only parses JSON bodies for non-GET requests when asked to.
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_SUCCESS.CONTENT
		]
	}).then(normalize);

/**
 * FE#2491: switches the team chat of an open enquiry off. The room stays and
 * becomes read-only for everyone (status CLOSED). 204, 409 when ARCHIVED.
 */
export const apiCloseTeamDiscussion = async (
	sessionId: number
): Promise<void> =>
	fetchData({
		url: endpoints.teamDiscussion(sessionId),
		method: FETCH_METHODS.DELETE,
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.CONFLICT
		]
	}).then(() => undefined);
