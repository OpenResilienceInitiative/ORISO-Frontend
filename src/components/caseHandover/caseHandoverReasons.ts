import { TFunction } from 'i18next';
import { CaseHandoverReason } from '../../api/apiCaseHandover';

/**
 * The handover reasons after the KDG/Art. 9 clean-up (PLAN E1). The old codes
 * `COUNSELLOR_IS_ILL`, `COUNSELLOR_ON_HOLIDAY`, `OTHER_EMERGENCY`,
 * `COUNSELLOR_LEFT` and `COUNSELLOR_ASKED_FOR_ADVICE` carried a health
 * reference into the client's chat and into the audit log; they are migrated
 * away in the UserService and must not appear in this frontend any more.
 */
export const CASE_HANDOVER_REASON_CODES = [
	'PLANNED_ABSENCE',
	'UNPLANNED_ABSENCE',
	'ASSIGNMENT_ENDED',
	'ADVICE_REQUESTED'
] as const;

export type CaseHandoverReasonCode =
	(typeof CASE_HANDOVER_REASON_CODES)[number];

const KNOWN_CODES = new Set<string>(CASE_HANDOVER_REASON_CODES);

export const isKnownCaseHandoverReasonCode = (
	code?: string
): code is CaseHandoverReasonCode => Boolean(code) && KNOWN_CODES.has(code);

/**
 * Localised reason label. The backend still sends a `label`, but it is a single
 * server-side string — the counsellor would read it in the server's language,
 * not in hers (FE#1187 job 2). So the catalogue wins wherever we know the code,
 * and the server label is the fallback for a code the frontend does not know
 * yet (a tenant-specific one, say). The fallback is never a hardcoded English
 * string: an unknown code shows what the server called it, or the code itself.
 */
export const caseHandoverReasonLabel = (
	translate: TFunction,
	code?: string,
	serverLabel?: string
): string => {
	if (!code) {
		return serverLabel ?? '';
	}
	if (isKnownCaseHandoverReasonCode(code)) {
		return translate(`caseHandover.reason.${code}`);
	}
	return serverLabel ?? code;
};

export const caseHandoverReasonLabelOf = (
	translate: TFunction,
	reason: Pick<CaseHandoverReason, 'code' | 'label'>
): string => caseHandoverReasonLabel(translate, reason.code, reason.label);
