import { getValueFromCookie } from './accessSessionCookie';
import {
	ACCESS_TOKEN_VALID_UNTIL_KEY,
	REFRESH_TOKEN_VALID_UNTIL_KEY
} from './accessSessionLocalStorage';
import { parseJwt } from '../../utils/parseJWT';

const APP_EXPIRY_KEYS = new Set<string>([
	ACCESS_TOKEN_VALID_UNTIL_KEY,
	REFRESH_TOKEN_VALID_UNTIL_KEY
]);

/** A refresh may rotate both tokens while retaining the same Keycloak session. */
export const getAppSessionScope = (): string | null => {
	const refreshToken = getValueFromCookie('refreshToken');
	const accessToken = getValueFromCookie('keycloak');
	for (const token of [refreshToken, accessToken]) {
		const claims = token ? parseJwt(token) : null;
		if (typeof claims?.sid === 'string' && claims.sid) {
			return JSON.stringify(['session', claims.iss, claims.sid]);
		}
	}
	for (const token of [accessToken, refreshToken]) {
		const claims = token ? parseJwt(token) : null;
		if (typeof claims?.sub === 'string' && claims.sub) {
			return JSON.stringify(['account', claims.iss, claims.sub]);
		}
	}
	return refreshToken || accessToken ? 'app-session-present' : null;
};

export const observeAppSession = (
	onSessionEnd: () => void,
	mountedScope = getAppSessionScope()
): (() => void) => {
	if (mountedScope === null) return () => {};

	let ended = false;
	const check = () => {
		if (!ended && getAppSessionScope() !== mountedScope) {
			ended = true;
			onSessionEnd();
		}
	};
	const onStorage = (event: StorageEvent) => {
		// App logout clears these keys after removing the shared cookies.
		if (
			event.storageArea === window.localStorage &&
			(event.key === null || APP_EXPIRY_KEYS.has(event.key))
		) {
			check();
		}
	};
	const onVisible = () => {
		if (document.visibilityState === 'visible') check();
	};

	window.addEventListener('storage', onStorage);
	window.addEventListener('pageshow', check);
	document.addEventListener('visibilitychange', onVisible);
	check();

	return () => {
		window.removeEventListener('storage', onStorage);
		window.removeEventListener('pageshow', check);
		document.removeEventListener('visibilitychange', onVisible);
	};
};
