import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

export const apiPutDearchive = async (
	sessionId: number,
	// Opt-in (e.g. [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED]) so callers
	// can show a local error instead of fetchData's error-page redirect.
	responseHandling?: string[]
): Promise<any> => {
	const url = `${endpoints.sessionBase}/${sessionId}/dearchive`;

	return fetchData({
		url: url,
		method: FETCH_METHODS.PUT,
		responseHandling
	});
};
