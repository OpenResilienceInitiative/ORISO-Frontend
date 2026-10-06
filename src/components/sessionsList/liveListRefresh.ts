/**
 * Helpers for keeping a session list live when a message arrives (#1206).
 *
 * `touchSessionsByRids` can only update a session the list already holds — it
 * drops an unknown room. So a message from a room the list has never loaded (a
 * new enquiry, or a session that just became a chat) changed nothing on screen
 * and the counsellor had to hard-refresh. The caller uses `isRoomInSessions`
 * to detect that case and refetch instead, and `createRefreshThrottle` so a
 * burst of messages from the same unknown room causes one refetch, not ten.
 */
interface SessionLike {
	session?: { matrixRoomId?: string } | null;
	chat?: { matrixRoomId?: string } | null;
}

export const isRoomInSessions = (
	sessions: ReadonlyArray<SessionLike | null> | undefined,
	roomId: string
): boolean => {
	if (!roomId || !sessions?.length) {
		return false;
	}
	return sessions.some(
		(item) =>
			item?.session?.matrixRoomId === roomId ||
			item?.chat?.matrixRoomId === roomId
	);
};

export interface RefreshThrottle {
	/** True when a refresh may run now; false while inside the cooldown. */
	shouldRefresh: (now?: number) => boolean;
}

export const createRefreshThrottle = (
	windowMs: number = 3000
): RefreshThrottle => {
	let lastRefreshAt: number | null = null;
	return {
		shouldRefresh: (now = Date.now()) => {
			if (lastRefreshAt !== null && now - lastRefreshAt < windowMs) {
				return false;
			}
			lastRefreshAt = now;
			return true;
		}
	};
};
