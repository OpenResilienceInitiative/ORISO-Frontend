import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KnockWaitDialog } from '../../knockWaitDialog/KnockWaitDialog';
import { useCallDeviceCheck } from '../../waitingRoom/callEntry/useCallDeviceCheck';
import type { CallModality } from '../../waitingRoom/callEntry/callEntryTypes';
import {
	chosenDeviceLabel,
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
	releaseKnock,
	rememberAdmittedConversation
} from '../../directLinkEntry/callMessageKnock';
import {
	DirectLinkKnockDeps,
	DirectLinkKnockState,
	useDirectLinkKnock
} from '../../directLinkEntry/useDirectLinkKnock';
import {
	forgetPendingKnock,
	PendingKnock
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
	/** Stories: stand in for `navigator.mediaDevices` and the knock API. */
	mediaDevices?: MediaDevices;
	knockDeps?: Partial<DirectLinkKnockDeps>;
	pollMs?: number;
	sheet?: boolean;
}

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
	const { phase, gone, cancel, knockAgain, close } = useDirectLinkKnock(
		knock,
		deps,
		pollMs
	);
	useEffect(
		() => onState({ phase, gone, cancel, knockAgain, close }),
		[onState, phase, gone, cancel, knockAgain, close]
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
				blocker: device.blocker,
				// By label: the call runs on another origin (ElementCall#116).
				microphoneLabel: chosenDeviceLabel(
					device.check.devices.microphone,
					device.controls.selection.microphone
				),
				cameraLabel: chosenDeviceLabel(
					device.check.devices.camera,
					device.controls.selection.camera
				)
			})
		);
	const keepChoiceRef = useRef(keepChoice);
	keepChoiceRef.current = keepChoice;
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

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
				beforeJoin: onClose,
				onKnock: (pending, joinLater) => {
					joinOnceAdmitted.current = joinLater;
					setKnock(pending);
				}
			})
		)
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
		releaseKnock(knock.knockId);
		setKnock(null);
		setKnockState(null);
	}, [gone, knock]);

	// Let in: the call starts with exactly what the switches say now.
	const phase = knockState?.phase;
	useEffect(() => {
		if (phase !== 'admitted' || !knock) return;
		const timer = window.setTimeout(() => {
			forgetPendingKnock();
			releaseKnock(knock.knockId);
			rememberAdmittedConversation(knock.sessionId);
			keepChoiceRef.current();
			onCloseRef.current();
			void joinOnceAdmitted.current?.().catch(() => undefined);
		}, ADMITTED_PAUSE_MS);
		return () => window.clearTimeout(timer);
	}, [phase, knock]);

	// A knock left behind (the chat closed) goes back to the knock gate.
	const heldKnock = knock?.knockId;
	useEffect(
		() => () => {
			if (heldKnock !== undefined) releaseKnock(heldKnock);
		},
		[heldKnock]
	);

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
				onKnockAgain={() => knockState?.knockAgain()}
				sheet={sheet}
			/>
		</>
	);
};
