import {
	apiGetTeamDiscussion,
	type TeamDiscussion
} from '../api/apiTeamDiscussion';

const discussionCache = new Map<number, Promise<TeamDiscussion | null>>();

type TeamDiscussionCacheListener = (sessionId: number) => void;
const listeners = new Set<TeamDiscussionCacheListener>();

const notify = (sessionId: number) => {
	listeners.forEach((listener) => listener(sessionId));
};

export const getCachedTeamDiscussion = (
	sessionId: number
): Promise<TeamDiscussion | null> => {
	if (!discussionCache.has(sessionId)) {
		discussionCache.set(
			sessionId,
			apiGetTeamDiscussion(sessionId).catch(() => {
				discussionCache.delete(sessionId);
				return null;
			})
		);
	}
	return discussionCache.get(sessionId)!;
};

/** Drops the cached answer; list badges for this session look again. */
export const invalidateTeamDiscussionCache = (sessionId: number): void => {
	discussionCache.delete(sessionId);
	notify(sessionId);
};

/**
 * FE#2491: stores a state the caller already knows (after a switch on/off),
 * so list badges update without another lookup.
 */
export const primeTeamDiscussionCache = (
	sessionId: number,
	discussion: TeamDiscussion | null
): void => {
	discussionCache.set(sessionId, Promise.resolve(discussion));
	notify(sessionId);
};

/** Called with the session id whenever its cached team discussion changed. */
export const subscribeTeamDiscussionCache = (
	listener: TeamDiscussionCacheListener
): (() => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};
