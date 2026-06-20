import { createClient, MatrixClient } from 'matrix-js-sdk';
import { apiUrl } from '../../resources/scripts/endpoints';
import { getMatrixHomeserverUrl } from '../../resources/scripts/runtimeConfig';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from '../../api/fetchData';
import { setValueInCookie } from './accessSessionCookie';

export interface MatrixLoginData {
	accessToken: string;
	userId: string;
	deviceId: string;
	homeserverUrl: string;
	expiresInMs?: number;
}

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
			deviceId: response.deviceId || '',
			homeserverUrl,
			expiresInMs: response.expiresInMs
		};
	});
};

export const persistMatrixLoginData = (loginData: MatrixLoginData): void => {
	localStorage.setItem('matrix_user_id', loginData.userId);
	localStorage.setItem('matrix_access_token', loginData.accessToken);
	localStorage.setItem('matrix_device_id', loginData.deviceId || '');
	if (loginData.expiresInMs) {
		localStorage.setItem(
			'matrix_token_expires_at',
			String(Date.now() + loginData.expiresInMs)
		);
	}

	setValueInCookie('rc_uid', loginData.userId);
	setValueInCookie('rc_token', loginData.accessToken);
};

// Helper function to create Matrix client with stored credentials
export const createMatrixClient = (
	loginData: MatrixLoginData
): MatrixClient => {
	return createClient({
		baseUrl: loginData.homeserverUrl,
		accessToken: loginData.accessToken,
		userId: loginData.userId,
		deviceId: loginData.deviceId
	});
};
