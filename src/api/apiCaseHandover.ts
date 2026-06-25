import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

export type CaseHandoverStatusValue =
	| 'NOT_REQUESTED'
	| 'PENDING'
	| 'PENDING_CLIENT_CONSENT'
	| 'GRANTED'
	| 'DENIED'
	| 'CLIENT_CONSENT_DECLINED'
	| string;

export interface CaseHandoverReason {
	code: string;
	label: string;
	clientConsentRequired: boolean;
	accessAllowed?: boolean;
	policyAuthority?: string;
}

export interface CaseHandoverStatus {
	requestId?: number;
	sessionId: number;
	status: CaseHandoverStatusValue;
	canViewContent: boolean;
	reasonCode?: string;
	reasonLabel?: string;
	clientConsentRequired: boolean;
	policyAuthority?: string;
	auditOutcome?: string;
	createdAt?: string;
	resolvedAt?: string;
}

export interface CaseHandoverBatchResult {
	sessionId: number;
	success: boolean;
	status?: CaseHandoverStatus;
	error?: string;
}

export const apiGetCaseHandoverReasons = async (): Promise<
	CaseHandoverReason[]
> =>
	fetchData({
		url: endpoints.caseHandoverReasons,
		method: FETCH_METHODS.GET
	});

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
	explanation: string
): Promise<CaseHandoverStatus> =>
	fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/case-handover`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ reasonCode, explanation }),
		responseHandling: [FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.FORBIDDEN]
	});

export const apiRequestCaseHandoverBatchAccess = async (
	sessionIds: number[],
	reasonCode: string,
	explanation: string
): Promise<CaseHandoverBatchResult[]> =>
	fetchData({
		url: endpoints.caseHandoverBatch,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ sessionIds, reasonCode, explanation }),
		responseHandling: [FETCH_ERRORS.BAD_REQUEST, FETCH_ERRORS.FORBIDDEN]
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
