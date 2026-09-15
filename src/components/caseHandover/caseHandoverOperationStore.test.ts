import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearCaseHandoverActorOperations,
	getOrCreateCaseHandoverOperation,
	resetCaseHandoverOperationStoreForTests
} from './caseHandoverOperationStore';

describe('caseHandoverOperationStore', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		resetCaseHandoverOperationStoreForTests();
	});

	it('keeps one operation identity for an unchanged unknown-outcome retry across remounts', () => {
		const randomUUID = vi
			.spyOn(crypto, 'randomUUID')
			.mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
			.mockReturnValueOnce('00000000-0000-4000-8000-000000000002');
		const input = {
			actorId: 'consultant-1',
			sessionId: 41,
			kind: 'PULL' as const,
			expectedOwnershipRevision: 7,
			reasonCode: 'OTHER_EMERGENCY',
			explanation: 'Cover now'
		};

		const first = getOrCreateCaseHandoverOperation(input);
		const afterRemount = getOrCreateCaseHandoverOperation(input);

		expect(afterRemount).toEqual(first);
		expect(randomUUID).toHaveBeenCalledTimes(1);
	});

	it('keeps the frozen operation period when only a later status revision changes', () => {
		vi.spyOn(crypto, 'randomUUID')
			.mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
			.mockReturnValueOnce('00000000-0000-4000-8000-000000000002');
		const base = {
			actorId: 'consultant-1',
			sessionId: 41,
			kind: 'PULL' as const,
			expectedOwnershipRevision: 7,
			reasonCode: 'OTHER_EMERGENCY',
			explanation: 'Cover now'
		};

		const first = getOrCreateCaseHandoverOperation(base);
		const changedRevision = getOrCreateCaseHandoverOperation({
			...base,
			expectedOwnershipRevision: 8
		});
		const changedReason = getOrCreateCaseHandoverOperation({
			...base,
			reasonCode: 'COUNSELLOR_IS_ILL'
		});

		expect(changedRevision).toEqual(first);
		expect(changedReason.operationId).not.toBe(first.operationId);
	});

	it('creates a new PUSH operation when the selected recipient changes', () => {
		const base = {
			actorId: 'consultant-1',
			sessionId: 41,
			kind: 'PUSH' as const,
			expectedOwnershipRevision: 7,
			reasonCode: 'OTHER_EMERGENCY',
			explanation: '',
			targetConsultantId: 'recipient-1'
		};
		const first = getOrCreateCaseHandoverOperation(base);
		const changedRecipient = getOrCreateCaseHandoverOperation({
			...base,
			targetConsultantId: 'recipient-2'
		});

		expect(changedRecipient.operationId).not.toBe(first.operationId);
	});

	it('isolates actors and clears only the account that signed out', () => {
		const firstActor = getOrCreateCaseHandoverOperation({
			actorId: 'consultant-1',
			sessionId: 41,
			kind: 'PULL',
			expectedOwnershipRevision: 7,
			reasonCode: 'OTHER_EMERGENCY',
			explanation: 'Cover now'
		});
		const secondActor = getOrCreateCaseHandoverOperation({
			actorId: 'consultant-2',
			sessionId: 41,
			kind: 'PULL',
			expectedOwnershipRevision: 7,
			reasonCode: 'OTHER_EMERGENCY',
			explanation: 'Cover now'
		});

		clearCaseHandoverActorOperations('consultant-1');

		expect(
			getOrCreateCaseHandoverOperation({
				actorId: 'consultant-1',
				sessionId: 41,
				kind: 'PULL',
				expectedOwnershipRevision: 7,
				reasonCode: 'OTHER_EMERGENCY',
				explanation: 'Cover now'
			}).operationId
		).not.toBe(firstActor.operationId);
		expect(
			getOrCreateCaseHandoverOperation({
				actorId: 'consultant-2',
				sessionId: 41,
				kind: 'PULL',
				expectedOwnershipRevision: 7,
				reasonCode: 'OTHER_EMERGENCY',
				explanation: 'Cover now'
			}).operationId
		).toBe(secondActor.operationId);
	});
});
