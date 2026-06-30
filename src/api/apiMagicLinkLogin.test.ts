import { describe, expect, it, vi } from 'vitest';
import { apiConsumeMagicLinkLogin } from './apiConsumeMagicLinkLogin';
import { apiRequestMagicLinkLogin } from './apiRequestMagicLinkLogin';

const fetchDataMock = vi.hoisted(() => vi.fn());

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		magicLinkConsume:
			'https://api.oriso-dev.site/service/users/magic-link/consume',
		magicLinkRequest:
			'https://api.oriso-dev.site/service/users/magic-link/request'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: {
		BAD_REQUEST: 'BAD_REQUEST',
		FORBIDDEN: 'FORBIDDEN',
		GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
		UNAUTHORIZED: 'UNAUTHORIZED'
	},
	FETCH_METHODS: { POST: 'POST' },
	FETCH_SUCCESS: { CONTENT: 'CONTENT' },
	fetchData: fetchDataMock
}));

vi.mock('./index', () => ({
	FETCH_ERRORS: {
		BAD_REQUEST: 'BAD_REQUEST',
		UNAUTHORIZED: 'UNAUTHORIZED'
	},
	FETCH_METHODS: { POST: 'POST' },
	FETCH_SUCCESS: { CONTENT: 'CONTENT' },
	fetchData: fetchDataMock
}));

describe('magic link login API helpers', () => {
	it('requests a magic login link for the entered email address', async () => {
		fetchDataMock.mockResolvedValue(undefined);

		await apiRequestMagicLinkLogin('shanzae@example.com');

		expect(fetchDataMock).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/users/magic-link/request',
			method: 'POST',
			bodyData: JSON.stringify({ username: 'shanzae@example.com' }),
			skipAuth: true,
			responseHandling: ['BAD_REQUEST', 'FORBIDDEN', 'GATEWAY_TIMEOUT']
		});
	});

	it('consumes a magic login token and returns auth tokens', async () => {
		const tokenResponse = {
			access_token: 'access-token',
			expires_in: 300,
			refresh_token: 'refresh-token',
			refresh_expires_in: 600
		};
		fetchDataMock.mockResolvedValue(tokenResponse);

		await expect(apiConsumeMagicLinkLogin('magic-token')).resolves.toEqual(
			tokenResponse
		);

		expect(fetchDataMock).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/users/magic-link/consume',
			method: 'POST',
			bodyData: JSON.stringify({ token: 'magic-token' }),
			skipAuth: true,
			responseHandling: ['CONTENT', 'BAD_REQUEST', 'UNAUTHORIZED']
		});
	});
});
