import { getValueFromCookie } from './accessSessionCookie';
import {
	ACCESS_TOKEN_VALID_UNTIL_KEY,
	REFRESH_TOKEN_VALID_UNTIL_KEY
} from './accessSessionLocalStorage';
import { parseJwt } from '../../utils/parseJWT';

export const APP_SESSION_ENDED_KEY = 'oriso.auth.session-ended';

interface AppSessionScope {
	identity: string;
	stable: boolean;
}

/** A refresh may rotate both tokens while retaining the same Keycloak session. */
export const getAppSessionScope = (): AppSessionScope | null => {
	const refreshToken = getValueFromCookie('refreshToken');
	const accessToken = getValueFromCookie('keycloak');
	if (!refreshToken && !accessToken) return null;

	const claims = [refreshToken, accessToken].map((token) =>
		token ? parseJwt(token) : null
	);
	const session = claims.find(
		(claim) => typeof claim?.sid === 'string' && claim.sid
	);
	if (session) {
		return {
			identity: JSON.stringify(['session', session.iss, session.sid]),
			stable: true
		};
	}
	const account = claims.find(
		(claim) => typeof claim?.sub === 'string' && claim.sub
	);
	return {
		identity: account
			? JSON.stringify(['account', account.iss, account.sub])
			: 'app-session-present',
		stable: false
	};
};

export const publishAppSessionEnd = (scope: AppSessionScope | null): void => {
	if (!scope?.stable) return;
	try {
		// The initiating tab has completed its shared cleanup. The browser may
		// still expose the previous cookies in another renderer.
		window.localStorage.setItem(APP_SESSION_ENDED_KEY, scope.identity);
	} catch {
		// The initiating tab still finishes when Web Storage is unavailable.
	}
};

export const observeAppSession = (
	onSessionEnd: () => void,
	mountedScope = getAppSessionScope()
): (() => void) => {
	if (mountedScope === null) return () => {};

	let ended = false;
	const end = () => {
		if (ended) return;
		ended = true;
		onSessionEnd();
	};
	const hasEndedMarker = () => {
		try {
			return (
				mountedScope.stable &&
				window.localStorage.getItem(APP_SESSION_ENDED_KEY) ===
					mountedScope.identity
			);
		} catch {
			return false;
		}
	};
	const check = () => {
		if (
			hasEndedMarker() ||
			getAppSessionScope()?.identity !== mountedScope.identity
		) {
			end();
		}
	};
	const onStorage = (event: StorageEvent) => {
		if (event.storageArea !== window.localStorage) return;
		if (event.key === APP_SESSION_ENDED_KEY) {
			if (mountedScope.stable && event.newValue === mountedScope.identity)
				end();
			return;
		}
		if (
			event.key === null ||
			event.key === ACCESS_TOKEN_VALID_UNTIL_KEY ||
			event.key === REFRESH_TOKEN_VALID_UNTIL_KEY
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
