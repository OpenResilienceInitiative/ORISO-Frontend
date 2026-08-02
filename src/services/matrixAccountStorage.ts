import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from './matrixClientRegistry';
import { buildMatrixCryptoStorePrefix } from './matrixCrypto';

const MATRIX_SESSION_KEYS = [
	'matrix_access_token',
	'matrix_user_id',
	'matrix_token_expires_at',
	'matrix_device_id',
	'matrix_call_device_id'
] as const;

const deleteDatabase = (name: string): Promise<void> =>
	new Promise((resolve) => {
		if (typeof indexedDB === 'undefined') {
			resolve();
			return;
		}

		const request = indexedDB.deleteDatabase(name);
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});

/**
 * Removes browser-bound Matrix identity state after an account was deleted.
 * A normal logout deliberately preserves the crypto store; account deletion
 * must not, because the same Matrix localpart may later be reactivated as a
 * fresh identity with fresh device keys.
 */
export const clearDeletedMatrixAccountStorage = async (): Promise<void> => {
	const userId = localStorage.getItem('matrix_user_id');
	const deviceId = userId
		? localStorage.getItem(`matrix_device_id:${userId}`) ||
			localStorage.getItem('matrix_device_id')
		: localStorage.getItem('matrix_device_id');

	getMatrixClientService()?.stopAndCleanup();
	setMatrixClientServiceRef(null);

	if (userId) {
		localStorage.removeItem(`matrix_device_id:${userId}`);
		localStorage.removeItem(`mxjssdk_memory_filter_FILTER_SYNC_${userId}`);
	}
	MATRIX_SESSION_KEYS.forEach((key) => localStorage.removeItem(key));

	if (userId && deviceId) {
		const prefix = buildMatrixCryptoStorePrefix(userId, deviceId);
		await deleteDatabase(`${prefix}::matrix-sdk-crypto`);
	}
};
