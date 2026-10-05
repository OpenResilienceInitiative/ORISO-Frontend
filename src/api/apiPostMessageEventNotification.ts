import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_ERRORS } from './fetchData';

export interface MessageEventNotificationInput {
	roomId: string;
	messagePreview?: string;
	matrixRoom?: boolean;
	threadRootId?: string | null;
	supervisorMessage?: boolean;
	/** Explicit protected-feedback compose hint; the server independently authorizes the event. */
	feedbackMailIntent?: boolean;
	senderDisplayName?: string | null;
	threadParentPreview?: string | null;
	teamDiscussion?: boolean;
	mentionedUserIds?: string[] | null;
	/** Matrix event id of the sent message (#942, backend dedup key). */
	matrixEventId?: string | null;
}

export interface MessageEventNotificationBody {
	roomId: string;
	messagePreview: string;
	matrixRoom: boolean;
	threadRootId: string | null;
	supervisorMessage: boolean;
	feedbackMailIntent: boolean;
	senderDisplayName: string | null;
	threadParentPreview: string | null;
	teamDiscussion: boolean;
	mentionedUserIds: string[] | null;
	matrixEventId: string | null;
}

const MAX_LEGACY_MESSAGE_PREVIEW_LENGTH = 100;

export const buildMessageEventNotificationBody = ({
	roomId,
	messagePreview,
	matrixRoom = true,
	threadRootId,
	supervisorMessage = false,
	feedbackMailIntent = false,
	senderDisplayName,
	threadParentPreview,
	teamDiscussion = false,
	mentionedUserIds,
	matrixEventId
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
		feedbackMailIntent: matrixRoom && !teamDiscussion && feedbackMailIntent,
		senderDisplayName: senderDisplayName || null,
		threadParentPreview: canIncludePlaintextPreview
			? threadParentPreview || null
			: null,
		teamDiscussion,
		mentionedUserIds: mentionedUserIds?.length ? mentionedUserIds : null,
		matrixEventId: matrixEventId || null
	};
};

export const apiPostMessageEventNotification = async (
	input: MessageEventNotificationInput,
	signal?: AbortSignal
): Promise<any> =>
	fetchData({
		url: `${endpoints.eventNotifications}/message-events`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(buildMessageEventNotificationBody(input)),
		signal,
		// Feedback hint delivery is retriable background metadata, never a page navigation.
		responseHandling: input.feedbackMailIntent
			? Object.values(FETCH_ERRORS).filter(
					(error) => error !== FETCH_ERRORS.EMPTY
				)
			: []
	});
