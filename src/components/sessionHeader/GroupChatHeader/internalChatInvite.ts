/**
 * The "+" in a group chat header invites colleagues only in a running
 * internal chat, and only for counsellors who take part (ORISO-Frontend#2023).
 * UserService decides per room and person; a room that cannot take
 * newcomers answers with a refusal the dialog shows.
 */
export const canInviteToInternalChat = ({
	isInternalGroup,
	isConsultant,
	isActive,
	isJoinView
}: {
	isInternalGroup: boolean;
	isConsultant: boolean;
	isActive: boolean;
	isJoinView: boolean;
}): boolean => isInternalGroup && isConsultant && isActive && !isJoinView;
