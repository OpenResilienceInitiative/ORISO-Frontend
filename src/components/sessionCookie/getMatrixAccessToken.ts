import { createClient, MatrixClient } from 'matrix-js-sdk';

export interface MatrixLoginData {
	accessToken: string;
	userId: string;
	deviceId: string;
	homeserverUrl: string;
}

export const getMatrixAccessToken = (
	username: string,
	password: string
): Promise<MatrixLoginData> =>
	new Promise((resolve, reject) => {
		const homeserverUrl =
			process.env.REACT_APP_MATRIX_HOMESERVER_URL?.trim();
		if (!homeserverUrl) {
			reject(
				new Error('REACT_APP_MATRIX_HOMESERVER_URL is not configured')
			);
			return;
		}

		// Create Matrix client
		const client = createClient({
			baseUrl: homeserverUrl
		});

		// Login with username and password
		client
			.login('m.login.password', {
				user: username,
				password: password
			})
			.then((response) => {
				// console.log("Matrix login successful:", response);
				resolve({
					accessToken: response.access_token,
					userId: response.user_id,
					deviceId: response.device_id,
					homeserverUrl: homeserverUrl
				});
			})
			.catch((error) => {
				// console.error("Matrix login failed:", error);
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
