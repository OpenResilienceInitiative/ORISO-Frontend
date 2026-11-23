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
 * OPEN one and REOPENS a CLOSED one (FE#2491). Because of the reopen, never
 * call this just to read a CLOSED or ARCHIVED room — use the read-only join.
 * 400 when the case may not start one (e.g. moved to another Beratungsstelle
 * while "Team-Chat nach Annahme" is off).
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
 * FE#2491 / US#1778: read-only join for a CLOSED or ARCHIVED discussion, so
 * a colleague who never joined can read it. Never creates or reopens.
 * 200 with the discussion, 204 (→ null) when there is none — e.g. after the
 * case moved to another Beratungsstelle. 403 for others. 503 while the room
 * is not yet confirmed read-only: rejects (CATCH_ALL), the caller retries.
 */
export const apiJoinTeamDiscussion = async (
	sessionId: number
): Promise<TeamDiscussion | null> =>
	fetchData({
		url: `${endpoints.teamDiscussion(sessionId)}/join`,
		method: FETCH_METHODS.POST,
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.CATCH_ALL,
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
