/**
 * GroupCallWidget - Multi-participant group video calls using Element Call
 * Element Call is a production-ready group calling solution built on Matrix and LiveKit
 * https://github.com/element-hq/element-call
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { callManager, CallData } from '../../services/CallManager';
import { useElementCallWidget } from './widget/useElementCallWidget';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
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

	const closeCallSurface = useCallback(() => {
		// Release camera and microphone while the iframe is still in the
		// document. Clearing the state below unmounts it, and navigating an
		// iframe that the browser has already detached does not load anything —
		// the capture would stay alive until a reload. This is the path Element
		// Call's own hangup button takes, so it has to release here rather than
		// rely on the teardown in useElementCallWidget.
		if (iframeRef.current) {
			iframeRef.current.src = 'about:blank';
		}
		setElementCallUrl('');
		setCallData(null);
		setCallState(null);
		setIsDismissed(true);
		if (callManager.hasActiveCall()) {
			callManager.endCall();
		}
	}, []);

	// The host owns Matrix I/O and crypto. The iframe receives no access token,
	// creates no second Matrix device and has no SPA compatibility path.
	const callRoomId = callData
		? (callData.elementCallRoomId ?? callData.roomId)
		: null;
	const shouldPrepareWidget =
		!!callData &&
		(!callData.isIncoming ||
			callState === 'connecting' ||
			callState === 'in_call');
	const widget = useElementCallWidget(
		matrixClientService?.getClient() ?? null,
		{
			roomId: shouldPrepareWidget ? callRoomId : null,
			isVideo: callData?.isVideo ?? true,
			onClose: closeCallSurface
		}
	);

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

	// React compares ref callbacks by function identity, not by DOM node: an
	// inline callback is a new function on every render, so React would detach
	// (call it with `null`) and re-attach on every drag or resize frame — tearing
	// down and rebuilding the widget's postMessage channel mid-call. Keep it
	// stable and let it change only when the widget itself does.
	const setIframeNode = useCallback(
		(node: HTMLIFrameElement | null) => {
			// The ref is shared by the drag/close logic and Widget API channel.
			(
				iframeRef as React.MutableRefObject<HTMLIFrameElement | null>
			).current = node;
			widget.attachIframe(node);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[widget.attachIframe]
	);
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

	// Room joining and URL construction are asynchronous. Mount
	// only after the host client is joined; unlike the legacy SPA path there is
	// no second client inside the iframe that could repair missing membership.
	useEffect(() => {
		if (!callData?.usesElementCall || !shouldPrepareWidget) {
			return;
		}
		// Parent-page warm-up streams must not hold the camera while the
		// Element Call iframe opens its own capture.
		releaseWindowMediaStream('__preRequestedMediaStream');
		if (widget.error) {
			alert(`Failed to start call: ${widget.error.message}`);
			closeCallSurface();
			return;
		}
		if (widget.url && elementCallUrl !== widget.url) {
			setElementCallUrl(widget.url);
		}
	}, [
		callData?.usesElementCall,
		closeCallSurface,
		elementCallUrl,
		shouldPrepareWidget,
		widget.error,
		widget.url
	]);

	const handleAnswer = () => {
		if (!callData || !callData.isIncoming) return;
		callManager.answerCall();
	};

	const handleDecline = () => {
		setIsDismissed(true);
		callManager.endCall();
	};

	const handleEndCall = () => {
		void widget.hangup().catch(() => {
			/* local teardown still completes if the iframe already closed */
		});

		if (iframeRef.current) {
			iframeRef.current.src = 'about:blank';
		}
		closeCallSurface();
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
							ref={setIframeNode}
							src={elementCallUrl}
							referrerPolicy="no-referrer"
							className="element-call-iframe"
							allow="camera; microphone; display-capture; autoplay; fullscreen; clipboard-write; screen-wake-lock"
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
