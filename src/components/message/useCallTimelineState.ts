import * as React from 'react';
import {
	hasSameCallLifecycleIdentity,
	type CallLifecycleMessage
} from '../../utils/callLifecycleMessage';

const REFRESH_DELAY_MS = 15000;

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
		// stands while the card it was loaded for says the same thing: once
		// the timeline itself has moved on, the timeline is newer.
		//
		// This used to compare the prop by OBJECT IDENTITY, which is not
		// stable. The session rebuilds every message on each fetch, so an
		// accepted running value was thrown away on the next incoming chat
		// message and the card snapped back to the durable copy.
		(stored.value.state !== 'running' ||
			stored.original.state === initialCall.state)
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
				if (!value) {
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
