import * as React from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { Loading } from '../app/Loading';
import {
	RocketChatContext,
	SessionTypeContext,
	UserDataContext,
	ActiveSessionProvider
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
import useUpdatingRef from '../../hooks/useUpdatingRef';
import { useSearchParam } from '../../hooks/useSearchParams';
import { useSession } from '../../hooks/useSession';
import { SessionStream } from './SessionStream';
import { useSetAtom } from 'jotai';
import { agencyLogoAtom } from '../../store/agencyLogoAtom';

export const SessionView = () => {
	const { rcGroupId: groupIdFromParam, sessionId: sessionIdFromParam } =
		useParams<{ rcGroupId: string; sessionId: string }>();
	const history = useHistory();

	console.log('🔥 SessionView MOUNTED:', {
		groupIdFromParam,
		sessionIdFromParam
	});

	const currentGroupId = useUpdatingRef(groupIdFromParam);
	const currentSessionId = useUpdatingRef(sessionIdFromParam);

	const { type, path: listPath } = useContext(SessionTypeContext);
	const { userData } = useContext(UserDataContext);
	const { ready: rcReady } = useContext(RocketChatContext);

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
	} = useSession(groupIdFromParam, sessionIdFromParam ? parseInt(sessionIdFromParam) : undefined);

	console.log('🔥 SessionView STATE:', {
		loading,
		rcReady,
		activeSessionReady,
		hasActiveSession: !!activeSession,
		sessionId: activeSession?.item?.id
	});

	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');

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
		// MATRIX MIGRATION: Don't wait for RocketChat to be ready
		console.log('🔥 SessionView useEffect:', {
			activeSessionReady,
			hasActiveSession: !!activeSession,
			sessionId: activeSession?.item?.id
		});

		if (activeSessionReady && !activeSession) {
			console.log('🔥 No active session - redirecting to list');
			history.push(
				listPath +
					(sessionListTab ? `?sessionListTab=${sessionListTab}` : '')
			);
			return;
		} else if (activeSessionReady) {
			console.log('🔥 Active session ready - setting loading false');
			
			// MATRIX MIGRATION: Skip RocketChat-specific redirect
			// if (
			// 	activeSession.rid !== currentGroupId.current &&
			// 	activeSession.item.id.toString() === currentSessionId.current
			// ) {
			// 	history.push(
			// 		`${listPath}/${activeSession.rid}/${activeSession.item.id}${
			// 			sessionListTab
			// 				? `?sessionListTab=${sessionListTab}`
			// 				: ''
			// 		}`
			// 	);
			// 	return;
			// }

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
		// bannedUsers, // REMOVED: This was causing infinite re-renders
		currentSessionId,
		currentGroupId,
		listPath,
		history
	]);

	useEffect(() => {
		let isCanceled = false;
		const agencyId = activeSession?.item?.agencyId;
		if (!agencyId) return;

		(async () => {
			// TODO: move this to global jotai atom family
			const agency = await apiGetAgencyById(agencyId);

			if (agency?.agencyLogo && !isCanceled) {
				setAgencyLogo(agency.agencyLogo);
			}
		})();

		return () => {
			isCanceled = true;
			setAgencyLogo('');
		};
	}, [activeSession?.item?.agencyId, setAgencyLogo]);

	console.log('🔥 SessionView RENDER CHECK:', {
		loading,
		hasActiveSession: !!activeSession,
		willShowLoading: loading || !activeSession
	});

	if (loading || !activeSession) {
		console.log('🔥 Showing loading spinner');
		return <Loading />;
	}

	console.log('🔥 SessionView RENDERING SESSION:', {
		sessionId: activeSession.item.id,
		isGroup: activeSession.isGroup
	});

	if (
		activeSession.isGroup &&
		(!activeSession.item.subscribed ||
			bannedUsers.includes(userData.userName))
	) {
		console.log('🔥 Showing JoinGroupChatView');
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

	console.log('🔥 Rendering SessionStream!');

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
