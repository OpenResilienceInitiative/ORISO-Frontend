// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiPutEmail } from './apiPutEmail';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		email: 'https://predev.oriso.org/service/users/email'
	}
}));

describe('contact email request wire format', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('sends the trimmed address as a JSON string with application/json', async () => {
		// jsdom has no Request; Node's rejects a jsdom AbortSignal, so record
		// the init verbatim instead (same pattern as
		// apiSetLiveChatAvailability.response.test.ts).
		vi.stubGlobal(
			'Request',
			class {
				constructor(
					public url: string,
					public init?: RequestInit
				) {}
			}
		);
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
