/**
 * Matrix Call Service
 * Handles Matrix native VoIP/WebRTC voice and video calls
 */

import { MatrixClient } from 'matrix-js-sdk';
import { MatrixCall, CallEvent, CallState, CallType } from 'matrix-js-sdk/lib/webrtc/call';

export interface MatrixCallOptions {
    roomId: string;
    isVideoCall: boolean;
    localVideoElement?: HTMLVideoElement;
    remoteVideoElement?: HTMLVideoElement;
}

export interface MatrixCallEventHandlers {
    onCallStateChanged?: (state: CallState) => void;
    onCallEnded?: () => void;
    onCallError?: (error: Error) => void;
    onIncomingCall?: (call: MatrixCall) => void;
}

class MatrixCallService {
    private client: MatrixClient | null = null;
    private activeCall: MatrixCall | null = null;
    private eventHandlers: MatrixCallEventHandlers = {};

    /**
     * Initialize call service with Matrix client
     */
    public initialize(client: MatrixClient, handlers: MatrixCallEventHandlers = {}): void {
        this.client = client;
        this.eventHandlers = handlers;

        // Listen for incoming calls
        this.client.on('Call.incoming' as any, (call: MatrixCall) => {
            console.log('📞 Incoming call from:', call.getOpponentMember()?.name);
            if (this.eventHandlers.onIncomingCall) {
                this.eventHandlers.onIncomingCall(call);
            }
        });

        console.log('✅ Matrix Call Service initialized');
    }

    /**
     * Start a voice or video call
     */
    public async startCall(options: MatrixCallOptions): Promise<MatrixCall> {
        if (!this.client) {
            throw new Error('Matrix client not initialized');
        }

        if (this.activeCall) {
            throw new Error('Call already in progress');
        }

        try {
            console.log(`📞 Starting ${options.isVideoCall ? 'video' : 'voice'} call in room:`, options.roomId);

            // Wait for Matrix client to sync and find the room
            console.log('🔍 Looking for room:', options.roomId);
            let room = this.client.getRoom(options.roomId);
            
            if (!room) {
                console.log('⏳ Room not found yet, waiting for sync...');
                
                // Wait up to 10 seconds for room to appear
                for (let i = 0; i < 20; i++) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    room = this.client.getRoom(options.roomId);
                    if (room) {
                        console.log('✅ Room found after waiting!');
                        break;
                    }
                }
                
                if (!room) {
                    console.error('❌ Room still not found after 10 seconds');
                    console.error('❌ Available rooms:', this.client.getRooms().map((r: any) => r.roomId));
                    throw new Error('Room not found. The Matrix client may not have finished syncing, or you may not be a member of this room.');
                }
            } else {
                console.log('✅ Room found immediately!');
            }

            const call = this.client.createCall(
                options.roomId
            ) as MatrixCall;

            if (!call) {
                throw new Error('Failed to create call');
            }

            this.activeCall = call;
            this.setupCallEventListeners(call, options);

            // Place the call (matrix-js-sdk will request media permissions internally)
            await call.placeCall(
                true,  // audio
                options.isVideoCall  // video
            );

            console.log('✅ Call placed successfully');

            return call;
        } catch (error) {
            console.error('❌ Failed to start call:', error);
            if (this.eventHandlers.onCallError) {
                this.eventHandlers.onCallError(error as Error);
            }
            throw error;
        }
    }

    /**
     * Answer an incoming call
     */
    public async answerCall(
        call: MatrixCall,
        isVideoCall: boolean,
        localVideoElement?: HTMLVideoElement,
        remoteVideoElement?: HTMLVideoElement
    ): Promise<void> {
        try {
            console.log('📞 Answering call...');

            this.activeCall = call;
            this.setupCallEventListeners(call, {
                roomId: call.roomId,
                isVideoCall,
                localVideoElement,
                remoteVideoElement
            });

            // Answer the call (matrix-js-sdk will request media permissions internally)
            await call.answer(
                true,  // audio
                isVideoCall  // video
            );

            console.log('✅ Call answered successfully');
        } catch (error) {
            console.error('❌ Failed to answer call:', error);
            if (this.eventHandlers.onCallError) {
                this.eventHandlers.onCallError(error as Error);
            }
            throw error;
        }
    }

    /**
     * Hangup the active call
     */
    public hangupCall(): void {
        if (this.activeCall) {
            console.log('📞 Hanging up call...');
            try {
                this.activeCall.hangup('user_hangup' as any, false);
                this.cleanup();
                console.log('✅ Call ended');
            } catch (error) {
                console.error('❌ Error hanging up call:', error);
            }
        }
    }

    /**
     * Reject an incoming call
     */
    public rejectCall(call: MatrixCall): void {
        console.log('📞 Rejecting call...');
        try {
            call.reject();
            console.log('✅ Call rejected');
        } catch (error) {
            console.error('❌ Error rejecting call:', error);
        }
    }

    /**
     * Toggle microphone mute
     */
    public toggleMicrophone(): boolean {
        if (this.activeCall) {
            const isMuted = this.activeCall.isMicrophoneMuted();
            this.activeCall.setMicrophoneMuted(!isMuted);
            console.log(`🎤 Microphone ${!isMuted ? 'muted' : 'unmuted'}`);
            return !isMuted;
        }
        return false;
    }

    /**
     * Toggle video on/off
     */
    public toggleVideo(): boolean {
        if (this.activeCall) {
            const isVideoMuted = this.activeCall.isLocalVideoMuted();
            this.activeCall.setLocalVideoMuted(!isVideoMuted);
            console.log(`📹 Video ${!isVideoMuted ? 'disabled' : 'enabled'}`);
            return !isVideoMuted;
        }
        return false;
    }

    /**
     * Get active call
     */
    public getActiveCall(): MatrixCall | null {
        return this.activeCall;
    }

    /**
     * Check if call is in progress
     */
    public isCallActive(): boolean {
        return this.activeCall !== null;
    }

    /**
     * Setup event listeners for a call
     */
    private setupCallEventListeners(call: MatrixCall, options: MatrixCallOptions): void {
        // Call state changed
        call.on(CallEvent.State as any, (state: CallState) => {
            console.log('📞 Call state changed:', state);

            if (this.eventHandlers.onCallStateChanged) {
                this.eventHandlers.onCallStateChanged(state);
            }

            // Handle call end states
            if (state === CallState.Ended) {
                console.log('📞 Call ended');
                if (this.eventHandlers.onCallEnded) {
                    this.eventHandlers.onCallEnded();
                }
                this.cleanup();
            }
        });

        // Feeds changed (local/remote streams)
        call.on(CallEvent.FeedsChanged as any, () => {
            console.log('📞 Feeds changed');
            this.handleFeedsChanged(call, options);
        });

        // Call error
        call.on(CallEvent.Error as any, (error: Error) => {
            console.error('📞 Call error:', error);
            if (this.eventHandlers.onCallError) {
                this.eventHandlers.onCallError(error);
            }
        });

        // Call hangup
        call.on(CallEvent.Hangup as any, () => {
            console.log('📞 Call hangup event');
            if (this.eventHandlers.onCallEnded) {
                this.eventHandlers.onCallEnded();
            }
            this.cleanup();
        });
    }

    /**
     * Handle feeds changed (attach streams to video elements)
     */
    private handleFeedsChanged(call: MatrixCall, options: MatrixCallOptions): void {
        try {
            // Get local feed (your video/audio)
            const localFeed = call.localUsermediaFeed;
            if (localFeed && options.localVideoElement) {
                const localStream = localFeed.stream;
                if (localStream) {
                    options.localVideoElement.srcObject = localStream;
                    options.localVideoElement.play().catch(e => 
                        console.error('Error playing local video:', e)
                    );
                    console.log('✅ Local video stream attached');
                }
            }

            // Get remote feed (other person's video/audio)
            const remoteFeed = call.remoteUsermediaFeed;
            if (remoteFeed && options.remoteVideoElement) {
                const remoteStream = remoteFeed.stream;
                if (remoteStream) {
                    options.remoteVideoElement.srcObject = remoteStream;
                    options.remoteVideoElement.play().catch(e => 
                        console.error('Error playing remote video:', e)
                    );
                    console.log('✅ Remote video stream attached');
                }
            }
        } catch (error) {
            console.error('❌ Error handling feeds:', error);
        }
    }

    /**
     * Cleanup call resources
     */
    private cleanup(): void {
        if (this.activeCall) {
            // Stop all media tracks
            try {
                const localFeed = this.activeCall.localUsermediaFeed;
                if (localFeed) {
                    localFeed.stream?.getTracks().forEach(track => track.stop());
                }
            } catch (error) {
                console.error('Error stopping media tracks:', error);
            }

            this.activeCall = null;
        }
    }

    /**
     * Destroy service and cleanup
     */
    public destroy(): void {
        this.hangupCall();
        this.client = null;
        this.eventHandlers = {};
        console.log('✅ Matrix Call Service destroyed');
    }
}

// Export singleton instance
export const matrixCallService = new MatrixCallService();

