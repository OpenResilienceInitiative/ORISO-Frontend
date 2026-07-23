/**
 * Thread-panel-UX (#435) — per-thread unread state.
 *
 * Device-local approximation: a last-read timestamp per (room, thread root)
 * mirrored to localStorage, same "mirror" pattern as
 * notificationSettings/store.ts. NOT full cross-device Matrix thread read
 * receipts (MSC3771/3773) — that needs a live homeserver to verify against.
 */

const STORAGE_KEY = 'ORISO_THREAD_LAST_READ';

const storageKey = (roomId: string, threadRootId: string): string =>
	`${STORAGE_KEY}:${roomId}:${threadRootId}`;

/** True when the thread has a reply newer than the last time it was read. */
export const isThreadUnread = (
	lastReplyTs: number,
	lastReadTs: number
): boolean => lastReplyTs > lastReadTs;

/** Last-read timestamp for a thread; 0 (never read) when unknown. */
export const getThreadLastReadTs = (
	roomId: string,
	threadRootId: string
): number => {
	try {
		const raw = localStorage.getItem(storageKey(roomId, threadRootId));
		const parsed = raw ? Number(raw) : 0;
		return Number.isFinite(parsed) ? parsed : 0;
	} catch {
		return 0;
	}
};

/** Marks a thread read up to `ts`. Never regresses past a later mark. */
export const markThreadRead = (
	roomId: string,
	threadRootId: string,
	ts: number
): void => {
	try {
		const current = getThreadLastReadTs(roomId, threadRootId);
		if (ts <= current) {
			return;
		}
		localStorage.setItem(storageKey(roomId, threadRootId), String(ts));
	} catch {
		/* storage full/unavailable — unread state is best-effort */
	}
};
