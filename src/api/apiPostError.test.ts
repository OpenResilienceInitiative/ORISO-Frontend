import { describe, expect, it, vi } from 'vitest';
import {
	apiPostError,
	ERROR_LEVEL_ERROR,
	ERROR_LEVEL_FATAL,
	ERROR_LEVEL_WARN
} from './apiPostError';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		error: 'https://users.oriso-dev.site/service/error-reports'
	}
}));

describe('apiPostError', () => {
	it('posts a frontend error report to the UserService error-reports endpoint', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 202 }));
		vi.stubGlobal('fetch', fetchMock);

		const error = {
			name: 'TypeError',
			message: 'Cannot read properties of undefined',
			stack: 'TypeError: ...\n  at Component.render',
			level: ERROR_LEVEL_FATAL,
			url: 'https://app.oriso-dev.site/chat',
			headers: { 'User-Agent': 'test-agent' }
		} as Parameters<typeof apiPostError>[0];

		await expect(apiPostError(error, undefined, 'corr-1')).resolves.toEqual(
			{}
		);

		expect(fetchMock).toHaveBeenCalledWith(
			'https://users.oriso-dev.site/service/error-reports',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source: 'frontend',
					message: 'Cannot read properties of undefined',
					stack: 'TypeError: ...\n  at Component.render',
					url: 'https://app.oriso-dev.site/chat',
					userAgent: 'test-agent',
					correlationId: 'corr-1',
					severity: 'error'
				})
			}
		);
	});

	it('maps a WARN-level error to severity warn', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
		);

		const error = {
			name: 'Warning',
			message: 'a recoverable hiccup',
			level: ERROR_LEVEL_WARN,
			url: 'https://app.oriso-dev.site/'
		} as Parameters<typeof apiPostError>[0];

		const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

		await apiPostError(error);

		const [, options] = fetchMock.mock.calls[0];
		expect(JSON.parse(options.body).severity).toBe('warn');
	});

	it('never rejects when the network call fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockRejectedValue(new Error('network down'))
		);

		const error = {
			name: 'Error',
			message: 'boom',
			level: ERROR_LEVEL_ERROR,
			url: 'https://app.oriso-dev.site/'
		} as Parameters<typeof apiPostError>[0];

		await expect(apiPostError(error)).resolves.toEqual({});
	});

	it('falls back to a placeholder message when the error has none', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
		);
		const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

		await apiPostError({} as Parameters<typeof apiPostError>[0]);

		const [, options] = fetchMock.mock.calls[0];
		const body = JSON.parse(options.body);
		expect(body.message).toBe('Unknown frontend error');
		expect(body.source).toBe('frontend');
	});
});
