import {
	apiGetTeamDiscussion,
	type TeamDiscussion
} from '../api/apiTeamDiscussion';

const discussionCache = new Map<number, Promise<TeamDiscussion | null>>();

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

export const invalidateTeamDiscussionCache = (sessionId: number): void => {
	discussionCache.delete(sessionId);
};
