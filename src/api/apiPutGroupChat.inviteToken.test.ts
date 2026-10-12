// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiPutGroupChat, GROUP_CHAT_API } from './apiPutGroupChat';
import { requestCollector } from '../utils/requestCollector';

// jsdom's Request rejects its own AbortSignal; this one only records the url.
class TestRequest {
	url: string;
	headers: Headers;

	constructor(url: string, init: { headers?: HeadersInit } = {}) {
		this.url = url;
		this.headers = new Headers(init.headers);
	}
}

const fetchMock = vi.fn();

beforeEach(() => {
	vi.stubGlobal('Request', TestRequest);
	vi.stubGlobal('fetch', fetchMock);
	fetchMock.mockResolvedValue({
		status: 200,
		json: () => Promise.resolve({})
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/**
 * #1499 / UserService#1248: joining a self-help group sends the group's secret
 * invite token as a query parameter. The request needs it; the in-app request
 * log (DevToolbar) must not show it.
 */
describe('apiPutGroupChat with an invite token', () => {
	it('sends the token but keeps it out of the request log', async () => {
		await apiPutGroupChat(15, GROUP_CHAT_API.ASSIGN, {
			inviteToken: 's3cret-token'
		});

		const sent = (fetchMock.mock.calls[0][0] as TestRequest).url;
		expect(sent).toContain('/15/assign?inviteToken=s3cret-token');

		const logged = requestCollector
			.get()
			.map((request) => request.url)
			.filter((url) => url.includes('/15/assign'));
		expect(logged.length).toBeGreaterThan(0);
		logged.forEach((url) => {
			expect(url).not.toContain('s3cret-token');
			expect(url).toContain('inviteToken=');
		});
	});
});
