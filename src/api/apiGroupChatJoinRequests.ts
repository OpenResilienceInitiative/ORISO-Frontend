import { endpoints } from '../resources/scripts/endpoints';
import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from './fetchData';
import type {
	GroupChatJoinAdmitRole,
	GroupChatJoinRequest,
	GroupChatJoinRequestOwnStatus
} from '../components/groupChat/joinRequest/joinRequestModel';

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

const base = (seriesId: number) =>
	`${endpoints.chatSeriesBase}${seriesId}/join-requests`;

/** A 204 comes back from `fetchData` as `{}`. */
const orNull = <T extends { id?: number }>(value: T): T | null =>
	value && typeof value.id === 'number' ? value : null;

/** `inviteToken` is the secret part of the invite link (ORISO-UserService#1248). */
export const apiKnockOnGroupChat = (
	seriesId: number,
	inviteToken: string
): Promise<GroupChatJoinRequestOwnStatus> =>
	fetchData({
		url: `${base(seriesId)}?inviteToken=${encodeURIComponent(inviteToken)}`,
		method: FETCH_METHODS.POST,
		responseHandling: handled
	});

export const apiGetOwnGroupChatJoinRequest = (
	seriesId: number
): Promise<GroupChatJoinRequestOwnStatus | null> =>
	fetchData({
		url: `${base(seriesId)}/mine`,
		method: FETCH_METHODS.GET,
		responseHandling: handled
	}).then(orNull);

export const apiCancelOwnGroupChatJoinRequest = (
	seriesId: number
): Promise<void> =>
	fetchData({
		url: `${base(seriesId)}/mine`,
		method: FETCH_METHODS.DELETE,
		responseHandling: handled
	}).then(() => undefined);

export const apiGetPendingGroupChatJoinRequests = (): Promise<
	GroupChatJoinRequest[]
> =>
	fetchData({
		url: `${endpoints.chatSeriesBase}join-requests`,
		method: FETCH_METHODS.GET,
		responseHandling: handled
	}).then((list) => (Array.isArray(list) ? list : []));

export const apiAdmitGroupChatJoinRequest = (
	seriesId: number,
	requestId: number,
	role: GroupChatJoinAdmitRole
): Promise<void> =>
	fetchData({
		url: `${base(seriesId)}/${requestId}/admit`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ role }),
		responseHandling: handled
	}).then(() => undefined);

export const apiDeclineGroupChatJoinRequest = (
	seriesId: number,
	requestId: number
): Promise<void> =>
	fetchData({
		url: `${base(seriesId)}/${requestId}/decline`,
		method: FETCH_METHODS.POST,
		responseHandling: handled
	}).then(() => undefined);
