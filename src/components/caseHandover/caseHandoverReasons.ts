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

// Pre-PLAN-E1 codes read as health statements; never show their server
// wording. Same successor mapping as UserService CaseHandoverReasonCodes.
const RETIRED_TO_NEUTRAL: Record<string, CaseHandoverReasonCode> = {
	COUNSELLOR_ASKED_FOR_ADVICE: 'ADVICE_REQUESTED',
	COUNSELLOR_ON_HOLIDAY: 'PLANNED_ABSENCE',
	COUNSELLOR_IS_ILL: 'UNPLANNED_ABSENCE',
	COUNSELLOR_LEFT: 'ASSIGNMENT_ENDED'
};

// Retired without successor.
const RETIRED_CODES = new Set<string>([
	...Object.keys(RETIRED_TO_NEUTRAL),
	'OTHER_EMERGENCY'
]);

// Seeded English labels of the retired codes; legacy chat notices carry only these.
const RETIRED_LABEL_TO_NEUTRAL: Record<string, CaseHandoverReasonCode> = {
	'counsellor asked for advice': 'ADVICE_REQUESTED',
	'counsellor is on holiday': 'PLANNED_ABSENCE',
	'counsellor is ill': 'UNPLANNED_ABSENCE',
	'counsellor does not work here anymore': 'ASSIGNMENT_ENDED',
	"counsellor doesn't work here anymore": 'ASSIGNMENT_ENDED'
};

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
	if (RETIRED_TO_NEUTRAL[code]) {
		return translate(`caseHandover.reason.${RETIRED_TO_NEUTRAL[code]}`);
	}
	if (isRetiredCaseHandoverReasonCode(code)) {
		// Checked before the fallback, which would show the server wording.
		return translate('caseHandover.reason.retired');
	}
	return serverLabel ?? code;
};

export const caseHandoverReasonLabelOf = (
	translate: TFunction,
	reason: Pick<CaseHandoverReason, 'code' | 'label'>
): string => caseHandoverReasonLabel(translate, reason.code, reason.label);

/** Label for the counsellor's own reason picker; never blank. */
export const caseHandoverReasonOptionLabel = (
	translate: TFunction,
	reason: Pick<CaseHandoverReason, 'code' | 'label'>
): string =>
	caseHandoverReasonLabel(
		translate,
		reason.code,
		reason.label || reason.code
	);

/** Label from a legacy chat notice (no code): retired wording becomes neutral. */
export const neutralLegacyReasonLabel = (
	translate: TFunction,
	label: string
): string => {
	const successor = RETIRED_LABEL_TO_NEUTRAL[label.trim().toLowerCase()];
	return successor ? translate(`caseHandover.reason.${successor}`) : label;
};
