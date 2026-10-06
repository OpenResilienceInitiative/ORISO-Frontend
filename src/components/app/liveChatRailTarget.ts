/**
 * Where the rail Live-Chat button takes the consultant (Frank 2026-09-16,
 * Variante 1): turning availability ON while a live chat is already open
 * returns to that conversation instead of the empty queue; without one it
 * pushes to the anonymous enquiry queue with the chip active (1.0
 * behaviour). Turning OFF never navigates.
 */
import type { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import { getModality, Modality } from '../session/getModality';
import { getSessionNavigationPath } from '../sessionsListItem/sessionsListItemHelpers';

export const LIVE_CHAT_QUEUE_PATH =
	'/sessions/consultant/sessionPreview?chip=liveChat';

export const resolveLiveChatRailTarget = ({
	nextActive,
	sessions
}: {
	nextActive: boolean;
	sessions: ReadonlyArray<ListItemInterface>;
}): string | null => {
	if (!nextActive) {
		return null;
	}
	const open = sessions.find(
		(row) => row?.session && getModality(row) === Modality.LIVE_CHAT
	);
	if (!open?.session) {
		return LIVE_CHAT_QUEUE_PATH;
	}
	return getSessionNavigationPath({
		listPath: '/sessions/consultant/sessionView',
		sessionId: open.session.id,
		groupId: open.session.matrixRoomId,
		rid: open.session.matrixRoomId,
		isGroup: false,
		isAsker: false,
		isEmptyEnquiry: false,
		isLiveChat: true,
		tabSuffix: ''
	});
};
