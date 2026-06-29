// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasActiveAuthSession, isPublicAuthRoute, setTokens } from './auth';
import { setValueInCookie } from '../sessionCookie/accessSessionCookie';
import {
	getTokenExpiryFromLocalStorage,
	setTokenExpiryInLocalStorage
} from '../sessionCookie/accessSessionLocalStorage';

vi.mock('../sessionCookie/accessSessionCookie', () => ({
	setValueInCookie: vi.fn()
}));

vi.mock('../sessionCookie/accessSessionLocalStorage', () => ({
	getTokenExpiryFromLocalStorage: vi.fn(),
	setTokenExpiryInLocalStorage: vi.fn()
}));

vi.mock('../logout/logout', () => ({
	logout: vi.fn()
}));

vi.mock('../sessionCookie/refreshKeycloakAccessToken', () => ({
	refreshKeycloakAccessToken: vi.fn()
}));

vi.mock('../../utils/appConfig', () => ({
	appConfig: {
		urls: {
			toLogin: '/login'
		}
	}
}));

describe('auth helpers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.history.replaceState({}, '', '/login');
	});

	it.each([
		['/login', true],
		['/registration', true],
		['/tenant-a/registration', true],
		['/error.401.html', true],
		['/sessions/consultant/sessionView', false]
	])('detects public auth route %s', (path, expected) => {
		window.history.replaceState({}, '', path);

		expect(isPublicAuthRoute()).toBe(expected);
	});

	it('stores keycloak and refresh tokens with expiry metadata', () => {
		setTokens('access-token', 300, 'refresh-token', 600);

		expect(setValueInCookie).toHaveBeenCalledWith(
			'keycloak',
			'access-token'
		);
		expect(setValueInCookie).toHaveBeenCalledWith(
			'refreshToken',
			'refresh-token'
		);
		expect(setTokenExpiryInLocalStorage).toHaveBeenCalledWith(
			'auth.access_token_valid_until',
			300
		);
		expect(setTokenExpiryInLocalStorage).toHaveBeenCalledWith(
			'auth.refresh_token_valid_until',
			600
		);
	});

	it('reports active auth when either access or refresh token is still valid', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		vi.mocked(getTokenExpiryFromLocalStorage).mockReturnValue({
			accessTokenValidUntilTime: Date.now() - 1,
			refreshTokenValidUntilTime: Date.now() + 1_000
		});

		expect(hasActiveAuthSession()).toBe(true);

		vi.mocked(getTokenExpiryFromLocalStorage).mockReturnValue({
			accessTokenValidUntilTime: Date.now() - 1,
			refreshTokenValidUntilTime: Date.now() - 1
		});

		expect(hasActiveAuthSession()).toBe(false);
		vi.useRealTimers();
	});
});
