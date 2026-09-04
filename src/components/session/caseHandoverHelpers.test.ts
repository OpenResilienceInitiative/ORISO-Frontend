import { describe, expect, it, vi } from 'vitest';
import { STATUS_ENQUIRY, STATUS_ACTIVE } from '../../globalState/interfaces';
import {
	isCaseHandoverAccessControlled,
	isCaseHandoverCandidate,
	isCaseHandoverDenied,
	isCaseHandoverPending
} from './caseHandoverHelpers';
import type { SESSION_LIST_TYPES as SessionListType } from './sessionHelpers';

vi.mock('../../globalState', () => ({
	AUTHORITIES: {
		ASKER_DEFAULT: 'AUTHORIZATION_USER_DEFAULT',
		CONSULTANT_DEFAULT: 'AUTHORIZATION_CONSULTANT_DEFAULT'
	},
	hasUserAuthority: (authority: string, userData: any) =>
		userData?.grantedAuthorities?.includes(authority)
}));

vi.mock('./sessionHelpers', () => ({
	SESSION_LIST_TAB_ARCHIVE: 'archive',
	SESSION_LIST_TYPES: {
		ENQUIRY: 'ENQUIRY',
		MY_SESSION: 'MY_SESSION'
	}
}));

const AUTHORITIES = {
	ASKER_DEFAULT: 'AUTHORIZATION_USER_DEFAULT',
	CONSULTANT_DEFAULT: 'AUTHORIZATION_CONSULTANT_DEFAULT'
};

const SESSION_LIST_TAB_ARCHIVE = 'archive';
const SESSION_LIST_TYPES = {
	MY_SESSION: 'MY_SESSION'
};
const MY_SESSION_TYPE = SESSION_LIST_TYPES.MY_SESSION as SessionListType;

const baseSession = {
	item: { id: 123, status: STATUS_ACTIVE },
	consultant: { id: 'original-counsellor' },
	isEmptyEnquiry: false,
	isGroup: false,
	isSession: true
};

const consultantUser = {
	userId: 'receiving-counsellor',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT]
};

describe('caseHandoverHelpers', () => {
	it('marks another counsellor owned my-session as handover candidate', () => {
		expect(
			isCaseHandoverCandidate({
				activeSession: baseSession,
				userData: consultantUser,
				type: MY_SESSION_TYPE
			})
		).toBe(true);
	});

	it('is not access-controlled for the active supervisor of the session (ADR-008 marker)', () => {
		const supervisedByMe = {
			...baseSession,
			item: {
				...baseSession.item,
				supervision: {
					supervisedByMe: true,
					supervisorConsultantIds: [consultantUser.userId],
					supervisorDisplayNames: ['Receiving Counsellor']
				}
			}
		};
		expect(
			isCaseHandoverAccessControlled({
				activeSession: supervisedByMe,
				userData: consultantUser,
				type: MY_SESSION_TYPE
			})
		).toBe(false);
		expect(
			isCaseHandoverCandidate({
				activeSession: supervisedByMe,
				userData: consultantUser,
				type: MY_SESSION_TYPE
			})
		).toBe(false);
	});

	it('stays access-controlled when someone else supervises the session', () => {
		const supervisedByOther = {
			...baseSession,
			item: {
				...baseSession.item,
				supervision: {
					supervisedByMe: false,
					supervisorConsultantIds: ['another-supervisor'],
					supervisorDisplayNames: ['Another Supervisor']
				}
			}
		};
		expect(
			isCaseHandoverAccessControlled({
				activeSession: supervisedByOther,
				userData: consultantUser,
				type: MY_SESSION_TYPE
			})
		).toBe(true);
	});

	it('keeps archive sessions access-controlled even when batch selection is disabled', () => {
		expect(
			isCaseHandoverAccessControlled({
				activeSession: baseSession,
				userData: consultantUser,
				type: MY_SESSION_TYPE
			})
		).toBe(true);
		expect(
			isCaseHandoverCandidate({
				activeSession: baseSession,
				userData: consultantUser,
				type: MY_SESSION_TYPE,
				sessionListTab: SESSION_LIST_TAB_ARCHIVE
			})
		).toBe(false);
	});

	it('keeps asker, archive, enquiry, group, and own sessions out of handover candidates', () => {
		const commonInput = {
			activeSession: baseSession,
			userData: consultantUser,
			type: MY_SESSION_TYPE
		};

		expect(
			isCaseHandoverCandidate({
				...commonInput,
				userData: {
					userId: 'asker',
					grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
				}
			})
		).toBe(false);
		expect(
			isCaseHandoverCandidate({
				...commonInput,
				sessionListTab: SESSION_LIST_TAB_ARCHIVE
			})
		).toBe(false);
		expect(
			isCaseHandoverCandidate({
				...commonInput,
				activeSession: {
					...baseSession,
					item: { ...baseSession.item, status: STATUS_ENQUIRY }
				}
			})
		).toBe(false);
		expect(
			isCaseHandoverCandidate({
				...commonInput,
				activeSession: { ...baseSession, isGroup: true }
			})
		).toBe(false);
		expect(
			isCaseHandoverCandidate({
				...commonInput,
				activeSession: {
					...baseSession,
					consultant: { id: consultantUser.userId }
				}
			})
		).toBe(false);
	});

	it('keeps missing, asker, non-my-session, enquiry, group, and own sessions out of access control', () => {
		const commonInput = {
			activeSession: baseSession,
			userData: consultantUser,
			type: MY_SESSION_TYPE
		};

		expect(
			isCaseHandoverAccessControlled({
				...commonInput,
				activeSession: null
			})
		).toBe(false);
		expect(
			isCaseHandoverAccessControlled({
				...commonInput,
				userData: null
			})
		).toBe(false);
		expect(
			isCaseHandoverAccessControlled({
				...commonInput,
				userData: {
					userId: 'asker',
					grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
				}
			})
		).toBe(false);
		expect(
			isCaseHandoverAccessControlled({
				...commonInput,
				type: 'ENQUIRY' as SessionListType
			})
		).toBe(false);
		expect(
			isCaseHandoverAccessControlled({
				...commonInput,
				activeSession: {
					...baseSession,
					item: { ...baseSession.item, status: STATUS_ENQUIRY }
				}
			})
		).toBe(false);
		expect(
			isCaseHandoverAccessControlled({
				...commonInput,
				activeSession: { ...baseSession, isGroup: true }
			})
		).toBe(false);
		expect(
			isCaseHandoverAccessControlled({
				...commonInput,
				activeSession: {
					...baseSession,
					consultant: { id: consultantUser.userId }
				}
			})
		).toBe(false);
	});

	it('groups pending and denied statuses for list and gate display', () => {
		expect(isCaseHandoverPending('PENDING')).toBe(true);
		expect(isCaseHandoverPending('PENDING_CLIENT_CONSENT')).toBe(true);
		expect(isCaseHandoverPending('GRANTED')).toBe(false);

		expect(isCaseHandoverDenied('DENIED')).toBe(true);
		expect(isCaseHandoverDenied('CLIENT_CONSENT_DECLINED')).toBe(true);
		expect(isCaseHandoverDenied('NOT_REQUESTED')).toBe(false);
	});
});
