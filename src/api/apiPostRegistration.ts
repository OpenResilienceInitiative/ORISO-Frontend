import { autoLogin } from '../components/registration/autoLogin';
import { removeAllCookies } from '../components/sessionCookie/accessSessionCookie';
import { TenantDataInterface } from '../globalState/interfaces';
import { normalizePreferredLanguage } from '../utils/normalizePreferredLanguage';
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
	tenant: TenantDataInterface,
	/**
	 * Called the moment the account exists, before the automatic login is
	 * attempted. The returned promise settles for both steps together, so a
	 * caller that only watches it cannot tell an account that was never
	 * created from one that was created and could not be logged in — and the
	 * second must never be offered the registration form again
	 * (CodeRabbit on #1514).
	 */
	onAccountCreated?: () => void
): Promise<any> => {
	removeAllCookies([COOKIE_KEY]);
	const requestData: RegistrationPayload = {
		...data,
		...(typeof data.password === 'string' && {
			password: encodeURIComponent(data.password)
		}),
		...(typeof data.preferredLanguage === 'string' && {
			preferredLanguage: normalizePreferredLanguage(
				data.preferredLanguage
			)
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
	}).then(() => {
		onAccountCreated?.();
		return autoLogin({
			username: data.username || '',
			password: data.password || '',
			tenantData: tenant
		});
	});
};
