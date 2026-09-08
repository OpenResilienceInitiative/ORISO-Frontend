import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';

export const apiPutEmail = async (email: string): Promise<any> => {
	const url = endpoints.email;

	return fetchData({
		bodyData: JSON.stringify(email.trim()),
		url: url,
		method: FETCH_METHODS.PUT,
		responseHandling: [
			FETCH_ERRORS.CONFLICT_WITH_RESPONSE,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.ABORTED, // fetchData maps 500 to this
			FETCH_ERRORS.GATEWAY_TIMEOUT // 504
		]
	});
};
