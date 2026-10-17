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
import { RoomStateEvent } from 'matrix-js-sdk';
import { MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
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
	forgetPublishedIdentity,
	type IdentityClient,
	publishCallIdentity,
	republishCallIdentity
} from './publishCallIdentity';
import { Gespraechsnotizen } from './notes/Gespraechsnotizen';
import './GroupCallWidget.scss';

const GROUP_DEFAULT_WIDTH = 520;
const GROUP_DEFAULT_HEIGHT = 320;
const GROUP_ASPECT = GROUP_DEFAULT_WIDTH / GROUP_DEFAULT_HEIGHT;
const GROUP_MIN = { width: 280, height: 180 };

/*
 * The expanded notepad's width, from `gespraechsnotizen.module.scss`, and the
 * narrowest stage that can seat it beside the call.
 *
 * The stage is a floating window, not the page: its width is `stageSize`,
 * which autofit scales to the screen and the counsellor then drags with the
 * resize handles. So "is there room for both" is a question about the stage
 * and cannot be answered by a viewport media query — a 1920px screen can hold
 * a 300px-wide stage. Below this the panel lays over the stage instead; the
 * stylesheet reads `data-narrow-stage` for it.
 */
const NOTES_PANEL_WIDTH = 320;
const NOTES_SIDE_BY_SIDE_MIN_WIDTH = NOTES_PANEL_WIDTH + GROUP_MIN.width;

/**
 * How long the surface waits for the call's own goodbye, in ms.
 *
 * Long enough for a postMessage round trip and the leave it triggers, short
 * enough that a wedged iframe is not something the user has to sit through.
 */
const HANGUP_HANDSHAKE_MS = 1500;

/*
 * How long to keep trying to say who we are after a client is replaced.
 *
 * The same ladder the lifecycle card uses, for the same window: a refreshed
 * client is announced before its crypto is up and before its first sync has
 * the room's encryption state, and both make an identity publication refuse.
 */
const IDENTITY_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

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
	/*
	 * Bumped whenever the service swaps its client out.
	 *
	 * A token refresh replaces the client inside `MatrixClientService` and
	 * takes the old client's listeners with it, but the service object — which
	 * is what the context holds and what the identity effect below depends on
	 * — stays the same. Without this the effect kept a dead MatrixRTC listener
	 * until some unrelated render happened, so nobody arriving after the
	 * refresh was re-announced to and they saw this person as initials.
	 */
	const [clientGeneration, setClientGeneration] = useState(0);
	useEffect(() => {
		const unsubscribe = matrixClientService?.onClientChange?.(() =>
			setClientGeneration((generation) => generation + 1)
		);
		return (): void => unsubscribe?.();
	}, [matrixClientService]);

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
	 * Tell the call who we are, before it opens — and tell it again for
	 * whoever arrives later.
	 *
	 * The iframe cannot work this out: the animal is a stored choice from the
	 * userservice, an advice seeker's colours come from the anonymous-name
	 * engine, and a counsellor's from the tenant's brand pair. None of that is
	 * visible inside the widget, and deriving a substitute there is the one
	 * thing the design forbids. So each client publishes its own identity into
	 * the call room and the fork reads what it is given.
	 *
	 * Own identity only. A client that announced somebody else's would be
	 * guessing on their behalf, and the fork keys what it reads by the event's
	 * sender, so it could not be believed anyway.
	 *
	 * It is an encrypted timeline event rather than room state, because room
	 * state is not encrypted — see `publishCallIdentity`. The price of that is
	 * paid here: a timeline event reaches whoever is listening at the time, so
	 * when a new member joins, everybody already in the call says it again and
	 * the newcomer learns the room from the people in it.
	 *
	 * After the join, not beside it. `useElementCallWidget` joins the call
	 * room and only then produces a URL, so waiting for the URL is waiting
	 * for the membership — an event sent to a room this client has not joined
	 * yet is refused, and the first version of this raced it.
	 */
	/*
	 * The widget URL this effect saw last time, `null` included.
	 *
	 * A ref rather than state: it must not cause a render, and it must survive
	 * the effect re-running for a changed profile.
	 */
	const lastSessionUrl = useRef<string | null>(null);
	/*
	 * The client generation this effect last ran for.
	 *
	 * A swap re-runs the effect, which re-attaches the listeners — but an
	 * arrival in the gap between the old client going away and the new one
	 * being listened to is seen by nobody, and the newcomer would spend the
	 * rest of the call looking at initials. So the run that follows a swap
	 * announces again whether or not it saw an arrival: one event per token
	 * refresh, against a window nothing else closes.
	 */
	const lastGeneration = useRef(clientGeneration);

	useEffect(() => {
		// Recorded before the guard, so that closing the surface — which sets
		// the URL to null without this effect having anything to do — is seen.
		const previousUrl = lastSessionUrl.current;
		lastSessionUrl.current = widget.url;
		const clientChanged = lastGeneration.current !== clientGeneration;
		lastGeneration.current = clientGeneration;

		const client = matrixClientService?.getClient();
		if (!client || !callRoomId || !widget.url || !userData) return;
		const identityClient = client as unknown as IdentityClient;
		const source = {
			userId: ownAvatarUserId,
			userData,
			isConsultant: hasUserAuthority(
				AUTHORITIES.CONSULTANT_DEFAULT,
				userData
			)
		};

		/*
		 * A new surface for the same call says it again.
		 *
		 * Leaving does not change `callRoomId` — `leaveCall` keeps the room
		 * and only sets the state to `left` — so the room-keyed cleanup below
		 * does NOT fire when somebody closes the call surface and opens it
		 * again, and `lastSent` then made this publish a no-op. Everyone who
		 * was already in the call still holds the returner's first event, so
		 * the gap is invisible to them; anybody who joined while the returner
		 * was away does not, because `history_visibility` is `joined` and they
		 * cannot read it from the room's history. The re-announce does not
		 * cover it either: an arrival makes the OTHERS resend their own
		 * identities, not the returner's. The newcomer went on seeing the
		 * returner as initials.
		 *
		 * The session boundary is the URL going through `null`, NOT the URL
		 * changing. That was the first version of this and it was wrong:
		 * `useElementCallWidget` keeps its instance nonce in a ref, and the
		 * component stays mounted across a leave, so a reopened surface gets a
		 * byte-identical URL. What does happen is `A -> null -> A`, since
		 * `shouldPrepareWidget` is false while the state is `left`. So the
		 * previous value is compared including `null`, and the test for this
		 * drives the real sequence rather than remounting — a remount runs the
		 * cleanup and clears `lastSent`, which would have passed either way.
		 *
		 * A changed profile keeps the URL and stays unforced, which is what
		 * the comment on the cleanup below is about: forcing there would
		 * resend identical content as a duplicate.
		 */
		/*
		 * And it is tried again until it gets through.
		 *
		 * `publishCallIdentity` answers `null` for both of the things a
		 * replacement client is briefly guilty of: a room whose encryption
		 * state the first sync has not loaded, and a send that cannot be
		 * encrypted because `initRustCrypto()` has not finished. Both are
		 * right as refusals — the privacy guard is the point — and both used
		 * to end there, because `onClientChange` fires BEFORE either is
		 * ready and nothing else re-runs this. Somebody arriving in that gap
		 * saw this person as initials for the rest of the call.
		 *
		 * So a refusal is retried on the same bounded ladder the lifecycle
		 * card uses, and the effect's cleanup cancels it — a closed surface
		 * or another refresh must not leave a timer announcing into a call
		 * that has moved on.
		 */
		let cancelled = false;
		const announce = async (attempt: number): Promise<void> => {
			const sent = await publishCallIdentity(
				identityClient,
				callRoomId,
				source,
				{ force: previousUrl !== widget.url || clientChanged }
			);
			if (sent !== null || cancelled) return;
			const delay = IDENTITY_RETRY_DELAYS_MS[attempt];
			if (delay === undefined) return;
			await new Promise((resolve) => setTimeout(resolve, delay));
			if (!cancelled) await announce(attempt + 1);
		};
		void announce(0);

		/*
		 * Who is in the CALL, which is not who is in the room.
		 *
		 * `useElementCallWidget` never leaves the Matrix room, so somebody who
		 * closes the call surface and opens it again stays a joined room
		 * member throughout — only their MatrixRTC membership
		 * (`org.matrix.msc3401.call.member`) goes away and comes back. A
		 * listener on room membership therefore never fired for them, nobody
		 * re-announced, and the returning participant sat looking at initials
		 * where the animals had been.
		 *
		 * So the set is the RTC session's senders, and an arrival is somebody
		 * entering it who was not in it a moment ago — which makes a rejoin an
		 * arrival, as it should be. Seeding it before subscribing is what
		 * stops the people already here from being re-announced to: they heard
		 * the publish above live.
		 *
		 * Room membership stays as the fallback for a client with no
		 * `matrixRTC` (an older SDK, or a test double), because losing the
		 * re-announce silently is the failure mode this whole mechanism exists
		 * to avoid.
		 */
		const room = client.getRoom?.(callRoomId);
		const session =
			room && client.matrixRTC?.getRoomSession
				? client.matrixRTC.getRoomSession(room)
				: undefined;
		const ownUserId = client.getUserId?.() ?? undefined;
		/*
		 * Keyed by DEVICE, not by person.
		 *
		 * MatrixRTC memberships are per device, and somebody already in the
		 * call joining from a second one is an arrival like any other: that
		 * device received none of the identities sent before it existed, and
		 * collapsing the memberships to a set of user ids hid it. It saw
		 * everybody as initials for the rest of the call. A user id cannot
		 * contain `|`, so the first one separates the two halves.
		 */
		const inTheCall = (): Set<string> =>
			new Set<string>(
				(session
					? session.memberships.map(
							(membership: {
								sender?: string | null;
								deviceId?: string | null;
							}) =>
								typeof membership.sender === 'string'
									? `${membership.sender}|${membership.deviceId ?? ''}`
									: undefined
						)
					: (room?.getMembersWithMembership?.('join') ?? []).map(
							(member: { userId: string }) => `${member.userId}|`
						)
				).filter((key): key is string => typeof key === 'string')
			);

		let present = inTheCall();
		const refresh = (): void => {
			const now = inTheCall();
			const arrived = [...now].some(
				(key) =>
					key.slice(0, key.indexOf('|')) !== ownUserId &&
					!present.has(key)
			);
			present = now;
			if (arrived)
				void republishCallIdentity(identityClient, callRoomId, source);
		};

		session?.on?.(MatrixRTCSessionEvent.MembershipsChanged, refresh);
		client.on?.(RoomStateEvent.Members, refresh as never);
		return (): void => {
			cancelled = true;
			session?.off?.(MatrixRTCSessionEvent.MembershipsChanged, refresh);
			client.off?.(RoomStateEvent.Members, refresh as never);
		};
	}, [
		matrixClientService,
		clientGeneration,
		callRoomId,
		widget.url,
		ownAvatarUserId,
		userData
	]);

	/*
	 * A new call to the same room announces again.
	 *
	 * Keyed on the room alone, so it does not fire when the effect above
	 * re-runs for a changed profile — that would clear the record and resend
	 * identical content as a duplicate event.
	 */
	useEffect(() => {
		if (!callRoomId) return;
		return (): void => forgetPublishedIdentity(callRoomId);
	}, [callRoomId]);

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
		/*
		 * Let the call say goodbye before its document is destroyed.
		 *
		 * `hangup()` is a widget action: the leave happens INSIDE the iframe,
		 * once it has processed the message, and `transport.send` resolves on
		 * its reply. Firing it and blanking the iframe in the same tick raced
		 * that — the document went away before the membership left, so
		 * everybody else went on seeing this person in the call, and the
		 * durable card went on saying `running`, until the delayed leave
		 * expired. Which is a safety net for a browser that crashes, not for
		 * a button somebody pressed.
		 *
		 * Capped, because a wedged iframe must not trap anybody in a call
		 * surface that will not close: past the cap the teardown goes ahead
		 * and the delayed leave does its job after all. `closeCallSurface`
		 * blanks the iframe itself — doing it here as well was how the race
		 * got in.
		 */
		void (async () => {
			try {
				await Promise.race([
					widget.hangup(),
					new Promise<void>((resolve) =>
						setTimeout(resolve, HANGUP_HANDSHAKE_MS)
					)
				]);
			} catch {
				/* local teardown still completes if the iframe already closed */
			}
			closeCallSurface();
		})();
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

	/*
	 * How far one arrow key moves a handle, in px.
	 *
	 * Enough to be worth a keypress and small enough to aim with; `Shift`
	 * takes bigger strides, as it does in every other resizable thing.
	 */
	const RESIZE_STEP = 16;
	const RESIZE_STEP_FAST = 64;

	/*
	 * The same resize, from the keyboard.
	 *
	 * These handles were `role="separator"` with an `aria-label` and nothing
	 * but `onPointerDown`: they announced a control that a keyboard could not
	 * reach or operate, which on this surface also means no way to make room
	 * for the Gesprächsnotizen panel without a mouse.
	 *
	 * It goes through `resizeStageFromPointer` exactly as the pointer does,
	 * with the arrow key standing in for the movement — so the edge
	 * semantics, the aspect ratio and the bounds cannot drift between the two
	 * ways of doing the same thing. A `w` handle growing leftwards is that
	 * function's business, not this one's.
	 */
	const handleResizeKeyDown = (e: React.KeyboardEvent, edge: ResizeEdge) => {
		if (isMobileView || isFullscreen || isMobileCompact) return;
		const step = e.shiftKey ? RESIZE_STEP_FAST : RESIZE_STEP;
		const move: Record<string, { dx: number; dy: number }> = {
			ArrowLeft: { dx: -step, dy: 0 },
			ArrowRight: { dx: step, dy: 0 },
			ArrowUp: { dx: 0, dy: -step },
			ArrowDown: { dx: 0, dy: step }
		};
		const delta = move[e.key];
		if (!delta) return;
		e.preventDefault();
		e.stopPropagation();
		const next = resizeStageFromPointer({
			edge,
			startSize: stageSize,
			startPosition: position,
			dx: delta.dx,
			dy: delta.dy,
			aspectRatio: stageSize.width / stageSize.height || GROUP_ASPECT,
			bounds: getGroupBounds()
		});
		setStageSize(next.size);
		setPosition(next.position);
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
						data-narrow-stage={
							!isMobileView &&
							!isFullscreen &&
							stageSize.width < NOTES_SIDE_BY_SIDE_MIN_WIDTH
								? 'true'
								: undefined
						}
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
									/*
									 * Focusable, and it reports where it is.
									 * A separator that can be moved is a
									 * widget, so it needs a tab stop and a
									 * value — without `aria-valuenow` a
									 * screen reader announces a control with
									 * no position in its range.
									 */
									tabIndex={0}
									aria-valuenow={Math.round(
										edge === 'n' || edge === 's'
											? stageSize.height
											: stageSize.width
									)}
									aria-valuemin={Math.round(
										edge === 'n' || edge === 's'
											? getGroupBounds().minHeight
											: getGroupBounds().minWidth
									)}
									aria-valuemax={Math.round(
										edge === 'n' || edge === 's'
											? getGroupBounds().maxHeight
											: getGroupBounds().maxWidth
									)}
									onPointerDown={(e) =>
										handleResizePointerDown(e, edge)
									}
									onKeyDown={(e) =>
										handleResizeKeyDown(e, edge)
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
