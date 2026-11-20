import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

interface ActiveViewInput {
	roomId?: string | null;
	threadRootId?: string | null;
	active: boolean;
	/** A side panel fills the screen instead of the room's main chat. */
	mainChatHidden?: boolean;
}

export const apiPatchNotificationActiveView = async ({
	roomId,
	threadRootId,
	active,
	mainChatHidden
}: ActiveViewInput): Promise<any> =>
	fetchData({
		url: `${endpoints.eventNotifications}/active-view`,
		method: FETCH_METHODS.PATCH,
		bodyData: JSON.stringify({
			roomId: roomId || null,
			threadRootId: threadRootId || null,
			active,
			mainChatHidden
		}),
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});
