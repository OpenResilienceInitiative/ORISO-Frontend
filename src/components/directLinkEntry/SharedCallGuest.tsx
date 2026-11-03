import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
	apiCancelOwnCallKnock,
	apiGetOwnCallKnock
} from '../../api/apiDirectLinks';
import { apiJoinSharedCall } from '../../api/apiJoinSharedCall';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { callManager } from '../../services/CallManager';
import { generateAvatarForUser } from '../../utils/pseudonymGenerator';
import { Loading } from '../app/Loading';
import { KnockWaitDialog } from '../knockWaitDialog/KnockWaitDialog';
import type {
	CallDeviceControls,
	CallModality
} from '../waitingRoom/callEntry/callEntryTypes';
import { useLiveCallDevices } from '../waitingRoom/callEntry/useLiveCallDevices';

const POLL_MS = 3000;
const ADMITTED_PAUSE_MS = 1200;

type Knock = { knockId: number; phase: 'waiting' | 'admitted' | 'declined' };
type Entry =
	| { state: 'opening' | 'closed' }
	| { state: 'knock'; knock: Knock }
	| { state: 'joined'; callId: string }
	| { state: 'error'; message: string; retry: boolean };

const entryError = (error: unknown): Entry => {
	const status = (error as Response | undefined)?.status;
	return {
		state: 'error',
		message:
			status === 409
				? 'calls.share.conversationMember'
				: status === 410
					? 'directLink.entry.inactive'
					: status === 403
						? 'calls.share.joinForbidden'
						: 'directLink.entry.joinFailed',
		retry:
			status !== 409 && status !== 410 && status !== 403 && status !== 404
	};
};

/** A running-call guest has no conversation view or source-room membership. */
export const SharedCallGuest = ({
	token,
	modality
}: {
	token: string;
	modality: CallModality;
}) => {
	const { t } = useTranslation();
	const [entry, setEntry] = useState<Entry>({ state: 'opening' });
	const [attempt, setAttempt] = useState(0);
	const retry = () => {
		setEntry({ state: 'opening' });
		setAttempt((current) => current + 1);
	};

	useEffect(() => {
		const abort = new AbortController();
		let callId: string | undefined;
		const enter = async () => {
			if (abort.signal.aborted) return;
			try {
				if (callManager.hasActiveCall()) {
					throw new Error('Call already active');
				}
				const result = await apiJoinSharedCall(token);
				// The server may have accepted this visit already. Keep per-call
				// admission reusable; a closed view must never join the Matrix room.
				if (abort.signal.aborted) return;
				if (result.callAdmitted === false) {
					const { knockId, knockStatus } = result;
					if (knockStatus === 'CANCELLED') {
						setEntry({ state: 'closed' });
						return;
					}
					setEntry({
						state: 'knock',
						knock: {
							knockId,
							phase:
								knockStatus === 'DECLINED'
									? 'declined'
									: 'waiting'
						}
					});
					return;
				}
				callId = result.seat.callId;
				const joined = await callManager.joinSharedCall(
					result.seat,
					abort.signal
				);
				if (abort.signal.aborted) return;
				if (joined !== 'joined')
					throw new Error('No shared call was opened');
				setEntry({ state: 'joined', callId });
			} catch (error) {
				if (!abort.signal.aborted) setEntry(entryError(error));
			}
		};
		// Let Strict Mode's cleanup cancel the first effect before it sends.
		void Promise.resolve().then(enter);
		return () => {
			abort.abort();
			const active = callManager.getCurrentCall();
			if (active?.sharedCallGuest && active.callId === callId)
				callManager.leaveCall();
		};
	}, [token, attempt]);

	const knock = entry.state === 'knock' ? entry.knock : null;
	useEffect(() => {
		if (!knock || knock.phase !== 'waiting') return;
		let active = true;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const poll = async () => {
			try {
				const { status } = await apiGetOwnCallKnock(knock.knockId);
				if (!active) return;
				if (status === 'CANCELLED') {
					setEntry({ state: 'closed' });
					return;
				}
				if (status === 'ADMITTED' || status === 'DECLINED') {
					setEntry({
						state: 'knock',
						knock: {
							...knock,
							phase:
								status === 'ADMITTED' ? 'admitted' : 'declined'
						}
					});
					return;
				}
			} catch (error) {
				const status = (error as Response | undefined)?.status;
				if (
					active &&
					(status === 403 || status === 404 || status === 410)
				) {
					setEntry(entryError(error));
					return;
				}
			}
			if (active) timer = setTimeout(() => void poll(), POLL_MS);
		};
		void poll();
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [knock]);

	useEffect(() => {
		if (knock?.phase !== 'admitted') return;
		const timer = setTimeout(() => {
			setEntry({ state: 'opening' });
			setAttempt((current) => current + 1);
		}, ADMITTED_PAUSE_MS);
		return () => clearTimeout(timer);
	}, [knock]);

	const joinedCallId = entry.state === 'joined' ? entry.callId : null;
	useEffect(() => {
		if (!joinedCallId) return;
		return callManager.subscribe((call) => {
			if (
				call?.callId !== joinedCallId ||
				call.state === 'left' ||
				call.state === 'ended'
			)
				setEntry({ state: 'closed' });
		});
	}, [joinedCallId]);

	if (entry.state === 'opening') return <Loading layout="page" />;
	if (entry.state === 'knock') {
		return (
			<SharedCallKnock
				modality={modality}
				phase={entry.knock.phase}
				onCancel={() => {
					setEntry({ state: 'closed' });
					void apiCancelOwnCallKnock(entry.knock.knockId).catch(
						() => undefined
					);
				}}
				onKnockAgain={retry}
				onClose={() => setEntry({ state: 'closed' })}
			/>
		);
	}
	return (
		<Box sx={{ maxWidth: 480, mx: 'auto', p: 3 }}>
			{entry.state === 'error' && (
				<Alert severity="error">{t(entry.message)}</Alert>
			)}
			{entry.state === 'error' && entry.retry && (
				<Button onClick={retry}>{t('inviteLink.resume.retry')}</Button>
			)}
			<Button href="/sessions/user/view">
				{t('calls.share.openConversations')}
			</Button>
		</Box>
	);
};

const SharedCallKnock = ({
	modality,
	phase,
	...actions
}: {
	modality: CallModality;
	phase: Knock['phase'];
	onCancel: () => void;
	onKnockAgain: () => void;
	onClose: () => void;
}) => {
	const { userData } = useContext(UserDataContext) ?? {};
	const name = userData?.userName ?? '';
	// Confirm the actual mic/camera in Element Call's lobby. During the knock
	// wait the preview starts muted, so no previous off choice is reversed.
	const [controls, setControls] = useState<CallDeviceControls>({
		micOn: false,
		cameraOn: false,
		selection: {}
	});
	const live = useLiveCallDevices(modality, controls);
	return (
		<KnockWaitDialog
			variant="call"
			phase={phase}
			{...actions}
			media={{
				modality,
				name,
				avatar: generateAvatarForUser(userData?.userId || name),
				devices: live.devices,
				selection: controls.selection,
				stream: live.stream,
				micLevel: live.micLevel,
				micOn: controls.micOn,
				cameraOn: controls.cameraOn,
				cameraAvailable: !live.cameraMissing,
				onToggleMic: () =>
					setControls((current) => ({
						...current,
						micOn: !current.micOn
					})),
				onToggleCamera: () =>
					setControls((current) => ({
						...current,
						cameraOn: !current.cameraOn
					})),
				onSelectDevice: (kind, id) =>
					setControls((current) => ({
						...current,
						selection: { ...current.selection, [kind]: id }
					}))
			}}
		/>
	);
};
