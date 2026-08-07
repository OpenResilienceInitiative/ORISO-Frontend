import { MatrixEvent, Room } from 'matrix-js-sdk';
import {
	apiPostMessageEventNotification,
	MessageEventNotificationInput
} from '../api/apiPostMessageEventNotification';
import { apiGetSessionRoomBySessionId } from '../api/apiGetSessionRooms';
import {
	isMatrixRoom,
	resolveSessionRoomRouteId
} from '../utils/matrixRoomUtils';
import { getMatrixClientService } from './matrixClientRegistry';
import type {
	MatrixClientService,
	MatrixFileMessageOptions
} from './matrixClientService';

export interface ChatTransportSession {
	rid?: string | null;
	item?: {
		id?: string | number | null;
		matrixRoomId?: string | null;
	};
}

export interface ResolvedChatTransportSession {
	isMatrixSession: boolean;
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
	/**
	 * Relations foundation (#435): event id of the message being replied to.
	 * Sent as `m.relates_to`/`m.in_reply_to` on the Matrix event content —
	 * never forwarded to the metadata notification (FE-H01 boundary).
	 */
	replyToEventId?: string | null;
	/** Intentional mentions (#435): resolved Matrix user ids, sent as m.mentions. */
	mentionedUserIds?: string[];
	supervisorMessage?: boolean;
	senderDisplayName?: string | null;
	teamDiscussion?: boolean;
	matrixClientServiceOverride?: MatrixClientService | null;
}

export interface EditTextMessageOptions {
	matrixRoomId: string;
	targetEventId: string;
	message: string;
	matrixClientServiceOverride?: MatrixClientService | null;
}

export interface SendReactionOptions {
	matrixRoomId: string;
	targetEventId: string;
	key: string;
	matrixClientServiceOverride?: MatrixClientService | null;
}

export interface RemoveReactionOptions {
	matrixRoomId: string;
	reactionEventId: string;
	matrixClientServiceOverride?: MatrixClientService | null;
}

export interface RedactMessageOptions {
	matrixRoomId: string;
	targetEventId: string;
	matrixClientServiceOverride?: MatrixClientService | null;
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
type DecryptionListener = (event: MatrixEvent, error?: Error) => void;
type PendingDecryption = {
	listener: DecryptionListener;
	timeout: ReturnType<typeof setTimeout>;
};

export type MatrixRoomLifecycleChange =
	| {
			type: 'myMembership';
			membership: string;
			prevMembership?: string;
	  }
	| { type: 'tombstoned' };

class ChatTransportService {
	public resolveSession(
		session?: ChatTransportSession | null
	): ResolvedChatTransportSession {
		const rid = session?.rid || null;
		const matrixRoomId = isMatrixRoom(rid)
			? rid
			: session?.item?.matrixRoomId || null;
		const sessionId = session?.item?.id ?? null;

		return {
			isMatrixSession: Boolean(
				matrixRoomId || ((!rid || isMatrixRoom(rid)) && sessionId)
			),
			matrixRoomId,
			sessionId
		};
	}

	public async sendTextMessage({
		message,
		matrixRoomId,
		sessionId,
		threadRootId,
		replyToEventId,
		mentionedUserIds,
		supervisorMessage,
		senderDisplayName,
		teamDiscussion,
		matrixClientServiceOverride
	}: SendTextMessageOptions): Promise<any> {
		let resolvedMatrixRoomId = matrixRoomId;
		if (!resolvedMatrixRoomId && sessionId) {
			const { sessions } = await apiGetSessionRoomBySessionId(sessionId);
			resolvedMatrixRoomId = resolveSessionRoomRouteId(
				sessions?.[0]?.session
			);
		}

		// Matrix is the only chat transport. Sessions without a Matrix room
		// (stale pre-migration data) fail gracefully instead of falling back
		// to the removed REST path.
		if (!resolvedMatrixRoomId) {
			return Promise.reject(
				new Error('Cannot send message: session has no Matrix room')
			);
		}

		const matrixClientService =
			matrixClientServiceOverride || getMatrixClientService();
		if (!matrixClientService?.getClient()) {
			return Promise.reject(new Error('Matrix client not initialized'));
		}

		const response = await matrixClientService.sendMessage(
			resolvedMatrixRoomId,
			message,
			{
				replyToEventId: replyToEventId || null,
				threadRootId: threadRootId || null,
				mentionedUserIds
			}
		);

		// SECURITY (FE-H01): never forward plaintext message content
		// (messagePreview / threadParentPreview) across the Matrix privacy
		// boundary. Only non-content metadata is sent.
		apiPostMessageEventNotification({
			roomId: resolvedMatrixRoomId,
			matrixRoom: true,
			threadRootId: threadRootId || null,
			supervisorMessage: !!supervisorMessage,
			senderDisplayName: senderDisplayName || null,
			teamDiscussion: !!teamDiscussion,
			mentionedUserIds: mentionedUserIds || null,
			// #942: the event id keys backend deduplication against the
			// server-side Matrix listener announcing the same message.
			matrixEventId: response?.event_id || null
		}).catch(() => undefined);

		return { success: true, event_id: response.event_id };
	}

	/** Edit a previously sent message (m.replace), same relations mechanic as reply/thread. */
	public async editTextMessage({
		matrixRoomId,
		targetEventId,
		message,
		matrixClientServiceOverride
	}: EditTextMessageOptions): Promise<any> {
		const matrixClientService =
			matrixClientServiceOverride || getMatrixClientService();
		if (!matrixClientService?.getClient()) {
			return Promise.reject(new Error('Matrix client not initialized'));
		}

		const response = await matrixClientService.editMessage(
			matrixRoomId,
			targetEventId,
			message
		);

		return { success: true, event_id: response.event_id };
	}

	/** React to a message (m.annotation). */
	public async sendReaction({
		matrixRoomId,
		targetEventId,
		key,
		matrixClientServiceOverride
	}: SendReactionOptions): Promise<any> {
		const matrixClientService =
			matrixClientServiceOverride || getMatrixClientService();
		if (!matrixClientService?.getClient()) {
			return Promise.reject(new Error('Matrix client not initialized'));
		}

		const response = await matrixClientService.sendReaction(
			matrixRoomId,
			targetEventId,
			key
		);

		return { success: true, event_id: response.event_id };
	}

	/** Remove a reaction by redacting the reaction event (un-react). */
	public async removeReaction({
		matrixRoomId,
		reactionEventId,
		matrixClientServiceOverride
	}: RemoveReactionOptions): Promise<any> {
		const matrixClientService =
			matrixClientServiceOverride || getMatrixClientService();
		if (!matrixClientService?.getClient()) {
			return Promise.reject(new Error('Matrix client not initialized'));
		}

		const response = await matrixClientService.redactEvent(
			matrixRoomId,
			reactionEventId
		);

		return { success: true, event_id: response.event_id };
	}

	/** Delete a message by redacting the Matrix event (#827). */
	public async redactMessage({
		matrixRoomId,
		targetEventId,
		matrixClientServiceOverride
	}: RedactMessageOptions): Promise<any> {
		const matrixClientService =
			matrixClientServiceOverride || getMatrixClientService();
		if (!matrixClientService?.getClient()) {
			return Promise.reject(new Error('Matrix client not initialized'));
		}

		const response = await matrixClientService.redactEvent(
			matrixRoomId,
			targetEventId
		);

		return { success: true, event_id: response.event_id };
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
			senderDisplayName: options.senderDisplayName || null,
			matrixEventId: response?.event_id || null
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
		const pendingDecryptions = new Map<MatrixEvent, PendingDecryption>();
		let detached = false;
		const clearPendingDecryption = (event: MatrixEvent) => {
			const pending = pendingDecryptions.get(event);
			if (!pending) return;
			clearTimeout(pending.timeout);
			event.off('Event.decrypted' as any, pending.listener as any);
			pendingDecryptions.delete(event);
		};

		const handleTimeline = (
			event: MatrixEvent,
			room: Room,
			toStartOfTimeline: boolean
		) => {
			if (detached || room?.roomId !== matrixRoomId) {
				return;
			}
			listener(event, room, toStartOfTimeline);

			if (
				detached ||
				toStartOfTimeline ||
				event.getType() !== 'm.room.encrypted' ||
				pendingDecryptions.has(event)
			) {
				return;
			}

			const handleDecrypted = (
				decryptedEvent: MatrixEvent,
				error?: Error
			) => {
				if (error || decryptedEvent.getType() === 'm.room.encrypted') {
					return;
				}
				clearPendingDecryption(event);
				listener(decryptedEvent, room, false);
			};

			const timeout = setTimeout(
				() => clearPendingDecryption(event),
				5 * 60 * 1000
			);
			pendingDecryptions.set(event, {
				listener: handleDecrypted,
				timeout
			});
			event.on('Event.decrypted' as any, handleDecrypted as any);
			if (event.getType() !== 'm.room.encrypted') {
				handleDecrypted(event);
			}
		};

		(matrixClient as any).on('Room.timeline', handleTimeline);

		return () => {
			detached = true;
			(matrixClient as any).off('Room.timeline', handleTimeline);
			Array.from(pendingDecryptions.keys()).forEach(
				clearPendingDecryption
			);
		};
	}

	/**
	 * Watch room-lifecycle signals that end the user's participation in a
	 * room: own-membership changes to leave/ban (kick, ban or a room purge
	 * via the Synapse admin API) and m.room.tombstone state events (room
	 * shut down / replaced). This replaces the legacy
	 * `subscriptions-changed` "removed" notify stream.
	 */
	public onMatrixRoomLifecycle(
		matrixRoomId: string,
		listener: (change: MatrixRoomLifecycleChange) => void
	): (() => void) | null {
		const matrixClient = getMatrixClientService()?.getClient?.();
		if (!matrixClient) {
			return null;
		}

		const handleMyMembership = (
			room: Room,
			membership: string,
			prevMembership?: string
		) => {
			if (room?.roomId !== matrixRoomId) {
				return;
			}
			if (membership !== 'leave' && membership !== 'ban') {
				return;
			}
			listener({ type: 'myMembership', membership, prevMembership });
		};

		const handleTimeline = (event: MatrixEvent, room: Room) => {
			if (room?.roomId !== matrixRoomId) {
				return;
			}
			if (event?.getType?.() !== 'm.room.tombstone') {
				return;
			}
			listener({ type: 'tombstoned' });
		};

		(matrixClient as any).on('Room.myMembership', handleMyMembership);
		(matrixClient as any).on('Room.timeline', handleTimeline);

		return () => {
			(matrixClient as any).off('Room.myMembership', handleMyMembership);
			(matrixClient as any).off('Room.timeline', handleTimeline);
		};
	}

	/**
	 * Members of a Matrix room. The client syncs with lazyLoadMembers, so
	 * the cached member list can be partial until loadMembersIfNeeded()
	 * fetched the full membership state from the homeserver.
	 */
	public async loadMatrixRoomMembers(matrixRoomId: string): Promise<any[]> {
		const room = this.getMatrixRoom(matrixRoomId);
		if (!room) {
			return [];
		}
		try {
			await (room as any).loadMembersIfNeeded?.();
		} catch {
			// fall back to the (possibly partial) cached member list
		}
		return room.getMembers?.() || [];
	}

	/**
	 * Watch membership updates of a room (join/leave/ban/invite and lazy-load
	 * completion) so member-driven UI can re-read the member list.
	 */
	public onMatrixRoomMembers(
		matrixRoomId: string,
		listener: () => void
	): (() => void) | null {
		const matrixClient = getMatrixClientService()?.getClient?.();
		if (!matrixClient) {
			return null;
		}

		const handleRoomStateMembers = (_event: any, state: any) => {
			if (state?.roomId && state.roomId !== matrixRoomId) {
				return;
			}
			listener();
		};
		const handleMembership = (_event: any, member: any) => {
			if (member?.roomId && member.roomId !== matrixRoomId) {
				return;
			}
			listener();
		};

		(matrixClient as any).on('RoomState.members', handleRoomStateMembers);
		(matrixClient as any).on('RoomMember.membership', handleMembership);

		return () => {
			(matrixClient as any).off(
				'RoomState.members',
				handleRoomStateMembers
			);
			(matrixClient as any).off(
				'RoomMember.membership',
				handleMembership
			);
		};
	}

	public sendTyping(roomId: string, typing: boolean): Promise<void> {
		return (
			getMatrixClientService()?.sendTyping(roomId, typing) ||
			Promise.resolve()
		);
	}

	/**
	 * Send a Matrix read receipt for the latest event of the room.
	 * Safe no-op when the Matrix client or room is not available —
	 * there is no legacy fallback transport.
	 */
	public async markRoomAsRead(matrixRoomId: string): Promise<void> {
		const matrixClient = getMatrixClientService()?.getClient?.();
		if (!matrixClient || !matrixRoomId) {
			return;
		}

		const room = matrixClient.getRoom?.(matrixRoomId);
		const events = room?.getLiveTimeline?.()?.getEvents?.() || [];
		const latestEvent = events[events.length - 1];
		if (!latestEvent) {
			return;
		}

		try {
			await (matrixClient as any).sendReadReceipt(latestEvent);
		} catch {
			// keep UI responsive; the receipt is retried on the next read
		}
	}
}

export const chatTransportService = new ChatTransportService();
