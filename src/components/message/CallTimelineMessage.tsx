import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';
import { ICON_CALL_OFF, SystemMessage } from './SystemMessage';
import { Button, BUTTON_TYPES } from '../button/Button';

const sameCall = (left: CallLifecycleMessage, right: CallLifecycleMessage) =>
	left.callId === right.callId &&
	left.roomRef === right.roomRef &&
	left.callRoomId === right.callRoomId &&
	left.callType === right.callType;

/** A durable room notice, independent of the current browser's call window. */
export const CallTimelineMessage = ({
	call: initialCall,
	onJoin,
	loadState
}: {
	call: CallLifecycleMessage;
	onJoin?: () => Promise<'joined' | 'busy' | 'ended' | 'unavailable'>;
	loadState?: (
		call: CallLifecycleMessage
	) => Promise<CallLifecycleMessage | null>;
}) => {
	const [stored, setStored] = React.useState<{
		original: CallLifecycleMessage;
		value: CallLifecycleMessage;
	} | null>(null);
	const call =
		stored &&
		sameCall(stored.original, initialCall) &&
		(stored.original === initialCall || stored.value.state !== 'running')
			? stored.value
			: initialCall;
	React.useEffect(() => {
		if (!loadState) return;
		let active = true;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const refresh = async () => {
			let terminal = false;
			try {
				const value = await loadState(initialCall);
				if (!active) return;
				if (
					value &&
					value.callId === initialCall.callId &&
					value.roomRef === initialCall.roomRef &&
					value.callRoomId === initialCall.callRoomId &&
					value.callType === initialCall.callType &&
					(initialCall.state === 'running' ||
						value.state === initialCall.state ||
						(initialCall.state === 'missed' &&
							value.state === 'ended'))
				) {
					setStored((previous) =>
						previous &&
						sameCall(previous.original, initialCall) &&
						previous.value.state !== 'running'
							? previous
							: { original: initialCall, value }
					);
					terminal = value.state !== 'running';
				}
			} catch {
				// Keep the durable room card when the authenticated read is temporarily unavailable.
			}
			if (active && !terminal) timer = setTimeout(refresh, 15000);
		};
		void refresh();
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [initialCall, loadState]);
	const { t } = useTranslation();
	const [joining, setJoining] = React.useState(false);
	const [joinFailed, setJoinFailed] = React.useState(false);
	const joinPending = React.useRef(false);
	const join = async () => {
		if (!onJoin || joinPending.current) return;
		joinPending.current = true;
		setJoining(true);
		setJoinFailed(false);
		try {
			setJoinFailed((await onJoin()) !== 'joined');
		} catch {
			setJoinFailed(true);
		} finally {
			joinPending.current = false;
			setJoining(false);
		}
	};
	const label = t(`videoCall.timeline.${call.callType}.${call.state}`);
	const seconds = call.durationSeconds;
	const duration =
		seconds === undefined
			? null
			: `${Math.floor(seconds / 60)
					.toString()
					.padStart(2, '0')}:${Math.floor(seconds % 60)
					.toString()
					.padStart(2, '0')}`;
	return (
		<SystemMessage
			subject={<>{label}</>}
			icon={call.state === 'running' ? undefined : ICON_CALL_OFF}
		>
			<div>
				{call.state === 'running' && (
					<Button
						item={{
							type: BUTTON_TYPES.SECONDARY,
							label: t('videoCall.timeline.join')
						}}
						buttonHandle={join}
						disabled={!onJoin || joining}
					/>
				)}
				{joinFailed && (
					<p role="status">{t('videoCall.timeline.joinFailed')}</p>
				)}
				{call.participants.length > 0 && (
					<p>
						{call.participants
							.map(({ displayName }) => displayName)
							.join(', ')}
					</p>
				)}
				{duration !== null && (
					<p>{t('videoCall.timeline.duration', { duration })}</p>
				)}
			</div>
		</SystemMessage>
	);
};
