import { getCurrentAuthSubject } from '../components/sessionCookie/getMatrixAccessToken';
import { getAppSessionScope } from '../components/sessionCookie/observeAppSession';
import {
	MATRIX_DEVICE_ID_STORAGE_KEY,
	MATRIX_SESSION_SUBJECT_STORAGE_KEY,
	MATRIX_USER_ID_STORAGE_KEY
} from '../utils/matrixStorageKeys';
import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from './matrixClientRegistry';
import {
	buildMatrixCryptoAccountStorePrefix,
	buildMatrixCryptoStorePrefix
} from './matrixCrypto';
import { clearDeletedAccountRecoveryKey } from './pendingRecoveryKeyStore';

const CLEANUP_TIMEOUT_MS = 5000;
const MATRIX_CRYPTO_STORES = ['matrix-sdk-crypto', 'matrix-sdk-crypto-meta'];
const DEVICE_AND_CRYPTO_STORE =
	/^(?:[0-9a-f]{2})+::matrix-sdk-crypto(?:-meta)?$/;

export type DeletedMatrixAccount = {
	subject: string | null;
	session: ReturnType<typeof getAppSessionScope>;
	userId: string | null;
	deviceIds: string[];
};

const storedMatrixUser = (subject: string): string | null =>
	localStorage.getItem(MATRIX_SESSION_SUBJECT_STORAGE_KEY) === subject
		? localStorage.getItem(MATRIX_USER_ID_STORAGE_KEY)
		: null;

const deviceStorageKey = (userId: string) =>
	`${MATRIX_DEVICE_ID_STORAGE_KEY}:${userId}`;

const currentSessionScope = (): ReturnType<typeof getAppSessionScope> => {
	try {
		return getAppSessionScope();
	} catch {
		return null;
	}
};

const rememberDevice = (deviceIds: string[], deviceId?: string | null) => {
	if (
		deviceId &&
		deviceId === deviceId.trim() &&
		!deviceIds.includes(deviceId)
	) {
		deviceIds.push(deviceId);
	}
};

const rememberStoredDevices = (
	deviceIds: string[],
	userId: string,
	ownsSharedAliases: boolean
) => {
	rememberDevice(deviceIds, localStorage.getItem(deviceStorageKey(userId)));
	if (ownsSharedAliases) {
		rememberDevice(
			deviceIds,
			localStorage.getItem(MATRIX_DEVICE_ID_STORAGE_KEY)
		);
	}
};

export const captureMatrixAccountForDeletion = (): DeletedMatrixAccount => {
	const subject = getCurrentAuthSubject();
	const session = currentSessionScope();
	const service = getMatrixClientService();
	const client =
		subject && service?.getAuthenticatedSubject() === subject
			? service.getClient()
			: null;
	const liveUser = client?.getUserId() ?? null;
	const deviceIds: string[] = [];
	if (liveUser) rememberDevice(deviceIds, client?.getDeviceId());

	let storedUser: string | null = null;
	try {
		storedUser = subject ? storedMatrixUser(subject) : null;
		const user = liveUser ?? storedUser;
		if (user) rememberStoredDevices(deviceIds, user, storedUser === user);
	} catch {
		// The SDK identity is still usable when Web Storage is unavailable.
	}
	const userId = liveUser ?? storedUser;
	return {
		subject,
		session,
		userId:
			userId?.startsWith('@') &&
			userId.includes(':') &&
			userId === userId.trim()
				? userId
				: null,
		deviceIds
	};
};

export const isDeletedAccountSessionCurrent = (
	account: DeletedMatrixAccount
): boolean => {
	const session = currentSessionScope();
	if (
		!account.subject ||
		!session ||
		session.identity !== account.session?.identity
	) {
		return false;
	}
	const subject = getCurrentAuthSubject();
	// A stable Keycloak sid survives access token expiry while DELETE is in flight.
	return (
		subject === account.subject ||
		(subject === null && account.session.stable && session.stable)
	);
};

const deleteDatabase = (name: string): Promise<boolean> =>
	new Promise((resolve, reject) => {
		if (typeof indexedDB === 'undefined') {
			resolve(true);
			return;
		}
		const request = indexedDB.deleteDatabase(name);
		request.onsuccess = () => resolve(true);
		request.onblocked = () => resolve(false);
		request.onerror = () => reject(request.error);
	});

const deleteDiscoveredCryptoStores = async (
	userId: string,
	knownStores: Set<string>
): Promise<boolean> => {
	if (typeof indexedDB === 'undefined') return true;
	if (typeof indexedDB.databases !== 'function') return knownStores.size > 0;

	const prefix = buildMatrixCryptoAccountStorePrefix(userId);
	const databases = await indexedDB.databases();
	const otherStores = databases.flatMap(({ name }) =>
		name &&
		name.startsWith(prefix) &&
		DEVICE_AND_CRYPTO_STORE.test(name.slice(prefix.length)) &&
		!knownStores.has(name)
			? [name]
			: []
	);
	const deleted = await Promise.all(otherStores.map(deleteDatabase));
	return deleted.every(Boolean);
};

export const clearDeletedMatrixAccountStorage = async (
	account: DeletedMatrixAccount
): Promise<boolean> => {
	const { subject, userId, deviceIds } = account;
	if (!subject || !userId) return false;

	const service = getMatrixClientService();
	const ownsService = service?.getAuthenticatedSubject() === subject;
	const client = ownsService ? service.getClient() : null;
	const liveUser = client?.getUserId() ?? null;
	if (liveUser === userId) rememberDevice(deviceIds, client?.getDeviceId());

	let sessionStateCleared = true;
	try {
		const ownsSharedAliases = storedMatrixUser(subject) === userId;
		if (ownsSharedAliases || liveUser === userId) {
			// Retain any new device in the captured context for a later retry.
			rememberStoredDevices(deviceIds, userId, ownsSharedAliases);
		}
		localStorage.removeItem(deviceStorageKey(userId));
		localStorage.removeItem(`mxjssdk_memory_filter_FILTER_SYNC_${userId}`);

		if (ownsSharedAliases && isDeletedAccountSessionCurrent(account)) {
			// Keep the existing sweep for this session's shared Matrix entries,
			// including retired aliases. Account-scoped device entries contain ':'.
			const sharedKeys: string[] = [];
			for (let index = 0; index < localStorage.length; index++) {
				const key = localStorage.key(index);
				if (key?.startsWith('matrix_') && !key.includes(':')) {
					sharedKeys.push(key);
				}
			}
			sharedKeys.forEach((key) => localStorage.removeItem(key));
		}
	} catch {
		sessionStateCleared = false;
	}

	try {
		if (ownsService && (liveUser === null || liveUser === userId)) {
			service.stopAndCleanup();
			if (getMatrixClientService() === service)
				setMatrixClientServiceRef(null);
		}
	} catch {
		sessionStateCleared = false;
	}

	const knownStores = new Set(
		deviceIds.flatMap((deviceId) => {
			const prefix = buildMatrixCryptoStorePrefix(userId, deviceId);
			return MATRIX_CRYPTO_STORES.map((store) => `${prefix}::${store}`);
		})
	);
	const cleanup = [
		clearDeletedAccountRecoveryKey(userId),
		deleteDiscoveredCryptoStores(userId, knownStores),
		...[...knownStores].map(deleteDatabase)
	];
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			Promise.allSettled(cleanup).then(
				(results) =>
					sessionStateCleared &&
					results.every(
						(result) =>
							result.status === 'fulfilled' && result.value
					)
			),
			new Promise<boolean>((resolve) => {
				timeout = setTimeout(() => resolve(false), CLEANUP_TIMEOUT_MS);
			})
		]);
	} finally {
		clearTimeout(timeout);
	}
};
