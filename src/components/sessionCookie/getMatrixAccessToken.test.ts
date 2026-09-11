// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearPersistedMatrixDeviceId,
	createMatrixClient,
	getMatrixAccessToken,
	persistMatrixLoginData
} from './getMatrixAccessToken';
import { fetchData } from '../../api/fetchData';
import { getMatrixHomeserverUrl } from '../../resources/scripts/runtimeConfig';
import { createClient } from 'matrix-js-sdk';
import { getMatrixClientLogger } from '../../utils/matrixLogging';
import { secretStorageKeyCallback } from '../../services/matrixKeyBackupService';
import { getDeviceSigningAuth } from '../../services/matrixInteractiveAuth';

vi.mock('../../resources/scripts/endpoints', () => ({
	endpoints: {
		matrixAccessToken: 'https://api.example.test/service/matrix/me/token'
	}
}));

vi.mock('matrix-js-sdk', () => ({
	createClient: vi.fn((config) => ({ config }))
}));

vi.mock('../../resources/scripts/runtimeConfig', () => ({
	getMatrixHomeserverUrl: vi.fn(() => 'https://matrix.example.test')
}));

vi.mock('../../api/fetchData', () => ({
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL' },
	FETCH_METHODS: { GET: 'GET' },
	fetchData: vi.fn()
}));

const storage = new Map<string, string>();
const localStorageMock = {
	clear: vi.fn(() => storage.clear()),
	getItem: vi.fn((key: string) => storage.get(key) ?? null),
	removeItem: vi.fn((key: string) => storage.delete(key)),
	setItem: vi.fn((key: string, value: string) =>
		storage.set(key, String(value))
	)
};

const setAuthenticatedSubject = (
	subject: string,
	expiresAtMs: number = Date.now() + 60 * 60 * 1000
) => {
	const payload = btoa(
		JSON.stringify({
			exp: Math.floor(expiresAtMs / 1000),
			sub: subject
		})
	)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
	localStorage.setItem('auth.keycloak', `e30.${payload}.signature`);
};

beforeEach(() => {
	storage.clear();
	Object.defineProperty(window, 'localStorage', {
		value: localStorageMock,
		configurable: true
	});
	Object.defineProperty(globalThis, 'localStorage', {
		value: localStorageMock,
		configurable: true
	});
	vi.clearAllMocks();
	vi.mocked(getMatrixHomeserverUrl).mockReturnValue(
		'https://matrix.example.test'
	);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	localStorage.clear();
});

describe('persistMatrixLoginData', () => {
	it('persists refreshed Matrix credentials and expiry metadata', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-26T00:00:00.000Z'));
		setAuthenticatedSubject('keycloak-user');

		persistMatrixLoginData({
			accessToken: 'matrix-token',
			deviceId: 'ORISO_WEB_TEST_DEVICE',
			expiresInMs: 3_300_000,
			homeserverUrl: 'https://matrix.example.test',
			userId: '@consultant:matrix.example.test'
		});

		expect(localStorage.getItem('matrix_access_token')).toBe(
			'matrix-token'
		);
		expect(localStorage.getItem('matrix_user_id')).toBe(
			'@consultant:matrix.example.test'
		);
		expect(localStorage.getItem('matrix_device_id')).toBe(
			'ORISO_WEB_TEST_DEVICE'
		);
		expect(
			localStorage.getItem(
				'matrix_device_id:@consultant:matrix.example.test'
			)
		).toBe('ORISO_WEB_TEST_DEVICE');
		expect(localStorage.getItem('matrix_token_expires_at')).toBe(
			(Date.parse('2026-06-26T00:00:00.000Z') + 3_300_000).toString()
		);
		expect(localStorage.getItem('matrix_session_subject')).toBe(
			'keycloak-user'
		);
	});
});

describe('clearPersistedMatrixDeviceId', () => {
	it('removes both request and user-scoped ids before stale-device recovery', () => {
		localStorage.setItem('matrix_device_id', 'STALE_DEVICE');
		localStorage.setItem(
			'matrix_device_id:@consultant:matrix.example.test',
			'STALE_DEVICE'
		);

		clearPersistedMatrixDeviceId('@consultant:matrix.example.test');

		expect(localStorage.getItem('matrix_device_id')).toBeNull();
		expect(
			localStorage.getItem(
				'matrix_device_id:@consultant:matrix.example.test'
			)
		).toBeNull();
	});
});

describe('getMatrixAccessToken', () => {
	it('skips the API call when local live websocket bootstrap is disabled', async () => {
		vi.stubEnv('REACT_APP_DISABLE_LIVE_WEBSOCKET', '1');

		await expect(getMatrixAccessToken()).rejects.toThrow('MATRIX_DISABLED');

		expect(fetchData).not.toHaveBeenCalled();
	});

	it('reuses unexpired device credentials without another backend bootstrap', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-26T12:00:00.000Z'));
		setAuthenticatedSubject('keycloak-user');
		localStorage.setItem('matrix_access_token', 'persisted-token');
		localStorage.setItem(
			'matrix_user_id',
			'@persisted-user:matrix.example.test'
		);
		localStorage.setItem('matrix_device_id', 'ORISO_WEB_EXISTING_DEVICE');
		localStorage.setItem('matrix_session_subject', 'keycloak-user');
		localStorage.setItem(
			'matrix_token_expires_at',
			(Date.now() + 20 * 60 * 1000).toString()
		);

		await expect(getMatrixAccessToken()).resolves.toEqual({
			accessToken: 'persisted-token',
			deviceId: 'ORISO_WEB_EXISTING_DEVICE',
			expiresInMs: 20 * 60 * 1000,
			homeserverUrl: 'https://matrix.example.test',
			userId: '@persisted-user:matrix.example.test'
		});

		expect(fetchData).not.toHaveBeenCalled();
	});

	it('does not reuse credentials from another authenticated subject', async () => {
		setAuthenticatedSubject('current-keycloak-user');
		localStorage.setItem('matrix_access_token', 'other-user-token');
		localStorage.setItem(
			'matrix_user_id',
			'@other-user:matrix.example.test'
		);
		localStorage.setItem('matrix_device_id', 'ORISO_WEB_EXISTING_DEVICE');
		localStorage.setItem('matrix_session_subject', 'other-keycloak-user');
		localStorage.setItem(
			'matrix_token_expires_at',
			(Date.now() + 20 * 60 * 1000).toString()
		);
		vi.mocked(fetchData).mockResolvedValue({
			accessToken: 'current-user-token',
			deviceId: 'ORISO_WEB_EXISTING_DEVICE',
			expiresInMs: 3_300_000,
			userId: '@current-user:matrix.example.test'
		});

		await expect(getMatrixAccessToken()).resolves.toEqual(
			expect.objectContaining({
				accessToken: 'current-user-token',
				userId: '@current-user:matrix.example.test'
			})
		);

		expect(fetchData).toHaveBeenCalledOnce();
	});

	it('does not reuse credentials after the platform session expired', async () => {
		setAuthenticatedSubject('keycloak-user', Date.now() - 1000);
		localStorage.setItem('matrix_access_token', 'persisted-token');
		localStorage.setItem(
			'matrix_user_id',
			'@persisted-user:matrix.example.test'
		);
		localStorage.setItem('matrix_device_id', 'ORISO_WEB_EXISTING_DEVICE');
		localStorage.setItem('matrix_session_subject', 'keycloak-user');
		localStorage.setItem(
			'matrix_token_expires_at',
			(Date.now() + 20 * 60 * 1000).toString()
		);
		vi.mocked(fetchData).mockResolvedValue({
			accessToken: 'replacement-token',
			deviceId: 'ORISO_WEB_EXISTING_DEVICE',
			expiresInMs: 3_300_000,
			userId: '@persisted-user:matrix.example.test'
		});

		await expect(getMatrixAccessToken()).resolves.toEqual(
			expect.objectContaining({ accessToken: 'replacement-token' })
		);

		expect(fetchData).toHaveBeenCalledOnce();
	});

	it('does not reuse credentials for a malformed platform token', async () => {
		localStorage.setItem('auth.keycloak', 'not-a-jwt');
		localStorage.setItem('matrix_access_token', 'persisted-token');
		localStorage.setItem(
			'matrix_user_id',
			'@persisted-user:matrix.example.test'
		);
		localStorage.setItem('matrix_device_id', 'ORISO_WEB_EXISTING_DEVICE');
		localStorage.setItem('matrix_session_subject', 'keycloak-user');
		localStorage.setItem(
			'matrix_token_expires_at',
			(Date.now() + 20 * 60 * 1000).toString()
		);
		vi.mocked(fetchData).mockResolvedValue({
			accessToken: 'replacement-token',
			deviceId: 'ORISO_WEB_EXISTING_DEVICE',
			expiresInMs: 3_300_000,
			userId: '@persisted-user:matrix.example.test'
		});

		await expect(getMatrixAccessToken()).resolves.toEqual(
			expect.objectContaining({ accessToken: 'replacement-token' })
		);

		expect(fetchData).toHaveBeenCalledOnce();
	});

	it('does not reuse credentials inside the refresh safety window', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-26T12:00:00.000Z'));
		setAuthenticatedSubject('keycloak-user');
		localStorage.setItem('matrix_access_token', 'nearly-expired-token');
		localStorage.setItem(
			'matrix_user_id',
			'@persisted-user:matrix.example.test'
		);
		localStorage.setItem('matrix_device_id', 'ORISO_WEB_EXISTING_DEVICE');
		localStorage.setItem('matrix_session_subject', 'keycloak-user');
		localStorage.setItem(
			'matrix_token_expires_at',
			(Date.now() + 2 * 60 * 1000).toString()
		);
		vi.mocked(fetchData).mockResolvedValue({
			accessToken: 'replacement-token',
			deviceId: 'ORISO_WEB_EXISTING_DEVICE',
			expiresInMs: 3_300_000,
			userId: '@persisted-user:matrix.example.test'
		});

		await expect(getMatrixAccessToken()).resolves.toEqual({
			accessToken: 'replacement-token',
			deviceId: 'ORISO_WEB_EXISTING_DEVICE',
			expiresInMs: 3_300_000,
			homeserverUrl: 'https://matrix.example.test',
			userId: '@persisted-user:matrix.example.test'
		});

		expect(fetchData).toHaveBeenCalledOnce();
	});

	it('forces a backend bootstrap after Matrix invalidates a cached token', async () => {
		setAuthenticatedSubject('keycloak-user');
		localStorage.setItem('matrix_access_token', 'invalidated-token');
		localStorage.setItem(
			'matrix_user_id',
			'@persisted-user:matrix.example.test'
		);
		localStorage.setItem('matrix_device_id', 'ORISO_WEB_EXISTING_DEVICE');
		localStorage.setItem('matrix_session_subject', 'keycloak-user');
		localStorage.setItem(
			'matrix_token_expires_at',
			(Date.now() + 20 * 60 * 1000).toString()
		);
		vi.mocked(fetchData).mockResolvedValue({
			accessToken: 'replacement-token',
			deviceId: 'ORISO_WEB_EXISTING_DEVICE',
			expiresInMs: 3_300_000,
			userId: '@persisted-user:matrix.example.test'
		});

		await expect(
			getMatrixAccessToken({
				forceRefresh: true
			})
		).resolves.toEqual({
			accessToken: 'replacement-token',
			deviceId: 'ORISO_WEB_EXISTING_DEVICE',
			expiresInMs: 3_300_000,
			homeserverUrl: 'https://matrix.example.test',
			userId: '@persisted-user:matrix.example.test'
		});

		expect(fetchData).toHaveBeenCalledOnce();
	});

	it('shares one backend bootstrap between 50 concurrent callers', async () => {
		setAuthenticatedSubject('keycloak-user');
		let resolveBootstrap:
			| ((value: Record<string, unknown>) => void)
			| undefined;
		vi.mocked(fetchData).mockReturnValue(
			new Promise((resolve) => {
				resolveBootstrap = resolve;
			}) as ReturnType<typeof fetchData>
		);

		const concurrentBootstraps = Array.from({ length: 50 }, () =>
			getMatrixAccessToken()
		);

		expect(fetchData).toHaveBeenCalledOnce();

		resolveBootstrap?.({
			accessToken: 'shared-token',
			deviceId: 'ORISO_WEB_SHARED_DEVICE',
			expiresInMs: 3_300_000,
			userId: '@shared-user:matrix.example.test'
		});

		const results = await Promise.all(concurrentBootstraps);
		expect(results).toHaveLength(50);
		expect(
			results.every(
				(result) =>
					result.accessToken === 'shared-token' &&
					result.deviceId === 'ORISO_WEB_SHARED_DEVICE'
			)
		).toBe(true);
	});

	it('does not share an in-flight bootstrap across authenticated subjects', async () => {
		setAuthenticatedSubject('first-keycloak-user');
		let resolveFirstBootstrap:
			| ((value: Record<string, unknown>) => void)
			| undefined;
		vi.mocked(fetchData)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveFirstBootstrap = resolve;
				}) as ReturnType<typeof fetchData>
			)
			.mockResolvedValueOnce({
				accessToken: 'second-user-token',
				deviceId: 'ORISO_WEB_SECOND_DEVICE',
				expiresInMs: 3_300_000,
				userId: '@second-user:matrix.example.test'
			});

		const firstBootstrap = getMatrixAccessToken();
		setAuthenticatedSubject('second-keycloak-user');
		const secondBootstrap = getMatrixAccessToken();

		expect(fetchData).toHaveBeenCalledTimes(2);
		await expect(secondBootstrap).resolves.toEqual(
			expect.objectContaining({
				accessToken: 'second-user-token',
				userId: '@second-user:matrix.example.test'
			})
		);

		resolveFirstBootstrap?.({
			accessToken: 'first-user-token',
			deviceId: 'ORISO_WEB_FIRST_DEVICE',
			expiresInMs: 3_300_000,
			userId: '@first-user:matrix.example.test'
		});
		await expect(firstBootstrap).resolves.toEqual(
			expect.objectContaining({
				accessToken: 'first-user-token',
				userId: '@first-user:matrix.example.test'
			})
		);
	});

	it('joins an in-flight forced refresh instead of reusing its invalidated token', async () => {
		setAuthenticatedSubject('keycloak-user');
		localStorage.setItem('matrix_access_token', 'invalidated-token');
		localStorage.setItem(
			'matrix_user_id',
			'@persisted-user:matrix.example.test'
		);
		localStorage.setItem('matrix_device_id', 'ORISO_WEB_EXISTING_DEVICE');
		localStorage.setItem('matrix_session_subject', 'keycloak-user');
		localStorage.setItem(
			'matrix_token_expires_at',
			(Date.now() + 20 * 60 * 1000).toString()
		);
		let resolveBootstrap:
			| ((value: Record<string, unknown>) => void)
			| undefined;
		vi.mocked(fetchData).mockReturnValue(
			new Promise((resolve) => {
				resolveBootstrap = resolve;
			}) as ReturnType<typeof fetchData>
		);

		const forcedRefresh = getMatrixAccessToken({
			forceRefresh: true
		});
		const concurrentBootstrap = getMatrixAccessToken();

		expect(fetchData).toHaveBeenCalledOnce();

		resolveBootstrap?.({
			accessToken: 'replacement-token',
			deviceId: 'ORISO_WEB_EXISTING_DEVICE',
			expiresInMs: 3_300_000,
			userId: '@persisted-user:matrix.example.test'
		});

		await expect(
			Promise.all([forcedRefresh, concurrentBootstrap])
		).resolves.toEqual([
			expect.objectContaining({ accessToken: 'replacement-token' }),
			expect.objectContaining({ accessToken: 'replacement-token' })
		]);
	});

	it('loads Matrix credentials from the API and uses the response device id', async () => {
		localStorage.setItem('matrix_device_id', 'ORISO_WEB_EXISTING_DEVICE');
		vi.mocked(fetchData).mockResolvedValue({
			accessToken: 'matrix-token',
			deviceId: 'RESPONSE_DEVICE',
			expiresInMs: 120_000,
			uiaPassword: 'ephemeral-uia-password',
			userId: '@user:matrix.example.test'
		});

		await expect(getMatrixAccessToken()).resolves.toEqual({
			accessToken: 'matrix-token',
			deviceId: 'RESPONSE_DEVICE',
			expiresInMs: 120_000,
			homeserverUrl: 'https://matrix.example.test',
			uiaPassword: 'ephemeral-uia-password',
			userId: '@user:matrix.example.test'
		});

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.example.test/service/matrix/me/token?deviceId=ORISO_WEB_EXISTING_DEVICE',
			method: 'GET',
			responseHandling: ['CATCH_ALL'],
			recoverOnPublicAuthRoute: false
		});
	});

	it('creates and sends a stable browser device id before requesting a token', async () => {
		Object.defineProperty(globalThis, 'crypto', {
			value: { randomUUID: () => '12345678-90ab-cdef-1234-567890abcdef' },
			configurable: true
		});
		vi.mocked(fetchData).mockResolvedValue({
			accessToken: 'matrix-token',
			deviceId: 'ORISO_WEB_1234567890ABCDEF12345678',
			userId: '@new-user:matrix.example.test'
		});

		await getMatrixAccessToken();

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://api.example.test/service/matrix/me/token?deviceId=ORISO_WEB_1234567890ABCDEF12345678'
			})
		);
	});

	it('rejects a token response without a device-bound identity', async () => {
		localStorage.setItem(
			'matrix_device_id:@user:matrix.example.test',
			'STORED_DEVICE'
		);
		vi.mocked(fetchData).mockResolvedValue({
			accessToken: 'matrix-token',
			userId: '@user:matrix.example.test'
		});

		await expect(getMatrixAccessToken()).rejects.toThrow(
			'Matrix login did not return a device-bound access token'
		);
	});

	it('creates a browser device id when neither API nor storage has one', async () => {
		Object.defineProperty(globalThis, 'crypto', {
			value: { randomUUID: () => '12345678-90ab-cdef-1234-567890abcdef' },
			configurable: true
		});
		vi.mocked(fetchData).mockResolvedValue({
			accessToken: 'matrix-token',
			deviceId: 'ORISO_WEB_1234567890ABCDEF12345678',
			userId: '@new-user:matrix.example.test'
		});

		const result = await getMatrixAccessToken();

		expect(result.deviceId).toBe('ORISO_WEB_1234567890ABCDEF12345678');
		expect(
			localStorage.getItem(
				'matrix_device_id:@new-user:matrix.example.test'
			)
		).toBe('ORISO_WEB_1234567890ABCDEF12345678');
	});

	it('throws when Matrix homeserver URL is missing', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			accessToken: 'matrix-token',
			deviceId: 'ORISO_WEB_TEST_DEVICE',
			userId: '@user:matrix.example.test'
		});
		vi.mocked(getMatrixHomeserverUrl).mockReturnValue('');

		await expect(getMatrixAccessToken()).rejects.toThrow(
			'REACT_APP_MATRIX_HOMESERVER_URL is not configured'
		);
	});

	it('does not write expiry metadata when expiresInMs is absent', () => {
		persistMatrixLoginData({
			accessToken: 'matrix-token',
			deviceId: 'ORISO_WEB_TEST_DEVICE',
			homeserverUrl: 'https://matrix.example.test',
			userId: '@consultant:matrix.example.test'
		});

		expect(localStorage.getItem('matrix_token_expires_at')).toBeNull();
	});

	it('never persists the transient UIA password', () => {
		persistMatrixLoginData({
			accessToken: 'matrix-token',
			deviceId: 'ORISO_WEB_TEST_DEVICE',
			homeserverUrl: 'https://matrix.example.test',
			uiaPassword: 'must-stay-in-memory',
			userId: '@consultant:matrix.example.test'
		});

		expect([...storage.values()]).not.toContain('must-stay-in-memory');
	});

	it('creates a Matrix client from stored credentials', () => {
		const client = createMatrixClient({
			accessToken: 'matrix-token',
			deviceId: 'ORISO_WEB_TEST_DEVICE',
			homeserverUrl: 'https://matrix.example.test',
			uiaPassword: 'ephemeral-uia-password',
			userId: '@consultant:matrix.example.test'
		});

		expect(createClient).toHaveBeenCalledWith({
			baseUrl: 'https://matrix.example.test',
			accessToken: 'matrix-token',
			userId: '@consultant:matrix.example.test',
			deviceId: 'ORISO_WEB_TEST_DEVICE',
			fallbackICEServerAllowed: true,
			logger: getMatrixClientLogger(),
			cryptoCallbacks: {
				getSecretStorageKey: secretStorageKeyCallback
			}
		});
		expect(client).toEqual({
			config: {
				baseUrl: 'https://matrix.example.test',
				accessToken: 'matrix-token',
				userId: '@consultant:matrix.example.test',
				deviceId: 'ORISO_WEB_TEST_DEVICE',
				fallbackICEServerAllowed: true,
				logger: getMatrixClientLogger(),
				cryptoCallbacks: {
					getSecretStorageKey: secretStorageKeyCallback
				}
			}
		});
		expect(getDeviceSigningAuth(client)).toBeTypeOf('function');
	});
});
