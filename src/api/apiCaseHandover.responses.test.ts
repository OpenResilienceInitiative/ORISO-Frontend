// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiCreateCaseHandoverOffer,
	apiDecideCaseHandoverClientConsent,
	apiDecideCaseHandoverRecipient,
	apiRequestCaseHandoverAccess,
	apiRequestCaseHandoverBatchAccess,
	CaseHandoverStatus
} from './apiCaseHandover';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		sessionBase: 'https://api.test/service/users/sessions',
		caseHandoverBatch: 'https://api.test/service/users/case-handover/batch'
	}
}));

// jsdom's AbortSignal is incompatible with Node's Request constructor.
// Replace only request construction; exercise the real fetchData response path.
class TestRequest {
	constructor(
		readonly url: string,
		readonly init: RequestInit
	) {}
}

const operation = {
	sessionId: 41,
	expectedOwnershipRevision: 7,
	operationId: '4f0e98b6-264c-4e0a-879d-4898d1ddc0d1'
};
const granted: CaseHandoverStatus = {
	sessionId: 41,
	requestId: 501,
	status: 'GRANTED',
	canViewContent: true,
	clientConsentRequired: false
};
const pending: CaseHandoverStatus = {
	...granted,
	status: 'PENDING_CLIENT_CONSENT',
	canViewContent: false,
	clientConsentRequired: true
};
const mutations = [
	{
		name: 'access request',
		call: () =>
			apiRequestCaseHandoverAccess(
				41,
				'COUNSELLOR_IS_ILL',
				'Cover needed',
				7,
				operation.operationId
			)
	},
	{
		name: 'recipient offer',
		call: () =>
			apiCreateCaseHandoverOffer(41, {
				targetConsultantId: 'recipient-1',
				reasonCode: 'COUNSELLOR_IS_ILL',
				expectedOwnershipRevision: 7,
				operationId: operation.operationId
			})
	},
	{
		name: 'recipient decision',
		call: () => apiDecideCaseHandoverRecipient(41, 501, true)
	},
	{
		name: 'client consent decision',
		call: () => apiDecideCaseHandoverClientConsent(41, 501, true)
	}
];

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('Request', TestRequest);
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('case handover JSON responses through real fetchData', () => {
	for (const mutation of mutations) {
		it.each([200, 201])(
			`${mutation.name} returns the granted status from HTTP %s`,
			async (status) => {
				vi.stubGlobal(
					'fetch',
					vi
						.fn()
						.mockResolvedValue(
							new Response(JSON.stringify(granted), { status })
						)
				);
				await expect(mutation.call()).resolves.toEqual(granted);
			}
		);
		it(`${mutation.name} preserves pending consent without granting content`, async () => {
			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					.mockResolvedValue(
						new Response(JSON.stringify(pending), { status: 201 })
					)
			);
			await expect(mutation.call()).resolves.toEqual(pending);
		});
		it(`${mutation.name} still rejects forbidden access`, async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(new Response(null, { status: 403 }))
			);
			await expect(mutation.call()).rejects.toThrow('FORBIDDEN');
		});
	}
	it('returns parsed per-case results for a batch', async () => {
		const results = [
			{
				sessionId: 41,
				operationId: operation.operationId,
				success: true,
				status: granted
			}
		];
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					new Response(JSON.stringify(results), { status: 200 })
				)
		);
		await expect(
			apiRequestCaseHandoverBatchAccess(
				[operation],
				'COUNSELLOR_IS_ILL',
				'Cover needed'
			)
		).resolves.toEqual(results);
	});
});
