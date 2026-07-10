interface GroupChatAuthorizationSession {
	consultant?: { id?: string };
	item?: { moderators?: string[] };
}

interface GroupChatAuthorizationUser {
	userId?: string;
}

export const isGroupChatOwner = (
	activeSession: GroupChatAuthorizationSession,
	userData?: GroupChatAuthorizationUser
) => {
	if (activeSession.consultant?.id && userData?.userId) {
		return activeSession.consultant.id === userData.userId;
	} else {
		return false;
	}
};

export const canModerateGroupChat = (
	activeSession: GroupChatAuthorizationSession,
	userData?: GroupChatAuthorizationUser
): boolean =>
	Boolean(
		userData?.userId &&
			(isGroupChatOwner(activeSession, userData) ||
				activeSession.item?.moderators?.includes(userData.userId))
	);

interface GroupChatJoinViewOptions {
	isGroup: boolean;
	active?: boolean;
	subscribed?: boolean;
	isBanned: boolean;
}

export const shouldShowGroupChatJoinView = ({
	isGroup,
	active,
	subscribed,
	isBanned
}: GroupChatJoinViewOptions): boolean =>
	isGroup && (!active || !subscribed || isBanned);
