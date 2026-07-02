import { MatrixFileMessageOptions } from '../services/matrixClientService';
import { getMatrixClientService } from '../services/matrixClientRegistry';
import {
	apiPostMessageEventNotification,
	MessageEventNotificationInput
} from './apiPostMessageEventNotification';
import { chatTransportService } from '../services/chatTransportService';

export interface SendMatrixAttachmentMessageOptions
	extends MatrixFileMessageOptions {
	threadRootId?: string | null;
	supervisorMessage?: boolean;
	senderDisplayName?: string | null;
}

type PostMessageEventNotification = (
	input: MessageEventNotificationInput
) => Promise<any>;

export const apiSendMatrixAttachmentMessage = async (
	matrixRoomId: string,
	file: File,
	options: SendMatrixAttachmentMessageOptions = {},
	postMessageEventNotification: PostMessageEventNotification = apiPostMessageEventNotification
): Promise<any> => {
	if (chatTransportService.isFacadeEnabled()) {
		return chatTransportService.sendFileMessage(matrixRoomId, file, {
			...options,
			postMessageEventNotification
		});
	}

	const response = await getMatrixClientService()?.sendFileMessage(
		matrixRoomId,
		file,
		{
			abortController: options.abortController,
			uploadProgress: options.uploadProgress
		}
	);

	// SECURITY (FE-H01): never forward plaintext message content
	// (threadParentPreview) across the Matrix privacy boundary. Only
	// non-content metadata is sent.
	postMessageEventNotification({
		roomId: matrixRoomId,
		matrixRoom: true,
		threadRootId: options.threadRootId || null,
		supervisorMessage: !!options.supervisorMessage,
		senderDisplayName: options.senderDisplayName || null
	}).catch(() => undefined);

	return response;
};
