import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

export const apiPutArchive = async (sessionId: number): Promise<any> => {
	const url = `${endpoints.sessionBase}/${sessionId}/archive`;

	// Reject non-2xx locally (instead of redirecting to the error page) so the
	// caller can show its own error; 401 still takes the logout path.
	return fetchData({
		url: url,
		method: FETCH_METHODS.PUT,
		responseHandling: [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED]
	});
};
