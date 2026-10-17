import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';
import { CallTimelineSystemMessage } from './CallTimelineSystemMessage';
import { useCallTimelineState } from './useCallTimelineState';

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
	const call = useCallTimelineState(initialCall, loadState);
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
	// Live presence only means anything while the call is running.
	const live = call.state === 'running' ? call.present : undefined;
	const shown = live ?? call.participants;
	const label = t(`videoCall.timeline.${call.callType}.${call.state}`);
	const callLabel = t(`message.callLifecycle.type.${call.callType}`);
	const statusLabel = t(`message.callLifecycle.state.${call.state}`);
	const startedAt = call.startedAt;
	const formattedStart = startedAt
		? new Intl.DateTimeFormat(undefined, {
				dateStyle: 'medium',
				timeStyle: 'short'
			}).format(new Date(startedAt))
		: undefined;
	const description =
		call.state === 'missed' || formattedStart
			? t(`message.callLifecycle.description.${call.state}`, {
					start: formattedStart
				})
			: label;
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
		<CallTimelineSystemMessage
			state={call.state}
			callType={call.callType}
			callLabel={callLabel}
			headline={label}
			statusLabel={statusLabel}
			description={description}
			durationLabel={
				duration === null
					? undefined
					: t('videoCall.timeline.duration', { duration })
			}
			/*
			 * While the call runs, the card answers "who is in there"; once it
			 * has ended, "who was". Two questions, two lists, and the
			 * difference is the whole point of the card for somebody deciding
			 * whether to join: an attendance roll that never shrinks shows
			 * people who left ten minutes ago as if they were waiting.
			 *
			 * `present` is absent on a card written before it existed. Falling
			 * back to the attendance list keeps those cards readable; for a
			 * running call that is the old, cumulative behaviour, which is
			 * better than an empty room.
			 */
			participants={shown.map((participant) => ({
				...participant,
				username: participant.displayName
			}))}
			participantsLabel={t(
				`message.callLifecycle.participants.${
					live === undefined ? 'attended' : 'current'
				}`
			)}
			actionLabel={t('videoCall.timeline.join')}
			actionDisabled={joining}
			actionStatusLabel={
				joinFailed ? t('videoCall.timeline.joinFailed') : undefined
			}
			onAction={call.state === 'running' ? onJoin && join : undefined}
		/>
	);
};
