import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * Marks an anonymous live-chat session as finished (status DONE).
 * Callable by the session's anonymous asker or their consultant.
 */
export const apiFinishAnonymousConversation = (
	sessionId: number | string
): Promise<void> =>
	fetchData({
		url: endpoints.finishAnonymousConversation(sessionId),
		method: FETCH_METHODS.PUT,
		responseHandling: [
			FETCH_ERRORS.CONFLICT,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.BAD_REQUEST,
			FETCH_ERRORS.CATCH_ALL
		]
	});
