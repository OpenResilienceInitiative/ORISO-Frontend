// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	deleteCookieByName,
	getValueFromCookie,
	removeAllCookies,
	setValueInCookie
} from './accessSessionCookie';

const clearCookies = () => {
	document.cookie.split(';').forEach((cookie) => {
		const name = cookie.trim().split('=')[0];
		if (name) {
			document.cookie = `${name}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
		}
	});
};

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
	Object.defineProperty(window, 'localStorage', {
		value: localStorageMock,
		configurable: true
	});
	Object.defineProperty(globalThis, 'localStorage', {
		value: localStorageMock,
		configurable: true
	});
	window.localStorage.clear();
	vi.clearAllMocks();
});

afterEach(() => {
	clearCookies();
	window.localStorage.clear();
});

describe('accessSessionCookie', () => {
	it('keeps normal cookie reads unchanged', () => {
		setValueInCookie('tenantId', 'tenant-1');

		expect(getValueFromCookie('tenantId')).toBe('tenant-1');
		expect(window.localStorage.getItem('tenantId')).toBeNull();
	});

	it('falls back to localStorage for auth tokens when the cookie is missing', () => {
		setValueInCookie('keycloak', 'access-token');
		deleteCookieByName('keycloak');
		window.localStorage.setItem('auth.keycloak', 'access-token');

		expect(getValueFromCookie('keycloak')).toBe('access-token');
	});

	it('removes auth token fallback when deleting the cookie', () => {
		setValueInCookie('refreshToken', 'refresh-token');

		deleteCookieByName('refreshToken');

		expect(window.localStorage.getItem('auth.refreshToken')).toBeNull();
		expect(getValueFromCookie('refreshToken')).toBe('');
	});

	it('removes auth token fallback when clearing all cookies', () => {
		setValueInCookie('keycloak', 'access-token');
		setValueInCookie('refreshToken', 'refresh-token');

		removeAllCookies();

		expect(window.localStorage.getItem('auth.keycloak')).toBeNull();
		expect(window.localStorage.getItem('auth.refreshToken')).toBeNull();
	});
});
