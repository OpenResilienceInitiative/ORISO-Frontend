/**
 * CallManager - Centralized Call State Management
 *
 * This is a singleton service that manages all Matrix call state.
 * It prevents multiple initializations, race conditions, and ensures
 * clean state transitions.
 */

import { MatrixCall } from 'matrix-js-sdk/lib/webrtc/call';

export type CallState =
	| 'idle'
	| 'ringing'
	| 'connecting'
	| 'connected'
	| 'ended';

export interface CallData {
	callId: string;
	/**
	 * Matrix room that the call itself uses.
	 *  - For 1:1 Matrix WebRTC calls, this is the chat room.
	 *  - For Element Call group calls, this is the dedicated Element Call room.
	 */
	roomId: string;
	isVideo: boolean;
	isIncoming: boolean;
	isGroup?: boolean; // Flag to determine if this is a group call
	callerUserId?: string;
	matrixCall?: MatrixCall;
	state: CallState;
	/**
	 * Optional: the dedicated Element Call room for group calls. For backwards
	 * compatibility, this is usually the same as `roomId`, but we keep it
	 * separate so we can continue to send signalling events in the original
	 * session room while Element Call uses its own room.
	 */
	elementCallRoomId?: string;
	/**
	 * Optional: original signalling/session room where `m.call.invite` was sent.
	 * For 1:1 calls this is identical to `roomId`.
	 */
	signalRoomId?: string;
}

type CallStateChangeListener = (callData: CallData | null) => void;

class CallManager {
	private static instance: CallManager;
	private currentCall: CallData | null = null;
	private listeners: Set<CallStateChangeListener> = new Set();

	private constructor() {}

	public static getInstance(): CallManager {
		if (!CallManager.instance) {
			CallManager.instance = new CallManager();
		}
		return CallManager.instance;
	}

	/**
	 * Subscribe to call state changes
	 */
	public subscribe(listener: CallStateChangeListener): () => void {
		this.listeners.add(listener);

		// Return unsubscribe function
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Notify all listeners of state change
	 */
	private notifyListeners(): void {
		this.listeners.forEach((listener) => {
			try {
				listener(this.currentCall);
			} catch {
				// Ignore listener errors so one subscriber cannot break call state.
			}
		});
	}

	/**
	 * Start an outgoing call
	 * @param roomId - Matrix room ID
	 * @param isVideo - Whether to enable video
	 * @param forceIsGroup - true forces group call, false forces 1-on-1, omit to auto-detect
	 */
	public startCall(
		roomId: string,
		isVideo: boolean,
		forceIsGroup?: boolean
	): void {
		if (this.currentCall) {
			this.endCall();
		}

		let isGroup = false;

		if (forceIsGroup === true) {
			isGroup = true;
		} else if (forceIsGroup === false) {
			isGroup = false;
		} else {
			try {
				const matrixClientService = (window as any).matrixClientService;
				const client = matrixClientService?.getClient();
				const room = client?.getRoom(roomId);

				if (room) {
					const activeMemberCount = room
						.getJoinedMembers()
						.filter((member) => {
							const powerLevel =
								room.getMember(member.userId)?.powerLevel || 0;
							return powerLevel !== 10;
						}).length;

					isGroup = activeMemberCount > 2;
				}
			} catch {}
		}

		const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Run the heavy work asynchronously so callers don't have to `await`
		// but we can still create a dedicated Element Call room before
		// notifying listeners.
		(async () => {
			let elementCallRoomId: string | undefined = undefined;

			// For group calls, create a fresh dedicated Element Call room rather
			// than re-using the session room. This matches the "direct" usage of
			// call.oriso.site where each call lives in its own Matrix room with
			// appropriate power levels.
			if (isGroup) {
				elementCallRoomId = await this.createElementCallRoom(roomId);
			}

			this.currentCall = {
				callId,
				// For group calls this will be the dedicated Element Call room;
				// for 1:1 calls it's the session/chat room.
				roomId: elementCallRoomId || roomId,
				isVideo,
				isIncoming: false,
				isGroup,
				state: 'connecting',
				elementCallRoomId: elementCallRoomId || roomId,
				signalRoomId: roomId
			};

			if (isGroup) {
				void this.ensureGroupCallPermissions(this.currentCall.roomId);

				// Send Matrix call invite event to the original session room so
				// the other participant sees the incoming call notification.
				this.sendGroupCallInvite(
					roomId,
					callId,
					isVideo,
					this.currentCall.roomId
				);
			}

			this.notifyListeners();
		})().catch((err: any) => {
			alert(`Failed to start call: ${(err as Error).message}`);
			this.endCall();
		});
	}

	/**
	 * Create a dedicated Matrix room for an Element Call group call. This
	 * mirrors Element Call's own `createRoom` behaviour closely enough for our
	 * use-case (notably the power levels for `org.matrix.msc3401.call.member`).
	 */
	private async createElementCallRoom(sourceRoomId: string): Promise<string> {
		const matrixClientService = (window as any).matrixClientService;
		const client = matrixClientService?.getClient();

		if (!client) {
			throw new Error(
				'Matrix client not available to create Element Call room'
			);
		}

		const name = `Group call for ${sourceRoomId}`;

		const result = await client.createRoom({
			// Not publicly listed, but we want easy joins via ID
			visibility: 'private',
			// Same as Element Call: a room suitable for group chats
			preset: 'public_chat',
			name,
			power_level_content_override: {
				invite: 100,
				kick: 100,
				ban: 100,
				redact: 50,
				state_default: 0,
				events_default: 0,
				users_default: 0,
				events: {
					'm.room.power_levels': 100,
					'm.room.history_visibility': 100,
					'm.room.tombstone': 100,
					'm.room.encryption': 100,
					'm.room.name': 50,
					'm.room.message': 0,
					'm.room.encrypted': 50,
					'm.sticker': 50,
					// IMPORTANT: allow everyone to send group call membership
					// events so Element Call can join from any participant.
					'org.matrix.msc3401.call.member': 0
				},
				users: {
					[client.getUserId()!]: 100
				}
			}
		} as any);

		return result.room_id;
	}
	/**
	 * Ensure the Matrix room's power levels allow Element Call to send
	 * `org.matrix.msc3401.call.member` state events from normal participants.
	 *
	 * Direct Element Call rooms are created with:
	 *   power_level_content_override.events["org.matrix.msc3401.call.member"] = 0
	 * so that any user (power level 0) can join the MatrixRTC session.
	 *
	 * Our session rooms currently require level 50 for that event which causes
	 * M_FORBIDDEN for users like `ali_user` and leads to "Connection lost".
	 */
	private async ensureGroupCallPermissions(roomId: string): Promise<void> {
		try {
			const matrixClientService = (window as any).matrixClientService;
			const client = matrixClientService?.getClient();

			if (!client) {
				return;
			}

			const room = client.getRoom(roomId);
			if (!room) {
				return;
			}

			const plEvent = room.currentState.getStateEvents(
				'm.room.power_levels',
				''
			) as any;
			const currentContent = plEvent?.getContent?.() || {};
			const events = currentContent.events || {};

			const currentLevelForCallMember =
				events['org.matrix.msc3401.call.member'] ??
				currentContent.state_default ??
				currentContent.events_default ??
				50;

			// If it's already open enough, nothing to do.
			if (currentLevelForCallMember === 0) {
				return;
			}

			const updatedContent = {
				...currentContent,
				events: {
					...events,
					// Match Element Call's own room creation logic: allow everyone
					// to send call membership events so they can join the MatrixRTC session.
					'org.matrix.msc3401.call.member': 0
				}
			};

			// matrix-js-sdk signature: sendStateEvent(roomId, eventType, content, stateKey?)
			// We must NOT pass the content as the stateKey (it becomes "[object Object]" in the URL).
			await client.sendStateEvent(
				roomId,
				'm.room.power_levels',
				updatedContent,
				''
			);
		} catch {
			// Permission updates are best-effort.
		}
	}

	/**
	 * Send m.call.invite event to Matrix room for group calls
	 *
	 * @param signallingRoomId - The existing session/chat room where the invite should appear
	 * @param callId - Logical call identifier
	 * @param isVideo - Whether this is a video call
	 * @param elementCallRoomId - The dedicated Element Call room that should be joined
	 */
	private sendGroupCallInvite(
		signallingRoomId: string,
		callId: string,
		isVideo: boolean,
		elementCallRoomId?: string
	): void {
		try {
			const matrixClientService = (window as any).matrixClientService;
			const client = matrixClientService?.getClient();

			if (!client) {
				return;
			}

			void client
				.sendEvent(signallingRoomId, 'm.call.invite', {
					call_id: callId,
					version: '1',
					lifetime: 60000,
					offer: {
						type: 'offer',
						sdp: ''
					},
					invitee: undefined,
					party_id: client.getDeviceId() || 'unknown',
					is_group_call: true,
					is_video: isVideo,
					call_room_id: elementCallRoomId
				})
				.catch(() => undefined);
		} catch {
			// Invite delivery is best-effort.
		}
	}

	/**
	 * Receive an incoming call
	 *
	 * @param callRoomId - Matrix room used by the call itself (Element Call room for group calls)
	 * @param isVideo - Whether this is a video call
	 * @param callId - Logical call identifier
	 * @param callerUserId - Matrix user id of the caller
	 * @param isGroup - Whether this is a group call (Element Call)
	 * @param signallingRoomId - Optional original session/chat room where the invite was sent
	 */
	public receiveCall(
		callRoomId: string,
		isVideo: boolean,
		callId: string,
		callerUserId: string,
		isGroup: boolean,
		signallingRoomId?: string
	): void {
		if (this.currentCall) {
			return;
		}

		this.currentCall = {
			callId,
			roomId: callRoomId,
			isVideo,
			isIncoming: true,
			isGroup, // Set isGroup for incoming calls
			callerUserId,
			state: 'ringing',
			elementCallRoomId: callRoomId,
			signalRoomId: signallingRoomId || callRoomId
		};

		this.notifyListeners();
	}

	/**
	 * Answer the current incoming call
	 */
	public answerCall(): void {
		if (!this.currentCall) {
			return;
		}

		if (!this.currentCall.isIncoming) {
			return;
		}

		this.currentCall.state = 'connecting';

		this.notifyListeners();
	}

	/**
	 * Reject the current incoming call
	 */
	public rejectCall(): void {
		if (!this.currentCall) {
			return;
		}

		if (this.currentCall.matrixCall) {
			try {
				(this.currentCall.matrixCall as any).reject();
			} catch {
				// Ignore reject errors during cleanup.
			}
		}

		this.currentCall = null;

		this.notifyListeners();
	}

	/**
	 * End the current call
	 */
	public endCall(): void {
		if (!this.currentCall) {
			return;
		}

		// Hangup Matrix call (this will send m.call.hangup event to other side)
		if (this.currentCall.matrixCall) {
			try {
				(this.currentCall.matrixCall as any).hangup();
			} catch {
				// Ignore hangup errors during cleanup.
			}
		}

		// Stop local media streams
		const stream = (window as any).__activeMediaStream;
		if (stream) {
			stream.getTracks().forEach((track: any) => {
				track.stop();
			});
			delete (window as any).__activeMediaStream;
		}

		this.currentCall = null;

		this.notifyListeners();
	}

	/**
	 * Attach Matrix call object to current call
	 */
	public setMatrixCall(matrixCall: MatrixCall): void {
		if (!this.currentCall) {
			return;
		}

		this.currentCall.matrixCall = matrixCall;
		this.currentCall.state = 'connected';

		// Set up state change listener on Matrix call
		(matrixCall as any).on('state', (newState: string) => {
			if (newState === 'ended') {
				this.endCall();
			}
		});

		this.notifyListeners();
	}

	/**
	 * Get current call data
	 */
	public getCurrentCall(): CallData | null {
		return this.currentCall;
	}

	/**
	 * Check if there's an active call
	 */
	public hasActiveCall(): boolean {
		return this.currentCall !== null;
	}
}

// Export singleton instance
export const callManager = CallManager.getInstance();
