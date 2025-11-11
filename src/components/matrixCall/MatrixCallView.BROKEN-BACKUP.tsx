/**
 * Matrix Call View Component
 * UI for Matrix voice/video calls
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MatrixCall } from 'matrix-js-sdk/lib/webrtc/call';
import { CallState } from 'matrix-js-sdk/lib/webrtc/call';
import { matrixCallService } from '../../services/matrixCallService';
import './MatrixCallView.styles.scss';

interface MatrixCallViewProps {
    roomId: string;
    isVideoCall: boolean;
    incomingCall?: MatrixCall | null;
    onCallEnd: () => void;
}

export const MatrixCallView: React.FC<MatrixCallViewProps> = ({
    roomId,
    isVideoCall,
    incomingCall,
    onCallEnd
}) => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    
    const [callState, setCallState] = useState<CallState | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [activeCall, setActiveCall] = useState<MatrixCall | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Guard to prevent multiple call attempts
    const callInitializedRef = useRef(false);

    // Start outgoing call
    const startCall = useCallback(async () => {
        try {
            setError(null);
            
            // Check if Matrix client is initialized
            const matrixClientService = (window as any).matrixClientService;
            if (!matrixClientService || !matrixClientService.getClient()) {
                console.error('❌ Matrix client not initialized - initializing now...');
                
                // Try to get Matrix credentials from localStorage
                const matrixUserId = localStorage.getItem('matrix_user_id');
                const matrixAccessToken = localStorage.getItem('matrix_access_token');
                
                if (!matrixUserId || !matrixAccessToken) {
                    throw new Error('Matrix client not initialized and no stored credentials found. Please logout and login again.');
                }
                
                // Initialize Matrix client with stored credentials
                const { MatrixClientService } = await import('../../services/matrixClientService');
                const newMatrixClientService = new MatrixClientService();
                newMatrixClientService.initializeClient({
                    userId: matrixUserId,
                    accessToken: matrixAccessToken,
                    deviceId: localStorage.getItem('matrix_device_id') || '',
                    homeserverUrl: 'http://91.99.219.182:8008'
                });
                
                (window as any).matrixClientService = newMatrixClientService;
                
                // Wait a bit for client to sync
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                console.log('✅ Matrix client initialized');
            }
            
            const call = await matrixCallService.startCall({
                roomId,
                isVideoCall,
                localVideoElement: localVideoRef.current || undefined,
                remoteVideoElement: remoteVideoRef.current || undefined
            });
            setActiveCall(call);
        } catch (err) {
            console.error('Failed to start call:', err);
            setError((err as Error).message);
        }
    }, [roomId, isVideoCall]);

    // Answer incoming call
    const answerCall = useCallback(async () => {
        if (!incomingCall) return;
        
        try {
            setError(null);
            await matrixCallService.answerCall(
                incomingCall,
                isVideoCall,
                localVideoRef.current || undefined,
                remoteVideoRef.current || undefined
            );
            setActiveCall(incomingCall);
        } catch (err) {
            console.error('Failed to answer call:', err);
            setError((err as Error).message);
        }
    }, [incomingCall, isVideoCall]);

    // Reject incoming call
    const rejectCall = useCallback(() => {
        if (incomingCall) {
            matrixCallService.rejectCall(incomingCall);
            onCallEnd();
        }
    }, [incomingCall, onCallEnd]);

    // Hangup call
    const hangupCall = useCallback(() => {
        matrixCallService.hangupCall();
        onCallEnd();
    }, [onCallEnd]);

    // Toggle microphone
    const toggleMicrophone = useCallback(() => {
        const muted = matrixCallService.toggleMicrophone();
        setIsMuted(muted);
    }, []);

    // Toggle video
    const toggleVideo = useCallback(() => {
        const videoMuted = matrixCallService.toggleVideo();
        setIsVideoMuted(videoMuted);
    }, []);

    // Initialize call on mount
    useEffect(() => {
        // CRITICAL: Prevent multiple initializations
        if (callInitializedRef.current) {
            console.log('⚠️ Call already initialized, skipping...');
            return;
        }
        
        // Check URL parameter to see if we're answering an incoming call
        const urlParams = new URLSearchParams(window.location.search);
        const isAnswering = urlParams.get('answer') === 'true';
        
        console.log('📞 MatrixCallView mount - isAnswering:', isAnswering);
        console.log('📞 incomingCall prop:', !!incomingCall);
        
        if (incomingCall) {
            // Incoming call passed directly - wait for user to answer/reject
            console.log('📞 Incoming call prop provided, using it');
            setActiveCall(incomingCall);
            callInitializedRef.current = true;
            return; // Exit early - don't check for other calls
        }
        
        // Flag to prevent starting new call if we're answering
        let shouldStartNewCall = true;
        
        // Check if there's already an incoming call for this room
        const matrixClientService = (window as any).matrixClientService;
        if (matrixClientService) {
            const client = matrixClientService.getClient();
            const calls = client?.callEventHandler?.calls;
            
            if (calls) {
                // CRITICAL: First clean up old/ended calls
                const allCalls = Array.from(calls.values());
                const endedCalls = allCalls.filter((call: any) => 
                    call.state === 'ended' && call.roomId === roomId
                );
                
                if (endedCalls.length > 0) {
                    console.log(`🧹 Cleaning up ${endedCalls.length} ended calls...`);
                    endedCalls.forEach((call: any) => {
                        try {
                            calls.delete(call.callId);
                        } catch (e) {
                            console.warn('Could not delete ended call:', e);
                        }
                    });
                }
                
                // Find the MOST RECENT incoming call for this room that's still ringing
                const incomingCalls = allCalls
                    .filter((call: any) => 
                        call.roomId === roomId && 
                        call.state === 'ringing' &&
                        call.direction === 'inbound'
                    )
                    .sort((a: any, b: any) => {
                        // Sort by call ID (timestamp-based) to get most recent
                        return b.callId.localeCompare(a.callId);
                    });
                
                console.log('📞 isAnswering?', isAnswering, '| incomingCalls:', incomingCalls.length);
                
                if (isAnswering && incomingCalls.length > 0) {
                    // ANSWERING MODE: We clicked "Accept" button
                    const existingCall = incomingCalls[0]; // Most recent
                    console.log('📞 Found existing incoming call:', (existingCall as any).callId);
                    console.log('📞 Call state:', (existingCall as any).state, 'direction:', (existingCall as any).direction);
                    console.log('✅ ANSWERING incoming call (not starting new one!)');
                    setActiveCall(existingCall as any);
                    callInitializedRef.current = true; // Mark FIRST!
                    
                    // Auto-answer the existing call
                    matrixCallService.answerCall(
                        existingCall as any,
                        isVideoCall,
                        localVideoRef.current || undefined,
                        remoteVideoRef.current || undefined
                    ).catch((err) => {
                        console.error('Failed to answer existing call:', err);
                        setError((err as Error).message);
                    });
                    
                    console.log('✅ Answered! Exiting without calling startCall()');
                    return; // EXIT - don't call startCall()!
                }
                
                if (isAnswering && incomingCalls.length === 0) {
                    // ANSWERING MODE but no incoming call - Matrix still syncing
                    console.log('⏳ Answering mode but no incoming call yet - waiting...');
                    setError('Waiting for incoming call to arrive...');
                    callInitializedRef.current = true;
                    return; // EXIT - don't call startCall()!
                }
                
                if (!isAnswering && incomingCalls.length > 0) {
                    // OUTGOING MODE but incoming call exists - conflict!
                    console.log('⚠️ Both users clicked call at same time!');
                }
            }
        }
        
        // OUTGOING MODE: Start new call
        console.log('📞 Starting new outgoing call...');
        callInitializedRef.current = true; // Mark as initialized
        startCall();
        
        // Cleanup on unmount
        return () => {
            console.log('🧹 MatrixCallView unmounting - cleaning up ALL calls...');
            
            // Hangup current call
            matrixCallService.hangupCall();
            
            // CRITICAL: Clean up ALL calls for this room to prevent self-calling loop on reload
            const matrixClientService = (window as any).matrixClientService;
            if (matrixClientService) {
                const client = matrixClientService.getClient();
                const calls = client?.callEventHandler?.calls;
                
                if (calls) {
                    const roomCalls = Array.from(calls.values()).filter((call: any) => call.roomId === roomId);
                    console.log(`🧹 Found ${roomCalls.length} calls for this room, cleaning up...`);
                    
                    roomCalls.forEach((call: any) => {
                        try {
                            if (call.state !== 'ended') {
                                console.log(`🧹 Hanging up call ${call.callId} (state: ${call.state})`);
                                call.hangup();
                            }
                            calls.delete(call.callId);
                        } catch (e) {
                            console.warn('Could not clean up call:', e);
                        }
                    });
                    
                    console.log('✅ All calls cleaned up for room:', roomId);
                }
            }
        };
    }, [incomingCall, roomId, isVideoCall]);  // REMOVED startCall to prevent re-runs!

    // Monitor call state
    useEffect(() => {
        if (!activeCall) return;

        const handleStateChange = (state: CallState) => {
            setCallState(state);
            if (state === CallState.Ended) {
                onCallEnd();
            }
        };

        activeCall.on('state' as any, handleStateChange);

        return () => {
            activeCall.off('state' as any, handleStateChange);
        };
    }, [activeCall, onCallEnd]);

    // Render call state message
    const renderCallState = () => {
        if (error) {
            return <div className="matrix-call__error">Error: {error}</div>;
        }

        if (incomingCall && callState !== CallState.Connected) {
            return <div className="matrix-call__incoming">Incoming call...</div>;
        }

        switch (callState) {
            case CallState.WaitLocalMedia:
                return <div className="matrix-call__state">Requesting media access...</div>;
            case CallState.CreateOffer:
            case CallState.CreateAnswer:
                return <div className="matrix-call__state">Connecting...</div>;
            case CallState.Connecting:
                return <div className="matrix-call__state">Connecting...</div>;
            case CallState.Connected:
                return <div className="matrix-call__state">Connected</div>;
            case CallState.Ringing:
                return <div className="matrix-call__state">Ringing...</div>;
            case CallState.Ended:
                return <div className="matrix-call__state">Call ended</div>;
            default:
                return <div className="matrix-call__state">Initializing...</div>;
        }
    };

    return (
        <div className="matrix-call">
            <div className="matrix-call__header">
                <h2>{isVideoCall ? '📹 Video Call' : '📞 Voice Call'}</h2>
                {renderCallState()}
            </div>

            <div className="matrix-call__videos">
                {/* Remote video (other person) */}
                <div className="matrix-call__remote-video">
                    <video
                        ref={remoteVideoRef}
                        className="matrix-call__video matrix-call__video--remote"
                        autoPlay
                        playsInline
                    />
                    {callState !== CallState.Connected && (
                        <div className="matrix-call__video-placeholder">
                            Waiting for connection...
                        </div>
                    )}
                </div>

                {/* Local video (you) */}
                {isVideoCall && (
                    <div className="matrix-call__local-video">
                        <video
                            ref={localVideoRef}
                            className="matrix-call__video matrix-call__video--local"
                            autoPlay
                            playsInline
                            muted
                        />
                    </div>
                )}
            </div>

            <div className="matrix-call__controls">
                {/* Incoming call actions */}
                {incomingCall && callState !== CallState.Connected && (
                    <>
                        <button
                            className="matrix-call__button matrix-call__button--answer"
                            onClick={answerCall}
                        >
                            ✅ Answer
                        </button>
                        <button
                            className="matrix-call__button matrix-call__button--reject"
                            onClick={rejectCall}
                        >
                            ❌ Reject
                        </button>
                    </>
                )}

                {/* Active call controls */}
                {callState === CallState.Connected && (
                    <>
                        <button
                            className={`matrix-call__button ${
                                isMuted ? 'matrix-call__button--active' : ''
                            }`}
                            onClick={toggleMicrophone}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? '🎤❌' : '🎤'}
                        </button>

                        {isVideoCall && (
                            <button
                                className={`matrix-call__button ${
                                    isVideoMuted ? 'matrix-call__button--active' : ''
                                }`}
                                onClick={toggleVideo}
                                title={isVideoMuted ? 'Enable Video' : 'Disable Video'}
                            >
                                {isVideoMuted ? '📹❌' : '📹'}
                            </button>
                        )}

                        <button
                            className="matrix-call__button matrix-call__button--hangup"
                            onClick={hangupCall}
                        >
                            📞 Hang Up
                        </button>
                    </>
                )}

                {/* Hangup for outgoing call before connected */}
                {!incomingCall && callState !== CallState.Connected && callState !== CallState.Ended && (
                    <button
                        className="matrix-call__button matrix-call__button--hangup"
                        onClick={hangupCall}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
};
