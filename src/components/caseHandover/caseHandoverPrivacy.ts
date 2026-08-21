import { AUTHORITIES } from '../../globalState/helpers/stateHelpers';

interface CaseHandoverInternalDetails {
	reasonLabel?: string | null;
	explanation?: string | null;
}

/**
 * Legacy Matrix events may still contain staff-only case-handover metadata.
 * Fail closed for every viewer who does not have an explicit staff authority.
 */
export const getVisibleCaseHandoverInternalDetailsForViewer = (
	grantedAuthorities: readonly string[] | undefined,
	details: CaseHandoverInternalDetails
): CaseHandoverInternalDetails => {
	if (!grantedAuthorities?.includes(AUTHORITIES.CONSULTANT_DEFAULT)) {
		return {};
	}

	return {
		...(details.reasonLabel ? { reasonLabel: details.reasonLabel } : {}),
		...(details.explanation ? { explanation: details.explanation } : {})
	};
};
