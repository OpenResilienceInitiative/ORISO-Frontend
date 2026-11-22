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

/**
 * Collects room ids and hands them over once per window (#2480).
 *
 * On page load the Matrix sync replays many messages per room, and each one
 * used to ask the UserService for its room on its own: 104 single-room
 * requests for 14 rooms on one counsellor load on Dev. Queued ids are
 * de-duplicated and flushed together after `windowMs`.
 */
export interface RoomRefreshQueue {
	add: (roomId: string) => void;
	cancel: () => void;
}

export const createRoomRefreshQueue = (
	flush: (roomIds: string[]) => void,
	windowMs: number = 300
): RoomRefreshQueue => {
	const pending = new Set<string>();
	let timer: ReturnType<typeof setTimeout> | null = null;
	return {
		add: (roomId) => {
			if (!roomId) return;
			pending.add(roomId);
			if (timer) return;
			timer = setTimeout(() => {
				timer = null;
				const roomIds = [...pending];
				pending.clear();
				flush(roomIds);
			}, windowMs);
		},
		cancel: () => {
			if (timer) clearTimeout(timer);
			timer = null;
			pending.clear();
		}
	};
};

/**
 * Looks up several rooms with one request (#2480).
 *
 * Resolves each room id to its session, or to `null` when the UserService has
 * no session for it (a closed group chat). A room the batch answer does not
 * clearly match, or a failed batch, falls back to the single-room request
 * this list always used, so nothing is dropped on a mismatch.
 */
export const lookUpSessionRooms = async <T extends SessionLike>(
	roomIds: string[],
	fetchRooms: (roomIds: string[]) => Promise<{ sessions: T[] }>
): Promise<Map<string, T | null>> => {
	const found = new Map<string, T | null>();
	const lookUpOne = (roomId: string) =>
		fetchRooms([roomId])
			.then(({ sessions }) => found.set(roomId, sessions?.[0] ?? null))
			.catch(() => found.set(roomId, null));

	if (roomIds.length === 1) {
		await lookUpOne(roomIds[0]);
		return found;
	}

	let batch: T[] | null = null;
	try {
		batch = (await fetchRooms(roomIds)).sessions ?? [];
	} catch {
		batch = null;
	}

	const unresolved: string[] = [];
	for (const roomId of roomIds) {
		const match = batch?.find(
			(item) =>
				item?.session?.matrixRoomId === roomId ||
				item?.chat?.matrixRoomId === roomId
		);
		if (match) found.set(roomId, match);
		else unresolved.push(roomId);
	}
	await Promise.all(unresolved.map(lookUpOne));
	return found;
};
