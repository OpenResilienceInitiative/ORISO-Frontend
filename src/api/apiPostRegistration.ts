import { autoLogin } from '../components/registration/autoLogin';
import { removeAllCookies } from '../components/sessionCookie/accessSessionCookie';
import { TenantDataInterface } from '../globalState/interfaces';
import { FETCH_ERRORS, FETCH_METHODS, fetchData } from './fetchData';
import { COOKIE_KEY } from '../globalState';

type RegistrationPayload = {
	agencyId?: string;
	username?: string;
	password?: string;
} & Record<string, unknown>;

export const apiPostRegistration = (
	url: string,
	data: RegistrationPayload,
	useMultiTenancyWithSingleDomain: boolean,
	tenant: TenantDataInterface
): Promise<any> => {
	removeAllCookies([COOKIE_KEY]);
	const requestData: RegistrationPayload = {
		...data,
		...(typeof data.password === 'string' && {
			password: encodeURIComponent(data.password)
		})
	};

	return fetchData({
		url: url,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(requestData),
		skipAuth: true,
		...(useMultiTenancyWithSingleDomain &&
			data.agencyId && {
				headersData: { agencyId: data.agencyId }
			}),
		responseHandling: [FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE]
	}).then(() =>
		autoLogin({
			username: data.username || '',
			password: data.password || '',
			tenantData: tenant
		})
	);
};
