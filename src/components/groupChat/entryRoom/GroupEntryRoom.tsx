import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
	apiGetAskerSessionList,
	apiGetGroupChatInfo,
	apiPutGroupChat,
	GROUP_CHAT_API
} from '../../../api';
import { apiGetChatRoomById } from '../../../api/apiGetChatRoomById';
import {
	buildExtendedSession,
	ExtendedSessionInterface
} from '../../../globalState';
import { getGroupChatPlannedStart } from '../groupChatDate';
import { useGroupChatAuthorContent } from '../useGroupChatAuthorContent';
import { getSessionNavigationPath } from '../../sessionsListItem/sessionsListItemHelpers';
import { GroupWaitingRoom } from './GroupWaitingRoom';
import { translateWithFallback } from '../../../utils/translationFallback';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';

const POLL_MS = 5000;
export const GROUP_ENTRY_ROOM_PATH = '/groups/:chatId/entry';
export const groupEntryRoomPath = (chatId: string | number) =>
	`/groups/${encodeURIComponent(String(chatId))}/entry`;

/**
 * The room between "I followed the group's link" and "I am in the group".
 *
 * A plain route without the app shell: someone who came through a link and
 * has no other conversation should not land in a session list with menus
 * and a calendar export — the stage they registered on is where they wait.
 * `AuthenticatedApp` sends them here right after the assignment; the
 * session list can also open it for a group that has not started.
 *
 * Feeds `GroupWaitingRoom` from the chat (`/service/users/chat/{id}` via
 * `useSession`), polls the group's state every 5 s the way
 * `JoinGroupChatView` does, joins on "Beitreten" and hands over to the
 * chat's own route.
 */
export const GroupEntryRoom = () => {
	const { chatId: chatIdParam } = useParams<{ chatId: string }>();
	const chatId = Number(chatIdParam);
	const navigate = useNavigate();
	const { t } = useTranslation();
	const tr = useCallback(
		(key: string, fallback: string) =>
			translateWithFallback(t, `groupChat.entry.${key}`, fallback),
		[t]
	);
	const { session, ready, reload } = useGroupChatSession(chatId);
	const [joinBusy, setJoinBusy] = useState(false);
	const [joinFailed, setJoinFailed] = useState(false);

	const item = session?.item;
	const active = Boolean(item?.active);

	useEffect(() => {
		if (!item?.id) {
			return;
		}
		let cancelled = false;
		const tick = () =>
			apiGetGroupChatInfo(item.id)
				.then((info) => {
					if (!cancelled && info.active !== item.active) {
						reload();
					}
				})
				.catch(() => undefined);
		const timer = window.setInterval(tick, POLL_MS);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [item?.id, item?.active, reload]);

	const authorContent = useGroupChatAuthorContent({
		consultingType: item?.consultingType,
		sourceLanguage: item?.sourceLanguage,
		hintMessage: item?.hintMessage,
		hintMessageTranslations: item?.hintMessageTranslations,
		groupChatRulesTranslations: item?.groupChatRulesTranslations
	});

	const plannedStart = useMemo(
		() => (item ? getGroupChatPlannedStart(item) : null),
		[item]
	);

	const handleJoin = useCallback(() => {
		if (!item?.id || joinBusy) {
			return;
		}
		setJoinBusy(true);
		setJoinFailed(false);
		apiPutGroupChat(item.id, GROUP_CHAT_API.JOIN)
			.then(() => {
				navigate(
					getSessionNavigationPath({
						listPath: '/sessions/user/view',
						sessionId: item.id,
						groupId: item.matrixRoomId,
						rid: session.rid,
						isGroup: true,
						isAsker: true,
						isEmptyEnquiry: false,
						tabSuffix: ''
					}),
					{ replace: true }
				);
			})
			.catch(() => {
				setJoinFailed(true);
				setJoinBusy(false);
			});
	}, [item, joinBusy, navigate, session?.rid]);

	if (!ready) {
		return (
			<Box
				sx={{
					minHeight: '100vh',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center'
				}}
				data-cy="group-entry-loading"
			>
				<CircularProgress />
			</Box>
		);
	}

	if (!item) {
		return (
			<Box
				sx={{
					minHeight: '100vh',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					px: 3,
					textAlign: 'center'
				}}
				data-cy="group-entry-missing"
			>
				<Typography sx={{ color: registrationMd3.onSurfaceVariant }}>
					{tr(
						'missing',
						'Diese Gruppe gibt es nicht mehr oder Sie haben keinen Zugang.'
					)}
				</Typography>
			</Box>
		);
	}

	const topicName =
		typeof item.topic === 'string' ? item.topic : item.topic?.name;
	const agencyName = item.assignedAgencies?.[0]?.name;

	return (
		<>
			<GroupWaitingRoom
				topicName={topicName}
				agencyName={agencyName}
				plannedStart={plannedStart}
				durationMinutes={item.duration}
				eventId={item.id}
				welcomeText={authorContent.hintMessage || undefined}
				rules={authorContent.rules}
				active={active}
				onJoin={handleJoin}
				joinBusy={joinBusy}
			/>
			{joinFailed && (
				<Typography
					role="alert"
					sx={{
						position: 'fixed',
						left: 0,
						right: 0,
						bottom: 104,
						textAlign: 'center',
						color: 'error.main',
						zIndex: 66
					}}
				>
					{t(
						'groupChat.joinError.overlay.headline',
						'Der Beitritt hat nicht geklappt.'
					)}
				</Typography>
			)}
		</>
	);
};

/**
 * The chat as the asker's own session list carries it. That list is what
 * the app renders everywhere else, and it is answered for a member who
 * was only assigned so far; `/users/chat/room/{id}` is tried second — on
 * predev it answered 500 for exactly that member (2026-09-07).
 */
const useGroupChatSession = (chatId: number) => {
	const [session, setSession] = useState<ExtendedSessionInterface | null>(
		null
	);
	const [ready, setReady] = useState(false);
	const [version, setVersion] = useState(0);
	const reload = useCallback(() => setVersion((v) => v + 1), []);

	useEffect(() => {
		if (!Number.isFinite(chatId)) {
			setSession(null);
			setReady(true);
			return;
		}
		let cancelled = false;
		const pick = (list: { sessions?: Array<{ chat?: { id?: number } }> }) =>
			(list?.sessions || []).find((entry) => entry.chat?.id === chatId);
		apiGetAskerSessionList()
			.then(async (list) => {
				const found = pick(list);
				if (found) {
					return found;
				}
				return apiGetChatRoomById(chatId)
					.then((byRoom) => pick(byRoom))
					.catch(() => undefined);
			})
			.then((found) => {
				if (cancelled) {
					return;
				}
				setSession(
					found ? buildExtendedSession(found as never, null) : null
				);
				setReady(true);
			})
			.catch(() => {
				if (!cancelled) {
					setSession(null);
					setReady(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [chatId, version]);

	return { session, ready, reload };
};
