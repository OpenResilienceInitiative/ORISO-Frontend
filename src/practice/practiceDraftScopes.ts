import { isPracticeId } from './practiceIds';

/** The composer's canonical scope contains the room/session id and thread. */
export const isPracticeDraftScope = (scopeKey: string): boolean => {
	const match = scopeKey.match(/^scope:(.+)\|thread:[^|]+$/);
	return !!match && isPracticeId(match[1]);
};
