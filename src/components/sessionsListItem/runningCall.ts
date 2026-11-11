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
): CallLifecycleMessage | null => {
	if (!roomId || events.length === 0) return null;
	const items = events
		.map((event) => formatMatrixTimelineEvent(event, null, ''))
		.filter(Boolean) as Parameters<typeof applyCallLifecycleEdits>[0];
	const cards = collapseCallLifecycleMessages(applyCallLifecycleEdits(items));
	for (let index = cards.length - 1; index >= 0; index -= 1) {
		const call = cards[index].callLifecycle;
		if (call?.state === 'running' && call.roomRef === roomId) return call;
	}
	return null;
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
	const found = useMemo(
		() => runningCallOf(events, roomId),
		[events, roomId]
	);
	/*
	 * The list's events are only the last page of the room (the preview's
	 * 50). In a busy call the card scrolls out of that window, and its later
	 * edits cannot be folded without it. So a running call, once seen, is
	 * retained for its room; the server reconciliation below (which keeps
	 * asking while it runs) is what ends it, not the window.
	 */
	const retained = useRef<CallLifecycleMessage | null>(null);
	if (found) retained.current = found;
	else if (retained.current && retained.current.roomRef !== roomId)
		retained.current = null;
	const candidate = found ?? retained.current;
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
	if (candidate && !found && reconciled.state !== 'running')
		// Ended (or provisionally ended) and no longer in the window: let go.
		retained.current = null;
	return candidate &&
		reconciled.state === 'running' &&
		untrusted !== candidate.callId
		? reconciled
		: null;
};
