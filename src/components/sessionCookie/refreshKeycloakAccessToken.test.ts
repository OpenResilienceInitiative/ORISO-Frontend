// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshKeycloakAccessToken } from './refreshKeycloakAccessToken';

vi.mock('../../resources/scripts/endpoints', () => ({
	endpoints: {
		keycloakAccessToken:
			'https://api.oriso-dev.site/auth/realms/online-beratung/protocol/openid-connect/token'
	}
}));

vi.mock('./accessSessionCookie', () => ({
	getValueFromCookie: () => 'stored-refresh-token'
}));

const fetchMock = vi.fn();

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
});

describe('refreshKeycloakAccessToken', () => {
	it('posts the refresh grant with the form content type and without a cache-control header', async () => {
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					access_token: 'access-token',
					refresh_token: 'next-refresh-token'
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(refreshKeycloakAccessToken()).resolves.toMatchObject({
			access_token: 'access-token'
		});

		const request = fetchMock.mock.calls[0][0] as Request;
		expect(request.url).toBe(
			'https://api.oriso-dev.site/auth/realms/online-beratung/protocol/openid-connect/token'
		);
		expect(request.method).toBe('POST');
		// the header contract: form content type present, no cache-control
		expect(request.headers.get('content-type')).toBe(
			'application/x-www-form-urlencoded'
		);
		expect(request.headers.has('cache-control')).toBe(false);
		expect(await request.text()).toBe(
			'refresh_token=stored-refresh-token&client_id=app&grant_type=refresh_token'
		);
	});

	it('rejects with keycloakLogin when the refresh grant is unauthorized', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
		vi.stubGlobal('fetch', fetchMock);

		await expect(refreshKeycloakAccessToken()).rejects.toThrow(
			'keycloakLogin'
		);
	});
});
