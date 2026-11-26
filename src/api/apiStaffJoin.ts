import { endpoints } from '../resources/scripts/endpoints';
import type { SharedCallSeat } from './apiJoinSharedCall';
import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from './fetchData';

/**
 * ORISO-Frontend#2356: a signed-in counsellor who holds a Direkteinladung's
 * link joins its call only, with their own account (UserService
 * `POST /users/invitelinks/{token}/staff-join`). Repeating the request is
 * the poll.
 */
export type StaffJoin =
	/** Already in the conversation: open it. */
	| { outcome: 'MEMBER'; sessionId: number }
	/** Knocked; the conversation's counsellor decides. */
	| { outcome: 'WAITING'; knockId: number }
	/** Let in: the call room only, never the conversation. */
	| { outcome: 'SEATED'; seat: SharedCallSeat }
	/** No call runs yet (or nobody of the Träger is in it). */
	| { outcome: 'CALL_NOT_RUNNING' }
	/** Declined for this call, or the waiting ran out. */
	| { outcome: 'REFUSED' }
	/** A link without an appointment: there is no shared call. */
	| { outcome: 'NO_SHARED_CALL' };

const staffJoinUrl = (token: string) =>
	`${endpoints.inviteLinksBase}${encodeURIComponent(token)}/staff-join`;

const positiveId = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** Strict: a room or id the server did not clearly send is never used. */
export const parseStaffJoin = (data: unknown): StaffJoin => {
	const body = (data ?? {}) as Record<string, unknown>;
	switch (body.outcome) {
		case 'MEMBER':
			if (positiveId(body.sessionId))
				return { outcome: 'MEMBER', sessionId: body.sessionId };
			break;
		case 'WAITING':
			if (positiveId(body.knockId))
				return { outcome: 'WAITING', knockId: body.knockId };
			break;
		case 'SEATED': {
			const {
				medium,
				sourceRoomId,
				callId,
				callRoomId,
				guestMatrixUserId
			} = body;
			if (
				(medium === 'AUDIO' || medium === 'VIDEO') &&
				typeof sourceRoomId === 'string' &&
				sourceRoomId.startsWith('!') &&
				typeof callId === 'string' &&
				callId !== '' &&
				typeof callRoomId === 'string' &&
				callRoomId.startsWith('!') &&
				callRoomId !== sourceRoomId &&
				typeof guestMatrixUserId === 'string' &&
				guestMatrixUserId.startsWith('@')
			)
				return {
					outcome: 'SEATED',
					seat: {
						medium,
						sourceRoomId,
						callId,
						callRoomId,
						guestMatrixUserId
					}
				};
			break;
		}
		case 'CALL_NOT_RUNNING':
		case 'REFUSED':
		case 'NO_SHARED_CALL':
			return { outcome: body.outcome };
	}
	throw new Error('Unexpected staff join answer');
};

/**
 * One visit. `waitingFor` is the knock the page waits on, so a knock that
 * ran out reads as REFUSED instead of ringing again.
 */
export const apiStaffJoin = async (
	token: string,
	waitingFor?: number
): Promise<StaffJoin> => {
	const query = waitingFor ? `?waitingFor=${waitingFor}` : '';
	const data = await fetchData({
		url: `${staffJoinUrl(token)}${query}`,
		method: FETCH_METHODS.POST,
		responseHandling: [
			FETCH_SUCCESS.CONTENT,
			FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE
		]
	});
	return parseStaffJoin(data);
};

/** Left the waiting page: the open knock through this link stops ringing. */
export const apiLeaveStaffJoin = async (token: string): Promise<void> => {
	await fetchData({
		url: staffJoinUrl(token),
		method: FETCH_METHODS.DELETE,
		responseHandling: [FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE]
	});
};
