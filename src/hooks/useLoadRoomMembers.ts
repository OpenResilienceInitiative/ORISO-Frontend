import { useEffect } from 'react';
import { chatTransportService } from '../services/chatTransportService';

const RETRY_INITIAL_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 8000;
const RETRY_MAX_ATTEMPTS = 8;

/**
 * Fetches the full membership of a room that is not the session's own, such
 * as the team discussion (#1998). The client syncs with lazyLoadMembers, so
 * without this a joined colleague is missing from room.getMembers() until
 * they next write. The room can also reach the sync store only after the
 * caller has joined it, so a miss is retried with backoff, up to a bound.
 */
export const useLoadRoomMembers = (roomId?: string | null) => {
	useEffect(() => {
		if (!roomId) {
			return;
		}
		let cancelled = false;
		let retryTimer: number | null = null;
		let attempt = 0;

		const load = () => {
			chatTransportService
				.loadMatrixRoomMembers(roomId)
				.catch(() => [])
				.then(() => {
					const loaded = Boolean(
						(
							chatTransportService.getMatrixRoom(roomId) as any
						)?.membersLoaded?.()
					);
					if (cancelled || loaded || attempt >= RETRY_MAX_ATTEMPTS) {
						return;
					}
					const delay = Math.min(
						RETRY_INITIAL_DELAY_MS * 2 ** attempt,
						RETRY_MAX_DELAY_MS
					);
					attempt += 1;
					retryTimer = window.setTimeout(load, delay);
				});
		};
		load();

		return () => {
			cancelled = true;
			if (retryTimer) {
				window.clearTimeout(retryTimer);
			}
		};
	}, [roomId]);
};
