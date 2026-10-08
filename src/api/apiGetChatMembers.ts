import { endpoints } from '../resources/scripts/endpoints';
import {
	fetchData,
	FETCH_METHODS,
	FETCH_SUCCESS,
	FETCH_ERRORS
} from './fetchData';

export const apiGetChatMembers = (
	chatId: number
): Promise<UserService.Schemas.ChatMembersResponseDTO> =>
	fetchData({
		url: `${endpoints.groupChatBase}${chatId}/members`,
		method: FETCH_METHODS.GET,
		responseHandling: [
			FETCH_SUCCESS.CONTENT,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.NO_MATCH
		]
	});
