import { logout, teardownLocalSession } from '../logout/logout';
import {
	getValueFromCookie,
	setValueInCookie
} from '../sessionCookie/accessSessionCookie';
import {
	getTokenExpiryFromLocalStorage,
	setTokenExpiryInLocalStorage
} from '../sessionCookie/accessSessionLocalStorage';
import { refreshKeycloakAccessToken } from '../sessionCookie/refreshKeycloakAccessToken';
import { appConfig } from '../../utils/appConfig';
import { parseJwt } from '../../utils/parseJWT';

export const RENEW_BEFORE_EXPIRY_IN_MS = 10 * 1000; // seconds
const PEER_EXPIRY_READBACK_DELAY_MS = 100;

export class TokenRefreshUnavailableError extends Error {
	constructor(cause?: unknown) {
		super('Token refresh temporarily unavailable');
		this.name = 'TokenRefreshUnavailableError';
		Object.setPrototypeOf(this, TokenRefreshUnavailableError.prototype);
		if (cause !== undefined) {
			(this as Error & { cause?: unknown }).cause = cause;
		}
	}
}

export const isTokenRefreshUnavailableError = (
	error: unknown
): error is TokenRefreshUnavailableError =>
	error instanceof TokenRefreshUnavailableError;

export const isInviteRoute = (): boolean =>
	/^\/invite(?:\/|$)/.test(window.location.pathname);

export const isPublicAuthRoute = (): boolean => {
	const { pathname } = window.location;
	return (
		/^\/(?:login|registration|invite|error\.401\.html|error\.404\.html|error\.500\.html)(?:\/|$)/.test(
			pathname
		) || /^\/[^/]+\/registration(?:\/|$)/.test(pathname)
	);
};

export const hasActiveAuthSession = (): boolean => {
	const tokenExpiry = getTokenExpiryFromLocalStorage();
	const currentTime = new Date().getTime();
	return (
		tokenExpiry.accessTokenValidUntilTime > currentTime ||
		tokenExpiry.refreshTokenValidUntilTime > currentTime
	);
};

export const setTokens = (
	access_token: string,
	expires_in: number,
	refresh_token: string,
	refresh_expires_in: number
) => {
	if (access_token) {
		setValueInCookie('keycloak', access_token);
		setTokenExpiryInLocalStorage(
			'auth.access_token_valid_until',
			expires_in
		);
	}
	if (refresh_token) {
		setValueInCookie('refreshToken', refresh_token);
		setTokenExpiryInLocalStorage(
			'auth.refresh_token_valid_until',
			refresh_expires_in
		);
	}
};

// The active schedule owns its callbacks, including a refresh already in flight.
let stopTokenTimers: (() => void) | undefined;

const expireScheduledSession = () => {
	stopTokenTimers?.();
	if (!hasActiveAuthSession()) teardownLocalSession();
	void logout(true, appConfig.urls.toLogin);
};

const refreshTokens = async (isCurrent: () => boolean): Promise<boolean> => {
	const before = getTokenExpiryFromLocalStorage();
	if (
		before.refreshTokenValidUntilTime <=
		Date.now() - RENEW_BEFORE_EXPIRY_IN_MS
	) {
		if (isCurrent()) expireScheduledSession();
		return false;
	}

	const accessToken = getValueFromCookie('keycloak');
	const refreshToken = getValueFromCookie('refreshToken');
	const response = await refreshKeycloakAccessToken();
	const current = getTokenExpiryFromLocalStorage();
	// Local logout or another tab may have replaced the session while awaiting the grant.
	if (
		!isCurrent() ||
		Date.now() >=
			Math.max(
				before.accessTokenValidUntilTime,
				before.refreshTokenValidUntilTime
			) ||
		getValueFromCookie('keycloak') !== accessToken ||
		getValueFromCookie('refreshToken') !== refreshToken ||
		current.accessTokenValidUntilTime !==
			before.accessTokenValidUntilTime ||
		current.refreshTokenValidUntilTime !== before.refreshTokenValidUntilTime
	) {
		return false;
	}
	setTokens(
		response.access_token,
		response.expires_in,
		response.refresh_token,
		response.refresh_expires_in
	);
	return true;
};

// A refresh rotates the JWT, while a fresh login gets a different session ID.
const tokenSessionScope = (token: string): string | null => {
	const { iss, sid } = parseJwt(token) ?? {};
	if (
		typeof iss !== 'string' ||
		!iss.trim() ||
		typeof sid !== 'string' ||
		!sid.trim()
	) {
		return null;
	}
	return JSON.stringify([iss, sid]);
};

const startTimers = () => {
	stopTokenTimers?.();
	const now = Date.now();
	const expiry = getTokenExpiryFromLocalStorage();
	const accessToken = getValueFromCookie('keycloak');
	const refreshToken = getValueFromCookie('refreshToken');
	const accessValidInMs = expiry.accessTokenValidUntilTime - now;
	const refreshValidInMs = expiry.refreshTokenValidUntilTime - now;
	const renewalDelay = accessValidInMs - RENEW_BEFORE_EXPIRY_IN_MS;
	// A peer may leave enough time to refresh after the renewal lead time has passed.
	const canRenewShortAccess =
		accessValidInMs > 0 && refreshValidInMs > accessValidInMs;
	const shortRenewalDelay = Math.max(
		1000,
		Math.min(RENEW_BEFORE_EXPIRY_IN_MS, refreshValidInMs / 2)
	);
	let refreshInterval: number | undefined;
	let expirationTimeout: number | undefined;
	let refreshing = false;
	const stop = () => {
		window.clearInterval(refreshInterval);
		window.clearTimeout(expirationTimeout);
		stopTokenTimers = undefined;
	};
	const isCurrent = () => stopTokenTimers === stop;
	const matchesSession = (
		scope: string,
		currentAccess: string,
		currentRefresh: string
	) =>
		(currentAccess === accessToken ||
			tokenSessionScope(currentAccess) === scope) &&
		(currentRefresh === refreshToken ||
			tokenSessionScope(currentRefresh) === scope);
	let awaitingPeerExpiry = false;
	const matchesSnapshot = () => {
		if (!isCurrent() || awaitingPeerExpiry) return false;
		const currentAccessToken = getValueFromCookie('keycloak');
		const currentRefreshToken = getValueFromCookie('refreshToken');
		const tokenChanged =
			currentAccessToken !== accessToken ||
			currentRefreshToken !== refreshToken;
		const scope = tokenChanged ? tokenSessionScope(refreshToken) : null;
		if (
			tokenChanged &&
			(!scope ||
				!matchesSession(scope, currentAccessToken, currentRefreshToken))
		) {
			stop();
			return false;
		}

		const current = getTokenExpiryFromLocalStorage();
		const expiryChanged =
			current.accessTokenValidUntilTime !==
				expiry.accessTokenValidUntilTime ||
			current.refreshTokenValidUntilTime !==
				expiry.refreshTokenValidUntilTime;
		if (scope && (!expiryChanged || !hasActiveAuthSession())) {
			// The new credentials can become visible before their deadlines.
			awaitingPeerExpiry = true;
			window.clearInterval(refreshInterval);
			window.clearTimeout(expirationTimeout);
			expirationTimeout = window.setTimeout(() => {
				if (!isCurrent()) return;
				if (
					!matchesSession(
						scope,
						getValueFromCookie('keycloak'),
						getValueFromCookie('refreshToken')
					)
				) {
					stop();
					return;
				}
				if (hasActiveAuthSession()) startTimers();
				else expireScheduledSession();
			}, PEER_EXPIRY_READBACK_DELAY_MS);
			return false;
		}
		if (expiryChanged) {
			stop();
			if (hasActiveAuthSession()) startTimers();
			return false;
		}
		return true;
	};
	stopTokenTimers = stop;

	if (renewalDelay > 0 || canRenewShortAccess) {
		refreshInterval = window.setInterval(
			() => {
				if (refreshing || !matchesSnapshot()) return;
				refreshing = true;
				void refreshTokens(isCurrent)
					.then((renewed) => {
						if (renewed && isCurrent()) startTimers();
						else matchesSnapshot();
					})
					.catch(() => undefined)
					.finally(() => {
						refreshing = false;
					});
			},
			renewalDelay > 0 ? renewalDelay : shortRenewalDelay
		);
	}

	const hardExpiryDelay = Math.max(accessValidInMs, refreshValidInMs);
	if (hardExpiryDelay > 0) {
		expirationTimeout = window.setTimeout(() => {
			if (matchesSnapshot()) expireScheduledSession();
		}, hardExpiryDelay);
	}

	return { isCurrent, matchesSnapshot };
};

export const handleTokenRefresh = async (redirect = true): Promise<void> => {
	stopTokenTimers?.();
	const now = Date.now();
	const expiry = getTokenExpiryFromLocalStorage();
	const accessValid = expiry.accessTokenValidUntilTime > now;

	if (!accessValid && expiry.refreshTokenValidUntilTime <= now) {
		// Clear private state before the caller renders the login form.
		teardownLocalSession();
		void logout(redirect, appConfig.urls.toLogin);
		return Promise.reject();
	}

	const { isCurrent, matchesSnapshot } = startTimers();
	if (accessValid) return;

	let renewed: boolean;
	try {
		renewed = await refreshTokens(isCurrent);
	} catch (error) {
		throw new TokenRefreshUnavailableError(error);
	}
	if (renewed && isCurrent()) {
		startTimers();
		return;
	}
	matchesSnapshot();
	if (
		getTokenExpiryFromLocalStorage().accessTokenValidUntilTime <= Date.now()
	) {
		throw new TokenRefreshUnavailableError();
	}
};
