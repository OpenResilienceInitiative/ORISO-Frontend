/**
 * GroupCallWidget - Multi-participant group video calls using Element Call
 * Element Call is a production-ready group calling solution built on Matrix and LiveKit
 * https://github.com/element-hq/element-call
 */

import React, { useEffect, useState, useRef } from 'react';
import { callManager, CallData } from '../../services/CallManager';
import './GroupCallWidget.scss';

export const GroupCallWidget: React.FC = () => {
    const [callData, setCallData] = useState<CallData | null>(null);
    const [callState, setCallState] = useState<string | null>(null);
    const [elementCallUrl, setElementCallUrl] = useState<string>('');
    const [isDismissed, setIsDismissed] = useState(false);
    
    // Dragging state
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isMobileView, setIsMobileView] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; elemX: number; elemY: number } | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Subscribe to CallManager
    useEffect(() => {
        const unsubscribe = callManager.subscribe((newCallData) => {
            // console.log('📡 GroupCallWidget: CallManager update:', newCallData);
            setCallData(newCallData);
            setCallState(newCallData?.state || null);
            if (newCallData) {
                setIsDismissed(false);
            }
            if (!newCallData) {
                setElementCallUrl('');
            }
        });
        const currentCall = callManager.getCurrentCall();
        setCallData(currentCall);
        setCallState(currentCall?.state || null);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const updateViewport = () => {
            setIsMobileView(window.innerWidth <= 640);
        };

        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    useEffect(() => {
        if (!callData || !callData.isGroup) return;

        const padding = 16;
        const maxWidth = 520;
        const maxHeight = 320;
        const width = Math.min(maxWidth, window.innerWidth - padding);
        const height = Math.min(maxHeight, window.innerHeight - padding);

        if (window.innerWidth <= 640) {
            setPosition({ x: 0, y: 0 });
            return;
        }

        setPosition({
            x: Math.max(padding, window.innerWidth - width - padding),
            y: Math.max(padding, window.innerHeight - height - padding),
        });
    }, [callData, elementCallUrl]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const data = event.data;
            if (!data || typeof data !== 'object') return;
            if (data.type !== 'oriso-call-ended') return;
            // console.log('📴 Element Call ended (message from iframe)');
            setElementCallUrl('');
            setCallData(null);
            setCallState(null);
            setIsDismissed(true);
            callManager.endCall();
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Handle incoming call answer: once the call is moving past "ringing",
    // automatically join the Element Call room for the receiver.
    useEffect(() => {
        if (!callData || !callData.isGroup || !callData.isIncoming) return;
        if (elementCallUrl) return; // Already joined
        if (callState !== 'connecting' && callState !== 'in_call') return;

        // console.log('✅ Incoming group call moving to state', callState, '- setting up Element Call for receiver...');
        setupElementCall();
    }, [callState, callData, elementCallUrl]);

    // Handle outgoing call
    useEffect(() => {
        if (!callData || !callData.isGroup || callData.isIncoming) return;
        if (elementCallUrl) return; // Already set up

        // console.log('📞 Starting outgoing call, setting up Element Call...');
        setupElementCall();
    }, [callData]);

    const setupElementCall = () => {
        if (!callData) return;

        try {
            const matrixClientService = (window as any).matrixClientService;
            const client = matrixClientService?.getClient();
            if (!client) throw new Error('Matrix client not initialized');

            // For group calls we use the dedicated Element Call room if present.
            const roomId = (callData as any).elementCallRoomId || callData.roomId;
            const homeserverUrl = client.getHomeserverUrl() || 'https://matrix.oriso.site';
            
            // Get Matrix credentials
            const accessToken = (client as any).accessToken || localStorage.getItem('matrix_access_token');
            const userId = client.getUserId() || localStorage.getItem('matrix_user_id');
            const deviceId = (client as any).deviceId || localStorage.getItem('matrix_device_id');
            
            if (!accessToken || !userId) {
                throw new Error('Matrix authentication not available');
            }

            // Element Call - open the specific Matrix room directly.
            // We mirror Element Call's own `getRelativeRoomUrl` format:
            //   /room/#?roomId=...&perParticipantE2EE=...
            // We also pass Matrix credentials via URL so our auto-auth script can log in.
            const elementCallBaseUrl =
                `${(process.env.REACT_APP_ELEMENT_CALL_URL || '').replace(/\/+$/, '')}/room`;

            const params = new URLSearchParams();
            params.set('roomId', roomId);
            // Hint Element Call that this is a normal "start call" use-case so
            // it enables camera & microphone by default.
            params.set('intent', 'start_call');
            params.set('homeserver', homeserverUrl);
            params.set('accessToken', accessToken);
            params.set('userId', userId);
            if (deviceId) params.set('deviceId', deviceId);
            // Skip lobby and go straight into the call UI
            params.set('skipLobby', 'true');

            const url = `${elementCallBaseUrl}/#?${params.toString()}`;
            
            // console.log('🔗 Element Call URL:', url);
            // console.log('🔑 Passing Matrix credentials for auto-authentication');
            setElementCallUrl(url);

            // Send credentials via postMessage immediately when iframe loads
            const sendCredentials = () => {
                if (iframeRef.current?.contentWindow) {
                    // console.log('📤 Sending Matrix credentials to Element Call via postMessage');
                    
                    // Send credentials in multiple formats Element Call might accept
                    iframeRef.current.contentWindow.postMessage({
                        type: 'matrix-credentials',
                        accessToken: accessToken,
                        userId: userId,
                        deviceId: deviceId,
                        homeserverUrl: homeserverUrl
                    }, elementCallBaseUrl);
                    
                    iframeRef.current.contentWindow.postMessage({
                        type: 'auth',
                        accessToken: accessToken,
                        userId: userId,
                        deviceId: deviceId,
                        baseUrl: homeserverUrl
                    }, elementCallBaseUrl);
                }
            };
            
            // Send immediately and also when iframe loads
            setTimeout(sendCredentials, 500);
            if (iframeRef.current) {
                iframeRef.current.onload = sendCredentials;
            }

        } catch (err) {
            // console.error('❌ Failed to setup Element Call:', err);
            alert(`Failed to start call: ${(err as Error).message}`);
            callManager.endCall();
        }
    };

    // Handle Element Call widget API actions
    const handleWidgetAction = async (
        action: string,
        requestId: string,
        data: any,
        client: any,
        source: Window
    ) => {
        try {
            // console.log(`📞 Element Call widget action: ${action}`, data);
            
            // Element Call requests Matrix operations via widget API
            // We proxy these to our authenticated Matrix client
            let response: any = { success: false };
            
            switch (action) {
                case 'm.sticker':
                case 'm.room.message':
                    // Element Call wants to send a message - not needed for calls
                    response = { success: true };
                    break;
                    
                case 'io.element.join':
                    // Element Call ready to join - already handled by URL params
                    response = { success: true };
                    break;
                    
                default:
                    // console.log(`ℹ️  Unhandled widget action: ${action}`);
                    response = { success: true };
            }
            
            // Send response back to Element Call
            source.postMessage({
                api: 'toWidget',
                action: action,
                requestId: requestId,
                response: response
            }, '*');
            
        } catch (err) {
            // console.error('❌ Error handling widget action:', err);
        }
    };

    const handleAnswer = () => {
        if (!callData || !callData.isIncoming) return;
        // console.log('✅ User clicked Answer');
        // Tell Matrix/CallManager that we are accepting the call
        callManager.answerCall();

        // Proactively start/join the Element Call room so the user lands
        // directly in the call UI without any extra "Join" step.
        if (!elementCallUrl) {
            // console.log('📞 Answer clicked, setting up Element Call immediately for receiver...');
            setupElementCall();
        }
    };

    const handleDecline = () => {
        // console.log('❌ User declined call');
        setIsDismissed(true);
        callManager.endCall();
    };

    const handleEndCall = () => {
        // console.log('📴 Ending call');
        
        // Cleanup widget message handler
        if (iframeRef.current && (iframeRef.current as any).__widgetMessageHandler) {
            window.removeEventListener('message', (iframeRef.current as any).__widgetMessageHandler);
            delete (iframeRef.current as any).__widgetMessageHandler;
        }

        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
                { type: 'oriso-call-action', action: 'hangup' },
                '*',
            );
        }
        
        if (iframeRef.current) {
            iframeRef.current.src = 'about:blank';
        }
        setElementCallUrl('');
        setCallData(null);
        setCallState(null);
        setIsDismissed(true);
        callManager.endCall();
    };

    const handleToggleFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;

        if (document.fullscreenElement) {
            document.exitFullscreen?.();
            return;
        }

        container.requestFullscreen?.();
    };

    // Dragging handlers (mouse + touch)
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isMobileView) return;
        const target = e.target as HTMLElement;
        const isDragHandle = !!target.closest('.element-call-drag-handle');
        if (elementCallUrl && !isDragHandle) return;
        if (target.closest('.btn-end-call, .btn-answer, .btn-decline, iframe, .element-call-close')) return;
        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            elemX: position.x,
            elemY: position.y
        };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (isMobileView) return;
        const target = e.target as HTMLElement;
        const isDragHandle = !!target.closest('.element-call-drag-handle');
        if (elementCallUrl && !isDragHandle) return;
        if (target.closest('.btn-end-call, .btn-answer, .btn-decline, iframe, .element-call-close')) return;
        const touch = e.touches[0];
        setIsDragging(true);
        dragRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            elemX: position.x,
            elemY: position.y
        };
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPosition({
            x: dragRef.current.elemX + dx,
            y: dragRef.current.elemY + dy
        });
    };

    const handleTouchMove = (e: TouchEvent) => {
        if (!isDragging || !dragRef.current) return;
        const touch = e.touches[0];
        const dx = touch.clientX - dragRef.current.startX;
        const dy = touch.clientY - dragRef.current.startY;
        setPosition({
            x: dragRef.current.elemX + dx,
            y: dragRef.current.elemY + dy
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        dragRef.current = null;
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        dragRef.current = null;
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleTouchEnd);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
                window.removeEventListener('touchmove', handleTouchMove);
                window.removeEventListener('touchend', handleTouchEnd);
            };
        }
    }, [isDragging]);

    // Only render for group calls
    if (isDismissed || !callData || !callData.isGroup) return null;

    return (
        <div 
            className={`group-call-widget ${isDragging ? 'dragging' : ''} ${isMobileView ? 'group-call-widget--mobile' : ''} ${isFullscreen ? 'group-call-widget--fullscreen' : ''}`}
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
        >
            {/* Incoming call - show answer/decline buttons */}
            {callData.isIncoming && callData.state === 'ringing' ? (
                <div className="incoming-call-popup">
                    <button
                        className="element-call-close"
                        onClick={handleDecline}
                        aria-label="Close call"
                    >
                        ×
                    </button>
                    <div className="incoming-call-content">
                        <div className="call-avatar-large">G</div>
                        <h2>Incoming Call</h2>
                        <p>Someone is calling...</p>
                        <div className="incoming-call-actions">
                            <button className="btn-answer" onClick={handleAnswer}>
                                Answer
                            </button>
                            <button className="btn-decline" onClick={handleDecline}>
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            ) : elementCallUrl ? (
                /* Active call - show Element Call iframe */
                <div className="element-call-container" ref={containerRef}>
                    <div className="element-call-drag-handle" />
                    <button className="element-call-close" onClick={handleEndCall} aria-label="Close call">
                        ×
                    </button>
                    {!isMobileView && (
                        <button
                            className="element-call-fullscreen"
                            onClick={handleToggleFullscreen}
                            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
                        >
                            {isFullscreen ? '⤡' : '⤢'}
                        </button>
                    )}
                    <iframe
                        ref={iframeRef}
                        src={elementCallUrl}
                        className="element-call-iframe"
                        allow="camera; microphone; display-capture; autoplay; fullscreen"
                        allowFullScreen
                        title="Group video call"
                    />
                </div>
            ) : (
                /* Connecting state */
                <div className="connecting-popup">
                    <button
                        className="element-call-close"
                        onClick={handleEndCall}
                        aria-label="Close call"
                    >
                        ×
                    </button>
                    <div className="connecting-content">
                        <div className="call-avatar-large">G</div>
                        <h2>Connecting...</h2>
                        <p>Setting up call</p>
                    </div>
                </div>
            )}
        </div>
    );
};

