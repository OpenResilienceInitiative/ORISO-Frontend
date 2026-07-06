import type { MatrixClientService } from '../services/matrixClientService';
import { chatTransportService } from '../services/chatTransportService';

export const apiSendMessage = (
	messageData: string,
	rcGroupIdOrSessionId: string | number,
	sendMailNotification: boolean,
	isEncrypted: boolean,
	sessionId?: number,
	matrixRoomId?: string,
	threadRootId?: string | null,
	supervisorMessage?: boolean,
	senderDisplayName?: string | null,
	matrixClientServiceOverride?: MatrixClientService | null
): Promise<any> =>
	chatTransportService.sendTextMessage({
		roomIdOrSessionId: rcGroupIdOrSessionId,
		message: messageData,
		sendMailNotification,
		isEncrypted,
		sessionId,
		matrixRoomId,
		threadRootId,
		supervisorMessage,
		senderDisplayName,
		matrixClientServiceOverride
	});
