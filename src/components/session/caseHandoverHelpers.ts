import { AUTHORITIES, hasUserAuthority } from '../../globalState';
import type {
	CaseHandoverExplanationLevel,
	CaseHandoverReason,
	CaseHandoverStatus
} from '../../api/apiCaseHandover';
import {
	STATUS_ENQUIRY,
	UserDataInterface
} from '../../globalState/interfaces';
import {
	SESSION_LIST_TAB,
	SESSION_LIST_TAB_ARCHIVE,
	SESSION_LIST_TYPES
} from './sessionHelpers';
import {
	isActiveSupervisorOf,
	SupervisionMarker
} from '../sessionsListItem/supervisionListState';

export const CASE_HANDOVER_PENDING_STATUSES = [
	'PENDING',
	'PENDING_CLIENT_CONSENT'
];

export const CASE_HANDOVER_DENIED_STATUSES = [
	'DENIED',
	'CLIENT_CONSENT_DECLINED'
];

interface CaseHandoverSessionInput {
	item?: {
		status?: number | string;
		/** ADR-008 marker — an active supervisor already has read access. */
		supervision?: SupervisionMarker | null;
		/** Teamberatung (FE#2494 *4): colleagues read, only the owner writes. */
		isTeamSession?: boolean;
		agencyId?: number;
		/** FE#2494 *4: the model the case was created under; absent until stamped. */
		caseSharingModel?: string | null;
	};
	consultant?: {
		id?: string | number;
	};
	isEmptyEnquiry?: boolean;
	isGroup?: boolean;
	isSession?: boolean;
}

interface CaseHandoverUserInput {
	userId?: string | number;
	grantedAuthorities?: readonly string[];
	agencies?: readonly CaseSharingCentreInput[];
}

interface CaseHandoverCandidateInput {
	activeSession: CaseHandoverSessionInput | null;
	userData: CaseHandoverUserInput | null;
	type: SESSION_LIST_TYPES;
	sessionListTab?: SESSION_LIST_TAB | string | null;
}

export const isCaseHandoverAccessControlled = ({
	activeSession,
	userData,
	type
}: Omit<CaseHandoverCandidateInput, 'sessionListTab'>): boolean => {
	if (!activeSession || !activeSession.item || !userData) {
		return false;
	}
	if (
		hasUserAuthority(
			AUTHORITIES.ASKER_DEFAULT,
			userData as UserDataInterface
		)
	) {
		return false;
	}
	if (type !== SESSION_LIST_TYPES.MY_SESSION) {
		return false;
	}
	if (activeSession.isGroup || !activeSession.isSession) {
		return false;
	}
	if (
		activeSession.isEmptyEnquiry ||
		activeSession.item.status === STATUS_ENQUIRY
	) {
		return false;
	}
	// An active supervisor is a non-owner by definition, but already reads the
	// room (ADR-008) — offering "request access" to them is the bug this guards.
	if (isActiveSupervisorOf(activeSession, userData.userId)) {
		return false;
	}
	const ownerId = activeSession.consultant?.id;
	return (
		Boolean(ownerId) && String(ownerId) !== String(userData.userId || '')
	);
};

export const isCaseHandoverCandidate = ({
	activeSession,
	userData,
	type,
	sessionListTab
}: CaseHandoverCandidateInput): boolean => {
	if (sessionListTab === SESSION_LIST_TAB_ARCHIVE) {
		return false;
	}
	return isCaseHandoverAccessControlled({ activeSession, userData, type });
};

/**
 * FE#2494 *4: whether the case is a Teamberatung case. The case keeps the
 * model it was created under (`caseSharingModel`); only a case created before
 * the model was stamped falls back to its team flag.
 */
const isTeamCase = (
	item: CaseHandoverSessionInput['item'] | null | undefined
): boolean =>
	item?.caseSharingModel
		? item.caseSharingModel === 'TEAM_COUNSELLING'
		: Boolean(item?.isTeamSession);

/**
 * FE#2494 *4 (decision d): in Teamberatung a colleague of the department reads
 * an accepted case without a request but never writes; only the assigned
 * counsellor does. The server enforces it with the Matrix reader power level.
 * A later switch of the centre changes nothing here (Frank, 2026-11-25).
 */
export const isTeamCounsellingReader = (
	input: Omit<CaseHandoverCandidateInput, 'sessionListTab'>
): boolean =>
	isTeamCase(input.activeSession?.item) &&
	isCaseHandoverAccessControlled(input);

/** A counsellor's centre; `teamAgency` follows the centre's current case sharing choice. */
export interface CaseSharingCentreInput {
	id?: number;
	teamAgency?: boolean;
}

/**
 * FE#2494 *4: "Beratung übergeben" (header "+", session menu, profile) is
 * offered only in a case created under case handover, whatever the centre
 * chose since; the server decides by the same stamp. A case created before the
 * stamp existed falls back to the centre's current choice: not in a team case
 * of a centre in Teamberatung, otherwise offered and decided by the server.
 */
export const offersCaseHandoverIn = (
	activeSession: Pick<CaseHandoverSessionInput, 'item'> | null | undefined,
	centres?: readonly CaseSharingCentreInput[] | null
): boolean => {
	const item = activeSession?.item;
	if (item?.caseSharingModel) {
		return item.caseSharingModel === 'CASE_HANDOVER';
	}
	if (!item?.isTeamSession) {
		return true;
	}
	const centre = centres?.find((candidate) => candidate.id === item.agencyId);
	return centre?.teamAgency !== true;
};

/**
 * The people search hint for the counsellor's centres: Teamberatung, case
 * handover, or both for a counsellor in both kinds of centre.
 */
export const peopleSearchHintKeys = (
	centres?: readonly CaseSharingCentreInput[] | null
): string[] => {
	const list = centres ?? [];
	const team = list.some((centre) => centre.teamAgency === true);
	const handover =
		list.length === 0 || list.some((centre) => !centre.teamAgency);
	return [
		...(handover ? ['sessionList.toolbar.search.handoverPeopleHint'] : []),
		...(team ? ['sessionList.toolbar.search.teamPeopleHint'] : [])
	];
};

export const isCaseHandoverPending = (status?: string | null): boolean =>
	Boolean(status && CASE_HANDOVER_PENDING_STATUSES.includes(status));

export const isCaseHandoverDenied = (status?: string | null): boolean =>
	Boolean(status && CASE_HANDOVER_DENIED_STATUSES.includes(status));

/** #200: an "advice needed" grant lets the colleague read, never write. */
export const isCaseHandoverCoAccess = (
	status?: CaseHandoverStatus | null
): boolean =>
	Boolean(
		status?.canViewContent &&
			status.accessType === 'CO_ACCESS' &&
			['GRANTED', 'GRANTED_PENDING_CLIENT_OPTOUT'].includes(status.status)
	);

/** The explanation level of a reason; absent or unknown reads as OFF (FE#2040). */
export const caseHandoverExplanationLevel = (
	reason?: Pick<CaseHandoverReason, 'explanationLevel'> | null
): CaseHandoverExplanationLevel =>
	reason?.explanationLevel === 'OPTIONAL' ||
	reason?.explanationLevel === 'REQUIRED'
		? reason.explanationLevel
		: 'OFF';

/** A reason is chosen and, when its level is REQUIRED, an explanation was typed. */
export const isCaseHandoverRequestComplete = (
	reason: Pick<CaseHandoverReason, 'explanationLevel'> | null | undefined,
	explanation: string
): boolean =>
	Boolean(reason) &&
	(caseHandoverExplanationLevel(reason) !== 'REQUIRED' ||
		explanation.trim().length > 0);

/** The text sent for a reason: nothing when its level is OFF. */
export const caseHandoverExplanationToSend = (
	reason: Pick<CaseHandoverReason, 'explanationLevel'> | null | undefined,
	explanation: string
): string =>
	caseHandoverExplanationLevel(reason) === 'OFF' ? '' : explanation.trim();
