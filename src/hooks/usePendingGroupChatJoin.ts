import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJoinGroupChat } from './useJoinGroupChat';
import { groupEntryRoomPath } from '../components/groupChat/entryRoom/GroupEntryRoom';
import { parseGroupChatInviteId } from '../components/groupChat/groupChatInviteLink';
import { rememberGroupInviteToken } from '../components/groupChat/groupInviteTokenMemory';
import { isAccountSetupPending } from '../components/twoFactorAuth/accountSetupStep';
import type { UserDataInterface } from '../globalState/interfaces/UserDataInterface';
import {
	AUTHORITIES,
	hasUserAuthority
} from '../globalState/helpers/stateHelpers';
import {
	consultantGroupChatPath,
	isGroupChatId
} from '../components/groupChat/consultantGroupChatPath';

/**
 * Follow a `?gcid=` group-chat deep link once the session may act on it. The id is read once, at
 * mount, because the router replaces the URL before the tenant arrives. Keep it, wait until the
 * join is allowed, assign, then open the entry room. A counsellor is not assigned: she opens the
 * group in her own session view (#1499).
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
		/* `gcid` may carry the invite token as well (#1237); the room is the number. */
		const invite = parseGroupChatInviteId(gcid);
		const entryRoom = groupEntryRoomPath(invite?.seriesId ?? gcid);
		/* #1499: the assignment is a client action (404 for a counsellor) and
		   the entry room is the client's room. Whether she may see the group
		   is decided in the session view, which shows "not part of it" — and,
		   with the link's token, lets her knock (item 14). */
		if (
			hasUserAuthority(
				AUTHORITIES.CONSULTANT_DEFAULT,
				userData as UserDataInterface
			)
		) {
			if (invite && isGroupChatId(invite.seriesId)) {
				if (invite.inviteToken) {
					rememberGroupInviteToken(
						invite.seriesId,
						invite.inviteToken
					);
				}
				navigate(consultantGroupChatPath(invite.seriesId), {
					replace: true
				});
			}
			return;
		}
		joinGroupChat(gcid)
			.then((assigned) => {
				if (assigned) {
					navigate(entryRoom, { replace: true });
				}
			})
			.catch(() => {
				/* Already assigned (409), link refused (403) or gone — the entry room says so. */
				navigate(entryRoom, { replace: true });
			});
	}, [pendingGroupChatId, tenantReady, joinGroupChat, navigate, userData]);
};
