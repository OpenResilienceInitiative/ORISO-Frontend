import { MatrixFileMessageOptions } from '../services/matrixClientService';
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
): Promise<any> =>
	chatTransportService.sendFileMessage(matrixRoomId, file, {
		...options,
		postMessageEventNotification
	});
