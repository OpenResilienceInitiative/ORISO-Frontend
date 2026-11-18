import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * Moves the placeholder of a deleted advice-seeker chat into the counsellor's
 * archive. The session no longer exists, so the regular session archive does
 * not apply. Rejects on failure so the caller can show its own error; 401
 * still takes the logout path.
 */
export const apiPutDeletedAskerArchive = async (
	formerSessionId: number
): Promise<unknown> =>
	fetchData({
		url: `${endpoints.consultantDeletedAskerSessions}/${formerSessionId}/archive`,
		method: FETCH_METHODS.PUT,
		responseHandling: [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED]
	});
