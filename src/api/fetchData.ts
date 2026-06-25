import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import { generateCsrfToken } from '../utils/generateCsrfToken';
import {
	getErrorCaseForStatus,
	redirectToErrorPage
} from '../components/error/errorHandling';
import { isPublicAuthRoute } from '../components/auth/auth';
import { logout } from '../components/logout/logout';
import { removeAllCookies } from '../components/sessionCookie/accessSessionCookie';
import { removeTokenExpiryFromLocalStorage } from '../components/sessionCookie/accessSessionLocalStorage';
import { appConfig } from '../utils/appConfig';
import { RequestLog } from '../utils/requestCollector';

const nodeEnv: string = process.env.NODE_ENV as string;
const isLocalDevelopment = nodeEnv === 'development';

export const FETCH_METHODS = {
	DELETE: 'DELETE',
	GET: 'GET',
	POST: 'POST',
	PUT: 'PUT',
	PATCH: 'PATCH'
};

export const FETCH_ERRORS = {
	ABORT: 'ABORT',
	ABORTED: 'ABORTED',
	BAD_REQUEST: 'BAD_REQUEST',
	CATCH_ALL: 'CATCH_ALL',
	CATCH_ALL_WITH_RESPONSE: 'CATCH_ALL_WITH_RESPONSE',
	CONFLICT: 'CONFLICT',
	CONFLICT_WITH_RESPONSE: 'CONFLICT_WITH_RESPONSE',
	EMPTY: 'EMPTY',
	FAILED_DEPENDENCY: 'FAILED_DEPENDENCY',
	FORBIDDEN: 'FORBIDDEN',
	GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
	NO_MATCH: 'NO_MATCH',
	TIMEOUT: 'TIMEOUT',
	UNAUTHORIZED: 'UNAUTHORIZED',
	PRECONDITION_FAILED: 'PRECONDITION FAILED',
	X_REASON: 'X-Reason'
};

export const X_REASON = {
	EMAIL_NOT_AVAILABLE: 'EMAIL_NOT_AVAILABLE',
	USERNAME_NOT_AVAILABLE: 'USERNAME_NOT_AVAILABLE',
	USER_ALREADY_REGISTERED_WITH_AGENCY_AND_TOPIC:
		'USER_ALREADY_REGISTERED_WITH_AGENCY_AND_TOPIC'
};

export const FETCH_SUCCESS = {
	CONTENT: 'CONTENT'
};

const MATRIX_MIGRATION_DUMMY_RC_TOKEN = 'matrix-migration-dummy-token';
const MATRIX_MIGRATION_DUMMY_RC_USER_ID = 'matrix-migration-dummy-user';

const invalidateStaleAuthSession = () => {
	removeAllCookies();
	removeTokenExpiryFromLocalStorage();
};

// Guards against repeated reloads when several requests 401 on a public auth
// route within the same page load. At most one self-healing reload is triggered.
let staleAuthRecoveryTriggered = false;

// A 401 on a public auth route (login / registration / error pages) means any
// token we presented is stale or expired. Clear it so the next request is
// anonymous -- the public endpoints then answer 200 instead of 401. If a stale
// token was actually sent, reload once to re-bootstrap the app cleanly instead
// of leaving the user stranded on a blank, crashed page (the uncaught
// UNAUTHORIZED rejection otherwise prevents the login screen from rendering).
const recoverFromStaleAuthOnPublicRoute = (
	hadAuthorization: boolean,
	reject: (reason?: Error) => void
) => {
	invalidateStaleAuthSession();
	reject(new Error(FETCH_ERRORS.UNAUTHORIZED));
	if (hadAuthorization && !staleAuthRecoveryTriggered) {
		staleAuthRecoveryTriggered = true;
		window.location.reload();
	}
};

export class FetchErrorWithOptions extends Error {
	options = {};

	constructor(message: string, options: {}) {
		super(message);

		this.options = { ...options };
		// Set the prototype explicitly.
		Object.setPrototypeOf(this, FetchErrorWithOptions.prototype);
	}
}

interface FetchDataProps {
	url: string;
	method: string;
	headersData?: object;
	rcValidation?: boolean;
	bodyData?: string;
	skipAuth?: boolean;
	responseHandling?: string[];
	timeout?: number;
	signal?: AbortSignal;
}

export const fetchData = ({
	url,
	method,
	headersData,
	rcValidation,
	bodyData,
	skipAuth,
	responseHandling,
	timeout,
	signal
}: FetchDataProps): Promise<any> =>
	new Promise((resolve, reject) => {
		const reqLog = new RequestLog(url, method, timeout);

		const accessToken = getValueFromCookie('keycloak');
		const authorization =
			!skipAuth && accessToken
				? {
						Authorization: `Bearer ${accessToken}`
					}
				: null;

		const csrfToken = generateCsrfToken();

		// MATRIX MIGRATION: rcToken still required by backend for archive endpoints
		// but no longer exists after Matrix migration. Send dummy token.
		const rcHeaders = rcValidation
			? {
					RCToken:
						getValueFromCookie('rc_token') ||
						MATRIX_MIGRATION_DUMMY_RC_TOKEN,
					RCUserId:
						getValueFromCookie('rc_uid') ||
						MATRIX_MIGRATION_DUMMY_RC_USER_ID
				}
			: null;

		const localDevelopmentHeader =
			isLocalDevelopment &&
			process.env.REACT_APP_CSRF_WHITELIST_HEADER_PROPERTY
				? {
						[process.env.REACT_APP_CSRF_WHITELIST_HEADER_PROPERTY]:
							csrfToken
					}
				: isLocalDevelopment
					? {
							'X-WHITELIST-HEADER': csrfToken
						}
					: null;

		const controller = new AbortController();
		const timeoutMs = timeout ?? 30_000;
		setTimeout(() => controller.abort(), timeoutMs);
		if (signal) {
			signal.addEventListener('abort', () => controller.abort());
		}

		// Filter out undefined values from headers
		const allHeaders = {
			'Content-Type': 'application/json',
			'cache-control': 'no-cache',
			...authorization,
			'X-CSRF-TOKEN': csrfToken,
			...headersData,
			...rcHeaders,
			...localDevelopmentHeader
		};

		// Remove any undefined values and undefined keys
		const cleanHeaders = Object.fromEntries(
			Object.entries(allHeaders).filter(
				([key, value]) =>
					key !== undefined &&
					value !== undefined &&
					key !== 'undefined'
			)
		);

		// MATRIX MIGRATION: Removed debug logs to prevent infinite loop
		// console.log('Headers being sent:', cleanHeaders);
		// console.log('isLocalDevelopment:', isLocalDevelopment);
		// console.log('REACT_APP_CSRF_WHITELIST_HEADER_PROPERTY:', process.env.REACT_APP_CSRF_WHITELIST_HEADER_PROPERTY);
		// console.log('localDevelopmentHeader:', localDevelopmentHeader);

		const req = new Request(url, {
			method: method,
			headers: cleanHeaders,
			credentials: 'include',
			body: bodyData,
			signal: controller.signal
		});

		fetch(req)
			.then((response) => {
				reqLog.finish(response.status);
				if (response.status === 200 || response.status === 201) {
					const data =
						(method === FETCH_METHODS.GET &&
							(!headersData ||
								headersData?.['Content-Type'] ===
									'application/json')) ||
						(responseHandling &&
							responseHandling.includes(FETCH_SUCCESS.CONTENT))
							? response.json()
							: response;
					resolve(data);
				} else if (response.status === 204) {
					if (responseHandling?.includes(FETCH_ERRORS.EMPTY)) {
						// treat 204 no content as an error with this response handling type
						reject(new Error(FETCH_ERRORS.EMPTY));
					} else {
						resolve({});
					}
				} else if (responseHandling) {
					if (
						response.status === 400 &&
						responseHandling.includes(FETCH_ERRORS.BAD_REQUEST)
					) {
						reject(new Error(FETCH_ERRORS.BAD_REQUEST));
					} else if (
						response.status === 403 &&
						responseHandling.includes(FETCH_ERRORS.FORBIDDEN)
					) {
						reject(new Error(FETCH_ERRORS.FORBIDDEN));
					} else if (
						response.status === 404 &&
						responseHandling.includes(FETCH_ERRORS.NO_MATCH)
					) {
						reject(new Error(FETCH_ERRORS.NO_MATCH));
					} else if (
						response.status === 409 &&
						(responseHandling.includes(FETCH_ERRORS.CONFLICT) ||
							responseHandling.includes(
								FETCH_ERRORS.CONFLICT_WITH_RESPONSE
							))
					) {
						reject(
							responseHandling.includes(
								FETCH_ERRORS.CONFLICT_WITH_RESPONSE
							)
								? response
								: new Error(FETCH_ERRORS.CONFLICT)
						);
					} else if (
						response.status === 424 &&
						responseHandling.includes(
							FETCH_ERRORS.FAILED_DEPENDENCY
						)
					) {
						reject(new Error(FETCH_ERRORS.FAILED_DEPENDENCY));
					} else if (
						responseHandling.includes(FETCH_ERRORS.CATCH_ALL) ||
						responseHandling.includes(
							FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE
						)
					) {
						reject(
							responseHandling.includes(
								FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE
							)
								? response
								: new Error(FETCH_ERRORS.CATCH_ALL)
						);
					} else if (
						response.status === 412 &&
						responseHandling.includes(
							FETCH_ERRORS.PRECONDITION_FAILED
						)
					) {
						reject(new Error(FETCH_ERRORS.PRECONDITION_FAILED));
					} else if (
						response.status === 500 &&
						responseHandling.includes(FETCH_ERRORS.ABORTED)
					) {
						reject(new Error(FETCH_ERRORS.ABORTED));
					} else if (
						response.status === 504 &&
						responseHandling.includes(FETCH_ERRORS.GATEWAY_TIMEOUT)
					) {
						reject(new Error(FETCH_ERRORS.GATEWAY_TIMEOUT));
					} else if (response.status === 401) {
						if (isPublicAuthRoute()) {
							recoverFromStaleAuthOnPublicRoute(
								Boolean(authorization),
								reject
							);
						} else {
							logout(true, appConfig.urls.toLogin);
							reject(new Error(FETCH_ERRORS.UNAUTHORIZED));
						}
					}
				} else if (response.status === 401 && isPublicAuthRoute()) {
					recoverFromStaleAuthOnPublicRoute(
						Boolean(authorization),
						reject
					);
				} else {
					const error = getErrorCaseForStatus(response.status);
					redirectToErrorPage(error);
					reject(new Error('api call error'));
				}
			})
			.catch((error) => {
				if (signal?.aborted && error.name === 'AbortError') {
					reqLog.finish(299);
					reject(new Error(FETCH_ERRORS.ABORT));
				} else if (error.name === 'AbortError') {
					reqLog.finish(408);
					reject(new Error(FETCH_ERRORS.TIMEOUT));
				} else if (signal?.aborted) {
					reqLog.finish(299);
					reject(new Error(FETCH_ERRORS.ABORT));
				} else {
					reqLog.finish(520);
					reject(error);
				}
			});
	});
