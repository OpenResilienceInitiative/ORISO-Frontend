import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';
import { endpoints } from '../resources/scripts/endpoints';

export interface TenantAgenciesTopicsInterface {
	id: number;
	name: string;
}

export const apiGetTenantAgenciesTopics = async (): Promise<
	TenantAgenciesTopicsInterface[]
> => {
	return fetchData({
		url: `${endpoints.agencyTopics}`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});
};
