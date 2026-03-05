import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';
import { endpoints } from '../resources/scripts/endpoints';
import { TenantDataInterface } from '../globalState/interfaces';
import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import { parseJwt } from '../utils/parseJWT';

export const apiGetTenantTheming = async (): Promise<TenantDataInterface> => {
	const accessToken = getValueFromCookie('keycloak');
	let tenantId: number | null = null;

	if (accessToken) {
		const jwtPayload = parseJwt(accessToken);
		if (typeof jwtPayload?.tenantId === 'number') {
			tenantId = jwtPayload.tenantId;
		} else if (
			typeof jwtPayload?.tenantId === 'string' &&
			jwtPayload.tenantId.trim() !== ''
		) {
			tenantId = Number(jwtPayload.tenantId);
		}
	}

	const url =
		tenantId && tenantId > 0
			? `${endpoints.tenantServiceBase}/public/id/${tenantId}`
			: `${endpoints.tenantServiceBase}/public/`;

	return fetchData({
		url,
		method: FETCH_METHODS.GET,
		skipAuth: true,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});
};
