import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

/**
 * Registers a session's Matrix room with the backend event listener
 * (`POST /service/matrix/sync/register/{sessionId}`). The listener's /sync
 * loop only receives events for rooms its technical admin has joined; the
 * backend heals that membership on every registration, so this call is what
 * makes message notifications work for a session at all.
 *
 * Fire-and-forget: failures are swallowed (the next open retries) and each
 * session is registered at most once per app lifetime.
 */
const registeredSessionIds = new Set<number>();

export const __resetMatrixSyncRegistrationCache = () => {
	registeredSessionIds.clear();
};

export const apiRegisterMatrixRoomForSync = async (
	sessionId?: number | null
): Promise<void> => {
	if (!sessionId || registeredSessionIds.has(sessionId)) {
		return;
	}
	registeredSessionIds.add(sessionId);
	try {
		await fetchData({
			url: endpoints.matrixSyncRegister(sessionId),
			method: FETCH_METHODS.POST
		});
	} catch (_error) {
		// Best-effort: allow a retry the next time the session is opened.
		registeredSessionIds.delete(sessionId);
	}
};
