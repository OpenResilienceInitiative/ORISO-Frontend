import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * Updates the existing session-scoped supervision opt-out through its positive team-access
 * contract. `allowed=false` revokes active supervision/co-access on the server immediately.
 */
export const apiSetTeamAccess = (
	sessionId: number,
	allowed: boolean
): Promise<void> =>
	fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/team-access`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ allowed }),
		responseHandling: [FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.FORBIDDEN]
	});
