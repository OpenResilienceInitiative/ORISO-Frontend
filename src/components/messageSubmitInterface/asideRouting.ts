/**
 * ADR-008 supervisor/aside side-channel — outgoing send routing.
 *
 * An "aside" is any message the client must never receive: supervisor
 * feedback (SUPERVISOR_FEEDBACK_PREFIX) or an explicit VISIBLE_TO audience
 * selection. Those messages are sent to a per-session supervision side room
 * the client is never invited to, NOT to the client-facing room.
 *
 * SAFETY: if a message is an aside but no supervision room id is available,
 * the send MUST be aborted — never fall back to the client room, or the aside
 * would leak to the client.
 */

interface AsideRoutingInput {
	/** True when the outgoing message carries an aside (supervisor feedback or explicit VISIBLE_TO audience). */
	isAside: boolean;
	/** The client-facing Matrix room id for this session. */
	clientRoomId?: string | null;
	/** The per-session supervision side room id (from SessionSupervisor.matrixRoomId). */
	supervisionRoomId?: string | null;
}

export interface AsideRoutingResult {
	/** The Matrix room id the message should be sent to, or null when the send must be aborted. */
	targetRoomId: string | null;
	/** True when the send must be aborted to avoid leaking an aside into the client room. */
	abort: boolean;
}

/**
 * Decide which room an outgoing message goes to.
 *
 * - Non-aside messages always target the client room.
 * - Aside messages target the supervision side room; if it is missing the
 *   send is aborted (never leaked into the client room).
 */
export const resolveAsideTargetRoomId = ({
	isAside,
	clientRoomId,
	supervisionRoomId
}: AsideRoutingInput): AsideRoutingResult => {
	if (!isAside) {
		return { targetRoomId: clientRoomId || null, abort: false };
	}

	if (supervisionRoomId) {
		return { targetRoomId: supervisionRoomId, abort: false };
	}

	// Aside with no side room: abort rather than leak into the client room.
	return { targetRoomId: null, abort: true };
};

interface PrimaryRoomInput {
	/** Explicit primary target (a side room the composer is mounted in). */
	targetRoomId?: string | null;
	/** The session's client-facing Matrix room id. */
	clientRoomId?: string | null;
}

/**
 * Which room a *normal* (non-aside) send goes to.
 *
 * The composer used to derive the room from the active session only. A
 * composer mounted inside a side panel (supervision, later threads-as-rooms)
 * passes `targetRoomId`, which wins over the session's client room. Aside
 * routing stays untouched — `resolveAsideTargetRoomId` runs on the result.
 */
export const resolvePrimaryRoomId = ({
	targetRoomId,
	clientRoomId
}: PrimaryRoomInput): string | undefined => {
	const explicit = targetRoomId?.trim();
	if (explicit) {
		return explicit;
	}
	return clientRoomId || undefined;
};
