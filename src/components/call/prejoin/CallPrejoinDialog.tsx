import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KnockWaitDialog } from '../../knockWaitDialog/KnockWaitDialog';
import { useCallDeviceCheck } from '../../waitingRoom/callEntry/useCallDeviceCheck';
import type { CallModality } from '../../waitingRoom/callEntry/callEntryTypes';
import {
	initialControlsFor,
	joinMediaFrom,
	peekJoinMedia,
	rememberJoinMedia
} from './callPrejoin';
import type {
	CallJoinHooks,
	CallJoinResult
} from '../../directLinkEntry/callMessageKnock';
import {
	claimKnock,
	releaseKnock,
	rememberAdmittedConversation
} from '../../directLinkEntry/callMessageKnock';
import {
	DirectLinkKnockDeps,
	DirectLinkKnockState,
	useDirectLinkKnock
} from '../../directLinkEntry/useDirectLinkKnock';
import {
	announcePendingKnock,
	forgetPendingKnock,
	PendingKnock,
	readPendingKnock,
	rememberPendingKnock
} from '../../directLinkEntry/directLinkEntryFlow';

/** How long "Sie wurden hereingelassen" stays before the call takes over. */
const ADMITTED_PAUSE_MS = 1_200;

export interface CallPrejoinDialogProps {
	modality: CallModality;
	/** The room whose call takes the choice (`GroupCallWidget`). */
	roomRef: string;
	/** `join`: right before the call. `check`: the circle's option. */
	purpose?: 'join' | 'check';
	/**
	 * "Jetzt beitreten": joins, or knocks. Through the hooks the join closes
	 * this dialog first (releasing the preview's camera), and a knock keeps
	 * it open as the one waiting window (#2016, product owner 2026-11-03).
	 * Without it, or for `check`, the button only keeps the choice.
	 */
	onJoin?: (hooks: CallJoinHooks) => unknown;
	/** ✕, Escape, "Fertig", or let in: the caller unmounts the dialog. */
	onClose: () => void;
	/**
	 * How the join after admission went; it runs once this dialog is gone,
	 * so the card says it when it fails (#2016).
	 */
	onJoinResult?: (result: CallJoinResult) => void;
	/** Stories: stand in for `navigator.mediaDevices` and the knock API. */
	mediaDevices?: MediaDevices;
	knockDeps?: Partial<DirectLinkKnockDeps>;
	pollMs?: number;
	sheet?: boolean;
}

/**
 * Lets go of a knock this window held. One still stored goes back to the
 * knock gate, which shows it at once — without the running call: the
 * person dismissed the check, so being let in must not put them into the
 * call with mic and camera on. Let in, the gate says so and the card's
 * "Beitreten" joins (#2028 review).
 */
const handBackToGate = (knockId: number) => {
	releaseKnock(knockId);
	const stored = readPendingKnock();
	if (stored?.knockId !== knockId) return;
	const { joinCall: _dismissed, ...withoutCall } = stored;
	rememberPendingKnock(withoutCall);
	announcePendingKnock();
};

/** Reports the knock's state up; renders nothing. */
const KnockWatch = ({
	knock,
	deps,
	pollMs,
	onState
}: {
	knock: PendingKnock;
	deps?: Partial<DirectLinkKnockDeps>;
	pollMs?: number;
	onState: (state: DirectLinkKnockState) => void;
}) => {
	const { knockId, phase, gone, cancel, knockAgain, close } =
		useDirectLinkKnock(knock, deps, pollMs);
	useEffect(
		() => onState({ knockId, phase, gone, cancel, knockAgain, close }),
		[onState, knockId, phase, gone, cancel, knockAgain, close]
	);
	return null;
};

/**
 * Glue only (#2016): the knock wait dialog holding the waiting room's device
 * check, for a signed-in person. One window from the check to the call:
 * a knock waits right here, with the same preview and switches, and the
 * person joins with exactly what they set once let in. Mounted only while
 * shown, so the camera is asked for when it opens and released when it
 * closes.
 */
export const CallPrejoinDialog = ({
	modality,
	roomRef,
	purpose = 'join',
	onJoin,
	onClose,
	onJoinResult,
	mediaDevices,
	knockDeps,
	pollMs,
	sheet
}: CallPrejoinDialogProps) => {
	const [initial] = useState(() =>
		initialControlsFor(modality, peekJoinMedia(roomRef))
	);
	const device = useCallDeviceCheck(modality, { initial, mediaDevices });
	const [busy, setBusy] = useState(false);
	const [knock, setKnock] = useState<PendingKnock | null>(null);
	const [knockState, setKnockState] = useState<DirectLinkKnockState | null>(
		null
	);
	const joinOnceAdmitted = useRef<(() => Promise<CallJoinResult>) | null>(
		null
	);

	// The switches are the one source of truth, up to the moment of joining.
	const keepChoice = () =>
		rememberJoinMedia(
			roomRef,
			joinMediaFrom({
				modality,
				micOn: device.controls.micOn,
				cameraOn: device.controls.cameraOn,
				cameraAvailable: device.cameraAvailable,
				blocker: device.blocker
			})
		);
	const keepChoiceRef = useRef(keepChoice);
	keepChoiceRef.current = keepChoice;
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;
	const onJoinResultRef = useRef(onJoinResult);
	onJoinResultRef.current = onJoinResult;
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const join = () => {
		if (busy || knock) return;
		keepChoice();
		if (purpose === 'check' || !onJoin) {
			onClose();
			return;
		}
		setBusy(true);
		Promise.resolve(
			onJoin({
				// Dismissed during the lookup: no call (see `joinOrKnock`).
				beforeJoin: () => {
					if (!mounted.current) return false;
					onCloseRef.current();
					return true;
				},
				onKnock: (pending, joinLater) => {
					/* Closed while the knock was on its way: nobody waits
					   here, so the knock gate takes it (no orphaned knock
					   the counsellor sees and nobody answers). */
					if (!mounted.current) {
						handBackToGate(pending.knockId);
						return;
					}
					joinOnceAdmitted.current = joinLater;
					setKnock(pending);
				}
			})
		)
			.then((result) => {
				// Refused without a knock (e.g. withdrawn, no link here): the
				// card says it; nothing is left to wait for in this window.
				if (
					result !== undefined &&
					result !== 'joined' &&
					result !== 'cancelled'
				) {
					onCloseRef.current();
				}
			})
			.catch(() => undefined)
			.finally(() => setBusy(false));
	};

	const stopWaiting = useCallback(() => {
		knockState?.cancel();
	}, [knockState]);

	// Withdrawn (here or elsewhere) or closed after "no": back to the check.
	const gone = Boolean(knockState?.gone);
	useEffect(() => {
		if (!gone || !knock) return;
		setKnock(null);
		setKnockState(null);
	}, [gone, knock]);

	// Let in: the call starts with exactly what the switches say now.
	const phase = knockState?.phase;
	useEffect(() => {
		if (phase !== 'admitted' || !knock) return;
		const timer = window.setTimeout(() => {
			forgetPendingKnock();
			rememberAdmittedConversation(knock.sessionId);
			keepChoiceRef.current();
			onCloseRef.current();
			const joinLater = joinOnceAdmitted.current;
			if (joinLater) {
				const report = onJoinResultRef.current;
				void joinLater().then(
					(result) => report?.(result),
					() => report?.('unavailable')
				);
			}
		}, ADMITTED_PAUSE_MS);
		return () => window.clearTimeout(timer);
	}, [phase, knock]);

	/*
	 * The knock this window waits on is its own, the replacement after
	 * "Erneut anklopfen" included, so the knock gate opens no second dialog.
	 * Let go of on every way out; one still stored (the chat closed while
	 * waiting) goes back to the gate, which shows it at once.
	 */
	const heldKnock = knock
		? (knockState?.knockId ?? knock.knockId)
		: undefined;
	useEffect(() => {
		if (heldKnock === undefined) return;
		claimKnock(heldKnock);
		return () => handBackToGate(heldKnock);
	}, [heldKnock]);

	const waiting = Boolean(knock) && (!phase || phase === 'waiting');
	const shownPhase =
		phase === 'admitted' || phase === 'declined' ? phase : 'ready';

	return (
		<>
			{knock && (
				<KnockWatch
					knock={knock}
					deps={knockDeps}
					pollMs={pollMs}
					onState={setKnockState}
				/>
			)}
			<KnockWaitDialog
				variant="call"
				phase={shownPhase}
				purpose={purpose}
				media={device.check}
				knocking={waiting}
				onJoin={join}
				onRetry={device.retry}
				onCancel={() => {
					if (knock) stopWaiting();
					else onClose();
				}}
				onClose={() => {
					if (knock) knockState?.close();
					onClose();
				}}
				/* Knocking again goes through the link; without it on this
				   device the refusal offers only "Schließen" (FE#1893). */
				onKnockAgain={
					knock?.token ? () => knockState?.knockAgain() : undefined
				}
				sheet={sheet}
			/>
		</>
	);
};
