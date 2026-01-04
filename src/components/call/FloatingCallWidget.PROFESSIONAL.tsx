/**
 * FloatingCallWidget - PROFESSIONAL Implementation
 * NO EMOJIS - CLEAN ICONS - LIKE ZOOM/WHATSAPP
 */

import React, { useEffect, useRef, useState } from 'react';
import { callManager, CallData } from '../../services/CallManager';
import { matrixCallService } from '../../services/matrixCallService';
import './FloatingCallWidget.scss';

export const FloatingCallWidget: React.FC = () => {
    const [callData, setCallData] = useState<CallData | null>(null);
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: window.innerWidth - 500, y: window.innerHeight - 400 });
    const dragStartPos = useRef({ x: 0, y: 0 });
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const callInitiatedRef = useRef(false);
    const widgetRef = useRef<HTMLDivElement>(null);

    // Subscribe to CallManager
    useEffect(() => {
        const unsubscribe = callManager.subscribe((newCallData) => {
            setCallData(newCallData);
            if (!newCallData) {
                callInitiatedRef.current = false;
                setCallDuration(0);
            }
        });
        setCallData(callManager.getCurrentCall());
        return () => unsubscribe();
    }, []);

    // Handle outgoing call initiation
    useEffect(() => {
        if (!callData || callData.isIncoming || callInitiatedRef.current || callData.matrixCall) return;
        
        callInitiatedRef.current = true;
        navigator.mediaDevices.getUserMedia({ video: callData.isVideo, audio: true })
            .then((stream) => {
                (window as any).__activeMediaStream = stream;
                return matrixCallService.startCall({
                    roomId: callData.roomId,
                    isVideoCall: callData.isVideo,
                    localVideoElement: localVideoRef.current || undefined,
                    remoteVideoElement: remoteVideoRef.current || undefined
                });
            })
            .then((matrixCall) => {
                callManager.setMatrixCall(matrixCall);
            })
            .catch((err) => {
                console.error("Failed to start call:", err);
                alert(`Failed to start call: ${(err as Error).message}`);
                callManager.endCall();
            });
    }, [callData]);

    // Call duration timer
    useEffect(() => {
        if (callData?.state === 'connected') {
            const interval = setInterval(() => setCallDuration(prev => prev + 1), 1000);
            return () => clearInterval(interval);
        } else {
            setCallDuration(0);
        }
    }, [callData?.state]);

    // Dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.call-controls') || 
            (e.target as HTMLElement).closest('.window-controls')) return;
        setIsDragging(true);
        dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            setPosition({ x: e.clientX - dragStartPos.current.x, y: e.clientY - dragStartPos.current.y });
        };
        const handleMouseUp = () => isDragging && setIsDragging(false);
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, position]);

    // Cleanup
    useEffect(() => {
        return () => {
            const stream = (window as any).__activeMediaStream;
            if (stream) {
                stream.getTracks().forEach((track: any) => track.stop());
                delete (window as any).__activeMediaStream;
            }
        };
    }, []);

    // Handlers
    const handleAnswer = async () => {
        if (!callData || !callData.isIncoming) return;
        try {
            const matrixClientService = (window as any).matrixClientService;
            const client = matrixClientService?.getClient();
            if (!client) throw new Error("Matrix client not available");

            const calls = client.callEventHandler?.calls;
            if (!calls) throw new Error("Call handler not available");

            const incomingCall = Array.from(calls.values()).find((call: any) => 
                call.roomId === callData.roomId && call.direction === 'inbound' && call.state === 'ringing'
            );
            if (!incomingCall) throw new Error("No incoming call found");

            const stream = await navigator.mediaDevices.getUserMedia({ video: callData.isVideo, audio: true });
            (window as any).__activeMediaStream = stream;

            callManager.answerCall();
            await matrixCallService.answerCall(
                incomingCall as any, callData.isVideo,
                localVideoRef.current || undefined, remoteVideoRef.current || undefined
            );
            callManager.setMatrixCall(incomingCall as any);
        } catch (err) {
            console.error("Failed to answer:", err);
            alert(`Failed to answer: ${(err as Error).message}`);
            callManager.endCall();
        }
    };

    const handleReject = () => callManager.rejectCall();
    const handleHangup = () => callManager.endCall();
    const toggleMute = () => {
        if (callData?.matrixCall) {
            (callData.matrixCall as any).setMicrophoneMuted(!isMuted);
            setIsMuted(!isMuted);
        }
    };
    const toggleVideo = () => {
        if (callData?.matrixCall) {
            (callData.matrixCall as any).setLocalVideoMuted(!isVideoOff);
            setIsVideoOff(!isVideoOff);
        }
    };
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
        if (!isFullscreen) setIsMinimized(false);
    };
    const toggleMinimized = () => {
        setIsMinimized(!isMinimized);
        if (!isMinimized) setIsFullscreen(false);
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getStatusText = () => {
        if (callData.isIncoming && callData.state === 'ringing') return 'Incoming Call';
        if (!callData.isIncoming && callData.state === 'ringing') return 'Calling...';
        if (callData.state === 'connecting') return 'Connecting...';
        if (callData.state === 'connected') return formatDuration(callDuration);
        return 'Call Active';
    };

    if (!callData) return null;

    const widgetClass = `floating-call-widget ${isFullscreen ? 'fullscreen' : isMinimized ? 'minimized' : 'normal'}`;

    return (
        <div 
            ref={widgetRef}
            className={widgetClass}
            style={{
                position: 'fixed',
                left: isFullscreen ? 0 : `${position.x}px`,
                top: isFullscreen ? 0 : `${position.y}px`,
                cursor: isDragging ? 'grabbing' : 'default'
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Header */}
            <div className="call-header" style={{ cursor: isFullscreen ? 'default' : 'grab' }}>
                <div className="call-info">
                    <span className="call-status">{getStatusText()}</span>
                    {callData.callerUserId && (
                        <span className="caller-name">
                            {callData.callerUserId.replace('@', '').split(':')[0]}
                        </span>
                    )}
                </div>
                
                {/* Window Controls - CLEAN SVG ICONS */}
                <div className="window-controls">
                    <button 
                        className="control-btn minimize"
                        onClick={(e) => { e.stopPropagation(); toggleMinimized(); }}
                        title={isMinimized ? "Restore" : "Minimize"}
                    >
                        <svg width="14" height="2" viewBox="0 0 14 2" fill="currentColor">
                            <rect width="14" height="2" rx="1"/>
                        </svg>
                    </button>
                    <button 
                        className="control-btn fullscreen"
                        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M10 4H14V0M4 10H0V14M14 10V14H10M0 4V0H4"/>
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="1" y="1" width="12" height="12" rx="1"/>
                            </svg>
                        )}
                    </button>
                    <button 
                        className="control-btn close"
                        onClick={(e) => { e.stopPropagation(); handleHangup(); }}
                        title="Close & Hang Up"
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="2" y1="2" x2="12" y2="12"/>
                            <line x1="12" y1="2" x2="2" y2="12"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Video area */}
            <div className="call-video-area">
                {/* Avatar placeholder */}
                {callData.state === 'ringing' && (
                    <div className="call-avatar">
                        {callData.callerUserId ? callData.callerUserId.charAt(1).toUpperCase() : 'U'}
                    </div>
                )}
                
                {/* Video elements */}
                {callData.isVideo && (
                    <>
                        <video 
                            ref={remoteVideoRef} autoPlay playsInline className="remote-video"
                            style={{ display: callData.state === 'ringing' ? 'none' : 'block' }}
                        />
                        <video 
                            ref={localVideoRef} autoPlay playsInline muted className="local-video"
                            style={{ display: callData.state === 'ringing' ? 'none' : 'block' }}
                        />
                    </>
                )}
                
                {/* Voice call indicator */}
                {!callData.isVideo && callData.state !== 'ringing' && (
                    <div className="call-avatar">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                        </svg>
                        <div style={{ marginTop: '16px', fontSize: '14px', opacity: 0.7 }}>Voice Call</div>
                    </div>
                )}
            </div>

            {/* Controls - CLEAN SVG ICONS */}
            <div className="call-controls">
                {(callData.state === 'ringing' || (callData.isIncoming && !callData.matrixCall)) ? (
                    <>
                        <button className="call-btn answer-btn" onClick={handleAnswer} title="Answer">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                            </svg>
                        </button>
                        <button className="call-btn reject-btn" onClick={handleReject} title="Reject">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                            </svg>
                        </button>
                    </>
                ) : (
                    <>
                        <button className={`call-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                {isMuted ? (
                                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                                ) : (
                                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z M17.3 11c0 3.53-2.61 6.43-6 6.92V21h-2v-3.08c-3.39-.49-6-3.39-6-6.92h2c0 2.76 2.24 5 5 5s5-2.24 5-5h2z"/>
                                )}
                            </svg>
                        </button>
                        {callData.isVideo && (
                            <button className={`call-btn ${isVideoOff ? 'active' : ''}`} onClick={toggleVideo} title={isVideoOff ? 'Turn on video' : 'Turn off video'}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    {isVideoOff ? (
                                        <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                                    ) : (
                                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                                    )}
                                </svg>
                            </button>
                        )}
                        <button className="call-btn hangup-btn" onClick={handleHangup} title="Hang up">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.70 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                            </svg>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

