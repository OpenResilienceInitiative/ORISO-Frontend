import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';
import { endpoints } from '../resources/scripts/endpoints';

export type TenantAgenciesTopicsInterface =
	AgencyService.Schemas.AgencyTopicsDTO;

export const apiGetTenantAgenciesTopics = async (): Promise<
	TenantAgenciesTopicsInterface[]
> => {
	return fetchData({
		url: `${endpoints.agencyTopics}`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.EMPTY, FETCH_ERRORS.CATCH_ALL]
	}).catch((error) => {
		if (error?.message === FETCH_ERRORS.EMPTY) {
			return [];
		}
		return Promise.reject(error);
	});
};
