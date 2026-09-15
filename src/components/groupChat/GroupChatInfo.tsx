import * as React from 'react';
import { useEffect, useContext, useState, useCallback } from 'react';
import {
	Link,
	Navigate,
	useParams,
	useNavigate,
	useLocation
} from 'react-router-dom';
import {
	AUTHORITIES,
	SessionTypeContext,
	UserDataContext,
	hasUserAuthority,
	useTenant,
	ActiveSessionContext,
	ActiveSessionProvider
} from '../../globalState';
import { isUserModerator, SESSION_LIST_TAB } from '../session/sessionHelpers';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { BUTTON_TYPES } from '../button/Button';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { getModality, Modality } from '../session/getModality';
import { GroupChatInfoDialog } from './GroupChatInfoDialog';
import { OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import {
	apiGetGroupChatInfo,
	apiPutGroupChat,
	GROUP_CHAT_API
} from '../../api';
import {
	canModerateGroupChat,
	isGroupChatOwner,
	isV2GroupChatSession
} from './groupChatHelpers';
import { getGroupChatDate } from '../session/sessionDateHelpers';
import { durationSelectOptionsSet } from './createChatHelpers';
import {
	groupChatErrorOverlayItem,
	stopGroupChatSecurityOverlayItem,
	stopGroupChatSuccessOverlayItem
} from '../sessionMenu/sessionMenuHelpers';
import { logout } from '../logout/logout';
import { decodeUsername } from '../../utils/encryptionHelpers';
import { CompactActionMenu } from '../chatMenuDropdown/CompactActionMenu';
import { getCurrentMatrixUserId } from '../../utils/matrixSession';
import { BanUser } from '../banUser/BanUser';
import { useSession } from '../../hooks/useSession';
import { useSearchParam } from '../../hooks/useSearchParams';
import { GroupChatCopyLinks } from './GroupChatCopyLinks';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useTranslation } from 'react-i18next';
import { getPrettyDateFromMessageDate } from '../../utils/dateHelpers';
import { useMatrixRoomUsers } from '../../hooks/useMatrixRoomUsers';
import { GroupChatCalendarMenu } from './GroupChatCalendarMenu';
import { GroupChatRoleManager } from './GroupChatRoleManager';
import { getGroupChatPlannedStart } from './groupChatDate';

export const GroupChatInfo = () => {
	const settings = useAppConfig();
	const { t: translate } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const tenantData = useTenant();
	const { groupId: groupIdFromParam } = useParams<{ groupId: string }>();
	const featureGroupChatV2Enabled =
		tenantData?.settings?.featureGroupChatV2Enabled;

	const { userData } = useContext(UserDataContext);
	const { path: listPath } = useContext(SessionTypeContext);

	const [overlayItem, setOverlayItem] = useState<OverlayItem>(null);
	const [overlayActive, setOverlayActive] = useState(false);
	const [redirectToSessionsList, setRedirectToSessionsList] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const [isV2GroupChat, setIsV2GroupChat] = useState<boolean>(false);

	const { session: activeSession, ready } = useSession(groupIdFromParam);
	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');

	const getSessionListTab = () =>
		`${sessionListTab ? `?sessionListTab=${sessionListTab}` : ''}`;

	useEffect(() => {
		if (!ready) {
			return;
		}

		if (!activeSession) {
			navigate(
				listPath +
					(sessionListTab ? `?sessionListTab=${sessionListTab}` : ''),
				{ replace: true }
			);
			return;
		}

		setIsV2GroupChat(isV2GroupChatSession(activeSession));
	}, [activeSession, navigate, listPath, ready, sessionListTab]);

	const handleStopGroupChatButton = () => {
		setOverlayItem({
			...stopGroupChatSecurityOverlayItem,
			copy: activeSession.item.repetitive
				? 'groupChat.stopChat.securityOverlay.copyRepeat'
				: 'groupChat.stopChat.securityOverlay.copySingle'
		});
		setOverlayActive(true);
	};

	const handleOverlayAction = (buttonFunction: string) => {
		if (isRequestInProgress) {
			return null;
		}
		setIsRequestInProgress(true);
		if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
			setOverlayActive(false);
			setOverlayItem({});
			setIsRequestInProgress(false);
		} else if (buttonFunction === OVERLAY_FUNCTIONS.STOP_GROUP_CHAT) {
			apiPutGroupChat(activeSession.item.id, GROUP_CHAT_API.STOP)
				.then(() => {
					setOverlayItem(stopGroupChatSuccessOverlayItem);
				})
				.catch(() => {
					setOverlayItem(groupChatErrorOverlayItem);
				})
				.finally(() => {
					setIsRequestInProgress(false);
				});
		} else if (buttonFunction === OVERLAY_FUNCTIONS.REDIRECT) {
			setRedirectToSessionsList(true);
		} else if (buttonFunction === OVERLAY_FUNCTIONS.LOGOUT) {
			logout();
		}
	};

	const getDurationTranslation = useCallback(
		() =>
			durationSelectOptionsSet
				.map((option) => ({
					...option,
					label: translate(option.label)
				}))
				.filter(
					(item) =>
						parseInt(item.value) === activeSession.item.duration
				)[0]?.label,
		[activeSession?.item.duration, translate]
	);

	const getCreationDate = useCallback(
		(date: Date) => {
			const prettyDate = getPrettyDateFromMessageDate(
				date.getTime() / 1000,
				true,
				true
			);
			return `${prettyDate.date ? prettyDate.date : translate(prettyDate.str)} - ${date.getHours()}:${date.getMinutes()}`;
		},
		[translate]
	);

	if (!activeSession) return null;

	if (redirectToSessionsList) {
		return <Navigate to={listPath + getSessionListTab()} replace />;
	}
	const calendarStart = getGroupChatPlannedStart(activeSession.item);
	const showCreator =
		settings.groupChat?.info?.showCreator &&
		activeSession?.consultant?.displayName;
	const showCreateDate =
		settings.groupChat?.info?.showCreationDate &&
		activeSession?.item?.createdAt;

	const isCurrentUserModerator =
		canModerateGroupChat(activeSession, userData) ||
		isUserModerator({
			chatItem: activeSession.item,
			matrixUserId: getCurrentMatrixUserId()
		});

	const preparedSettings: Array<{ label: string; value: string }> = [
		{
			label: translate('groupChat.info.settings.topic'),
			value:
				typeof activeSession.item.topic === 'string'
					? activeSession.item.topic
					: activeSession.item.topic?.name || ''
		},
		{
			label: translate('groupChat.info.settings.startDate'),
			value: getGroupChatDate(
				activeSession.item,
				translate('sessionList.time.label.postfix'),
				false,
				true
			)
		},
		{
			label: translate('groupChat.info.settings.startTime'),
			value: getGroupChatDate(
				activeSession.item,
				translate('sessionList.time.label.postfix'),
				false,
				false,
				true
			)
		},
		{
			label: translate('groupChat.info.settings.duration'),
			value: getDurationTranslation()
		},
		{
			label: translate('groupChat.info.settings.repetition.label'),
			value: activeSession.item.repetitive
				? translate('groupChat.info.settings.repetition.weekly')
				: translate('groupChat.info.settings.repetition.single')
		},
		{
			label: translate('groupChat.info.settings.agency'),
			value: activeSession.item?.assignedAgencies?.length
				? activeSession.item.assignedAgencies[0].name
				: ''
		}
	];

	if (
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
		activeSession.item.hintMessage
	) {
		preparedSettings.push({
			label: translate('groupChat.info.settings.hintMessage'),
			value: activeSession.item.hintMessage
		});
	}

	const sessionUrl =
		location.pathname.replace(/\/groupChatInfo\/?$/, '') + location.search;
	const closeInfo = () => navigate(sessionUrl, { replace: true });
	if (showCreator)
		preparedSettings.push({
			label: translate('groupChat.info.settings.creator'),
			value: activeSession.consultant.displayName
		});
	if (showCreateDate)
		preparedSettings.push({
			label: translate('groupChat.info.settings.createDate'),
			value: getCreationDate(new Date(activeSession.item.createdAt))
		});
	return (
		<ActiveSessionProvider activeSession={activeSession}>
			<GroupChatInfoDialog
				isOwner={isGroupChatOwner(activeSession, userData)}
				kind={
					getModality(activeSession) === Modality.SELF_HELP
						? 'circle'
						: 'team'
				}
				active={activeSession.item.active}
				title={
					typeof activeSession.item.topic === 'string'
						? activeSession.item.topic
						: activeSession.item.topic?.name || ''
				}
				onClose={closeInfo}
				settings={preparedSettings}
				participants={
					<>
						<SubscriberList
							isCurrentUserModerator={isCurrentUserModerator}
						/>
						{activeSession.item.participants?.length &&
						userData?.userId ? (
							<GroupChatRoleManager
								seriesId={activeSession.item.id}
								currentUserId={userData.userId}
								participants={activeSession.item.participants}
							/>
						) : null}
					</>
				}
				invitation={
					featureGroupChatV2Enabled && isV2GroupChat ? (
						<GroupChatCopyLinks seriesId={activeSession.item.id} />
					) : null
				}
				actions={
					<>
						{calendarStart && (
							<GroupChatCalendarMenu
								start={calendarStart}
								durationMinutes={activeSession.item.duration}
								eventId={activeSession.item.id}
							/>
						)}
						{canModerateGroupChat(activeSession, userData) &&
							activeSession.item.active &&
							activeSession.item.subscribed && (
								<Button
									color="error"
									variant="text"
									onClick={handleStopGroupChatButton}
								>
									{translate(
										'groupChat.stopChat.securityOverlay.button1Label'
									)}
								</Button>
							)}
					</>
				}
				editAction={
					isGroupChatOwner(activeSession, userData) &&
					!activeSession.item.active ? (
						<Button
							component={Link}
							to={`${listPath}/${encodeURIComponent(activeSession.item.matrixRoomId)}/${activeSession.item.id}/editGroupChat${getSessionListTab()}`}
							state={{ isEditMode: true, prevIsInfoPage: true }}
							variant="outlined"
						>
							{translate('groupChat.info.settings.edit')}
						</Button>
					) : null
				}
			/>
			{overlayActive && (
				<M3Dialog
					title={translate(overlayItem.headline)}
					description={
						overlayItem.copy
							? translate(overlayItem.copy)
							: undefined
					}
					onClose={() => {
						if (!isRequestInProgress)
							handleOverlayAction(OVERLAY_FUNCTIONS.CLOSE);
					}}
					closeLabel={translate('app.close')}
					actions={overlayItem.buttonSet?.map((button) => ({
						label: translate(button.label),
						onClick: () => handleOverlayAction(button.function),
						primary: button.type === BUTTON_TYPES.PRIMARY,
						disabled: isRequestInProgress
					}))}
				/>
			)}
		</ActiveSessionProvider>
	);
};

const SubscriberList = ({
	isCurrentUserModerator
}: {
	isCurrentUserModerator: boolean;
}) => {
	const { t: translate } = useTranslation();

	const { activeSession } = useContext(ActiveSessionContext);
	const matrixRoomUsersContext = useMatrixRoomUsers();
	const users = matrixRoomUsersContext?.users || [];
	const moderators = matrixRoomUsersContext?.moderators || [];

	const [banFailed, setBanFailed] = useState(false);
	const [bannedName, setBannedName] = useState<string | null>(null);
	const [bannedUsers, setBannedUsers] = useState<string[]>([]);

	useEffect(() => {
		if (activeSession.item.active) {
			apiGetGroupChatInfo(activeSession.item.id).then((response) => {
				if (response.bannedUsers) {
					const decryptedBannedUsers =
						response.bannedUsers.map(decodeUsername);
					setBannedUsers(decryptedBannedUsers);
				} else {
					setBannedUsers([]);
				}
			});
		}
	}, [activeSession.item.active, activeSession.item.id]);

	return (
		<Stack spacing={1}>
			{banFailed && (
				<Alert severity="error" onClose={() => setBanFailed(false)}>
					{translate('groupChat.roles.removeError')}
				</Alert>
			)}
			{users.length ? (
				users.map((subscriber) => {
					const name = decodeUsername(
						subscriber.displayName || subscriber.username
					);
					const username = decodeUsername(subscriber.username);
					const banned = bannedUsers.includes(username);
					return (
						<Box
							key={subscriber._id}
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								gap: 1,
								minWidth: 0
							}}
						>
							<Typography
								variant="body2"
								sx={{ overflowWrap: 'anywhere', minWidth: 0 }}
							>
								{name}
							</Typography>
							{isCurrentUserModerator &&
								!moderators.includes(subscriber._id) &&
								!banned && (
									<CompactActionMenu
										label={`${translate('app.menu')}: ${name}`}
									>
										{(close) => (
											<BanUser
												onSelect={() => {
													setBanFailed(false);
													close();
												}}
												onBanFailed={() =>
													setBanFailed(true)
												}
												userName={username}
												matrixUserId={subscriber._id}
												chatId={activeSession.item.id}
												handleUserBan={(username) => {
													setBannedUsers(
														(current) => [
															...current,
															username
														]
													);
													setBannedName(username);
												}}
											/>
										)}
									</CompactActionMenu>
								)}
							{isCurrentUserModerator && banned && (
								<Chip
									size="small"
									label={translate('banUser.is.banned')}
								/>
							)}
						</Box>
					);
				})
			) : (
				<Typography variant="body2" color="text.secondary">
					{translate('groupChat.info.subscribers.empty')}
				</Typography>
			)}
			{bannedName !== null && (
				<M3Dialog
					title={`${translate('banUser.ban.info.1')}${bannedName}${translate('banUser.ban.info.2')}`}
					onClose={() => setBannedName(null)}
					closeLabel={translate('app.close')}
					actions={[
						{
							label: translate('banUser.ban.overlay.close'),
							onClick: () => setBannedName(null)
						}
					]}
				/>
			)}
		</Stack>
	);
};
