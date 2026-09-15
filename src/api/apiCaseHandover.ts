import { endpoints } from '../resources/scripts/endpoints';
import { ListItemsResponseInterface } from '../globalState/interfaces';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

export type CaseHandoverStatusValue =
	| 'NOT_REQUESTED'
	| 'PENDING'
	| 'PENDING_CLIENT_CONSENT'
	| 'PENDING_RECIPIENT_ACCEPTANCE'
	| 'RECIPIENT_DECLINED'
	| 'GRANTED_PENDING_CLIENT_OPTOUT'
	| 'GRANTED'
	| 'DENIED'
	| 'CLIENT_CONSENT_DECLINED'
	| (string & {});

export type CaseHandoverConsentValue = 'OPT_IN' | 'OPT_OUT' | 'NONE';

export interface CaseHandoverReason {
	code: string;
	label: string;
	clientConsent?: CaseHandoverConsentValue;
	clientConsentRequired: boolean;
	accessAllowed?: boolean;
	policyAuthority?: string;
}

export interface CaseHandoverStatus {
	requestId?: number;
	sessionId: number;
	status: CaseHandoverStatusValue;
	canViewContent: boolean;
	direction?: 'PULL' | 'PUSH';
	initiatorConsultantId?: string;
	recipientConsultantId?: string;
	recipientDecisionAt?: string;
	expectedOwnershipRevision?: number;
	ownershipRevision?: number;
	operationId?: string;
	reasonCode?: string;
	reasonLabel?: string;
	clientConsent?: CaseHandoverConsentValue;
	clientConsentRequired: boolean;
	policyAuthority?: string;
	auditOutcome?: string;
	createdAt?: string;
	resolvedAt?: string;
}

export interface CaseHandoverBatchResult {
	sessionId: number;
	operationId: string;
	success: boolean;
	status?: CaseHandoverStatus;
	error?: string;
}

export interface CaseHandoverOperation {
	sessionId: number;
	expectedOwnershipRevision: number;
	operationId: string;
}

export interface CaseHandoverOfferInput {
	targetConsultantId: string;
	reasonCode: string;
	explanation?: string;
	expectedOwnershipRevision: number;
	operationId: string;
}

export const apiGetCaseHandoverReasons = async (): Promise<
	CaseHandoverReason[]
> =>
	fetchData({
		url: endpoints.caseHandoverReasons,
		method: FETCH_METHODS.GET
	});

export const apiGetCaseHandoverCandidates = async ({
	query,
	offset = 0,
	count = 15,
	archived = false,
	signal
}: {
	query: string;
	offset?: number;
	count?: number;
	archived?: boolean;
	signal?: AbortSignal;
}): Promise<ListItemsResponseInterface> => {
	const params = new URLSearchParams({
		query,
		offset: String(offset),
		count: String(count),
		archived: String(archived)
	});

	return fetchData({
		url: `${endpoints.caseHandoverCandidates}?${params.toString()}`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.FORBIDDEN],
		...(signal && { signal })
	});
};

export const apiGetCaseHandoverStatus = async (
	sessionId: number
): Promise<CaseHandoverStatus> =>
	fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/case-handover`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.FORBIDDEN]
	});

export const apiRequestCaseHandoverAccess = async (
	sessionId: number,
	reasonCode: string,
	explanation: string,
	expectedOwnershipRevision: number,
	operationId: string
): Promise<CaseHandoverStatus> =>
	fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/case-handover`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({
			reasonCode,
			explanation,
			expectedOwnershipRevision,
			operationId
		}),
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.CONFLICT
		]
	});

export const apiRequestCaseHandoverBatchAccess = async (
	operations: CaseHandoverOperation[],
	reasonCode: string,
	explanation: string
): Promise<CaseHandoverBatchResult[]> =>
	fetchData({
		url: endpoints.caseHandoverBatch,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ reasonCode, explanation, operations }),
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.CONFLICT
		]
	});

export const apiCreateCaseHandoverOffer = async (
	sessionId: number,
	input: CaseHandoverOfferInput
): Promise<CaseHandoverStatus> =>
	fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/case-handover/offers`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(input),
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.CONFLICT
		]
	});

/**
 * A colleague this session may actually be offered to. The server applies the
 * same predicates `createOffer` enforces — same tenant, present, inside the
 * session's department (agency AND an overlapping topic), neither the current
 * owner nor a previous one — so the picker cannot show a name the offer would
 * reject with a 403 (FE #1262).
 */
export interface CaseHandoverRecipient {
	consultantId: string;
	displayName?: string;
}

export const apiGetCaseHandoverRecipients = async (
	sessionId: number
): Promise<CaseHandoverRecipient[]> =>
	fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/case-handover/recipients`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.FORBIDDEN]
	});

export const apiGetCaseHandoverRequestStatus = async (
	sessionId: number,
	requestId: number
): Promise<CaseHandoverStatus> =>
	fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/case-handover/${requestId}`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.FORBIDDEN, FETCH_ERRORS.NO_MATCH]
	});

export const apiDecideCaseHandoverRecipient = async (
	sessionId: number,
	requestId: number,
	approved: boolean
): Promise<CaseHandoverStatus> =>
	fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/case-handover/${requestId}/recipient-decision`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ approved }),
		responseHandling: [
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.CONFLICT
		]
	});

export const apiDecideCaseHandoverClientConsent = async (
	sessionId: number,
	requestId: number,
	approved: boolean
): Promise<CaseHandoverStatus> =>
	fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/case-handover/${requestId}/client-consent`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ approved }),
		responseHandling: [FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.FORBIDDEN]
	});
