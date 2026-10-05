import {
	createElement,
	Fragment,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NotificationsContext, useTenant } from '../globalState';
import { getCounsellingDpaNotification } from '../utils/counsellingDpaNotification';
import { Button, BUTTON_TYPES } from '../components/button/Button';
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

const AssignmentRetry = ({ retry }: { retry: () => Promise<void> }) => {
	const { t } = useTranslation();
	const [busy, setBusy] = useState(false);
	return createElement(Button, {
		item: {
			label: t('groupChat.loadError.retry'),
			type: BUTTON_TYPES.LINK_INLINE
		},
		disabled: busy,
		buttonHandle: () => {
			setBusy(true);
			void retry().finally(() => setBusy(false));
		}
	});
};

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
	const { t } = useTranslation();
	const notifications = useContext(NotificationsContext);
	const tenant = useTenant();
	const notificationsRef = useRef(notifications);
	notificationsRef.current = notifications;
	const scopeKey = JSON.stringify([
		tenant?.id,
		tenant?.settings?.featureGroupChatV2Enabled,
		userData?.userId,
		userData?.grantedAuthorities,
		isAccountSetupPending(userData)
	]);
	const currentScope = useRef({ key: scopeKey });
	if (currentScope.current.key !== scopeKey)
		currentScope.current = { key: scopeKey };
	const scope = currentScope.current;
	const mounted = useRef(false);
	const inFlight = useRef<typeof scope | null>(null);
	const noticeId = useRef<string | number>(undefined);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	useEffect(
		() => () => {
			if (noticeId.current) {
				notificationsRef.current?.removeNotification(
					noticeId.current,
					'error'
				);
				noticeId.current = undefined;
			}
		},
		[scope]
	);
	const assign = useCallback(
		async (gcid: string, operationScope: typeof scope): Promise<void> => {
			const isCurrent = () =>
				mounted.current && currentScope.current === operationScope;
			if (!isCurrent() || inFlight.current === operationScope) return;
			inFlight.current = operationScope;
			// Retire this operation's previous notice before the next HTTP result.
			// The provider's add/remove callbacks capture their current list, so
			// removing and adding together after settlement can restore an old notice.
			if (noticeId.current) {
				notificationsRef.current?.removeNotification(
					noticeId.current,
					'error'
				);
				noticeId.current = undefined;
			}
			const invite = parseGroupChatInviteId(gcid);
			const entryRoom = groupEntryRoomPath(invite?.seriesId ?? gcid);
			try {
				const assigned = await joinGroupChat(gcid);
				if (assigned && isCurrent()) {
					if (noticeId.current)
						notificationsRef.current?.removeNotification(
							noticeId.current,
							'error'
						);
					noticeId.current = undefined;
					navigate(entryRoom, { replace: true });
				}
			} catch (error) {
				if (!isCurrent()) return;
				const notice = getCounsellingDpaNotification(error, t);
				if (notice && notificationsRef.current) {
					noticeId.current = `group-assignment:${notice.id}`;
					notificationsRef.current.addNotification({
						...notice,
						id: noticeId.current,
						text: createElement(
							Fragment,
							null,
							notice.text,
							createElement(AssignmentRetry, {
								retry: () => assign(gcid, operationScope)
							})
						)
					});
					return;
				}
				/* Ordinary conflicts/refusals keep the existing entry-room explanation. */
				navigate(entryRoom, { replace: true });
			} finally {
				if (inFlight.current === operationScope)
					inFlight.current = null;
			}
		},
		[joinGroupChat, navigate, t]
	);
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
		const seriesId = invite?.seriesId;
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
			if (isGroupChatId(seriesId)) {
				if (invite?.inviteToken) {
					rememberGroupInviteToken(seriesId, invite.inviteToken);
				}
				navigate(consultantGroupChatPath(seriesId), { replace: true });
			}
			return;
		}
		void assign(gcid, scope);
	}, [pendingGroupChatId, tenantReady, navigate, userData, assign, scope]);
};
