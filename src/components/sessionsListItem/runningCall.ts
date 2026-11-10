import { useEffect, useMemo, useState } from 'react';
import { formatMatrixTimelineEvent } from '../../utils/matrixTimelineEventFormatter';
import {
	applyCallLifecycleEdits,
	collapseCallLifecycleMessages,
	type CallLifecycleMessage
} from '../../utils/callLifecycleMessage';
import { apiCallState } from '../../api/apiCallState';

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

type LoadCallState = typeof apiCallState;

/**
 * The running call, once the server agrees it is still running.
 *
 * A card can say `running` long after the call ended — a browser that
 * crashed never writes the terminal revision — so the list asks the server
 * once per call, as the chat card does. A server that cannot be reached is
 * not an answer: the card's word stands until it can be asked.
 */
export const useRunningCall = (
	events: readonly unknown[],
	roomId: string | null | undefined,
	loadState: LoadCallState = apiCallState
): CallLifecycleMessage | null => {
	const candidate = useMemo(
		() => runningCallOf(events, roomId),
		[events, roomId]
	);
	const [ended, setEnded] = useState<ReadonlySet<string>>(new Set());
	const callId = candidate?.callId;

	useEffect(() => {
		if (!candidate || !callId) return undefined;
		let active = true;
		loadState(candidate).then(
			(state) => {
				if (!active || state?.state === 'running') return;
				setEnded((previous) => new Set(previous).add(callId));
			},
			() => undefined
		);
		return () => {
			active = false;
		};
		// Once per call: a new card revision (who is present) is not a new call.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [callId, loadState]);

	return candidate && !ended.has(candidate.callId) ? candidate : null;
};
