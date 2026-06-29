// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { persistMatrixLoginData } from './getMatrixAccessToken';

vi.mock('../../resources/scripts/endpoints', () => ({
	endpoints: {
		matrixAccessToken: 'https://api.example.test/service/matrix/me/token'
	}
}));

vi.mock('../../resources/scripts/runtimeConfig', () => ({
	getMatrixHomeserverUrl: () => 'https://matrix.example.test'
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
