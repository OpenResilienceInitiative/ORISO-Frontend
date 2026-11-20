import { endpoints } from '../resources/scripts/endpoints';
import {
	fetchData,
	FETCH_METHODS,
	FETCH_SUCCESS,
	FETCH_ERRORS
} from './fetchData';

export type CallerBanState = 'BANNED' | 'NOT_BANNED' | 'UNKNOWN';

export interface groupChatInfoData {
	active: boolean;
	matrixRoomId: string;
	id: number;
	bannedUsers?: string[];
	callerBanState?: CallerBanState;
}

export const apiGetGroupChatInfo = async (
	groupChatId: number,
	options?: { includeCallerBan?: boolean; signal?: AbortSignal }
): Promise<groupChatInfoData> => {
	const url =
		endpoints.groupChatBase +
		groupChatId +
		(options?.includeCallerBan ? '?includeCallerBan=true' : '');

	return fetchData({
		url: url,
		method: FETCH_METHODS.GET,
		...(options?.signal && { signal: options.signal }),
		responseHandling: [
			FETCH_SUCCESS.CONTENT,
			FETCH_ERRORS.NO_MATCH,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED
		]
	});
};
