import { createPortal } from 'react-dom';
import { MenuBackdrop } from '../chatMenuDropdown/MenuBackdrop';
import { useChatMenuPosition } from '../chatMenuDropdown/useChatMenuPosition';
import * as React from 'react';
import {
	MouseEventHandler,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState
} from 'react';
import { generatePath, Link, Navigate, useNavigate } from 'react-router-dom';
import {
	AUTHORITIES,
	hasUserAuthority,
	SessionTypeContext,
	useConsultingType,
	UserDataContext,
	ActiveSessionContext,
	SessionsDataContext,
	REMOVE_SESSIONS
} from '../../globalState';
import { startRoomCall } from '../call/startRoomCall';
import { resolveCallFeatureGates } from '../call/callFeatureGates';
import {
	AudioCallHeaderIcon,
	VideoCallHeaderIcon
} from '../call/CallHeaderIcons';
import {
	SESSION_LIST_TAB,
	SESSION_LIST_TAB_ARCHIVE,
	SESSION_LIST_TYPES
} from '../session/sessionHelpers';
import { getModality, Modality } from '../session/getModality';
import { Overlay, OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import {
	archiveSessionSuccessOverlayItem,
	groupChatErrorOverlayItem,
	leaveGroupChatSecurityOverlayItem,
	leaveGroupChatSuccessOverlayItem,
	stopGroupChatSecurityOverlayItem,
	stopGroupChatSuccessOverlayItem
} from './sessionMenuHelpers';
import {
	apiPutArchive,
	apiPutDearchive,
	apiPutGroupChat,
	GROUP_CHAT_API
} from '../../api';
import { logout } from '../logout/logout';
import { mobileListView } from '../app/navigationHandler';
import {
	canModerateGroupChat,
	isGroupChatOwner
} from '../groupChat/groupChatHelpers';
import { ReactComponent as LeaveChatIcon } from '../../resources/img/icons/out.svg';
import { ReactComponent as GroupChatInfoIcon } from '../../resources/img/icons/i.svg';
import { ReactComponent as StopGroupChatIcon } from '../../resources/img/icons/x.svg';
import { ReactComponent as EditGroupChatIcon } from '../../resources/img/icons/gear.svg';
import { ReactComponent as MenuVerticalIcon } from '../../resources/img/icons/stack-vertical.svg';
import { ReactComponent as ArchiveIcon } from '../../resources/img/icons/inbox_outline.svg';
import { ReactComponent as AdviceRequestIcon } from '../../resources/img/icons/persons-two.svg';
import { ReactComponent as TrashIcon } from '../../resources/img/icons/trash.svg';
import { ReactComponent as NotificationSettingsIcon } from '../../resources/img/icons/notification_settings.svg';
import { ReactComponent as ProfileIcon } from '../../resources/img/icons/profil_outline.svg';
import { ReactComponent as MenuVideoCallIcon } from '../../resources/img/icons/modality-video.svg';
import { ReactComponent as MenuAudioCallIcon } from '../../resources/img/icons/timeline-add-call.svg';
import { NotificationConfigDialog } from '../profile/NotificationSettings/NotificationConfigDialog';
import { useNotificationSettings } from '../../hooks/useNotificationSettings';
import { LegalLinkMenuIcon } from '../legalLinks/LegalLinkMenuIcon';
import { getLegalLinkKind } from '../legalLinks/useLegalLinkContent';
import '../sessionHeader/sessionHeader.styles';
import './sessionMenu.styles';
import { Button, BUTTON_TYPES, ButtonItem } from '../button/Button';
import { ReactComponent as CalendarMonthPlusIcon } from '../../resources/img/icons/calendar-plus.svg';
import DeleteSession from '../session/DeleteSession';
import { Text } from '../text/Text';
import { useSearchParam } from '../../hooks/useSearchParams';
import { useTranslation } from 'react-i18next';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { useMatrixRoomUsers } from '../../hooks/useMatrixRoomUsers';
import LegalLinks from '../legalLinks/LegalLinks';
import { LegalLinkModal } from '../legalLinks/LegalLinkModal';
import {
	ChatMenuDropdown,
	ChatMenuDropdownDivider,
	ChatMenuDropdownHeader,
	ChatMenuDropdownItemContent as SessionMenuItemContent
} from '../chatMenuDropdown/ChatMenuDropdown';
import { sessionMenuOwnsCallControls } from './callControlOwnership';
import { useSessionTenantSettings } from '../../hooks/useSessionTenantSettings';
import { useSupervisionPanel } from '../supervisionPanel/SupervisionPanelContext';
import { ReactComponent as SupervisionIcon } from '../../resources/img/icons/supervision_nocirc_400_24px.svg';

export interface SessionMenuProps {
	hasUserInitiatedStopOrLeaveRequest: React.MutableRefObject<boolean>;
	isAskerInfoAvailable: boolean;
	isJoinGroupChatView?: boolean;
	bannedUsers?: string[];
	isSupervisor?: boolean;
	showMobileSupervisionAction?: boolean;
	onMobileSupervisionAction?: () => void;
	showMobileDeleteAnonymousAccountAction?: boolean;
	onMobileDeleteAnonymousAccountAction?: () => void;
	mobileDeleteAnonymousAccountDisabled?: boolean;
	showMobileEndAnonymousChatAction?: boolean;
	onMobileEndAnonymousChatAction?: () => void;
	mobileEndAnonymousChatDisabled?: boolean;
	/**
	 * D8 (Frank, 05.09.2026): the audio/video call buttons leave the header
	 * row and become rows of this menu (phone: the title needs the width).
	 * Off by default — B2 sets it from the viewport (`untilL`).
	 */
	callsInMenu?: boolean;
}

// #1262 — backend advice-request APIs are not ready (US#1034). Keep the owner-only item visible but inert.
const ADVICE_REQUEST_ENABLED = false;

export const SessionMenu = (props: SessionMenuProps) => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();

	const legalLinks = useContext(LegalLinksContext);

	const { userData } = useContext(UserDataContext);
	const { type, path: listPath } = useContext(SessionTypeContext);

	const { activeSession, reloadActiveSession } =
		useContext(ActiveSessionContext);
	const consultingType = useConsultingType(activeSession.item.consultingType);
	const {
		settings: currentTenantSettings,
		isLoading: isLoadingTenantSettings
	} = useSessionTenantSettings(activeSession.item?.id);
	const { dispatch: sessionsDispatch } = useContext(SessionsDataContext);
	// WP-B2: the supervision parallel panel; null outside a session view.
	const supervisionPanel = useSupervisionPanel();

	const [overlayItem, setOverlayItem] = useState(null);
	const [flyoutOpen, setFlyoutOpen] = useState(null);
	const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const closeMenu = useCallback(() => {
		setFlyoutOpen(false);
		menuTriggerRef.current?.focus();
	}, []);
	const menuPosition = useChatMenuPosition({
		open: Boolean(flyoutOpen),
		anchorRef: menuTriggerRef,
		menuRef
	});
	useEffect(() => {
		if (!flyoutOpen) return;
		const closeIfTriggerHidden = () => {
			// Desktop and mobile use separate triggers. A breakpoint change
			// can hide the anchor, so close instead of positioning at its zero rect.
			if (menuTriggerRef.current?.getClientRects().length === 0) {
				closeMenu();
			}
		};
		window.addEventListener('resize', closeIfTriggerHidden);
		return () => window.removeEventListener('resize', closeIfTriggerHidden);
	}, [flyoutOpen, closeMenu]);
	const handleOpenGroupChatInfo = () => {
		closeMenu();
		// The dialog restores focus here after closing, rather than to its
		// now-hidden menu item. Remember the actual desktop/mobile trigger.
		menuTriggerRef.current?.focus();
	};
	// #576 harmonised model: quick access to the notification config from the
	// conversation menu — same component as in the profile settings, wrapped
	// in the dialog so the user is NOT thrown out of the current room.
	const [notifConfigOpen, setNotifConfigOpen] = useState(false);
	const { settings: notifSettings, updateSettings: updateNotifSettings } =
		useNotificationSettings();
	const [overlayActive, setOverlayActive] = useState(false);
	const [legalModal, setLegalModal] = useState<{
		title: string;
		url: string;
	} | null>(null);
	const [redirectToSessionsList, setRedirectToSessionsList] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);

	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');
	const getSessionListTab = () =>
		`${sessionListTab ? `?sessionListTab=${sessionListTab}` : ''}`;

	const isSessionOwner =
		Boolean(activeSession.consultant?.id) &&
		String(activeSession.consultant.id) === String(userData.userId);
	const showRequestAdvice =
		isSessionOwner &&
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
		type !== SESSION_LIST_TYPES.ENQUIRY &&
		Boolean(activeSession.isSession) &&
		!activeSession.isGroup &&
		!props.isSupervisor;

	useEffect(() => {
		if (!flyoutOpen || menuPosition.visibility !== 'visible') return;
		const menu = menuRef.current;
		menu?.querySelector<HTMLElement>(
			'a[href], button:not(:disabled), [tabindex="0"]'
		)?.focus();
		const outside = (event: MouseEvent) => {
			if (
				!menu?.contains(event.target as Node) &&
				!menuTriggerRef.current?.contains(event.target as Node)
			) {
				event.preventDefault();
				closeMenu();
			}
		};
		const keydown = (event: KeyboardEvent) => {
			if (
				menu?.contains(event.target as Node) &&
				['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
			) {
				const items = Array.from(
					menu.querySelectorAll<HTMLElement>(
						'a[href], button:not(:disabled), [tabindex="0"]'
					)
				);
				const index = items.indexOf(
					document.activeElement as HTMLElement
				);
				const next =
					event.key === 'Home'
						? 0
						: event.key === 'End'
							? items.length - 1
							: (index +
									(event.key === 'ArrowDown' ? 1 : -1) +
									items.length) %
								items.length;
				event.preventDefault();
				items[next]?.focus();
			}

			if (event.key === 'Escape') {
				event.preventDefault();
				closeMenu();
			}
		};
		document.addEventListener('mousedown', outside);
		document.addEventListener('keydown', keydown);
		return () => {
			document.removeEventListener('mousedown', outside);
			document.removeEventListener('keydown', keydown);
		};
	}, [flyoutOpen, menuPosition.visibility, closeMenu]);

	const [appointmentFeatureEnabled, setAppointmentFeatureEnabled] =
		useState(false);

	useEffect(() => {
		if (!hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)) {
			const { appointmentFeatureEnabled } = userData;
			setAppointmentFeatureEnabled(appointmentFeatureEnabled);
		}
		if (!activeSession.item?.active || !activeSession.item?.subscribed) {
			// do not get group members for a chat that has not been started and user is not subscribed
			return;
		}
	}, [activeSession, userData]);

	const handleBookingButton = () => {
		navigate('/booking/');
	};

	const handleStopGroupChat = () => {
		closeMenu();
		menuTriggerRef.current?.focus();
		stopGroupChatSecurityOverlayItem.copy =
			getModality(activeSession) === Modality.SELF_HELP
				? translate('groupChat.stopChat.securityOverlay.copyRepeat')
				: translate('groupChat.stopChat.securityOverlay.copySingle');
		setOverlayItem(stopGroupChatSecurityOverlayItem);
		setOverlayActive(true);
	};

	const handleLeaveGroupChat = () => {
		closeMenu();
		menuTriggerRef.current?.focus();
		setOverlayItem(leaveGroupChatSecurityOverlayItem);
		setOverlayActive(true);
	};

	const handleArchiveSession = () => {
		closeMenu();
		menuTriggerRef.current?.focus();
		setOverlayItem(archiveSessionSuccessOverlayItem);
		setOverlayActive(true);
	};

	const handleDearchiveSession = () => {
		apiPutDearchive(activeSession.item.id)
			.then(() => {
				reloadActiveSession();
				// Short timeout to wait for RC events finished
				setTimeout(() => {
					if (window.innerWidth >= 900) {
						navigate(
							`${listPath}/${activeSession.item.matrixRoomId}/${activeSession.item.id}`
						);
					} else {
						mobileListView();
						navigate(listPath);
					}
					closeMenu();
				}, 1000);
			})
			.catch((error) => {
				// console.error(error);
			});
	};

	const handleOverlayAction = (buttonFunction: string) => {
		if (isRequestInProgress) {
			return null;
		}
		setIsRequestInProgress(true);
		if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
			setOverlayActive(false);
			setOverlayItem(null);
			setIsRequestInProgress(false);
		} else if (buttonFunction === OVERLAY_FUNCTIONS.STOP_GROUP_CHAT) {
			// In order to prevent a possible race condition between the user
			// service in case of a successful request, this ref
			// is reset to `false` in the event handler that handles NOTIFY_USER
			// events.
			props.hasUserInitiatedStopOrLeaveRequest.current = true;

			apiPutGroupChat(activeSession.item.id, GROUP_CHAT_API.STOP)
				.then(() => {
					setOverlayItem(stopGroupChatSuccessOverlayItem);
				})
				.catch(() => {
					setOverlayItem(groupChatErrorOverlayItem);
					props.hasUserInitiatedStopOrLeaveRequest.current = false;
				})
				.finally(() => {
					setIsRequestInProgress(false);
				});
		} else if (buttonFunction === OVERLAY_FUNCTIONS.LEAVE_GROUP_CHAT) {
			// See comment above
			props.hasUserInitiatedStopOrLeaveRequest.current = true;

			apiPutGroupChat(activeSession.item.id, GROUP_CHAT_API.LEAVE)
				.then(() => {
					setOverlayItem(leaveGroupChatSuccessOverlayItem);
				})
				.catch((error) => {
					setOverlayItem(groupChatErrorOverlayItem);
					props.hasUserInitiatedStopOrLeaveRequest.current = false;
				})
				.finally(() => {
					setIsRequestInProgress(false);
				});
		} else if (buttonFunction === OVERLAY_FUNCTIONS.REDIRECT) {
			setRedirectToSessionsList(true);
		} else if (buttonFunction === OVERLAY_FUNCTIONS.LOGOUT) {
			logout();
		} else if (buttonFunction === OVERLAY_FUNCTIONS.ARCHIVE) {
			const sessionId = activeSession.item.id;
			const sessionGroupId = activeSession.item.matrixRoomId;

			apiPutArchive(sessionId)
				.then(() => {
					// Remove from current sessions list immediately
					sessionsDispatch({
						type: REMOVE_SESSIONS,
						ids: sessionGroupId ? [sessionGroupId] : [sessionId]
					});

					mobileListView();
					navigate(listPath);
				})
				.catch((error) => {
					// console.error(error);
				})
				.finally(() => {
					setOverlayActive(false);
					setOverlayItem(null);
					setIsRequestInProgress(false);
					closeMenu();
				});
		} else if (buttonFunction === 'GOTO_MANUAL') {
			navigate('/profile/hilfe/videoCall');
		}
	};

	const onSuccessDeleteSession = useCallback(() => {
		setRedirectToSessionsList(true);
	}, []);

	//TODO:
	//enquiries: only RS profil
	//sessions: rs, docu
	//imprint/dataschutz all users all devices

	//dynamicly menut items in flyout:
	//rotate icon to vertical only if EVERY item in flyout
	//list item icons only shown on outside

	const hasMatrixRoom = !!activeSession.item.matrixRoomId;
	const baseUrl = hasMatrixRoom
		? `${listPath}/:groupId/:id/:subRoute?/:extraPath?${getSessionListTab()}`
		: `${listPath}/session/:id/:subRoute?/:extraPath?${getSessionListTab()}`;

	const groupChatInfoLink = hasMatrixRoom
		? generatePath(baseUrl, {
				groupId: activeSession.item.matrixRoomId,
				id: String(activeSession.item.id),
				subRoute: 'groupChatInfo'
			})
		: '';
	const editGroupChatSettingsLink = hasMatrixRoom
		? generatePath(baseUrl, {
				groupId: activeSession.item.matrixRoomId,
				id: String(activeSession.item.id),
				subRoute: 'editGroupChat'
			})
		: '';
	const userProfileLink = hasMatrixRoom
		? generatePath(baseUrl, {
				groupId: activeSession.item.matrixRoomId,
				id: String(activeSession.item.id),
				subRoute: 'userProfile'
			})
		: generatePath(baseUrl, {
				id: String(activeSession.item.id),
				subRoute: 'userProfile'
			});

	if (redirectToSessionsList) {
		mobileListView();
		return <Navigate to={listPath + getSessionListTab()} replace />;
	}

	const buttonStartCall: ButtonItem = {
		type: BUTTON_TYPES.SMALL_ICON,
		title: translate('videoCall.button.startCall'),
		smallIconBackgroundColor: 'transparent',
		icon: <AudioCallHeaderIcon />
	};

	const buttonStartVideoCall: ButtonItem = {
		type: BUTTON_TYPES.SMALL_ICON,
		title: translate('videoCall.button.startVideoCall'),
		smallIconBackgroundColor: 'transparent',
		icon: <VideoCallHeaderIcon />
	};

	const isAnonymousChat = getModality(activeSession) === Modality.LIVE_CHAT;
	const showAnonymousMobileMenu =
		Boolean(props.showMobileEndAnonymousChatAction) ||
		Boolean(props.showMobileDeleteAnonymousAccountAction) ||
		Boolean(props.showMobileSupervisionAction);
	const showSessionMenu = !activeSession.isEnquiry || showAnonymousMobileMenu;
	const chatType: 'anonymous' | 'oneOnOne' | 'group' | 'supervision' =
		props.isSupervisor
			? 'supervision'
			: activeSession.isGroup
				? 'group'
				: isAnonymousChat
					? 'anonymous'
					: 'oneOnOne';

	// One gate for every caller: the side room's controls ask the same
	// question with `chatType: 'supervision'` (`call/callFeatureGates.ts`).
	const { audio: isAudioCallsEnabled, video: isVideoCallsEnabled } =
		resolveCallFeatureGates(currentTenantSettings, chatType);

	const hasVideoCallFeatures = () =>
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
		(activeSession.isSession || activeSession.isGroup) && // 🎯 Enable for both 1-on-1 AND group chats
		type !== SESSION_LIST_TYPES.ENQUIRY &&
		consultingType.isVideoCallAllowed;

	const handleStartVideoCall = async (isVideoActivated: boolean = false) => {
		// The trigger lives in `call/startRoomCall.ts` because the side room needs
		// the same steps against a different Matrix room. One implementation
		// serves both callers.
		await startRoomCall({
			// 1:1 sessions call into `activeSession.rid`; group chats into the
			// group's Matrix room.
			roomId: activeSession.rid || activeSession.item.matrixRoomId,
			isVideo: isVideoActivated,
			// Force 1:1 Matrix WebRTC for non-group sessions so audio calls are
			// not misrouted to Element Call (which always enables video).
			isGroup: activeSession.isGroup ? true : false
		});
	};

	return (
		<div className="sessionMenu__wrapper">
			<MenuBackdrop
				open={Boolean(flyoutOpen) && !legalModal}
				onClose={() => {
					closeMenu();
					menuTriggerRef.current?.focus();
				}}
			/>
			{sessionMenuOwnsCallControls(activeSession.isGroup) &&
				!isLoadingTenantSettings &&
				hasVideoCallFeatures() &&
				!props.isSupervisor &&
				!props.callsInMenu &&
				(isAudioCallsEnabled || isVideoCallsEnabled) && (
					<div
						className="sessionMenu__videoCallButtons"
						data-cy="session-header-video-call-buttons"
					>
						{isVideoCallsEnabled && (
							<Button
								buttonHandle={() => handleStartVideoCall(true)}
								item={buttonStartVideoCall}
							/>
						)}
						{isAudioCallsEnabled && (
							<Button
								buttonHandle={() => handleStartVideoCall(false)}
								item={buttonStartCall}
							/>
						)}
					</div>
				)}

			{!activeSession.isEnquiry &&
				appointmentFeatureEnabled &&
				!activeSession.isGroup && (
					<div
						className="sessionMenu__icon sessionMenu__icon--booking"
						onClick={handleBookingButton}
					>
						<CalendarMonthPlusIcon />
						<Text
							type="standard"
							text={translate('booking.mobile.calendar.label')}
						/>
					</div>
				)}
			{showSessionMenu && (
				<>
					<button
						type="button"
						id="iconH"
						onClick={(event) => {
							menuTriggerRef.current = event.currentTarget;
							setFlyoutOpen(!flyoutOpen);
						}}
						className="sessionMenu__icon sessionMenu__icon--desktop"
						aria-expanded={Boolean(flyoutOpen)}
						aria-controls="flyout"
						aria-label={translate('app.menu')}
					>
						<MenuVerticalIcon
							title={translate('app.menu')}
							aria-label={translate('app.menu')}
						/>
					</button>
					<button
						type="button"
						id="iconV"
						onClick={(event) => {
							menuTriggerRef.current = event.currentTarget;
							setFlyoutOpen(!flyoutOpen);
						}}
						className="sessionMenu__icon sessionMenu__icon--mobile"
						aria-expanded={Boolean(flyoutOpen)}
						aria-controls="flyout"
						aria-label={translate('app.menu')}
					>
						<MenuVerticalIcon
							title={translate('app.menu')}
							aria-label={translate('app.menu')}
						/>
					</button>

					{/* Escape the header stacking context so the menu remains above its backdrop. */}
					{createPortal(
						<ChatMenuDropdown
							id="flyout"
							ref={menuRef}
							className={`sessionMenu__content${
								flyoutOpen ? ' sessionMenu__content--open' : ''
							}`}
							style={{
								...menuPosition,
								...(legalModal ? { display: 'none' } : {})
							}}
							onKeyDown={(event) => {
								if (event.key === 'Escape') {
									closeMenu();
									menuTriggerRef.current?.focus();
								}
							}}
							ariaLabel={translate(
								'groupChat.info.settings.headline'
							)}
						>
							<ChatMenuDropdownHeader
								subtitle={translate(
									'groupChat.info.settings.subtitle'
								)}
								title={translate(
									'groupChat.info.settings.headline'
								)}
							/>
							<ChatMenuDropdownDivider />
							{/* D8 (05.09.2026): with `callsInMenu` the call buttons
							    are rows of this menu instead of header buttons —
							    the organism's rows (icon · title), same handlers
							    as the buttons, same feature gates. */}
							{props.callsInMenu &&
								sessionMenuOwnsCallControls(
									activeSession.isGroup
								) &&
								!isLoadingTenantSettings &&
								hasVideoCallFeatures() &&
								!props.isSupervisor && (
									<>
										{/* Review v10: real controls — native buttons
										    (role button, keyboard by default) inside the
										    organism's `role="dialog"` card; the visible
										    title is the accessible name. A `menuitem`
										    role needs the organism's container to be a
										    `role="menu"` — that is the organism-wide
										    keyboard ticket, not this row. */}
										{isVideoCallsEnabled && (
											<button
												type="button"
												className="sessionMenu__item chatMenuDropdown__item"
												onClick={() => {
													setFlyoutOpen(false);
													handleStartVideoCall(true);
												}}
												data-cy="session-menu-start-video-call"
											>
												<SessionMenuItemContent
													icon={
														<MenuVideoCallIcon data-icon-id="ui-icon:modality-video:base" />
													}
													title={translate(
														'videoCall.button.startVideoCall'
													)}
												/>
											</button>
										)}
										{isAudioCallsEnabled && (
											<button
												type="button"
												className="sessionMenu__item chatMenuDropdown__item"
												onClick={() => {
													setFlyoutOpen(false);
													handleStartVideoCall(false);
												}}
												data-cy="session-menu-start-call"
											>
												<SessionMenuItemContent
													icon={
														<MenuAudioCallIcon data-icon-id="ui-icon:timeline-add-call:base" />
													}
													title={translate(
														'videoCall.button.startCall'
													)}
												/>
											</button>
										)}
									</>
								)}

							{props.isAskerInfoAvailable && (
								<Link
									className="sessionMenu__item chatMenuDropdown__item"
									to={userProfileLink}
								>
									<SessionMenuItemContent
										icon={
											<ProfileIcon data-icon-id="sidebar-icon:profil:outline" />
										}
										title={translate(
											'chatFlyout.askerProfil'
										)}
										shortcut="⇧P"
									/>
								</Link>
							)}

							<div
								role="button"
								tabIndex={0}
								onKeyDown={(event) => {
									if (
										event.key === 'Enter' ||
										event.key === ' '
									) {
										event.preventDefault();
										event.currentTarget.click();
									}
								}}
								className="sessionMenu__item chatMenuDropdown__item"
								onClick={() => {
									closeMenu();
									setNotifConfigOpen(true);
								}}
								data-cy="session-menu-notification-config"
							>
								<SessionMenuItemContent
									icon={
										<NotificationSettingsIcon data-icon-id="ui-icon:notification-settings:base" />
									}
									title={translate(
										'profile.notifications.config.title'
									)}
								/>
							</div>

							{supervisionPanel?.visible && (
								<button
									type="button"
									className={`sessionMenu__item chatMenuDropdown__item ${
										!supervisionPanel.available
											? 'sessionMenu__item--disabled chatMenuDropdown__item--disabled'
											: ''
									}`}
									onClick={() => {
										if (!supervisionPanel.available) {
											return;
										}
										setFlyoutOpen(false);
										supervisionPanel.expand();
									}}
									disabled={!supervisionPanel.available}
									data-cy="session-menu-supervision-panel"
								>
									<SessionMenuItemContent
										icon={
											<SupervisionIcon data-icon-id="ui-icon:supervision-nocirc:400" />
										}
										title={translate(
											'supervision.panel.title'
										)}
										disabled={!supervisionPanel.available}
										shortcut={
											supervisionPanel.unreadCount > 0
												? supervisionPanel.unreadCount
												: undefined
										}
									/>
								</button>
							)}

							{props.showMobileSupervisionAction && (
								<div
									role="button"
									tabIndex={0}
									onKeyDown={(event) => {
										if (
											event.key === 'Enter' ||
											event.key === ' '
										) {
											event.preventDefault();
											event.currentTarget.click();
										}
									}}
									className="sessionMenu__item chatMenuDropdown__item sessionMenu__item--mobile"
									onClick={() => {
										closeMenu();
										props.onMobileSupervisionAction?.();
									}}
								>
									<SessionMenuItemContent
										icon={<GroupChatInfoIcon />}
										title={translate(
											'sessionHeader.supervisor.modal.title'
										)}
										shortcut="⇧S"
									/>
								</div>
							)}

							{props.showMobileEndAnonymousChatAction && (
								<div
									className={`sessionMenu__item chatMenuDropdown__item ${
										props.mobileEndAnonymousChatDisabled
											? 'sessionMenu__item--disabled chatMenuDropdown__item--disabled'
											: ''
									}`}
									onClick={() => {
										if (
											props.mobileEndAnonymousChatDisabled
										) {
											return;
										}
										closeMenu();
										props.onMobileEndAnonymousChatAction?.();
									}}
									data-cy="session-menu-end-anonymous-chat"
								>
									<SessionMenuItemContent
										icon={<StopGroupChatIcon />}
										title={translate(
											'sessionHeader.anonymous.endChat.label'
										)}
										disabled={
											props.mobileEndAnonymousChatDisabled
										}
										shortcut="⇧E"
									/>
								</div>
							)}

							{props.showMobileDeleteAnonymousAccountAction && (
								<div
									className={`sessionMenu__item chatMenuDropdown__item ${
										props.mobileDeleteAnonymousAccountDisabled
											? 'sessionMenu__item--disabled chatMenuDropdown__item--disabled'
											: ''
									}`}
									onClick={() => {
										if (
											props.mobileDeleteAnonymousAccountDisabled
										) {
											return;
										}
										closeMenu();
										props.onMobileDeleteAnonymousAccountAction?.();
									}}
								>
									<SessionMenuItemContent
										icon={<TrashIcon />}
										title={translate(
											'sessionHeader.anonymous.deleteAccount.label'
										)}
										disabled={
											props.mobileDeleteAnonymousAccountDisabled
										}
										shortcut="Shift+D"
									/>
								</div>
							)}

							{showRequestAdvice && (
								<div
									className={`sessionMenu__item chatMenuDropdown__item ${
										!ADVICE_REQUEST_ENABLED
											? 'sessionMenu__item--disabled chatMenuDropdown__item--disabled'
											: ''
									}`}
									onClick={() => {
										if (!ADVICE_REQUEST_ENABLED) {
											return;
										}
										closeMenu();
									}}
									data-cy="session-menu-request-advice"
								>
									<SessionMenuItemContent
										icon={
											<AdviceRequestIcon data-icon-id="ui-icon:persons-two:base" />
										}
										title={translate(
											'sessionMenu.requestAdvice'
										)}
										disabled={!ADVICE_REQUEST_ENABLED}
									/>
								</div>
							)}

							{!hasUserAuthority(
								AUTHORITIES.ASKER_DEFAULT,
								userData
							) &&
								type !== SESSION_LIST_TYPES.ENQUIRY &&
								activeSession.isSession &&
								!props.isSupervisor && (
									<>
										{sessionListTab !==
										SESSION_LIST_TAB_ARCHIVE ? (
											<div
												onClick={handleArchiveSession}
												role="button"
												tabIndex={0}
												onKeyDown={(event) => {
													if (
														event.key === 'Enter' ||
														event.key === ' '
													) {
														event.preventDefault();
														event.currentTarget.click();
													}
												}}
												className="sessionMenu__item chatMenuDropdown__item"
											>
												<SessionMenuItemContent
													icon={
														<ArchiveIcon data-icon-id="sidebar-icon:inbox:outline" />
													}
													title={translate(
														'chatFlyout.archive'
													)}
													description={translate(
														'chatFlyout.archiveDescription'
													)}
												/>
											</div>
										) : (
											<div
												onClick={handleDearchiveSession}
												role="button"
												tabIndex={0}
												onKeyDown={(event) => {
													if (
														event.key === 'Enter' ||
														event.key === ' '
													) {
														event.preventDefault();
														event.currentTarget.click();
													}
												}}
												className="sessionMenu__item chatMenuDropdown__item"
											>
												<SessionMenuItemContent
													icon={
														<ArchiveIcon data-icon-id="sidebar-icon:inbox:outline" />
													}
													title={translate(
														'chatFlyout.dearchive'
													)}
													description={translate(
														'chatFlyout.dearchiveDescription'
													)}
												/>
											</div>
										)}
									</>
								)}

							{hasUserAuthority(
								AUTHORITIES.CONSULTANT_DEFAULT,
								userData
							) &&
								type !== SESSION_LIST_TYPES.ENQUIRY &&
								activeSession.isSession &&
								!props.isSupervisor && (
									<DeleteSession
										chatId={activeSession.item.id}
										onSuccess={onSuccessDeleteSession}
									>
										{(onClick) => (
											<div
												onClick={() => {
													closeMenu();
													menuTriggerRef.current?.focus();
													onClick();
												}}
												role="button"
												tabIndex={0}
												onKeyDown={(event) => {
													if (
														event.key === 'Enter' ||
														event.key === ' '
													) {
														event.preventDefault();
														event.currentTarget.click();
													}
												}}
												className="sessionMenu__item chatMenuDropdown__item"
											>
												<SessionMenuItemContent
													icon={
														<TrashIcon data-icon-id="ui-icon:trash:base" />
													}
													title={translate(
														'chatFlyout.remove'
													)}
													description={translate(
														'chatFlyout.removeDescription'
													)}
												/>
											</div>
										)}
									</DeleteSession>
								)}

							{activeSession.isGroup && (
								<SessionMenuFlyoutGroup
									editGroupChatSettingsLink={
										editGroupChatSettingsLink
									}
									groupChatInfoLink={groupChatInfoLink}
									onOpenInfo={handleOpenGroupChatInfo}
									handleLeaveGroupChat={handleLeaveGroupChat}
									handleStopGroupChat={handleStopGroupChat}
									bannedUsers={props.bannedUsers}
								/>
							)}

							<div className="legalInformationLinks--menu">
								<LegalLinks
									legalLinks={legalLinks}
									params={{ aid: activeSession?.agency?.id }}
								>
									{(label, url, rawLabel) => {
										const kind = getLegalLinkKind(
											label,
											url,
											rawLabel
										);
										return (
											<button
												type="button"
												className="sessionMenu__item chatMenuDropdown__item"
												onClick={() => {
													closeMenu();
													setLegalModal({
														title: label,
														url
													});
												}}
											>
												<SessionMenuItemContent
													icon={
														<LegalLinkMenuIcon
															title={label}
															url={url}
															rawLabel={rawLabel}
														/>
													}
													title={label}
													description={
														kind === 'privacy'
															? translate(
																	'chatFlyout.privacyPolicyDescription'
																)
															: undefined
													}
												/>
											</button>
										);
									}}
								</LegalLinks>
							</div>
						</ChatMenuDropdown>,
						document.body
					)}
				</>
			)}
			{legalModal && (
				<LegalLinkModal
					title={legalModal.title}
					url={legalModal.url}
					onClose={() => setLegalModal(null)}
				/>
			)}
			{overlayActive && (
				<Overlay
					item={overlayItem}
					handleOverlay={handleOverlayAction}
				/>
			)}
			<NotificationConfigDialog
				open={notifConfigOpen}
				config={notifSettings.notificationConfig}
				onConfirm={(notificationConfig) => {
					updateNotifSettings({ notificationConfig });
					setNotifConfigOpen(false);
				}}
				onClose={() => setNotifConfigOpen(false)}
			/>
		</div>
	);
};

const SessionMenuFlyoutGroup = ({
	groupChatInfoLink,
	onOpenInfo,
	editGroupChatSettingsLink,
	handleLeaveGroupChat,
	handleStopGroupChat,
	bannedUsers
}: {
	groupChatInfoLink: string;
	onOpenInfo: () => void;
	editGroupChatSettingsLink: string;
	handleStopGroupChat: MouseEventHandler;
	handleLeaveGroupChat: MouseEventHandler;
	bannedUsers: string[];
}) => {
	const { t: translate } = useTranslation();
	const { userData } = useContext(UserDataContext);
	const { activeSession } = useContext(ActiveSessionContext);
	const matrixRoomUsersContext = useMatrixRoomUsers();
	const moderators = matrixRoomUsersContext?.moderators || [];

	return (
		<>
			{activeSession.item.subscribed &&
				!bannedUsers?.includes(userData.userName) &&
				moderators.length > 1 && (
					<div
						onClick={handleLeaveGroupChat}
						role="button"
						tabIndex={0}
						onKeyDown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								event.currentTarget.click();
							}
						}}
						className="sessionMenu__item chatMenuDropdown__item sessionMenu__button"
					>
						<SessionMenuItemContent
							icon={<LeaveChatIcon />}
							title={translate('chatFlyout.leaveGroupChat')}
						/>
					</div>
				)}
			{(hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) ||
				(activeSession.item.subscribed &&
					!bannedUsers?.includes(userData.userName))) && (
				<Link
					to={groupChatInfoLink}
					onClick={onOpenInfo}
					className="sessionMenu__item chatMenuDropdown__item sessionMenu__button"
				>
					<SessionMenuItemContent
						icon={<GroupChatInfoIcon />}
						title={translate('chatFlyout.groupChatInfo')}
					/>
				</Link>
			)}
			{activeSession.item.subscribed &&
				hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
				canModerateGroupChat(activeSession, userData) && (
					<div
						onClick={handleStopGroupChat}
						role="button"
						tabIndex={0}
						onKeyDown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								event.currentTarget.click();
							}
						}}
						className="sessionMenu__item chatMenuDropdown__item sessionMenu__button"
					>
						<SessionMenuItemContent
							icon={<StopGroupChatIcon />}
							title={translate('chatFlyout.stopGroupChat')}
						/>
					</div>
				)}
			{isGroupChatOwner(activeSession, userData) &&
				!activeSession.item.active && (
					<Link
						to={editGroupChatSettingsLink}
						state={{
							isEditMode: true,
							prevIsInfoPage: false
						}}
						className="sessionMenu__item chatMenuDropdown__item sessionMenu__button"
					>
						<SessionMenuItemContent
							icon={<EditGroupChatIcon />}
							title={translate('chatFlyout.editGroupChat')}
						/>
					</Link>
				)}
		</>
	);
};
