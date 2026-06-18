import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

interface ActiveViewInput {
	roomId?: string | null;
	threadRootId?: string | null;
	active: boolean;
}

export const apiPatchNotificationActiveView = async ({
	roomId,
	threadRootId,
	active
}: ActiveViewInput): Promise<any> =>
	fetchData({
		url: `${endpoints.eventNotifications}/active-view`,
		method: FETCH_METHODS.PATCH,
		bodyData: JSON.stringify({
			roomId: roomId || null,
			threadRootId: threadRootId || null,
			active
		}),
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});
