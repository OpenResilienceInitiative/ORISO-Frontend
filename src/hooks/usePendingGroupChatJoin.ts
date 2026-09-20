import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJoinGroupChat } from './useJoinGroupChat';
import { groupEntryRoomPath } from '../components/groupChat/entryRoom/GroupEntryRoom';
import { isAccountSetupPending } from '../components/twoFactorAuth/accountSetupStep';
import type { UserDataInterface } from '../globalState/interfaces/UserDataInterface';

/**
 * Follow a `?gcid=` group-chat deep link once the session may act on it. The id is read once, at
 * mount, because the router replaces the URL before the tenant arrives. Keep it, wait until the
 * join is allowed, assign, then open the entry room.
 *
 * A hook of its own so the conditions are testable without mounting the authenticated app.
 */
export const usePendingGroupChatJoin = (
	userData: Partial<UserDataInterface> | undefined
): void => {
	const { joinGroupChat, tenantReady } = useJoinGroupChat();
	const navigate = useNavigate();
	const [pendingGroupChatId, setPendingGroupChatId] = useState<string | null>(
		() => new URLSearchParams(window.location.search).get('gcid')
	);

	useEffect(() => {
		if (!pendingGroupChatId || !tenantReady) {
			return;
		}
		/* Joining assigns the account to the chat server-side, so it must wait
		   until the account is the counsellor's own — and until the profile
		   that says so has arrived. `tenantReady` does not imply it: the
		   tenant comes from its own context while `userData` arrives with the
		   bootstrap, so `undefined` is reachable here.
		   `isAccountSetupPending` is deliberately fail-open on an unknown, so
		   a frontend released ahead of its backend cannot lock everyone out.
		   That is the right default for reading a flag and the wrong one for a
		   server-side mutation: it would assign a freshly provisioned account
		   that still holds the administrator's password. Unknown waits.

		   The pending id is kept rather than cleared on every early return:
		   the deep link still has to work once the session may act on it. */
		if (!userData || isAccountSetupPending(userData)) {
			return;
		}
		const gcid = pendingGroupChatId;
		setPendingGroupChatId(null);
		joinGroupChat(gcid)
			.then((assigned) => {
				if (assigned) {
					navigate(groupEntryRoomPath(gcid), { replace: true });
				}
			})
			.catch(() => {
				/* Already assigned (409) or gone — the entry room says so. */
				navigate(groupEntryRoomPath(gcid), { replace: true });
			});
	}, [pendingGroupChatId, tenantReady, joinGroupChat, navigate, userData]);
};
