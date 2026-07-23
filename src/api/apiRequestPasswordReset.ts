import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

export const apiRequestPasswordReset = async (
	username: string,
	locale: string
): Promise<void> => {
	await fetchData({
		url: endpoints.passwordResetRequest,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ username, locale }),
		skipAuth: true,
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.GATEWAY_TIMEOUT
		]
	});
};
