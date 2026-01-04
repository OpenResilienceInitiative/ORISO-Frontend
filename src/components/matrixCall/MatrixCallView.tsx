/**
 * Matrix Call View Component - CLEAN VERSION
 * Simple, straightforward call logic with NO bugs
 */

import React, { useEffect, useRef, useState } from 'react';
import { MatrixCall } from 'matrix-js-sdk/lib/webrtc/call';
import { CallState } from 'matrix-js-sdk/lib/webrtc/call';
import { matrixCallService } from '../../services/matrixCallService';
import './MatrixCallView.styles.scss';

interface MatrixCallViewProps {
    roomId: string;
    isVideoCall: boolean;
    onCallEnd: () => void;
}

export const MatrixCallView: React.FC<MatrixCallViewProps> = ({
    roomId,
    isVideoCall,
    onCallEnd
}) => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    
    const [callState, setCallState] = useState<CallState | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [activeCall, setActiveCall] = useState<MatrixCall | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Initialize call ONCE on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const isAnswering = urlParams.get('answer') === 'true';
        
        console.log('🔥 MatrixCallView INIT - Room:', roomId, '| Answer mode:', isAnswering);
        
        const matrixClientService = (window as any).matrixClientService;
        if (!matrixClientService) {
            setError('Matrix client not available');
            return;
        }
        
        const client = matrixClientService.getClient();
        if (!client) {
            setError('Matrix client not ready');
            return;
        }
        
        const calls = client.callEventHandler?.calls;
        if (!calls) {
            setError('Call handler not available');
            return;
        }
        
        // Find incoming call for this room
        const incomingCall = Array.from(calls.values()).find((call: any) => 
            call.roomId === roomId && 
            call.direction === 'inbound' && 
            call.state === 'ringing'
        ) as MatrixCall | undefined;
        
        console.log('🔥 Incoming call exists?', !!incomingCall);
        console.log('🔥 Is answering mode?', isAnswering);
        
        if (isAnswering && incomingCall) {
            // ANSWER MODE: Answer the existing call
            console.log('✅ ANSWERING incoming call');
            setActiveCall(incomingCall);
            
            matrixCallService.answerCall(
                incomingCall,
                isVideoCall,
                localVideoRef.current || undefined,
                remoteVideoRef.current || undefined
            ).catch((err) => {
                console.error('❌ Failed to answer:', err);
                setError(err.message);
            });
        } else if (!isAnswering) {
            // START MODE: Start new outgoing call
            console.log('✅ STARTING new outgoing call');
            
            matrixCallService.startCall({
                roomId,
                isVideoCall,
                localVideoElement: localVideoRef.current || undefined,
                remoteVideoElement: remoteVideoRef.current || undefined
            }).then((call) => {
                setActiveCall(call);
            }).catch((err) => {
                console.error('❌ Failed to start call:', err);
                setError(err.message);
            });
        } else {
            // ANSWER MODE but no incoming call
            setError('No incoming call found to answer');
        }
        
        // Cleanup on unmount
        return () => {
            console.log('🧹 Cleaning up call...');
            if (activeCall) {
                (activeCall as any).hangup();
            }
        };
    }, []); // Run ONCE only!
    
    // Monitor call state
    useEffect(() => {
        if (!activeCall) return;
        
        const handleStateChange = (state: CallState) => {
            console.log('📞 Call state changed:', state);
            setCallState(state);
            if (state === CallState.Ended) {
                onCallEnd();
            }
        };
        
        (activeCall as any).on('state', handleStateChange);
        
        return () => {
            (activeCall as any).off('state', handleStateChange);
        };
    }, [activeCall, onCallEnd]);
    
    // Toggle controls
    const toggleMute = () => {
        if (activeCall) {
            activeCall.setMicrophoneMuted(!isMuted);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (activeCall && isVideoCall) {
            activeCall.setLocalVideoMuted(!isVideoMuted);
            setIsVideoMuted(!isVideoMuted);
        }
    };

    const hangUp = () => {
        if (activeCall) {
            (activeCall as any).hangup();
        }
    };

    // Get user initial for avatar
    const getUserInitial = () => {
        return 'S'; // TODO: Get from actual user data
    };

    // Render
    return (
        <div className="matrix-call">
            {/* Header bar */}
            <div className="matrix-call__header">
                <div className="matrix-call__header-left">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                    </svg>
                    <span>Call</span>
                </div>
                <button className="matrix-call__fullscreen-btn" title="Fullscreen">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                    </svg>
                </button>
            </div>
            
            {/* Video area with avatar */}
            <div className="matrix-call__videos">
                <div className="matrix-call__remote-video">
                    <video ref={remoteVideoRef} className="matrix-call__video" autoPlay playsInline />
                    
                    {/* Large centered avatar when ringing/no video */}
                    {(callState === CallState.Ringing || !isVideoCall) && (
                        <div className="matrix-call__avatar">
                            <div className="matrix-call__avatar-circle">
                                {getUserInitial()}
                            </div>
                        </div>
                    )}
                </div>
                
                {isVideoCall && (
                    <div className="matrix-call__local-video">
                        <video ref={localVideoRef} className="matrix-call__video matrix-call__video--local" autoPlay playsInline muted />
                    </div>
                )}
            </div>
            
            {/* Modern control buttons - Element style */}
            <div className="matrix-call__controls">
                {/* Mute microphone with dropdown */}
                <div className="matrix-call__control-group">
                    <button 
                        className={`matrix-call__control-btn ${isMuted ? 'matrix-call__control-btn--muted' : 'matrix-call__control-btn--dark'}`}
                        onClick={toggleMute}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                            </svg>
                        )}
                    </button>
                    <svg className="matrix-call__dropdown-caret" width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
                        <path d="M5 6L0 0h10L5 6z"/>
                    </svg>
                </div>

                {/* Turn off video with dropdown */}
                {isVideoCall && (
                    <div className="matrix-call__control-group">
                        <button 
                            className={`matrix-call__control-btn ${isVideoMuted ? 'matrix-call__control-btn--light' : 'matrix-call__control-btn--dark'}`}
                            onClick={toggleVideo}
                            title={isVideoMuted ? 'Turn on video' : 'Turn off video'}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill={isVideoMuted ? 'none' : 'currentColor'} stroke={isVideoMuted ? 'currentColor' : 'none'}>
                                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                                {isVideoMuted && <path d="M2 2L22 22" stroke="currentColor" strokeWidth="2"/>}
                            </svg>
                        </button>
                        <svg className="matrix-call__dropdown-caret" width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
                            <path d="M5 6L0 0h10L5 6z"/>
                        </svg>
                    </div>
                )}

                {/* Screen share - Hidden for now */}
                {/* <button 
                    className="matrix-call__control-btn matrix-call__control-btn--dark"
                    title="Share screen"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5 13h14v-2H5v2zm3-6l5-5v4h5v2h-5v4l-5-5z"/>
                        <rect x="3" y="15" width="18" height="2" fill="currentColor"/>
                    </svg>
                </button> */}

                {/* More options */}
                <button 
                    className="matrix-call__control-btn matrix-call__control-btn--dark"
                    title="More options"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="6" cy="12" r="2"/>
                        <circle cx="12" cy="12" r="2"/>
                        <circle cx="18" cy="12" r="2"/>
                    </svg>
                </button>

                {/* End call */}
                <button 
                    className="matrix-call__control-btn matrix-call__control-btn--hangup"
                    onClick={hangUp}
                    title="End call"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                    </svg>
                </button>
            </div>

        </div>
    );
};

