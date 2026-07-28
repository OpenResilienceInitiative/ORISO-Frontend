import { ReactComponent as OpenEnvelopeIcon } from '../../resources/img/icons/envelope-open.svg';
import { ReactComponent as GroupChatIcon } from '../../resources/img/icons/speech-bubble.svg';
import { ReactComponent as NewEnquiryIcon } from '../../resources/img/icons/plus.svg';
import { ReactComponent as ClosedEnvelopeIcon } from '../../resources/img/icons/envelope.svg';
import { isMatrixRoomIdHeuristic } from '../../utils/matrixRoomUtils';

export const LIST_ICONS = {
	IS_READ: 'IS_READ',
	IS_UNREAD: 'IS_UNREAD',
	IS_GROUP_CHAT: 'IS_GROUP_CHAT',
	IS_NEW_ENQUIRY: 'IS_NEW_ENQUIRY'
};

export const getSessionsListItemIcon = (variant: string) => {
	switch (variant) {
		case LIST_ICONS.IS_READ:
			return OpenEnvelopeIcon;
		case LIST_ICONS.IS_GROUP_CHAT:
			return GroupChatIcon;
		case LIST_ICONS.IS_NEW_ENQUIRY:
			return NewEnquiryIcon;
		default:
			return ClosedEnvelopeIcon;
	}
};

interface SessionNavigationPathOptions {
	listPath: string;
	sessionId: number | string;
	groupId?: string;
	rid?: string;
	isGroup: boolean;
	isAsker: boolean;
	isEmptyEnquiry: boolean;
	isLiveChat?: boolean;
	tabSuffix: string;
}

export const getSessionNavigationPath = ({
	listPath,
	sessionId,
	groupId,
	rid,
	isGroup,
	isAsker,
	isEmptyEnquiry,
	isLiveChat = false,
	tabSuffix
}: SessionNavigationPathOptions) => {
	const roomId = groupId ?? rid;

	if (isGroup && roomId) {
		return `${listPath}/${encodeURIComponent(roomId)}/${sessionId}${tabSuffix}`;
	}
	if (isGroup) {
		// A materialized room may be absent for a future Series occurrence.
		// Resolve the Series through the supported session-id route instead of
		// falling into asker-enquiry routing.
		return `${listPath}/session/${sessionId}${tabSuffix}`;
	}

	// #774: a consultant opening an answered live chat must use the Matrix
	// room-id route — the same lookup the accept flow uses successfully
	// (AcceptAssign.redirectToAcceptedSession). The default /session/:id route
	// resolves through a different backend lookup that returns nothing for an
	// answered live chat, leaving the conversation blank. Scoped to the
	// consultant open path; the asker keeps its existing routing.
	if (isLiveChat && !isAsker) {
		const matrixRoomId = [groupId, rid].find((id) =>
			isMatrixRoomIdHeuristic(id)
		);
		if (matrixRoomId) {
			return `${listPath}/${encodeURIComponent(matrixRoomId)}/${sessionId}${tabSuffix}`;
		}
	}

	if (groupId && !isMatrixRoomIdHeuristic(groupId)) {
		return `${listPath}/${encodeURIComponent(groupId)}/${sessionId}${tabSuffix}`;
	}

	if (isAsker && isEmptyEnquiry) {
		return `${listPath}/write/${sessionId}${tabSuffix}`;
	}

	return `${listPath}/session/${sessionId}${tabSuffix}`;
};
