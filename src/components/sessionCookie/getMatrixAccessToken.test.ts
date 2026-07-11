// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createMatrixClient,
	getElementCallAccessToken,
	getMatrixAccessToken,
	persistMatrixLoginData
} from './getMatrixAccessToken';
import { fetchData } from '../../api/fetchData';
import { getMatrixHomeserverUrl } from '../../resources/scripts/runtimeConfig';
import { createClient } from 'matrix-js-sdk';

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
	localStorage.clear();
});

describe('persistMatrixLoginData', () => {
	it('persists refreshed Matrix credentials and expiry metadata', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-26T00:00:00.000Z'));

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
	});
});

describe('getMatrixAccessToken', () => {
	it('loads Matrix credentials from the API and uses the response device id', async () => {
		localStorage.setItem('matrix_device_id', 'ORISO_WEB_EXISTING_DEVICE');
		vi.mocked(fetchData).mockResolvedValue({
			accessToken: 'matrix-token',
			deviceId: 'RESPONSE_DEVICE',
			expiresInMs: 120_000,
			userId: '@user:matrix.example.test'
		});

		await expect(getMatrixAccessToken()).resolves.toEqual({
			accessToken: 'matrix-token',
			deviceId: 'RESPONSE_DEVICE',
			expiresInMs: 120_000,
			homeserverUrl: 'https://matrix.example.test',
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

	it('creates a Matrix client from stored credentials', () => {
		const client = createMatrixClient({
			accessToken: 'matrix-token',
			deviceId: 'ORISO_WEB_TEST_DEVICE',
			homeserverUrl: 'https://matrix.example.test',
			userId: '@consultant:matrix.example.test'
		});

		expect(createClient).toHaveBeenCalledWith({
			baseUrl: 'https://matrix.example.test',
			accessToken: 'matrix-token',
			userId: '@consultant:matrix.example.test',
			deviceId: 'ORISO_WEB_TEST_DEVICE',
			fallbackICEServerAllowed: true
		});
		expect(client).toEqual({
			config: {
				baseUrl: 'https://matrix.example.test',
				accessToken: 'matrix-token',
				userId: '@consultant:matrix.example.test',
				deviceId: 'ORISO_WEB_TEST_DEVICE',
				fallbackICEServerAllowed: true
			}
		});
	});
});

describe('getElementCallAccessToken', () => {
	it('uses a dedicated stable device instead of the ORISO app device', async () => {
		localStorage.setItem('matrix_device_id', 'ORISO_WEB_MAIN_DEVICE');
		Object.defineProperty(globalThis, 'crypto', {
			value: { randomUUID: () => '12345678-90ab-cdef-1234-567890abcdef' },
			configurable: true
		});
		vi.mocked(fetchData).mockResolvedValue({
			accessToken: 'element-call-token',
			deviceId: 'ORISO_CALL_1234567890ABCDEF12345678',
			userId: '@user:matrix.example.test'
		});

		const result = await getElementCallAccessToken();

		expect(result.deviceId).toBe('ORISO_CALL_1234567890ABCDEF12345678');
		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://api.example.test/service/matrix/me/token?deviceId=ORISO_CALL_1234567890ABCDEF12345678'
			})
		);
		expect(localStorage.getItem('matrix_device_id')).toBe(
			'ORISO_WEB_MAIN_DEVICE'
		);
		expect(localStorage.getItem('matrix_call_device_id')).toBe(
			'ORISO_CALL_1234567890ABCDEF12345678'
		);
	});
});
