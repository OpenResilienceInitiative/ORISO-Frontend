import * as React from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loading } from '../app/Loading';
import {
	SessionTypeContext,
	UserDataContext,
	ActiveSessionProvider,
	AUTHORITIES,
	hasUserAuthority
} from '../../globalState';
import {
	desktopView,
	mobileDetailView,
	mobileListView
} from '../app/navigationHandler';
import { apiGetAgencyById, apiGetGroupChatInfo } from '../../api';
import { SESSION_LIST_TAB, SESSION_LIST_TYPES } from './sessionHelpers';
import { JoinGroupChatView } from '../groupChat/JoinGroupChatView';
import { decodeUsername } from '../../utils/encryptionHelpers';
import { useResponsive } from '../../hooks/useResponsive';
import './session.styles';
import { useSearchParam } from '../../hooks/useSearchParams';
import { useSession } from '../../hooks/useSession';
import { SessionStream } from './SessionStream';
import { useSetAtom } from 'jotai';
import { agencyLogoAtom } from '../../store/agencyLogoAtom';
import { shouldShowGroupChatJoinView } from '../groupChat/groupChatHelpers';
import { rememberLastOpenSession } from '../../utils/lastOpenSession';
import { useGroupChatAccess } from '../groupChat/useGroupChatAccess';
import { GroupChatNotMember } from '../groupChat/GroupChatNotMember';

export const SessionView = () => {
	const { groupId: groupIdFromParam, sessionId: sessionIdFromParam } =
		useParams<{ groupId: string; sessionId: string }>();
	const navigate = useNavigate();
	const { pathname } = useLocation();

	const { type, path: listPath } = useContext(SessionTypeContext);
	const { userData } = useContext(UserDataContext);

	const [loading, setLoading] = useState(true);
	const [readonly, setReadonly] = useState(true);
	const [forceBannedOverlay, setForceBannedOverlay] = useState(false);
	const [bannedUsers, setBannedUsers] = useState<string[]>([]);
	const setAgencyLogo = useSetAtom(agencyLogoAtom);

	const {
		session: activeSession,
		ready: activeSessionReady,
		reload: reloadActiveSession,
		read: readActiveSession
	} = useSession(
		groupIdFromParam,
		sessionIdFromParam ? parseInt(sessionIdFromParam) : undefined
	);

	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');

	// #1499: a counsellor can reach a group she is not part of through its
	// invite link; the server refuses her the group, the room list does not.
	const groupAccess = useGroupChatAccess({
		chatId: activeSession?.item?.id,
		isGroup: Boolean(activeSession?.isGroup),
		subscribed: activeSession?.item?.subscribed,
		isConsultant: hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
	});

	// #1193 Job 3: remember the session the counsellor is looking at so the next
	// sign-in resumes it. The helper only accepts consultant session routes.
	useEffect(() => {
		if (activeSessionReady && activeSession && groupAccess === 'member') {
			rememberLastOpenSession(userData?.userId, pathname);
		}
	}, [
		activeSessionReady,
		activeSession,
		groupAccess,
		pathname,
		userData?.userId
	]);

	const { fromL } = useResponsive();
	useEffect(() => {
		if (!fromL) {
			mobileDetailView();
			return () => {
				mobileListView();
			};
		}
		desktopView();
	}, [fromL]);

	const checkMutedUserForThisSession = useCallback(() => {
		setForceBannedOverlay(false);
		if (!activeSession?.isGroup) {
			return;
		}

		apiGetGroupChatInfo(activeSession.item.id)
			.then((response) => {
				if (response.bannedUsers) {
					const decodedBannedUsers =
						response.bannedUsers.map(decodeUsername);
					setBannedUsers(decodedBannedUsers);
					if (decodedBannedUsers.includes(userData.userName)) {
						setForceBannedOverlay(true);
					}
				} else {
					setBannedUsers([]);
				}
			})
			.catch(() => {
				setBannedUsers([]);
			});
	}, [activeSession, userData.userName]);

	useEffect(() => {
		checkMutedUserForThisSession();

		return () => {
			setBannedUsers([]);
		};
	}, [checkMutedUserForThisSession]);

	useEffect(() => {
		if (activeSessionReady && !activeSession) {
			navigate(
				listPath +
					(sessionListTab ? `?sessionListTab=${sessionListTab}` : ''),
				{ replace: true }
			);
			return;
		} else if (activeSessionReady) {
			if (type !== SESSION_LIST_TYPES.ENQUIRY) {
				setReadonly(false);
			}

			setLoading(false);
		}

		return () => {
			setReadonly(true);
			setLoading(true);
		};
	}, [
		activeSessionReady,
		activeSession,
		sessionListTab,
		type,
		listPath,
		navigate
	]);

	useEffect(() => {
		let isCanceled = false;
		const agencyId = activeSession?.item?.agencyId;
		if (!agencyId) return;

		(async () => {
			try {
				const agency = await apiGetAgencyById(agencyId);
				if (agency?.agencyLogo && !isCanceled) {
					setAgencyLogo(agency.agencyLogo);
				}
			} catch {
				// Logo fetch is cosmetic; never break the session view.
			}
		})();

		return () => {
			isCanceled = true;
			setAgencyLogo('');
		};
	}, [activeSession?.item?.agencyId, setAgencyLogo]);

	if (loading || !activeSession || groupAccess === 'checking') {
		return <Loading />;
	}

	if (groupAccess === 'notMember') {
		return (
			<GroupChatNotMember
				onBack={() =>
					navigate(
						listPath +
							(sessionListTab
								? `?sessionListTab=${sessionListTab}`
								: ''),
						{ replace: true }
					)
				}
			/>
		);
	}

	if (
		shouldShowGroupChatJoinView({
			isGroup: activeSession.isGroup,
			active: activeSession.item.active,
			subscribed: activeSession.item.subscribed,
			isBanned: bannedUsers.includes(userData.userName)
		})
	) {
		return (
			<ActiveSessionProvider
				activeSession={activeSession}
				reloadActiveSession={reloadActiveSession}
			>
				<JoinGroupChatView
					forceBannedOverlay={forceBannedOverlay}
					bannedUsers={bannedUsers}
				/>
			</ActiveSessionProvider>
		);
	}

	return (
		<ActiveSessionProvider
			activeSession={activeSession}
			readActiveSession={readActiveSession}
			reloadActiveSession={reloadActiveSession}
		>
			<SessionStream
				readonly={readonly}
				checkMutedUserForThisSession={checkMutedUserForThisSession}
				bannedUsers={bannedUsers}
			/>
		</ActiveSessionProvider>
	);
};
