// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
	apiGetCaseHandoverConsentPreference,
	apiSaveCaseHandoverConsentPreference
} from './apiCaseHandover';

// Keep the real fetchData response parsing. jsdom AbortSignal cannot be passed
// to Node's Request, so record the outbound HTTP request at that boundary.
class TestRequest {
	constructor(
		public url: string,
		public init: RequestInit = {}
	) {}
}
afterEach(() => vi.unstubAllGlobals());

it('returns parsed persisted JSON for PUT and an independent GET readback', async () => {
	const persisted = {
		sessionId: 42,
		alwaysAskBeforeAdditionalAccess: true
	};
	const fetch = vi.fn().mockImplementation(async (request: TestRequest) => {
		expect(request.url).toMatch(/\/42\/case-handover\/consent-preference$/);
		if (request.init.method === 'PUT') {
			expect(request.init.body).toBe(
				JSON.stringify({ alwaysAskBeforeAdditionalAccess: true })
			);
		}
		return new Response(JSON.stringify(persisted), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	});
	vi.stubGlobal('Request', TestRequest);
	vi.stubGlobal('fetch', fetch);
	await expect(
		apiSaveCaseHandoverConsentPreference(42, true)
	).resolves.toEqual(persisted);
	await expect(apiGetCaseHandoverConsentPreference(42)).resolves.toEqual(
		persisted
	);
	expect(fetch.mock.calls.map(([request]) => request.init.method)).toEqual([
		'PUT',
		'GET'
	]);
});

it('rejects forbidden saves instead of returning a successful preference', async () => {
	vi.stubGlobal('Request', TestRequest);
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue(new Response(null, { status: 403 }))
	);
	await expect(
		apiSaveCaseHandoverConsentPreference(42, true)
	).rejects.toThrow('FORBIDDEN');
});
