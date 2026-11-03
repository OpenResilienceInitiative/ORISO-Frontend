import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';
import { FURTHER_COUNSELLING_NOTE_MAX_LENGTH } from '../components/furtherCounselling/furtherCounsellingNotices';

/**
 * FE#1876: the assigned counsellor recommends further counselling on a topic.
 * The backend posts FURTHER_COUNSELLING_RECOMMENDED into the room. Any 2xx is
 * success; 403 and 409 reject with FETCH_ERRORS.FORBIDDEN / CONFLICT.
 */
export const apiPostFurtherCounsellingRecommendation = (
	sessionId: number,
	topicId: number,
	note?: string
): Promise<unknown> => {
	const trimmed = note?.trim();
	return fetchData({
		url: `${endpoints.sessionBase}/${sessionId}/further-counselling-recommendation`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({
			topicId,
			...(trimmed
				? {
						note: trimmed.slice(
							0,
							FURTHER_COUNSELLING_NOTE_MAX_LENGTH
						)
					}
				: {})
		}),
		responseHandling: [
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.CATCH_ALL
		]
	});
};

/**
 * FE#1876: the asker ends the newer of two running chats on the same topic.
 * The backend archives it and notifies the older chat.
 */
export const apiPutEndTopicDuplicate = (sessionId: number): Promise<unknown> =>
	fetchData({
		url: `${endpoints.askerSessionsBase}/${sessionId}/end-duplicate`,
		method: FETCH_METHODS.PUT,
		responseHandling: [
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.CATCH_ALL
		]
	});
