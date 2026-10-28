import * as React from 'react';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { UserDataContext } from '../../globalState';
import { KnockWaitDialog } from '../knockWaitDialog/KnockWaitDialog';
import { useLiveCallDevices } from '../waitingRoom/callEntry/useLiveCallDevices';
import {
	CallDeviceControls,
	CallModality
} from '../waitingRoom/callEntry/callEntryTypes';
import { generateAvatarForUser } from '../../utils/pseudonymGenerator';
import { startRoomCall } from '../call/startRoomCall';
import { getMatrixClientService } from '../../services/matrixClientRegistry';
import {
	forgetPendingKnock,
	PendingKnock,
	readPendingKnock
} from './directLinkEntryFlow';
import { DirectLinkKnockDeps, useDirectLinkKnock } from './useDirectLinkKnock';

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
	mediaDevices?: MediaDevices;
}

const defaultStartCall = async (knock: PendingKnock) => {
	if (knock.matrixRoomId) await waitForJoinedRoom(knock.matrixRoomId);
	await startRoomCall({
		roomId: knock.matrixRoomId,
		isVideo: knock.medium === 'VIDEO'
	});
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
	const { userData } = useContext(UserDataContext) ?? ({} as never);
	const state = useDirectLinkKnock(knock, deps, pollMs);
	const modality = modalityOf(knock);
	const [controls, setControls] = useState<CallDeviceControls>({
		micOn: true,
		cameraOn: modality === 'video',
		selection: {}
	});
	const live = useLiveCallDevices(modality, controls, deps.mediaDevices);
	const admittedOnce = useRef(false);

	useEffect(() => {
		if (state.gone) onDone();
	}, [onDone, state.gone]);

	useEffect(() => {
		if (state.phase !== 'admitted' || admittedOnce.current) return;
		admittedOnce.current = true;
		forgetPendingKnock();
		const timer = window.setTimeout(
			() => onAdmitted(knock),
			ADMITTED_PAUSE_MS
		);
		return () => window.clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- once per admission
	}, [state.phase]);

	const name = userData?.userName ?? '';
	const avatar = useMemo(
		() => generateAvatarForUser(userData?.userId || name || 'guest'),
		[name, userData?.userId]
	);

	return (
		<KnockWaitDialog
			variant="call"
			phase={state.phase}
			media={{
				modality,
				name,
				avatar,
				devices: live.devices,
				selection: controls.selection,
				stream: live.stream,
				micLevel: live.micLevel,
				micOn: controls.micOn,
				cameraOn: controls.cameraOn,
				cameraAvailable: !live.cameraMissing,
				onToggleMic: () =>
					setControls((now) => ({ ...now, micOn: !now.micOn })),
				onToggleCamera: () =>
					setControls((now) => ({ ...now, cameraOn: !now.cameraOn })),
				onSelectDevice: (kind, id) =>
					setControls((now) => ({
						...now,
						selection: { ...now.selection, [kind]: id }
					}))
			}}
			onCancel={state.cancel}
			onKnockAgain={state.knockAgain}
			onClose={state.close}
		/>
	);
};

/**
 * Mounted once in the app. After a direct-link call entry the app is loaded
 * on the person's conversation with a knock in `sessionStorage`; this shows
 * the knock dialog over that conversation and, once the person is let in,
 * starts the call into it (FE#1893).
 */
export const DirectLinkKnockGate = ({
	deps = {},
	pollMs
}: {
	deps?: Partial<DirectLinkKnockGateDeps>;
	pollMs?: number;
}) => {
	const location = useLocation();
	const [knock, setKnock] = useState<PendingKnock | null>(() =>
		readPendingKnock()
	);
	useEffect(() => {
		setKnock((now) => now ?? readPendingKnock());
	}, [location.pathname]);
	const startCall = deps.startCall ?? defaultStartCall;

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
				void startCall(admitted).catch(() => undefined);
			}}
		/>
	);
};
