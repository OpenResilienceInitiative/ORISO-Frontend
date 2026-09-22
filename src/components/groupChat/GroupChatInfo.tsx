import * as React from 'react';
import { useEffect, useContext, useState, useCallback } from 'react';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { Button as MuiButton, Menu, MenuItem } from '@mui/material';
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
import { ButtonItem, BUTTON_TYPES } from '../button/Button';
import { OVERLAY_FUNCTIONS, Overlay, OverlayItem } from '../overlay/Overlay';
import {
	apiGetGroupChatInfo,
	apiPutGroupChat,
	GROUP_CHAT_API
} from '../../api';
import { apiPostBanUser } from '../../api/apiPostBanUser';
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
import {
	mobileListView,
	mobileDetailView,
	desktopView
} from '../app/navigationHandler';
import { decodeUsername } from '../../utils/encryptionHelpers';
import './groupChatInfo.styles';
import { getCurrentMatrixUserId } from '../../utils/matrixSession';
import { BanUserOverlay } from '../banUser/BanUser';
import { useResponsive } from '../../hooks/useResponsive';
import { useSession } from '../../hooks/useSession';
import { useSearchParam } from '../../hooks/useSearchParams';
import { useGroupChatInviteLink } from './GroupChatCopyLinks';
import { GenerateQrCode } from '../generateQrCode/GenerateQrCode';
import {
	GroupChatInfoM3,
	type GroupChatInfoM3Props,
	type GroupChatInfoParticipant,
	type GroupChatInfoSetting,
	type GroupChatInfoSettingKey
} from './chatInfoM3/GroupChatInfoM3';
import '../session/session.styles.scss';
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
	const tenantData = useTenant();
	const { groupId: groupIdFromParam } = useParams<{ groupId: string }>();
	const featureGroupChatV2Enabled =
		tenantData?.settings?.featureGroupChatV2Enabled;

	const stopChatButtonSet: ButtonItem = {
		label: translate('groupChat.stopChat.securityOverlay.button1Label'),
		function: OVERLAY_FUNCTIONS.CLOSE,
		type: BUTTON_TYPES.PRIMARY
	};

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
		setOverlayItem(stopGroupChatSecurityOverlayItem);
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
				)[0].label,
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
			value: activeSession.item.topic as string
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

	const chatPath = `${listPath}/${activeSession.item.matrixRoomId}/${
		activeSession.item.id
	}${getSessionListTab()}`;
	const editPath = `${listPath}/${activeSession.item.matrixRoomId}/${
		activeSession.item.id
	}/editGroupChat${getSessionListTab()}`;
	const topic =
		typeof activeSession.item.topic === 'string'
			? activeSession.item.topic
			: activeSession.item.topic?.name || '';

	// Keys give each row its icon in the M3 list; order is the old one.
	const settingKeys: GroupChatInfoSettingKey[] = [
		'topic',
		'date',
		'time',
		'duration',
		'repetition',
		'agency',
		'hint'
	];
	const m3Settings: GroupChatInfoSetting[] = [
		...(showCreator
			? [
					{
						key: 'creator' as const,
						label: translate('groupChat.info.settings.creator'),
						value: activeSession.consultant.displayName
					}
				]
			: []),
		...(showCreateDate
			? [
					{
						key: 'createDate' as const,
						label: translate('groupChat.info.settings.createDate'),
						value: getCreationDate(
							new Date(activeSession.item.createdAt)
						)
					}
				]
			: []),
		...preparedSettings.map((item, index) => ({
			key: settingKeys[index],
			label: item.label,
			value: item.value
		}))
	];
	const scheduleSummary = [
		preparedSettings[1]?.value,
		preparedSettings[2]?.value,
		preparedSettings[3]?.value
	]
		.filter(Boolean)
		.join(' · ');

	return (
		<ActiveSessionProvider activeSession={activeSession}>
			{/* #1499: the Chat-Info lives in the white chat card like the
			    chat itself, drawn by the M3 surface Frank approved in
			    Storybook (`Chat info/Group`). */}
			<div className="session groupChatInfo__card">
				<GroupChatInfoM3Connected
					topic={topic}
					scheduleSummary={scheduleSummary}
					statusLabel={translate(
						activeSession.item.active
							? 'groupChat.info.status.active'
							: 'groupChat.info.status.planned'
					)}
					active={!!activeSession.item.active}
					calendarAction={
						calendarStart ? (
							<GroupChatCalendarMenu
								start={calendarStart}
								durationMinutes={activeSession.item.duration}
								eventId={activeSession.item.id}
							/>
						) : undefined
					}
					primaryAction={
						canModerateGroupChat(activeSession, userData) &&
						activeSession.item.active &&
						activeSession.item.subscribed ? (
							<MuiButton
								variant="outlined"
								onClick={handleStopGroupChatButton}
								sx={{
									borderRadius: '20px',
									textTransform: 'none',
									borderColor: 'var(--m3-outline)',
									color: 'var(--m3-error)'
								}}
							>
								{stopChatButtonSet.label}
							</MuiButton>
						) : undefined
					}
					isCurrentUserModerator={isCurrentUserModerator}
					showInviteActions={
						!!featureGroupChatV2Enabled && isV2GroupChat
					}
					teamRolesSlot={
						activeSession.item.participants?.length &&
						userData?.userId ? (
							<GroupChatRoleManager
								seriesId={activeSession.item.id}
								currentUserId={userData.userId}
								participants={activeSession.item.participants}
								hideHeadline
							/>
						) : undefined
					}
					settings={m3Settings}
					onEdit={
						isGroupChatOwner(activeSession, userData) &&
						!activeSession.item.active
							? () =>
									navigate(editPath, {
										state: {
											isEditMode: true,
											prevIsInfoPage: true
										}
									})
							: undefined
					}
					onBack={() => navigate(chatPath)}
				/>
				{overlayActive ? (
					<Overlay
						item={overlayItem}
						handleOverlay={handleOverlayAction}
					/>
				) : null}
			</div>
		</ActiveSessionProvider>
	);
};

/**
 * The M3 Chat-Info with the parts that need the active-session context:
 * room members from Matrix, bans, the QR code and the invite link.
 */
const GroupChatInfoM3Connected = ({
	isCurrentUserModerator,
	showInviteActions,
	...props
}: Omit<
	GroupChatInfoM3Props,
	| 'participants'
	| 'canModerate'
	| 'onParticipantMenu'
	| 'participantMenuLabel'
	| 'onShowQrCode'
	| 'onCopyInviteLink'
> & {
	isCurrentUserModerator: boolean;
	showInviteActions: boolean;
}) => {
	const { t: translate } = useTranslation();
	const { activeSession } = useContext(ActiveSessionContext);
	const matrixRoomUsersContext = useMatrixRoomUsers();
	const users = matrixRoomUsersContext?.users || [];
	const moderators = matrixRoomUsersContext?.moderators || [];
	const [bannedUsers, setBannedUsers] = useState<string[]>([]);
	const [menu, setMenu] = useState<{
		anchor: HTMLElement;
		participant: GroupChatInfoParticipant;
	} | null>(null);
	const [bannedOverlayName, setBannedOverlayName] = useState<string | null>(
		null
	);
	const [qrOpen, setQrOpen] = useState(false);
	const { url, copyRegistrationLink } = useGroupChatInviteLink(
		activeSession.item.id
	);

	useEffect(() => {
		if (activeSession.item.active) {
			apiGetGroupChatInfo(activeSession.item.id).then((response) => {
				setBannedUsers(
					response.bannedUsers
						? response.bannedUsers.map(decodeUsername)
						: []
				);
			});
		}
	}, [activeSession.item.active, activeSession.item.id]);

	const participants: GroupChatInfoParticipant[] = users.map(
		(subscriber) => ({
			id: subscriber._id,
			// The ban API and the ban list speak the login name.
			username: decodeUsername(subscriber.username),
			name: subscriber.displayName
				? decodeUsername(subscriber.displayName)
				: decodeUsername(subscriber.username),
			isModerator: moderators.includes(subscriber._id),
			statusLabel:
				isCurrentUserModerator &&
				bannedUsers.includes(subscriber.username)
					? translate('banUser.is.banned')
					: undefined
		})
	);

	const banSelected = () => {
		if (!menu) {
			return;
		}
		const { participant } = menu;
		setMenu(null);
		apiPostBanUser({
			matrixUserId: participant.id,
			chatId: activeSession.item.id
		}).then(() => {
			setBannedUsers((current) => [
				...current,
				participant.username ?? participant.name
			]);
			setBannedOverlayName(participant.username ?? participant.name);
		});
	};

	return (
		<>
			<GroupChatInfoM3
				{...props}
				participants={participants}
				canModerate={isCurrentUserModerator}
				participantMenuLabel={(name) =>
					translate('groupChat.info.subscribers.menuLabel', { name })
				}
				onParticipantMenu={(participant, anchor) =>
					setMenu({ participant, anchor })
				}
				onShowQrCode={
					showInviteActions ? () => setQrOpen(true) : undefined
				}
				onCopyInviteLink={
					showInviteActions ? copyRegistrationLink : undefined
				}
			/>
			<Menu
				anchorEl={menu?.anchor ?? null}
				open={!!menu}
				onClose={() => setMenu(null)}
			>
				<MenuItem onClick={banSelected}>
					{translate('banUser.ban.trigger')}
				</MenuItem>
			</Menu>
			{showInviteActions && (
				<GenerateQrCode
					url={url}
					headline={translate('groupChat.qrCode.headline')}
					text={translate('groupChat.qrCode.text')}
					filename={`group-chat-${activeSession.item.id}`}
					open={qrOpen}
					onOpenChange={setQrOpen}
				/>
			)}
			<BanUserOverlay
				overlayActive={bannedOverlayName !== null}
				userName={bannedOverlayName ?? ''}
				handleOverlay={() => setBannedOverlayName(null)}
			/>
		</>
	);
};
