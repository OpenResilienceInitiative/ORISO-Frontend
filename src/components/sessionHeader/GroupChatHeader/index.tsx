import React, { useContext, useState, useEffect } from 'react';
import { Link, generatePath } from 'react-router-dom';
import {
	AUTHORITIES,
	SessionTypeContext,
	UserDataContext,
	getContact,
	hasUserAuthority,
	useConsultingType,
	ActiveSessionContext
} from '../../../globalState';
import { useSearchParam } from '../../../hooks/useSearchParams';
import {
	SESSION_LIST_TAB,
	SESSION_LIST_TYPES,
	getViewPathForType,
	isUserModerator
} from '../../session/sessionHelpers';
import { isMobile } from 'react-device-detect';
import { mobileListView } from '../../app/navigationHandler';
import { BackIcon, GroupChatInfoIcon } from '../../../resources/img/icons';
import { useTranslation } from 'react-i18next';
import { getGroupChatDate } from '../../session/sessionDateHelpers';
import { getValueFromCookie } from '../../sessionCookie/accessSessionCookie';
import { decodeUsername } from '../../../utils/encryptionHelpers';
import { FlyoutMenu } from '../../flyoutMenu/FlyoutMenu';
import { BanUser, BanUserOverlay } from '../../banUser/BanUser';
import { Tag } from '../../tag/Tag';
import { BUTTON_TYPES, Button, ButtonItem } from '../../button/Button';
import { useAppConfig } from '../../../hooks/useAppConfig';
import { SessionItemInterface } from '../../../globalState/interfaces';
import { matrixClientService } from '../../../services/matrixClientService';
import { RoomMember } from 'matrix-js-sdk';
import { UserAvatar } from '../../message/UserAvatar';
import { getTenantSettings } from '../../../utils/tenantSettingsHelper';

interface GroupChatHeaderProps {
	hasUserInitiatedStopOrLeaveRequest: React.MutableRefObject<boolean>;
	isJoinGroupChatView: boolean;
	bannedUsers: string[];
}

export const GroupChatHeader = ({
	hasUserInitiatedStopOrLeaveRequest,
	isJoinGroupChatView,
	bannedUsers
}: GroupChatHeaderProps) => {
	const { releaseToggles } = useAppConfig();

	const [isUserBanOverlayOpen, setIsUserBanOverlayOpen] =
		useState<boolean>(false);
	const { t } = useTranslation(['common', 'consultingTypes', 'agencies']);
	const { activeSession } = useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);

	// MATRIX: Get room members from Matrix client
	const [matrixMembers, setMatrixMembers] = useState<RoomMember[]>([]);
	const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(true);
	const matrixRoomId =
		activeSession.item.matrixRoomId || activeSession.item.groupId;

	useEffect(() => {
		// console.log('🔍 GroupChatHeader: Fetching Matrix members for room:', matrixRoomId);
		setIsLoadingMembers(true);

		if (!matrixRoomId) {
			// console.log('❌ GroupChatHeader: No matrixRoomId found');
			setMatrixMembers([]);
			setIsLoadingMembers(false);
			return;
		}

		// Try to get Matrix client (from global window or imported service)
		const getClient = () => matrixClientService.getClient();

		// Wait for Matrix client to be available (retry up to 20 times = 10 seconds)
		let retryCount = 0;
		const maxRetries = 20;

		const tryLoadMembers = () => {
			const client = getClient();

			if (!client) {
				retryCount++;
				if (retryCount < maxRetries) {
					// console.log(`⏳ GroupChatHeader: Matrix client not ready yet, retrying... (${retryCount}/${maxRetries})`);
					setTimeout(tryLoadMembers, 500);
					return;
				} else {
					// console.log('❌ GroupChatHeader: Matrix client not available after retries');
					setMatrixMembers([]);
					setIsLoadingMembers(false);
					return;
				}
			}

			// console.log('✅ GroupChatHeader: Matrix client found, getting room...');
			const room = client.getRoom(matrixRoomId);

			if (!room) {
				// console.log('⏳ GroupChatHeader: Room not found yet, waiting for sync...');
				// console.log('📋 Available rooms:', client.getRooms().map((r: any) => r.roomId));

				// Wait for room to appear (up to 10 seconds)
				let roomRetryCount = 0;
				const maxRoomRetries = 20;

				const tryGetRoom = () => {
					const updatedRoom = client.getRoom(matrixRoomId);
					if (updatedRoom) {
						loadMembers(updatedRoom);
					} else {
						roomRetryCount++;
						if (roomRetryCount < maxRoomRetries) {
							setTimeout(tryGetRoom, 500);
						} else {
							// console.log('❌ GroupChatHeader: Room not found after waiting:', matrixRoomId);
							setMatrixMembers([]);
							setIsLoadingMembers(false);
						}
					}
				};

				setTimeout(tryGetRoom, 500);
				return;
			}

			loadMembers(room);
		};

		const loadMembers = (room: any) => {
			// Get joined members
			const allMembers = room.getJoinedMembers();

			// Filter supervisors from member list (supervisors have power level 10)
			const activeMembers = allMembers.filter((m: any) => {
				try {
					const powerLevel =
						room.getMember(m.userId)?.powerLevel || 0;
					return powerLevel !== 10; // Exclude supervisors (power level 10)
				} catch (err) {
					return true; // Include if we can't determine power level
				}
			});

			// console.log('✅ GroupChatHeader: Found', allMembers?.length || 0, 'total members,', activeMembers?.length || 0, 'active members:', activeMembers?.map((m: any) => m.userId || m.name));
			setMatrixMembers(activeMembers || []);
			setIsLoadingMembers(false);

			// Poll for member changes every 5 seconds
			const intervalId = setInterval(() => {
				const client = getClient();
				if (client) {
					const updatedRoom = client.getRoom(matrixRoomId);
					if (updatedRoom) {
						const updatedMembers = updatedRoom.getJoinedMembers();
						if (updatedMembers?.length !== matrixMembers.length) {
							// console.log('🔄 GroupChatHeader: Members updated:', updatedMembers?.length);
							setMatrixMembers(updatedMembers || []);
						}
					}
				}
			}, 5000);

			// Store interval ID for cleanup
			(window as any).__groupChatHeaderInterval = intervalId;
		};

		// Start trying to load members
		tryLoadMembers();

		return () => {
			const intervalId = (window as any).__groupChatHeaderInterval;
			if (intervalId) {
				clearInterval(intervalId);
				delete (window as any).__groupChatHeaderInterval;
			}
		};
	}, [matrixRoomId, matrixMembers.length]);
	const { type, path: listPath } = useContext(SessionTypeContext);
	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');
	const sessionView = getViewPathForType(type);
	const consultingType = useConsultingType(activeSession.item.consultingType);
	const [flyoutOpenId, setFlyoutOpenId] = useState('');
	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);

	// Use CallManager for group calls (same as SessionMenu)
	const handleStartVideoCall = async (isVideoActivated: boolean = true) => {
		// console.log("═══════════════════════════════════════════════");
		// console.log("🎬 GROUP CALL BUTTON CLICKED (GroupChatHeader)!");
		// console.log("═══════════════════════════════════════════════");

		try {
			const roomId =
				activeSession.item.matrixRoomId || activeSession.item.groupId;

			if (!roomId) {
				// console.error('❌ No Matrix room ID found for session');
				alert(
					'Cannot start call: No Matrix room found for this session'
				);
				return;
			}

			// Check HTTPS
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

			// Request media permissions IMMEDIATELY in click handler
			// console.log('🎤 Requesting media permissions (SYNC with user click)...');

			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: isVideoActivated,
					audio: true
				});
				// console.log('✅ Media permissions granted!', stream);

				// Group calls render Element Call in an iframe which acquires its
				// own media (on its own origin). Release this warm-up stream so
				// the camera/mic don't stay on in the parent page.
				try {
					stream
						.getTracks()
						.forEach((track: MediaStreamTrack) => track.stop());
				} catch {
					// ignore
				}
			} catch (mediaError: any) {
				// console.error('❌ Media permission denied:', mediaError);

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
			// console.log('🎯 This is a GROUP CHAT - forcing isGroup=true');

			// Use CallManager (works for both 1-on-1 and group calls!)
			const { callManager } = require('../../../services/CallManager');
			callManager.startCall(roomId, isVideoActivated, true); // Force isGroup=true for group chats

			// console.log('✅ Call initiated!');
		} catch (error) {
			// console.error('💥 ERROR in handleStartVideoCall:', error);
			alert(
				`Call failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
		// console.log("═══════════════════════════════════════════════");
	};

	const sessionTabPath = `${
		sessionListTab ? `?sessionListTab=${sessionListTab}` : ''
	}`;

	const isCurrentUserModerator = isUserModerator({
		chatItem: activeSession.item,
		rcUserId: getValueFromCookie('rc_uid')
	});

	const userSessionData = getContact(activeSession)?.sessionData || {};
	const isAskerInfoAvailable = () =>
		!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
		consultingType?.showAskerProfile &&
		activeSession.isSession &&
		((type === SESSION_LIST_TYPES.ENQUIRY &&
			Object.entries(userSessionData).length !== 0) ||
			SESSION_LIST_TYPES.ENQUIRY !== type);

	const [isSubscriberFlyoutOpen, setIsSubscriberFlyoutOpen] = useState(false);

	const handleFlyout = (e) => {
		if (!isSubscriberFlyoutOpen) {
			setIsSubscriberFlyoutOpen(true);
		} else if (e.target.id === 'subscriberButton') {
			setIsSubscriberFlyoutOpen(false);
		}
	};

	// Voice call button
	const buttonStartCall: ButtonItem = {
		type: BUTTON_TYPES.SMALL_ICON,
		title: t('videoCall.button.startCall'),
		smallIconBackgroundColor: 'transparent',
		icon: <AudioCallHeaderIcon />
	};

	// Video call button
	const buttonStartVideoCall: ButtonItem = {
		type: BUTTON_TYPES.SMALL_ICON,
		title: t('videoCall.button.startVideoCall'),
		smallIconBackgroundColor: 'transparent',
		icon: <VideoCallHeaderIcon />
	};

	const {
		featureCallsEnabled = true, // legacy master: keep honoring it
		featureAudioCallsEnabled = true,
		featureAudioCallsGroupChatsEnabled = true,
		featureVideoCallsEnabled = true,
		featureVideoCallsGroupChatsEnabled = true
	} = getTenantSettings();

	const isCallsEnabled = featureCallsEnabled !== false;
	const isAudioCallsEnabled =
		isCallsEnabled &&
		featureAudioCallsEnabled !== false &&
		featureAudioCallsGroupChatsEnabled !== false;
	const isVideoCallsEnabled =
		isCallsEnabled &&
		featureVideoCallsEnabled !== false &&
		featureVideoCallsGroupChatsEnabled !== false;

	const isActive = activeSession.item.active;
	const getSessionListTab = () =>
		`${sessionListTab ? `?sessionListTab=${sessionListTab}` : ''}`;
	const baseUrl = `${listPath}/:groupId/:id/:subRoute?/:extraPath?${getSessionListTab()}`;
	const groupChatInfoLink = generatePath(baseUrl, {
		...(activeSession.item as Omit<
			SessionItemInterface,
			'attachment' | 'topic' | 'e2eLastMessage' | 'videoCallMessageDTO'
		>),
		subRoute: 'groupChatInfo'
	});
	const visibleMembers = matrixMembers.filter((member) => {
		const userId = member.userId || '';
		return (
			!userId.includes('@system') && !userId.includes('@caritas.local')
		);
	});
	const stackedMembers = visibleMembers.slice(0, 3);

	return (
		<div className="sessionInfo">
			<div className="sessionInfo__headerWrapper">
				<Link
					to={listPath + sessionTabPath}
					onClick={mobileListView}
					className="sessionInfo__backButton"
				>
					<BackIcon />
				</Link>
				<div className="sessionInfo__username sessionInfo__username--deactivate sessionInfo__username--groupChat">
					<div className="sessionInfo__titleRow">
						<div className="sessionInfo__memberStack">
							{/* No supervisor "+" on group chats — supervision
							    is only offered for 1-on-1 chats. */}
							{stackedMembers.map((member, index) => {
								const userId = member.userId || '';
								const parsedUsername =
									userId.split(':')[0]?.replace('@', '') ||
									userId;
								const displayName = decodeUsername(
									member.name || parsedUsername
								);
								return (
									<div
										key={
											member.userId ||
											`${parsedUsername}-${index}`
										}
										className="sessionInfo__memberBubble"
										style={{ zIndex: 20 - index }}
									>
										<UserAvatar
											username={parsedUsername}
											displayName={displayName}
											userId={
												member.userId || parsedUsername
											}
											size="32px"
										/>
									</div>
								);
							})}
						</div>
						<h3>
							{typeof activeSession.item.topic === 'string'
								? activeSession.item.topic
								: activeSession.item.topic?.name || ''}
						</h3>
					</div>
					{/* Matrix room participants */}
					{isLoadingMembers ? (
						<div className="sessionInfo__participants sessionInfo__participants--loading">
							<div className="sessionInfo__participants__skeleton"></div>
						</div>
					) : visibleMembers.length > 0 ? (
						<div className="sessionInfo__participants">
							{visibleMembers.map((member, index) => {
								// Extract username from userId (format: @username:domain)
								// Always use username from userId, ignore member.name to ensure consistency
								const userId = member.userId || '';
								const username =
									userId.split(':')[0]?.replace('@', '') ||
									userId;
								return (
									<span
										key={member.userId || index}
										className="sessionInfo__participant"
									>
										{decodeUsername(username)}
										{index < visibleMembers.length - 1 &&
											', '}
									</span>
								);
							})}
						</div>
					) : null}
				</div>

				{(!isActive || isJoinGroupChatView) && isConsultant && (
					<Link
						to={groupChatInfoLink}
						className="sessionMenu__item--desktop sessionMenu__button"
					>
						<span className="sessionMenu__icon">
							<GroupChatInfoIcon />
							{t('chatFlyout.groupChatInfo')}
						</span>
					</Link>
				)}

				{isActive &&
					!isJoinGroupChatView &&
					(isAudioCallsEnabled || isVideoCallsEnabled) &&
					isConsultant && (
						<div
							className="sessionInfo__videoCallButtons"
							data-cy="session-header-video-call-buttons"
						>
							{isVideoCallsEnabled && (
								<Button
									buttonHandle={() =>
										handleStartVideoCall(true)
									}
									item={buttonStartVideoCall}
								/>
							)}
							{isAudioCallsEnabled && (
								<Button
									buttonHandle={() =>
										handleStartVideoCall(false)
									}
									item={buttonStartCall}
								/>
							)}
						</div>
					)}

				{/* Group header uses only inline call controls; hide flyout 3-dot menu here. */}
			</div>
			{/* <div className="sessionInfo__metaInfo">
			{activeSession.item.active &&
				activeSession.item.subscribed &&
				!isJoinGroupChatView && (
						<div
							className="sessionInfo__metaInfo__content sessionInfo__metaInfo__content--clickable"
							id="subscriberButton"
							onClick={(e) => handleFlyout(e)}
						>
							{t('groupChat.active.sessionInfo.subscriber')}
							{isSubscriberFlyoutOpen && (
								<div className="sessionInfo__metaInfo__flyout">
									<ul>
										{users.map((subscriber, index) => (
											<li
												className={
													isCurrentUserModerator &&
													!bannedUsers.includes(
														subscriber.username
													) &&
													!moderators.includes(
														subscriber._id
													)
														? 'has-flyout'
														: ''
												}
												key={`subscriber-${subscriber._id}`}
												onClick={() => {
													if (
														!bannedUsers.includes(
															subscriber.username
														)
													) {
														setFlyoutOpenId(
															subscriber._id
														);
													}
												}}
											>
												<span>
													{decodeUsername(
														subscriber.displayName ||
															subscriber.username
													)}
												</span>
												{isCurrentUserModerator &&
													!moderators.includes(
														subscriber._id
													) && (
														<>
															<FlyoutMenu
																isHidden={bannedUsers.includes(
																	subscriber.username
																)}
																position={
																	window.innerWidth <=
																	520
																		? 'left'
																		: 'right'
																}
																isOpen={
																	flyoutOpenId ===
																	subscriber._id
																}
																handleClose={() =>
																	setFlyoutOpenId(
																		null
																	)
																}
															>
																<BanUser
																	userName={decodeUsername(
																		subscriber.username
																	)}
																	rcUserId={
																		subscriber._id
																	}
																	chatId={
																		activeSession
																			.item
																			.id
																	}
																	handleUserBan={() => {
																		setIsUserBanOverlayOpen(
																			true
																		);
																	}}
																/>
															</FlyoutMenu>{' '}
															<BanUserOverlay
																overlayActive={
																	isUserBanOverlayOpen
																}
																userName={decodeUsername(
																	subscriber.username
																)}
																handleOverlay={() => {
																	setIsUserBanOverlayOpen(
																		false
																	);
																}}
															></BanUserOverlay>
														</>
													)}
												{isCurrentUserModerator &&
													bannedUsers.includes(
														subscriber.username
													) && (
														<Tag
															className="bannedUserTag"
															color="red"
															text={t(
																'banUser.is.banned'
															)}
														/>
													)}
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
					)}
			</div> */}
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
