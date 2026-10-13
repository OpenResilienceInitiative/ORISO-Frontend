import { autoLogin } from '../components/registration/autoLogin';
import { removeAllCookies } from '../components/sessionCookie/accessSessionCookie';
import { TenantDataInterface } from '../globalState/interfaces';
import { normalizePreferredLanguage } from '../utils/normalizePreferredLanguage';
import { FETCH_ERRORS, FETCH_METHODS, fetchData } from './fetchData';
import { COOKIE_KEY } from '../globalState';
import { apiGetIsUsernameAvailable } from './apiGetIsUsernameAvailable';

/**
 * Registration creates the chat room and invites every counsellor of the
 * centre one by one, and the chat server rate-limits those invites. On Dev a
 * centre with 24 counsellors took 52 s (9 Oct 2026); the 30 s default abort
 * turned that into "Oops" while the server went on to create the account.
 */
export const REGISTRATION_TIMEOUT_MS = 120_000;

/**
 * After a timeout only the server knows whether the account exists. A taken
 * User-ID means it does, and the person must be sent to the login, never back
 * to the form. Any doubt (other error, failed check) keeps today's behaviour.
 */
export const accountExistsAfterTimeout = async (
	error: unknown,
	username: string | undefined
): Promise<boolean> => {
	if (
		!(error instanceof Error) ||
		error.message !== FETCH_ERRORS.TIMEOUT ||
		!username
	) {
		return false;
	}
	try {
		return !(await apiGetIsUsernameAvailable(username));
	} catch {
		return false;
	}
};

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
		timeout: REGISTRATION_TIMEOUT_MS,
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
