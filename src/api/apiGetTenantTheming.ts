import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';
import { endpoints } from '../resources/scripts/endpoints';
import { TenantDataInterface } from '../globalState/interfaces';
import { getAuthenticatedTenantId } from '../utils/authenticatedTenant';
import { apiGetAgencyById } from './apiGetAgencyId';

// Both theming hooks resolve on load; one agency request serves them.
const linkTenantIds = new Map<number, Promise<number | null>>();

const getLinkTenantId = (agencyId: number) => {
	if (!linkTenantIds.has(agencyId)) {
		linkTenantIds.set(
			agencyId,
			apiGetAgencyById(agencyId).then((agency) =>
				agency?.tenantId && agency.tenantId > 0 ? agency.tenantId : null
			)
		);
	}
	return linkTenantIds.get(agencyId)!;
};

/** Test seam: forget the agencies already asked for. */
export const resetLinkTenantCache = () => linkTenantIds.clear();

const fetchTenant = (url: string): Promise<TenantDataInterface> =>
	fetchData({
		url,
		method: FETCH_METHODS.GET,
		skipAuth: true,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});

export const apiGetTenantTheming = async (
	linkAgencyId: number | null = null
): Promise<TenantDataInterface> => {
	// One reader of the tenant claim for the whole app: the same value decides
	// which tenant is fetched here and when `useTenantTheming` re-resolves it.
	// Two readers that disagree would either loop or never refresh.
	const tenantId = getAuthenticatedTenantId();
	if (tenantId) {
		return fetchTenant(
			`${endpoints.tenantServiceBase}/public/id/${tenantId}`
		);
	}

	/* Before sign-in the shared link already says whose it is: a visitor
	   who is not registered yet sees the Träger of the Beratungsstelle the
	   link names, not the platform's main tenant (#1689). A link that
	   resolves to nothing keeps the old answer. */
	const linkTenantId = linkAgencyId
		? await getLinkTenantId(linkAgencyId)
		: null;
	if (linkTenantId) {
		try {
			return await fetchTenant(
				`${endpoints.tenantServiceBase}/public/id/${linkTenantId}`
			);
		} catch {
			// Fall through to the subdomain tenant.
		}
	}
	return fetchTenant(`${endpoints.tenantServiceBase}/public/`);
};
