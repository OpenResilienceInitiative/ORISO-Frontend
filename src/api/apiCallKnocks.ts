import { endpoints } from '../resources/scripts/endpoints';
import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from './fetchData';
import {
	CallKnock,
	CallKnockScope,
	scopeQuery
} from '../components/call/knockNotice/callKnockModel';

/* Every call names the statuses it expects: without a `responseHandling`
   an unexpected status would send the whole app to the error page. */
const handled = [
	FETCH_SUCCESS.CONTENT,
	FETCH_ERRORS.BAD_REQUEST,
	FETCH_ERRORS.FORBIDDEN,
	FETCH_ERRORS.NO_MATCH,
	FETCH_ERRORS.CONFLICT,
	FETCH_ERRORS.CATCH_ALL
];

const asList = (value: unknown): CallKnock[] =>
	Array.isArray(value) ? value : [];

/** People waiting to join this one call, oldest first (ORISO-UserService#1479). */
export const apiGetPendingCallKnocks = (
	scope: CallKnockScope
): Promise<CallKnock[]> =>
	fetchData({
		url: `${endpoints.callKnocks}?${scopeQuery(scope)}`,
		method: FETCH_METHODS.GET,
		responseHandling: handled
	}).then(asList);

export const apiAdmitCallKnock = (knockId: number): Promise<CallKnock> =>
	fetchData({
		url: `${endpoints.callKnocks}/${knockId}/admit`,
		method: FETCH_METHODS.POST,
		responseHandling: handled
	});

export const apiDeclineCallKnock = (knockId: number): Promise<CallKnock> =>
	fetchData({
		url: `${endpoints.callKnocks}/${knockId}/decline`,
		method: FETCH_METHODS.POST,
		responseHandling: handled
	});

/** Everybody waiting for THIS call — never the counsellor's other conversations. */
export const apiAdmitAllCallKnocks = (
	scope: CallKnockScope
): Promise<CallKnock[]> =>
	fetchData({
		url: `${endpoints.callKnocks}/admit-all?${scopeQuery(scope)}`,
		method: FETCH_METHODS.POST,
		responseHandling: handled
	}).then(asList);
