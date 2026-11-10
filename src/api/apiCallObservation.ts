import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/*
 * Observation-only registration of an encrypted internal-group call
 * (ORISO-Frontend#2166, ORISO-UserService#1624). The server cannot read the
 * encrypted invitation, so the creator tells it the call exists. This never
 * grants access to anything; every failure is ignored by the callers because
 * the call itself must not depend on it.
 */
const handling = [
	FETCH_ERRORS.BAD_REQUEST,
	FETCH_ERRORS.FORBIDDEN,
	FETCH_ERRORS.NO_MATCH,
	FETCH_ERRORS.CATCH_ALL
];

export const apiRegisterCallObservation = (call: {
	sourceRoomId: string;
	callId: string;
	callRoomId: string;
	video: boolean;
}): Promise<unknown> =>
	fetchData({
		url: endpoints.matrixCallObservations,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(call),
		responseHandling: handling
	});

export const apiEndCallObservation = (call: {
	sourceRoomId: string;
	callId: string;
}): Promise<unknown> =>
	fetchData({
		url: `${endpoints.matrixCallObservations}/end`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(call),
		responseHandling: handling
	});
