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
   resolution — agency, tenant and the fallback to the subdomain tenant — so
   one of them failing cannot overwrite the tenant the other one found. A
   miss is not kept: ask again next time. */
const linkTenants = new Map<number, Promise<TenantDataInterface>>();

const getLinkTenant = (agencyId: number) => {
	if (!linkTenants.has(agencyId)) {
		let missed = false;
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
				if (tenant) return tenant;
				missed = true;
				return fetchTenant(`${endpoints.tenantServiceBase}/public/`);
			})
			.finally(() => {
				if (missed) linkTenants.delete(agencyId);
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
	return linkAgencyId
		? getLinkTenant(linkAgencyId)
		: fetchTenant(`${endpoints.tenantServiceBase}/public/`);
};
