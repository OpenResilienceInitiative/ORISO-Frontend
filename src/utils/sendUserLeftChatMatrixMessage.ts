import {
	SYSTEM_NOTIFICATION_PREFIX,
	SYSTEM_NOTIFICATION_USER_LEFT_CHAT
} from '../components/message/messageConstants';

export const sendUserLeftChatMatrixMessage = async (
	matrixRoomId: string | null | undefined,
	username: string | null | undefined
): Promise<void> => {
	if (!matrixRoomId) {
		return;
	}

	const payload = JSON.stringify({
		type: SYSTEM_NOTIFICATION_USER_LEFT_CHAT,
		username: username || ''
	});
	const body = `${SYSTEM_NOTIFICATION_PREFIX}${payload}`;

	try {
		const matrixClientService = (window as any).matrixClientService;
		const client = matrixClientService?.getClient?.();
		if (client) {
			await (client as any).sendMessage(matrixRoomId, {
				msgtype: 'm.text',
				body
			});
		}
	} catch {
		/* best-effort before finish/logout */
	}
};
