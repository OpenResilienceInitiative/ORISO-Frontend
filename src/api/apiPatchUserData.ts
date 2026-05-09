import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';
import { isAnonymousSession } from '../utils/keycloakSession';

export const apiPatchUserData = async (data): Promise<any> => {
	if (isAnonymousSession()) {
		// Anonymous invite sessions are forbidden to patch /service/users/data.
		// Keep UI flows optimistic and avoid repeated 403 loops.
		return Promise.resolve({});
	}

	const url = endpoints.userData;

	return fetchData({
		url: url,
		method: FETCH_METHODS.PATCH,
		bodyData: JSON.stringify({ ...data }),
		rcValidation: true,
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FAILED_DEPENDENCY,
			FETCH_ERRORS.GATEWAY_TIMEOUT
		]
	});
};
