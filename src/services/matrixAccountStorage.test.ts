// @vitest-environment oriso-jsdom

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	captureMatrixAccountForDeletion,
	clearDeletedMatrixAccountStorage,
	isDeletedAccountSessionCurrent
} from './matrixAccountStorage';
import { buildMatrixCryptoStorePrefix } from './matrixCrypto';

const state = vi.hoisted(() => ({
	subject: '',
	hasActiveAccessToken: true,
	stableSession: true,
	session: '',
	service: {
		getAuthenticatedSubject: vi.fn(),
		getClient: vi.fn(),
		stopAndCleanup: vi.fn()
	},
	getService: vi.fn(),
	setService: vi.fn(),
	clearRecoveryKey: vi.fn()
}));

vi.mock('../components/sessionCookie/getMatrixAccessToken', () => ({
	getCurrentAuthSubject: () =>
		state.hasActiveAccessToken ? state.subject : null
}));
vi.mock('../components/sessionCookie/observeAppSession', () => ({
	getAppSessionScope: () => ({
		identity: state.session,
		stable: state.stableSession
	})
}));
vi.mock('./matrixClientRegistry', () => ({
	getMatrixClientService: state.getService,
	setMatrixClientServiceRef: state.setService
}));
vi.mock('./pendingRecoveryKeyStore', () => ({
	clearDeletedAccountRecoveryKey: state.clearRecoveryKey
}));

const USER = '@deleted:matrix.localhost';
const DEVICE = 'ORISO_WEB_DELETED';
const OTHER = '@other:matrix.localhost';
const OTHER_DEVICE = 'ORISO_WEB_OTHER';

const seedSession = (subject: string, userId: string, deviceId: string) => {
	state.subject = subject;
	state.hasActiveAccessToken = true;
	state.stableSession = true;
	state.session = `${subject}-session`;
	localStorage.setItem('matrix_session_subject', subject);
	localStorage.setItem('matrix_user_id', userId);
	localStorage.setItem('matrix_access_token', 'synthetic-session');
	localStorage.setItem('matrix_device_id', deviceId);
	localStorage.setItem(`matrix_device_id:${userId}`, deviceId);
	localStorage.setItem(
		`mxjssdk_memory_filter_FILTER_SYNC_${userId}`,
		'filter'
	);
};

const requestDatabaseDeletion = (
	event: 'onsuccess' | 'onblocked' | 'onerror'
) =>
	vi.fn(() => {
		const request = {} as IDBOpenDBRequest;
		Object.defineProperty(request, event, {
			set: (handler: () => void) => queueMicrotask(handler)
		});
		return request;
	});

describe('clearDeletedMatrixAccountStorage', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		state.getService.mockReturnValue(null);
		state.service.getClient.mockReturnValue(null);
		state.clearRecoveryKey.mockResolvedValue(true);
		seedSession('deleted-subject', USER, DEVICE);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('removes its two crypto stores, remembered recovery and owned aliases', async () => {
		localStorage.setItem('matrix_call_device_id', 'legacy-device');
		localStorage.setItem(`matrix_device_id:${OTHER}`, OTHER_DEVICE);
		localStorage.setItem('unrelated_key', 'keep-me');
		const deleteDatabase = requestDatabaseDeletion('onsuccess');
		vi.stubGlobal('indexedDB', { deleteDatabase });

		await expect(
			clearDeletedMatrixAccountStorage(captureMatrixAccountForDeletion())
		).resolves.toBe(true);

		expect(state.clearRecoveryKey).toHaveBeenCalledExactlyOnceWith(USER);
		expect(localStorage.getItem('matrix_user_id')).toBeNull();
		expect(localStorage.getItem('matrix_access_token')).toBeNull();
		expect(localStorage.getItem('matrix_device_id')).toBeNull();
		expect(localStorage.getItem('matrix_call_device_id')).toBeNull();
		expect(localStorage.getItem(`matrix_device_id:${USER}`)).toBeNull();
		expect(
			localStorage.getItem(`mxjssdk_memory_filter_FILTER_SYNC_${USER}`)
		).toBeNull();
		expect(localStorage.getItem(`matrix_device_id:${OTHER}`)).toBe(
			OTHER_DEVICE
		);
		expect(localStorage.getItem('unrelated_key')).toBe('keep-me');
		const prefix = buildMatrixCryptoStorePrefix(USER, DEVICE);
		expect(deleteDatabase.mock.calls).toEqual([
			[`${prefix}::matrix-sdk-crypto`],
			[`${prefix}::matrix-sdk-crypto-meta`]
		]);
	});

	it('clears the original session when its access token expires before the server replies', async () => {
		const account = captureMatrixAccountForDeletion();
		state.hasActiveAccessToken = false;
		vi.stubGlobal('indexedDB', {
			deleteDatabase: requestDatabaseDeletion('onsuccess')
		});

		expect(isDeletedAccountSessionCurrent(account)).toBe(true);
		await expect(clearDeletedMatrixAccountStorage(account)).resolves.toBe(
			true
		);

		expect(localStorage.getItem('matrix_user_id')).toBeNull();
		expect(localStorage.getItem('matrix_access_token')).toBeNull();
		expect(localStorage.getItem('matrix_session_subject')).toBeNull();
	});

	it('requires a stable session match when the access subject is unavailable', () => {
		state.stableSession = false;
		const unstable = captureMatrixAccountForDeletion();
		state.hasActiveAccessToken = false;
		expect(isDeletedAccountSessionCurrent(unstable)).toBe(false);

		state.hasActiveAccessToken = true;
		state.stableSession = true;
		const stable = captureMatrixAccountForDeletion();
		state.subject = 'different-subject';
		expect(isDeletedAccountSessionCurrent(stable)).toBe(false);

		state.hasActiveAccessToken = false;
		state.session = 'different-session';
		expect(isDeletedAccountSessionCurrent(stable)).toBe(false);
	});

	it('keeps a replacement account and its client when the server reply is late', async () => {
		const account = captureMatrixAccountForDeletion();
		const deleteDatabase = requestDatabaseDeletion('onsuccess');
		vi.stubGlobal('indexedDB', { deleteDatabase });
		seedSession('replacement-subject', OTHER, OTHER_DEVICE);
		state.service.getAuthenticatedSubject.mockReturnValue(state.subject);
		state.service.getClient.mockReturnValue({
			getUserId: () => OTHER,
			getDeviceId: () => OTHER_DEVICE
		});
		state.getService.mockReturnValue(state.service);

		await expect(clearDeletedMatrixAccountStorage(account)).resolves.toBe(
			true
		);

		expect(state.clearRecoveryKey).toHaveBeenCalledExactlyOnceWith(USER);
		expect(isDeletedAccountSessionCurrent(account)).toBe(false);
		expect(localStorage.getItem('matrix_user_id')).toBe(OTHER);
		expect(localStorage.getItem('matrix_access_token')).toBe(
			'synthetic-session'
		);
		expect(localStorage.getItem('matrix_device_id')).toBe(OTHER_DEVICE);
		expect(localStorage.getItem(`matrix_device_id:${USER}`)).toBeNull();
		expect(localStorage.getItem(`matrix_device_id:${OTHER}`)).toBe(
			OTHER_DEVICE
		);
		expect(state.service.stopAndCleanup).not.toHaveBeenCalled();
		expect(state.setService).not.toHaveBeenCalled();
		const prefix = buildMatrixCryptoStorePrefix(USER, DEVICE);
		expect(deleteDatabase.mock.calls).toEqual([
			[`${prefix}::matrix-sdk-crypto`],
			[`${prefix}::matrix-sdk-crypto-meta`]
		]);
	});

	it('stops a live client belonging to the deleted identity and captures its current device', async () => {
		const liveDevice = 'ORISO_WEB_LIVE_DEVICE';
		state.service.getAuthenticatedSubject.mockReturnValue(state.subject);
		state.service.getClient.mockReturnValue({
			getUserId: () => USER,
			getDeviceId: () => liveDevice
		});
		state.getService.mockReturnValue(state.service);
		const deleteDatabase = requestDatabaseDeletion('onsuccess');
		vi.stubGlobal('indexedDB', { deleteDatabase });

		await expect(
			clearDeletedMatrixAccountStorage(captureMatrixAccountForDeletion())
		).resolves.toBe(true);

		expect(state.service.stopAndCleanup).toHaveBeenCalledOnce();
		expect(state.setService).toHaveBeenCalledWith(null);
		expect(deleteDatabase).toHaveBeenCalledTimes(4);
		expect(deleteDatabase).toHaveBeenCalledWith(
			`${buildMatrixCryptoStorePrefix(USER, liveDevice)}::matrix-sdk-crypto-meta`
		);
	});

	it.each(['onblocked', 'onerror'] as const)(
		'reports incomplete cleanup for %s and allows retry on the captured identity',
		async (event) => {
			const account = captureMatrixAccountForDeletion();
			vi.stubGlobal('indexedDB', {
				deleteDatabase: requestDatabaseDeletion(event)
			});
			await expect(
				clearDeletedMatrixAccountStorage(account)
			).resolves.toBe(false);

			vi.stubGlobal('indexedDB', {
				deleteDatabase: requestDatabaseDeletion('onsuccess')
			});
			await expect(
				clearDeletedMatrixAccountStorage(account)
			).resolves.toBe(true);
		}
	);

	it('remembers positively identified devices rotated during deletion even when retrying', async () => {
		const account = captureMatrixAccountForDeletion();
		const storedDevice = 'ORISO_WEB_ROTATED_STORED';
		const liveDevice = 'ORISO_WEB_ROTATED_LIVE';
		localStorage.setItem('matrix_device_id', storedDevice);
		localStorage.setItem(`matrix_device_id:${USER}`, storedDevice);
		state.service.getAuthenticatedSubject.mockReturnValue(state.subject);
		state.service.getClient.mockReturnValue({
			getUserId: () => USER,
			getDeviceId: () => liveDevice
		});
		state.getService.mockReturnValue(state.service);
		vi.stubGlobal('indexedDB', {
			deleteDatabase: requestDatabaseDeletion('onblocked')
		});

		await expect(clearDeletedMatrixAccountStorage(account)).resolves.toBe(
			false
		);

		state.getService.mockReturnValue(null);
		const deleteDatabase = requestDatabaseDeletion('onsuccess');
		vi.stubGlobal('indexedDB', { deleteDatabase });
		await expect(clearDeletedMatrixAccountStorage(account)).resolves.toBe(
			true
		);

		const expectedStores = [DEVICE, storedDevice, liveDevice].flatMap(
			(device) => {
				const prefix = buildMatrixCryptoStorePrefix(USER, device);
				return [
					`${prefix}::matrix-sdk-crypto`,
					`${prefix}::matrix-sdk-crypto-meta`
				];
			}
		);
		expect(deleteDatabase.mock.calls.flat().sort()).toEqual(
			expectedStores.sort()
		);
	});

	it('finds older crypto stores for exactly the captured Matrix user', async () => {
		const oldPrefix = buildMatrixCryptoStorePrefix(USER, 'OLD_DEVICE');
		const otherPrefix = buildMatrixCryptoStorePrefix(OTHER, 'OLD_DEVICE');
		const oldCrypto = `${oldPrefix}::matrix-sdk-crypto`;
		const oldMeta = `${oldPrefix}::matrix-sdk-crypto-meta`;
		const knownPrefix = buildMatrixCryptoStorePrefix(USER, DEVICE);
		const knownCrypto = `${knownPrefix}::matrix-sdk-crypto`;
		const deleteDatabase = requestDatabaseDeletion('onsuccess');
		vi.stubGlobal('indexedDB', {
			deleteDatabase,
			databases: vi
				.fn()
				.mockResolvedValue([
					{ name: oldCrypto },
					{ name: oldMeta },
					{ name: knownCrypto },
					{ name: `${oldPrefix}::matrix-sdk-crypto-unrelated` },
					{ name: `${otherPrefix}::matrix-sdk-crypto` },
					{}
				])
		});

		await expect(
			clearDeletedMatrixAccountStorage(captureMatrixAccountForDeletion())
		).resolves.toBe(true);

		expect(deleteDatabase.mock.calls.flat().sort()).toEqual(
			[
				knownCrypto,
				`${knownPrefix}::matrix-sdk-crypto-meta`,
				oldCrypto,
				oldMeta
			].sort()
		);
	});

	it('deletes the known stores but reports failure when enumeration fails', async () => {
		const deleteDatabase = requestDatabaseDeletion('onsuccess');
		vi.stubGlobal('indexedDB', {
			deleteDatabase,
			databases: vi.fn().mockRejectedValue(new Error('unavailable'))
		});

		await expect(
			clearDeletedMatrixAccountStorage(captureMatrixAccountForDeletion())
		).resolves.toBe(false);

		expect(deleteDatabase).toHaveBeenCalledTimes(2);
	});

	it('reports an unsuccessful recovery-key transaction', async () => {
		vi.stubGlobal('indexedDB', {
			deleteDatabase: requestDatabaseDeletion('onsuccess')
		});
		state.clearRecoveryKey.mockRejectedValue(
			new Error('database unavailable')
		);
		await expect(
			clearDeletedMatrixAccountStorage(captureMatrixAccountForDeletion())
		).resolves.toBe(false);
	});

	it('does not treat mismatched cached device data as proof of ownership', async () => {
		state.subject = 'other-subject';
		const deleteDatabase = requestDatabaseDeletion('onsuccess');
		vi.stubGlobal('indexedDB', { deleteDatabase });
		await expect(
			clearDeletedMatrixAccountStorage(captureMatrixAccountForDeletion())
		).resolves.toBe(false);

		expect(localStorage.getItem('matrix_user_id')).toBe(USER);
		expect(state.clearRecoveryKey).not.toHaveBeenCalled();
		expect(deleteDatabase).not.toHaveBeenCalled();
	});
});
