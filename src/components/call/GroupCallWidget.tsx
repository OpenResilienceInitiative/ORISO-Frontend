/**
 * GroupCallWidget - Multi-participant group video calls using Element Call
 * Element Call is a production-ready group calling solution built on Matrix and LiveKit
 * https://github.com/element-hq/element-call
 */

import React, {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	useRef
} from 'react';
import { useTranslation } from 'react-i18next';
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
import {
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../globalState';
import { useOwnAvatarUserId } from '../../hooks/useOwnAvatarUserId';
import {
	type IdentityClient,
	publishCallIdentity
} from './publishCallIdentity';
import { Gespraechsnotizen } from './notes/Gespraechsnotizen';
import './GroupCallWidget.scss';

const GROUP_DEFAULT_WIDTH = 520;
const GROUP_DEFAULT_HEIGHT = 320;
const GROUP_ASPECT = GROUP_DEFAULT_WIDTH / GROUP_DEFAULT_HEIGHT;
const GROUP_MIN = { width: 280, height: 180 };

export const GroupCallWidget: React.FC = () => {
	const { t } = useTranslation();
	const { matrixClientService } = useMatrixClient();
	// `null` until a provider is above us; the widget renders in places that
	// do not guarantee one.
	const userData = useContext(UserDataContext)?.userData;
	const ownAvatarUserId = useOwnAvatarUserId();
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
		setIsDismissed(true);
		if (callManager.hasActiveCall()) {
			callManager.leaveCall();
		} else {
			setCallData(null);
			setCallState(null);
		}
	}, []);

	// The host owns Matrix I/O and crypto. The iframe receives no access token,
	// creates no second Matrix device and has no SPA compatibility path.
	const callRoomId = callData
		? (callData.elementCallRoomId ?? callData.roomId)
		: null;
	const shouldPrepareWidget =
		!!callData &&
		callState !== 'left' &&
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

	/*
	 * Tell the call who we are, before it opens.
	 *
	 * The iframe cannot work this out: the animal is a stored choice from the
	 * userservice, an advice seeker's colours come from the anonymous-name
	 * engine, and a counsellor's from the tenant's brand pair. None of that is
	 * visible inside the widget, and deriving a substitute there is the one
	 * thing the design forbids. So each client publishes its own identity into
	 * the call room and the fork reads what it is given.
	 *
	 * Own identity only. A client that wrote somebody else's would be guessing
	 * on their behalf, and the state key is the user id, so it cannot.
	 */
	useEffect(() => {
		const client = matrixClientService?.getClient();
		if (!client || !callRoomId || !shouldPrepareWidget || !userData) return;
		void publishCallIdentity(
			client as unknown as IdentityClient,
			callRoomId,
			{
				userId: ownAvatarUserId,
				userData,
				isConsultant: hasUserAuthority(
					AUTHORITIES.CONSULTANT_DEFAULT,
					userData
				)
			}
		);
	}, [
		matrixClientService,
		callRoomId,
		shouldPrepareWidget,
		ownAvatarUserId,
		userData
	]);

	/*
	 * Only a counsellor gets the notepad.
	 *
	 * Ticket 06 is a counsellor's scratchpad — "not a shared agenda, not a
	 * transcript, not minutes". Offering it to an advice seeker would suggest
	 * the counselling centre keeps notes on them, in a product whose whole
	 * promise is that it does not.
	 */
	const isConsultantUser = Boolean(
		userData && hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
	);

	const notesLabels = useMemo(
		() => ({
			title: t('calls.notes.title'),
			privacy: t('calls.notes.privacy'),
			type: t('calls.notes.type'),
			text: t('calls.notes.text'),
			add: t('calls.notes.add'),
			remove: t('calls.notes.remove'),
			copy: t('calls.notes.copy'),
			copied: t('calls.notes.copied'),
			empty: t('calls.notes.empty'),
			collapse: t('calls.notes.collapse'),
			expand: t('calls.notes.expand'),
			types: {
				frage: t('calls.notes.types.frage'),
				anmerkung: t('calls.notes.types.anmerkung'),
				aufgabe: t('calls.notes.types.aufgabe')
			}
		}),
		[t]
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
				setIsDismissed(newCallData.state === 'left');
			}
			if (!newCallData) {
				setElementCallUrl('');
			}
		});
		const currentCall = callManager.getCurrentCall();
		setCallData(currentCall);
		setCallState(currentCall?.state || null);
		setIsDismissed(currentCall?.state === 'left');
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
			alert(
				t('calls.group.startFailed', {
					message: widget.error.message
				})
			);
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
		t,
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
							aria-label={t('calls.group.close')}
						>
							×
						</button>
						<div className="incoming-call-content">
							<div className="call-avatar-large">G</div>
							<h2>{t('calls.group.incomingTitle')}</h2>
							<p>{t('calls.group.incomingDescription')}</p>
							<div className="incoming-call-actions">
								<button
									className="btn-answer"
									onClick={handleAnswer}
								>
									{t('calls.answer')}
								</button>
								<button
									className="btn-decline"
									onClick={handleDecline}
								>
									{t('calls.decline')}
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
							aria-label={t('calls.group.close')}
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
								aria-label={t('calls.group.autoFitAria')}
								title={t('calls.group.autoFit')}
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
										? t('calls.group.openFullView')
										: t('calls.group.switchToSmallView')
									: isFullscreen
										? t('calls.group.exitFullScreen')
										: t('calls.group.enterFullScreen')
							}
							title={
								isMobileView
									? isMobileCompact
										? t('calls.group.fullView')
										: t('calls.group.smallView')
									: isFullscreen
										? t('calls.group.exitFullScreen')
										: t('calls.group.fullScreen')
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
						{/*
						 * The private notepad lives HERE, in the host, and
						 * not inside the call.
						 *
						 * "Private is the feature." Its test proves that
						 * nothing it holds reaches fetch, XHR, either
						 * storage or sendBeacon — and that proof only means
						 * something where there is no second boundary to
						 * cross. Inside the iframe the same claim would have
						 * to be re-made against the widget transport as
						 * well, and the panel would have to carry copies of
						 * five ORISO icons and the composer's menu with it.
						 *
						 * The handoff puts it beside the stage, which is
						 * exactly where this is: a flex sibling of the call
						 * surface, so the stage reflows to the remaining
						 * width rather than being covered.
						 */}
						{isConsultantUser && (
							<Gespraechsnotizen
								className="element-call-notes"
								defaultCollapsed
								labels={notesLabels}
							/>
						)}
						<iframe
							ref={setIframeNode}
							src={elementCallUrl}
							referrerPolicy="no-referrer"
							className="element-call-iframe"
							allow="camera; microphone; display-capture; autoplay; fullscreen; clipboard-write; screen-wake-lock"
							allowFullScreen
							title={t('calls.group.iframeTitle')}
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
									aria-label={t('calls.resizeAria', {
										edge
									})}
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
							aria-label={t('calls.group.close')}
						>
							×
						</button>
						<div className="connecting-content">
							<div className="call-avatar-large">G</div>
							<h2>{t('calls.group.connecting')}</h2>
							<p>{t('calls.group.settingUp')}</p>
						</div>
					</div>
				)}
			</div>
		</>
	);
};
