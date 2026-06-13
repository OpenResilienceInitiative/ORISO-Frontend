import * as React from 'react';
import {
	MouseEventHandler,
	useCallback,
	useContext,
	useEffect,
	useState
} from 'react';
import { generatePath, Link, Redirect, useHistory } from 'react-router-dom';
import {
	AUTHORITIES,
	getContact,
	hasUserAuthority,
	SessionTypeContext,
	useConsultingType,
	UserDataContext,
	ActiveSessionContext,
	SessionsDataContext,
	REMOVE_SESSIONS
} from '../../globalState';
import { SessionItemInterface } from '../../globalState/interfaces';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import {
	SESSION_LIST_TAB,
	SESSION_LIST_TAB_ARCHIVE,
	SESSION_LIST_TYPES
} from '../session/sessionHelpers';
import { Overlay, OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import {
	archiveSessionSuccessOverlayItem,
	groupChatErrorOverlayItem,
	leaveGroupChatSecurityOverlayItem,
	leaveGroupChatSuccessOverlayItem,
	stopGroupChatSecurityOverlayItem,
	stopGroupChatSuccessOverlayItem,
	videoCallErrorOverlayItem
} from './sessionMenuHelpers';
import {
	apiPutArchive,
	apiPutDearchive,
	apiPutGroupChat,
	apiStartVideoCall,
	GROUP_CHAT_API
} from '../../api';
import { logout } from '../logout/logout';
import { mobileListView } from '../app/navigationHandler';
import { isGroupChatOwner } from '../groupChat/groupChatHelpers';
import { ReactComponent as LeaveChatIcon } from '../../resources/img/icons/out.svg';
import { ReactComponent as GroupChatInfoIcon } from '../../resources/img/icons/i.svg';
import { ReactComponent as StopGroupChatIcon } from '../../resources/img/icons/x.svg';
import { ReactComponent as EditGroupChatIcon } from '../../resources/img/icons/gear.svg';
import { ReactComponent as MenuVerticalIcon } from '../../resources/img/icons/stack-vertical.svg';
import '../sessionHeader/sessionHeader.styles';
import './sessionMenu.styles';
import { Button, BUTTON_TYPES, ButtonItem } from '../button/Button';
import { ReactComponent as CalendarMonthPlusIcon } from '../../resources/img/icons/calendar-plus.svg';
import { supportsE2EEncryptionVideoCall } from '../../utils/videoCallHelpers';
import DeleteSession from '../session/DeleteSession';
import { Text } from '../text/Text';
import { useSearchParam } from '../../hooks/useSearchParams';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useTranslation } from 'react-i18next';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { RocketChatUsersOfRoomContext } from '../../globalState/provider/RocketChatUsersOfRoomProvider';
import LegalLinks from '../legalLinks/LegalLinks';

type TReducedSessionItemInterface = Omit<
	SessionItemInterface,
	'attachment' | 'topic' | 'e2eLastMessage' | 'videoCallMessageDTO'
>;

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
}

export const SessionMenu = (props: SessionMenuProps) => {
	const { t: translate } = useTranslation();
	const history = useHistory();

	const legalLinks = useContext(LegalLinksContext);
	const settings = useAppConfig();

	const { userData } = useContext(UserDataContext);
	const { type, path: listPath } = useContext(SessionTypeContext);

	const { activeSession, reloadActiveSession } =
		useContext(ActiveSessionContext);
	const consultingType = useConsultingType(activeSession.item.consultingType);
	const { dispatch: sessionsDispatch } = useContext(SessionsDataContext);

	const [overlayItem, setOverlayItem] = useState(null);
	const [flyoutOpen, setFlyoutOpen] = useState(null);
	const [overlayActive, setOverlayActive] = useState(false);
	const [redirectToSessionsList, setRedirectToSessionsList] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);

	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');
	const getSessionListTab = () =>
		`${sessionListTab ? `?sessionListTab=${sessionListTab}` : ''}`;

	const handleClick = useCallback(
		(e) => {
			const menuIconH = document.getElementById('iconH');
			const menuIconV = document.getElementById('iconV');
			const flyoutMenu = document.getElementById('flyout');

			const dropdown = document.querySelector('.sessionMenu__content');
			if (dropdown && flyoutOpen) {
				if (
					!menuIconH?.contains(e.target) &&
					!menuIconV?.contains(e.target)
				) {
					if (flyoutMenu && !flyoutMenu.contains(e.target)) {
						setFlyoutOpen(!flyoutOpen);
					}
				}
			}
		},
		[flyoutOpen]
	);

	const [appointmentFeatureEnabled, setAppointmentFeatureEnabled] =
		useState(false);

	useEffect(() => {
		document.addEventListener('mousedown', (e) => handleClick(e));
		if (!hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)) {
			const { appointmentFeatureEnabled } = userData;
			setAppointmentFeatureEnabled(appointmentFeatureEnabled);
		}
		if (!activeSession.item?.active || !activeSession.item?.subscribed) {
			// do not get group members for a chat that has not been started and user is not subscribed
			return;
		}
	}, [handleClick, activeSession, userData]);

	const handleBookingButton = () => {
		history.push('/booking/');
	};

	const handleStopGroupChat = () => {
		stopGroupChatSecurityOverlayItem.copy =
			activeSession.isGroup && activeSession.item.repetitive
				? translate('groupChat.stopChat.securityOverlay.copyRepeat')
				: translate('groupChat.stopChat.securityOverlay.copySingle');
		setOverlayItem(stopGroupChatSecurityOverlayItem);
		setOverlayActive(true);
	};

	const handleLeaveGroupChat = () => {
		setOverlayItem(leaveGroupChatSecurityOverlayItem);
		setOverlayActive(true);
	};

	const handleArchiveSession = () => {
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
						history.push(
							`${listPath}/${activeSession.item.groupId}/${activeSession.item.id}}`
						);
					} else {
						mobileListView();
						history.push(listPath);
					}
					setFlyoutOpen(false);
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
			// service and Rocket.Chat in case of a successful request, this ref
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
			const sessionGroupId = activeSession.item.groupId;

			apiPutArchive(sessionId)
				.then(() => {
					// Remove from current sessions list immediately
					sessionsDispatch({
						type: REMOVE_SESSIONS,
						ids: sessionGroupId ? [sessionGroupId] : [sessionId]
					});

					mobileListView();
					history.push(listPath);
				})
				.catch((error) => {
					// console.error(error);
				})
				.finally(() => {
					setOverlayActive(false);
					setOverlayItem(null);
					setIsRequestInProgress(false);
					setFlyoutOpen(false);
				});
		} else if (buttonFunction === 'GOTO_MANUAL') {
			history.push('/profile/hilfe/videoCall');
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

	// MATRIX MIGRATION: Handle sessions with and without groupId
	const hasGroupId = !!activeSession.item.groupId;
	const baseUrl = hasGroupId
		? `${listPath}/:groupId/:id/:subRoute?/:extraPath?${getSessionListTab()}`
		: `${listPath}/session/:id/:subRoute?/:extraPath?${getSessionListTab()}`;

	const groupChatInfoLink = hasGroupId
		? generatePath(baseUrl, {
				...(activeSession.item as TReducedSessionItemInterface),
				subRoute: 'groupChatInfo'
			})
		: '';
	const editGroupChatSettingsLink = hasGroupId
		? generatePath(baseUrl, {
				...(activeSession.item as TReducedSessionItemInterface),
				subRoute: 'editGroupChat'
			})
		: '';
	// MATRIX MIGRATION: Generate userProfileLink based on whether groupId exists
	const userProfileLink = hasGroupId
		? generatePath(baseUrl, {
				...(activeSession.item as TReducedSessionItemInterface),
				subRoute: 'userProfile'
			})
		: generatePath(baseUrl, {
				id: activeSession.item.id,
				subRoute: 'userProfile'
			});

	if (redirectToSessionsList) {
		mobileListView();
		return <Redirect to={listPath + getSessionListTab()} />;
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

	const contact = getContact(activeSession);
	const isAnonymousChat =
		activeSession.item.postcode === 0 ||
		activeSession.item.postcode?.toString() === '00000' ||
		(activeSession.item as any).registrationType === 'ANONYMOUS' ||
		contact?.username?.startsWith('Anonymous-') ||
		activeSession.user?.username?.startsWith('Anonymous-');
	const chatType: 'anonymous' | 'oneOnOne' | 'group' | 'supervision' =
		props.isSupervisor
			? 'supervision'
			: activeSession.isGroup
				? 'group'
				: isAnonymousChat
					? 'anonymous'
					: 'oneOnOne';

	const {
		featureCallsEnabled = true, // legacy master: keep honoring it
		featureAudioCallsEnabled = true,
		featureAudioCallsAnonymousChatsEnabled = true,
		featureAudioCallsOneOnOneChatsEnabled = true,
		featureAudioCallsGroupChatsEnabled = true,
		featureAudioCallsSupervisionChatsEnabled = true,
		featureVideoCallsEnabled = true,
		featureVideoCallsAnonymousChatsEnabled = true,
		featureVideoCallsOneOnOneChatsEnabled = true,
		featureVideoCallsGroupChatsEnabled = true,
		featureVideoCallsSupervisionChatsEnabled = true
	} = getTenantSettings();

	const isCallsEnabled = featureCallsEnabled !== false;

	const isAudioCallsEnabled =
		isCallsEnabled &&
		featureAudioCallsEnabled !== false &&
		(chatType === 'group'
			? featureAudioCallsGroupChatsEnabled !== false
			: chatType === 'anonymous'
				? featureAudioCallsAnonymousChatsEnabled !== false
				: chatType === 'supervision'
					? featureAudioCallsSupervisionChatsEnabled !== false
					: featureAudioCallsOneOnOneChatsEnabled !== false);

	const isVideoCallsEnabled =
		isCallsEnabled &&
		featureVideoCallsEnabled !== false &&
		(chatType === 'group'
			? featureVideoCallsGroupChatsEnabled !== false
			: chatType === 'anonymous'
				? featureVideoCallsAnonymousChatsEnabled !== false
				: chatType === 'supervision'
					? featureVideoCallsSupervisionChatsEnabled !== false
					: featureVideoCallsOneOnOneChatsEnabled !== false);

	const hasVideoCallFeatures = () =>
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
		(activeSession.isSession || activeSession.isGroup) && // 🎯 Enable for both 1-on-1 AND group chats
		type !== SESSION_LIST_TYPES.ENQUIRY &&
		consultingType.isVideoCallAllowed;

	const handleStartVideoCall = async (isVideoActivated: boolean = false) => {
		// console.log("═══════════════════════════════════════════════");
		// console.log("🎬 CALL BUTTON CLICKED!");
		// console.log("═══════════════════════════════════════════════");
		// console.log("Video activated?", isVideoActivated);
		// console.log("Is group chat?", activeSession.isGroup);

		try {
			// Get Matrix room ID from active session
			// For 1-on-1 sessions: use activeSession.rid (the actual Matrix room ID)
			// For group chats: use activeSession.item.matrixRoomId or groupId
			const roomId =
				activeSession.rid ||
				activeSession.item.matrixRoomId ||
				activeSession.item.groupId;

			// console.log("Room ID:", roomId);
			// console.log("activeSession.rid:", activeSession.rid);
			// console.log("activeSession.item.matrixRoomId:", activeSession.item.matrixRoomId);
			// console.log("activeSession.item.groupId:", activeSession.item.groupId);

			if (!roomId) {
				// console.error('❌ No Matrix room ID found for session');
				alert(
					'Cannot start call: No Matrix room found for this session'
				);
				return;
			}

			// 🍎 SAFARI iOS FIX: Check if we're on HTTPS (required for getUserMedia on Safari)
			if (window.location.protocol !== 'https:') {
				// console.error('❌ Not on HTTPS! Safari requires HTTPS for camera/microphone access');
				const httpsUrl = window.location.href.replace(
					'http://',
					'https://'
				);
				if (
					window.confirm(
						'Camera/microphone access requires HTTPS. Redirect to secure connection?'
					)
				) {
					window.location.href = httpsUrl;
				}
				return;
			}

			// 🔥 CRITICAL FOR MOBILE: Request media permissions IMMEDIATELY in click handler
			// This keeps the "user gesture" alive for mobile browsers (prevents popup blocking)
			// console.log('🎤 Requesting media permissions (SYNC with user click)...');
			// console.log('Requesting:', { video: isVideoActivated, audio: true });

			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: isVideoActivated,
					audio: true
				});
				// console.log('✅ Media permissions granted!', stream);
				// console.log('Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));

				if (activeSession.isGroup) {
					// Group calls use Element Call in an iframe (separate origin).
					// Release this warm-up stream so the device is not left open.
					try {
						stream
							.getTracks()
							.forEach((track: MediaStreamTrack) => track.stop());
					} catch {
						// ignore
					}
				} else {
					// 1:1 calls: FloatingCallWidget releases this before placeCall().
					(window as any).__preRequestedMediaStream = stream;
					(window as any).__preRequestedMediaStreamTime = Date.now();
				}
			} catch (mediaError: any) {
				// console.error('❌ Media permission denied:', mediaError);
				// console.error('Error name:', mediaError.name);
				// console.error('Error message:', mediaError.message);

				let errorMsg = 'Cannot access camera/microphone. ';
				if (mediaError.name === 'NotAllowedError') {
					errorMsg +=
						'Please grant permissions in your browser settings.';
				} else if (mediaError.name === 'NotFoundError') {
					errorMsg += 'No camera/microphone found on this device.';
				} else if (mediaError.name === 'NotSupportedError') {
					errorMsg +=
						'Your browser does not support this feature. Please use HTTPS.';
				} else {
					errorMsg += mediaError.message || 'Unknown error.';
				}

				alert(errorMsg);
				return;
			}

			// console.log('📞 Starting call via CallManager with roomId:', roomId);

			// Use CallManager directly (works for both 1-on-1 and group calls!)
			const { callManager } = require('../../services/CallManager');
			callManager.startCall(roomId, isVideoActivated);

			// console.log('✅ Call initiated!');
		} catch (error) {
			// console.error('💥 ERROR in handleStartVideoCall:', error);
			alert(
				`Call failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
		// console.log("═══════════════════════════════════════════════");
	};

	return (
		<div className="sessionMenu__wrapper">
			{hasVideoCallFeatures() &&
				!props.isSupervisor &&
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

			<span
				id="iconH"
				onClick={() => setFlyoutOpen(!flyoutOpen)}
				className="sessionMenu__icon sessionMenu__icon--desktop"
			>
				<MenuVerticalIcon
					title={translate('app.menu')}
					aria-label={translate('app.menu')}
				/>
			</span>
			<span
				id="iconV"
				onClick={() => setFlyoutOpen(!flyoutOpen)}
				className="sessionMenu__icon sessionMenu__icon--mobile"
			>
				<MenuVerticalIcon
					title={translate('app.menu')}
					aria-label={translate('app.menu')}
				/>
			</span>

			<div
				id="flyout"
				className={`sessionMenu__content ${
					flyoutOpen && 'sessionMenu__content--open'
				}`}
			>
				{/* REMOVED: Mobile dropdown video call items - now using desktop buttons on mobile too */}
				{false && hasVideoCallFeatures() && (
					<>
						<div
							className="sessionMenu__item sessionMenu__item--mobile"
							onClick={() => handleStartVideoCall(true)}
						>
							{translate('videoCall.button.startVideoCall')}
						</div>
						<div
							className="sessionMenu__item sessionMenu__item--mobile"
							onClick={() => handleStartVideoCall()}
						>
							{translate('videoCall.button.startCall')}
						</div>
					</>
				)}

				{props.isAskerInfoAvailable && (
					<Link className="sessionMenu__item" to={userProfileLink}>
						{translate('chatFlyout.askerProfil')}
					</Link>
				)}

				{props.showMobileSupervisionAction && (
					<div
						className="sessionMenu__item sessionMenu__item--mobile"
						onClick={() => {
							setFlyoutOpen(false);
							props.onMobileSupervisionAction?.();
						}}
					>
						{translate(
							'sessionHeader.supervisor.modal.title',
							'Supervisor verwalten'
						)}
					</div>
				)}

				{props.showMobileDeleteAnonymousAccountAction && (
					<div
						className={`sessionMenu__item sessionMenu__item--mobile ${
							props.mobileDeleteAnonymousAccountDisabled
								? 'sessionMenu__item--disabled'
								: ''
						}`}
						onClick={() => {
							if (props.mobileDeleteAnonymousAccountDisabled) {
								return;
							}
							setFlyoutOpen(false);
							props.onMobileDeleteAnonymousAccountAction?.();
						}}
					>
						{translate(
							'sessionHeader.anonymous.deleteAccount.label',
							'Konto löschen'
						)}
					</div>
				)}

				{!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
					type !== SESSION_LIST_TYPES.ENQUIRY &&
					activeSession.isSession &&
					!props.isSupervisor && (
						<>
							{sessionListTab !== SESSION_LIST_TAB_ARCHIVE ? (
								<div
									onClick={handleArchiveSession}
									className="sessionMenu__item"
								>
									{translate('chatFlyout.archive')}
								</div>
							) : (
								<div
									onClick={handleDearchiveSession}
									className="sessionMenu__item"
								>
									{translate('chatFlyout.dearchive')}
								</div>
							)}
						</>
					)}

				{hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
					type !== SESSION_LIST_TYPES.ENQUIRY &&
					activeSession.isSession &&
					!props.isSupervisor && (
						<DeleteSession
							chatId={activeSession.item.id}
							onSuccess={onSuccessDeleteSession}
						>
							{(onClick) => (
								<div
									onClick={onClick}
									className="sessionMenu__item"
								>
									{translate('chatFlyout.remove')}
								</div>
							)}
						</DeleteSession>
					)}

				{activeSession.isGroup && (
					<SessionMenuFlyoutGroup
						editGroupChatSettingsLink={editGroupChatSettingsLink}
						groupChatInfoLink={groupChatInfoLink}
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
						{(label, url) => (
							<a href={url} target="_blank" rel="noreferrer">
								<Text
									type="infoLargeAlternative"
									text={label}
								/>
							</a>
						)}
					</LegalLinks>
				</div>
			</div>
			{overlayActive && (
				<Overlay
					item={overlayItem}
					handleOverlay={handleOverlayAction}
				/>
			)}
		</div>
	);
};

const VideoCallHeaderIcon = () => (
	<svg
		width="32"
		height="32"
		viewBox="0 0 32 32"
		fill="none"
		aria-hidden="true"
	>
		<rect width="32" height="32" rx="12" fill="#D32F2F" fillOpacity="0.6" />
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M18.3152 11.0601C18.9972 11.0601 19.5502 11.613 19.5502 12.295L19.55 14.7022L22.4928 11.7595C22.7822 11.4702 23.2514 11.4702 23.5407 11.7595C23.6797 11.8985 23.7578 12.087 23.7578 12.2835V19.7166C23.7578 20.1258 23.426 20.4575 23.0168 20.4575C22.8203 20.4575 22.6318 20.3795 22.4928 20.2405L19.55 17.2971L19.5502 19.705C19.5502 20.3871 18.9972 20.94 18.3152 20.94H9.47815C8.79609 20.94 8.24316 20.3871 8.24316 19.705V12.295C8.24316 11.613 8.79609 11.0601 9.47815 11.0601H18.3152Z"
			fill="white"
		/>
	</svg>
);

const AudioCallHeaderIcon = () => (
	<svg
		width="32"
		height="32"
		viewBox="0 0 32 32"
		fill="none"
		aria-hidden="true"
	>
		<rect width="32" height="32" rx="16" fill="#FFD1D1" fillOpacity="0.6" />
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M22.7439 18.2098L19.8713 17.316C19.2285 17.1155 18.4628 17.4268 18.0513 18.0551C17.7168 18.5651 17.1871 18.9385 16.6341 19.0538C16.255 19.1326 15.8991 19.0798 15.6319 18.9054C14.4495 18.1327 13.4566 17.1427 12.6816 15.9644C12.5066 15.6977 12.4533 15.343 12.5327 14.9651C12.648 14.4139 13.0225 13.8858 13.5348 13.552C14.1643 13.1416 14.4761 12.3788 14.2756 11.7377L13.3789 8.87442C13.1807 8.23973 12.5344 7.88558 11.8423 8.03338L9.08566 8.61996C9.02712 8.63214 8.96858 8.64779 8.91062 8.66749L8.79585 8.7098C8.76107 8.7243 8.72514 8.74168 8.68804 8.76197C8.26782 8.9915 7.99771 9.43607 8.00001 9.89455C8.00351 10.4927 8.04002 11.0903 8.10842 11.6723L8.08349 11.8722L8.08407 11.8734L8.14146 11.9308C8.55357 14.9802 9.84671 17.6627 11.887 19.6972C13.9707 21.7745 16.7309 23.074 19.8707 23.4565C20.4706 23.5296 21.0879 23.5684 21.7052 23.5725C21.7075 23.5725 21.7099 23.5725 21.7127 23.5725C22.184 23.5725 22.6482 23.2874 22.8708 22.8595C22.8853 22.8306 22.8987 22.8028 22.9097 22.7761C22.9485 22.6828 22.9787 22.5859 22.9989 22.4909L23.5872 19.7412C23.7345 19.0514 23.3797 18.4075 22.7439 18.2098Z"
			fill="#CC1E1C"
			fillOpacity="0.6"
		/>
	</svg>
);

const SessionMenuFlyoutGroup = ({
	groupChatInfoLink,
	editGroupChatSettingsLink,
	handleLeaveGroupChat,
	handleStopGroupChat,
	bannedUsers
}: {
	groupChatInfoLink: string;
	editGroupChatSettingsLink: string;
	handleStopGroupChat: MouseEventHandler;
	handleLeaveGroupChat: MouseEventHandler;
	bannedUsers: string[];
}) => {
	const { t: translate } = useTranslation();
	const { userData } = useContext(UserDataContext);
	const { activeSession } = useContext(ActiveSessionContext);
	// MATRIX MIGRATION: RocketChatUsersOfRoomContext may be null for Matrix rooms, use fallback
	const rcUsersContext = useContext(RocketChatUsersOfRoomContext);
	const moderators = rcUsersContext?.moderators || [];

	return (
		<>
			{activeSession.item.subscribed &&
				!bannedUsers?.includes(userData.userName) &&
				moderators.length > 1 && (
					<div
						onClick={handleLeaveGroupChat}
						className="sessionMenu__item sessionMenu__button"
					>
						<span className="sessionMenu__icon">
							<LeaveChatIcon
								title={translate('chatFlyout.leaveGroupChat')}
								aria-label={translate(
									'chatFlyout.leaveGroupChat'
								)}
							/>
							{translate('chatFlyout.leaveGroupChat')}
						</span>
					</div>
				)}
			{hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) && (
				<Link
					to={groupChatInfoLink}
					className="sessionMenu__item sessionMenu__button"
				>
					<span className="sessionMenu__icon">
						<GroupChatInfoIcon />
						{translate('chatFlyout.groupChatInfo')}
					</span>
				</Link>
			)}
			{activeSession.item.subscribed &&
				hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) && (
					<div
						onClick={handleStopGroupChat}
						className="sessionMenu__item sessionMenu__button"
					>
						<span className="sessionMenu__icon">
							<StopGroupChatIcon
								title={translate('chatFlyout.stopGroupChat')}
								aria-label={translate(
									'chatFlyout.stopGroupChat'
								)}
							/>
							{translate('chatFlyout.stopGroupChat')}
						</span>
					</div>
				)}
			{isGroupChatOwner(activeSession, userData) &&
				!activeSession.item.active && (
					<Link
						to={{
							pathname: editGroupChatSettingsLink,
							state: {
								isEditMode: true,
								prevIsInfoPage: false
							}
						}}
						className="sessionMenu__item sessionMenu__button"
					>
						<span className="sessionMenu__icon">
							<EditGroupChatIcon
								title={translate('chatFlyout.editGroupChat')}
								aria-label={translate(
									'chatFlyout.editGroupChat'
								)}
							/>
							{translate('chatFlyout.editGroupChat')}
						</span>
					</Link>
				)}
		</>
	);
};
