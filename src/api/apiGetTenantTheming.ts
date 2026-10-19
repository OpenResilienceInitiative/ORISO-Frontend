import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';
import { endpoints } from '../resources/scripts/endpoints';
import { TenantDataInterface } from '../globalState/interfaces';
import { getAuthenticatedTenantId } from '../utils/authenticatedTenant';
import { apiGetAgencyById } from './apiGetAgencyId';

/** Test seam: forget the agencies already asked for. */
export const resetLinkTenantCache = () => linkTenants.clear();

const fetchTenant = (url: string): Promise<TenantDataInterface> =>
	fetchData({
		url,
		method: FETCH_METHODS.GET,
		skipAuth: true,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});

/* Both theming hooks resolve on load. They share the whole link
   resolution — agency and tenant — so one of them failing cannot overwrite
   the tenant the other one found. A miss is not kept: ask again next time. */
const linkTenants = new Map<number, Promise<TenantDataInterface | null>>();

const getLinkTenant = (agencyId: number) => {
	if (!linkTenants.has(agencyId)) {
		const pending = apiGetAgencyById(agencyId)
			.then((agency) =>
				agency?.tenantId && agency.tenantId > 0
					? fetchTenant(
							`${endpoints.tenantServiceBase}/public/id/${agency.tenantId}`
						)
					: null
			)
			.catch(() => null)
			.then((tenant) => {
				if (!tenant) linkTenants.delete(agencyId);
				return tenant;
			});
		linkTenants.set(agencyId, pending);
	}
	return linkTenants.get(agencyId)!;
};

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
	const linkTenant = linkAgencyId ? await getLinkTenant(linkAgencyId) : null;
	if (linkTenant) {
		return linkTenant;
	}
	return fetchTenant(`${endpoints.tenantServiceBase}/public/`);
};
