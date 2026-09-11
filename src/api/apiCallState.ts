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
	const value: unknown = await fetchData({
		url: `${endpoints.matrixCallState}?${new URLSearchParams({ sourceRoomId: call.roomRef, callId: call.callId })}`,
		method: FETCH_METHODS.GET,
		responseHandling: [FETCH_ERRORS.CATCH_ALL]
	});
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
	if (
		call.state !== 'running' &&
		data.state !== call.state &&
		!(call.state === 'missed' && data.state === 'ended')
	)
		return null;
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
