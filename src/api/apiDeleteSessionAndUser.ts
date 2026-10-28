import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';

export const apiDeleteSessionAndUser = async (
	sessionId: number
): Promise<void> => {
	const url = `${endpoints.sessionBase}/${sessionId}`;

	return fetchData({
		url: url,
		method: FETCH_METHODS.DELETE,
		responseHandling: [FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.FORBIDDEN]
	});
};

