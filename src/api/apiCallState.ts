import type { CallLifecycleMessage } from '../utils/callLifecycleMessage';
import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';
import { getMatrixClientService } from '../services/matrixClientRegistry';

const timestamp = (value: unknown): value is number =>
	typeof value === 'number' &&
	Number.isSafeInteger(value) &&
	value >= 0 &&
	value <= 8640000000000000;

export async function apiCallState(
	call: CallLifecycleMessage
): Promise<CallLifecycleMessage | null> {
	let value: unknown;
	try {
		value = await fetchData({
			url: `${endpoints.matrixCallState}?${new URLSearchParams({ sourceRoomId: call.roomRef, callId: call.callId })}`,
			method: FETCH_METHODS.GET,
			responseHandling: [FETCH_ERRORS.NO_MATCH, FETCH_ERRORS.CATCH_ALL]
		});
	} catch (error) {
		/*
		 * A 404 is an ANSWER: the server has no such call, and asking again
		 * will not change that. Everything else — a 5xx, a lost connection —
		 * is the question going unasked, and the callers tell the two apart:
		 * a `null` settles the card, a throw keeps the durable one and tries
		 * again. Without the split, a card the server had never heard of
		 * (one whose record was pruned, or one somebody forged) polled this
		 * endpoint every fifteen seconds for as long as it was on screen.
		 */
		if (error instanceof Error && error.message === FETCH_ERRORS.NO_MATCH) {
			return null;
		}
		throw error;
	}
	if (!value || typeof value !== 'object') return null;
	const data = value as Record<string, unknown>;
	if (
		data.sourceRoomId !== call.roomRef ||
		data.callId !== call.callId ||
		data.callRoomId !== call.callRoomId ||
		data.callType !== call.callType ||
		!timestamp(data.invitedAt) ||
		!timestamp(data.durationSeconds)
	)
		return null;
	if (
		data.state !== 'running' &&
		data.state !== 'ended' &&
		data.state !== 'missed'
	)
		return null;
	if (call.state !== 'running' && data.state === 'running') return null;
	/*
	 * `missed` does not become `ended` on the server's word alone.
	 *
	 * UserService "defines attendance as any observed Matrix membership; it
	 * does not prove two-person media" — this branch's own
	 * `docs/agent-tasks/2026-09-14-calls/README.md`. The caller's membership is
	 * published while the phone is merely ringing, so an unanswered outgoing
	 * call can come back as `ended` with the ringing time as its duration. That
	 * is precisely the distinction `missed` exists to make, and the one
	 * `callLifecycleTracker` was fixed to get right on this side; accepting it
	 * back from the server would re-import the same mistake — and permanently,
	 * because a terminal answer stops the retries.
	 *
	 * So a correction out of `missed` needs the one piece of evidence the
	 * server could only have from somebody else being there: an attendee who
	 * is not the actor. No ids at all is no evidence, and the local answer
	 * stands. A card with no actor recorded accepts any attendance, which is
	 * the same fallback the tracker uses.
	 */
	/*
	 * And `running` does not become `ended` on the server's word alone when
	 * nothing ever started HERE.
	 *
	 * The guard above only fired for a card that had already reached
	 * `missed`, which left the same mistake reachable by another road: an
	 * unanswered call whose terminal edit exhausted its retries — or a reload
	 * before that edit syncs — leaves the card `running`, and the server's
	 * caller-only `ended` was then accepted as an answered call with the
	 * ringing time as its duration. Permanently, because a terminal answer
	 * stops the retries.
	 *
	 * `startedAt` is the evidence, and it is better than the payload's:
	 * `callLifecycleTracker` sets it only when somebody who is NOT the actor
	 * appears in the RTC session. So a `running` card without it means
	 * nobody else ever arrived as far as this client saw, and a server
	 * `ended` with no attendee but the actor is contradicting that on no
	 * evidence at all.
	 *
	 * Only when the card names an actor. Without one, "attendance that is
	 * only the actor" is not a statement anything can check, and the branch's
	 * written contract — "the authenticated UserService state may correct
	 * either provisional terminal card state" — stands.
	 */
	const neverAnsweredHere =
		call.state === 'running' &&
		!call.startedAt &&
		call.actorUserId !== undefined;
	if (
		(call.state === 'missed' && data.state !== 'missed') ||
		(neverAnsweredHere && data.state === 'ended')
	) {
		const attended = Array.isArray(data.participantMatrixIds)
			? data.participantMatrixIds.filter(
					(id): id is string => typeof id === 'string'
				)
			: [];
		if (!attended.some((id) => id !== call.actorUserId)) return null;
	}
	if (data.state === 'missed') {
		if (
			data.startedAt !== null ||
			!timestamp(data.endedAt) ||
			data.endedAt < data.invitedAt ||
			data.durationSeconds !== 0
		)
			return null;
	} else {
		if (!timestamp(data.startedAt) || data.startedAt < data.invitedAt)
			return null;
		if (
			data.state === 'ended' &&
			(!timestamp(data.endedAt) ||
				data.endedAt < data.startedAt ||
				Math.floor((data.endedAt - data.startedAt) / 1000) !==
					data.durationSeconds)
		)
			return null;
		if (data.state === 'running' && data.endedAt !== null) return null;
	}
	let participants = call.participants;
	if (data.participantMatrixIds !== undefined) {
		if (
			!Array.isArray(data.participantMatrixIds) ||
			data.participantMatrixIds.some(
				(id) => typeof id !== 'string' || !id.trim()
			)
		)
			return null;
		const sourceRoom = getMatrixClientService()
			?.getClient()
			?.getRoom(call.roomRef);
		participants = [...new Set<string>(data.participantMatrixIds)].map(
			(userId) => ({
				userId,
				displayName:
					sourceRoom?.getMember(userId)?.name ||
					call.participants.find((member) => member.userId === userId)
						?.displayName ||
					userId
			})
		);
	}
	return {
		...call,
		participants,
		state: data.state,
		invitedAt: new Date(data.invitedAt).toISOString(),
		startedAt: timestamp(data.startedAt)
			? new Date(data.startedAt).toISOString()
			: undefined,
		endedAt: timestamp(data.endedAt)
			? new Date(data.endedAt).toISOString()
			: undefined,
		durationSeconds:
			data.state === 'missed' ? undefined : data.durationSeconds
	};
}
