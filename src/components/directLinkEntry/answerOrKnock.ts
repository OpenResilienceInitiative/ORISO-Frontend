import type { CallData } from '../../services/CallManager';
import { joinOrKnock } from './callMessageKnock';
import type { CallJoinResult, JoinOrKnockDeps } from './callMessageKnock';
import { directLinkSessionIdOfRoom } from './directLinkEntryFlow';

/** What "Annehmen" needs from the call manager. */
export interface RingingCalls {
	getCurrentCall: () => CallData | null;
	answerCall: () => void;
}

/**
 * "Annehmen" on the ringing card, for a conversation that came through an
 * audio or video direct link (P0, 25 Nov 2026).
 *
 * The media server lets an advice seeker into such a call only once the
 * counsellor let them in (KNOCK_NOT_ADMITTED). The card answered regardless:
 * the call window opened and showed "Call access denied" (403). The call
 * message's "Beitreten" already asks first and waits in the lobby; answering
 * takes the same path now, so both buttons end in the same place.
 *
 * Everybody else — a counsellor, or a conversation without a direct link on
 * this device (a group has none) — answers at once, as before.
 */
export const answerOrKnock = (
	call: CallData,
	calls: RingingCalls,
	{
		asker,
		sessionIdOfRoom = directLinkSessionIdOfRoom,
		...deps
	}: JoinOrKnockDeps & {
		sessionIdOfRoom?: typeof directLinkSessionIdOfRoom;
	} = {}
): Promise<CallJoinResult> => {
	/* Still this call, still ringing: admission can take a while. */
	const answer = (): Promise<CallJoinResult> => {
		const current = calls.getCurrentCall();
		if (
			current?.callId !== call.callId ||
			!current.isIncoming ||
			current.state !== 'ringing'
		)
			return Promise.resolve('ended');
		calls.answerCall();
		return Promise.resolve('joined');
	};
	if (!asker) return answer();
	const sessionId = sessionIdOfRoom([
		call.signalRoomId,
		call.roomId,
		call.elementCallRoomId
	]);
	if (sessionId === null) return answer();
	return joinOrKnock(sessionId, answer, { ...deps, asker: true });
};
