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

vi.mock('./fetchData', async (importOriginal) => ({
	...(await importOriginal<typeof import('./fetchData')>()),
	FETCH_ERRORS: {
		BAD_REQUEST: 'BAD_REQUEST',
		CATCH_ALL_WITH_RESPONSE: 'CATCH_ALL_WITH_RESPONSE',
		CATCH_ALL: 'CATCH_ALL',
		TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
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
		CATCH_ALL_WITH_RESPONSE: 'CATCH_ALL_WITH_RESPONSE',
		CATCH_ALL: 'CATCH_ALL',
		TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
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
			responseHandling: [
				'CONTENT',
				'CATCH_ALL_WITH_RESPONSE',
				'UNAUTHORIZED'
			]
		});
	});

	it('sends the second factor together with the same magic-link token', async () => {
		fetchDataMock.mockResolvedValue({});
		await apiConsumeMagicLinkLogin('magic-token', '123456');
		expect(fetchDataMock).toHaveBeenLastCalledWith(
			expect.objectContaining({
				bodyData: JSON.stringify({
					token: 'magic-token',
					otp: '123456'
				}),
				skipAuth: true
			})
		);
	});

	it.each([
		[400, 'APP', undefined],
		[400, 'EMAIL', 30],
		[429, 'EMAIL', 30]
	])(
		'preserves the finite %s %s challenge for the login form',
		async (status, otpType, wait) => {
			const data = {
				error: 'invalid_grant',
				error_description: 'Missing totp',
				otpType,
				...(wait === undefined
					? {}
					: { resendAvailableInSeconds: wait })
			};
			fetchDataMock.mockRejectedValueOnce(
				new Response(JSON.stringify(data), { status: Number(status) })
			);
			await expect(
				apiConsumeMagicLinkLogin('magic-token')
			).rejects.toMatchObject({
				message: status === 429 ? 'TOO_MANY_REQUESTS' : 'BAD_REQUEST',
				options: { data }
			});
		}
	);
	it.each([
		{ label: 'array factor', fields: { otpType: ['APP'] }, status: 400 },
		{
			label: 'fractional wait',
			fields: { otpType: 'EMAIL', resendAvailableInSeconds: 0.5 },
			status: 400
		},
		{
			label: 'extra field',
			fields: { otpType: 'APP', extra: true },
			status: 400
		},
		{ label: 'APP throttle', fields: { otpType: 'APP' }, status: 429 }
	])('refuses a malformed $label challenge', async ({ fields, status }) => {
		fetchDataMock.mockRejectedValueOnce(
			new Response(
				JSON.stringify({
					error: 'invalid_grant',
					error_description: 'Missing totp',
					...fields
				}),
				{ status }
			)
		);
		await expect(
			apiConsumeMagicLinkLogin('magic-token')
		).rejects.toMatchObject({
			message: 'CATCH_ALL'
		});
	});
});
