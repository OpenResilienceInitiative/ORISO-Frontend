import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';
import { ListItemInterface } from '../globalState/interfaces';

export const apiGetSessionRoomsByRoomIds = async (
	roomIds: string[],
	signal?: AbortSignal
): Promise<{ sessions: ListItemInterface[] }> => {
	const searchParams = new URLSearchParams();
	searchParams.set('roomIds[]', roomIds.join(','));
	const url = `${endpoints.sessionRooms}?${searchParams.toString()}`;

	return fetchData({
		url: url,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.EMPTY, FETCH_ERRORS.CATCH_ALL],
		...(signal && { signal: signal })
	});
};

export const apiGetSessionRoomBySessionId = async (
	sessionId: number,
	signal?: AbortSignal
): Promise<{ sessions: ListItemInterface[] }> => {
	const url = `${endpoints.sessionRooms}/${sessionId}`;

	return fetchData({
		url: url,
		method: FETCH_METHODS.GET,
		responseHandling: [
			FETCH_ERRORS.EMPTY,
			FETCH_ERRORS.FORBIDDEN,
			FETCH_ERRORS.CATCH_ALL
		],
		...(signal && { signal: signal })
	});
};
