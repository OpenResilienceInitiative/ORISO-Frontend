import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_SUCCESS } from './fetchData';

export interface GroupChatAuthorTranslationRequest {
	sourceLang: string;
	targetLangs: string[];
	texts: Record<string, string>;
}

export interface GroupChatAuthorTranslationResponse {
	translations: Record<string, Record<string, string>>;
	provider?: string;
	model?: string;
}

export const apiTranslateGroupChatAuthorContent = async (
	request: GroupChatAuthorTranslationRequest
): Promise<GroupChatAuthorTranslationResponse> =>
	fetchData({
		url: `${endpoints.tenantServiceBase}/translate/group-chat-author-content`,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(request),
		responseHandling: [FETCH_SUCCESS.CONTENT]
	});
