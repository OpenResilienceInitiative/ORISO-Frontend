import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

export const apiConfirmPasswordReset = async (
	token: string,
	newPassword: string
): Promise<void> => {
	await fetchData({
		url: endpoints.passwordResetConfirm,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ token, newPassword }),
		skipAuth: true,
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.GATEWAY_TIMEOUT
		]
	});
};
