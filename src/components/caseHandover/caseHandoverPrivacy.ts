interface CaseHandoverInternalDetails {
	reasonLabel?: string | null;
	explanation?: string | null;
}

/**
 * Legacy Matrix events may still contain staff-only case-handover metadata.
 * Fail closed for every viewer who does not have an explicit staff authority.
 */
export const getVisibleCaseHandoverInternalDetails = (
	canViewInternalDetails: boolean,
	details: CaseHandoverInternalDetails
): CaseHandoverInternalDetails => {
	if (!canViewInternalDetails) {
		return {};
	}

	return {
		...(details.reasonLabel ? { reasonLabel: details.reasonLabel } : {}),
		...(details.explanation ? { explanation: details.explanation } : {})
	};
};
