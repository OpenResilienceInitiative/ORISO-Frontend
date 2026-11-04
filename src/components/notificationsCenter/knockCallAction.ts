import type { StartRoomCallOptions } from '../call/startRoomCall';
import type { EventActionTarget } from './eventDescriptors/types';

/** What the counsellor is in right now, as `CallManager.getCurrentCall` tells it. */
export type CurrentCallView = {
	roomId?: string | null;
	signalRoomId?: string | null;
	state?: string;
} | null;

export interface KnockCallDeps {
	/** The conversation call button's own start path (`startRoomCall`). */
	start: (options: StartRoomCallOptions) => Promise<void> | void;
	currentCall: () => CurrentCallView;
}

/**
 * FE#1952 (Frank, 2026-10-30): the person is already waiting, so one click on
 * the knock entry takes the counsellor into the call of that conversation,
 * where the knock notice lets them in.
 *
 * There is no second start path: the call starts exactly as the
 * conversation's call button starts it (`SessionMenu.handleStartVideoCall`,
 * a 1:1 call into the conversation's room). A counsellor already in that
 * conversation's call stays in it. A counsellor in a call elsewhere is never
 * cut off: `false` tells the caller to open the conversation instead.
 *
 * Returns `true` when the counsellor is now in, or on the way into, the call.
 * Call it inside the click handler: `startRoomCall` asks for the camera and
 * microphone first, and mobile browsers only allow that during the gesture.
 */
export const enterKnockCall = (
	target: EventActionTarget,
	{ start, currentCall }: KnockCallDeps
): boolean => {
	if (target.kind !== 'callRoom' || !target.roomId) return false;
	const current = currentCall();
	if (current && current.state !== 'left') {
		return (current.signalRoomId || current.roomId) === target.roomId;
	}
	void start({
		roomId: target.roomId,
		isVideo: target.isVideo,
		isGroup: false
	});
	return true;
};
