import { MatrixEvent, Room } from 'matrix-js-sdk';
import {
	apiPostMessageEventNotification,
	MessageEventNotificationInput
} from '../api/apiPostMessageEventNotification';
import { FETCH_METHODS, fetchData } from '../api/fetchData';
import { endpoints } from '../resources/scripts/endpoints';
import { appConfig } from '../utils/appConfig';
import { isMatrixRoom } from '../utils/matrixRoomUtils';
import { getMatrixClientService } from './matrixClientRegistry';
import { MatrixFileMessageOptions } from './matrixClientService';

export interface ChatTransportConfig {
	featureChatTransportFacadeEnabled?: boolean;
}

export interface ChatTransportSession {
	rid?: string | null;
	item?: {
		id?: string | number | null;
		matrixRoomId?: string | null;
	};
}

export interface ResolvedChatTransportSession {
	isMatrixSession: boolean;
	legacyRoomId?: string | number | null;
	matrixRoomId?: string | null;
	sessionId?: string | number | null;
}

export interface SendTextMessageOptions {
	roomIdOrSessionId: string | number;
	message: string;
	sendMailNotification: boolean;
	isEncrypted: boolean;
	sessionId?: number;
	matrixRoomId?: string;
	threadRootId?: string | null;
	supervisorMessage?: boolean;
	senderDisplayName?: string | null;
}

export interface SendFileMessageOptions extends MatrixFileMessageOptions {
	threadRootId?: string | null;
	supervisorMessage?: boolean;
	senderDisplayName?: string | null;
	postMessageEventNotification?: (
		input: MessageEventNotificationInput
	) => Promise<any>;
}

type TimelineListener = (
	event: MatrixEvent,
	room: Room,
	toStartOfTimeline: boolean
) => void;

class ChatTransportService {
	public isFacadeEnabled(
		config: ChatTransportConfig | null = appConfig
	): boolean {
		return config?.featureChatTransportFacadeEnabled === true;
	}

	public resolveSession(
		session?: ChatTransportSession | null
	): ResolvedChatTransportSession {
		const rid = session?.rid || null;
		const matrixRoomId = isMatrixRoom(rid)
			? rid
			: session?.item?.matrixRoomId || null;
		const sessionId = session?.item?.id || null;

		return {
			isMatrixSession: Boolean(
				matrixRoomId || ((!rid || isMatrixRoom(rid)) && sessionId)
			),
			legacyRoomId: rid || sessionId,
			matrixRoomId,
			sessionId
		};
	}

	public async sendTextMessage({
		roomIdOrSessionId,
		message,
		sendMailNotification,
		isEncrypted,
		sessionId,
		matrixRoomId,
		threadRootId,
		supervisorMessage,
		senderDisplayName
	}: SendTextMessageOptions): Promise<any> {
		if (sessionId && matrixRoomId) {
			const matrixClientService = getMatrixClientService();
			if (!matrixClientService?.getClient()) {
				return Promise.reject(
					new Error('Matrix client not initialized')
				);
			}

			const response = await matrixClientService.sendMessage(
				matrixRoomId,
				message
			);

			apiPostMessageEventNotification({
				roomId: matrixRoomId,
				matrixRoom: true,
				threadRootId: threadRootId || null,
				supervisorMessage: !!supervisorMessage,
				senderDisplayName: senderDisplayName || null
			}).catch(() => undefined);

			return { success: true, event_id: response.event_id };
		}

		return fetchData({
			url: endpoints.sendMessage,
			method: FETCH_METHODS.POST,
			headersData: { rcGroupId: roomIdOrSessionId },
			rcValidation: true,
			bodyData: JSON.stringify({
				message,
				t: isEncrypted ? 'e2e' : '',
				sendNotification: sendMailNotification
			})
		});
	}

	public async sendFileMessage(
		matrixRoomId: string,
		file: File,
		options: SendFileMessageOptions = {}
	): Promise<any> {
		const response = await getMatrixClientService()?.sendFileMessage(
			matrixRoomId,
			file,
			{
				abortController: options.abortController,
				uploadProgress: options.uploadProgress
			}
		);

		const postMessageEventNotification =
			options.postMessageEventNotification ||
			apiPostMessageEventNotification;

		postMessageEventNotification({
			roomId: matrixRoomId,
			matrixRoom: true,
			threadRootId: options.threadRootId || null,
			supervisorMessage: !!options.supervisorMessage,
			senderDisplayName: options.senderDisplayName || null
		}).catch(() => undefined);

		return response;
	}

	public getMatrixRoom(matrixRoomId: string): Room | null {
		return (
			getMatrixClientService()?.getClient?.()?.getRoom?.(matrixRoomId) ||
			null
		);
	}

	public getMatrixRoomMessages(
		matrixRoomId: string,
		limit: number
	): MatrixEvent[] {
		return (
			getMatrixClientService()?.getRoomMessages?.(matrixRoomId, limit) ||
			[]
		);
	}

	public onMatrixTimeline(
		matrixRoomId: string,
		listener: TimelineListener
	): (() => void) | null {
		const matrixClient = getMatrixClientService()?.getClient?.();
		if (!matrixClient) {
			return null;
		}

		const handleTimeline = (
			event: MatrixEvent,
			room: Room,
			toStartOfTimeline: boolean
		) => {
			if (room?.roomId !== matrixRoomId) {
				return;
			}
			listener(event, room, toStartOfTimeline);
		};

		(matrixClient as any).on('Room.timeline', handleTimeline);

		return () => {
			(matrixClient as any).off('Room.timeline', handleTimeline);
		};
	}

	public sendTyping(roomId: string, typing: boolean): Promise<void> {
		return (
			getMatrixClientService()?.sendTyping(roomId, typing) ||
			Promise.resolve()
		);
	}
}

export const chatTransportService = new ChatTransportService();
