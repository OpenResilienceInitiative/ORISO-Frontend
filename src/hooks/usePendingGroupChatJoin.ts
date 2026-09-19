import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJoinGroupChat } from './useJoinGroupChat';
import { groupEntryRoomPath } from '../components/groupChat/entryRoom/GroupEntryRoom';
import { isAccountSetupPending } from '../components/twoFactorAuth/accountSetupStep';
import type { UserDataInterface } from '../globalState/interfaces/UserDataInterface';

/**
 * Follow a `?gcid=` group-chat deep link once the session may act on it.
 *
 * The id is read once, at mount. It used to be re-read from
 * `window.location` inside an effect that ran again when the tenant arrived —
 * by then the router had already replaced the URL and the id was gone, so the
 * assignment never fired (#974, #1216). Now: keep the id, wait until it is
 * allowed to be used, assign, then open the group's entry room.
 *
 * Lives in a hook of its own so the conditions that release the join are
 * testable without mounting the whole authenticated app.
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
