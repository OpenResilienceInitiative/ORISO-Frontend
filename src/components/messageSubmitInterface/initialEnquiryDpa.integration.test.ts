// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { sendEncryptedInitialEnquiry } from './messageEncryptionMode';
import { apiSendEnquiry } from '../../api/apiSendEnquiry';

class HttpRequest {
	constructor(
		public url: string,
		public init: RequestInit
	) {}
}

beforeEach(() => {
	window.localStorage.clear();
	vi.stubGlobal('Request', HttpRequest);
});
afterEach(() => {
	vi.unstubAllGlobals();
	window.localStorage.clear();
});

it.each([
	[403, 'DPA_NEW_COUNSELLING_NOT_ALLOWED'],
	[502, 'DPA_POLICY_UNAVAILABLE']
])(
	'does not emit the first encrypted event when permission returns%s',
	async (status, reason) => {
		const failure = new Response('', {
			status,
			headers: { 'X-Reason': reason }
		});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failure));
		const matrixSend = vi.fn(async () => ({ event_id: '$encrypted' }));
		await expect(
			sendEncryptedInitialEnquiry({
				sessionId: 42,
				sendEncryptedMatrixMessage: matrixSend,
				finalizeEnquiry: (event) => apiSendEnquiry(42, event)
			})
		).rejects.toBe(failure);
		expect(matrixSend).not.toHaveBeenCalled();
		expect(window.localStorage.length).toBe(0);
	}
);

it('checks permission before sending, then finalizes only the encrypted event reference', async () => {
	const requests: string[] = [];
	vi.stubGlobal('fetch', async (request: HttpRequest) => {
		const path = new URL(request.url).pathname;
		if (path.endsWith('/enquiry/permission')) {
			requests.push('permission');
			return new Response(null, {
				status: 204,
				headers: { 'Cache-Control': 'no-store' }
			});
		}
		if (path.endsWith('/enquiry/new')) {
			requests.push('finalize');
			expect(JSON.parse(request.init.body as string)).toEqual({
				message: '',
				t: 'e2e',
				matrixEventId: '$encrypted'
			});
			return Response.json({
				sessionId: 42,
				matrixRoomId: '!room:example.org'
			});
		}
		throw new Error(`Unexpected HTTP request: ${path}`);
	});
	await sendEncryptedInitialEnquiry({
		sessionId: 42,
		sendEncryptedMatrixMessage: async () => {
			requests.push('matrix');
			return { event_id: '$encrypted' };
		},
		finalizeEnquiry: (event) => apiSendEnquiry(42, event)
	});
	expect(requests).toEqual(['permission', 'matrix', 'finalize']);
});
