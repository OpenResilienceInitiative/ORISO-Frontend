// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { apiRejectEnquiry } from './apiRejectEnquiry';
import { FETCH_ERRORS } from './fetchData';
vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		sessionBase: 'https://synthetic.oriso.test/service/users/sessions'
	}
}));
const transport = (status: number) => {
	vi.stubGlobal(
		'Request',
		class {
			constructor(
				public url: string,
				public init: RequestInit
			) {}
		}
	);
	const fetch = vi.fn().mockResolvedValue({ status });
	vi.stubGlobal('fetch', fetch);
	return fetch;
};
afterEach(() => vi.unstubAllGlobals());
it('posts the dedicated rejection command without a reason or message body and accepts204', async () => {
	const fetch = transport(204);
	await expect(apiRejectEnquiry(4711)).resolves.toBeUndefined();
	expect(fetch).toHaveBeenCalledTimes(1);
	const request = fetch.mock.calls[0][0];
	expect(request.url).toBe(
		'https://synthetic.oriso.test/service/users/sessions/4711/rejection'
	);
	expect(request.init.method).toBe('POST');
	expect(request.init.body).toBeUndefined();
});
it.each([
	[403, FETCH_ERRORS.FORBIDDEN],
	[404, FETCH_ERRORS.NO_MATCH],
	[409, FETCH_ERRORS.CONFLICT],
	[503, FETCH_ERRORS.CATCH_ALL],
	[500, FETCH_ERRORS.CATCH_ALL]
])(
	'propagates HTTP%s so the caller resyncs instead of claiming success',
	async (status, code) => {
		const fetch = transport(Number(status));
		await expect(apiRejectEnquiry(4711)).rejects.toThrow(String(code));
		expect(fetch).toHaveBeenCalledTimes(1);
	}
);
it.each([200, 201])(
	'does not treat an unexpected HTTP%s as verified rejection closure',
	async (status) => {
		transport(status);
		await expect(apiRejectEnquiry(4711)).rejects.toThrow(
			FETCH_ERRORS.CATCH_ALL
		);
	}
);
