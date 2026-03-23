import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

export const apiRequestMagicLinkLogin = async (username: string): Promise<void> => {
	await fetchData({
		url: endpoints.magicLinkRequest,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ username }),
		skipAuth: true,
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.GATEWAY_TIMEOUT
		]
	});
};

