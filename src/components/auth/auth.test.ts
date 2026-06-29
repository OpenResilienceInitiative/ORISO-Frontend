// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	handleTokenRefresh,
	hasActiveAuthSession,
	isPublicAuthRoute,
	setTokens
} from './auth';
import { setValueInCookie } from '../sessionCookie/accessSessionCookie';
import {
	getTokenExpiryFromLocalStorage,
	setTokenExpiryInLocalStorage
} from '../sessionCookie/accessSessionLocalStorage';
import { logout } from '../logout/logout';
import { refreshKeycloakAccessToken } from '../sessionCookie/refreshKeycloakAccessToken';

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

	afterEach(() => {
		vi.useRealTimers();
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
	});

	it('logs out and rejects when access and refresh tokens are expired', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		vi.mocked(getTokenExpiryFromLocalStorage).mockReturnValue({
			accessTokenValidUntilTime: Date.now() - 1,
			refreshTokenValidUntilTime: Date.now() - 1
		});

		await expect(handleTokenRefresh(false)).rejects.toBeUndefined();

		expect(logout).toHaveBeenCalledWith(false, '/login');
	});

	it('refreshes tokens when only the access token is expired', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		vi.mocked(getTokenExpiryFromLocalStorage).mockReturnValue({
			accessTokenValidUntilTime: Date.now() - 1,
			refreshTokenValidUntilTime: Date.now() + 60_000
		});
		vi.mocked(refreshKeycloakAccessToken).mockResolvedValue({
			data: {},
			access_token: 'new-access',
			expires_in: 300,
			refresh_token: 'new-refresh',
			refresh_expires_in: 600
		});

		await expect(handleTokenRefresh()).resolves.toBeUndefined();

		expect(refreshKeycloakAccessToken).toHaveBeenCalled();
		expect(setValueInCookie).toHaveBeenCalledWith('keycloak', 'new-access');
		expect(setValueInCookie).toHaveBeenCalledWith(
			'refreshToken',
			'new-refresh'
		);
	});

	it('starts refresh and logout timers when tokens are still valid', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		vi.mocked(getTokenExpiryFromLocalStorage).mockReturnValue({
			accessTokenValidUntilTime: Date.now() + 20_000,
			refreshTokenValidUntilTime: Date.now() + 40_000
		});
		vi.mocked(refreshKeycloakAccessToken).mockResolvedValue({
			data: {},
			access_token: 'timer-access',
			expires_in: 300,
			refresh_token: 'timer-refresh',
			refresh_expires_in: 600
		});

		await handleTokenRefresh();
		await vi.advanceTimersByTimeAsync(10_000);

		expect(refreshKeycloakAccessToken).toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(30_000);

		expect(logout).toHaveBeenCalledWith(true, '/login');
	});
});
