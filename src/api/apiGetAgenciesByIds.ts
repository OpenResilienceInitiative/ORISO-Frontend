import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';
import { AgencyDataInterface } from '../globalState/interfaces';

/**
 * Several agencies in one request (`GET /service/agencies/{id,id,…}`),
 * including their effective settings. Public endpoint, like the single-agency
 * lookup in apiGetAgencyById. Rejects on failure so callers can decide how to
 * degrade.
 */
export const apiGetAgenciesByIds = async (
	agencyIds: number[]
): Promise<AgencyDataInterface[]> => {
	if (agencyIds.length === 0) {
		return [];
	}
	const response = await fetchData({
		url: `${endpoints.agencyServiceBase}/${agencyIds.join(',')}`,
		method: FETCH_METHODS.GET,
		skipAuth: true,
		responseHandling: [FETCH_ERRORS.EMPTY, FETCH_ERRORS.CATCH_ALL]
	});
	return Array.isArray(response) ? response : [];
};
