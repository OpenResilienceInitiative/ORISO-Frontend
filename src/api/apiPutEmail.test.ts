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
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('sends the trimmed address as a JSON string with application/json', async () => {
		vi.useFakeTimers();
		const fetchMock = vi
			.fn<(request: Request) => Promise<Response>>()
			.mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		await apiPutEmail('  bart@example.org  ');

		expect(fetchMock).toHaveBeenCalledOnce();
		const request = fetchMock.mock.calls[0][0];
		expect(request.url).toBe(
			'https://predev.oriso.org/service/users/email'
		);
		expect(request.method).toBe('PUT');
		expect(request.headers.get('Content-Type')).toBe('application/json');
		const body = await request.text();
		expect(body).toBe('"bart@example.org"');
		expect(JSON.parse(body)).toBe('bart@example.org');
	});
});
