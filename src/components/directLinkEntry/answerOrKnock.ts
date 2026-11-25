import type { CallData } from '../../services/CallManager';
import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';
import { joinOrKnock } from './callMessageKnock';
import type { CallJoinResult, JoinOrKnockDeps } from './callMessageKnock';
import { directLinkSessionIdOfRoom } from './directLinkEntryFlow';

/** What "Annehmen" needs from the call manager. */
export interface RingingCalls {
	getCurrentCall: () => CallData | null;
	answerCall: () => void;
	/** Joins the call if the server confirms it still runs. */
	joinExistingCall?: (
		call: CallLifecycleMessage,
		isGroup: boolean
	) => Promise<CallJoinResult>;
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
	/*
	 * Let in after the ringing stopped: the invitation rings for a limited
	 * time, the counsellor may take longer to answer the knock. The call is
	 * still there, so the person joins it; the server confirms that it is
	 * this very call and still running, so a later call is never joined by
	 * an old "Annehmen".
	 */
	const answerOrJoinRunning = async (): Promise<CallJoinResult> => {
		const answered = await answer();
		if (answered !== 'ended') return answered;
		const sourceRoom = call.signalRoomId;
		if (!calls.joinExistingCall || !sourceRoom) return 'ended';
		return calls.joinExistingCall(
			{
				callId: call.callId,
				roomRef: sourceRoom,
				callRoomId: call.roomId,
				state: 'running',
				callType: call.isVideo ? 'video' : 'audio',
				participants: []
			},
			Boolean(call.isGroup)
		);
	};
	if (!asker) return answer();
	const sessionId = sessionIdOfRoom([
		call.signalRoomId,
		call.roomId,
		call.elementCallRoomId
	]);
	if (sessionId === null) return answer();
	return joinOrKnock(sessionId, answerOrJoinRunning, {
		...deps,
		asker: true
	});
};
