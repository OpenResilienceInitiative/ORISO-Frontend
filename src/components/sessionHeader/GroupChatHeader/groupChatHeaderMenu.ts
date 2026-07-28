interface GroupChatMenuState {
	isActive: boolean;
	isJoinGroupChatView: boolean;
}

export const shouldShowGroupChatMenu = ({
	isActive,
	isJoinGroupChatView
}: GroupChatMenuState) => isActive && !isJoinGroupChatView;
