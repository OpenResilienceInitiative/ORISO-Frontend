import { endpoints } from '../resources/scripts/endpoints';
import { UserDataInterface } from '../globalState/interfaces';
import { markServerUserData } from '../globalState/serverUserData';
import { fetchData, FETCH_METHODS } from './fetchData';

export const apiGetUserData = async (
	responseHandling?: string[]
): Promise<UserDataInterface> => {
	const url = endpoints.userData;

	// Server data, whatever its value (e-mail settings settle only on it).
	return fetchData({
		url: url,
		responseHandling,
		method: FETCH_METHODS.GET
	}).then(markServerUserData);
};
