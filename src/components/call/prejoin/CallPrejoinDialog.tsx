import * as React from 'react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	NOTIFICATION_TYPE_ERROR,
	NotificationsContext
} from '../../../globalState';
import { KnockWaitDialog } from '../../knockWaitDialog/KnockWaitDialog';
import { useCallDeviceCheck } from '../../waitingRoom/callEntry/useCallDeviceCheck';
import type { CallModality } from '../../waitingRoom/callEntry/callEntryTypes';
import {
	initialControlsFor,
	keepDeviceChoice,
	peekCameraSwitch,
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
	/**
	 * The call this window was opened for has ended. The window closes and
	 * releases the preview, unless the person was just let in: that hand-over
	 * finishes here, so its join still reports back to the card.
	 */
	callEnded?: boolean;
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
	const {
		knockId,
		phase,
		gone,
		inactive,
		paused,
		cancel,
		knockAgain,
		close
	} = useDirectLinkKnock(knock, deps, pollMs);
	useEffect(
		() =>
			onState({
				knockId,
				phase,
				gone,
				inactive,
				paused,
				cancel,
				knockAgain,
				close
			}),
		[
			onState,
			knockId,
			phase,
			gone,
			inactive,
			paused,
			cancel,
			knockAgain,
			close
		]
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
	callEnded = false,
	mediaDevices,
	knockDeps,
	pollMs,
	sheet
}: CallPrejoinDialogProps) => {
	const { t } = useTranslation();
	const { addNotification } = useContext(NotificationsContext) ?? {
		addNotification: () => undefined
	};
	const [initial] = useState(() =>
		initialControlsFor(
			modality,
			peekJoinMedia(roomRef),
			peekCameraSwitch(roomRef)
		)
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
		keepDeviceChoice(roomRef, modality, {
			...device,
			devices: device.check.devices
		});
	const keepChoiceRef = useRef(keepChoice);
	keepChoiceRef.current = keepChoice;
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;
	const knockStateRef = useRef(knockState);
	knockStateRef.current = knockState;
	const closedForEnd = useRef(false);
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
		if (purpose === 'check' || !onJoin) {
			keepChoice();
			onClose();
			return;
		}
		setBusy(true);
		// Kept only for a join that really goes out: a choice no call took
		// must not reach some later call in this room.
		let kept = false;
		Promise.resolve(
			onJoin({
				// Dismissed during the lookup: no call (see `joinOrKnock`).
				beforeJoin: () => {
					if (!mounted.current) return false;
					keepChoiceRef.current();
					kept = true;
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
					if (kept) rememberJoinMedia(roomRef, null);
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
	const linkInactive = Boolean(knockState?.inactive);
	const linkPaused = Boolean(knockState?.paused);
	useEffect(() => {
		if (!gone || !knock) return;
		/* Knocking again hit a switched-off link: say so, rather than drop
		   back to the check without a word (#2012). */
		if (linkInactive) {
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: t(
					linkPaused
						? 'inviteLink.paused'
						: 'directLink.entry.inactive'
				),
				text: '',
				closeable: true,
				timeout: 5000
			});
		}
		setKnock(null);
		setKnockState(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the knock goes
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
				const settle = (result: CallJoinResult) => {
					if (result !== 'joined') rememberJoinMedia(roomRef, null);
					report?.(result);
				};
				void joinLater().then(settle, () => settle('unavailable'));
			}
		}, ADMITTED_PAUSE_MS);
		return () => window.clearTimeout(timer);
	}, [phase, knock, roomRef]);

	// There is no call left to be let into: a knock still waiting is
	// withdrawn, so no second dialog waits on a call that is over.
	useEffect(() => {
		if (!callEnded || phase === 'admitted' || closedForEnd.current) return;
		closedForEnd.current = true;
		if (phase === 'waiting') knockStateRef.current?.cancel();
		onCloseRef.current();
	}, [callEnded, phase]);

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
				joining={busy}
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
