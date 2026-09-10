import { beforeEach, expect, it, vi } from 'vitest';
import { reauthenticateRecovery } from './reauthenticateRecovery';
const mocks = vi.hoisted(() => ({ login: vi.fn(), cookie: vi.fn() }));
vi.mock('../components/sessionCookie/getKeycloakAccessToken', () => ({
	getKeycloakAccessToken: mocks.login
}));
vi.mock('../components/sessionCookie/accessSessionCookie', () => ({
	getValueFromCookie: mocks.cookie
}));
vi.mock('../utils/parseJWT', () => ({
	parseJwt: (token: string) =>
		token === 'current'
			? { sub: 'a', preferred_username: 'synthetic' }
			: { sub: 'b' }
}));
beforeEach(() => {
	vi.clearAllMocks();
	mocks.cookie.mockReturnValue('current');
});
it('requires successful complete authentication before recovery repair', async () => {
	mocks.login.mockRejectedValue(new Error('OTP required'));
	await expect(
		reauthenticateRecovery('synthetic-password')
	).rejects.toThrow();
	mocks.login.mockResolvedValue({ access_token: 'current' });
	await expect(
		reauthenticateRecovery('synthetic+password&', '123456')
	).resolves.toBeUndefined();
	expect(mocks.login).toHaveBeenLastCalledWith(
		'synthetic',
		'synthetic%2Bpassword%26',
		'123456'
	);
});
it('rejects authentication for a different identity or an account switch during the request', async () => {
	mocks.login.mockResolvedValue({ access_token: 'other' });
	await expect(
		reauthenticateRecovery('synthetic-password')
	).rejects.toThrow();
	mocks.login.mockResolvedValue({ access_token: 'current' });
	mocks.cookie.mockReturnValueOnce('current').mockReturnValueOnce('other');
	await expect(
		reauthenticateRecovery('synthetic-password')
	).rejects.toThrow();
});
