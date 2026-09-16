import { logout, teardownLocalSession } from '../logout/logout';
import { setValueInCookie } from '../sessionCookie/accessSessionCookie';
import {
	getTokenExpiryFromLocalStorage,
	setTokenExpiryInLocalStorage
} from '../sessionCookie/accessSessionLocalStorage';
import { refreshKeycloakAccessToken } from '../sessionCookie/refreshKeycloakAccessToken';
import { appConfig } from '../../utils/appConfig';

export const RENEW_BEFORE_EXPIRY_IN_MS = 10 * 1000; // seconds

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

const refreshTokens = (): Promise<void> => {
	const currentTime = new Date().getTime();
	const tokenExpiry = getTokenExpiryFromLocalStorage();

	if (
		tokenExpiry.refreshTokenValidUntilTime <=
		currentTime - RENEW_BEFORE_EXPIRY_IN_MS
	) {
		logout(true, appConfig.urls.toLogin);
		return Promise.resolve();
	}

	return refreshKeycloakAccessToken().then((response) => {
		setTokens(
			response.access_token,
			response.expires_in,
			response.refresh_token,
			response.refresh_expires_in
		);
	});
};

const startTimers = ({
	accessTokenValidInMs,
	refreshTokenValidInMs
}: {
	accessTokenValidInMs: number;
	refreshTokenValidInMs: number;
}) => {
	const accessTokenRefreshIntervalInMs =
		accessTokenValidInMs - RENEW_BEFORE_EXPIRY_IN_MS;

	let refreshInterval;
	// just a sanity check so that we don't accidentally register an endless loop
	if (accessTokenRefreshIntervalInMs > 0) {
		refreshInterval = window.setInterval(() => {
			refreshTokens();
		}, accessTokenRefreshIntervalInMs);
	}

	if (refreshTokenValidInMs > accessTokenValidInMs) {
		// when refresh token is longer valid than access token we need to
		// logout if the refresh token expires
		window.setTimeout(() => {
			if (refreshInterval) {
				window.clearInterval(refreshInterval);
			}

			logout(true, appConfig.urls.toLogin);
		}, refreshTokenValidInMs);
	}
};

export const handleTokenRefresh = (redirect: boolean = true): Promise<void> => {
	return new Promise((resolve, reject) => {
		const currentTime = new Date().getTime();
		const tokenExpiry = getTokenExpiryFromLocalStorage();
		const accessTokenValidInMs =
			tokenExpiry.accessTokenValidUntilTime - currentTime;

		const refreshTokenValidInMs =
			tokenExpiry.refreshTokenValidUntilTime - currentTime;

		if (refreshTokenValidInMs <= 0 && accessTokenValidInMs <= 0) {
			// Access and refresh token are gone. Tear the local session down
			// *now*, before the caller renders the login form: `logout()`
			// first awaits its pre-logout handlers, and in that window the
			// leftover cookies kept the notification poller and the Matrix
			// client alive next to the login form (dev, 2026-09-16).
			teardownLocalSession();
			void logout(redirect, appConfig.urls.toLogin);
			reject();
		} else if (accessTokenValidInMs <= 0) {
			// access token no longer valid but refresh token still valid, refresh tokens
			refreshTokens().then(() => {
				startTimers({
					accessTokenValidInMs,
					refreshTokenValidInMs
				});
				resolve();
			});
		} else {
			// access token and refresh token still valid, just start the timers
			startTimers({
				accessTokenValidInMs,
				refreshTokenValidInMs
			});
			resolve();
		}
	});
};
