/**
 * FloatingCallWidget - PROFESSIONAL Implementation
 * NO EMOJIS - CLEAN ICONS - LIKE ZOOM/WHATSAPP
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { callManager, CallData } from '../../services/CallManager';
import { matrixCallService } from '../../services/matrixCallService';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import {
	getAutoFitStageSize,
	normalizeAspectRatio,
	RESIZE_EDGES,
	resizeCursorForEdge,
	resizeStageFromPointer,
	type ResizeEdge,
	type Size
} from '../../utils/videoTileSizing';
import {
	releaseWindowMediaStream,
	stopMediaStreamTracks
} from '../../utils/callMediaStreamCleanup';
import './FloatingCallWidget.scss';

const FLOATING_DEFAULT_WIDTH = 460;
const FLOATING_DEFAULT_HEIGHT = 560;
const FLOATING_MIN = { width: 300, height: 400 };
const DEFAULT_VIDEO_ASPECT = 16 / 9;

export const FloatingCallWidget: React.FC = () => {
	const { t } = useTranslation();
	const { matrixClientService } = useMatrixClient();
	const [callData, setCallData] = useState<CallData | null>(null);
	const [isMuted, setIsMuted] = useState(false);
	const [isVideoOff, setIsVideoOff] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isMinimized, setIsMinimized] = useState(false);
	const [otherUserInitial, setOtherUserInitial] = useState<string>('U');
	const [, forceUpdate] = useState(0); // 🔥 Force re-render trigger

	const [isDragging, setIsDragging] = useState(false);
	const [isResizing, setIsResizing] = useState(false);
	const [stageSize, setStageSize] = useState<Size>({
		width: FLOATING_DEFAULT_WIDTH,
		height: FLOATING_DEFAULT_HEIGHT
	});
	const [videoAspect, setVideoAspect] = useState(DEFAULT_VIDEO_ASPECT);
	const [position, setPosition] = useState(() => {
		// Center the popup initially
		const popupWidth = FLOATING_DEFAULT_WIDTH;
		const popupHeight = FLOATING_DEFAULT_HEIGHT;
		return {
			x: (window.innerWidth - popupWidth) / 2,
			y: (window.innerHeight - popupHeight) / 2
		};
	});
	const dragStartPos = useRef({ x: 0, y: 0 });
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

	const localVideoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);
	const callInitiatedRef = useRef(false);
	const widgetRef = useRef<HTMLDivElement>(null);

	const getFloatingBounds = () => ({
		minWidth: FLOATING_MIN.width,
		minHeight: FLOATING_MIN.height,
		maxWidth: Math.max(FLOATING_MIN.width, window.innerWidth - 32),
		maxHeight: Math.max(FLOATING_MIN.height, window.innerHeight - 32)
	});

	const applyAutoFit = (aspect: number = videoAspect) => {
		const bounds = getFloatingBounds();
		const next = getAutoFitStageSize({
			aspectRatio: aspect,
			maxWidth: bounds.maxWidth,
			maxHeight: bounds.maxHeight,
			preferredWidth: FLOATING_DEFAULT_WIDTH,
			preferredHeight: FLOATING_DEFAULT_HEIGHT,
			minWidth: bounds.minWidth,
			minHeight: bounds.minHeight
		});
		setStageSize(next);
		setPosition({
			x: Math.max(16, (window.innerWidth - next.width) / 2),
			y: Math.max(16, (window.innerHeight - next.height) / 2)
		});
	};

	// Re-center / auto-fit whenever a new call starts
	useEffect(() => {
		if (!callData?.callId) return;
		setVideoAspect(DEFAULT_VIDEO_ASPECT);
		setIsFullscreen(false);
		setIsMinimized(false);
		applyAutoFit(DEFAULT_VIDEO_ASPECT);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [callData?.callId]);

	// Track remote video intrinsic aspect for letterbox / resize
	useEffect(() => {
		const video = remoteVideoRef.current;
		if (!video || !callData?.isVideo) return;

		const syncAspect = () => {
			const next = normalizeAspectRatio(
				video.videoWidth,
				video.videoHeight,
				DEFAULT_VIDEO_ASPECT
			);
			setVideoAspect((prev) => {
				if (Math.abs(prev - next) <= 0.01) return prev;
				return next;
			});
		};

		syncAspect();
		video.addEventListener('loadedmetadata', syncAspect);
		video.addEventListener('resize', syncAspect);
		return () => {
			video.removeEventListener('loadedmetadata', syncAspect);
			video.removeEventListener('resize', syncAspect);
		};
	}, [callData?.matrixCall, callData?.state, callData?.isVideo]);

	// When remote track aspect becomes known/changes, re-fit the stage once
	const lastFittedAspectRef = useRef(DEFAULT_VIDEO_ASPECT);
	useEffect(() => {
		if (!callData?.isVideo || isFullscreen || isMinimized) return;
		if (Math.abs(lastFittedAspectRef.current - videoAspect) <= 0.01) return;
		lastFittedAspectRef.current = videoAspect;
		applyAutoFit(videoAspect);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [videoAspect, callData?.isVideo, isFullscreen, isMinimized]);

	// Subscribe to CallManager
	useEffect(() => {
		const unsubscribe = callManager.subscribe((newCallData) => {
			setCallData(newCallData);
			if (!newCallData) {
				callInitiatedRef.current = false;
			} else {
				// Reset callInitiatedRef for new calls
				callInitiatedRef.current = false;
			}
		});
		setCallData(callManager.getCurrentCall());
		return () => unsubscribe();
	}, []);

	// Get other user's initial from Matrix room
	useEffect(() => {
		if (!callData) return;

		// 🚫 SKIP if this is a group call - GroupCallWidget will handle it
		if (callData.isGroup) return;

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
			// console.log('👤 Other user:', username, '→ Initial:', initial);
			setOtherUserInitial(initial);
		} else {
			// Fallback: use callerUserId if incoming
			if (callData.callerUserId) {
				const initial = callData.callerUserId
					.replace('@', '')
					.charAt(0)
					.toUpperCase();
				setOtherUserInitial(initial);
			}
		}
	}, [callData, matrixClientService]);

	// Handle outgoing call initiation
	useEffect(() => {
		if (
			!callData ||
			callData.isIncoming ||
			callInitiatedRef.current ||
			callData.matrixCall
		)
			return;

		// 🚫 SKIP if this is a group call - GroupCallWidget will handle it with LiveKit
		if (callData.usesElementCall || callData.isGroup) {
			// console.log('🚫 FloatingCallWidget: Skipping group call (handled by GroupCallWidget)');
			return;
		}

		callInitiatedRef.current = true;

		// The call button pre-requests camera/mic to keep the mobile user
		// gesture alive for the permission prompt. matrix-js-sdk's placeCall()
		// acquires its OWN media internally, so we must release the
		// pre-requested stream first — opening the same device twice fails with
		// NotReadableError on Windows/Android and leaves an orphaned capture.
		releaseWindowMediaStream('__preRequestedMediaStream');

		matrixCallService
			.startCall({
				roomId: callData.roomId,
				isVideoCall: callData.isVideo,
				localVideoElement: localVideoRef.current || undefined,
				remoteVideoElement: remoteVideoRef.current || undefined
			})
			.then((matrixCall) => {
				matrixCallService.attachMediaElements(
					localVideoRef.current,
					remoteVideoRef.current
				);
				callManager.setMatrixCall(matrixCall);
			})
			.catch((err) => {
				// console.error("Failed to start call:", err);
				alert(
					t('calls.widget.startFailed', {
						message: (err as Error).message
					})
				);
				callManager.endCall();
			});
	}, [callData, t]);

	// Re-bind media elements whenever the call connects or feeds update.
	// Audio-only calls keep `<video>` elements hidden but they must exist for playback.
	useEffect(() => {
		if (!callData?.matrixCall) return;
		matrixCallService.attachMediaElements(
			localVideoRef.current,
			remoteVideoRef.current
		);
	}, [callData?.matrixCall, callData?.state]);

	// Dragging
	const handleMouseDown = (e: React.MouseEvent) => {
		if (isResizing) return;
		if (
			(e.target as HTMLElement).closest('.call-controls') ||
			(e.target as HTMLElement).closest('.window-controls') ||
			(e.target as HTMLElement).closest('.call-resize-handle') ||
			(e.target as HTMLElement).closest('.call-stage-controls')
		)
			return;
		setIsDragging(true);
		dragStartPos.current = {
			x: e.clientX - position.x,
			y: e.clientY - position.y
		};
	};

	const handleResizePointerDown = (
		e: React.PointerEvent,
		edge: ResizeEdge
	) => {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		if (isFullscreen || isMinimized) return;
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

	useEffect(() => {
		const handlePointerMove = (e: PointerEvent) => {
			if (isResizing && resizeStartRef.current) {
				const start = resizeStartRef.current;
				const widgetAspect =
					start.width / start.height || DEFAULT_VIDEO_ASPECT;
				const next = resizeStageFromPointer({
					edge: start.edge,
					startSize: { width: start.width, height: start.height },
					startPosition: { x: start.posX, y: start.posY },
					dx: e.clientX - start.x,
					dy: e.clientY - start.y,
					aspectRatio: widgetAspect,
					bounds: getFloatingBounds()
				});
				setStageSize(next.size);
				setPosition(next.position);
				return;
			}
			if (!isDragging) return;
			setPosition({
				x: e.clientX - dragStartPos.current.x,
				y: e.clientY - dragStartPos.current.y
			});
		};
		const handlePointerUp = () => {
			if (isDragging) setIsDragging(false);
			if (isResizing) {
				setIsResizing(false);
				resizeStartRef.current = null;
			}
		};
		if (isDragging || isResizing) {
			window.addEventListener('pointermove', handlePointerMove);
			window.addEventListener('pointerup', handlePointerUp);
			window.addEventListener('pointercancel', handlePointerUp);
			document.body.style.userSelect = 'none';
		}
		return () => {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerUp);
			window.removeEventListener('pointercancel', handlePointerUp);
			document.body.style.userSelect = '';
		};
	}, [isDragging, isResizing]);

	// Cleanup
	useEffect(() => {
		return () => {
			releaseWindowMediaStream('__activeMediaStream');
			releaseWindowMediaStream('__preRequestedMediaStream');
		};
	}, []);

	// Handlers
	const handleAnswer = async () => {
		if (!callData || !callData.isIncoming) return;
		try {
			const client = matrixClientService?.getClient();
			if (!client) throw new Error('Matrix client not available');

			const calls = client.callEventHandler?.calls;
			if (!calls) throw new Error('Call handler not available');

			const incomingCall = Array.from(calls.values()).find(
				(call: any) =>
					call.roomId === callData.roomId &&
					call.direction === 'inbound' &&
					call.state === 'ringing'
			);
			if (!incomingCall) throw new Error('No incoming call found');

			// Request permission within this click gesture (needed on mobile),
			// then release it immediately — matrixCallService.answerCall() opens
			// its own media, so holding this stream would double-open the device.
			const stream = await navigator.mediaDevices.getUserMedia({
				video: callData.isVideo,
				audio: true
			});
			stopMediaStreamTracks(stream);

			callManager.answerCall();
			await matrixCallService.answerCall(
				incomingCall as any,
				callData.isVideo,
				localVideoRef.current || undefined,
				remoteVideoRef.current || undefined
			);
			matrixCallService.attachMediaElements(
				localVideoRef.current,
				remoteVideoRef.current
			);
			callManager.setMatrixCall(incomingCall as any);

			// 🔥 Force UI re-render to hide Answer/Decline buttons and show call controls
			setTimeout(() => forceUpdate((prev) => prev + 1), 100);
		} catch (err) {
			// console.error("Failed to answer:", err);
			alert(
				t('calls.widget.answerFailed', {
					message: (err as Error).message
				})
			);
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
	// Only render for 1-on-1 calls (not group calls)
	// Group calls are handled by GroupCallWidget
	if (!callData || callData.usesElementCall || callData.isGroup) return null;

	const showStageControls =
		callData.isVideo &&
		!isFullscreen &&
		!isMinimized &&
		callData.state !== 'ringing' &&
		!!callData.matrixCall;

	const widgetClass = `floating-call-widget ${isFullscreen ? 'fullscreen' : isMinimized ? 'minimized' : 'normal'}${isResizing ? ' resizing' : ''}`;

	return (
		<>
			{!isFullscreen && (
				<div className="call-modal-backdrop" aria-hidden="true" />
			)}
			<div
				ref={widgetRef}
				className={widgetClass}
				style={{
					position: 'fixed',
					left: isFullscreen ? 0 : `${position.x}px`,
					top: isFullscreen ? 0 : `${position.y}px`,
					cursor: isDragging
						? 'grabbing'
						: isResizing
							? resizeCursor
							: 'default',
					...(isFullscreen || isMinimized
						? {}
						: {
								width: `${stageSize.width}px`,
								height: `${stageSize.height}px`,
								minHeight: undefined
							})
				}}
				onMouseDown={handleMouseDown}
			>
				{/* Header - Element style */}
				<div
					className="call-header"
					style={{ cursor: isFullscreen ? 'default' : 'grab' }}
				>
					<div className="call-header-left">
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
						</svg>
						<span>
							{callData.isVideo
								? t('calls.videoCall')
								: t('calls.audioCall')}
						</span>
					</div>

					<div className="call-stage-controls">
						{showStageControls && (
							<button
								type="button"
								className="auto-fit-toggle"
								onClick={(e) => {
									e.stopPropagation();
									applyAutoFit(videoAspect);
								}}
								title={t('calls.widget.autoFit')}
								aria-label={t('calls.widget.autoFitAria')}
							>
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M3 5v4h2V7h2V5H3zm12 0v2h2v2h2V5h-4zM5 15H3v4h4v-2H5v-2zm14 2h-2v2h4v-4h-2v2zM7 9h10v6H7V9z" />
								</svg>
							</button>
						)}
						<button
							className="fullscreen-toggle"
							onClick={(e) => {
								e.stopPropagation();
								toggleFullscreen();
							}}
							title={t('calls.fullscreen')}
						>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
							</svg>
						</button>
					</div>
				</div>

				{/* Video area */}
				<div className="call-video-area">
					{/*
					 * WebRTC media sinks — always mounted so audio-only calls can
					 * attach/play remote audio (hidden visually for voice calls).
					 */}
					<video
						ref={remoteVideoRef}
						autoPlay
						playsInline
						className={`remote-video ${!callData.isVideo ? 'call-media-hidden' : ''}`}
						style={
							callData.isVideo
								? {
										display:
											callData.state === 'ringing'
												? 'none'
												: 'block'
									}
								: undefined
						}
					/>
					<video
						ref={localVideoRef}
						autoPlay
						playsInline
						muted
						className={`local-video ${!callData.isVideo ? 'call-media-hidden' : ''}`}
						style={
							callData.isVideo
								? {
										display:
											callData.state === 'ringing'
												? 'none'
												: 'block'
									}
								: undefined
						}
					/>

					{/* Large avatar - always show for voice or when ringing */}
					{(!callData.isVideo || callData.state === 'ringing') && (
						<div className="call-avatar-large">
							{otherUserInitial}
						</div>
					)}
				</div>

				{/* Controls - Element exact design */}
				<div className="call-controls">
					{callData.state === 'ringing' ||
					(callData.isIncoming && !callData.matrixCall) ? (
						<>
							<button
								className="call-btn answer-btn"
								onClick={handleAnswer}
								title={t('calls.answer')}
							>
								<svg
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="currentColor"
								>
									<path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
								</svg>
							</button>
							<button
								className="call-btn reject-btn"
								onClick={handleReject}
								title={t('calls.reject')}
							>
								<svg
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="currentColor"
								>
									<path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
								</svg>
							</button>
						</>
					) : (
						<>
							{/* Microphone - NO dropdown arrow */}
							<button
								className={`call-btn ${isMuted ? 'muted' : ''}`}
								onClick={toggleMute}
								title={
									isMuted
										? t('calls.unmute')
										: t('calls.mute')
								}
							>
								<svg
									width="20"
									height="20"
									viewBox="0 0 16 16"
									fill="currentColor"
								>
									{isMuted ? (
										<>
											<path d="M13 8c0 .564-.094 1.107-.266 1.613l-.814-.814A4.02 4.02 0 0 0 12 8V7a.5.5 0 0 1 1 0v1zm-5 4c.818 0 1.578-.245 2.212-.667l.718.719a4.973 4.973 0 0 1-2.43.923V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 1 0v1a4 4 0 0 0 4 4zm3-9v4.879L5.158 2.037A3.001 3.001 0 0 1 11 3z" />
											<path d="M9.486 10.607 5 6.12V8a3 3 0 0 0 4.486 2.607zm-7.84-9.253 12 12 .708-.708-12-12-.708.708z" />
										</>
									) : (
										<>
											<path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V3z" />
											<path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z" />
										</>
									)}
								</svg>
							</button>

							{/* Camera - NO dropdown arrow */}
							{callData.isVideo && (
								<button
									className={`call-btn ${isVideoOff ? 'video-off' : ''}`}
									onClick={toggleVideo}
									title={
										isVideoOff
											? t('calls.turnOnVideo')
											: t('calls.turnOffVideo')
									}
								>
									<svg
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="currentColor"
									>
										{isVideoOff ? (
											<path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
										) : (
											<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
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
							<button
								className="call-btn hangup-btn"
								onClick={handleHangup}
								title={t('calls.endCall')}
							>
								<svg
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="currentColor"
								>
									<path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.70 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
								</svg>
							</button>
						</>
					)}
				</div>

				{showStageControls &&
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
							aria-label={t('calls.resizeAria', { edge })}
							onPointerDown={(e) =>
								handleResizePointerDown(e, edge)
							}
						/>
					))}
			</div>
		</>
	);
};
