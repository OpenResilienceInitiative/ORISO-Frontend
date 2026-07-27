import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

export const apiEnquiryAcceptance = async (sessionId: number): Promise<any> => {
	const url = `${endpoints.sessionBase}/new/${sessionId}`;

	return fetchData({
		url: url,
		method: FETCH_METHODS.PUT,
		responseHandling: [FETCH_ERRORS.CONFLICT]
	});
};
