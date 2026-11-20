// @vitest-environment oriso-jsdom
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { apiEnquiryAcceptance } from './apiEnquiryAcceptance';
import { apiAcceptAnonymousEnquiry } from './apiAcceptAnonymousEnquiry';
import { apiSessionAssign } from './apiSessionAssign';
import { apiCheckEnquiryPermission, apiSendEnquiry } from './apiSendEnquiry';
import { apiPostAdditionalEnquiry } from './apiPostAdditionalEnquiry';
import { redeemInviteLink } from './apiRedeemInviteLink';
import { FETCH_ERRORS } from './fetchData';

const logout = vi.hoisted(() => vi.fn());
vi.mock('../components/logout/logout', () => ({ logout }));
vi.mock('../components/auth/auth', () => ({ isPublicAuthRoute: () => false }));
vi.mock('../utils/appConfig', () => ({
	appConfig: { urls: { toLogin: '/login' } }
}));

class TestRequest {
	constructor(
		public url: string,
		public init?: RequestInit
	) {}
}

beforeEach(() => vi.stubGlobal('Request', TestRequest));
afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const entryActions = [
	['registered acceptance', () => apiEnquiryAcceptance(42)],
	['anonymous acceptance', () => apiAcceptAnonymousEnquiry(42)],
	['assignment', () => apiSessionAssign(42, 'consultant')],
	['first enquiry', () => apiSendEnquiry(42, '$event')],
	['new request', () => apiPostAdditionalEnquiry(1, 2, '12345', 3)],
	['anonymous invitation', () => redeemInviteLink('synthetic-invite')],
	['preflight', () => apiCheckEnquiryPermission(42)]
] as const;

describe('AVV failures at counselling HTTP entry points', () => {
	it.each(entryActions)(
		'%s preserves the confirmed restriction for explanation',
		async (_, action) => {
			const response = new Response('', {
				status: 403,
				headers: { 'X-Reason': 'DPA_NEW_COUNSELLING_NOT_ALLOWED' }
			});
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
			await expect(action()).rejects.toBe(response);
		}
	);

	it.each(entryActions)(
		'%s preserves a temporary verification failure for retry',
		async (_, action) => {
			const response = new Response('', {
				status: 502,
				headers: { 'X-Reason': 'DPA_POLICY_UNAVAILABLE' }
			});
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
			await expect(action()).rejects.toBe(response);
		}
	);

	it.each([...entryActions.slice(0, 4), entryActions[6]])(
		'%s retains the existing401 login recovery',
		async (_, action) => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(new Response('', { status: 401 }))
			);
			await expect(action()).rejects.toMatchObject({
				message: FETCH_ERRORS.UNAUTHORIZED
			});
			expect(logout).toHaveBeenCalledOnce();
		}
	);

	it('keeps the existing enquiry-conflict contract', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('', { status: 409 }))
		);
		await expect(apiEnquiryAcceptance(42)).rejects.toThrow(
			FETCH_ERRORS.CONFLICT
		);
	});

	it('keeps ordinary invitation failures as their existing errors', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					new Response('Invitation expired', { status: 410 })
				)
		);
		await expect(redeemInviteLink('synthetic-invite')).rejects.toThrow(
			'Invitation expired'
		);
	});
});

/*
 * UserService#1646: the new-request dialog explains a refusal by its status,
 * so a plain 400 must reach it as the Response, not as a bare CATCH_ALL error.
 */
describe('new request refusals keep their HTTP status', () => {
	it.each([400, 403, 500])(
		'rejects a %s with the response',
		async (status) => {
			const response = new Response('', { status });
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
			await expect(
				apiPostAdditionalEnquiry(1, 2, '12345', 3)
			).rejects.toBe(response);
		}
	);
});
