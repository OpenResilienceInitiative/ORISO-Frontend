import { endpoints } from '../resources/scripts/endpoints';
import {
	fetchData,
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS
} from './fetchData';

export const apiPostDraftMessage = async (
	roomIdOrSessionId: string | number,
	messageData: string,
	encryptType: string
): Promise<void> => {
	const url = endpoints.draftMessages;
	const message = JSON.stringify({
		message: messageData,
		t: encryptType
	});
	return fetchData({
		url: url,
		method: FETCH_METHODS.POST,
		headersData: { matrixRoomId: roomIdOrSessionId },
		bodyData: message,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});
};

export interface IDraftMessage {
	message: string;
	t: string;
}

export const apiGetDraftMessage = async (
	roomIdOrSessionId: string | number,
	signal?: AbortSignal
): Promise<IDraftMessage> => {
	const url = endpoints.draftMessages;
	return fetchData({
		url: url,
		method: FETCH_METHODS.GET,
		headersData: { matrixRoomId: roomIdOrSessionId },
		responseHandling: [FETCH_ERRORS.EMPTY, FETCH_SUCCESS.CONTENT],
		...(signal && { signal: signal })
	});
};
