import { createClient, MatrixClient } from 'matrix-js-sdk';
import { endpoints } from '../../resources/scripts/endpoints';
import { getMatrixHomeserverUrl } from '../../resources/scripts/runtimeConfig';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from '../../api/fetchData';
import {
	createMatrixErrorAwareLogger,
	getMatrixClientLogger
} from '../../utils/matrixLogging';
import { getValueFromCookie } from './accessSessionCookie';
import { parseJwt } from '../../utils/parseJWT';
import { secretStorageKeyCallback } from '../../services/matrixKeyBackupService';
import {
	MATRIX_ACCESS_TOKEN_STORAGE_KEY,
	MATRIX_DEVICE_ID_STORAGE_KEY,
	MATRIX_SESSION_SUBJECT_STORAGE_KEY,
	MATRIX_TOKEN_EXPIRY_STORAGE_KEY,
	MATRIX_USER_ID_STORAGE_KEY
} from '../../utils/matrixStorageKeys';
import { registerDeviceSigningPassword } from '../../services/matrixInteractiveAuth';

export interface MatrixLoginData {
	accessToken: string;
	userId: string;
	deviceId: string;
	homeserverUrl: string;
	expiresInMs?: number;
	/** Transient Matrix password for device-signing UIA; never persisted. */
	uiaPassword?: string;
	/** Authentication identity that requested these credentials; never a password. */
	authenticatedSubject?: string;
	/** Transient device epoch prevents persisting credentials invalidated by recovery. */
	deviceGeneration?: number;
	// Anonymous live-chat users can never cross-sign a consultant's device, so
	// their client must share Megolm keys to all devices; invisible crypto
	// (verified-only) would silently make their messages undecryptable for the
	// consultant. See matrixClientService.initializeClient.
	isAnonymous?: boolean;
}

const MATRIX_DEVICE_ID_PREFIX = 'ORISO_WEB_';

const MATRIX_TOKEN_REUSE_BUFFER_MS = 2 * 60 * 1000;
const MATRIX_DEVICE_ID_PATTERN = /^[A-Za-z0-9._=-]{1,255}$/;

export interface MatrixTokenBootstrapOptions {
	forceRefresh?: boolean;
}

interface InFlightTokenBootstrap {
	promise: Promise<MatrixLoginData>;
	subject: string | null;
}

let inFlightTokenBootstrap: InFlightTokenBootstrap | null = null;
let deviceBootstrapGeneration = 0;

const createBrowserDeviceId = (
	prefix: string = MATRIX_DEVICE_ID_PREFIX
): string => {
	const randomValue =
		typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID().replace(/-/g, '')
			: `${Date.now().toString(36)}${Math.random()
					.toString(36)
					.slice(2)}`;

	return `${prefix}${randomValue.toUpperCase().slice(0, 24)}`;
};

const getOrCreateMatrixDeviceId = (
	userId: string,
	responseDeviceId?: string
): string => {
	const userStorageKey = `${MATRIX_DEVICE_ID_STORAGE_KEY}:${userId}`;
	if (responseDeviceId) {
		localStorage.setItem(userStorageKey, responseDeviceId);
		return responseDeviceId;
	}

	const storedDeviceId = localStorage.getItem(userStorageKey);
	if (storedDeviceId) {
		return storedDeviceId;
	}

	const deviceId = createBrowserDeviceId();
	localStorage.setItem(userStorageKey, deviceId);
	return deviceId;
};

const getOrCreateRequestedDeviceId = (): string => {
	const storedDeviceId = localStorage.getItem(MATRIX_DEVICE_ID_STORAGE_KEY);
	if (storedDeviceId) {
		return storedDeviceId;
	}

	const deviceId = createBrowserDeviceId();
	localStorage.setItem(MATRIX_DEVICE_ID_STORAGE_KEY, deviceId);
	return deviceId;
};

const getCurrentAuthSubject = (): string | null => {
	try {
		const keycloakToken = getValueFromCookie('keycloak');
		if (!keycloakToken) {
			return null;
		}

		const claims = parseJwt(keycloakToken) as unknown;
		if (typeof claims !== 'object' || claims === null) {
			return null;
		}
		const authClaims = claims as {
			exp?: unknown;
			sub?: unknown;
		};
		if (
			typeof authClaims.sub !== 'string' ||
			authClaims.sub.length === 0 ||
			typeof authClaims.exp !== 'number' ||
			authClaims.exp * 1000 <= Date.now()
		) {
			return null;
		}

		return authClaims.sub;
	} catch {
		return null;
	}
};

const getPersistedMatrixLoginData = (): MatrixLoginData | null => {
	const accessToken = localStorage.getItem(MATRIX_ACCESS_TOKEN_STORAGE_KEY);
	const userId = localStorage.getItem(MATRIX_USER_ID_STORAGE_KEY);
	const deviceId = localStorage.getItem(MATRIX_DEVICE_ID_STORAGE_KEY);
	const sessionSubject = localStorage.getItem(
		MATRIX_SESSION_SUBJECT_STORAGE_KEY
	);
	const currentAuthSubject = getCurrentAuthSubject();
	const rawExpiresAt = localStorage.getItem(MATRIX_TOKEN_EXPIRY_STORAGE_KEY);
	const expiresAt = rawExpiresAt ? Number(rawExpiresAt) : NaN;
	const remainingLifetimeMs = expiresAt - Date.now();
	const homeserverUrl = getMatrixHomeserverUrl();

	if (
		!accessToken ||
		!userId?.startsWith('@') ||
		!userId.includes(':') ||
		!deviceId ||
		!MATRIX_DEVICE_ID_PATTERN.test(deviceId) ||
		!sessionSubject ||
		sessionSubject !== currentAuthSubject ||
		!Number.isFinite(expiresAt) ||
		remainingLifetimeMs <= MATRIX_TOKEN_REUSE_BUFFER_MS ||
		!homeserverUrl
	) {
		return null;
	}

	return {
		accessToken,
		userId,
		deviceId,
		homeserverUrl,
		authenticatedSubject: sessionSubject,
		deviceGeneration: deviceBootstrapGeneration,
		expiresInMs: remainingLifetimeMs
	};
};

const matrixTokenUrl = (deviceId: string): string =>
	`${endpoints.matrixAccessToken}${
		endpoints.matrixAccessToken.includes('?') ? '&' : '?'
	}deviceId=${encodeURIComponent(deviceId)}`;

/** Ends the session behind a token. Matrix logout deletes that token's device, so only use it on a
 * token of another device or after this browser was signed out. */
const revokeMatrixToken = (homeserverUrl: string, accessToken: string) =>
	void fetch(`${homeserverUrl}/_matrix/client/v3/logout`, {
		method: 'POST',
		// Survives the navigation that usually follows sign-out.
		keepalive: true,
		headers: { Authorization: `Bearer ${accessToken}` }
	}).catch(() => undefined);

/**
 * The account's Matrix password as of now, for one device-signing UIA. The same call signs this
 * device in again; the client moves onto that token so it stays authorised and logout revokes it.
 */
const fetchCurrentUiaPassword = async (
	client: MatrixClient,
	loginData: MatrixLoginData
): Promise<string> => {
	const response = await fetchData({
		url: matrixTokenUrl(loginData.deviceId),
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.CATCH_ALL],
		recoverOnPublicAuthRoute: false
	});
	const token: string | undefined = response?.accessToken;
	if (
		response?.userId !== loginData.userId ||
		response?.deviceId !== loginData.deviceId
	) {
		if (token) revokeMatrixToken(loginData.homeserverUrl, token);
		throw new Error('Matrix login was bound to another account or device');
	}
	if (!token) {
		throw new Error('Matrix login returned no access token');
	}
	const storedToken = localStorage.getItem(MATRIX_ACCESS_TOKEN_STORAGE_KEY);
	if (
		!storedToken ||
		localStorage.getItem(MATRIX_USER_ID_STORAGE_KEY) !== loginData.userId
	) {
		// Signed out while the request was in flight: commit nothing, end the session just issued.
		revokeMatrixToken(loginData.homeserverUrl, token);
		throw new Error('Matrix session ended during device-signing auth');
	}
	// Replaced by a same-tab refresh (stopped): the session lives on in the new client, touch nothing.
	if (!client.clientRunning) {
		throw new Error(
			'Matrix client was replaced during device-signing auth'
		);
	}
	// A newer token of this account in storage (refresh, other tab) stays; it is alive too.
	const ownsStorage = storedToken === client.getAccessToken();
	client.setAccessToken(token);
	if (ownsStorage) {
		persistMatrixLoginData({
			...loginData,
			accessToken: token,
			expiresInMs: response.expiresInMs
		});
	}
	if (!response.uiaPassword) {
		throw new Error('Matrix login returned no UIA password');
	}
	return response.uiaPassword;
};

const requestMatrixAccessToken = (): Promise<MatrixLoginData> => {
	const requestedSubject = getCurrentAuthSubject();
	const requestedGeneration = deviceBootstrapGeneration;

	const requestedDeviceId = getOrCreateRequestedDeviceId();
	return fetchData({
		url: matrixTokenUrl(requestedDeviceId),
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.CATCH_ALL],
		recoverOnPublicAuthRoute: false
	}).then((response) => {
		if (requestedGeneration !== deviceBootstrapGeneration) {
			throw new Error('Matrix device changed during token bootstrap');
		}
		if (getCurrentAuthSubject() !== requestedSubject) {
			throw new Error('Matrix session changed during token bootstrap');
		}
		const homeserverUrl = getMatrixHomeserverUrl();
		if (!homeserverUrl) {
			throw new Error(
				'REACT_APP_MATRIX_HOMESERVER_URL is not configured'
			);
		}
		if (!response.accessToken || !response.userId || !response.deviceId) {
			throw new Error(
				'Matrix login did not return a device-bound access token'
			);
		}

		return {
			accessToken: response.accessToken,
			deviceGeneration: requestedGeneration,
			userId: response.userId,
			deviceId: getOrCreateMatrixDeviceId(
				response.userId,
				response.deviceId
			),
			homeserverUrl,
			expiresInMs: response.expiresInMs,
			uiaPassword: response.uiaPassword,
			...(requestedSubject
				? { authenticatedSubject: requestedSubject }
				: {})
		};
	});
};

export const getMatrixAccessToken = (
	options: MatrixTokenBootstrapOptions = {}
): Promise<MatrixLoginData> => {
	const currentAuthSubject = getCurrentAuthSubject();
	if (
		currentAuthSubject &&
		inFlightTokenBootstrap?.subject === currentAuthSubject
	) {
		return inFlightTokenBootstrap.promise;
	}

	if (!options.forceRefresh) {
		const persistedLogin = getPersistedMatrixLoginData();
		if (persistedLogin) {
			return Promise.resolve(persistedLogin);
		}
	}

	let bootstrapPromise: Promise<MatrixLoginData>;
	bootstrapPromise = requestMatrixAccessToken().finally(() => {
		if (inFlightTokenBootstrap?.promise === bootstrapPromise) {
			inFlightTokenBootstrap = null;
		}
	});
	inFlightTokenBootstrap = {
		promise: bootstrapPromise,
		subject: currentAuthSubject
	};
	return bootstrapPromise;
};

export const persistMatrixLoginData = (loginData: MatrixLoginData): void => {
	if (
		loginData.deviceGeneration !== undefined &&
		loginData.deviceGeneration !== deviceBootstrapGeneration
	) {
		throw new Error('Matrix device changed before credential persistence');
	}
	if (
		loginData.authenticatedSubject &&
		loginData.authenticatedSubject !== getCurrentAuthSubject()
	) {
		throw new Error('Matrix session changed before credential persistence');
	}
	localStorage.setItem(
		MATRIX_ACCESS_TOKEN_STORAGE_KEY,
		loginData.accessToken
	);
	localStorage.setItem(MATRIX_USER_ID_STORAGE_KEY, loginData.userId);
	localStorage.setItem(MATRIX_DEVICE_ID_STORAGE_KEY, loginData.deviceId);
	localStorage.setItem(
		`${MATRIX_DEVICE_ID_STORAGE_KEY}:${loginData.userId}`,
		loginData.deviceId
	);
	const currentAuthSubject = getCurrentAuthSubject();
	if (currentAuthSubject) {
		localStorage.setItem(
			MATRIX_SESSION_SUBJECT_STORAGE_KEY,
			currentAuthSubject
		);
	} else {
		localStorage.removeItem(MATRIX_SESSION_SUBJECT_STORAGE_KEY);
	}
	if (
		typeof loginData.expiresInMs === 'number' &&
		Number.isFinite(loginData.expiresInMs) &&
		loginData.expiresInMs > 0
	) {
		localStorage.setItem(
			MATRIX_TOKEN_EXPIRY_STORAGE_KEY,
			(Date.now() + loginData.expiresInMs).toString()
		);
	} else {
		localStorage.removeItem(MATRIX_TOKEN_EXPIRY_STORAGE_KEY);
	}
};

export const clearPersistedMatrixDeviceId = (userId: string): void => {
	deviceBootstrapGeneration += 1;
	inFlightTokenBootstrap = null;
	localStorage.removeItem(MATRIX_DEVICE_ID_STORAGE_KEY);
	localStorage.removeItem(`${MATRIX_DEVICE_ID_STORAGE_KEY}:${userId}`);
};

// Helper function to create Matrix client with stored credentials
export const createMatrixClient = (
	loginData: MatrixLoginData,
	onSdkError?: (...messages: unknown[]) => void
): MatrixClient => {
	const baseLogger = getMatrixClientLogger();
	const client = createClient({
		baseUrl: loginData.homeserverUrl,
		accessToken: loginData.accessToken,
		userId: loginData.userId,
		deviceId: loginData.deviceId,
		fallbackICEServerAllowed: true,
		logger: onSdkError
			? createMatrixErrorAwareLogger(baseLogger, onSdkError)
			: baseLogger,
		// #437 key backup + recovery: the SDK pulls the secret-storage key
		// through this callback during setup/recovery flows (one-shot in-memory
		// cache, never persisted).
		cryptoCallbacks: {
			getSecretStorageKey: (keys, name) =>
				secretStorageKeyCallback(client, keys, name)
		}
	});

	if (
		!loginData.isAnonymous &&
		(loginData.uiaPassword || loginData.authenticatedSubject)
	) {
		// Every token fetch rotates the password, so the one in loginData goes stale; ask anew.
		registerDeviceSigningPassword(client, loginData.userId, () =>
			fetchCurrentUiaPassword(client, loginData)
		);
	}

	return client;
};
