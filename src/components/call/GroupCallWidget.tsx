/**
 * GroupCallWidget - Multi-participant group video calls using Element Call
 * Element Call is a production-ready group calling solution built on Matrix and LiveKit
 * https://github.com/element-hq/element-call
 */

import React, { useEffect, useState, useRef } from 'react';
import { callManager, CallData } from '../../services/CallManager';
import {
	getElementCallBaseUrl,
	getMatrixHomeserverUrl
} from '../../resources/scripts/runtimeConfig';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import { getElementCallAccessToken } from '../sessionCookie/getMatrixAccessToken';
import {
	getAutoFitStageSize,
	RESIZE_EDGES,
	resizeCursorForEdge,
	resizeStageFromPointer,
	type ResizeEdge,
	type Size
} from '../../utils/videoTileSizing';
import { releaseWindowMediaStream } from '../../utils/callMediaStreamCleanup';
import './GroupCallWidget.scss';

const GROUP_DEFAULT_WIDTH = 520;
const GROUP_DEFAULT_HEIGHT = 320;
const GROUP_ASPECT = GROUP_DEFAULT_WIDTH / GROUP_DEFAULT_HEIGHT;
const GROUP_MIN = { width: 280, height: 180 };

export const GroupCallWidget: React.FC = () => {
	const { matrixClientService } = useMatrixClient();
	const [callData, setCallData] = useState<CallData | null>(null);
	const [callState, setCallState] = useState<string | null>(null);
	const [elementCallUrl, setElementCallUrl] = useState<string>('');
	const [isDismissed, setIsDismissed] = useState(false);

	// Dragging / resize state
	const [isDragging, setIsDragging] = useState(false);
	const [isResizing, setIsResizing] = useState(false);
	const [stageSize, setStageSize] = useState<Size>({
		width: GROUP_DEFAULT_WIDTH,
		height: GROUP_DEFAULT_HEIGHT
	});
	const [position, setPosition] = useState({ x: 100, y: 100 });
	const [isMobileView, setIsMobileView] = useState(false);
	const [isMobileCompact, setIsMobileCompact] = useState(false);
	const dragRef = useRef<{
		startX: number;
		startY: number;
		elemX: number;
		elemY: number;
	} | null>(null);
	const resizeStartRef = useRef<{
		edge: ResizeEdge;
		x: number;
		y: number;
		width: number;
		height: number;
		posX: number;
		posY: number;
	} | null>(null);
	const [resizeCursor, setResizeCursor] = useState('nwse-resize');
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const setupInProgressRef = useRef(false);
	const [isFullscreen, setIsFullscreen] = useState(false);

	const getGroupBounds = () => ({
		minWidth: GROUP_MIN.width,
		minHeight: GROUP_MIN.height,
		maxWidth: Math.max(GROUP_MIN.width, window.innerWidth - 32),
		maxHeight: Math.max(GROUP_MIN.height, window.innerHeight - 32)
	});

	const applyAutoFit = () => {
		const bounds = getGroupBounds();
		const next = getAutoFitStageSize({
			aspectRatio: GROUP_ASPECT,
			maxWidth: bounds.maxWidth,
			maxHeight: bounds.maxHeight,
			preferredWidth: GROUP_DEFAULT_WIDTH,
			preferredHeight: GROUP_DEFAULT_HEIGHT,
			minWidth: bounds.minWidth,
			minHeight: bounds.minHeight
		});
		setStageSize(next);
		setPosition({
			x: Math.max(16, (window.innerWidth - next.width) / 2),
			y: Math.max(16, (window.innerHeight - next.height) / 2)
		});
	};

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
				setupInProgressRef.current = false;
			}
		});
		const currentCall = callManager.getCurrentCall();
		setCallData(currentCall);
		setCallState(currentCall?.state || null);
		return () => unsubscribe();
	}, []);

	useEffect(() => {
		const updateViewport = () => {
			const mobile = window.innerWidth <= 640;
			setIsMobileView(mobile);
			if (!mobile) {
				// Compact mode is mobile-only; reset it on larger screens.
				setIsMobileCompact(false);
			}
		};

		updateViewport();
		window.addEventListener('resize', updateViewport);
		return () => window.removeEventListener('resize', updateViewport);
	}, []);

	useEffect(() => {
		if (!callData || !callData.usesElementCall) return;

		if (window.innerWidth <= 640) {
			setPosition({ x: 0, y: 0 });
			return;
		}

		applyAutoFit();
		// Re-center only when a new call starts or the url changes; the full
		// callData object gets a new identity on every call-state update.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [callData?.callId, callData?.usesElementCall, elementCallUrl]);

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		return () =>
			document.removeEventListener(
				'fullscreenchange',
				handleFullscreenChange
			);
	}, []);

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const data = event.data;
			if (!data || typeof data !== 'object') return;
			if (data.type !== 'oriso-call-ended') return;
			setElementCallUrl('');
			setCallData(null);
			setCallState(null);
			setIsDismissed(true);
			if (callManager.hasActiveCall()) {
				callManager.endCall();
			}
		};
		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	// Handle incoming call answer: once the call is moving past "ringing",
	// automatically join the Element Call room for the receiver.
	useEffect(() => {
		if (!callData || !callData.usesElementCall || !callData.isIncoming)
			return;
		if (elementCallUrl) return; // Already joined
		if (callState !== 'connecting' && callState !== 'in_call') return;

		// console.log('✅ Incoming group call moving to state', callState, '- setting up Element Call for receiver...');
		void setupElementCall();
		// setupElementCall is re-created every render; including it would make
		// this effect run on each render instead of on call-state changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [callState, callData, elementCallUrl, matrixClientService]);

	// Handle outgoing call
	useEffect(() => {
		if (!callData || !callData.usesElementCall || callData.isIncoming)
			return;
		if (elementCallUrl) return; // Already set up

		// console.log('📞 Starting outgoing call, setting up Element Call...');
		void setupElementCall();
		// setupElementCall is re-created every render and elementCallUrl is only
		// used as an "already set up" guard; adding them would re-run this
		// effect on every render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [callData, matrixClientService]);

	const setupElementCall = async () => {
		if (!callData || setupInProgressRef.current) return;
		setupInProgressRef.current = true;

		try {
			// Parent-page warm-up streams must not hold the camera while the
			// Element Call iframe opens its own capture.
			releaseWindowMediaStream('__preRequestedMediaStream');

			const client = matrixClientService?.getClient();
			if (!client) throw new Error('Matrix client not initialized');

			// For group calls we use the dedicated Element Call room if present.
			const roomId =
				(callData as any).elementCallRoomId || callData.roomId;
			const elementCallLogin = await getElementCallAccessToken();
			const homeserverUrl =
				elementCallLogin.homeserverUrl ||
				client.getHomeserverUrl() ||
				getMatrixHomeserverUrl();
			if (!homeserverUrl) {
				throw new Error(
					'Matrix homeserver URL is missing. Set REACT_APP_MATRIX_HOMESERVER_URL or ensure the client reports a homeserver URL.'
				);
			}

			// Element Call runs on a different origin and therefore must own a
			// separate Matrix device/crypto store. Reusing the ORISO app device
			// causes the two clients to overwrite each other's device keys.
			const { accessToken, userId, deviceId } = elementCallLogin;

			if (!accessToken || !userId || !deviceId) {
				throw new Error('Matrix authentication not available');
			}
			if (client.getUserId() && client.getUserId() !== userId) {
				throw new Error('Element Call Matrix identity mismatch');
			}

			// Element Call - open the specific Matrix room directly.
			// We mirror Element Call's own `getRelativeRoomUrl` format:
			//   /room/#?roomId=...&perParticipantE2EE=...
			// We also pass Matrix credentials via URL so our auto-auth script can log in.
			const elementCallOrigin = getElementCallBaseUrl();
			if (!elementCallOrigin) {
				throw new Error('REACT_APP_ELEMENT_CALL_BASE_URL is not set');
			}
			const elementCallBaseUrl = `${elementCallOrigin}/room`;

			const params = new URLSearchParams();
			params.set('roomId', roomId);
			// Hint Element Call that this is a normal "start call" use-case.
			params.set('intent', 'start_call');
			params.set('callIntent', callData.isVideo ? 'video' : 'audio');
			params.set('homeserver', homeserverUrl);
			params.set('accessToken', accessToken);
			params.set('userId', userId);
			if (deviceId) params.set('deviceId', deviceId);
			// Skip lobby and go straight into the call UI
			params.set('skipLobby', 'true');
			// Keep embedded users inside the current room flow (no home navigation).
			params.set('confineToRoom', 'true');
			// Use Element Call without top app bar in embedded popup mode.
			// This removes the duplicate left collapse control and room title.
			params.set('header', 'none');

			const url = `${elementCallBaseUrl}/#?${params.toString()}`;

			// console.log('🔗 Element Call URL:', url);
			// console.log('🔑 Passing Matrix credentials for auto-authentication');
			setElementCallUrl(url);

			// Send credentials via postMessage immediately when iframe loads
			const sendCredentials = () => {
				if (iframeRef.current?.contentWindow) {
					// console.log('📤 Sending Matrix credentials to Element Call via postMessage');

					// Send credentials in multiple formats Element Call might accept
					iframeRef.current.contentWindow.postMessage(
						{
							type: 'matrix-credentials',
							accessToken: accessToken,
							userId: userId,
							deviceId: deviceId,
							homeserverUrl: homeserverUrl
						},
						elementCallBaseUrl
					);

					iframeRef.current.contentWindow.postMessage(
						{
							type: 'auth',
							accessToken: accessToken,
							userId: userId,
							deviceId: deviceId,
							baseUrl: homeserverUrl
						},
						elementCallBaseUrl
					);
				}
			};

			// Send immediately and also when iframe loads
			setTimeout(sendCredentials, 500);
			if (iframeRef.current) {
				iframeRef.current.onload = sendCredentials;
			}
		} catch (err) {
			setupInProgressRef.current = false;
			// console.error('❌ Failed to setup Element Call:', err);
			alert(`Failed to start call: ${(err as Error).message}`);
			callManager.endCall();
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
			void setupElementCall();
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
		if (
			iframeRef.current &&
			(iframeRef.current as any).__widgetMessageHandler
		) {
			window.removeEventListener(
				'message',
				(iframeRef.current as any).__widgetMessageHandler
			);
			delete (iframeRef.current as any).__widgetMessageHandler;
		}

		if (iframeRef.current?.contentWindow) {
			iframeRef.current.contentWindow.postMessage(
				{ type: 'oriso-call-action', action: 'hangup' },
				'*'
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
		if (isMobileView) {
			setIsMobileCompact((value) => !value);
			return;
		}

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
		if (isMobileView || isResizing) return;
		const target = e.target as HTMLElement;
		const isDragHandle = !!target.closest('.element-call-drag-handle');
		if (elementCallUrl && !isDragHandle) return;
		if (
			target.closest(
				'.btn-end-call, .btn-answer, .btn-decline, iframe, .element-call-close, .element-call-fullscreen, .element-call-autofit, .call-resize-handle'
			)
		)
			return;
		setIsDragging(true);
		dragRef.current = {
			startX: e.clientX,
			startY: e.clientY,
			elemX: position.x,
			elemY: position.y
		};
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		if (isMobileView || isResizing) return;
		const target = e.target as HTMLElement;
		const isDragHandle = !!target.closest('.element-call-drag-handle');
		if (elementCallUrl && !isDragHandle) return;
		if (
			target.closest(
				'.btn-end-call, .btn-answer, .btn-decline, iframe, .element-call-close, .element-call-fullscreen, .element-call-autofit, .call-resize-handle'
			)
		)
			return;
		const touch = e.touches[0];
		setIsDragging(true);
		dragRef.current = {
			startX: touch.clientX,
			startY: touch.clientY,
			elemX: position.x,
			elemY: position.y
		};
	};

	const handleResizePointerDown = (
		e: React.PointerEvent,
		edge: ResizeEdge
	) => {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		if (isMobileView || isFullscreen || isMobileCompact) return;
		(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
		setIsResizing(true);
		setResizeCursor(resizeCursorForEdge(edge));
		resizeStartRef.current = {
			edge,
			x: e.clientX,
			y: e.clientY,
			width: stageSize.width,
			height: stageSize.height,
			posX: position.x,
			posY: position.y
		};
	};

	const handlePointerMove = (e: PointerEvent) => {
		if (isResizing && resizeStartRef.current) {
			const start = resizeStartRef.current;
			const widgetAspect = start.width / start.height || GROUP_ASPECT;
			const next = resizeStageFromPointer({
				edge: start.edge,
				startSize: { width: start.width, height: start.height },
				startPosition: { x: start.posX, y: start.posY },
				dx: e.clientX - start.x,
				dy: e.clientY - start.y,
				aspectRatio: widgetAspect,
				bounds: getGroupBounds()
			});
			setStageSize(next.size);
			setPosition(next.position);
			return;
		}
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

	const handlePointerUp = () => {
		setIsDragging(false);
		setIsResizing(false);
		dragRef.current = null;
		resizeStartRef.current = null;
	};

	const handleTouchEnd = () => {
		setIsDragging(false);
		dragRef.current = null;
	};

	useEffect(() => {
		if (isDragging || isResizing) {
			window.addEventListener('pointermove', handlePointerMove);
			window.addEventListener('pointerup', handlePointerUp);
			window.addEventListener('pointercancel', handlePointerUp);
			window.addEventListener('touchmove', handleTouchMove);
			window.addEventListener('touchend', handleTouchEnd);
			document.body.style.userSelect = 'none';
			return () => {
				window.removeEventListener('pointermove', handlePointerMove);
				window.removeEventListener('pointerup', handlePointerUp);
				window.removeEventListener('pointercancel', handlePointerUp);
				window.removeEventListener('touchmove', handleTouchMove);
				window.removeEventListener('touchend', handleTouchEnd);
				document.body.style.userSelect = '';
			};
		}
		// The drag handlers are re-created every render; subscribing on
		// isDragging / isResizing transitions only is intentional.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isDragging, isResizing]);

	// Only render for group calls
	if (isDismissed || !callData || !callData.usesElementCall) return null;

	return (
		<>
			{!isFullscreen && !isMobileView && (
				<div className="call-modal-backdrop" aria-hidden="true" />
			)}
			<div
				className={`group-call-widget ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} ${isMobileView ? 'group-call-widget--mobile' : ''} ${isMobileCompact ? 'group-call-widget--mobile-compact' : ''} ${isFullscreen ? 'group-call-widget--fullscreen' : ''}`}
				style={{
					left: `${position.x}px`,
					top: `${position.y}px`,
					...(isResizing ? { cursor: resizeCursor } : {})
				}}
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
								<button
									className="btn-answer"
									onClick={handleAnswer}
								>
									Answer
								</button>
								<button
									className="btn-decline"
									onClick={handleDecline}
								>
									Decline
								</button>
							</div>
						</div>
					</div>
				) : elementCallUrl ? (
					/* Active call - show Element Call iframe */
					<div
						className="element-call-container"
						ref={containerRef}
						style={
							isMobileView || isFullscreen
								? undefined
								: {
										width: `${stageSize.width}px`,
										height: `${stageSize.height}px`
									}
						}
					>
						<div className="element-call-drag-handle" />
						<button
							className="element-call-close"
							onClick={handleEndCall}
							aria-label="Close call"
						>
							×
						</button>
						{!isMobileView && !isFullscreen && (
							<button
								type="button"
								className="element-call-autofit"
								onClick={(e) => {
									e.stopPropagation();
									applyAutoFit();
								}}
								aria-label="Auto-fit call window"
								title="Auto-fit"
							>
								⛶
							</button>
						)}
						<button
							className="element-call-fullscreen"
							onClick={handleToggleFullscreen}
							aria-label={
								isMobileView
									? isMobileCompact
										? 'Open full view'
										: 'Switch to small view'
									: isFullscreen
										? 'Exit full screen'
										: 'Enter full screen'
							}
							title={
								isMobileView
									? isMobileCompact
										? 'Full view'
										: 'Small view'
									: isFullscreen
										? 'Exit full screen'
										: 'Full screen'
							}
						>
							{isMobileView
								? isMobileCompact
									? '⤢'
									: '⤡'
								: isFullscreen
									? '⤡'
									: '⤢'}
						</button>
						<iframe
							ref={iframeRef}
							src={elementCallUrl}
							className="element-call-iframe"
							allow="camera; microphone; display-capture; autoplay; fullscreen"
							allowFullScreen
							title="Group video call"
						/>
						{!isMobileView &&
							!isFullscreen &&
							RESIZE_EDGES.map((edge) => (
								<div
									key={edge}
									className={`call-resize-handle call-resize-handle--${edge}`}
									role="separator"
									aria-orientation={
										edge === 'n' || edge === 's'
											? 'horizontal'
											: 'vertical'
									}
									aria-label={`Resize video call window (${edge})`}
									onPointerDown={(e) =>
										handleResizePointerDown(e, edge)
									}
								/>
							))}
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
		</>
	);
};
