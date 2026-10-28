import { fetchData, FETCH_ERRORS, FETCH_METHODS, FETCH_SUCCESS } from './index';
import { endpoints } from '../resources/scripts/endpoints';

export interface MagicLinkConsumeResponse {
	access_token: string;
	expires_in: number;
	refresh_token: string;
	refresh_expires_in: number;
}

export const apiConsumeMagicLinkLogin = async (
	token: string
): Promise<MagicLinkConsumeResponse> =>
	await fetchData({
		url: endpoints.magicLinkConsume,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ token }),
		skipAuth: true,
		responseHandling: [FETCH_SUCCESS.CONTENT, FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.UNAUTHORIZED]
	});

