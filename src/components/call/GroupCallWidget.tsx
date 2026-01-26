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
    
    // Dragging state
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const dragRef = useRef<{ startX: number; startY: number; elemX: number; elemY: number } | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Subscribe to CallManager
    useEffect(() => {
        const unsubscribe = callManager.subscribe((newCallData) => {
            console.log('📡 GroupCallWidget: CallManager update:', newCallData);
            setCallData(newCallData);
            setCallState(newCallData?.state || null);
            if (!newCallData) {
                setElementCallUrl('');
            }
        });
        const currentCall = callManager.getCurrentCall();
        setCallData(currentCall);
        setCallState(currentCall?.state || null);
        return () => unsubscribe();
    }, []);

    // Handle incoming call answer: once the call is moving past "ringing",
    // automatically join the Element Call room for the receiver.
    useEffect(() => {
        if (!callData || !callData.isGroup || !callData.isIncoming) return;
        if (elementCallUrl) return; // Already joined
        if (callState !== 'connecting' && callState !== 'in_call') return;

        console.log('✅ Incoming group call moving to state', callState, '- setting up Element Call for receiver...');
        setupElementCall();
    }, [callState, callData, elementCallUrl]);

    // Handle outgoing call
    useEffect(() => {
        if (!callData || !callData.isGroup || callData.isIncoming) return;
        if (elementCallUrl) return; // Already set up

        console.log('📞 Starting outgoing call, setting up Element Call...');
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
            const elementCallBaseUrl = 'https://call.oriso.site/room';

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
            
            console.log('🔗 Element Call URL:', url);
            console.log('🔑 Passing Matrix credentials for auto-authentication');
            setElementCallUrl(url);

            // Send credentials via postMessage immediately when iframe loads
            const sendCredentials = () => {
                if (iframeRef.current?.contentWindow) {
                    console.log('📤 Sending Matrix credentials to Element Call via postMessage');
                    
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
            console.error('❌ Failed to setup Element Call:', err);
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
            console.log(`📞 Element Call widget action: ${action}`, data);
            
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
                    console.log(`ℹ️  Unhandled widget action: ${action}`);
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
            console.error('❌ Error handling widget action:', err);
        }
    };

    const handleAnswer = () => {
        if (!callData || !callData.isIncoming) return;
        console.log('✅ User clicked Answer');
        // Tell Matrix/CallManager that we are accepting the call
        callManager.answerCall();

        // Proactively start/join the Element Call room so the user lands
        // directly in the call UI without any extra "Join" step.
        if (!elementCallUrl) {
            console.log('📞 Answer clicked, setting up Element Call immediately for receiver...');
            setupElementCall();
        }
    };

    const handleDecline = () => {
        console.log('❌ User declined call');
        callManager.endCall();
    };

    const handleEndCall = () => {
        console.log('📴 Ending call');
        
        // Cleanup widget message handler
        if (iframeRef.current && (iframeRef.current as any).__widgetMessageHandler) {
            window.removeEventListener('message', (iframeRef.current as any).__widgetMessageHandler);
            delete (iframeRef.current as any).__widgetMessageHandler;
        }
        
        setElementCallUrl('');
        callManager.endCall();
    };

    // Dragging handlers (mouse + touch)
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.btn-end-call, .btn-answer, .btn-decline, iframe')) return;
        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            elemX: position.x,
            elemY: position.y
        };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if ((e.target as HTMLElement).closest('.btn-end-call, .btn-answer, .btn-decline, iframe')) return;
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
    if (!callData || !callData.isGroup) return null;

    return (
        <div 
            className={`group-call-widget ${isDragging ? 'dragging' : ''}`}
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
        >
            {/* Incoming call - show answer/decline buttons */}
            {callData.isIncoming && callData.state === 'ringing' ? (
                <div className="incoming-call-popup">
                    <div className="incoming-call-header">
                        <span>CALL</span>
                    </div>
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
                <div className="element-call-container">
                    <div className="element-call-header">
                        <span>CALL</span>
                        <button className="btn-end-call" onClick={handleEndCall}>
                            Close
                        </button>
                    </div>
                    <iframe
                        ref={iframeRef}
                        src={elementCallUrl}
                        className="element-call-iframe"
                        allow="camera; microphone; display-capture; autoplay; fullscreen"
                        allowFullScreen
                        title="Element Call - Group Video Call"
                    />
                </div>
            ) : (
                /* Connecting state */
                <div className="connecting-popup">
                    <div className="connecting-header">
                        <span>CALL</span>
                    </div>
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

