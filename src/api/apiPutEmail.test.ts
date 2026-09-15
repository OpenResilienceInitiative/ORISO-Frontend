// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiPutEmail } from './apiPutEmail';
import { FETCH_ERRORS } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		email: 'https://predev.oriso.org/service/users/email'
	}
}));

/** jsdom has no Request; Node's rejects a jsdom AbortSignal. */
const stubRecordingRequest = () => {
	vi.stubGlobal(
		'Request',
		class {
			constructor(
				public url: string,
				public init?: RequestInit
			) {}
		}
	);
};

describe('contact email request wire format', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('sends the trimmed address as a JSON string with application/json', async () => {
		// same pattern as apiSetLiveChatAvailability.response.test.ts
		stubRecordingRequest();
		const fetchMock = vi
			.fn()
			.mockResolvedValue({ status: 200 } as Response);
		vi.stubGlobal('fetch', fetchMock);

		await apiPutEmail('  bart@example.org  ');

		expect(fetchMock).toHaveBeenCalledOnce();
		const req = fetchMock.mock.calls[0][0];
		expect(req.url).toBe('https://predev.oriso.org/service/users/email');
		expect(req.init.method).toBe('PUT');
		expect(req.init.headers['Content-Type']).toBe('application/json');
		// The server's first eligible converter is Jackson, so an unquoted
		// address is rejected as an invalid JSON token (HTTP 400). The body
		// must be a JSON string literal, quotes included.
		expect(req.init.body).toBe('"bart@example.org"');
		expect(JSON.parse(req.init.body)).toBe('bart@example.org');
	});
});

describe('status mappings that let the overlay tell email-save failures apart', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it.each([
		[403, FETCH_ERRORS.FORBIDDEN],
		[500, FETCH_ERRORS.ABORTED],
		[504, FETCH_ERRORS.GATEWAY_TIMEOUT],
		[418, FETCH_ERRORS.CATCH_ALL]
	] as const)('maps HTTP %i to Error(%s)', async (status, message) => {
		stubRecordingRequest();
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ status } as Response)
		);

		await expect(apiPutEmail('bart@example.org')).rejects.toThrow(message);
	});

	it('rejects 409 with the Response so X-Reason stays readable', async () => {
		stubRecordingRequest();
		const response = {
			status: 409,
			headers: { get: () => 'EMAIL_NOT_AVAILABLE' }
		};
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

		let rejection: unknown;
		try {
			await apiPutEmail('bart@example.org');
		} catch (error) {
			rejection = error;
		}

		expect(rejection).toBe(response);
		expect(rejection instanceof Error).toBe(false);
		expect((rejection as Response).headers).toBeDefined();
	});
});
