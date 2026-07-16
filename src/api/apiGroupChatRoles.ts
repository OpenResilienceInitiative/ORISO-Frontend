import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

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
		bodyData: JSON.stringify({ role })
	});

export const apiTransferGroupChatOwnership = (
	seriesId: number,
	consultantId: string
): Promise<void> =>
	fetchData({
		url: `${endpoints.chatSeriesBase}${seriesId}/transfer-ownership`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify({ consultantId })
	});

export const apiRemoveGroupChatParticipant = (
	seriesId: number,
	consultantId: string
): Promise<void> =>
	fetchData({
		url: `${endpoints.chatSeriesBase}${seriesId}/participants/${encodeURIComponent(
			consultantId
		)}`,
		method: FETCH_METHODS.DELETE
	});
