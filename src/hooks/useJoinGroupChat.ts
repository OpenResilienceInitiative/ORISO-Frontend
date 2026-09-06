import { useCallback } from 'react';
import { apiPutGroupChat, GROUP_CHAT_API } from '../api';
import { useTenant } from '../globalState';

export const useJoinGroupChat = () => {
	const tenantData = useTenant();
	/* `null` until the tenant has answered: a caller that reads the flag
	   before that would take "not loaded" for "switched off". */
	const tenantReady = tenantData !== null && tenantData !== undefined;

	const joinGroupChat = useCallback(
		(gcid: string): Promise<boolean> => {
			if (tenantData?.settings?.featureGroupChatV2Enabled && gcid) {
				return apiPutGroupChat(gcid, GROUP_CHAT_API.ASSIGN).then(
					() => true
				);
			}
			return Promise.resolve(false);
		},
		[tenantData]
	);

	return {
		joinGroupChat,
		tenantReady
	};
};
