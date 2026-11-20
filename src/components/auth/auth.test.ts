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
	handleTokenRefresh,
	hasActiveAuthSession,
	isInviteRoute,
	isPublicAuthRoute,
	setTokens
} from './auth';
import {
	getValueFromCookie,
	setValueInCookie
} from '../sessionCookie/accessSessionCookie';
import {
	getTokenExpiryFromLocalStorage,
	setTokenExpiryInLocalStorage
} from '../sessionCookie/accessSessionLocalStorage';
import { logout, teardownLocalSession } from '../logout/logout';
import { refreshKeycloakAccessToken } from '../sessionCookie/refreshKeycloakAccessToken';

vi.mock('../sessionCookie/accessSessionCookie', () => ({
	getValueFromCookie: vi.fn(),
	setValueInCookie: vi.fn()
}));

vi.mock('../sessionCookie/accessSessionLocalStorage', () => ({
	getTokenExpiryFromLocalStorage: vi.fn(),
	setTokenExpiryInLocalStorage: vi.fn()
}));

vi.mock('../logout/logout', () => ({
	logout: vi.fn(),
	teardownLocalSession: vi.fn()
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

const refreshJwt = (jti: string, sid = 'shared-session') => {
	const payload = btoa(
		JSON.stringify({ iss: 'https://issuer.test', sid, jti })
	);
	return `header.${payload}.signature`;
};

describe('auth helpers', () => {
	it.each([
		['/invite/token', true],
		['/invite/token/U25%20Suizidpr%C3%A4vention', true],
		['/invited', false],
		['/login', false]
	])('detects invite route %s', (path, expected) => {
		window.history.replaceState({}, '', path);
		expect(isInviteRoute()).toBe(expected);
	});

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(setTokenExpiryInLocalStorage).mockReset();
		vi.mocked(getValueFromCookie).mockReturnValue('current-refresh');
		window.history.replaceState({}, '', '/login');
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it.each([
		['/login', true],
		['/registration', true],
		['/tenant-a/registration', true],
		['/invite/token', true],
		['/invite/token/U25%20Suizidpr%C3%A4vention', true],
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

	it('tears the local session down before the caller can show the login form', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-16T10:00:00.000Z'));
		vi.mocked(getTokenExpiryFromLocalStorage).mockReturnValue({
			accessTokenValidUntilTime: Date.now() - 1,
			refreshTokenValidUntilTime: Date.now() - 26 * 60_000
		});
		const order: string[] = [];
		vi.mocked(teardownLocalSession).mockImplementation(() => {
			order.push('teardown');
		});
		vi.mocked(logout).mockImplementation(async () => {
			order.push('logout');
		});

		await expect(handleTokenRefresh(false)).rejects.toBeUndefined();

		// Synchronous, and ahead of the async logout: no leftover cookie may
		// survive into the render that shows the login form.
		expect(order).toEqual(['teardown', 'logout']);
	});

	it('settles refresh failures without tearing the local session down', async () => {
		vi.useFakeTimers();
		vi.mocked(getTokenExpiryFromLocalStorage).mockReturnValue({
			accessTokenValidUntilTime: Date.now() - 1,
			refreshTokenValidUntilTime: Date.now() + 60_000
		});
		vi.mocked(refreshKeycloakAccessToken).mockRejectedValue(
			new Error('keycloakLogin')
		);

		let rejection: unknown;
		void handleTokenRefresh().catch((error) => {
			rejection = error;
		});
		for (let index = 0; index < 5; index += 1) {
			await Promise.resolve();
		}

		expect(rejection).toMatchObject({
			name: 'TokenRefreshUnavailableError'
		});
		expect(teardownLocalSession).not.toHaveBeenCalled();
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

	it('retries temporary refresh failure and logs out at actual expiry', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		vi.mocked(getTokenExpiryFromLocalStorage).mockReturnValue({
			accessTokenValidUntilTime: Date.now() + 20_000,
			refreshTokenValidUntilTime: Date.now() + 40_000
		});
		vi.mocked(refreshKeycloakAccessToken).mockRejectedValue(
			new Error('temporary failure')
		);

		await handleTokenRefresh();
		await vi.advanceTimersByTimeAsync(10_000);

		expect(refreshKeycloakAccessToken).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(refreshKeycloakAccessToken).toHaveBeenCalledTimes(2);

		await vi.advanceTimersByTimeAsync(20_000);

		expect(teardownLocalSession).toHaveBeenCalledOnce();
		expect(logout).toHaveBeenCalledWith(true, '/login');
	});

	const mockLiveExpiry = (accessDelay: number, refreshDelay: number) => {
		const initial = Date.now();
		const expiry = {
			accessTokenValidUntilTime: initial + accessDelay,
			refreshTokenValidUntilTime: initial + refreshDelay
		};
		vi.mocked(getTokenExpiryFromLocalStorage).mockImplementation(() => ({
			...expiry
		}));
		vi.mocked(setTokenExpiryInLocalStorage).mockImplementation(
			(key, seconds) => {
				const field =
					key === 'auth.access_token_valid_until'
						? 'accessTokenValidUntilTime'
						: 'refreshTokenValidUntilTime';
				expiry[field] = Date.now() + seconds * 1000;
			}
		);
	};

	it('schedules the next renewal after a successful startup refresh', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		mockLiveExpiry(-1, 20_000);
		vi.mocked(refreshKeycloakAccessToken).mockResolvedValue({
			data: {},
			access_token: 'renewed-access',
			expires_in: 20,
			refresh_token: 'renewed-refresh',
			refresh_expires_in: 60
		});

		await handleTokenRefresh();
		await vi.advanceTimersByTimeAsync(10_000);

		expect(refreshKeycloakAccessToken).toHaveBeenCalledTimes(2);
	});

	it('uses renewed deadlines after periodic refresh instead of logging out at the old one', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		mockLiveExpiry(20_000, 40_000);
		vi.mocked(refreshKeycloakAccessToken).mockResolvedValue({
			data: {},
			access_token: 'renewed-access',
			expires_in: 300,
			refresh_token: 'renewed-refresh',
			refresh_expires_in: 600
		});

		await handleTokenRefresh();
		await vi.advanceTimersByTimeAsync(40_000);

		expect(logout).not.toHaveBeenCalled();
		expect(refreshKeycloakAccessToken).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(260_000);
		expect(refreshKeycloakAccessToken).toHaveBeenCalledTimes(2);
	});

	it('keeps the startup expiry armed while refresh is pending and drops its late response', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		mockLiveExpiry(-1, 20_000);
		let completeRefresh: (() => void) | undefined;
		vi.mocked(refreshKeycloakAccessToken).mockImplementation(
			() =>
				new Promise((resolve) => {
					completeRefresh = () =>
						resolve({
							data: {},
							access_token: 'late-access',
							expires_in: 300,
							refresh_token: 'late-refresh',
							refresh_expires_in: 600
						});
				})
		);

		const result = handleTokenRefresh().catch((error: unknown) => error);
		await vi.advanceTimersByTimeAsync(20_000);
		expect(teardownLocalSession).toHaveBeenCalledOnce();
		expect(logout).toHaveBeenCalledOnce();
		expect(teardownLocalSession).toHaveBeenCalledBefore(logout);
		completeRefresh?.();
		await expect(result).resolves.toMatchObject({
			name: 'TokenRefreshUnavailableError'
		});
		expect(setValueInCookie).not.toHaveBeenCalled();
	});

	it.each([
		['replacement-refresh', 100_000, 120_000],
		['', -1, -1]
	])(
		'discards pending refresh and timers after the credential changes to %j',
		async (refreshToken, accessDelay, refreshDelay) => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
			mockLiveExpiry(20_000, 40_000);
			let completeRefresh: (() => void) | undefined;
			vi.mocked(refreshKeycloakAccessToken).mockImplementation(
				() =>
					new Promise((resolve) => {
						completeRefresh = () =>
							resolve({
								data: {},
								access_token: 'old-access',
								expires_in: 300,
								refresh_token: 'old-refresh',
								refresh_expires_in: 600
							});
					})
			);

			await handleTokenRefresh();
			await vi.advanceTimersByTimeAsync(10_000);
			vi.mocked(getValueFromCookie).mockReturnValue(refreshToken);
			mockLiveExpiry(accessDelay, refreshDelay);
			completeRefresh?.();
			await vi.advanceTimersByTimeAsync(150_000);

			expect(setValueInCookie).not.toHaveBeenCalled();
			expect(logout).not.toHaveBeenCalled();
			expect(refreshKeycloakAccessToken).toHaveBeenCalledOnce();
		}
	);

	it('retains valid access past an earlier refresh deadline', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		mockLiveExpiry(100_000, 20_000);

		await handleTokenRefresh();
		await vi.advanceTimersByTimeAsync(20_000);
		expect(logout).not.toHaveBeenCalled();
		expect(refreshKeycloakAccessToken).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(70_000);
		expect(logout).toHaveBeenCalledWith(true, '/login');
		expect(refreshKeycloakAccessToken).not.toHaveBeenCalled();
	});

	it('tears down when both short-lived tokens expire before renewal is scheduled', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		mockLiveExpiry(8_000, 4_000);

		await handleTokenRefresh();
		await vi.advanceTimersByTimeAsync(8_000);

		expect(teardownLocalSession).toHaveBeenCalledOnce();
		expect(logout).toHaveBeenCalledWith(true, '/login');
		expect(refreshKeycloakAccessToken).not.toHaveBeenCalled();
	});

	it('adopts a peer renewal of the same session without writing its losing response', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		vi.mocked(getValueFromCookie).mockReturnValue(refreshJwt('old'));
		mockLiveExpiry(20_000, 40_000);
		let completeRefresh: (() => void) | undefined;
		vi.mocked(refreshKeycloakAccessToken)
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						completeRefresh = () =>
							resolve({
								data: {},
								access_token: 'old-access',
								expires_in: 300,
								refresh_token: refreshJwt('losing-response'),
								refresh_expires_in: 600
							});
					})
			)
			.mockRejectedValue(new Error('temporary failure'));

		await handleTokenRefresh();
		await vi.advanceTimersByTimeAsync(10_000);
		vi.mocked(getValueFromCookie).mockReturnValue(refreshJwt('peer'));
		mockLiveExpiry(50_000, 100_000);
		completeRefresh?.();
		await vi.advanceTimersByTimeAsync(30_000);

		expect(setValueInCookie).not.toHaveBeenCalled();
		expect(logout).not.toHaveBeenCalled();
		expect(refreshKeycloakAccessToken).toHaveBeenCalledOnce();

		await vi.advanceTimersByTimeAsync(10_000);
		expect(refreshKeycloakAccessToken).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(teardownLocalSession).toHaveBeenCalledOnce();
	});

	it('reads peer deadlines again when its access token arrives at the old deadline', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		let accessToken = refreshJwt('old-access');
		let refreshToken = refreshJwt('old-refresh');
		vi.mocked(getValueFromCookie).mockImplementation((name) =>
			name === 'keycloak' ? accessToken : refreshToken
		);
		mockLiveExpiry(9_000, 8_000);
		vi.mocked(refreshKeycloakAccessToken).mockRejectedValue(
			new Error('temporary failure')
		);

		await handleTokenRefresh();
		await vi.advanceTimersByTimeAsync(8_999);
		accessToken = refreshJwt('peer-access');
		await vi.advanceTimersByTimeAsync(51);
		expect(logout).not.toHaveBeenCalled();
		refreshToken = refreshJwt('peer-refresh');
		mockLiveExpiry(20_050, 40_050);

		await vi.advanceTimersByTimeAsync(10_050);
		expect(refreshKeycloakAccessToken).toHaveBeenCalledOnce();
		expect(logout).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(30_000);
		expect(teardownLocalSession).toHaveBeenCalledOnce();
	});

	it('discards a pending grant when the new session access token arrives first', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		let accessToken = refreshJwt('old-access');
		vi.mocked(getValueFromCookie).mockImplementation((name) =>
			name === 'keycloak' ? accessToken : refreshJwt('old-refresh')
		);
		mockLiveExpiry(20_000, 40_000);
		let completeRefresh: (() => void) | undefined;
		vi.mocked(refreshKeycloakAccessToken).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					completeRefresh = () =>
						resolve({
							data: {},
							access_token: 'losing-access',
							expires_in: 300,
							refresh_token: 'losing-refresh',
							refresh_expires_in: 600
						});
				})
		);

		await handleTokenRefresh();
		await vi.advanceTimersByTimeAsync(10_000);
		accessToken = refreshJwt('new-access', 'new-session');
		completeRefresh?.();
		await vi.advanceTimersByTimeAsync(30_000);

		expect(setValueInCookie).not.toHaveBeenCalled();
		expect(logout).not.toHaveBeenCalled();
		expect(refreshKeycloakAccessToken).toHaveBeenCalledOnce();
	});

	it('still renews when the peer deadlines became visible before the tokens', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'));
		vi.mocked(getValueFromCookie).mockReturnValue(refreshJwt('old'));
		mockLiveExpiry(20_000, 40_000);
		vi.mocked(refreshKeycloakAccessToken).mockRejectedValue(
			new Error('temporary failure')
		);

		await handleTokenRefresh();
		await vi.advanceTimersByTimeAsync(9_999);
		mockLiveExpiry(10_100, 30_100);
		await vi.advanceTimersByTimeAsync(2);
		vi.mocked(getValueFromCookie).mockReturnValue(refreshJwt('peer'));
		await vi.advanceTimersByTimeAsync(12_000);

		expect(refreshKeycloakAccessToken).toHaveBeenCalled();
		expect(logout).not.toHaveBeenCalled();
	});
});
