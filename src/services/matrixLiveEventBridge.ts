import { MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk';
import { callManager } from './CallManager';

/**
 * Bridge between Matrix events and the existing LiveService WebSocket system.
 * This service listens to Matrix Room.timeline events and triggers appropriate
 * actions in the frontend (simulating what LiveService would do).
 */
export class MatrixLiveEventBridge {
	private client: MatrixClient | null = null;
	private eventCallbacks: Map<string, Set<(event: any) => void>> = new Map();
	private initialized = false;
	private processedCallInvites = new Set<string>();

	public initialize(client: MatrixClient): void {
		if (this.initialized) {
			return;
		}

		this.client = client;
		this.setupEventListeners();
		this.initialized = true;
	}

	private setupEventListeners(): void {
		if (!this.client) {
			return;
		}

		this.client.on(
			'Room.timeline' as any,
			(event: MatrixEvent, room: Room, toStartOfTimeline: boolean) => {
				if (toStartOfTimeline) {
					return;
				}

				switch (event.getType()) {
					case 'm.room.message':
					case 'm.room.encrypted':
						this.handleRoomMessage(event, room);
						break;

					case 'm.call.invite':
						this.handleCallInvite(event, room);
						break;

					case 'm.call.answer':
						this.handleCallAnswer(event, room);
						break;

					case 'm.call.hangup':
						this.handleCallHangup(event, room);
						break;

					default:
						break;
				}
			}
		);
	}

	private handleRoomMessage(event: MatrixEvent, room: Room): void {
		const sender = event.getSender();
		const content = event.getContent();
		const myUserId = this.client?.getUserId();

		this.triggerEvent('directMessage', {
			roomId: room.roomId,
			sender,
			isOwnMessage: sender === myUserId,
			msgtype: content.msgtype,
			body: content.body,
			eventId: event.getId(),
			timestamp: event.getTs()
		});
	}

	private isVideoCallInvite(content: Record<string, any>): boolean {
		if (typeof content.is_video === 'boolean') {
			return content.is_video;
		}

		const sdp = content.offer?.sdp;
		if (typeof sdp === 'string' && sdp.length > 0) {
			return /\nm=video [1-9]/.test(sdp);
		}

		return false;
	}

	private handleCallInvite(event: MatrixEvent, room: Room): void {
		const sender = event.getSender();
		const content = event.getContent();
		const callId = content.call_id;
		const ageSeconds = Math.floor((Date.now() - event.getTs()) / 1000);
		const callRoomId = content.call_room_id || room.roomId;

		if (ageSeconds > 10) {
			this.processedCallInvites.add(callId);
			return;
		}

		if (this.processedCallInvites.has(callId)) {
			return;
		}

		if (sender === this.client?.getUserId()) {
			this.processedCallInvites.add(callId);
			return;
		}

		const isGroupCall = content.is_group_call === true;
		const isVideo = this.isVideoCallInvite(content);

		this.processedCallInvites.add(callId);

		callManager.receiveCall(
			isGroupCall ? callRoomId : room.roomId,
			isVideo,
			callId,
			sender,
			isGroupCall,
			room.roomId
		);
	}

	private handleCallAnswer(event: MatrixEvent, room: Room): void {
		const content = event.getContent();

		this.triggerEvent('callAnswered', {
			roomId: room.roomId,
			sender: event.getSender(),
			callId: content.call_id
		});
	}

	private handleCallHangup(event: MatrixEvent, _room: Room): void {
		const ageSeconds = Math.floor((Date.now() - event.getTs()) / 1000);

		if (ageSeconds > 10) {
			return;
		}

		callManager.endCall();
	}

	public on(eventType: string, callback: (event: any) => void): void {
		if (!this.eventCallbacks.has(eventType)) {
			this.eventCallbacks.set(eventType, new Set());
		}
		this.eventCallbacks.get(eventType)!.add(callback);
	}

	public off(eventType: string, callback: (event: any) => void): void {
		this.eventCallbacks.get(eventType)?.delete(callback);
	}

	private triggerEvent(eventType: string, eventData: any): void {
		const callbacks = this.eventCallbacks.get(eventType);
		if (!callbacks?.size) {
			return;
		}

		callbacks.forEach((callback) => {
			try {
				callback(eventData);
			} catch {
				// Ignore callback errors so one listener cannot break the bridge.
			}
		});
	}

	public getClient(): MatrixClient | null {
		return this.client;
	}

	public isInitialized(): boolean {
		return this.initialized;
	}

	public destroy(): void {
		if (this.client) {
			this.client.removeAllListeners('Room.timeline' as any);
		}
		this.eventCallbacks.clear();
		this.initialized = false;
		this.client = null;
	}
}

export const matrixLiveEventBridge = new MatrixLiveEventBridge();
