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
    roomId: string;
    isVideo: boolean;
    isIncoming: boolean;
    callerUserId?: string;
    matrixCall?: MatrixCall;
    state: CallState;
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
     */
    public startCall(roomId: string, isVideo: boolean): void {
        console.log("═══════════════════════════════════════════════");
        console.log("🚀 CallManager.startCall()");
        console.log("═══════════════════════════════════════════════");
        console.log("   Room ID:", roomId);
        console.log("   Is Video:", isVideo);

        if (this.currentCall) {
            console.warn("⚠️  Already have an active call, cleaning up first...");
            this.endCall();
        }

        const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.currentCall = {
            callId,
            roomId,
            isVideo,
            isIncoming: false,
            state: 'connecting'
        };

        console.log("✅ Outgoing call created:", this.currentCall);
        console.log("═══════════════════════════════════════════════");
        
        this.notifyListeners();
    }

    /**
     * Receive an incoming call
     */
    public receiveCall(roomId: string, isVideo: boolean, callId: string, callerUserId: string): void {
        console.log("═══════════════════════════════════════════════");
        console.log("📞 CallManager.receiveCall()");
        console.log("═══════════════════════════════════════════════");
        console.log("   Call ID:", callId);
        console.log("   Room ID:", roomId);
        console.log("   Is Video:", isVideo);
        console.log("   Caller:", callerUserId);

        if (this.currentCall) {
            console.warn("⚠️  Already have an active call, ignoring incoming call");
            return;
        }

        this.currentCall = {
            callId,
            roomId,
            isVideo,
            isIncoming: true,
            callerUserId,
            state: 'ringing'
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

