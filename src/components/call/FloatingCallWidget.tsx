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
    const [otherUserInitial, setOtherUserInitial] = useState<string>('U');
    
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState(() => {
        // Center the popup initially
        const popupWidth = 460;
        const popupHeight = 560;
        return {
            x: (window.innerWidth - popupWidth) / 2,
            y: (window.innerHeight - popupHeight) / 2
        };
    });
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

    // Get other user's initial from Matrix room
    useEffect(() => {
        if (!callData) return;

        const matrixClientService = (window as any).matrixClientService;
        if (!matrixClientService) return;

        const client = matrixClientService.getClient();
        if (!client) return;

        const room = client.getRoom(callData.roomId);
        if (!room) return;

        // Get room members
        const members = room.getMembers();
        const myUserId = client.getUserId();

        // Find the OTHER user (not me)
        const otherUser = members.find((m: any) => m.userId !== myUserId);

        if (otherUser) {
            const username = otherUser.name || otherUser.userId;
            const initial = username.replace('@', '').charAt(0).toUpperCase();
            console.log('👤 Other user:', username, '→ Initial:', initial);
            setOtherUserInitial(initial);
        } else {
            // Fallback: use callerUserId if incoming
            if (callData.callerUserId) {
                const initial = callData.callerUserId.replace('@', '').charAt(0).toUpperCase();
                setOtherUserInitial(initial);
            }
        }
    }, [callData]);

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
            {/* Header - Element style */}
            <div className="call-header" style={{ cursor: isFullscreen ? 'default' : 'grab' }}>
                <div className="call-header-left">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                    </svg>
                    <span>Call</span>
                </div>
                
                <button className="fullscreen-toggle" onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} title="Fullscreen">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                        </svg>
                    </button>
            </div>

            {/* Video area */}
            <div className="call-video-area">
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
                
                {/* Large avatar - always show for voice or when ringing */}
                {(!callData.isVideo || callData.state === 'ringing') && (
                    <div className="call-avatar-large">
                        {otherUserInitial}
                    </div>
                )}
            </div>

            {/* Controls - Element exact design */}
            <div className="call-controls">
                {(callData.state === 'ringing' || (callData.isIncoming && !callData.matrixCall)) ? (
                    <>
                        <button className="call-btn answer-btn" onClick={handleAnswer} title="Answer">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                            </svg>
                        </button>
                        <button className="call-btn reject-btn" onClick={handleReject} title="Reject">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                            </svg>
                        </button>
                    </>
                ) : (
                    <>
                        {/* Microphone - NO dropdown arrow */}
                        <button className={`call-btn ${isMuted ? 'muted' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                                {isMuted ? (
                                    <>
                                        <path d="M13 8c0 .564-.094 1.107-.266 1.613l-.814-.814A4.02 4.02 0 0 0 12 8V7a.5.5 0 0 1 1 0v1zm-5 4c.818 0 1.578-.245 2.212-.667l.718.719a4.973 4.973 0 0 1-2.43.923V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 1 0v1a4 4 0 0 0 4 4zm3-9v4.879L5.158 2.037A3.001 3.001 0 0 1 11 3z"/>
                                        <path d="M9.486 10.607 5 6.12V8a3 3 0 0 0 4.486 2.607zm-7.84-9.253 12 12 .708-.708-12-12-.708.708z"/>
                                    </>
                                ) : (
                                    <>
                                        <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V3z"/>
                                        <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z"/>
                                    </>
                                )}
                            </svg>
                        </button>

                        {/* Camera - NO dropdown arrow */}
                        {callData.isVideo && (
                            <button className={`call-btn ${isVideoOff ? 'video-off' : ''}`} onClick={toggleVideo} title={isVideoOff ? 'Turn on video' : 'Turn off video'}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    {isVideoOff ? (
                                        <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                                    ) : (
                                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                                    )}
                                </svg>
                            </button>
                        )}

                        {/* Screen share - Hidden for now */}
                        {/* <button className="call-btn" title="Share screen">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 7l5-5v4h6v2h-6v4l-5-5z"/>
                                <rect x="3" y="15" width="18" height="2" fill="currentColor"/>
                            </svg>
                        </button> */}

                        {/* More options - Hidden */}
                        {/* <button className="call-btn" title="More options">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="6" cy="12" r="2"/>
                                <circle cx="12" cy="12" r="2"/>
                                <circle cx="18" cy="12" r="2"/>
                            </svg>
                        </button> */}

                        {/* Hang up */}
                        <button className="call-btn hangup-btn" onClick={handleHangup} title="End call">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.70 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                            </svg>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

