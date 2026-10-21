// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getKeycloakAccessToken } from './getKeycloakAccessToken';

vi.mock('../../resources/scripts/endpoints', () => ({
	endpoints: {
		keycloakAccessToken:
			'https://api.oriso-dev.site/auth/realms/online-beratung/protocol/openid-connect/token'
	}
}));

vi.mock('../../api', () => ({
	FETCH_ERRORS: {
		BAD_REQUEST: 'BAD_REQUEST',
		UNAUTHORIZED: 'UNAUTHORIZED',
		TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS'
	},
	FetchErrorWithOptions: class FetchErrorWithOptions extends Error {
		options: Record<string, unknown>;

		constructor(message: string, options: Record<string, unknown>) {
			super(message);
			this.options = options;
		}
	}
}));

const fetchMock = vi.fn();

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
});

describe('getKeycloakAccessToken', () => {
	it('posts entered username and password to the configured Keycloak token endpoint', async () => {
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					access_token: 'access-token',
					expires_in: 300,
					refresh_token: 'refresh-token',
					refresh_expires_in: 600
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			getKeycloakAccessToken('shanzae@example.com', 'secret%21')
		).resolves.toMatchObject({
			access_token: 'access-token',
			refresh_token: 'refresh-token'
		});

		const request = fetchMock.mock.calls[0][0] as Request;
		expect(request.url).toBe(
			'https://api.oriso-dev.site/auth/realms/online-beratung/protocol/openid-connect/token'
		);
		expect(request.method).toBe('POST');
		expect(request.headers.has('cache-control')).toBe(false);
		expect(request.credentials).toBe('omit');
		expect(await request.text()).toBe(
			'username=shanzae@example.com&password=secret%21&client_id=app&grant_type=password'
		);
	});

	it('includes an otp code when two-factor authentication is required', async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'token' }), {
				status: 200
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		await getKeycloakAccessToken('user', 'password', '123456');

		const request = fetchMock.mock.calls[0][0] as Request;
		expect(await request.text()).toContain('&otp=123456&');
	});

	it('rejects invalid credentials as an unauthorized login error', async () => {
		fetchMock.mockResolvedValue(new Response('', { status: 401 }));
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			getKeycloakAccessToken('wrong@example.com', 'bad-password')
		).rejects.toThrow('UNAUTHORIZED');
	});

	it('keeps Keycloak validation details for bad request responses', async () => {
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					error_description: 'otp required',
					otpType: 'EMAIL'
				}),
				{ status: 400 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			getKeycloakAccessToken('user@example.com', 'password')
		).rejects.toMatchObject({
			message: 'BAD_REQUEST',
			options: {
				data: {
					error_description: 'otp required',
					otpType: 'EMAIL'
				}
			}
		});
	});

	it('reports a 429 as too many requests, not as an outage (#1338)', async () => {
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					error: 'invalid_grant',
					error_description: 'Too many codes requested'
				}),
				{ status: 429 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			getKeycloakAccessToken('user@example.com', 'password')
		).rejects.toThrow('TOO_MANY_REQUESTS');
	});

	// Keycloak's e-mail code cap (ORISO-Keycloak#46) answers 429 with the
	// challenge; the login screen needs it for the code field and the wait.
	it('keeps the 429 body: otpType and resendAvailableInSeconds (#1338)', async () => {
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					error: 'invalid_grant',
					error_description: 'Too many codes requested',
					otpType: 'EMAIL',
					resendAvailableInSeconds: 745
				}),
				{ status: 429 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			getKeycloakAccessToken('user@example.com', 'password')
		).rejects.toMatchObject({
			message: 'TOO_MANY_REQUESTS',
			options: {
				data: { otpType: 'EMAIL', resendAvailableInSeconds: 745 }
			}
		});
	});

	it('still reports TOO_MANY_REQUESTS when the 429 body is not JSON (ingress limit)', async () => {
		fetchMock.mockResolvedValue(
			new Response('<html>429 Too Many Requests</html>', { status: 429 })
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			getKeycloakAccessToken('user@example.com', 'password')
		).rejects.toMatchObject({
			message: 'TOO_MANY_REQUESTS',
			options: { data: {} }
		});
	});
});
