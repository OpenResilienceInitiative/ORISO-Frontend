import { useCallback } from 'react';
import { apiPutGroupChat, GROUP_CHAT_API } from '../api';
import { useTenant } from '../globalState';
import { parseGroupChatInviteId } from '../components/groupChat/groupChatInviteLink';

export const useJoinGroupChat = () => {
	const tenantData = useTenant();
	/* `null` until the tenant has answered: a caller that reads the flag
	   before that would take "not loaded" for "switched off". */
	const tenantReady = tenantData !== null && tenantData !== undefined;

	const joinGroupChat = useCallback(
		(gcid: string): Promise<boolean> => {
			const invite = parseGroupChatInviteId(gcid);
			if (tenantData?.settings?.featureGroupChatV2Enabled && invite) {
				const assign = invite.inviteToken
					? apiPutGroupChat(invite.seriesId, GROUP_CHAT_API.ASSIGN, {
							inviteToken: invite.inviteToken
						})
					: apiPutGroupChat(invite.seriesId, GROUP_CHAT_API.ASSIGN);
				return assign.then(() => true);
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
