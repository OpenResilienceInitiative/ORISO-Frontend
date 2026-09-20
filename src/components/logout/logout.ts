import { clearLoginRecoveryPassword } from '../../services/loginRecoveryHandoff';
import { clearSecretStorageKeys } from '../../services/matrixKeyBackupService';
import { clearRecoveryRuntimeState } from '../../services/recoveryReminderState';
import { apiKeycloakLogout } from '../../api/apiLogoutKeycloak';
import { apiSetLiveChatAvailability } from '../../api/apiSetLiveChatAvailability';
import { clearLiveChatAvailabilityPreference } from '../../utils/liveChatAvailabilityStorage';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import { budibaseLogout } from '../budibase/budibaseLogout';
import {
	getValueFromCookie,
	removeAllCookies
} from '../sessionCookie/accessSessionCookie';
import { sessionKindRegistry } from '../../utils/displayFilter/sessionKindRegistry';
import { removeTokenExpiryFromLocalStorage } from '../sessionCookie/accessSessionLocalStorage';
import { appConfig } from '../../utils/appConfig';
import { calcomLogout } from './calcomLogout';
import { callEventListeners } from '../../utils/eventHandler';
import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from '../../services/matrixClientRegistry';
import {
	MATRIX_ACCESS_TOKEN_STORAGE_KEY,
	MATRIX_DEVICE_ID_STORAGE_KEY,
	MATRIX_TOKEN_EXPIRY_STORAGE_KEY,
	MATRIX_USER_ID_STORAGE_KEY
} from '../../utils/matrixStorageKeys';
import {
	clearMatrixSsoHandoffCookies,
	purgeAppWebStorage
} from '../../services/clientStorageHygiene';
import { withTimeout } from '../../utils/promiseTimeout';

const LEGACY_MATRIX_LOCAL_STORAGE_KEYS = [
	MATRIX_USER_ID_STORAGE_KEY,
	MATRIX_ACCESS_TOKEN_STORAGE_KEY,
	MATRIX_DEVICE_ID_STORAGE_KEY,
	MATRIX_TOKEN_EXPIRY_STORAGE_KEY
] as const;

export const EVENT_PRE_LOGOUT = 'pre_logout';
export const LOGOUT_REQUEST_TIMEOUT_MS = 5_000;

/**
 * Upper bound for the pre-logout handlers (draft flush, anonymous session
 * finish). They run against a session that is about to end; one that never
 * settles must not keep the tokens alive in this tab.
 */
export const PRE_LOGOUT_HANDLERS_TIMEOUT_MS = 5_000;

let isRequestInProgress = false;

const runPreLogoutHandlers = async (): Promise<boolean> => {
	const controller = new AbortController();
	try {
		const result = await withTimeout(
			Promise.resolve(
				callEventListeners(EVENT_PRE_LOGOUT, controller.signal)
			),
			PRE_LOGOUT_HANDLERS_TIMEOUT_MS,
			'pre-logout handlers timed out'
		);
		return result === true;
	} catch {
		controller.abort();
		// A failed or hanging draft flush is no reason to stay signed in.
		return false;
	}
};

const runBoundedLogoutRequest = <Value>(
	request: (signal: AbortSignal) => Promise<Value>
): Promise<Value> => {
	const controller = new AbortController();
	const timeout = window.setTimeout(
		() => controller.abort(),
		LOGOUT_REQUEST_TIMEOUT_MS
	);
	return request(controller.signal).finally(() =>
		window.clearTimeout(timeout)
	);
};

export const logout = async (
	withRedirect: boolean = true,
	redirectUrl?: string
) => {
	if (isRequestInProgress) {
		return null;
	}
	// Claimed before the handlers run: a 401 inside a draft flush calls
	// logout() again, and that re-entrant call must be a no-op rather than a
	// second, redirecting sign-out racing this one.
	isRequestInProgress = true;

	// With the session already torn down (auth guard, expired refresh token)
	// there is nothing the handlers or the availability call could still do
	// with the backend — they would only produce 401s.
	const hasSession = Boolean(getValueFromCookie('keycloak'));

	if (hasSession && (await runPreLogoutHandlers())) {
		isRequestInProgress = false;
		return;
	}
	clearLoginRecoveryPassword();
	clearSecretStorageKeys();
	clearRecoveryRuntimeState();
	const { featureAppointmentsEnabled, featureToolsEnabled } =
		getTenantSettings();

	const serverRequests: Promise<unknown>[] = [];
	if (hasSession) {
		serverRequests.push(
			runBoundedLogoutRequest((signal) =>
				apiSetLiveChatAvailability(false, signal)
			),
			runBoundedLogoutRequest((signal) => apiKeycloakLogout(signal))
		);
		if (featureAppointmentsEnabled) {
			serverRequests.push(
				runBoundedLogoutRequest((signal) => calcomLogout(signal))
			);
		}
		if (featureToolsEnabled) {
			serverRequests.push(
				runBoundedLogoutRequest((signal) => budibaseLogout(signal))
			);
		}
	}
	clearLiveChatAvailabilityPreference();
	teardownLocalSession();

	void Promise.allSettled(serverRequests).then(() => {
		if (withRedirect) {
			redirectAfterLogout(redirectUrl);
			return;
		}
		// Without a reload the app keeps running (the login form takes
		// over in place), so the next sign-out must not be swallowed.
		isRequestInProgress = false;
	});
};

/**
 * Ends the session in this tab, synchronously and idempotently: stops the
 * Matrix client and forgets it, drops every auth and Matrix token from
 * cookies and Web Storage, and sweeps app-scoped storage (#1071).
 *
 * `logout()` calls it after the pre-logout handlers. The auth guard calls it
 * *before* the login form is shown, so an expired refresh token can never
 * leave a half-signed-out tab behind: no poller keeps using the leftover
 * access token, and the next sign-in does not inherit the old Matrix device.
 * Fires the auth-session-change event (through `removeAllCookies`) so
 * providers above the router drop their session-bound state.
 */
export const teardownLocalSession = (): void => {
	void getMatrixClientService()
		?.logout()
		.catch(() => {});
	// Reset the module-level Matrix client registry so a stale, still
	// authenticated client cannot survive sign-out (the React context state is
	// reset separately in the logout flow / via the post-logout reload).
	setMatrixClientServiceRef(null);
	// #1377 "Ton": the session → kind map is user-scoped; the next user must
	// not inherit mute/tone decisions from the previous one.
	sessionKindRegistry.reset();
	LEGACY_MATRIX_LOCAL_STORAGE_KEYS.forEach((key) => {
		localStorage.removeItem(key);
	});
	removeAllCookies();
	removeTokenExpiryFromLocalStorage();
	// #1071: counselling agencies share browser profiles, so nothing
	// user-scoped may outlive sign-out. Runs after the pre-logout draft flush
	// (EVENT_PRE_LOGOUT, awaited in `logout`), so no unsaved draft is lost.
	clearMatrixSsoHandoffCookies();
	purgeAppWebStorage();
};

const redirectAfterLogout = (altRedirectUrl?: string) => {
	const redirectUrl = altRedirectUrl
		? altRedirectUrl
		: appConfig.urls.toEntry;
	setTimeout(() => {
		window.location.href = redirectUrl;
	}, 1000);
};
