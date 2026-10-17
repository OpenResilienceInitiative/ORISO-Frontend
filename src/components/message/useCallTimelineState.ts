import * as React from 'react';
import {
	hasSameCallLifecycleIdentity,
	type CallLifecycleMessage
} from '../../utils/callLifecycleMessage';

const REFRESH_DELAY_MS = 15000;

const sameAttendance = (
	a: CallLifecycleMessage['participants'] | undefined,
	b: CallLifecycleMessage['participants'] | undefined
): boolean => {
	if (a === b) return true;
	if (!a || !b || a.length !== b.length) return false;
	return a.every(
		(person, index) =>
			person.userId === b[index].userId &&
			person.displayName === b[index].displayName
	);
};

/**
 * Whether two revisions of the same card say the same thing about who is there.
 *
 * `apiCallState` builds its answer by spreading the revision it was ASKED
 * about, because the server sends authoritative timings and state but not
 * always the names. So a response is only safe to store while the timeline
 * still agrees with the revision that was asked about: if a membership edit
 * landed while the request was in flight, the response carries the old
 * attendance and presence, and a terminal answer would stop the retries that
 * could ever correct it.
 *
 * Compared by VALUE, not by object identity. The session rebuilds every
 * message object on each fetch, so identity changes constantly without
 * anything having happened — comparing it would make every card re-read on
 * every incoming chat message, which is the storm the `callKey` above exists
 * to prevent.
 */
const sameTimelineRevision = (
	a: CallLifecycleMessage,
	b: CallLifecycleMessage
): boolean =>
	a.state === b.state &&
	a.actorUserId === b.actorUserId &&
	sameAttendance(a.participants, b.participants) &&
	sameAttendance(a.present, b.present);

type LoadCallState = (
	call: CallLifecycleMessage
) => Promise<CallLifecycleMessage | null>;

/** Reconcile a durable room card with the authenticated lifecycle state. */
export function useCallTimelineState(
	initialCall: CallLifecycleMessage,
	loadState?: LoadCallState
): CallLifecycleMessage {
	const [stored, setStored] = React.useState<{
		original: CallLifecycleMessage;
		value: CallLifecycleMessage;
	} | null>(null);
	const sameCardAsStored = Boolean(
		stored && hasSameCallLifecycleIdentity(stored.original, initialCall)
	);
	const hasAcceptedTerminal = Boolean(
		sameCardAsStored && stored && stored.value.state !== 'running'
	);
	const call =
		stored &&
		sameCardAsStored &&
		// A terminal answer always wins. Otherwise the stored value only
		// stands while the card it was loaded for still says the same thing:
		// once the timeline itself has moved on, the timeline is newer.
		//
		// This used to compare the prop by OBJECT IDENTITY, which is not
		// stable. The session rebuilds every message on each fetch, so an
		// accepted running value was thrown away on the next incoming chat
		// message and the card snapped back to the durable copy.
		//
		// Then it compared only `state`, which is too little: a membership
		// edit leaves both revisions `running` while `participants` and
		// `present` change, so an accepted running answer kept winning and
		// the card showed departed or missing attendees until the next
		// fifteen-second poll — with the live revision already in its props.
		// Attendance-only edits do not change `callKey` either, so nothing
		// re-read it sooner. The whole revision is compared now.
		(stored.value.state !== 'running' ||
			sameTimelineRevision(stored.original, initialCall))
			? stored.value
			: initialCall;

	/*
	 * What to ask about, without making the asking depend on it.
	 *
	 * The effect below must not restart when the prop is merely rebuilt. It
	 * used to depend on `initialCall`, and the session rebuilds every message
	 * object on every `fetchSessionMessages()` — which runs for each incoming
	 * message, each reaction, each decryption burst and a 60-second fallback.
	 * Every rebuild therefore started a fresh immediate read for every call
	 * card on screen: ten cards in a conversation meant ten requests per
	 * incoming chat message. So the effect is keyed on what actually
	 * identifies the card, and reads the current object from a ref.
	 */
	const callKey = [
		initialCall.callId,
		initialCall.roomRef,
		initialCall.callRoomId,
		initialCall.callType,
		initialCall.state
	].join('\u0000');
	const latest = React.useRef(initialCall);
	React.useEffect(() => {
		latest.current = initialCall;
	}, [initialCall]);

	React.useEffect(() => {
		if (!loadState || hasAcceptedTerminal) return;
		let active = true;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const refresh = async () => {
			const current = latest.current;
			let settled = false;
			try {
				const value = await loadState(current);
				if (!active) return;
				if (!sameTimelineRevision(latest.current, current)) {
					// The timeline moved on while this was in flight, so the
					// answer describes attendance that is already out of date.
					// Leave `settled` false and ask again about what the card
					// says now.
				} else if (!value) {
					/*
					 * Nothing on the server to reconcile with: a card written
					 * before the backend held a record, one whose record is
					 * gone, or a forged card. For a card that is already
					 * finished there is nothing left to learn, and asking
					 * every fifteen seconds for as long as it is on screen
					 * answers a question nobody asked. A RUNNING card keeps
					 * asking, because that one still has an ending to find.
					 */
					settled = current.state !== 'running';
				} else if (
					hasSameCallLifecycleIdentity(value, current) &&
					(current.state === 'running' || value.state !== 'running')
				) {
					setStored((previous) =>
						previous &&
						hasSameCallLifecycleIdentity(
							previous.original,
							current
						) &&
						previous.value.state !== 'running'
							? previous
							: { original: current, value }
					);
					settled = value.state !== 'running';
				}
			} catch {
				// Keep the durable room card when the authenticated read is unavailable.
			}
			if (active && !settled) {
				timer = setTimeout(refresh, REFRESH_DELAY_MS);
			}
		};
		void refresh();
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [hasAcceptedTerminal, callKey, loadState]);

	return call;
}
