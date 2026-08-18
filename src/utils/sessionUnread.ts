/**
 * Unread axis (#1147) — client-side unread derivation.
 *
 * The backend hard-codes `messagesRead: true` on every session/chat DTO since
 * the Matrix-native refactor (344ac3ca): read state is owned by the frontend
 * Matrix client. This module is the single derivation that feeds every unread
 * consumer (list item read styling, the "unread" toolbar chip filter and the
 * chip counter). Do not read `messagesRead` from the DTO — it is always true.
 */

import { getMatrixClientService } from '../services/matrixClientRegistry';

/**
 * True when the Matrix room behind `matrixRoomId` has unread notifications
 * for the current device. Sessions without a Matrix room (or before the
 * Matrix client is ready) are treated as read — same UI state the DTO
 * constant produced, so nothing flashes "unread" while the client boots.
 */
export const isRoomUnread = (matrixRoomId?: string | null): boolean => {
	if (!matrixRoomId) {
		return false;
	}

	try {
		const room = getMatrixClientService()?.getRoom(matrixRoomId);
		if (!room) {
			return false;
		}
		return room.getUnreadNotificationCount() > 0;
	} catch {
		return false;
	}
};

/**
 * Unread state for a session/chat list item (SessionItemInterface or
 * GroupChatItemInterface). Joins on `matrixRoomId`; deliberately ignores the
 * item's `messagesRead` flag, which the backend hard-codes to `true`.
 */
export const isChatItemUnread = (
	chatItem?: { matrixRoomId?: string | null } | null
): boolean => isRoomUnread(chatItem?.matrixRoomId);
