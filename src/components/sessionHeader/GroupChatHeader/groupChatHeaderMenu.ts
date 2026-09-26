interface GroupChatMenuState {
	isActive: boolean;
	isJoinGroupChatView: boolean;
}

export const shouldShowGroupChatMenu = ({
	isActive,
	isJoinGroupChatView
}: GroupChatMenuState) => isActive && !isJoinGroupChatView;

interface WaitingRoomMenuState extends GroupChatMenuState {
	isConsultant: boolean;
	isPhone: boolean;
}

/**
 * The waiting room's "Chat-Info" link is desktop-only, so on a phone the
 * session menu (⋮) takes its place, as it does in every other chat (#1499).
 */
export const shouldShowWaitingRoomPhoneMenu = ({
	isActive,
	isJoinGroupChatView,
	isConsultant,
	isPhone
}: WaitingRoomMenuState) =>
	isPhone && isConsultant && (!isActive || isJoinGroupChatView);
