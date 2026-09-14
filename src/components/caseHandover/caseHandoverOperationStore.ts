import type { CaseHandoverStatus } from '../../api/apiCaseHandover';

export type CaseHandoverOperationKind = 'PULL' | 'PUSH' | 'BATCH';

export interface CaseHandoverOperationIntent {
	actorId: string;
	sessionId: number;
	kind: CaseHandoverOperationKind;
	expectedOwnershipRevision: number;
	reasonCode: string;
	explanation: string;
	targetConsultantId?: string;
}

export interface StoredCaseHandoverOperation
	extends CaseHandoverOperationIntent {
	operationId: string;
	status?: CaseHandoverStatus;
}

const MAX_OPERATIONS = 50;
const operations = new Map<string, StoredCaseHandoverOperation>();
let activeActorId: string | null = null;

const keyFor = ({
	actorId,
	sessionId,
	kind
}: Pick<
	CaseHandoverOperationIntent,
	'actorId' | 'sessionId' | 'kind'
>): string => `${actorId}:${kind}:${sessionId}`;

const matchesIntent = (
	stored: StoredCaseHandoverOperation,
	intent: CaseHandoverOperationIntent
) =>
	stored.reasonCode === intent.reasonCode &&
	stored.explanation === intent.explanation &&
	stored.targetConsultantId === intent.targetConsultantId;

export const getOrCreateCaseHandoverOperation = (
	intent: CaseHandoverOperationIntent
): StoredCaseHandoverOperation => {
	const key = keyFor(intent);
	const existing = operations.get(key);
	if (existing && matchesIntent(existing, intent)) {
		return existing;
	}

	const operation = { ...intent, operationId: crypto.randomUUID() };
	operations.delete(key);
	operations.set(key, operation);
	while (operations.size > MAX_OPERATIONS) {
		const oldestKey = operations.keys().next().value as string | undefined;
		if (!oldestKey) break;
		operations.delete(oldestKey);
	}
	return operation;
};

export const clearCaseHandoverOperation = (
	identity: Pick<
		CaseHandoverOperationIntent,
		'actorId' | 'sessionId' | 'kind'
	>
) => operations.delete(keyFor(identity));

export const clearCaseHandoverOperationIfMatches = (
	identity: Pick<
		CaseHandoverOperationIntent,
		'actorId' | 'sessionId' | 'kind'
	>,
	operationId: string
) => {
	const key = keyFor(identity);
	if (operations.get(key)?.operationId !== operationId) return false;
	return operations.delete(key);
};

export const getCaseHandoverOperation = (
	identity: Pick<
		CaseHandoverOperationIntent,
		'actorId' | 'sessionId' | 'kind'
	>
) => operations.get(keyFor(identity));

export const recordCaseHandoverOperationStatus = (
	identity: Pick<
		CaseHandoverOperationIntent,
		'actorId' | 'sessionId' | 'kind'
	>,
	operationId: string,
	status: CaseHandoverStatus
) => {
	const operation = operations.get(keyFor(identity));
	if (operation?.operationId === operationId) operation.status = status;
};

export const clearCaseHandoverActorOperations = (actorId: string) => {
	for (const [key, operation] of operations) {
		if (operation.actorId === actorId) operations.delete(key);
	}
};

export const activateCaseHandoverActor = (actorId: string) => {
	if (activeActorId && activeActorId !== actorId) {
		clearCaseHandoverActorOperations(activeActorId);
	}
	activeActorId = actorId;
};

export const resetCaseHandoverOperationStoreForTests = () => {
	operations.clear();
	activeActorId = null;
};
