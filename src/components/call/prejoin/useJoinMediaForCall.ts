import { useEffect, useRef, useState } from 'react';
import { type JoinMedia, peekJoinMedia, takeJoinMedia } from './callPrejoin';

interface Held {
	key: string;
	media: JoinMedia | null;
}

/**
 * The pre-join choice for one call, held for as long as that call runs
 * (ElementCall#116).
 *
 * The widget URL is built from it, and a URL that changes navigates the
 * running call — a token refresh rebuilds the URL and must get the same one.
 * So the choice is read once per call, there from the first render (`peek`),
 * and taken from the room in an effect, so the room's next call starts as
 * calls always did.
 *
 * @param roomRef The room the check remembered the choice for.
 * @param callKey Identifies this call; `null` while there is none.
 */
export const useJoinMediaForCall = (
	roomRef: string | null | undefined,
	callKey: string | null
): JoinMedia | null => {
	const [held, setHeld] = useState<Held | null>(null);
	// Taken once per call even when an effect runs twice (Strict Mode): a
	// second take would find the room empty and hold nothing.
	const taken = useRef<Held | null>(null);

	useEffect(() => {
		if (!callKey) return;
		if (taken.current?.key !== callKey) {
			taken.current = { key: callKey, media: takeJoinMedia(roomRef) };
		}
		setHeld(taken.current);
	}, [callKey, roomRef]);

	if (!callKey) return null;
	return held?.key === callKey ? held.media : peekJoinMedia(roomRef);
};
