import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';

export const apiGetIsUsernameAvailable = async (
	username: string
): Promise<boolean> => {
	try {
		await fetchData({
			url: `${endpoints.baseUserService}/availability/${encodeURIComponent(
				username
			)}`,
			method: FETCH_METHODS.GET,
			headersData: {},
			responseHandling: [FETCH_ERRORS.CONFLICT]
		});
		return true;
	} catch (error) {
		if (error instanceof Error && error.message === FETCH_ERRORS.CONFLICT) {
			return false;
		}
		throw error;
	}
};
