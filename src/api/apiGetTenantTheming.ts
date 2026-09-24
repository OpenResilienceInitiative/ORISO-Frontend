import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';
import { endpoints } from '../resources/scripts/endpoints';
import { TenantDataInterface } from '../globalState/interfaces';
import { getAuthenticatedTenantId } from '../utils/authenticatedTenant';

export const apiGetTenantTheming = async (): Promise<TenantDataInterface> => {
	// One reader of the tenant claim for the whole app: the same value decides
	// which tenant is fetched here and when `useTenantTheming` re-resolves it.
	// Two readers that disagree would either loop or never refresh.
	const tenantId = getAuthenticatedTenantId();

	const url = tenantId
		? `${endpoints.tenantServiceBase}/public/id/${tenantId}`
		: `${endpoints.tenantServiceBase}/public/`;

	return fetchData({
		url,
		method: FETCH_METHODS.GET,
		skipAuth: true,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});
};
