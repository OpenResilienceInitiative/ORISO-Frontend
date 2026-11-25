/**
 * ORISO-Frontend#2494 *6: the supervision side room is end-to-end encrypted.
 * When a counsellor replaces the supervisor, the new supervisor continues the
 * SAME side room (Frank, 2026-11-24) and must be able to read what was said
 * before. The server cannot hand over Megolm keys, so the counsellor's app
 * sends a room-key bundle (MSC4268), and the new supervisor's app imports it
 * when it opens the case.
 *
 * Both steps are best effort: the swap stands without them, and a supervisor
 * without the bundle sees the usual "cannot decrypt" placeholder for older
 * messages, as before.
 */

type CryptoWithHistory = {
	shareRoomHistoryWithUser?: (
		roomId: string,
		userId: string
	) => Promise<void>;
};

type ClientWithHistory = {
	getCrypto?: () => CryptoWithHistory | undefined;
	/** Not on the public API; the SDK's own joinRoom calls it after an invite. */
	cryptoBackend?: {
		maybeAcceptKeyBundle?: (
			roomId: string,
			inviter: string
		) => Promise<void>;
	};
};

const isMatrixUserId = (value?: string | null): value is string =>
	typeof value === 'string' && /^@[^:]+:.+/.test(value);
const isMatrixRoomId = (value?: string | null): value is string =>
	typeof value === 'string' && /^![^:]+:.+/.test(value);

/** Counsellor side: send the side room's history keys to the new supervisor. */
export const shareSupervisionHistory = async (
	client: unknown,
	sideRoomId?: string | null,
	supervisorMatrixUserId?: string | null
): Promise<boolean> => {
	if (
		!isMatrixRoomId(sideRoomId) ||
		!isMatrixUserId(supervisorMatrixUserId)
	) {
		return false;
	}
	const crypto = (client as ClientWithHistory | undefined)?.getCrypto?.();
	if (!crypto?.shareRoomHistoryWithUser) return false;
	try {
		await crypto.shareRoomHistoryWithUser(
			sideRoomId,
			supervisorMatrixUserId
		);
		return true;
	} catch {
		return false;
	}
};

const accepted = new Set<string>();

/**
 * Supervisor side: import a history bundle the counsellor sent for this side
 * room. The server joined the supervisor, so the SDK's join path never ran;
 * this does its step once per room and counsellor per page load.
 */
export const acceptSupervisionHistory = async (
	client: unknown,
	sideRoomId?: string | null,
	counsellorMatrixUserId?: string | null
): Promise<boolean> => {
	if (
		!isMatrixRoomId(sideRoomId) ||
		!isMatrixUserId(counsellorMatrixUserId)
	) {
		return false;
	}
	const key = `${sideRoomId}|${counsellorMatrixUserId}`;
	if (accepted.has(key)) return false;
	const backend = (client as ClientWithHistory | undefined)?.cryptoBackend;
	if (!backend?.maybeAcceptKeyBundle) return false;
	accepted.add(key);
	try {
		await backend.maybeAcceptKeyBundle(sideRoomId, counsellorMatrixUserId);
		return true;
	} catch {
		// A bundle that arrives later is picked up on the next page load.
		accepted.delete(key);
		return false;
	}
};

/** Tests only. */
export const resetAcceptedSupervisionHistory = () => accepted.clear();
