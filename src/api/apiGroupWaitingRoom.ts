import { endpoints } from '../resources/scripts/endpoints';
import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from './fetchData';
import type { CallKnock } from './apiDirectLinks';

/**
 * ORISO-Frontend#2237: "I am waiting in this group's waiting room"
 * (ORISO-UserService `PUT /users/chat/{chatId}/waiting`). Calling again
 * marks the person as still there and returns a fresh admission as it is.
 */
export const apiWaitInGroupChat = (chatId: number): Promise<CallKnock> =>
	fetchData({
		url: `${endpoints.groupChatBase}${chatId}/waiting`,
		method: FETCH_METHODS.PUT,
		responseHandling: [
			FETCH_SUCCESS.CONTENT,
			FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE
		]
	});
