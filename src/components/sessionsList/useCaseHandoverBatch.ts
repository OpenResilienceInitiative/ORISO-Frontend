import { useCallback, useEffect, useRef, useState } from 'react';
import {
	apiGetCaseHandoverStatus,
	apiRequestCaseHandoverBatchAccess,
	CaseHandoverOperation
} from '../../api/apiCaseHandover';
import {
	activateCaseHandoverActor,
	clearCaseHandoverOperation,
	clearCaseHandoverOperationIfMatches,
	getOrCreateCaseHandoverOperation
} from '../caseHandover/caseHandoverOperationStore';
import {
	isCaseHandoverDenied,
	isCaseHandoverPending
} from '../session/caseHandoverHelpers';

export interface CaseHandoverBatchOutcome {
	granted: number;
	pending: number;
	denied: number;
	failed: number;
	unresolvedSessionIds: number[];
}

export const useCaseHandoverBatch = ({ actorId }: { actorId: string }) => {
	const [submitting, setSubmitting] = useState(false);
	const [outcome, setOutcome] = useState<CaseHandoverBatchOutcome | null>(
		null
	);
	const [error, setError] = useState<unknown>();
	const generationRef = useRef(0);
	const inFlightRef = useRef(false);
	useEffect(() => {
		generationRef.current += 1;
		inFlightRef.current = false;
		setSubmitting(false);
		setOutcome(null);
		setError(undefined);
		activateCaseHandoverActor(actorId);
		return () => {
			generationRef.current += 1;
			inFlightRef.current = false;
		};
	}, [actorId]);

	const submit = useCallback(
		async (
			sessionIds: number[],
			reasonCode: string,
			explanation: string
		) => {
			if (inFlightRef.current) return;
			const generation = generationRef.current;
			inFlightRef.current = true;
			setSubmitting(true);
			setError(undefined);

			try {
				const statuses = await Promise.all(
					sessionIds.map((sessionId) =>
						apiGetCaseHandoverStatus(sessionId)
					)
				);
				if (generation !== generationRef.current) return;

				const storedOperations = statuses.map((status, index) => {
					const sessionId = sessionIds[index];
					if (
						status.sessionId !== sessionId ||
						typeof status.ownershipRevision !== 'number'
					) {
						throw new Error('INVALID_CASE_HANDOVER_STATUS');
					}
					return getOrCreateCaseHandoverOperation({
						actorId,
						sessionId,
						kind: 'BATCH',
						expectedOwnershipRevision: status.ownershipRevision,
						reasonCode,
						explanation
					});
				});
				const operations: CaseHandoverOperation[] =
					storedOperations.map(
						({
							sessionId,
							expectedOwnershipRevision,
							operationId
						}) => ({
							sessionId,
							expectedOwnershipRevision,
							operationId
						})
					);
				const results = await apiRequestCaseHandoverBatchAccess(
					operations,
					reasonCode,
					explanation
				);
				if (generation !== generationRef.current) return;

				const grantedIds = new Set<number>();
				const pendingIds = new Set<number>();
				const deniedIds = new Set<number>();
				for (const operation of storedOperations) {
					const matchingResult = results?.find(
						(result) =>
							result.sessionId === operation.sessionId &&
							result.operationId === operation.operationId
					);
					const resultStatus = matchingResult?.status;
					if (matchingResult && !matchingResult.success) {
						clearCaseHandoverOperationIfMatches(
							operation,
							operation.operationId
						);
						continue;
					}
					if (
						!matchingResult?.success ||
						!resultStatus ||
						resultStatus.sessionId !== operation.sessionId
					) {
						continue;
					}
					if (isCaseHandoverDenied(resultStatus.status)) {
						deniedIds.add(operation.sessionId);
						continue;
					}
					if (isCaseHandoverPending(resultStatus.status)) {
						pendingIds.add(operation.sessionId);
						clearCaseHandoverOperation(operation);
						continue;
					}
					if (
						resultStatus.status === 'GRANTED' ||
						resultStatus.status === 'GRANTED_PENDING_CLIENT_OPTOUT'
					) {
						grantedIds.add(operation.sessionId);
						clearCaseHandoverOperation(operation);
					}
				}
				const unresolvedSessionIds = sessionIds.filter(
					(sessionId) =>
						!grantedIds.has(sessionId) && !pendingIds.has(sessionId)
				);
				setOutcome({
					granted: grantedIds.size,
					pending: pendingIds.size,
					denied: deniedIds.size,
					failed: unresolvedSessionIds.length - deniedIds.size,
					unresolvedSessionIds
				});
			} catch (submissionError) {
				if (generation === generationRef.current) {
					setError(submissionError);
				}
			} finally {
				if (generation === generationRef.current) {
					inFlightRef.current = false;
					setSubmitting(false);
				}
			}
		},
		[actorId]
	);

	const close = useCallback(
		(sessionIds: number[], discardIntent = false) => {
			generationRef.current += 1;
			inFlightRef.current = false;
			setSubmitting(false);
			setOutcome(null);
			setError(undefined);
			if (discardIntent) {
				for (const sessionId of sessionIds) {
					clearCaseHandoverOperation({
						actorId,
						sessionId,
						kind: 'BATCH'
					});
				}
			}
		},
		[actorId]
	);

	return { close, error, outcome, submit, submitting };
};
