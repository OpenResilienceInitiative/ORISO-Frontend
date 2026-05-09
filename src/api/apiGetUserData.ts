import { endpoints } from '../resources/scripts/endpoints';
import { UserDataInterface } from '../globalState/interfaces';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';
import { isAnonymousSession } from '../utils/keycloakSession';

export const apiGetUserData = async (
	responseHandling?: string[]
): Promise<UserDataInterface> => {
	if (isAnonymousSession()) {
		return Promise.reject(new Error(FETCH_ERRORS.ABORT));
	}

	const url = endpoints.userData;

	return fetchData({
		url: url,
		rcValidation: false,
		responseHandling,
		method: FETCH_METHODS.GET
	});
};
