import { isMatrixRoomIdHeuristic } from '../../utils/matrixRoomUtils';

export const TOPIC_DUPLICATE_QUERY_PARAM = 'topicDuplicate';
export const TOPIC_DUPLICATE_SEARCH = '?topicDuplicate=1';

export interface ExactCounsellingRoom {
	roomId: string;
	caseId: number;
}

export const parseTopicDuplicateRoomPath = (path: string) => {
	const match =
		/^\/sessions\/(user\/view|consultant\/sessionView)\/([^/]+)\/([1-9]\d*)$/.exec(
			path
		);
	if (!match) return null;
	const [, rolePath, roomSegment, sessionId] = match;
	const caseId = Number(sessionId);
	if (!Number.isSafeInteger(caseId)) return null;
	try {
		const roomId = decodeURIComponent(roomSegment);
		if (!isMatrixRoomIdHeuristic(roomId) || /[\\/?#,%\s]/.test(roomId))
			return null;
		return { rolePath, roomSegment, roomId, caseId };
	} catch {
		return null;
	}
};
