import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

export interface MessageEventNotificationInput {
	roomId: string;
	messagePreview?: string;
	matrixRoom?: boolean;
	threadRootId?: string | null;
	supervisorMessage?: boolean;
	senderDisplayName?: string | null;
	threadParentPreview?: string | null;
}

export interface MessageEventNotificationBody {
	roomId: string;
	messagePreview: string;
	matrixRoom: boolean;
	threadRootId: string | null;
	supervisorMessage: boolean;
	senderDisplayName: string | null;
	threadParentPreview: string | null;
}

const MAX_LEGACY_MESSAGE_PREVIEW_LENGTH = 100;

export const buildMessageEventNotificationBody = ({
	roomId,
	messagePreview,
	matrixRoom = true,
	threadRootId,
	supervisorMessage = false,
	senderDisplayName,
	threadParentPreview
}: MessageEventNotificationInput): MessageEventNotificationBody => {
	const canIncludePlaintextPreview = matrixRoom === false;
	return {
		roomId,
		messagePreview: canIncludePlaintextPreview
			? (messagePreview ?? '').slice(0, MAX_LEGACY_MESSAGE_PREVIEW_LENGTH)
			: '',
		matrixRoom,
		threadRootId: threadRootId || null,
		supervisorMessage,
		senderDisplayName: senderDisplayName || null,
		threadParentPreview: canIncludePlaintextPreview
			? threadParentPreview || null
			: null
	};
};

export const apiPostMessageEventNotification = async (
	input: MessageEventNotificationInput
): Promise<any> =>
	fetchData({
		url: `${endpoints.eventNotifications}/message-events`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(buildMessageEventNotificationBody(input)),
		responseHandling: []
	});
