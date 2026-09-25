// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiDecideCaseHandoverClientConsent,
	apiReclaimCaseHandover,
	apiRequestCaseHandoverAccess,
	apiRequestCaseHandoverBatchAccess
} from './apiCaseHandover';

vi.mock('../components/error/errorHandling', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../components/error/errorHandling')
	>()),
	redirectToErrorPage: vi.fn()
}));
vi.mock('../components/logout/logout', () => ({ logout: vi.fn() }));
vi.mock('../utils/appConfig', () => ({
	appConfig: { urls: { toLogin: '/login' } }
}));

/**
 * fetchData parses JSON only for GET unless FETCH_SUCCESS.CONTENT is set; a
 * POST without it resolves the raw Response, and every caller read undefined.
 */
describe('case handover POST calls resolve the parsed body', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'Request',
			class {
				constructor(
					public url: string,
					public init?: RequestInit
				) {}
			}
		);
	});
	afterEach(() => vi.unstubAllGlobals());

	it.each([
		['reclaim', () => apiReclaimCaseHandover(5), 200],
		[
			'request access',
			() => apiRequestCaseHandoverAccess(5, 'COUNSELLOR_IS_ILL', 'cover'),
			201
		],
		[
			'batch request',
			() =>
				apiRequestCaseHandoverBatchAccess(
					[5],
					'COUNSELLOR_IS_ILL',
					'cover'
				),
			201
		],
		[
			'client consent',
			() => apiDecideCaseHandoverClientConsent(5, 9, true),
			200
		]
	])('%s', async (_name, call, status) => {
		const body = { sessionId: 5, status: 'GRANTED', canViewContent: true };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ status, json: async () => body })
		);

		await expect(call()).resolves.toEqual(body);
	});
});
