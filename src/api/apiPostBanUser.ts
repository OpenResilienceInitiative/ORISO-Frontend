import { endpoints } from '../resources/scripts/endpoints';
import { FETCH_METHODS, fetchData } from './fetchData';

export const apiPostBanUser = ({ matrixUserId, chatId }): Promise<any> => {
	const url = endpoints.banUser(matrixUserId, chatId);

	return fetchData({
		url: url,
		method: FETCH_METHODS.POST,
		responseHandling: []
	});
};
