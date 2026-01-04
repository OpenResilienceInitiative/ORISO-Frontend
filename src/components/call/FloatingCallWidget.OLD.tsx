/**
 * FloatingCallWidget - Professional Implementation
 * 
 * WhatsApp/Zoom-style floating call interface with:
 * - Draggable window
 * - Real-time status updates
 * - Professional UI/UX
 * - Bidirectional hangup sync
 */

import React, { useEffect, useRef, useState } from 'react';
import { callManager, CallData } from '../../services/CallManager';
import { matrixCallService } from '../../services/matrixCallService';
import './FloatingCallWidget.scss';

export const FloatingCallWidget: React.FC = () => {
    // STATE
    const [callData, setCallData] = useState<CallData | null>(null);
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    
    // Dragging state
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: window.innerWidth - 500, y: window.innerHeight - 400 });
    const dragStartPos = useRef({ x: 0, y: 0 });
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const callInitiatedRef = useRef(false);
    const widgetRef = useRef<HTMLDivElement>(null);

    console.log("🎨 FloatingCallWidget render - Call State:", callData?.state, "| Is Incoming:", callData?.isIncoming);

    // Subscribe to CallManager state changes
    useEffect(() => {
        console.log("📡 FloatingCallWidget: Subscribing to CallManager");
        
        const unsubscribe = callManager.subscribe((newCallData) => {
            console.log("═══════════════════════════════════════════════");
            console.log("📡 CallManager State Update Received");
            console.log("   State:", newCallData?.state);
            console.log("   Is Incoming:", newCallData?.isIncoming);
            console.log("   Has Matrix Call:", !!newCallData?.matrixCall);
            console.log("═══════════════════════════════════════════════");
            
            setCallData(newCallData);
            
            // Reset call initiated flag when call ends
            if (!newCallData) {
                callInitiatedRef.current = false;
                setCallDuration(0);
            }
        });

        // Get initial state
        setCallData(callManager.getCurrentCall());

        return () => {
            console.log("📡 FloatingCallWidget: Unsubscribing from CallManager");
            unsubscribe();
        };
    }, []);

    // Handle outgoing call initiation (ONCE per call)
    useEffect(() => {
        if (!callData) return;
        if (callData.isIncoming) return; // Don't initiate for incoming calls
        if (callInitiatedRef.current) return; // Already initiated
        if (callData.matrixCall) return; // Already have Matrix call object

        console.log("═══════════════════════════════════════════════");
        console.log("🚀 FloatingCallWidget: Initiating OUTGOING call");
        console.log("═══════════════════════════════════════════════");
        
        callInitiatedRef.current = true;

        // Request media permissions
        navigator.mediaDevices.getUserMedia({
            video: callData.isVideo,
            audio: true
        }).then((stream) => {
            console.log("✅ Media permissions granted:", stream.getTracks().map(t => t.kind));
            
            // Store stream globally to prevent garbage collection
            (window as any).__activeMediaStream = stream;
            
            // Start Matrix call
            return matrixCallService.startCall({
                roomId: callData.roomId,
                isVideoCall: callData.isVideo,
                localVideoElement: localVideoRef.current || undefined,
                remoteVideoElement: remoteVideoRef.current || undefined
            });
        }).then((matrixCall) => {
            console.log("✅ Matrix call started! Call ID:", (matrixCall as any).callId);
            console.log("═══════════════════════════════════════════════");
            
            callManager.setMatrixCall(matrixCall);
        }).catch((err) => {
            console.error("❌ Failed to start outgoing call:", err);
            alert(`Failed to start call: ${(err as Error).message || 'Unknown error'}`);
            callManager.endCall();
        });

    }, [callData]);

    // Call duration timer (starts when connected)
    useEffect(() => {
        if (callData?.state === 'connected') {
            console.log("⏱️  Starting call duration timer");
            const interval = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
            return () => {
                console.log("⏱️  Stopping call duration timer");
                clearInterval(interval);
            };
        } else {
            setCallDuration(0);
        }
    }, [callData?.state]);

    // Dragging functionality
    const handleMouseDown = (e: React.MouseEvent) => {
        // Don't drag when clicking buttons
        if ((e.target as HTMLElement).closest('.call-controls')) return;
        
        setIsDragging(true);
        dragStartPos.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
        console.log("🖱️  Drag started");
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            
            setPosition({
                x: e.clientX - dragStartPos.current.x,
                y: e.clientY - dragStartPos.current.y
            });
        };

        const handleMouseUp = () => {
            if (isDragging) {
                console.log("🖱️  Drag ended at position:", position);
                setIsDragging(false);
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, position]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            console.log("🧹 FloatingCallWidget unmounting, cleaning up media...");
            const stream = (window as any).__activeMediaStream;
            if (stream) {
                stream.getTracks().forEach((track: any) => track.stop());
                delete (window as any).__activeMediaStream;
            }
        };
    }, []);

    /**
     * Handle answering an incoming call
     */
    const handleAnswer = async () => {
        if (!callData || !callData.isIncoming) return;

        console.log("═══════════════════════════════════════════════");
        console.log("✅ USER CLICKED ANSWER BUTTON");
        console.log("═══════════════════════════════════════════════");

        try {
            // Get Matrix client
            const matrixClientService = (window as any).matrixClientService;
            const client = matrixClientService?.getClient();
            if (!client) {
                throw new Error("Matrix client not available");
            }

            // Find the incoming Matrix call
            const calls = client.callEventHandler?.calls;
            if (!calls) {
                throw new Error("Call handler not available");
            }

            const incomingCall = Array.from(calls.values()).find((call: any) => 
                call.roomId === callData.roomId && 
                call.direction === 'inbound' && 
                call.state === 'ringing'
            );

            if (!incomingCall) {
                throw new Error("No incoming call found to answer");
            }

            console.log("📞 Found incoming Matrix call, requesting media permissions...");

            // Request media permissions
            const stream = await navigator.mediaDevices.getUserMedia({
                video: callData.isVideo,
                audio: true
            });

            console.log("✅ Media permissions granted:", stream.getTracks().map(t => t.kind));
            
            // Store stream
            (window as any).__activeMediaStream = stream;

            // Update CallManager state
            callManager.answerCall();

            // Answer the Matrix call
            await matrixCallService.answerCall(
                incomingCall as any,
                callData.isVideo,
                localVideoRef.current || undefined,
                remoteVideoRef.current || undefined
            );

            console.log("✅ Call answered successfully!");
            console.log("═══════════════════════════════════════════════");

            // Attach Matrix call to CallManager
            callManager.setMatrixCall(incomingCall as any);

        } catch (err) {
            console.error("❌ Failed to answer call:", err);
            alert(`Failed to answer call: ${(err as Error).message || 'Unknown error'}`);
            callManager.endCall();
        }
    };

    /**
     * Handle rejecting an incoming call
     */
    const handleReject = () => {
        console.log("❌ USER CLICKED REJECT BUTTON");
        callManager.rejectCall();
    };

    /**
     * Handle hanging up
     */
    const handleHangup = () => {
        console.log("📴 USER CLICKED HANGUP BUTTON");
        callManager.endCall();
    };

    /**
     * Toggle mute
     */
    const toggleMute = () => {
        if (callData?.matrixCall) {
            (callData.matrixCall as any).setMicrophoneMuted(!isMuted);
            setIsMuted(!isMuted);
            console.log(`🎤 Microphone ${!isMuted ? 'muted' : 'unmuted'}`);
        }
    };

    /**
     * Toggle video
     */
    const toggleVideo = () => {
        if (callData?.matrixCall) {
            (callData.matrixCall as any).setLocalVideoMuted(!isVideoOff);
            setIsVideoOff(!isVideoOff);
            console.log(`📹 Video ${!isVideoOff ? 'off' : 'on'}`);
        }
    };

    /**
     * Format call duration
     */
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    /**
     * Toggle fullscreen mode
     */
    const toggleFullscreen = () => {
        console.log("🖥️  Toggling fullscreen:", !isFullscreen);
        setIsFullscreen(!isFullscreen);
        if (!isFullscreen) {
            setIsMinimized(false); // Exit minimized when entering fullscreen
        }
    };

    /**
     * Toggle minimized mode
     */
    const toggleMinimized = () => {
        console.log("📦 Toggling minimized:", !isMinimized);
        setIsMinimized(!isMinimized);
        if (!isMinimized) {
            setIsFullscreen(false); // Exit fullscreen when minimizing
        }
    };

    /**
     * Close/hangup call
     */
    const handleClose = () => {
        console.log("❌ Close button clicked");
        handleHangup();
    };

    // Don't render if no active call
    if (!callData) {
        console.log("🎨 FloatingCallWidget: Not rendering (no active call)");
        return null;
    }

    console.log("🎨 FloatingCallWidget: Rendering with state:", callData.state);

    // Determine status text based on call state
    const getStatusText = () => {
        if (callData.isIncoming && callData.state === 'ringing') {
            return '📞 Incoming Call...';
        }
        if (!callData.isIncoming && callData.state === 'ringing') {
            return '📞 Calling...';
        }
        if (callData.state === 'connecting') {
            return '🔄 Connecting...';
        }
        if (callData.state === 'connected') {
            return `✅ ${formatDuration(callDuration)}`;
        }
        return 'Call Active';
    };

    // Determine widget class based on mode
    const widgetClass = `floating-call-widget ${
        isFullscreen ? 'fullscreen' : isMinimized ? 'minimized' : 'normal'
    }`;

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
                    <span className="call-status">
                        {getStatusText()}
                    </span>
                    {callData.callerUserId && (
                        <span className="caller-name">
                            {callData.callerUserId.replace('@', '').split(':')[0]}
                        </span>
                    )}
                </div>
                
                {/* Window Controls */}
                <div className="window-controls">
                    <button 
                        className="control-btn minimize"
                        onClick={toggleMinimized}
                        title={isMinimized ? "Restore" : "Minimize"}
                    >
                        {isMinimized ? '🔼' : '🔽'}
                    </button>
                    <button 
                        className="control-btn fullscreen"
                        onClick={toggleFullscreen}
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? '⊡' : '⊞'}
                    </button>
                    <button 
                        className="control-btn close"
                        onClick={handleClose}
                        title="Close & Hang Up"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Video area */}
            <div className="call-video-area">
                {/* Avatar placeholder (shows when no video or during ringing) */}
                {callData.state === 'ringing' && (
                    <div className="call-avatar">
                        {callData.callerUserId ? 
                            callData.callerUserId.charAt(1).toUpperCase() : 
                            '👤'
                        }
                    </div>
                )}
                
                <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline
                    className="remote-video"
                    style={{ display: callData.state === 'ringing' ? 'none' : 'block' }}
                />
                <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="local-video"
                    style={{ display: callData.state === 'ringing' ? 'none' : 'block' }}
                />
            </div>

            {/* Controls */}
            <div className="call-controls">
                {(callData.state === 'ringing' || (callData.isIncoming && !callData.matrixCall)) ? (
                    // Incoming call: Show Answer/Reject (circular buttons)
                    <>
                        <button 
                            className="call-btn answer-btn" 
                            onClick={handleAnswer}
                            title="Answer"
                        >
                            📞
                        </button>
                        <button 
                            className="call-btn reject-btn" 
                            onClick={handleReject}
                            title="Reject"
                        >
                            ✖️
                        </button>
                    </>
                ) : (
                    // Active/Connecting call: Show Mute/Video/Hangup (circular buttons)
                    <>
                        <button 
                            className={`call-btn ${isMuted ? 'active' : ''}`}
                            onClick={toggleMute}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? '🔇' : '🎤'}
                        </button>
                        {callData.isVideo && (
                            <button 
                                className={`call-btn ${isVideoOff ? 'active' : ''}`}
                                onClick={toggleVideo}
                                title={isVideoOff ? 'Turn on video' : 'Turn off video'}
                            >
                                {isVideoOff ? '📷' : '📹'}
                            </button>
                        )}
                        <button 
                            className="call-btn hangup-btn" 
                            onClick={handleHangup}
                            title="Hang up"
                        >
                            📞
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

