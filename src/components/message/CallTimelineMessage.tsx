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
	const { t, i18n } = useTranslation();
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
	// Nobody answered a missed call: its only participant is the caller, who
	// is named in the description, so it lists nobody as "Attended" (#780).
	const shown = call.state === 'missed' ? [] : (live ?? call.participants);

	/*
	 * Who started it, by the name the room already knows them under.
	 *
	 * Only when we have a name for them: a raw Matrix id on a card is worse
	 * than saying nothing, and on a counselling platform it is an identifier
	 * the pseudonym exists to keep out of sight. The lists are the only
	 * place a name is available here, which is also why this cannot be
	 * reconstructed without `actorUserId` — a user id alone is not a person.
	 */
	/*
	 * And a stand-in name is not a name.
	 *
	 * Both producers fall back to the id when the room has no display name
	 * for somebody — `callLifecycleTracker` writes
	 * `room.getMember(userId)?.name || userId`, and `apiCallState` does the
	 * same — so finding an entry was never enough. The one check this had
	 * caught an actor MISSING from the lists and let the id through whenever
	 * it was present as its own display name, which is the commoner case: a
	 * member whose profile has not synced yet.
	 */
	const named = call.actorUserId
		? [...call.participants, ...(call.present ?? [])].find(
				(participant) => participant.userId === call.actorUserId
			)?.displayName
		: undefined;
	const actorName = named === call.actorUserId ? undefined : named;
	/*
	 * The date in the language the interface is in, not the browser's.
	 *
	 * `Intl.DateTimeFormat(undefined, …)` takes the browser locale, so a
	 * German interface in an English browser said "Gestartet am Oct 16, 2026,
	 * 10:00 AM", and the reverse happened too. `i18n.language` can be
	 * `de@informal`, which is our own variant and not a BCP 47 tag, so the
	 * suffix comes off before `Intl` sees it. Built once per language rather
	 * than per render: constructing a formatter is not cheap.
	 */
	const uiLanguage = (i18n?.language ?? '').split('@')[0] || undefined;
	const startFormat = React.useMemo(
		() =>
			new Intl.DateTimeFormat(uiLanguage, {
				dateStyle: 'medium',
				timeStyle: 'short'
			}),
		[uiLanguage]
	);
	const label = t(`videoCall.timeline.${call.callType}.${call.state}`);
	const callLabel = t(`message.callLifecycle.type.${call.callType}`);
	const statusLabel = t(`message.callLifecycle.state.${call.state}`);
	const startedAt = call.startedAt;
	const formattedStart = startedAt
		? startFormat.format(new Date(startedAt))
		: undefined;
	const baseDescription =
		call.state === 'missed' || formattedStart
			? t(`message.callLifecycle.description.${call.state}`, {
					start: formattedStart
				})
			: label;
	const description = actorName
		? `${baseDescription} ${t('message.callLifecycle.startedBy', {
				name: actorName
			})}`
		: baseDescription;
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
			/*
			 * And the same rule for the avatars, one layer deeper.
			 *
			 * The actor line above drops a display name that is only the
			 * user id. This mapping fed that id to `UserAvatar` as BOTH the
			 * display name and the username, and `formatMessagePersonName`
			 * turns `@alex:example` into an accessible name of `alex` — so a
			 * screen-reader user was still told the identifier the visible
			 * card had just been taught to hide, which is the worse half of
			 * the two.
			 *
			 * `userId` stays, because the avatar's colour and letters are
			 * derived from it and that derivation reveals nothing. What goes
			 * is the claim that the id is a NAME.
			 */
			participants={shown.map((participant) => {
				const named =
					participant.displayName === participant.userId
						? undefined
						: participant.displayName;
				return { ...participant, displayName: named, username: named };
			})}
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
