import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

// Without responseHandling a failed call sends the whole app to
// error.500.html; the Chat-Info shows its own inline error instead.
const ROLE_CALL_ERRORS = [
	FETCH_ERRORS.FORBIDDEN,
	FETCH_ERRORS.NO_MATCH,
	FETCH_ERRORS.CONFLICT,
	FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED
];

export type GroupChatParticipantRole = 'OWNER' | 'CO_MODERATOR' | 'PARTICIPANT';

export const apiChangeGroupChatParticipantRole = (
	seriesId: number,
	consultantId: string,
	role: GroupChatParticipantRole
): Promise<void> =>
	fetchData({
		url: `${endpoints.chatSeriesBase}${seriesId}/participants/${encodeURIComponent(
			consultantId
		)}/role`,
		method: FETCH_METHODS.PUT,
		bodyData: JSON.stringify({ role }),
		responseHandling: ROLE_CALL_ERRORS
	});

export const apiTransferGroupChatOwnership = (
	seriesId: number,
	consultantId: string
): Promise<void> =>
	fetchData({
		url: `${endpoints.chatSeriesBase}${seriesId}/transfer-ownership`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ consultantId }),
		responseHandling: ROLE_CALL_ERRORS
	});

export const apiRemoveGroupChatParticipant = (
	seriesId: number,
	consultantId: string
): Promise<void> =>
	fetchData({
		url: `${endpoints.chatSeriesBase}${seriesId}/participants/${encodeURIComponent(
			consultantId
		)}`,
		method: FETCH_METHODS.DELETE,
		responseHandling: ROLE_CALL_ERRORS
	});
