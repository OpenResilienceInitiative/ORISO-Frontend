/**
 * Whether the Live-Chat chip belongs on the toolbar (#1404, #1377).
 *
 * Availability answers "may NEW live chats be routed to me"; it must never
 * decide alone whether an EXISTING one stays reachable. Frank 2026-09-16
 * made the rule a per-user pill mode (Anzeigen picker of the Live-Chat row):
 * - `dynamic` (default): availability on, or an asker wrote something new;
 * - `session`: also while any live chat is in the list, new messages or not;
 * - `fixed`: always.
 * Whatever the mode, the chip never hides the live chat the consultant is in
 * right now — the row is route-active and must stay reachable.
 */
import type { LiveChatPillMode } from '../displayFilter/displayFilterTypes';

export interface LiveChatChipVisibilityInput {
	mode: LiveChatPillMode;
	/** Backend-authoritative live-chat availability of this consultant. */
	available: boolean;
	/** The list currently holds at least one live-chat conversation. */
	hasLiveChatRow: boolean;
	/** Unread items on live-chat rows. */
	unreadCount: number;
	/** The open conversation is a live chat. */
	activeIsLiveChat: boolean;
}

export const isLiveChatChipVisible = ({
	mode,
	available,
	hasLiveChatRow,
	unreadCount,
	activeIsLiveChat
}: LiveChatChipVisibilityInput): boolean => {
	if (mode === 'fixed' || available || activeIsLiveChat) {
		return true;
	}
	if (mode === 'session') {
		return hasLiveChatRow;
	}
	return hasLiveChatRow && unreadCount > 0;
};
