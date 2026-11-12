import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ActiveSessionContext } from '../../globalState';
import type {
	CALL_STATE_NOT_FOUND,
	CallLifecycleMessage
} from '../../utils/callLifecycleMessage';
import { callPartyOf } from '../call/callParty';
import { formatMessagePersonName } from './messageNameUtils';
import { CallTimelineSystemMessage } from './CallTimelineSystemMessage';
import { useCallTimelineState } from './useCallTimelineState';
import { CallPrejoinDialog } from '../call/prejoin/CallPrejoinDialog';
import type {
	CallJoinHooks,
	CallJoinResult
} from '../directLinkEntry/callMessageKnock';

/** Dismissing the device check is the person's choice, not a failure. */
const joinFailedFor = (result: CallJoinResult) =>
	result !== 'joined' && result !== 'cancelled';

/** mm:ss, and h:mm:ss from one hour on. */
export const formatCallDuration = (totalSeconds: number) => {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const secs = Math.floor(totalSeconds % 60);
	const pad = (value: number) => value.toString().padStart(2, '0');
	return hours > 0
		? `${hours}:${pad(minutes)}:${pad(secs)}`
		: `${pad(minutes)}:${pad(secs)}`;
};

/** The current time, re-read every second while `active`. */
const useSecondClock = (active: boolean) => {
	const [now, setNow] = React.useState(() => Date.now());
	React.useEffect(() => {
		if (!active) return;
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [active]);
	return now;
};

/** A durable room notice, independent of the current browser's call window. */
export const CallTimelineMessage = ({
	call: initialCall,
	onJoin,
	loadState,
	deviceCheck
}: {
	call: CallLifecycleMessage;
	/**
	 * The join. From the device check it gets the check's hooks (#2016): it
	 * closes the check before joining, or hands it a knock to wait on.
	 */
	onJoin?: (hooks?: CallJoinHooks) => Promise<CallJoinResult>;
	loadState?: (
		call: CallLifecycleMessage
	) => Promise<CallLifecycleMessage | null | typeof CALL_STATE_NOT_FOUND>;
	/**
	 * Asked on "Beitreten": show the camera and microphone check first
	 * (#2016, `shouldShowDeviceCheck`). Without it the card joins at once.
	 */
	deviceCheck?: () => boolean;
}) => {
	const call = useCallTimelineState(initialCall, loadState);
	const { t, i18n } = useTranslation();
	const [joining, setJoining] = React.useState(false);
	const [joinFailed, setJoinFailed] = React.useState(false);
	const joinPending = React.useRef(false);
	const [checking, setChecking] = React.useState(false);
	const join = async (hooks?: CallJoinHooks) => {
		if (!onJoin || joinPending.current) return;
		joinPending.current = true;
		setJoining(true);
		setJoinFailed(false);
		try {
			const result = await onJoin(hooks);
			setJoinFailed(joinFailedFor(result));
			return result;
		} catch {
			setJoinFailed(true);
			return 'unavailable' as const;
		} finally {
			joinPending.current = false;
			setJoining(false);
		}
	};
	/* The check first; "Jetzt beitreten" closes it — releasing its camera —
	   and only then joins. */
	const joinOrCheck = () => {
		if (!onJoin || joinPending.current) return;
		if (deviceCheck?.()) setChecking(true);
		else void join();
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
	/*
	 * The two parties of the conversation by the names the session list uses
	 * (#780). The room's names come from Matrix profiles, which on our
	 * accounts hold the login name, so "Called by bart_getme_2fa" — the one
	 * identifier the public display name exists to keep off screen.
	 */
	const sessionContext = React.useContext(ActiveSessionContext);
	const activeSession = sessionContext?.activeSession;
	const partyOf = (userId: string | undefined) =>
		callPartyOf(
			activeSession && {
				session: activeSession.item,
				consultant: activeSession.consultant,
				user: activeSession.user
			},
			userId
		);
	const named = call.actorUserId
		? [...call.participants, ...(call.present ?? [])].find(
				(participant) => participant.userId === call.actorUserId
			)?.displayName
		: undefined;
	/*
	 * A group has no consultant/asker pair, so `partyOf` knows nobody and the
	 * Matrix profile name (the login, e.g. "blinky2") would be shown. The
	 * group's member list carries the public display name (OBP 2.1 #32).
	 */
	const groupMemberName = (userId: string | undefined) => {
		if (!activeSession?.isGroup || !userId) return undefined;
		const member = sessionContext?.avatarMembers?.find(
			(entry) => entry._id === userId
		);
		return member?.displayName?.trim()
			? formatMessagePersonName(member.displayName, member.username)
			: undefined;
	};
	const memberName = groupMemberName(call.actorUserId);
	const actorName =
		partyOf(call.actorUserId)?.name ??
		memberName ??
		(named === call.actorUserId ? undefined : named);
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
	/*
	 * Which conversation the call belongs to (#2237): the conversation's topic,
	 * as the session list and the group info name it. The title used to repeat
	 * the state ("Videoanruf läuft" over "Läuft").
	 */
	const rawTopic = activeSession?.item?.topic as
		| string
		| { name?: string }
		| undefined;
	const topic = (
		typeof rawTopic === 'string' ? rawTopic : rawTopic?.name
	)?.trim();
	const headline = topic ? `${callLabel} · ${topic}` : callLabel;
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
	/*
	 * A missed call has no length to show, so its card shows when it rang
	 * (#2237): the time alone today, with the date on any other day. The
	 * invitation is the right moment here — nobody answered, so it is when
	 * the phone rang, not a claimed start.
	 */
	const rangAt =
		call.state === 'missed' ? (startedAt ?? call.invitedAt) : undefined;
	const timeLabel = React.useMemo(() => {
		if (!rangAt) return undefined;
		const at = new Date(rangAt);
		if (Number.isNaN(at.getTime())) return undefined;
		const today = new Date().toDateString() === at.toDateString();
		return new Intl.DateTimeFormat(
			uiLanguage,
			today
				? { timeStyle: 'short' }
				: { dateStyle: 'medium', timeStyle: 'short' }
		).format(at);
	}, [rangAt, uiLanguage]);
	/*
	 * A running call counts up from its start, every second (#2237), so the
	 * card answers "how long has this been going on" without arithmetic.
	 */
	const runningSince =
		call.state === 'running' && startedAt
			? new Date(startedAt).getTime()
			: undefined;
	const now = useSecondClock(runningSince !== undefined);
	const seconds =
		runningSince !== undefined && !Number.isNaN(runningSince)
			? Math.max(0, Math.floor((now - runningSince) / 1000))
			: call.durationSeconds;
	const duration = seconds === undefined ? null : formatCallDuration(seconds);
	return (
		<>
			<CallTimelineSystemMessage
				state={call.state}
				callType={call.callType}
				callLabel={callLabel}
				headline={headline}
				statusLabel={statusLabel}
				description={description}
				timeLabel={timeLabel}
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
					const party = partyOf(participant.userId);
					if (party) return { ...participant, ...party.avatar };
					// In a group, the public display name, as for the
					// caller above — never the Matrix login (#2237 tooltip).
					const named =
						groupMemberName(participant.userId) ??
						(participant.displayName === participant.userId
							? undefined
							: participant.displayName);
					return {
						...participant,
						displayName: named,
						username: named
					};
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
				onAction={
					call.state === 'running' ? onJoin && joinOrCheck : undefined
				}
			/>
			{checking && (
				<CallPrejoinDialog
					modality={call.callType}
					roomRef={call.roomRef}
					onJoin={(hooks) => join(hooks)}
					onClose={() => setChecking(false)}
					callEnded={call.state !== 'running'}
					onJoinResult={(result) =>
						setJoinFailed(joinFailedFor(result))
					}
				/>
			)}
		</>
	);
};
