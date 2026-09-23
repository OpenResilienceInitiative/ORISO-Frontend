import { TFunction } from 'i18next';
import { CaseHandoverReason } from '../../api/apiCaseHandover';

/** The four neutral handover reasons (PLAN E1: no health reference). */
export const CASE_HANDOVER_REASON_CODES = [
	'PLANNED_ABSENCE',
	'UNPLANNED_ABSENCE',
	'ASSIGNMENT_ENDED',
	'ADVICE_REQUESTED'
] as const;

export type CaseHandoverReasonCode =
	(typeof CASE_HANDOVER_REASON_CODES)[number];

const KNOWN_CODES = new Set<string>(CASE_HANDOVER_REASON_CODES);

// Pre-PLAN-E1 codes. Unmigrated tenants still send them, and their server
// labels read as health statements, so they must never reach the screen.
const RETIRED_CODES = new Set<string>([
	'COUNSELLOR_IS_ILL',
	'COUNSELLOR_ON_HOLIDAY',
	'OTHER_EMERGENCY',
	'COUNSELLOR_LEFT',
	'COUNSELLOR_ASKED_FOR_ADVICE'
]);

export const isRetiredCaseHandoverReasonCode = (code?: string): boolean =>
	Boolean(code) && RETIRED_CODES.has(code);

export const isKnownCaseHandoverReasonCode = (
	code?: string
): code is CaseHandoverReasonCode => Boolean(code) && KNOWN_CODES.has(code);

/**
 * Reason label in the viewer's language. The server label is one fixed
 * language, so it is only the fallback for codes the catalogue does not know.
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
	if (isRetiredCaseHandoverReasonCode(code)) {
		// Checked before the fallback, which would show the health wording.
		return translate('caseHandover.reason.retired');
	}
	return serverLabel ?? code;
};

export const caseHandoverReasonLabelOf = (
	translate: TFunction,
	reason: Pick<CaseHandoverReason, 'code' | 'label'>
): string => caseHandoverReasonLabel(translate, reason.code, reason.label);

/**
 * Label for the counsellor's own reason picker. Retired codes keep their
 * server wording here: dev still serves only those, and one shared neutral
 * label would leave identical choices.
 */
export const caseHandoverReasonOptionLabel = (
	translate: TFunction,
	reason: Pick<CaseHandoverReason, 'code' | 'label'>
): string =>
	isKnownCaseHandoverReasonCode(reason.code)
		? translate(`caseHandover.reason.${reason.code}`)
		: reason.label || reason.code;
