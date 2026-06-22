import { apiKeycloakLogout } from '../../api/apiLogoutKeycloak';
import { apiSetLiveChatAvailability } from '../../api/apiSetLiveChatAvailability';
// // import { apiRocketchatLogout } from '../../api/apiLogoutRocketchat';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import { budibaseLogout } from '../budibase/budibaseLogout';
import { removeAllCookies } from '../sessionCookie/accessSessionCookie';
import {
	removeRocketChatMasterKeyFromLocalStorage,
	removeTokenExpiryFromLocalStorage
} from '../sessionCookie/accessSessionLocalStorage';
import { appConfig } from '../../utils/appConfig';
import { calcomLogout } from './calcomLogout';
import { callEventListeners } from '../../utils/eventHandler';
import { getMatrixClientService } from '../../services/matrixClientRegistry';

const LEGACY_MATRIX_LOCAL_STORAGE_KEYS = [
	'matrix_user_id',
	'matrix_access_token',
	'matrix_token_expires_at'
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
	await apiSetLiveChatAvailability(false);

	Promise.all([
		// Skip RocketChat logout due to configuration issues
		// apiRocketchatLogout(),
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
	LEGACY_MATRIX_LOCAL_STORAGE_KEYS.forEach((key) => {
		localStorage.removeItem(key);
	});
	removeAllCookies();
	removeTokenExpiryFromLocalStorage();
	removeRocketChatMasterKeyFromLocalStorage();
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
