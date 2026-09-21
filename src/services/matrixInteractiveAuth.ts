import type { MatrixClient } from 'matrix-js-sdk';
import type { UIAuthCallback } from 'matrix-js-sdk/lib/interactive-auth';

type MatrixUiAuthError = {
	data?: { session?: string };
};

const deviceSigningAuthByClient = new WeakMap<
	MatrixClient,
	UIAuthCallback<void>
>();

/** Resolves the account's current Matrix password; each call may rotate it server-side. */
export type UiaPasswordSource = () => Promise<string>;

/** Password UIA for the device-signing upload, matching Matrix's two-step flow. */
export const createPasswordUiAuth =
	(
		userId: string,
		password: string | UiaPasswordSource
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
				// Resolved only now: a password captured earlier is stale once any other sign-in rotated it.
				password:
					typeof password === 'string' ? password : await password(),
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
): UIAuthCallback<void> | undefined => deviceSigningAuthByClient.get(client);

const deviceSigningPasswordByClient = new WeakMap<
	MatrixClient,
	{ userId: string; currentPassword: UiaPasswordSource }
>();

/** Device-signing UIA that asks for the account's current password when the server wants it. */
export const registerDeviceSigningPassword = (
	client: MatrixClient,
	userId: string,
	currentPassword: UiaPasswordSource
): void => {
	deviceSigningPasswordByClient.set(client, { userId, currentPassword });
	registerDeviceSigningAuth(
		client,
		createPasswordUiAuth(userId, currentPassword)
	);
};

/**
 * Device-signing UIA with the password already in hand, for flows that destroy state before they
 * authenticate: if no current password can be had, they must fail before touching anything.
 */
export const prepareDeviceSigningAuth = async (
	client: MatrixClient
): Promise<UIAuthCallback<void> | undefined> => {
	const source = deviceSigningPasswordByClient.get(client);
	if (!source) return getDeviceSigningAuth(client);
	return createPasswordUiAuth(source.userId, await source.currentPassword());
};
