export interface SupervisionRoomLookup {
	sessionId: number;
	roomId?: string;
}

/**
 * A side-room id is safe to render or send to only in the session for which
 * it was resolved. Async lookup cancellation avoids stale state updates; this
 * identity check is the final confidentiality boundary during session swaps.
 */
export const roomIdForActiveSession = (
	lookup: SupervisionRoomLookup | null,
	activeSessionId: number | undefined
): string | undefined =>
	lookup?.sessionId === activeSessionId ? lookup.roomId : undefined;
