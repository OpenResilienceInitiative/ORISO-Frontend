import { useCallback } from 'react';
import { apiPutGroupChat, GROUP_CHAT_API } from '../api';
import { apiGetChatRoomById } from '../api/apiGetChatRoomById';
import { useTenant } from '../globalState';

export const useJoinGroupChat = () => {
	const tenantData = useTenant();

	const joinGroupChat = useCallback(
		(gcid?: string | null, chatId?: number | null) => {
			if (!tenantData?.settings?.featureGroupChatV2Enabled) {
				return;
			}

			if (gcid) {
				apiPutGroupChat(gcid, GROUP_CHAT_API.ASSIGN).catch(() => {});
				return;
			}

			if (chatId != null) {
				apiGetChatRoomById(chatId)
					.then((chatRoom) => {
						const firstSession = chatRoom?.sessions?.[0];
						const resolvedGroupId =
							firstSession?.chat?.groupId ??
							firstSession?.session?.groupId;
						if (resolvedGroupId) {
							return apiPutGroupChat(
								String(resolvedGroupId),
								GROUP_CHAT_API.ASSIGN
							);
						}
						return undefined;
					})
					.catch(() => {});
			}
		},
		[tenantData]
	);

	return {
		joinGroupChat
	};
};
