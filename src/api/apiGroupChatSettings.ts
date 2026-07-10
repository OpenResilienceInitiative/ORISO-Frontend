import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS, FETCH_SUCCESS } from './fetchData';
import { GROUP_CHAT_API } from './apiPutGroupChat';

export interface groupChatSettings {
	topic: string;
	startDate: string;
	startTime: string;
	duration: number;
	agencyId: number;
	hintMessage: string;
	sourceLanguage?: string;
	hintMessageTranslations?: Record<string, string>;
	groupChatRulesTranslations?: Record<string, string[]>;
	repetitive: boolean;
	repeatCount?: number;
	chatInterval?:
		| 'DAILY'
		| 'WEEKLY'
		| 'BIWEEKLY'
		| 'MONTHLY'
		| 'QUARTERLY'
		| 'YEARLY';
	modality?: 'TEXT' | 'AUDIO' | 'VIDEO';
	timezone?: string;
	consultantIds?: string[];
	featureGroupChatV2Enabled?: boolean;
}

export interface chatLinkData {
	groupId: string;
}

const groupChatPayload = ({
	featureGroupChatV2Enabled: _clientRoutingFlag,
	...payload
}: groupChatSettings) => payload;

export const apiCreateGroupChat = async (
	createChatItem: groupChatSettings
): Promise<chatLinkData> => {
	let url =
		endpoints.groupChatBase +
		(createChatItem.featureGroupChatV2Enabled
			? GROUP_CHAT_API.CREATEV2
			: GROUP_CHAT_API.CREATE);
	const chatData = JSON.stringify(groupChatPayload(createChatItem));

	return fetchData({
		url: url,
		method: FETCH_METHODS.POST,
		bodyData: chatData,
		responseHandling: [FETCH_SUCCESS.CONTENT]
	});
};

export const apiUpdateGroupChat = async (
	groupChatId: number,
	createChatItem: groupChatSettings
): Promise<chatLinkData> => {
	const url = endpoints.groupChatBase + groupChatId + GROUP_CHAT_API.UPDATE;
	const chatData = JSON.stringify(groupChatPayload(createChatItem));

	return fetchData({
		url: url,
		method: FETCH_METHODS.PUT,
		bodyData: chatData,
		responseHandling: [FETCH_SUCCESS.CONTENT]
	});
};
