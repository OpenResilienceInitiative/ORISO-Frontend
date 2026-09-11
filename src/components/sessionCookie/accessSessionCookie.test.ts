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

	// #1071 task 5 / #196: shared PCs must not keep a second, JS-readable copy
	// of the session token around once the cookie already holds it.
	it('stores no token copy in Web Storage while the cookie holds it', () => {
		setValueInCookie('keycloak', 'access-token');
		setValueInCookie('refreshToken', 'refresh-token');

		expect(window.localStorage.getItem('auth.keycloak')).toBeNull();
		expect(window.localStorage.getItem('auth.refreshToken')).toBeNull();
		expect(getValueFromCookie('keycloak')).toBe('access-token');
	});

	it('drops a copy left by an earlier build once the cookie works', () => {
		window.localStorage.setItem('auth.keycloak', 'stale-token');

		setValueInCookie('keycloak', 'access-token');

		expect(window.localStorage.getItem('auth.keycloak')).toBeNull();
	});

	// Browsers silently drop cookies over ~4KB, and a Keycloak token carrying
	// many roles can cross that. Those users would be logged out on the spot
	// without the fallback (cb814cb0).
	it('falls back to Web Storage when the cookie write does not survive', () => {
		const original = Object.getOwnPropertyDescriptor(
			Document.prototype,
			'cookie'
		);
		Object.defineProperty(document, 'cookie', {
			configurable: true,
			get: () => '',
			set: () => {
				/* oversized cookie: the browser drops it */
			}
		});
		try {
			setValueInCookie('keycloak', 'very-long-access-token');
		} finally {
			if (original) {
				Object.defineProperty(document, 'cookie', original);
			}
		}

		expect(window.localStorage.getItem('auth.keycloak')).toBe(
			'very-long-access-token'
		);
	});

	// A single malformed cookie anywhere in the jar makes decodeURIComponent
	// throw for all of them; writing a session cookie must not go down with it.
	it('still writes and reads when another cookie is malformed', () => {
		document.cookie = 'legacy=100%broken';

		expect(() =>
			setValueInCookie('keycloak', 'access-token')
		).not.toThrow();
		expect(getValueFromCookie('keycloak')).toBe('access-token');
	});

	it('never mirrors non-auth cookies', () => {
		setValueInCookie('tenantId', 'tenant-1');

		expect(window.localStorage.getItem('auth.tenantId')).toBeNull();
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

	describe('cookie attributes (FE-H01)', () => {
		const captureCookieWrite = (value: string) => {
			const writes: string[] = [];
			const original = Object.getOwnPropertyDescriptor(
				Document.prototype,
				'cookie'
			);
			Object.defineProperty(document, 'cookie', {
				configurable: true,
				get: () => '',
				set: (written: string) => writes.push(written)
			});
			try {
				setValueInCookie('keycloak', value);
			} finally {
				if (original) {
					Object.defineProperty(document, 'cookie', original);
				}
			}
			return writes[0] ?? '';
		};

		const withProtocol = (protocol: string, run: () => string) => {
			const original = window.location;
			Object.defineProperty(window, 'location', {
				configurable: true,
				value: { ...original, protocol }
			});
			try {
				return run();
			} finally {
				Object.defineProperty(window, 'location', {
					configurable: true,
					value: original
				});
			}
		};

		it('restricts session cookies to same-site requests', () => {
			const written = withProtocol('https:', () =>
				captureCookieWrite('access-token')
			);

			expect(written).toContain('SameSite=Strict');
		});

		it('marks session cookies secure when served over https', () => {
			const written = withProtocol('https:', () =>
				captureCookieWrite('access-token')
			);

			expect(written).toContain('; secure');
		});

		it('omits the secure flag on plain http so local development keeps working', () => {
			const written = withProtocol('http:', () =>
				captureCookieWrite('access-token')
			);

			expect(written).not.toContain('secure');
			expect(written).toContain('SameSite=Strict');
		});
	});
});
