/**
 * CallManager - Centralized Call State Management
 * 
 * This is a singleton service that manages all Matrix call state.
 * It prevents multiple initializations, race conditions, and ensures
 * clean state transitions.
 */

import { MatrixCall } from 'matrix-js-sdk/lib/webrtc/call';

export type CallState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

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

    private constructor() {
        console.log("═══════════════════════════════════════════════");
        console.log("📞 CallManager initialized (singleton)");
        console.log("═══════════════════════════════════════════════");
    }

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
        console.log(`📡 CallManager: Added listener (total: ${this.listeners.size})`);
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
            console.log(`📡 CallManager: Removed listener (total: ${this.listeners.size})`);
        };
    }

    /**
     * Notify all listeners of state change
     */
    private notifyListeners(): void {
        console.log(`🔔 CallManager: Notifying ${this.listeners.size} listener(s)`);
        console.log(`   Current call state:`, this.currentCall);
        
        this.listeners.forEach(listener => {
            try {
                listener(this.currentCall);
            } catch (error) {
                console.error('❌ Error in call state listener:', error);
            }
        });
    }

    /**
     * Start an outgoing call
     * @param roomId - Matrix room ID
     * @param isVideo - Whether to enable video
     * @param forceIsGroup - Force this to be treated as a group call (for group chats)
     */
    public startCall(roomId: string, isVideo: boolean, forceIsGroup?: boolean): void {
        console.log("═══════════════════════════════════════════════");
        console.log("🚀 CallManager.startCall()");
        console.log("═══════════════════════════════════════════════");
        console.log("   Room ID:", roomId);
        console.log("   Is Video:", isVideo);
        console.log("   Force Group:", forceIsGroup);

        if (this.currentCall) {
            console.warn("⚠️  Already have an active call, cleaning up first...");
            this.endCall();
        }

        // Detect if this is a group call
        let isGroup = forceIsGroup || false; // Use forceIsGroup if provided
        
        if (!forceIsGroup) {
            // Auto-detect based on room member count
            try {
                const matrixClientService = (window as any).matrixClientService;
                const client = matrixClientService?.getClient();
                console.log(`   Matrix client available: ${!!client}`);
                
                if (client) {
                    const room = client.getRoom(roomId);
                    console.log(`   Room found: ${!!room}`);
                    
                    if (room) {
                        const memberCount = room.getJoinedMemberCount();
                        const members = room.getJoinedMembers();
                        isGroup = memberCount > 0; // TEMPORARY: All calls treated as group calls
                        
                        console.log(`   ✅ Room member count: ${memberCount}`);
                        console.log(`   ✅ Joined members:`, members.map(m => m.userId));
                        console.log(`   ✅ Is group call (auto-detected): ${isGroup}`);
                    } else {
                        console.warn(`   ⚠️  Room not found in Matrix client! RoomId: ${roomId}`);
                    }
                } else {
                    console.warn(`   ⚠️  Matrix client not available!`);
                }
            } catch (err) {
                console.error('❌ Error detecting group call:', err);
            }
        } else {
            console.log(`   ✅ Is group call (forced): ${isGroup}`);
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
                signalRoomId: isGroup ? roomId : roomId,
            };

            console.log("✅ Outgoing call created:", this.currentCall);
            console.log("═══════════════════════════════════════════════");

            if (isGroup) {
                // Make sure the Element Call room allows membership events from
                // regular users (matches Element Call's own room creation).
                this.ensureGroupCallPermissions(this.currentCall.roomId).catch((err) => {
                    console.error("❌ Failed to ensure group call room permissions:", err);
                });

                // Send Matrix call invite event to the original session room so
                // the other participant sees the incoming call notification.
                this.sendGroupCallInvite(
                    roomId,
                    callId,
                    isVideo,
                    this.currentCall.roomId,
                );
            }

            this.notifyListeners();
        })().catch((err: any) => {
            console.error("❌ Error while starting call:", err);
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
            throw new Error("Matrix client not available to create Element Call room");
        }

        const name = `Group call for ${sourceRoomId}`;

        console.log("🔧 Creating dedicated Element Call room for group call, source room:", sourceRoomId);

        const result = await client.createRoom({
            // Not publicly listed, but we want easy joins via ID
            visibility: "private",
            // Same as Element Call: a room suitable for group chats
            preset: "public_chat",
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
                    "m.room.power_levels": 100,
                    "m.room.history_visibility": 100,
                    "m.room.tombstone": 100,
                    "m.room.encryption": 100,
                    "m.room.name": 50,
                    "m.room.message": 0,
                    "m.room.encrypted": 50,
                    "m.sticker": 50,
                    // IMPORTANT: allow everyone to send group call membership
                    // events so Element Call can join from any participant.
                    "org.matrix.msc3401.call.member": 0,
                },
                users: {
                    [client.getUserId()!]: 100,
                },
            },
        } as any);

        console.log(
            "✅ Created Element Call room",
            result.room_id,
            "for session room",
            sourceRoomId,
        );

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
                console.warn("⚠️  Matrix client not available, cannot adjust power levels for group call");
                return;
            }

            const room = client.getRoom(roomId);
            if (!room) {
                console.warn("⚠️  Room not found when trying to adjust power levels for group call:", roomId);
                return;
            }

            const plEvent = room.currentState.getStateEvents("m.room.power_levels", "") as any;
            const currentContent = plEvent?.getContent?.() || {};
            const events = currentContent.events || {};

            const currentLevelForCallMember =
                events["org.matrix.msc3401.call.member"] ??
                currentContent.state_default ??
                currentContent.events_default ??
                50;

            // If it's already open enough, nothing to do.
            if (currentLevelForCallMember === 0) {
                console.log("✅ Group call permissions already allow org.matrix.msc3401.call.member at level 0");
                return;
            }

            const updatedContent = {
                ...currentContent,
                events: {
                    ...events,
                    // Match Element Call's own room creation logic: allow everyone
                    // to send call membership events so they can join the MatrixRTC session.
                    "org.matrix.msc3401.call.member": 0,
                },
            };

            console.log(
                "🔧 Updating m.room.power_levels to allow org.matrix.msc3401.call.member at level 0 for room:",
                roomId,
            );

            await client.sendStateEvent(roomId, "m.room.power_levels", "", updatedContent);
            console.log("✅ Updated power levels for group call room:", roomId);
        } catch (error) {
            console.error("❌ Error while updating group call room power levels:", error);
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
        elementCallRoomId?: string,
    ): void {
        try {
            const matrixClientService = (window as any).matrixClientService;
            const client = matrixClientService?.getClient();
            
            if (!client) {
                console.error('❌ Matrix client not available to send call invite');
                return;
            }

            console.log('📤 Sending m.call.invite to Matrix room:', signallingRoomId);
            
            // Send m.call.invite event
            client.sendEvent(signallingRoomId, 'm.call.invite', {
                call_id: callId,
                version: '1',
                lifetime: 60000, // 60 seconds
                offer: {
                    type: 'offer',
                    sdp: '' // Empty for LiveKit calls (not using Matrix WebRTC)
                },
                invitee: undefined, // Group call - no specific invitee
                party_id: client.getDeviceId() || 'unknown',
                is_group_call: true, // Custom field to indicate group call
                is_video: isVideo,
                // Custom: tell receivers which Matrix room Element Call should use.
                call_room_id: elementCallRoomId,
            }).then(() => {
                console.log('✅ m.call.invite sent successfully');
            }).catch((err: Error) => {
                console.error('❌ Failed to send m.call.invite:', err);
            });
            
        } catch (error) {
            console.error('❌ Error sending group call invite:', error);
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
        signallingRoomId?: string,
    ): void {
        console.log("═══════════════════════════════════════════════");
        console.log("📞 CallManager.receiveCall()");
        console.log("═══════════════════════════════════════════════");
        console.log("   Call ID:", callId);
        console.log("   Call Room ID:", callRoomId);
        if (signallingRoomId && signallingRoomId !== callRoomId) {
            console.log("   Signalling Room ID:", signallingRoomId);
        }
        console.log("   Is Video:", isVideo);
        console.log("   Caller:", callerUserId);

        if (this.currentCall) {
            console.warn("⚠️  Already have an active call, ignoring incoming call");
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
            signalRoomId: signallingRoomId || callRoomId,
        };

        console.log("✅ Incoming call created:", this.currentCall);
        console.log("═══════════════════════════════════════════════");
        
        this.notifyListeners();
    }

    /**
     * Answer the current incoming call
     */
    public answerCall(): void {
        console.log("═══════════════════════════════════════════════");
        console.log("✅ CallManager.answerCall()");
        console.log("═══════════════════════════════════════════════");

        if (!this.currentCall) {
            console.error("❌ No call to answer!");
            return;
        }

        if (!this.currentCall.isIncoming) {
            console.error("❌ Cannot answer outgoing call!");
            return;
        }

        this.currentCall.state = 'connecting';
        
        console.log("✅ Call state changed to connecting");
        console.log("═══════════════════════════════════════════════");
        
        this.notifyListeners();
    }

    /**
     * Reject the current incoming call
     */
    public rejectCall(): void {
        console.log("═══════════════════════════════════════════════");
        console.log("❌ CallManager.rejectCall()");
        console.log("═══════════════════════════════════════════════");

        if (!this.currentCall) {
            console.error("❌ No call to reject!");
            return;
        }

        if (this.currentCall.matrixCall) {
            console.log("📞 Rejecting Matrix call object...");
            try {
                (this.currentCall.matrixCall as any).reject();
            } catch (err) {
                console.error("❌ Error rejecting Matrix call:", err);
            }
        }

        this.currentCall = null;
        
        console.log("✅ Call rejected and cleared");
        console.log("═══════════════════════════════════════════════");
        
        this.notifyListeners();
    }

    /**
     * End the current call
     */
    public endCall(): void {
        console.log("═══════════════════════════════════════════════");
        console.log("📴 CallManager.endCall()");
        console.log("═══════════════════════════════════════════════");

        if (!this.currentCall) {
            console.log("ℹ️  No active call to end");
            return;
        }

        // Hangup Matrix call (this will send m.call.hangup event to other side)
        if (this.currentCall.matrixCall) {
            console.log("📞 Hanging up Matrix call object...");
            try {
                (this.currentCall.matrixCall as any).hangup();
                console.log("✅ Matrix call hangup sent (other side will receive it)");
            } catch (err) {
                console.error("❌ Error hanging up Matrix call:", err);
            }
        }

        // Stop local media streams
        const stream = (window as any).__activeMediaStream;
        if (stream) {
            console.log("🧹 Stopping local media stream...");
            stream.getTracks().forEach((track: any) => {
                track.stop();
                console.log(`   Stopped ${track.kind} track`);
            });
            delete (window as any).__activeMediaStream;
            console.log("✅ Local media stream stopped");
        }

        this.currentCall = null;
        
        console.log("✅ Call ended and cleared");
        console.log("═══════════════════════════════════════════════");
        
        this.notifyListeners();
    }

    /**
     * Attach Matrix call object to current call
     */
    public setMatrixCall(matrixCall: MatrixCall): void {
        console.log("═══════════════════════════════════════════════");
        console.log("🔗 CallManager.setMatrixCall()");
        console.log("═══════════════════════════════════════════════");

        if (!this.currentCall) {
            console.error("❌ No current call to attach Matrix call to!");
            return;
        }

        this.currentCall.matrixCall = matrixCall;
        this.currentCall.state = 'connected';
        
        console.log("✅ Matrix call object attached");
        console.log("✅ Call state changed to connected");
        console.log("═══════════════════════════════════════════════");
        
        // Set up state change listener on Matrix call
        (matrixCall as any).on('state', (newState: string) => {
            console.log(`📞 Matrix call state changed: ${newState}`);
            
            if (newState === 'ended') {
                console.log("📴 Matrix call ended, cleaning up...");
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

