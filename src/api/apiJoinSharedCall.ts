import { endpoints } from '../resources/scripts/endpoints';
import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from './fetchData';
import type { CallKnockStatus } from './apiDirectLinks';

type CallMedium = 'AUDIO' | 'VIDEO';

export interface SharedCallSeat {
	medium: CallMedium;
	sourceRoomId: string;
	callId: string;
	callRoomId: string;
	guestMatrixUserId: string;
}

export type SharedCallEntry =
	| { callAdmitted: true; seat: SharedCallSeat }
	| { callAdmitted: false; knockId: number; knockStatus: CallKnockStatus };

/** The server reveals a call room only after admission to this link. */
export const apiJoinSharedCall = async (
	token: string
): Promise<SharedCallEntry> => {
	const data: Partial<SharedCallSeat> & {
		callAdmitted?: boolean;
		knockId?: number;
		knockStatus?: CallKnockStatus;
	} = await fetchData({
		url: `${endpoints.matrixCallShareLinks}/${encodeURIComponent(token)}/join`,
		method: FETCH_METHODS.POST,
		responseHandling: [
			FETCH_SUCCESS.CONTENT,
			FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE
		]
	});
	if (data?.callAdmitted === true) {
		const { medium, sourceRoomId, callId, callRoomId, guestMatrixUserId } =
			data;
		if (
			(medium === 'AUDIO' || medium === 'VIDEO') &&
			typeof sourceRoomId === 'string' &&
			sourceRoomId.startsWith('!') &&
			typeof callId === 'string' &&
			callId &&
			typeof callRoomId === 'string' &&
			callRoomId.startsWith('!') &&
			callRoomId !== sourceRoomId &&
			typeof guestMatrixUserId === 'string' &&
			guestMatrixUserId.startsWith('@')
		) {
			return {
				callAdmitted: true,
				seat: {
					medium,
					sourceRoomId,
					callId,
					callRoomId,
					guestMatrixUserId
				}
			};
		}
	}
	if (data?.callAdmitted === false) {
		const { knockId, knockStatus } = data;
		if (
			typeof knockId === 'number' &&
			Number.isSafeInteger(knockId) &&
			knockId > 0 &&
			(knockStatus === 'PENDING' ||
				knockStatus === 'ADMITTED' ||
				knockStatus === 'DECLINED' ||
				knockStatus === 'CANCELLED')
		) {
			return { callAdmitted: false, knockId, knockStatus };
		}
	}
	throw new Error('Invalid shared call response');
};
