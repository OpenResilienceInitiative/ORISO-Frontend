import { apiKeycloakLogout } from '../../api/apiLogoutKeycloak';
import { apiSetLiveChatAvailability } from '../../api/apiSetLiveChatAvailability';
import { clearLiveChatAvailabilityPreference } from '../../utils/liveChatAvailabilityStorage';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import { budibaseLogout } from '../budibase/budibaseLogout';
import { removeAllCookies } from '../sessionCookie/accessSessionCookie';
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

const LEGACY_MATRIX_LOCAL_STORAGE_KEYS = [
	MATRIX_USER_ID_STORAGE_KEY,
	MATRIX_ACCESS_TOKEN_STORAGE_KEY,
	MATRIX_DEVICE_ID_STORAGE_KEY,
	MATRIX_TOKEN_EXPIRY_STORAGE_KEY
] as const;

export const EVENT_PRE_LOGOUT = 'pre_logout';

let isRequestInProgress = false;
export const logout = async (
	withRedirect: boolean = true,
	redirectUrl?: string
) => {
	if (isRequestInProgress) {
		return null;
	}

	if (await callEventListeners(EVENT_PRE_LOGOUT)) {
		return;
	}

	isRequestInProgress = true;
	const { featureAppointmentsEnabled, featureToolsEnabled } =
		getTenantSettings();

	/* Drop live-chat availability while the access token is still valid, so the
	 * anonymous availability count decreases immediately on logout. */
	try {
		await apiSetLiveChatAvailability(false);
	} catch {
		// Logout must continue even when the availability store is unavailable.
	} finally {
		// Prevent this or another tab from continuing to present/refresh stale state.
		clearLiveChatAvailabilityPreference();
	}

	Promise.all([
		apiKeycloakLogout(),
		featureAppointmentsEnabled && calcomLogout(),
		featureToolsEnabled && budibaseLogout()
	]).finally(() => {
		invalidateCookies(withRedirect, redirectUrl);
	});
};

const invalidateCookies = (
	withRedirect: boolean = true,
	redirectUrl?: string
) => {
	void getMatrixClientService()
		?.logout()
		.catch(() => {});
	// Reset the module-level Matrix client registry so a stale, still
	// authenticated client cannot survive sign-out (the React context state is
	// reset separately in the logout flow / via the post-logout reload).
	setMatrixClientServiceRef(null);
	LEGACY_MATRIX_LOCAL_STORAGE_KEYS.forEach((key) => {
		localStorage.removeItem(key);
	});
	removeAllCookies();
	removeTokenExpiryFromLocalStorage();
	if (withRedirect) {
		redirectAfterLogout(redirectUrl);
	}
};

const redirectAfterLogout = (altRedirectUrl?: string) => {
	const redirectUrl = altRedirectUrl
		? altRedirectUrl
		: appConfig.urls.toEntry;
	setTimeout(() => {
		window.location.href = redirectUrl;
	}, 1000);
};
