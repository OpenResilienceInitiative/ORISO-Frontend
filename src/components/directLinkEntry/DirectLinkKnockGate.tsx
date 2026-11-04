import * as React from 'react';
import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
	NOTIFICATION_TYPE_ERROR,
	NotificationsContext
} from '../../globalState/provider/NotificationsProvider';
import { KnockWaitDialog } from '../knockWaitDialog/KnockWaitDialog';
import { useCallDeviceCheck } from '../waitingRoom/callEntry/useCallDeviceCheck';
import { CallModality } from '../waitingRoom/callEntry/callEntryTypes';
import { startRoomCall } from '../call/startRoomCall';
import { getMatrixClientService } from '../../services/matrixClientRegistry';
import {
	forgetPendingKnock,
	PENDING_KNOCK_EVENT,
	PendingKnock,
	readPendingKnock
} from './directLinkEntryFlow';
import {
	admissionAction,
	CallJoinResult,
	isKnockClaimed,
	rememberAdmittedConversation,
	takeAdmittedJoin
} from './callMessageKnock';
import { callManager } from '../../services/CallManager';
import {
	keepDeviceChoice,
	peekJoinMedia,
	rememberJoinMedia
} from '../call/prejoin/callPrejoin';

import { DirectLinkKnockDeps, useDirectLinkKnock } from './useDirectLinkKnock';

/** The open device check over the call message waits for its own knock. */
const unclaimedPendingKnock = () => {
	const knock = readPendingKnock();
	return knock && !isKnockClaimed(knock.knockId) ? knock : null;
};

/** How long the app may take to join the conversation's Matrix room. */
const ROOM_WAIT_MS = 20_000;

/** Resolves once the signed-in client has joined `roomId` (or gives up). */
export const waitForJoinedRoom = (
	roomId: string,
	timeoutMs = ROOM_WAIT_MS
): Promise<boolean> =>
	new Promise((resolve) => {
		const started = Date.now();
		const check = () => {
			const client = getMatrixClientService()?.getClient?.();
			if (client?.getRoom?.(roomId)?.getMyMembership?.() === 'join') {
				resolve(true);
				return;
			}
			if (Date.now() - started > timeoutMs) {
				resolve(false);
				return;
			}
			window.setTimeout(check, 250);
		};
		check();
	});

export interface DirectLinkKnockGateDeps extends DirectLinkKnockDeps {
	/** Starts the call once the person was let in. */
	startCall: (knock: PendingKnock) => Promise<void>;
	/** Joins the running call recorded with the knock (after a reload). */
	joinRunningCall: (knock: PendingKnock) => Promise<CallJoinResult>;
	mediaDevices?: MediaDevices;
}

/** The room whose call takes the switches (`GroupCallWidget`). */
const callRoomOf = (knock: PendingKnock) =>
	knock.joinCall?.roomRef ?? knock.matrixRoomId ?? null;

/**
 * Let in after a knock: starts the call. The camera choice from the device
 * check (#2016) also decides whether the permission request asks for the
 * camera; the choice itself stays for the call to take (`GroupCallWidget`).
 */
export const defaultStartCall = async (knock: PendingKnock) => {
	if (knock.matrixRoomId) await waitForJoinedRoom(knock.matrixRoomId);
	const isVideo = knock.medium === 'VIDEO';
	const chosen = peekJoinMedia(callRoomOf(knock));
	await startRoomCall({
		roomId: knock.matrixRoomId,
		isVideo,
		requestCamera: isVideo && (chosen?.video_enabled ?? true)
	});
};

/*
 * #2016: let in after a reload, the person joins the running call the card
 * knocked for at once; they never tap "Beitreten" a second time. Direct
 * links are 1:1, so the call is a group call only if its card says so.
 */
export const defaultJoinRunningCall = async (
	knock: PendingKnock
): Promise<CallJoinResult> => {
	const call = knock.joinCall;
	/* No mode on record: never guess 1:1, whose leave ends a group call for
	   everybody. The card's next tap joins with the mode resolved there. */
	if (!call || call.isGroup === undefined) return 'unavailable';
	await waitForJoinedRoom(call.roomRef);
	// The card's people are not stored with the knock; the join reads none.
	return callManager.joinExistingCall(
		{ ...call, participants: [] },
		call.isGroup
	);
};

const modalityOf = (knock: PendingKnock): CallModality =>
	knock.medium === 'VIDEO' ? 'video' : 'audio';

/** How long "Sie wurden hereingelassen" stays before the call takes over. */
const ADMITTED_PAUSE_MS = 1_200;

interface DirectLinkKnockProps {
	knock: PendingKnock;
	/** Withdrawn, closed or declined-and-closed: the dialog goes. */
	onDone: () => void;
	/** Let in: the dialog goes (its preview releases the devices first). */
	onAdmitted: (knock: PendingKnock) => void;
	deps?: Partial<DirectLinkKnockGateDeps>;
	pollMs?: number;
}

/**
 * The knock dialog (#1834) over the person's own conversation, for an audio
 * or video direct link: waiting with the call's preview and switches, then
 * "let in" hands over to the call, "turned down" offers to knock again.
 */
export const DirectLinkKnock = ({
	knock,
	onDone,
	onAdmitted,
	deps = {},
	pollMs
}: DirectLinkKnockProps) => {
	const { t } = useTranslation();
	const { addNotification } = useContext(NotificationsContext) ?? {
		addNotification: () => undefined
	};
	const state = useDirectLinkKnock(knock, deps, pollMs);
	const device = useCallDeviceCheck(modalityOf(knock), {
		mediaDevices: deps.mediaDevices
	});
	const admitted = state.phase === 'admitted';
	const admittedOnce = useRef(false);

	useEffect(() => {
		if (!state.gone) return;
		/* Knocking again hit a switched-off link: say so, rather than let the
		   dialog vanish without a word (#2012). */
		if (state.inactive) {
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: t('directLink.entry.inactive'),
				text: '',
				closeable: true,
				timeout: 5000
			});
		}
		onDone();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the dialog goes
	}, [state.gone]);

	/* Let in: the knock is done; the call takes over after a short pause. */
	useEffect(() => {
		if (!admitted || admittedOnce.current) return;
		admittedOnce.current = true;
		forgetPendingKnock();
		const timer = window.setTimeout(
			() => onAdmitted(knock),
			ADMITTED_PAUSE_MS
		);
		return () => window.clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- once per admission
	}, [admitted]);

	/* The switches in this window go into the call (#2016), kept current
	   until the hand-over. A knock let in before the check has settled
	   (persisted, or admitted on the first poll) has no camera yet: it is
	   not asked for until the check finds one, so a device without a
	   camera still starts the call. */
	const room = callRoomOf(knock);
	const { controls } = device;
	const cameraFound = device.settled && device.cameraAvailable;
	useEffect(() => {
		if (!admitted || !room) return;
		keepDeviceChoice(room, modalityOf(knock), {
			controls,
			cameraAvailable: cameraFound,
			blocker: device.blocker,
			check: device.check
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps -- the knock is fixed per mount
	}, [
		admitted,
		room,
		controls,
		cameraFound,
		device.blocker,
		device.check.devices
	]);

	return (
		<KnockWaitDialog
			variant="call"
			phase={state.phase}
			/* A check that failed says why and can run again while the
			   knock waits. */
			media={device.check}
			onRetry={device.retry}
			onCancel={state.cancel}
			/* Knocking again goes through the link; without it on this
			   device the refusal offers only "Schließen" (FE#1893). */
			onKnockAgain={knock.token ? state.knockAgain : undefined}
			onClose={state.close}
		/>
	);
};

/**
 * Mounted once in the app. After a direct-link call entry the app is loaded
 * on the person's conversation with a knock in `sessionStorage`; this shows
 * the knock dialog over that conversation and, once the person is let in,
 * starts the call into it (FE#1893). A knock from a running call's card
 * shows the same dialog and then joins that call.
 */
export const DirectLinkKnockGate = ({
	deps = {},
	pollMs
}: {
	deps?: Partial<DirectLinkKnockGateDeps>;
	pollMs?: number;
}) => {
	const location = useLocation();
	const { t } = useTranslation();
	const { addNotification } = useContext(NotificationsContext) ?? {
		addNotification: () => undefined
	};
	const [knock, setKnock] = useState<PendingKnock | null>(() =>
		unclaimedPendingKnock()
	);
	useEffect(() => {
		setKnock((now) => now ?? unclaimedPendingKnock());
	}, [location.pathname]);
	/* A knock from a running call's card (FE#1893) arrives without a route change. */
	useEffect(() => {
		const pick = () => setKnock((now) => now ?? unclaimedPendingKnock());
		window.addEventListener(PENDING_KNOCK_EVENT, pick);
		return () => window.removeEventListener(PENDING_KNOCK_EVENT, pick);
	}, []);
	const startCall = deps.startCall ?? defaultStartCall;
	const joinRunningCall = deps.joinRunningCall ?? defaultJoinRunningCall;
	/* No call took the switches, so no later call in this room may. */
	const forgetSwitches = (admitted: PendingKnock) => {
		const room = callRoomOf(admitted);
		if (room) rememberJoinMedia(room, null);
	};
	/* The card is not there to say it: the window that was open has gone. */
	const runningCallJoinFailed = (admitted: PendingKnock) => {
		forgetSwitches(admitted);
		addNotification({
			notificationType: NOTIFICATION_TYPE_ERROR,
			title: t('videoCall.timeline.joinFailed'),
			text: '',
			closeable: true,
			timeout: 5000
		});
	};

	/* Only over the person's own conversations: not on the invite page,
	   the login or anywhere a counsellor works. */
	if (!knock || !location.pathname.startsWith('/sessions/user/view')) {
		return null;
	}

	return (
		<DirectLinkKnock
			key={knock.knockId}
			knock={knock}
			deps={deps}
			pollMs={pollMs}
			onDone={() => setKnock(null)}
			onAdmitted={(admitted) => {
				setKnock(null);
				/* Let in once: later calls here join without a knock. */
				rememberAdmittedConversation(admitted.sessionId);
				/* Join the call that is already running, never a second one;
				   after a reload the one recorded with the knock (#2016). */
				const storedJoin = takeAdmittedJoin(admitted.sessionId);
				switch (admissionAction(admitted, storedJoin)) {
					case 'storedJoin':
						storedJoin?.();
						return;
					case 'joinRunningCall':
						void joinRunningCall(admitted).then(
							(result) => {
								if (result !== 'joined') {
									runningCallJoinFailed(admitted);
								}
							},
							() => runningCallJoinFailed(admitted)
						);
						return;
					case 'startCall':
						void startCall(admitted).catch(() => undefined);
						return;
					case 'none':
						forgetSwitches(admitted);
				}
			}}
		/>
	);
};
