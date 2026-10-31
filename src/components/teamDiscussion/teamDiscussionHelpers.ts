/**
 * FE#514 / ADR-016 — pure scope rule for the team discussion channel, kept
 * free of React/Matrix imports so it stays unit-testable.
 */

export interface TeamDiscussionAvailabilityInput {
	isConsultant: boolean;
	isEnquiry: boolean;
	isGroup: boolean;
	isAnonymous: boolean;
	featureEnabled: boolean;
	hasExistingDiscussion: boolean;
}

/**
 * ADR-016 scope: the panel exists for consultants on Agency-Counselling
 * enquiries only (Live Chat is anonymous/ephemeral and excluded; groups have
 * no request area). After acceptance the enquiry flag drops — the panel then
 * only shows when an (archived) discussion already exists (read-only archive
 * access), never to start a new one.
 */
export const isTeamDiscussionAvailable = ({
	isConsultant,
	isEnquiry,
	isGroup,
	isAnonymous,
	featureEnabled,
	hasExistingDiscussion
}: TeamDiscussionAvailabilityInput): boolean => {
	if (!featureEnabled || !isConsultant || isGroup || isAnonymous) {
		return false;
	}
	return isEnquiry || hasExistingDiscussion;
};
