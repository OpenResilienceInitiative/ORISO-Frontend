import { getKeycloakAccessToken } from '../sessionCookie/getKeycloakAccessToken';
import { encodeUsername } from '../../utils/encryptionHelpers';
import { setTokens } from '../auth/auth';
import { FETCH_ERRORS } from '../../api';
import { getBudibaseAccessToken } from '../sessionCookie/getBudibaseAccessToken';
import {
	TenantDataInterface,
	TenantDataSettingsInterface
} from '../../globalState/interfaces';
import { appConfig } from '../../utils/appConfig';
import { parseJwt } from '../../utils/parseJWT';
import {
	clearAuthSession,
	CONSULTANT_LOGIN_BLOCKED_ERROR,
	isConsultantAccessToken
} from '../auth/consultantLoginBlock';

export interface LoginData {
	data: {
		authToken?: string;
		userId?: string;
	};
	access_token?: string;
	expires_in?: number;
	refresh_token?: string;
	refresh_expires_in?: number;
}

interface AutoLoginProps {
	username: string;
	password: string;
	otp?: string;
	useOldUser?: boolean;
	tenantData?: TenantDataInterface;
}

const loginKeycloak = async (
	username: string,
	password: string,
	otp?: string
) => {
	// console.log("🔐 DEBUG: loginKeycloak called with:", { username, password: password ? "***" : "undefined", otp });

	const keycloakRes = await getKeycloakAccessToken(
		username,
		encodeURIComponent(password),
		otp || null
	);

	// console.log("🔐 DEBUG: loginKeycloak received response:", keycloakRes);

	setTokens(
		keycloakRes.access_token,
		keycloakRes.expires_in,
		keycloakRes.refresh_token,
		keycloakRes.refresh_expires_in
	);

	// console.log("🔐 DEBUG: loginKeycloak tokens set successfully");
	return keycloakRes;
};

export const autoLogin = async ({
	password,
	...autoLoginProps
}: AutoLoginProps): Promise<any> => {
	// console.log("🔐 DEBUG: autoLogin called with:", { username: autoLoginProps.username, password: password ? "***" : "undefined" });

	const tenantSettings = (autoLoginProps?.tenantData?.settings ||
		{}) as TenantDataSettingsInterface;

	let userHash = autoLoginProps.username;
	let username = encodeURIComponent(userHash);
	let keycloakRes;

	const legacyEncodedUsername = encodeUsername(autoLoginProps.username);

	// Prefer the entered username for current Keycloak users. Older accounts may
	// still require the legacy encoded username, so keep that as the fallback.
	try {
		// console.log("🔐 DEBUG: autoLogin - attempting Keycloak login with entered username");
		keycloakRes = await loginKeycloak(
			username,
			password,
			autoLoginProps.otp
		);
		// console.log("🔐 DEBUG: autoLogin - Keycloak login successful with entered username");
	} catch (e: any) {
		// console.log("🔐 DEBUG: autoLogin - Keycloak login failed with entered username:", e.message);
		if (e.message === FETCH_ERRORS.UNAUTHORIZED) {
			userHash = legacyEncodedUsername;
			username = legacyEncodedUsername;
			// console.log("🔐 DEBUG: autoLogin - retrying with legacy encoded username:", username);
			keycloakRes = await loginKeycloak(
				username,
				password,
				autoLoginProps.otp
			);
			// console.log("🔐 DEBUG: autoLogin - Keycloak login successful with legacy encoded username");
		} else {
			throw e;
		}
	}

	const tokenPayload = parseJwt(keycloakRes.access_token);

	if (
		appConfig.blockConsultantAppLogin &&
		isConsultantAccessToken(keycloakRes.access_token)
	) {
		clearAuthSession();
		throw new Error(CONSULTANT_LOGIN_BLOCKED_ERROR);
	}

	if (
		appConfig.useTenantService &&
		!appConfig.multitenancyWithSingleDomainEnabled
	) {
		const { tenantId } = tokenPayload;
		if (tenantId !== autoLoginProps.tenantData.id) {
			throw new Error(FETCH_ERRORS.UNAUTHORIZED);
		}
	}

	// Matrix is the only chat backend: fetch and persist the Matrix login
	// data. The Matrix client itself is created once by AuthenticatedApp.
	try {
		const { getMatrixAccessToken, persistMatrixLoginData } = await import(
			'../sessionCookie/getMatrixAccessToken'
		);

		// console.log('🔷 Calling getMatrixAccessToken...');
		const matrixLoginData = await getMatrixAccessToken();

		// Only persist the Matrix login data here. The actual Matrix client is
		// created and registered exactly once by AuthenticatedApp on the
		// authenticated load, so autoLogin must NOT spin up its own unregistered
		// client (that produced a second orphan sync loop that was never torn
		// down on logout).
		persistMatrixLoginData(matrixLoginData);
	} catch (error) {
		// Continue without Matrix login data - the app boots and shows the
		// session list; chat features recover on the next successful login.
	}

	if (tenantSettings?.featureToolsEnabled) {
		await getBudibaseAccessToken(username, password, tenantSettings);
	}
};

// Set in sessionStorage right before the post-registration redirect. The app
// bootstrap (AuthenticatedApp) reads it once to play the welcome loading animation
// that bridges the user-data/Matrix load, instead of the bare spinner, then clears it.
export const POST_REGISTRATION_LOADER_KEY =
	'onlineBeratung_postRegistrationLoader';

export const getPostRegistrationGroupChatId = (search: string) => {
	const value = new URLSearchParams(search).get('gcid')?.trim();
	return value || undefined;
};

export const redirectToApp = (gcid?: string) => {
	const value = gcid?.trim();
	const params = value
		? `?${new URLSearchParams({ gcid: value }).toString()}`
		: '';
	window.location.href = appConfig.urls.redirectToApp + params;
};
