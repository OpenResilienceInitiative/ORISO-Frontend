import type { MatrixClient } from 'matrix-js-sdk';
import type { UIAuthCallback } from 'matrix-js-sdk/lib/interactive-auth';

type MatrixUiAuthError = {
	data?: { session?: string };
};

const deviceSigningAuthByClient = new WeakMap<
	MatrixClient,
	UIAuthCallback<void>
>();

/** Password UIA for the device-signing upload, matching Matrix's two-step flow. */
export const createPasswordUiAuth = (
	userId: string,
	password: string
): UIAuthCallback<void> =>
	async (makeRequest) => {
		try {
			return await makeRequest(null);
		} catch (error) {
			const session = (error as MatrixUiAuthError)?.data?.session;
			if (!session) {
				throw error;
			}
			return makeRequest({
				type: 'm.login.password',
				identifier: { type: 'm.id.user', user: userId },
				password,
				session
			});
		}
	};

/** Keep the transient password closure in memory and scoped to its client. */
export const registerDeviceSigningAuth = (
	client: MatrixClient,
	authenticate: UIAuthCallback<void>
): void => {
	deviceSigningAuthByClient.set(client, authenticate);
};

export const getDeviceSigningAuth = (
	client: MatrixClient
): UIAuthCallback<void> | undefined =>
	deviceSigningAuthByClient.get(client);
