import { useCallback, useSyncExternalStore } from 'react';

/**
 * FE#2386: the open conversation resolves its supervisors (and with them the
 * supervision side room) when the case opens (`SessionStream`,
 * `SessionItemComponent`). Accepting an enquiry attaches the counsellor's
 * standing supervisor on the server inside the accept request, after that
 * first lookup. The accept flow announces the change here, per session, and
 * both lookups run again — no reload, no polling.
 */
const revisions = new Map<number, number>();
const listeners = new Set<() => void>();

export const notifySessionSupervisorsChanged = (sessionId: number): void => {
	revisions.set(sessionId, (revisions.get(sessionId) ?? 0) + 1);
	listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

/** Effect dependency that changes when this session's supervisors changed; 0 otherwise. */
export const useSessionSupervisorsRevision = (
	sessionId: number | undefined
): number => {
	const read = useCallback(
		() => (sessionId ? (revisions.get(sessionId) ?? 0) : 0),
		[sessionId]
	);
	return useSyncExternalStore(subscribe, read, () => 0);
};
