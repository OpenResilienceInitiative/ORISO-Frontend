import { endpoints } from '../resources/scripts/endpoints';
import { FETCH_ERRORS, FETCH_METHODS, fetchData } from './fetchData';

export const apiGetAgenciesByTenant = async (
	postcode: string,
	topicId: number
): Promise<any[]> => {
	const url = `${endpoints.agenciesByTenant}?postcode=${postcode}&topicId=${topicId}`;

	return fetchData({
		url,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.EMPTY]
	});
};
