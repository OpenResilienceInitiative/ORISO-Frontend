import { endpoints, apiUrl } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

export const apiSendMessage = (
	messageData: string,
	rcGroupIdOrSessionId: string | number,
	sendMailNotification: boolean,
	isEncrypted: boolean,
	sessionId?: number,
	matrixRoomId?: string  // NEW: Accept Matrix room ID directly
): Promise<any> => {
	// MATRIX MIGRATION: Use Matrix SDK directly for INSTANT local echo (like Element!)
	if (sessionId && matrixRoomId) {
		console.log('🚀 MATRIX: Sending message via Matrix SDK for INSTANT sync');
		
		// Get Matrix client
		const matrixClientService = (window as any).matrixClientService;
		
		if (matrixClientService) {
			const client = matrixClientService.getClient();
			
			if (client) {
				console.log('✅ Sending via Matrix SDK to room:', matrixRoomId);
				
				// Send via Matrix SDK (this gives INSTANT local echo!)
				return (client as any).sendMessage(matrixRoomId, {
					msgtype: 'm.text',
					body: messageData
				}).then((response: any) => {
					console.log('✅ Matrix SDK send complete - Room.timeline will fire INSTANTLY!');
					
					// The Room.timeline event fires IMMEDIATELY with the sent message!
					// This is how Element achieves instant sync!
					
					return { success: true, event_id: response.event_id };
				}).catch((error: any) => {
					console.error('❌ Matrix SDK send failed, using REST API fallback:', error);
					const matrixUrl = `${apiUrl}/service/matrix/sessions/${sessionId}/messages`;
					return fetchData({
						url: matrixUrl,
						method: FETCH_METHODS.POST,
						bodyData: JSON.stringify({ message: messageData }),
						responseHandling: []
					});
				});
			}
		}
		
		// Fallback: Use REST API if Matrix client not available
		console.log('⚠️ Matrix client not available, using REST API fallback');
		const matrixUrl = `${apiUrl}/service/matrix/sessions/${sessionId}/messages`;
		return fetchData({
			url: matrixUrl,
			method: FETCH_METHODS.POST,
			bodyData: JSON.stringify({ message: messageData }),
			responseHandling: []
		}).then((response) => {
			console.log('🚀 MATRIX: Message sent via REST API:', response);
			return response;
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
