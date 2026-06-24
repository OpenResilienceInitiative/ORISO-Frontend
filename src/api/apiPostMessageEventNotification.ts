import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

interface MessageEventNotificationInput {
	roomId: string;
	messagePreview?: string;
	matrixRoom?: boolean;
	threadRootId?: string | null;
	supervisorMessage?: boolean;
	senderDisplayName?: string | null;
	threadParentPreview?: string | null;
}

export const apiPostMessageEventNotification = async ({
	roomId,
	messagePreview,
	matrixRoom = true,
	threadRootId,
	supervisorMessage = false,
	senderDisplayName,
	threadParentPreview
}: MessageEventNotificationInput): Promise<any> =>
	fetchData({
		url: `${endpoints.eventNotifications}/message-events`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({
			roomId,
			// KDG/GDPR: messagePreview is for notification display only and must not exceed 100 chars
			messagePreview: (messagePreview ?? '').slice(0, 100),
			matrixRoom,
			threadRootId: threadRootId || null,
			supervisorMessage,
			senderDisplayName: senderDisplayName || null,
			threadParentPreview: threadParentPreview || null
		}),
		responseHandling: []
	});
