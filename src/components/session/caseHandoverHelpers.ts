import { AUTHORITIES, hasUserAuthority } from '../../globalState';
import { STATUS_ENQUIRY } from '../../globalState/interfaces';
import {
	SESSION_LIST_TAB,
	SESSION_LIST_TAB_ARCHIVE,
	SESSION_LIST_TYPES
} from './sessionHelpers';

export const CASE_HANDOVER_PENDING_STATUSES = [
	'PENDING',
	'PENDING_CLIENT_CONSENT'
];

export const CASE_HANDOVER_DENIED_STATUSES = [
	'DENIED',
	'CLIENT_CONSENT_DECLINED'
];

interface CaseHandoverCandidateInput {
	activeSession: any;
	userData: any;
	type: SESSION_LIST_TYPES;
	sessionListTab?: SESSION_LIST_TAB | string | null;
}

export const isCaseHandoverCandidate = ({
	activeSession,
	userData,
	type,
	sessionListTab
}: CaseHandoverCandidateInput): boolean => {
	if (!activeSession || !activeSession.item || !userData) {
		return false;
	}
	if (hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)) {
		return false;
	}
	if (type !== SESSION_LIST_TYPES.MY_SESSION) {
		return false;
	}
	if (sessionListTab === SESSION_LIST_TAB_ARCHIVE) {
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
	const ownerId = activeSession.consultant?.id;
	return (
		Boolean(ownerId) && String(ownerId) !== String(userData.userId || '')
	);
};

export const isCaseHandoverPending = (status?: string | null): boolean =>
	Boolean(status && CASE_HANDOVER_PENDING_STATUSES.includes(status));

export const isCaseHandoverDenied = (status?: string | null): boolean =>
	Boolean(status && CASE_HANDOVER_DENIED_STATUSES.includes(status));
