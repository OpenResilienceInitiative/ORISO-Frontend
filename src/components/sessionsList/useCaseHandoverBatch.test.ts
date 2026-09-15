// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiGetCaseHandoverStatus,
	apiRequestCaseHandoverBatchAccess
} from '../../api/apiCaseHandover';
import { resetCaseHandoverOperationStoreForTests } from '../caseHandover/caseHandoverOperationStore';
import { useCaseHandoverBatch } from './useCaseHandoverBatch';

vi.mock('../../api/apiCaseHandover', () => ({
	apiGetCaseHandoverStatus: vi.fn(),
	apiRequestCaseHandoverBatchAccess: vi.fn()
}));

vi.mock('lottie-react', () => ({ default: () => null }));

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

describe('useCaseHandoverBatch', () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.mocked(apiGetCaseHandoverStatus).mockReset();
		vi.mocked(apiRequestCaseHandoverBatchAccess).mockReset();
		resetCaseHandoverOperationStoreForTests();
		vi.mocked(apiGetCaseHandoverStatus).mockImplementation(
			async (sessionId) => ({
				sessionId,
				status: 'NOT_REQUESTED',
				canViewContent: true,
				clientConsentRequired: false,
				ownershipRevision: sessionId + 10
			})
		);
	});

	it('reads each authoritative revision and submits distinct stable operations', async () => {
		vi.mocked(apiRequestCaseHandoverBatchAccess).mockImplementation(
			async (operations) =>
				operations.map((operation) => ({
					sessionId: operation.sessionId,
					operationId: operation.operationId,
					success: operation.sessionId === 1,
					...(operation.sessionId === 1 && {
						status: {
							sessionId: operation.sessionId,
							status: 'GRANTED' as const,
							canViewContent: true,
							clientConsentRequired: false
						}
					}),
					...(operation.sessionId === 2 && { error: 'CONFLICT' })
				}))
		);
		const { result } = renderHook(() =>
			useCaseHandoverBatch({ actorId: 'c1' })
		);

		await act(async () => {
			await result.current.submit([1, 2], 'OTHER_EMERGENCY', 'Cover');
		});

		expect(apiGetCaseHandoverStatus).toHaveBeenCalledTimes(2);
		const [operations] = vi.mocked(apiRequestCaseHandoverBatchAccess).mock
			.calls[0];
		expect(operations).toEqual([
			expect.objectContaining({
				sessionId: 1,
				expectedOwnershipRevision: 11
			}),
			expect.objectContaining({
				sessionId: 2,
				expectedOwnershipRevision: 12
			})
		]);
		expect(operations[0].operationId).not.toBe(operations[1].operationId);
		expect(result.current.outcome).toEqual({
			granted: 1,
			pending: 0,
			denied: 0,
			failed: 1,
			unresolvedSessionIds: [2]
		});
	});

	it('blocks duplicate clicks and ignores a late result after close', async () => {
		const response = deferred<any[]>();
		vi.mocked(apiRequestCaseHandoverBatchAccess).mockReturnValue(
			response.promise
		);
		const { result } = renderHook(() =>
			useCaseHandoverBatch({ actorId: 'c1' })
		);

		let first!: Promise<void>;
		act(() => {
			first = result.current.submit([1], 'OTHER_EMERGENCY', 'Cover');
			void result.current.submit([1], 'OTHER_EMERGENCY', 'Cover');
		});
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(apiRequestCaseHandoverBatchAccess).toHaveBeenCalledTimes(1);

		act(() => result.current.close([1]));
		await act(async () => {
			response.resolve([
				{ sessionId: 1, operationId: 'ignored', success: true }
			]);
			await first;
		});
		expect(result.current.outcome).toBeNull();
	});

	it('keeps an unresolved operation identity when the review closes and reopens', async () => {
		const response = deferred<any[]>();
		vi.mocked(apiRequestCaseHandoverBatchAccess)
			.mockReturnValueOnce(response.promise)
			.mockImplementationOnce(async (operations) =>
				operations.map((operation) => ({ ...operation, success: true }))
			);
		const { result } = renderHook(() =>
			useCaseHandoverBatch({ actorId: 'c1' })
		);

		let first!: Promise<void>;
		act(() => {
			first = result.current.submit([1], 'OTHER_EMERGENCY', 'Cover');
		});
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
		const firstOperationId = vi.mocked(apiRequestCaseHandoverBatchAccess)
			.mock.calls[0][0][0].operationId;

		act(() => result.current.close([1]));
		await act(async () => {
			response.resolve([
				{ sessionId: 1, operationId: firstOperationId, success: true }
			]);
			await first;
		});
		await act(async () => {
			await result.current.submit([1], 'OTHER_EMERGENCY', 'Cover');
		});

		expect(
			vi.mocked(apiRequestCaseHandoverBatchAccess).mock.calls[1][0][0]
				.operationId
		).toBe(firstOperationId);
	});

	it('restarts only the sessions with a definite item failure', async () => {
		vi.mocked(apiRequestCaseHandoverBatchAccess)
			.mockImplementationOnce(async (operations) =>
				operations.map((operation) => ({
					sessionId: operation.sessionId,
					operationId: operation.operationId,
					success: operation.sessionId === 1,
					...(operation.sessionId === 2 && { error: 'FAILED' })
				}))
			)
			.mockImplementationOnce(async (operations) =>
				operations.map((operation) => ({
					sessionId: operation.sessionId,
					operationId: operation.operationId,
					success: true
				}))
			);
		const { result } = renderHook(() =>
			useCaseHandoverBatch({ actorId: 'c1' })
		);

		await act(async () => {
			await result.current.submit([1, 2], 'OTHER_EMERGENCY', 'Cover');
		});
		const firstOperations = vi.mocked(apiRequestCaseHandoverBatchAccess)
			.mock.calls[0][0];
		await act(async () => {
			await result.current.submit([2], 'OTHER_EMERGENCY', 'Cover');
		});
		const retryOperations = vi.mocked(apiRequestCaseHandoverBatchAccess)
			.mock.calls[1][0];

		expect(retryOperations).toHaveLength(1);
		expect(retryOperations[0].operationId).not.toBe(
			firstOperations[1].operationId
		);
	});

	it('replays the frozen revision and key after an unknown result despite a newer status revision', async () => {
		vi.mocked(apiRequestCaseHandoverBatchAccess)
			.mockRejectedValueOnce(new Error('NETWORK'))
			.mockImplementationOnce(async (operations) =>
				operations.map((operation) => ({
					...operation,
					success: true,
					status: {
						sessionId: operation.sessionId,
						status: 'GRANTED',
						canViewContent: true,
						clientConsentRequired: false
					}
				}))
			);
		const { result } = renderHook(() =>
			useCaseHandoverBatch({ actorId: 'c1' })
		);

		await act(async () => {
			await result.current.submit([1], 'OTHER_EMERGENCY', 'Cover');
		});
		const firstOperation = vi.mocked(apiRequestCaseHandoverBatchAccess).mock
			.calls[0][0][0];
		vi.mocked(apiGetCaseHandoverStatus).mockResolvedValue({
			sessionId: 1,
			status: 'NOT_REQUESTED',
			canViewContent: false,
			clientConsentRequired: false,
			ownershipRevision: 99
		});
		await act(async () => {
			await result.current.submit([1], 'OTHER_EMERGENCY', 'Cover');
		});
		const replay = vi.mocked(apiRequestCaseHandoverBatchAccess).mock
			.calls[1][0][0];

		expect(replay).toEqual(firstOperation);
	});

	it('does not start batch transport when a deferred status read outlives unmount or actor change', async () => {
		const afterUnmount = deferred<any>();
		vi.mocked(apiGetCaseHandoverStatus).mockReturnValueOnce(
			afterUnmount.promise
		);
		const first = renderHook(() => useCaseHandoverBatch({ actorId: 'c1' }));
		let unmountedSubmit!: Promise<void>;
		act(() => {
			unmountedSubmit = first.result.current.submit(
				[1],
				'OTHER_EMERGENCY',
				'Cover'
			);
		});
		first.unmount();
		await act(async () => {
			afterUnmount.resolve({
				sessionId: 1,
				status: 'NOT_REQUESTED',
				canViewContent: false,
				clientConsentRequired: false,
				ownershipRevision: 11
			});
			await unmountedSubmit;
		});

		const afterActorChange = deferred<any>();
		vi.mocked(apiGetCaseHandoverStatus).mockReturnValueOnce(
			afterActorChange.promise
		);
		const second = renderHook(
			({ actorId }) => useCaseHandoverBatch({ actorId }),
			{ initialProps: { actorId: 'c1' } }
		);
		let changedActorSubmit!: Promise<void>;
		act(() => {
			changedActorSubmit = second.result.current.submit(
				[2],
				'OTHER_EMERGENCY',
				'Cover'
			);
		});
		second.rerender({ actorId: 'c2' });
		await act(async () => {
			afterActorChange.resolve({
				sessionId: 2,
				status: 'NOT_REQUESTED',
				canViewContent: false,
				clientConsentRequired: false,
				ownershipRevision: 12
			});
			await changedActorSubmit;
		});

		expect(apiRequestCaseHandoverBatchAccess).not.toHaveBeenCalled();
	});

	it('keeps a nested denial selected and reports grants, pending and denial separately', async () => {
		vi.mocked(apiRequestCaseHandoverBatchAccess).mockImplementation(
			async (operations) =>
				operations.map((operation) => ({
					...operation,
					success: true,
					status: {
						sessionId: operation.sessionId,
						status:
							operation.sessionId === 1
								? 'GRANTED'
								: operation.sessionId === 2
									? 'PENDING_CLIENT_CONSENT'
									: 'DENIED',
						canViewContent: operation.sessionId === 1,
						clientConsentRequired: operation.sessionId === 2
					}
				}))
		);
		const { result } = renderHook(() =>
			useCaseHandoverBatch({ actorId: 'c1' })
		);

		await act(async () => {
			await result.current.submit([1, 2, 3], 'OTHER_EMERGENCY', 'Cover');
		});

		expect(result.current.outcome).toEqual({
			granted: 1,
			pending: 1,
			denied: 1,
			failed: 0,
			unresolvedSessionIds: [3]
		});
	});

	it('starts a fresh operation after a definite backend-shaped item failure', async () => {
		vi.mocked(apiRequestCaseHandoverBatchAccess)
			.mockImplementationOnce(async (operations) => [
				{
					sessionId: operations[0].sessionId,
					operationId: operations[0].operationId,
					success: false,
					error: 'Case ownership changed; refresh before handover'
				}
			])
			.mockImplementationOnce(async (operations) => [
				{
					...operations[0],
					success: true,
					status: {
						sessionId: operations[0].sessionId,
						status: 'GRANTED',
						canViewContent: true,
						clientConsentRequired: false
					}
				}
			]);
		const { result } = renderHook(() =>
			useCaseHandoverBatch({ actorId: 'c1' })
		);

		await act(async () => {
			await result.current.submit([1], 'OTHER_EMERGENCY', 'Cover');
		});
		const conflicted = vi.mocked(apiRequestCaseHandoverBatchAccess).mock
			.calls[0][0][0];
		vi.mocked(apiGetCaseHandoverStatus).mockResolvedValue({
			sessionId: 1,
			status: 'NOT_REQUESTED',
			canViewContent: false,
			clientConsentRequired: false,
			ownershipRevision: 99
		});
		await act(async () => {
			await result.current.submit([1], 'OTHER_EMERGENCY', 'Cover');
		});
		const restarted = vi.mocked(apiRequestCaseHandoverBatchAccess).mock
			.calls[1][0][0];

		expect(restarted.operationId).not.toBe(conflicted.operationId);
		expect(restarted.expectedOwnershipRevision).toBe(99);
	});
});
