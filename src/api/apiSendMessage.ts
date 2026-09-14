import type { MatrixClientService } from '../services/matrixClientService';
import { chatTransportService } from '../services/chatTransportService';

export const apiSendMessage = (
	messageData: string,
	roomIdOrSessionId: string | number,
	sendMailNotification: boolean,
	isEncrypted: boolean,
	sessionId?: number,
	matrixRoomId?: string,
	threadRootId?: string | null,
	supervisorMessage?: boolean,
	senderDisplayName?: string | null,
	matrixClientServiceOverride?: MatrixClientService | null,
	replyToEventId?: string | null,
	mentionedUserIds?: string[],
	teamDiscussion?: boolean
): Promise<any> =>
	chatTransportService.sendTextMessage({
		roomIdOrSessionId: roomIdOrSessionId,
		message: messageData,
		sendMailNotification,
		isEncrypted,
		sessionId,
		matrixRoomId,
		threadRootId,
		replyToEventId,
		mentionedUserIds,
		supervisorMessage,
		senderDisplayName,
		teamDiscussion,
		matrixClientServiceOverride
	});
