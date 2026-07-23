import { MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk';

type CallManagerModule = typeof import('./CallManager');

const getCallManager = (): CallManagerModule['callManager'] => {
	// Lazy load to avoid circular import with matrixClientService at module init.
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	return require('./CallManager').callManager;
};

const isVideoCallInvite = (content: Record<string, unknown>): boolean => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { isVideoCallFromMatrixInviteContent } =
		require('../utils/videoCallHelpers') as typeof import('../utils/videoCallHelpers');
	return isVideoCallFromMatrixInviteContent(content);
};

/**
 * Bridge between Matrix events and the existing LiveService WebSocket system.
 * This service listens to Matrix Room.timeline events and triggers appropriate
 * actions in the frontend (simulating what LiveService would do).
 */
export class MatrixLiveEventBridge {
	private client: MatrixClient | null = null;
	private eventCallbacks: Map<string, Set<(event: any) => void>> = new Map();
	private initialized: boolean = false;
	private processedCallInvites: Set<string> = new Set(); // Track processed call IDs
	private pendingEncryptedEvents = new Map<
		MatrixEvent,
		{
			listener: (event: MatrixEvent, error?: Error) => void;
			timeout: ReturnType<typeof setTimeout>;
		}
	>();

	/**
	 * Initialize the bridge with a Matrix client.
	 * This sets up event listeners for real-time Matrix events.
	 */
	public initialize(client: MatrixClient): void {
		this.reinitialize(client);
	}

	/** Detach from the previous client and bind listeners to the active client. */
	public reinitialize(client: MatrixClient): void {
		if (this.client === client && this.initialized) {
			return;
		}

		if (this.client && this.client !== client) {
			this.client.removeAllListeners('Room.timeline' as any);
			this.client.removeAllListeners('sync' as any);
			this.clearPendingEncryptedEvents();
		}

		this.client = client;
		this.processedCallInvites.clear();
		this.setupEventListeners();
		this.initialized = true;

		// console.log("✅ MatrixLiveEventBridge initialized - listening to Matrix events");
	}

	/**
	 * Set up listeners for Matrix events.
	 */
	private setupEventListeners(): void {
		if (!this.client) {
			return;
		}

		// Listen to Room.timeline events (new messages, state changes)
		this.client.on(
			'Room.timeline' as any,
			(event: MatrixEvent, room: Room, toStartOfTimeline: boolean) => {
				// Ignore historical events (when scrolling back)
				if (toStartOfTimeline) {
					return;
				}

				this.dispatchTimelineEvent(event, room);
			}
		);

		// Listen to sync state changes
		this.client.on(
			'sync' as any,
			(state: string, prevState: string | null) => {
				// console.log("🔄 Matrix sync state:", state, "(previous:", prevState, ")");
			}
		);
	}

	private dispatchTimelineEvent(
		event: MatrixEvent,
		room: Room,
		fromDecryptionRetry = false
	): void {
		switch (event.getType()) {
			case 'm.room.message':
				if (!fromDecryptionRetry) {
					this.handleRoomMessage(event, room);
				}
				break;

			case 'm.room.encrypted':
				// Room.timeline can fire before Rust-Crypto has the Megolm key.
				// Keep the existing metadata refresh, but also redispatch the clear
				// event when a later decryption retry succeeds.
				this.handleRoomMessage(event, room);
				this.waitForSuccessfulDecryption(event, room);
				break;

			case 'm.call.invite':
			case 'org.oriso.call.invite':
				this.handleCallInvite(event, room, fromDecryptionRetry);
				break;

			case 'm.call.hangup':
			case 'org.oriso.call.hangup':
				this.handleCallHangup(event, room);
				break;

			default:
				break;
		}
	}

	private waitForSuccessfulDecryption(event: MatrixEvent, room: Room): void {
		if (this.pendingEncryptedEvents.has(event)) return;

		let completed = false;
		let timeout: ReturnType<typeof setTimeout>;
		const cleanup = () => {
			event.off('Event.decrypted' as any, listener as any);
			clearTimeout(timeout);
			this.pendingEncryptedEvents.delete(event);
		};
		const listener = (decryptedEvent: MatrixEvent, error?: Error) => {
			// Rust-Crypto emits Event.decrypted for a failed attempt too. Keep
			// listening so receipt of a delayed room key can retry successfully.
			if (
				completed ||
				error ||
				decryptedEvent.getType() === 'm.room.encrypted'
			) {
				return;
			}

			completed = true;
			cleanup();
			this.dispatchTimelineEvent(decryptedEvent, room, true);
		};

		event.on('Event.decrypted' as any, listener as any);
		timeout = setTimeout(
			() => {
				completed = true;
				cleanup();
			},
			5 * 60 * 1000
		);
		this.pendingEncryptedEvents.set(event, { listener, timeout });

		// Close the small race where decryption finishes between the initial
		// type check and listener registration.
		if (event.getType() !== 'm.room.encrypted') {
			listener(event);
		}
	}

	private clearPendingEncryptedEvents(): void {
		this.pendingEncryptedEvents.forEach(({ listener, timeout }, event) => {
			event.off('Event.decrypted' as any, listener as any);
			clearTimeout(timeout);
		});
		this.pendingEncryptedEvents.clear();
	}

	/**
	 * Handle m.room.message events (new messages).
	 */
	private handleRoomMessage(event: MatrixEvent, room: Room): void {
		const sender = event.getSender();
		const { msgtype } = event.getContent();

		const myUserId = this.client?.getUserId();
		const isOwnMessage = sender === myUserId;

		// console.log("📬 New message from", sender, "in room", room.roomId);

		// Trigger only metadata needed to refresh/touch lists. Matrix message
		// bodies stay inside the Matrix session renderer and are never bridged
		// into legacy LiveService-style events.
		this.triggerEvent('directMessage', {
			roomId: room.roomId,
			sender: sender,
			isOwnMessage: isOwnMessage,
			msgtype: msgtype,
			eventId: event.getId(),
			timestamp: event.getTs()
		});
	}

	/**
	 * Handle m.call.invite events (incoming calls).
	 */
	private handleCallInvite(
		event: MatrixEvent,
		room: Room,
		_fromDecryptionRetry = false
	): void {
		const sender = event.getSender();
		const content = event.getContent();
		const callId = content.call_id;
		const eventTimestamp = event.getTs();
		const now = Date.now();
		const ageSeconds = Math.floor((now - eventTimestamp) / 1000);
		const callRoomId = content.call_room_id || room.roomId;

		// console.log("═══════════════════════════════════════════════");
		// console.log("🔔 CALL INVITE EVENT RECEIVED");
		// console.log("═══════════════════════════════════════════════");
		// console.log("📞 Call ID:", callId);
		// console.log("👤 Sender:", sender);
		// console.log("🏠 Room:", room.roomId);
		// console.log("⏰ Event timestamp:", new Date(eventTimestamp).toISOString());
		// console.log("⏱️  Age:", ageSeconds, "seconds old");
		// console.log("═══════════════════════════════════════════════");

		// CRITICAL: Ignore old call invites (> 10 seconds = from history/replay!)
		// This prevents phantom notifications on login/reload
		if (ageSeconds > 10) {
			// console.log("🚫 IGNORING OLD CALL INVITE (from history, not a new call!)");
			// console.log("═══════════════════════════════════════════════");
			this.processedCallInvites.add(callId);
			return;
		}

		// CRITICAL: Check if we've already processed this call invite (prevent duplicate!)
		if (this.processedCallInvites.has(callId)) {
			// console.log("🚫 DUPLICATE CALL INVITE (already processed)");
			// console.log("═══════════════════════════════════════════════");
			return;
		}

		// Don't notify for our own call initiations
		const myUserId = this.client?.getUserId();
		// console.log("🔍 Checking sender - My ID:", myUserId);

		if (sender === myUserId) {
			// console.log("🚫 OWN CALL INVITE (not showing notification to myself)");
			// console.log("═══════════════════════════════════════════════");
			this.processedCallInvites.add(callId);
			return;
		}

		// Check if this is an Element Call / LiveKit call (custom field)
		const isGroupCall = content.is_group_call === true;
		const isElementCall = content.is_element_call === true || isGroupCall;
		const isVideo = isElementCall
			? content.is_video !== false
			: isVideoCallInvite(content);

		if (isElementCall) {
			// console.log("✅ LIVEKIT GROUP CALL DETECTED!");
			// console.log("📞 From:", sender);
			// console.log("📞 To me:", myUserId);
			// console.log("🎥 Is Video:", isVideo);
			// console.log("🏠 Element Call room:", callRoomId);

			// Mark as processed BEFORE triggering event
			this.processedCallInvites.add(callId);
			// console.log("✅ Marked as processed (won't process again)");

			// Use CallManager directly (clean architecture!)
			// console.log("🔔 CALLING CallManager.receiveCall()");
			// console.log("═══════════════════════════════════════════════");

			getCallManager().receiveCall(
				callRoomId,
				isVideo,
				callId,
				sender,
				isGroupCall,
				room.roomId,
				true
			);
			return;
		}

		// console.log("✅ VALID NEW INCOMING CALL (Matrix WebRTC)!");
		// console.log("📞 From:", sender);
		// console.log("📞 To me:", myUserId);

		// Mark as processed BEFORE triggering event
		this.processedCallInvites.add(callId);
		// console.log("✅ Marked as processed (won't process again)");

		// Use CallManager directly (clean architecture!)
		// console.log("🔔 CALLING CallManager.receiveCall()");
		// console.log("═══════════════════════════════════════════════");

		getCallManager().receiveCall(
			room.roomId,
			isVideo,
			callId,
			sender,
			false,
			room.roomId
		);
	}

	/**
	 * Handle m.call.hangup events.
	 */
	private handleCallHangup(event: MatrixEvent, room: Room): void {
		const eventTimestamp = event.getTs();
		const now = Date.now();
		const ageSeconds = Math.floor((now - eventTimestamp) / 1000);

		// console.log("═══════════════════════════════════════════════");
		// console.log("📴 CALL HANGUP EVENT RECEIVED");
		// console.log("═══════════════════════════════════════════════");
		// console.log("📞 Call ID:", event.getContent().call_id);
		// console.log("👤 Sender:", event.getSender());
		// console.log("🏠 Room:", room.roomId);
		// console.log("⏰ Event timestamp:", new Date(eventTimestamp).toISOString());
		// console.log("⏱️  Age:", ageSeconds, "seconds old");
		// console.log("═══════════════════════════════════════════════");

		// CRITICAL: Ignore old hangup events (> 10 seconds = from history!)
		if (ageSeconds > 10) {
			// console.log("🚫 IGNORING OLD HANGUP EVENT (from history, not a new hangup!)");
			// console.log("═══════════════════════════════════════════════");
			return;
		}

		// console.log("✅ VALID NEW HANGUP EVENT!");
		// console.log("📴 Call ended by", sender);
		// console.log("═══════════════════════════════════════════════");

		// A fresh hangup can still belong to a call that ended moments before a
		// replacement call started. Match the Matrix call_id before mutating the
		// singleton so delayed teardown cannot kill the new call.
		getCallManager().endCallIfMatching(event.getContent().call_id);
	}

	/**
	 * Register a callback for a specific event type.
	 * This allows components to listen to Matrix events.
	 */
	public on(eventType: string, callback: (event: any) => void): void {
		if (!this.eventCallbacks.has(eventType)) {
			this.eventCallbacks.set(eventType, new Set());
		}
		this.eventCallbacks.get(eventType)!.add(callback);

		// console.log(`📡 Registered callback for event type: ${eventType}`);
	}

	/**
	 * Unregister a callback for a specific event type.
	 */
	public off(eventType: string, callback: (event: any) => void): void {
		const callbacks = this.eventCallbacks.get(eventType);
		if (callbacks) {
			callbacks.delete(callback);
		}
	}

	/**
	 * Trigger an event to all registered callbacks.
	 */
	private triggerEvent(eventType: string, eventData: any): void {
		const callbacks = this.eventCallbacks.get(eventType);
		if (callbacks && callbacks.size > 0) {
			// console.log(`🔔 Triggering ${callbacks.size} callback(s) for event: ${eventType}`);
			callbacks.forEach((callback) => {
				try {
					callback(eventData);
				} catch (error) {
					// console.error(`❌ Error in event callback for ${eventType}:`, error);
				}
			});
		} else {
			// console.log(`📭 No callbacks registered for event: ${eventType}`);
		}
	}

	/**
	 * Get the Matrix client instance.
	 */
	public getClient(): MatrixClient | null {
		return this.client;
	}

	/**
	 * Check if the bridge is initialized.
	 */
	public isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Remove listeners and detach from the current client without dropping subscribers.
	 */
	public detach(): void {
		if (this.client) {
			this.client.removeAllListeners('Room.timeline' as any);
			this.client.removeAllListeners('sync' as any);
		}
		this.clearPendingEncryptedEvents();
		this.processedCallInvites.clear();
		this.initialized = false;
		this.client = null;
	}

	/**
	 * Clean up and remove all listeners.
	 */
	public destroy(): void {
		this.detach();
		this.eventCallbacks.clear();

		// console.log("🧹 MatrixLiveEventBridge destroyed");
	}
}

// Singleton instance
export const matrixLiveEventBridge = new MatrixLiveEventBridge();
