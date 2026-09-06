// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchData, FETCH_METHODS } from './fetchData';

const reload = vi.fn();

const setPathname = (pathname: string) => {
	Object.defineProperty(window, 'location', {
		configurable: true,
		writable: true,
		value: { ...window.location, pathname, reload }
	});
};

// jsdom's AbortSignal is not the one the platform Request constructor accepts,
// so stand in a minimal Request that only records url, init and headers.
class TestRequest {
	url: string;
	headers: Headers;

	constructor(url: string, init: { headers?: HeadersInit } = {}) {
		this.url = url;
		this.headers = new Headers(init.headers);
	}
}

const headerOf = (call: unknown[], name: string) => {
	const request = call[0] as TestRequest;
	return request.headers.get(name);
};

beforeEach(() => {
	document.cookie = 'keycloak=stale';
	setPathname('/registration');
	vi.stubGlobal('Request', TestRequest);
});

afterEach(() => {
	document.cookie = 'keycloak=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('fetchData on a 401 with a stale token on a public auth route', () => {
	it('retries once anonymously instead of reloading the page', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({ status: 401 })
			.mockResolvedValueOnce({
				status: 200,
				json: () => Promise.resolve({ ok: true })
			});
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			fetchData({
				url: 'https://api.test.local/service/registration',
				method: FETCH_METHODS.GET
			})
		).resolves.toEqual({ ok: true });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(headerOf(fetchMock.mock.calls[0], 'Authorization')).toBe(
			'Bearer stale'
		);
		expect(headerOf(fetchMock.mock.calls[1], 'Authorization')).toBeNull();
		expect(reload).not.toHaveBeenCalled();
	});

	it('rejects as unauthorized when the anonymous retry also fails', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ status: 401 });
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			fetchData({
				url: 'https://api.test.local/service/registration',
				method: FETCH_METHODS.GET
			})
		).rejects.toThrow('UNAUTHORIZED');

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(reload).not.toHaveBeenCalled();
	});
});
