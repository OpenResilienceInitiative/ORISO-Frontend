import {
	MATRIX_DEVICE_ID_STORAGE_KEY,
	MATRIX_USER_ID_STORAGE_KEY
} from '../utils/matrixStorageKeys';
import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from './matrixClientRegistry';
import { buildMatrixCryptoStorePrefix } from './matrixCrypto';

/**
 * All persisted Matrix session state (access token, user id, device ids —
 * including retired legacy keys) shares this storage key prefix. Sweeping by
 * prefix instead of listing keys keeps retired identifiers out of the bundle.
 */
const MATRIX_STORAGE_KEY_PREFIX = 'matrix_';

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
	const userId = localStorage.getItem(MATRIX_USER_ID_STORAGE_KEY);
	const deviceId = userId
		? localStorage.getItem(`${MATRIX_DEVICE_ID_STORAGE_KEY}:${userId}`) ||
			localStorage.getItem(MATRIX_DEVICE_ID_STORAGE_KEY)
		: localStorage.getItem(MATRIX_DEVICE_ID_STORAGE_KEY);

	getMatrixClientService()?.stopAndCleanup();
	setMatrixClientServiceRef(null);

	if (userId) {
		localStorage.removeItem(`mxjssdk_memory_filter_FILTER_SYNC_${userId}`);
	}
	const matrixKeys: string[] = [];
	for (let index = 0; index < localStorage.length; index++) {
		const key = localStorage.key(index);
		if (key?.startsWith(MATRIX_STORAGE_KEY_PREFIX)) {
			matrixKeys.push(key);
		}
	}
	matrixKeys.forEach((key) => localStorage.removeItem(key));

	if (userId && deviceId) {
		const prefix = buildMatrixCryptoStorePrefix(userId, deviceId);
		await deleteDatabase(`${prefix}::matrix-sdk-crypto`);
	}
};
