import { createClient, MatrixClient } from 'matrix-js-sdk';
import { endpoints } from '../../resources/scripts/endpoints';
import { getMatrixHomeserverUrl } from '../../resources/scripts/runtimeConfig';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from '../../api/fetchData';
import {
	createMatrixErrorAwareLogger,
	getMatrixClientLogger
} from '../../utils/matrixLogging';
import { secretStorageKeyCallback } from '../../services/matrixKeyBackupService';
import {
	MATRIX_ACCESS_TOKEN_STORAGE_KEY,
	MATRIX_DEVICE_ID_STORAGE_KEY,
	MATRIX_TOKEN_EXPIRY_STORAGE_KEY,
	MATRIX_USER_ID_STORAGE_KEY
} from '../../utils/matrixStorageKeys';
import {
	createPasswordUiAuth,
	registerDeviceSigningAuth
} from '../../services/matrixInteractiveAuth';

export interface MatrixLoginData {
	accessToken: string;
	userId: string;
	deviceId: string;
	homeserverUrl: string;
	expiresInMs?: number;
	/** Transient Matrix password for device-signing UIA; never persisted. */
	uiaPassword?: string;
	// Anonymous live-chat users can never cross-sign a consultant's device, so
	// their client must share Megolm keys to all devices; invisible crypto
	// (verified-only) would silently make their messages undecryptable for the
	// consultant. See matrixClientService.initializeClient.
	isAnonymous?: boolean;
}

const MATRIX_DEVICE_ID_PREFIX = 'ORISO_WEB_';
const MATRIX_DISABLED_ERROR = 'MATRIX_DISABLED';

const isMatrixTokenBootstrapDisabled = (): boolean =>
	process.env.REACT_APP_DISABLE_LIVE_WEBSOCKET === '1' ||
	process.env.REACT_APP_DISABLE_LIVE_WEBSOCKET === 'true';

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

export const getMatrixAccessToken = (
	_username?: string,
	_password?: string
): Promise<MatrixLoginData> => {
	if (isMatrixTokenBootstrapDisabled()) {
		return Promise.reject(new Error(MATRIX_DISABLED_ERROR));
	}

	const requestedDeviceId = getOrCreateRequestedDeviceId();
	const querySeparator = endpoints.matrixAccessToken.includes('?')
		? '&'
		: '?';
	const tokenUrl = `${endpoints.matrixAccessToken}${querySeparator}deviceId=${encodeURIComponent(
		requestedDeviceId
	)}`;
	return fetchData({
		url: tokenUrl,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.CATCH_ALL],
		recoverOnPublicAuthRoute: false
	}).then((response) => {
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
			userId: response.userId,
			deviceId: getOrCreateMatrixDeviceId(
				response.userId,
				response.deviceId
			),
			homeserverUrl,
			expiresInMs: response.expiresInMs,
			uiaPassword: response.uiaPassword
		};
	});
};

export const persistMatrixLoginData = (loginData: MatrixLoginData): void => {
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
	if (loginData.expiresInMs) {
		localStorage.setItem(
			MATRIX_TOKEN_EXPIRY_STORAGE_KEY,
			(Date.now() + loginData.expiresInMs).toString()
		);
	}
};

export const clearPersistedMatrixDeviceId = (userId: string): void => {
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
			getSecretStorageKey: secretStorageKeyCallback
		}
	});

	if (loginData.uiaPassword) {
		registerDeviceSigningAuth(
			client,
			createPasswordUiAuth(loginData.userId, loginData.uiaPassword)
		);
	}

	return client;
};
