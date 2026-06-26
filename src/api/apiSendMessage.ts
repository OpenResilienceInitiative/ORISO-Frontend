import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';
import { apiPostMessageEventNotification } from './apiPostMessageEventNotification';
import { getMatrixClientService } from '../services/matrixClientRegistry';
import type { MatrixClientService } from '../services/matrixClientService';

export const apiSendMessage = (
	messageData: string,
	rcGroupIdOrSessionId: string | number,
	sendMailNotification: boolean,
	isEncrypted: boolean,
	sessionId?: number,
	matrixRoomId?: string, // NEW: Accept Matrix room ID directly
	threadRootId?: string | null,
	supervisorMessage?: boolean,
	senderDisplayName?: string | null,
	matrixClientServiceOverride?: MatrixClientService | null
): Promise<any> => {
	// MATRIX MIGRATION: Use Matrix SDK directly for INSTANT local echo (like Element!)
	if (sessionId && matrixRoomId) {
		const matrixClientService =
			matrixClientServiceOverride || getMatrixClientService();
		if (!matrixClientService?.getClient()) {
			return Promise.reject(new Error('Matrix client not initialized'));
		}

		// Matrix message bodies must stay on the Matrix SDK path so room
		// encryption/local echo are owned by Matrix, not the ORISO REST proxy.
		return matrixClientService
			.sendMessage(matrixRoomId, messageData)
			.then((response: any) => {
				// SECURITY (FE-H01): never forward plaintext message content
				// (messagePreview / threadParentPreview) across the Matrix
				// privacy boundary. Only non-content metadata is sent.
				apiPostMessageEventNotification({
					roomId: matrixRoomId,
					matrixRoom: true,
					threadRootId: threadRootId || null,
					supervisorMessage: !!supervisorMessage,
					senderDisplayName: senderDisplayName || null
				}).catch(() => undefined);
				return { success: true, event_id: response.event_id };
			});
	}

	// Legacy RocketChat path
	const url = endpoints.sendMessage;
	const activeGroupId = { rcGroupId: rcGroupIdOrSessionId };
	const message = JSON.stringify({
		message: messageData,
		t: isEncrypted ? 'e2e' : '',
		sendNotification: sendMailNotification
	});

	return fetchData({
		url: url,
		method: FETCH_METHODS.POST,
		headersData: activeGroupId,
		rcValidation: true,
		bodyData: message
	});
};
