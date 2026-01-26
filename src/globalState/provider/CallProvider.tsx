import React, { createContext, useState, useContext, useCallback } from 'react';
import { MatrixCall } from 'matrix-js-sdk/lib/webrtc/call';

export type CallState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';
export type CallMode = 'minimized' | 'normal' | 'fullscreen';

interface ActiveCallData {
    roomId: string;
    isVideo: boolean;
    isIncoming: boolean;
    callId?: string;
    callerName?: string;
    matrixCall?: MatrixCall;
}

interface CallContextType {
    // Call state
    activeCall: ActiveCallData | null;
    callState: CallState;
    callMode: CallMode;
    
    // Actions
    startCall: (roomId: string, isVideo: boolean) => void;
    receiveCall: (roomId: string, isVideo: boolean, callId: string, callerName?: string) => void;
    answerCall: () => void;
    rejectCall: () => void;
    hangupCall: () => void;
    
    // Call mode
    setCallMode: (mode: CallMode) => void;
    
    // Matrix call object
    setMatrixCall: (call: MatrixCall | null) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null);
    const [callState, setCallState] = useState<CallState>('idle');
    const [callMode, setCallMode] = useState<CallMode>('normal');

    const startCall = useCallback((roomId: string, isVideo: boolean) => {
        console.log("═══════════════════════════════════════════════");
        console.log("🚀 CALLPROVIDER.startCall() CALLED!");
        console.log("═══════════════════════════════════════════════");
        console.log('Room ID:', roomId);
        console.log('Is Video:', isVideo);
        
        setActiveCall({
            roomId,
            isVideo,
            isIncoming: false
        });
        
        console.log('✅ Active call state set!');
        
        setCallState('connecting');
        console.log('✅ Call state set to connecting');
        
        setCallMode('normal');
        console.log('✅ Call mode set to normal');
        console.log("═══════════════════════════════════════════════");
    }, []);

    const receiveCall = useCallback((roomId: string, isVideo: boolean, callId: string, callerName?: string) => {
        console.log('📞 Receiving incoming call:', { roomId, isVideo, callId, callerName });
        setActiveCall({
            roomId,
            isVideo,
            isIncoming: true,
            callId,
            callerName
        });
        setCallState('ringing');
        setCallMode('normal');
    }, []);

    const answerCall = useCallback(() => {
        console.log('✅ Answering call');
        setCallState('connecting');
    }, []);

    const rejectCall = useCallback(() => {
        console.log('❌ Rejecting call');
        setActiveCall(null);
        setCallState('idle');
    }, []);

    const hangupCall = useCallback(() => {
        console.log("═══════════════════════════════════════════════");
        console.log('📴 CALLPROVIDER.hangupCall() - Cleaning up call');
        console.log("═══════════════════════════════════════════════");
        
        // Clean up Matrix call if it exists
        setActiveCall(prev => {
            if (prev?.matrixCall) {
                console.log('🧹 Hanging up Matrix call object');
                try {
                    (prev.matrixCall as any).hangup();
                } catch (err) {
                    console.warn('⚠️ Error hanging up Matrix call:', err);
                }
            }
            return null;
        });
        
        setCallState('ended');
        console.log('✅ Call state set to ended');
        
        // Reset to idle after a brief delay
        setTimeout(() => {
            setCallState('idle');
            console.log('✅ Call state reset to idle');
        }, 1000);
        
        console.log("═══════════════════════════════════════════════");
    }, []);

    const setMatrixCall = useCallback((call: MatrixCall | null) => {
        setActiveCall(prev => prev ? { ...prev, matrixCall: call } : null);
    }, []);

    return (
        <CallContext.Provider
            value={{
                activeCall,
                callState,
                callMode,
                startCall,
                receiveCall,
                answerCall,
                rejectCall,
                hangupCall,
                setCallMode,
                setMatrixCall
            }}
        >
            {children}
        </CallContext.Provider>
    );
};

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCall must be used within CallProvider');
    }
    return context;
};

