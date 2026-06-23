import { endpoints, apiUrl } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';
import { apiPostMessageEventNotification } from './apiPostMessageEventNotification';
import { getMatrixClientService } from '../services/matrixClientRegistry';

const sendMatrixMessageViaRest = (
	sessionId: number,
	messageData: string,
	matrixRoomId: string,
	threadRootId?: string | null,
	supervisorMessage?: boolean,
	senderDisplayName?: string | null,
	threadParentPreview?: string | null
): Promise<any> => {
	const matrixUrl = `${apiUrl}/service/matrix/sessions/${sessionId}/messages`;
	return fetchData({
		url: matrixUrl,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ message: messageData }),
		responseHandling: [FETCH_ERRORS.FORBIDDEN]
	}).then((fallbackResponse) => {
		apiPostMessageEventNotification({
			roomId: matrixRoomId,
			messagePreview: messageData,
			matrixRoom: true,
			threadRootId: threadRootId || null,
			supervisorMessage: !!supervisorMessage,
			senderDisplayName: senderDisplayName || null,
			threadParentPreview: threadParentPreview || null
		}).catch(() => undefined);
		return fallbackResponse;
	});
};

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
	threadParentPreview?: string | null
): Promise<any> => {
	// MATRIX MIGRATION: Use Matrix SDK directly for INSTANT local echo (like Element!)
	if (sessionId && matrixRoomId) {
		// console.log('🚀 MATRIX: Sending message via Matrix SDK for INSTANT sync');

		// Get Matrix client
		const matrixClientService = getMatrixClientService();
		if (matrixClientService?.getClient()) {
			// console.log('✅ Sending via Matrix SDK to room:', matrixRoomId);

			// Send via Matrix SDK through MatrixClientService so token refresh/retry is applied.
			return matrixClientService
				.sendMessage(matrixRoomId, messageData)
				.then((response: any) => {
					// console.log('✅ Matrix SDK send complete - Room.timeline will fire INSTANTLY!');

					// The Room.timeline event fires IMMEDIATELY with the sent message!
					// This is how Element achieves instant sync!

					apiPostMessageEventNotification({
						roomId: matrixRoomId,
						messagePreview: messageData,
						matrixRoom: true,
						threadRootId: threadRootId || null,
						supervisorMessage: !!supervisorMessage,
						senderDisplayName: senderDisplayName || null,
						threadParentPreview: threadParentPreview || null
					}).catch(() => undefined);
					return { success: true, event_id: response.event_id };
				})
				.catch(() => {
					return sendMatrixMessageViaRest(
						sessionId,
						messageData,
						matrixRoomId,
						threadRootId,
						supervisorMessage,
						senderDisplayName,
						threadParentPreview
					);
				});
		}

		// Fallback: Use REST API if Matrix client not available
		// console.log('⚠️ Matrix client not available, using REST API fallback');
		return sendMatrixMessageViaRest(
			sessionId,
			messageData,
			matrixRoomId,
			threadRootId,
			supervisorMessage,
			senderDisplayName,
			threadParentPreview
		);
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
