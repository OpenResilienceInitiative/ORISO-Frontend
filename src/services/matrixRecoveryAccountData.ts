import { Method, type MatrixClient } from 'matrix-js-sdk';
import {
	ServerSideSecretStorageImpl,
	type SecretStorageCallbacks,
	type SecretStorageKeyTuple
} from 'matrix-js-sdk/lib/secret-storage';

/** getAccountDataFromServer uses a sync cache after PREPARED; safety checks require HTTP. */
export const readRecoveryAccountData = async <T>(
	client: MatrixClient,
	type: string
): Promise<T | null> => {
	const userId = client.getUserId();
	if (!userId) throw new Error('Authenticated Matrix identity required');
	try {
		return await client.http.authedRequest<T>(
			Method.Get,
			`/user/${encodeURIComponent(userId)}/account_data/${encodeURIComponent(type)}`
		);
	} catch (error) {
		if ((error as { errcode?: string })?.errcode === 'M_NOT_FOUND')
			return null;
		throw error;
	}
};
export const readRecoveryRoot = async (
	client: MatrixClient
): Promise<SecretStorageKeyTuple | null> => {
	const root = await readRecoveryAccountData<{ key?: unknown }>(
		client,
		'm.secret_storage.default_key'
	);
	if (!root) return null;
	if (typeof root.key !== 'string' || !root.key)
		throw new Error('Invalid secret-storage root');
	const info = await readRecoveryAccountData<SecretStorageKeyTuple[1]>(
		client,
		`m.secret_storage.key.${root.key}`
	);
	if (!info) throw new Error('Secret-storage root metadata unavailable');
	return [root.key, info];
};

/** Native SDK encryption/decryption with fresh HTTP reads instead of the sync cache. */
export const serverBackedSecretStorage = (
	client: MatrixClient,
	callbacks: SecretStorageCallbacks
): ServerSideSecretStorageImpl =>
	new ServerSideSecretStorageImpl(
		new Proxy(client, {
			get(target, property, receiver) {
				if (property === 'getAccountDataFromServer')
					return (type: string) =>
						readRecoveryAccountData(client, type);
				const value = Reflect.get(target, property, receiver);
				return typeof value === 'function' ? value.bind(target) : value;
			}
		}),
		callbacks
	);
