import { endpoints } from '../resources/scripts/endpoints';
import { ListItemsResponseInterface } from '../globalState/interfaces';
import {
	fetchData,
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS
} from './fetchData';

export type CaseHandoverStatusValue =
	| 'NOT_REQUESTED'
	| 'PENDING'
	| 'PENDING_CLIENT_CONSENT'
	| 'GRANTED_PENDING_CLIENT_OPTOUT'
	| 'GRANTED'
	| 'DENIED'
	| 'CLIENT_CONSENT_DECLINED'
	// Push direction (PLAN chapter 3): the case owner offers the case to a
	// colleague, who has to accept before the usual grant path runs.
	| 'PENDING_RECIPIENT_ACCEPT'
	| 'RECIPIENT_DECLINED'
	| 'WITHDRAWN'
	| 'EXPIRED'
	| (string & {});

export type CaseHandoverDirection = 'PULL' | 'PUSH';

export type CaseHandoverOfferBox = 'incoming' | 'outgoing';

export type CaseHandoverConsentValue = 'OPT_IN' | 'OPT_OUT' | 'NONE';

export type CaseHandoverAccessType = 'CO_ACCESS' | 'TAKEOVER';

export interface CaseHandoverReason {
	accessType?: CaseHandoverAccessType;
	code: string;
	label: string;
	clientConsent?: CaseHandoverConsentValue;
	clientConsentRequired: boolean;
	accessAllowed?: boolean;
	maxAccessDurationMinutes?: number;
	policyAuthority?: string;
}

export interface CaseHandoverStatus {
	requestId?: number;
	sessionId: number;
	status: CaseHandoverStatusValue;
	canViewContent: boolean;
	accessType?: CaseHandoverAccessType;
	maxAccessDurationMinutes?: number;
	expiresAt?: string;
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

// ---------------------------------------------------------------------------
// Push direction — "Fall abgeben"
//
// The shapes below mirror the UserService contract of record,
// `api/userservice-case-handover.yaml` (the handover paths cannot live in
// `api/userservice.yaml` without an ambiguous handler mapping, so they are not
// part of the generated client).
// ---------------------------------------------------------------------------

export interface CaseHandoverColleague {
	consultantId: string;
	username?: string;
	/** Internal display name with server-side fallback (#996). */
	displayName?: string;
	firstName?: string;
	lastName?: string;
	absent?: boolean;
}

export interface CaseHandoverColleagueList {
	colleagues: CaseHandoverColleague[];
	total: number;
	offset: number;
	count: number;
}

/**
 * The name to print for a colleague. The server fills `displayName` for every
 * row it can; the rest is a defensive ladder so a picker row is never blank.
 */
export const caseHandoverColleagueName = (
	colleague: CaseHandoverColleague
): string =>
	colleague.displayName?.trim() ||
	[colleague.firstName, colleague.lastName]
		.filter(Boolean)
		.join(' ')
		.trim() ||
	colleague.username?.trim() ||
	colleague.consultantId;

export interface CaseHandoverOffer {
	accessType?: CaseHandoverAccessType;
	/** Same value the status DTO reports as `requestId`. */
	offerId: number;
	sessionId: number;
	status: CaseHandoverStatusValue;
	direction: CaseHandoverDirection;
	reasonCode?: string;
	/** Server label; the UI prefers the localised `caseHandover.reason.<CODE>`. */
	reasonLabel?: string;
	/** Counsellor-written, staff-only. Never shown to the advice seeker. */
	explanation?: string;
	clientConsentRequired?: boolean;
	fromConsultantId?: string;
	fromConsultantName?: string;
	targetConsultantId?: string;
	targetConsultantName?: string;
	createdAt?: string;
	/** 72 hours after creation; the scheduler moves the offer to EXPIRED. */
	offerExpiresAt?: string;
	resolvedAt?: string;
}

/** Colleagues of the case's agency who may receive the case (without me). */
export const apiGetCaseHandoverColleagues = async ({
	sessionId,
	query = '',
	offset = 0,
	count = 25,
	signal
}: {
	sessionId: number;
	query?: string;
	offset?: number;
	count?: number;
	signal?: AbortSignal;
}): Promise<CaseHandoverColleagueList> => {
	const params = new URLSearchParams({
		sessionId: String(sessionId),
		query,
		offset: String(offset),
		count: String(count)
	});

	return fetchData({
		url: `${endpoints.caseHandoverColleagues}?${params.toString()}`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.FORBIDDEN, FETCH_ERRORS.NO_MATCH],
		...(signal && { signal })
	});
};

/**
 * The owner offers the case to a colleague. 409 = an offer is already open.
 *
 * `explanation` is required by the contract (staff-only note); the dialog has
 * no free-text field, so it passes the chosen reason's label.
 */
export const apiCreateCaseHandoverOffer = async ({
	sessionId,
	targetConsultantId,
	reasonCode,
	explanation
}: {
	sessionId: number;
	targetConsultantId: string;
	reasonCode: string;
	explanation: string;
}): Promise<CaseHandoverOffer> =>
	fetchData({
		url: endpoints.caseHandoverOffers,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({
			sessionId,
			targetConsultantId,
			reasonCode,
			explanation
		}),
		responseHandling: [
			FETCH_SUCCESS.CONTENT,
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.NO_MATCH
		]
	});

export const apiGetCaseHandoverOffers = async ({
	box,
	signal
}: {
	box: CaseHandoverOfferBox;
	signal?: AbortSignal;
}): Promise<CaseHandoverOffer[]> =>
	fetchData({
		url: `${endpoints.caseHandoverOffers}?box=${box}`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.FORBIDDEN],
		...(signal && { signal })
	});

/**
 * Recipient accepts. The answer is the *status* of the case, not the offer:
 * the same grant path as PULL runs, so it ends in GRANTED or, when the reason
 * policy says so, PENDING_CLIENT_CONSENT (ADR-022 — no third consent gate).
 */
export const apiAcceptCaseHandoverOffer = async (
	offerId: number
): Promise<CaseHandoverStatus> =>
	fetchData({
		url: `${endpoints.caseHandoverOffers}/${offerId}/accept`,
		method: FETCH_METHODS.POST,
		responseHandling: [
			FETCH_SUCCESS.CONTENT,
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.NO_MATCH
		]
	});

export const apiDeclineCaseHandoverOffer = async (
	offerId: number
): Promise<CaseHandoverOffer> =>
	fetchData({
		url: `${endpoints.caseHandoverOffers}/${offerId}/decline`,
		method: FETCH_METHODS.POST,
		responseHandling: [
			FETCH_SUCCESS.CONTENT,
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.NO_MATCH
		]
	});

/** The offering counsellor withdraws a still-open offer. 204, no body. */
export const apiWithdrawCaseHandoverOffer = async (
	offerId: number
): Promise<void> =>
	fetchData({
		url: `${endpoints.caseHandoverOffers}/${offerId}`,
		method: FETCH_METHODS.DELETE,
		responseHandling: [
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.NO_MATCH
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
		responseHandling: [
			FETCH_SUCCESS.CONTENT,
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.NO_MATCH
		]
	});
