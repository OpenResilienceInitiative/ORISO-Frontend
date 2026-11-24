import { useCallback, useMemo, useRef, useState } from 'react';
import { formatMatrixTimelineEvent } from '../../utils/matrixTimelineEventFormatter';
import {
	applyCallLifecycleEdits,
	collapseCallLifecycleMessages,
	type CallLifecycleMessage
} from '../../utils/callLifecycleMessage';
import { apiCallStateRead } from '../../api/apiCallState';
import { useCallTimelineState } from '../message/useCallTimelineState';

/**
 * Call design S10: the call running in this conversation, as its call card
 * says, so the session LIST can show it too.
 *
 * Measured on dev at 375 px: an advice seeker on the list saw no sign of the
 * running call and found it only after opening the conversation. The card in
 * the chat is built from the same room events the list item already holds
 * for its preview, folded through the same pipeline (`roomTimeline.ts`), so
 * the list and the chat cannot disagree about which call is running.
 *
 * Only a call of THIS room (`roomRef`): a supervision side room's call is
 * not the conversation's.
 */
export const runningCallOf = (
	events: readonly unknown[],
	roomId: string | null | undefined
): CallLifecycleMessage | null => runningCardOf(events, roomId)?.call ?? null;

/**
 * The running call and the id of the card the pipeline accepted for it (the
 * root event whose author's revisions were folded), so the list can retain
 * exactly that event.
 */
export const runningCardOf = (
	events: readonly unknown[],
	roomId: string | null | undefined
): { call: CallLifecycleMessage; cardId: string } | null => {
	if (!roomId || events.length === 0) return null;
	const items = events
		.map((event) => formatMatrixTimelineEvent(event, null, ''))
		.filter(Boolean) as Parameters<typeof applyCallLifecycleEdits>[0];
	const cards = collapseCallLifecycleMessages(applyCallLifecycleEdits(items));
	for (let index = cards.length - 1; index >= 0; index -= 1) {
		const call = cards[index].callLifecycle;
		if (call?.state === 'running' && call.roomRef === roomId)
			return { call, cardId: cards[index]._id };
	}
	return null;
};

/**
 * The event of the card the pipeline accepted (`runningCardOf`), matched by
 * its id, so a later card with the same call id from somebody else can never
 * become the one the list keeps.
 */
const cardEventOf = (
	events: readonly unknown[],
	cardId: string
): unknown | null =>
	events.find(
		(event) => (event as { getId?: () => string })?.getId?.() === cardId
	) ?? null;

/**
 * The newest edit of a card by the card's own author: the revision the
 * pipeline folds last, so the list keeps the current attendance when both
 * the card and that edit have scrolled out of the window. Re-fed through the
 * same pipeline, so its checks still apply.
 */
const latestOwnEditOf = (
	events: readonly unknown[],
	original: unknown,
	cardId: string
): unknown | null => {
	const author = (original as { getSender?: () => string })?.getSender?.();
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index] as RawEventWithSender;
		const content =
			event?.getClearContent?.() || event?.getContent?.() || {};
		const relation = content['m.relates_to'] as
			| { rel_type?: unknown; event_id?: unknown }
			| undefined;
		if (
			relation?.rel_type === 'm.replace' &&
			relation.event_id === cardId &&
			author !== undefined &&
			event.getSender?.() === author
		)
			return events[index];
	}
	return null;
};

type RawEventWithSender = {
	getClearContent?: () => Record<string, unknown> | null;
	getContent?: () => Record<string, unknown> | null;
	getSender?: () => string;
};

type LoadCallState = typeof apiCallStateRead;

/** Stands in while there is no running card; never asked about. */
const NO_CALL: CallLifecycleMessage = {
	callId: '',
	roomRef: '',
	callRoomId: '',
	state: 'ended',
	callType: 'audio',
	participants: []
};

/**
 * The running call, while the server agrees it is still running.
 *
 * A card can say `running` long after the call ended — a browser that
 * crashed never writes the terminal revision. The list reconciles it exactly
 * as the chat card does (`useCallTimelineState`): it keeps asking while the
 * call runs, a server that cannot be reached is not an answer, and a call
 * the server does not know (yet) is only ended provisionally and comes back
 * once the creator's registration lands. One shared rule, so the list and
 * the chat cannot disagree.
 *
 * `apiCallStateRead` by default, so a confirmed 404 is told apart from other
 * answers. And the list fails closed where the card cannot: while the last
 * answer was untrusted (`null`, it failed validation), the marker is off —
 * a forged or unverifiable card must not advertise a call on the list.
 */
export const useRunningCall = (
	events: readonly unknown[],
	roomId: string | null | undefined,
	loadState: LoadCallState = apiCallStateRead
): CallLifecycleMessage | null => {
	/*
	 * The list's events are only the last page of the room (the preview's
	 * 50). In a busy call the card scrolls out of that window, and its later
	 * edits cannot be folded without it. So the running call's ORIGINAL card
	 * event is retained for its room and put in front of the window: edits in
	 * the window are folded onto it by the shared pipeline, which accepts
	 * only the card author's own, matching revisions. A forged "ended" from
	 * somebody else is rejected there, as in the chat.
	 *
	 * Only a validated terminal revision (or another room) lets go of it.
	 * Server answers never do: a provisionally ended call keeps its card, so
	 * the reconciliation below can bring it back.
	 */
	const retained = useRef<{
		room: string;
		event: unknown;
		/** The card author's newest revision of it (who is present now). */
		edit: unknown | null;
	} | null>(null);
	const candidate = useMemo(() => {
		if (!roomId) {
			retained.current = null;
			return null;
		}
		const kept =
			retained.current?.room === roomId ? retained.current : null;
		const front = kept
			? [kept.event, kept.edit].filter(
					(event) => event && !events.includes(event)
				)
			: [];
		const timeline = front.length ? [...front, ...events] : events;
		const found = runningCardOf(timeline, roomId);
		const original = found ? cardEventOf(timeline, found.cardId) : null;
		retained.current = original
			? {
					room: roomId,
					event: original,
					edit: latestOwnEditOf(timeline, original, found!.cardId)
				}
			: null;
		return found?.call ?? null;
	}, [events, roomId]);
	const [untrusted, setUntrusted] = useState<string | null>(null);
	const checkedLoad = useCallback<LoadCallState>(
		async (call) => {
			const answer = await loadState(call);
			setUntrusted(answer === null ? call.callId : null);
			return answer;
		},
		[loadState]
	);
	const reconciled = useCallTimelineState(
		candidate ?? NO_CALL,
		candidate ? checkedLoad : undefined
	);
	return candidate &&
		reconciled.state === 'running' &&
		untrusted !== candidate.callId
		? reconciled
		: null;
};
