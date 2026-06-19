import { createClient, MatrixClient } from 'matrix-js-sdk';
import { getMatrixHomeserverUrl } from '../../resources/scripts/runtimeConfig';
import { endpoints } from '../../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from '../../api/fetchData';

export interface MatrixLoginData {
	accessToken: string;
	userId: string;
	deviceId: string;
	homeserverUrl: string;
}

export const getMatrixAccessToken = (
	_username?: string,
	_password?: string
): Promise<MatrixLoginData> =>
	new Promise((resolve, reject) => {
		const homeserverUrl = getMatrixHomeserverUrl();
		if (!homeserverUrl) {
			reject(
				new Error('REACT_APP_MATRIX_HOMESERVER_URL is not configured')
			);
			return;
		}

		fetchData({
			url: endpoints.matrixMeToken,
			method: FETCH_METHODS.GET,
			rcValidation: false
		})
			.then((response) => {
				resolve({
					accessToken: response.accessToken,
					userId: response.userId,
					deviceId: response.deviceId || '',
					homeserverUrl: homeserverUrl
				});
			})
			.catch(() => {
				reject(new Error('matrixLogin'));
			});
	});

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
