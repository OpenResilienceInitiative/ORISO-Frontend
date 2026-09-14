import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiCreateCaseHandoverOffer,
	apiDecideCaseHandoverRecipient,
	apiGetCaseHandoverRequestStatus,
	apiRequestCaseHandoverAccess,
	apiRequestCaseHandoverBatchAccess
} from './apiCaseHandover';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		sessionBase: 'https://api.test/service/users/sessions',
		caseHandoverBatch: 'https://api.test/service/users/case-handover/batch'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_METHODS: { GET: 'GET', POST: 'POST' },
	FETCH_ERRORS: {
		BAD_REQUEST: 'BAD_REQUEST',
		CONFLICT: 'CONFLICT',
		FORBIDDEN: 'FORBIDDEN',
		NO_MATCH: 'NO_MATCH'
	},
	fetchData: vi.fn()
}));

describe('apiCaseHandover mutation contracts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(fetchData).mockResolvedValue({});
	});

	it('serializes the authoritative ownership revision and stable PULL operation identity', async () => {
		await apiRequestCaseHandoverAccess(
			41,
			'COUNSELLOR_IS_ILL',
			'Cover needed',
			7,
			'4f0e98b6-264c-4e0a-879d-4898d1ddc0d1'
		);

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.test/service/users/sessions/41/case-handover',
			method: 'POST',
			bodyData: JSON.stringify({
				reasonCode: 'COUNSELLOR_IS_ILL',
				explanation: 'Cover needed',
				expectedOwnershipRevision: 7,
				operationId: '4f0e98b6-264c-4e0a-879d-4898d1ddc0d1'
			}),
			responseHandling: ['BAD_REQUEST', 'FORBIDDEN', 'CONFLICT']
		});
	});

	it('serializes one revision and operation identity per batch session', async () => {
		await apiRequestCaseHandoverBatchAccess(
			[
				{
					sessionId: 41,
					expectedOwnershipRevision: 7,
					operationId: '4f0e98b6-264c-4e0a-879d-4898d1ddc0d1'
				},
				{
					sessionId: 42,
					expectedOwnershipRevision: 3,
					operationId: 'f1c5aaef-b8fc-41ee-8d51-01d4218d188e'
				}
			],
			'OTHER_EMERGENCY',
			'Cover needed'
		);

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.test/service/users/case-handover/batch',
			method: 'POST',
			bodyData: JSON.stringify({
				reasonCode: 'OTHER_EMERGENCY',
				explanation: 'Cover needed',
				operations: [
					{
						sessionId: 41,
						expectedOwnershipRevision: 7,
						operationId: '4f0e98b6-264c-4e0a-879d-4898d1ddc0d1'
					},
					{
						sessionId: 42,
						expectedOwnershipRevision: 3,
						operationId: 'f1c5aaef-b8fc-41ee-8d51-01d4218d188e'
					}
				]
			}),
			responseHandling: ['BAD_REQUEST', 'FORBIDDEN', 'CONFLICT']
		});
	});

	it('creates a recipient offer with the approved request contract', async () => {
		await apiCreateCaseHandoverOffer(41, {
			targetConsultantId: 'recipient-1',
			reasonCode: 'OTHER_EMERGENCY',
			expectedOwnershipRevision: 7,
			operationId: '4f0e98b6-264c-4e0a-879d-4898d1ddc0d1'
		});

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.test/service/users/sessions/41/case-handover/offers',
			method: 'POST',
			bodyData: JSON.stringify({
				targetConsultantId: 'recipient-1',
				reasonCode: 'OTHER_EMERGENCY',
				expectedOwnershipRevision: 7,
				operationId: '4f0e98b6-264c-4e0a-879d-4898d1ddc0d1'
			}),
			responseHandling: ['BAD_REQUEST', 'FORBIDDEN', 'CONFLICT']
		});
	});

	it('loads and decides the exact scoped request identity', async () => {
		await apiGetCaseHandoverRequestStatus(41, 501);
		await apiDecideCaseHandoverRecipient(41, 501, false);

		expect(fetchData).toHaveBeenNthCalledWith(1, {
			url: 'https://api.test/service/users/sessions/41/case-handover/501',
			method: 'GET',
			responseHandling: ['FORBIDDEN', 'NO_MATCH']
		});
		expect(fetchData).toHaveBeenNthCalledWith(2, {
			url: 'https://api.test/service/users/sessions/41/case-handover/501/recipient-decision',
			method: 'POST',
			bodyData: JSON.stringify({ approved: false }),
			responseHandling: ['BAD_REQUEST', 'FORBIDDEN', 'CONFLICT']
		});
	});
});
