import { AUTHORITIES, hasUserAuthority } from '../../globalState';
import type { CaseHandoverStatus } from '../../api/apiCaseHandover';
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
 * FE#2494 *4 (decision d): in Teamberatung a colleague of the department reads
 * an accepted case without a request but never writes; only the assigned
 * counsellor does. The server enforces it with the Matrix reader power level.
 */
export const isTeamCounsellingReader = (
	input: Omit<CaseHandoverCandidateInput, 'sessionListTab'>
): boolean =>
	Boolean(input.activeSession?.item?.isTeamSession) &&
	// A centre that has switched to another model has no team readers any more.
	!isKnownNonTeamCentre(
		input.activeSession?.item?.agencyId,
		input.userData?.agencies
	) &&
	isCaseHandoverAccessControlled(input);

const isKnownNonTeamCentre = (
	agencyId: number | undefined,
	centres: readonly CaseSharingCentreInput[] | null | undefined
): boolean =>
	centres?.find((centre) => centre.id === agencyId)?.teamAgency === false;

/** A counsellor's centre; `teamAgency` follows the centre's current case sharing choice. */
export interface CaseSharingCentreInput {
	id?: number;
	teamAgency?: boolean;
}

/**
 * FE#2494 *4: a centre in Teamberatung has no case handover, so "Beratung
 * übergeben" is not offered in its team cases (header "+", session menu,
 * profile). The assigned counsellor keeps it everywhere else: in a case
 * handover centre, and in an older team case whose centre has since switched
 * to case handover. An unknown centre keeps it; the server decides.
 */
export const offersCaseHandoverIn = (
	activeSession: Pick<CaseHandoverSessionInput, 'item'> | null | undefined,
	centres?: readonly CaseSharingCentreInput[] | null
): boolean => {
	const item = activeSession?.item;
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
