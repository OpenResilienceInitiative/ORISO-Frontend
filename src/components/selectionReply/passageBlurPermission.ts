import { canModerateGroupChat } from '../groupChat/groupChatHelpers';

export interface PassageBlurPermissionInput {
	activeSession: {
		isGroup?: boolean;
		consultant?: { id?: string };
		item?: { moderators?: string[] };
	};
	userData?: { userId?: string };
	/** The viewer holds the counsellor role. */
	isConsultant: boolean;
	/** Supervision is read-only: supervisors never blur. */
	isSupervisorView: boolean;
	/** A case-handover co-access view is read-only too. */
	isReadOnly?: boolean;
}

/**
 * Who may blur a passage and lift a blur (product owner, 12 Nov 2026): the
 * moderators of the room. In a group (including self-help groups) that is
 * the owner and the named moderators; in a one-to-one chat (also live chat)
 * the assigned counsellor. Advice seekers, supervisors and read-only views
 * never can. Every moderator may lift any blur, so nothing stays stuck when
 * the person who blurred it leaves.
 */
export const canBlurPassages = ({
	activeSession,
	userData,
	isConsultant,
	isSupervisorView,
	isReadOnly = false
}: PassageBlurPermissionInput): boolean => {
	if (isSupervisorView || isReadOnly || !userData?.userId) {
		return false;
	}
	if (activeSession.isGroup) {
		return canModerateGroupChat(activeSession, userData);
	}
	return (
		isConsultant &&
		Boolean(activeSession.consultant?.id) &&
		activeSession.consultant?.id === userData.userId
	);
};
