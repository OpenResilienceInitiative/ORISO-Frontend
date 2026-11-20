// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchData, FETCH_METHODS } from '../../api/fetchData';
import { createTraceparent, traceHeaders } from './traceparent';

const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/;

type RuntimeWindow = Window & { __ORISO_RUNTIME_CONFIG__?: object };

const setObservability = (enabled: boolean) => {
	(window as RuntimeWindow).__ORISO_RUNTIME_CONFIG__ = {
		REACT_APP_OBSERVABILITY_ENABLED: String(enabled)
	};
};

class TestRequest {
	url: string;
	headers: Headers;

	constructor(url: string, init: { headers?: HeadersInit } = {}) {
		this.url = url;
		this.headers = new Headers(init.headers);
	}
}

beforeEach(() => {
	delete (window as RuntimeWindow).__ORISO_RUNTIME_CONFIG__;
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('createTraceparent', () => {
	it('builds a sampled W3C header with fresh ids each time', () => {
		const first = createTraceparent();
		expect(first).toMatch(TRACEPARENT);
		expect(createTraceparent()).not.toBe(first);
	});

	it('gives up instead of sending an all-zero id', () => {
		vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(
			(array) => array
		);
		expect(createTraceparent()).toBeNull();
		vi.restoreAllMocks();
	});
});

describe('traceHeaders', () => {
	it('adds nothing while observability is off', () => {
		setObservability(false);
		expect(traceHeaders('/service/users/data')).toEqual({});
	});

	it('adds the header for same-origin backend calls', () => {
		setObservability(true);
		expect(traceHeaders('/service/users/data').traceparent).toMatch(
			TRACEPARENT
		);
		expect(
			traceHeaders(`${window.location.origin}/service/agencies`)
				.traceparent
		).toMatch(TRACEPARENT);
	});

	it('never sends it to another origin', () => {
		setObservability(true);
		expect(traceHeaders('https://cal.example.org/api/me')).toEqual({});
	});
});

describe('fetchData', () => {
	it('sends a traceparent to the same-origin backend', async () => {
		setObservability(true);
		vi.stubGlobal('Request', TestRequest);
		const fetchMock = vi.fn().mockResolvedValue({
			status: 200,
			json: () => Promise.resolve({ ok: true })
		});
		vi.stubGlobal('fetch', fetchMock);

		await fetchData({
			url: '/service/users/data',
			method: FETCH_METHODS.GET,
			skipAuth: true
		});

		const request = fetchMock.mock.calls[0][0] as TestRequest;
		expect(request.headers.get('traceparent')).toMatch(TRACEPARENT);
	});
});
