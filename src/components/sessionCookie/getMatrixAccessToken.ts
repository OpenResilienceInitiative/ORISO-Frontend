import { createClient, MatrixClient } from 'matrix-js-sdk';
import { apiUrl } from '../../resources/scripts/endpoints';
import { getMatrixHomeserverUrl } from '../../resources/scripts/runtimeConfig';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from '../../api/fetchData';

export interface MatrixLoginData {
	accessToken: string;
	userId: string;
	deviceId: string;
	homeserverUrl: string;
	expiresInMs?: number;
}

const MATRIX_DEVICE_ID_STORAGE_KEY = 'matrix_device_id';
const MATRIX_DEVICE_ID_PREFIX = 'ORISO_WEB_';

const createBrowserDeviceId = (): string => {
	const randomValue =
		typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID().replace(/-/g, '')
			: `${Date.now().toString(36)}${Math.random()
					.toString(36)
					.slice(2)}`;

	return `${MATRIX_DEVICE_ID_PREFIX}${randomValue
		.toUpperCase()
		.slice(0, 24)}`;
};

const getOrCreateMatrixDeviceId = (
	userId: string,
	responseDeviceId?: string
): string => {
	if (responseDeviceId) {
		return responseDeviceId;
	}

	const userStorageKey = `${MATRIX_DEVICE_ID_STORAGE_KEY}:${userId}`;
	const storedDeviceId = localStorage.getItem(userStorageKey);
	if (storedDeviceId) {
		return storedDeviceId;
	}

	const deviceId = createBrowserDeviceId();
	localStorage.setItem(userStorageKey, deviceId);
	return deviceId;
};

export const getMatrixAccessToken = (
	_username?: string,
	_password?: string
): Promise<MatrixLoginData> => {
	const tokenUrl = `${apiUrl}/service/matrix/me/token`;
	return fetchData({
		url: tokenUrl,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	}).then((response) => {
		const homeserverUrl = getMatrixHomeserverUrl();
		if (!homeserverUrl) {
			throw new Error(
				'REACT_APP_MATRIX_HOMESERVER_URL is not configured'
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
			expiresInMs: response.expiresInMs
		};
	});
};

export const persistMatrixLoginData = (loginData: MatrixLoginData): void => {
	localStorage.setItem(MATRIX_DEVICE_ID_STORAGE_KEY, loginData.deviceId);
	localStorage.setItem(
		`${MATRIX_DEVICE_ID_STORAGE_KEY}:${loginData.userId}`,
		loginData.deviceId
	);

	const secure = window.location.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `rc_uid=${loginData.userId}; path=/; SameSite=Strict${secure}`;
	document.cookie = `rc_token=${loginData.accessToken}; path=/; SameSite=Strict${secure}`;
};

// Helper function to create Matrix client with stored credentials
export const createMatrixClient = (
	loginData: MatrixLoginData
): MatrixClient => {
	return createClient({
		baseUrl: loginData.homeserverUrl,
		accessToken: loginData.accessToken,
		userId: loginData.userId,
		deviceId: loginData.deviceId,
		fallbackICEServerAllowed: true
	});
};
