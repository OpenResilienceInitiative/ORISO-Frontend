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

export type TeamDiscussionStatus = 'OPEN' | 'ARCHIVED';

export interface TeamDiscussion {
	matrixRoomId: string;
	status: TeamDiscussionStatus;
	archiveDate?: string | null;
}

const normalize = (response: any): TeamDiscussion | null =>
	response?.matrixRoomId
		? {
				matrixRoomId: response.matrixRoomId,
				status: response.status === 'ARCHIVED' ? 'ARCHIVED' : 'OPEN',
				archiveDate: response.archiveDate ?? null
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

/** Opens (lazily creating) the discussion and joins the caller into the room. */
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
