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
import { BackIcon, CameraOnIcon, GroupChatInfoIcon } from '../../../resources/img/icons';
import { ReactComponent as VideoCallIcon } from '../../../resources/img/illustrations/camera.svg';
import { ReactComponent as CallOnIcon } from '../../../resources/img/icons/call-on.svg';
import { SessionMenu } from '../../sessionMenu/SessionMenu';
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
	const matrixRoomId = activeSession.item.matrixRoomId || activeSession.item.groupId;
	
	useEffect(() => {
		console.log('🔍 GroupChatHeader: Fetching Matrix members for room:', matrixRoomId);
		setIsLoadingMembers(true);
		
		if (!matrixRoomId) {
			console.log('❌ GroupChatHeader: No matrixRoomId found');
			setMatrixMembers([]);
			setIsLoadingMembers(false);
			return;
		}
		
		// Try to get Matrix client (from global window or imported service)
		const getClient = () => {
			const globalService = (window as any).matrixClientService;
			if (globalService && globalService.getClient()) {
				return globalService.getClient();
			}
			return matrixClientService.getClient();
		};
		
		// Wait for Matrix client to be available (retry up to 20 times = 10 seconds)
		let retryCount = 0;
		const maxRetries = 20;
		
		const tryLoadMembers = () => {
			const client = getClient();
			
			if (!client) {
				retryCount++;
				if (retryCount < maxRetries) {
					console.log(`⏳ GroupChatHeader: Matrix client not ready yet, retrying... (${retryCount}/${maxRetries})`);
					setTimeout(tryLoadMembers, 500);
					return;
				} else {
					console.log('❌ GroupChatHeader: Matrix client not available after retries');
					setMatrixMembers([]);
					setIsLoadingMembers(false);
					return;
				}
			}
			
			console.log('✅ GroupChatHeader: Matrix client found, getting room...');
			const room = client.getRoom(matrixRoomId);
			
			if (!room) {
				console.log('⏳ GroupChatHeader: Room not found yet, waiting for sync...');
				console.log('📋 Available rooms:', client.getRooms().map((r: any) => r.roomId));
				
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
							console.log('❌ GroupChatHeader: Room not found after waiting:', matrixRoomId);
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
			const members = room.getJoinedMembers();
			console.log('✅ GroupChatHeader: Found', members?.length || 0, 'members:', members?.map((m: any) => m.userId || m.name));
			setMatrixMembers(members || []);
			setIsLoadingMembers(false);
			
			// Poll for member changes every 5 seconds
			const intervalId = setInterval(() => {
				const client = getClient();
				if (client) {
					const updatedRoom = client.getRoom(matrixRoomId);
					if (updatedRoom) {
						const updatedMembers = updatedRoom.getJoinedMembers();
						if (updatedMembers?.length !== matrixMembers.length) {
							console.log('🔄 GroupChatHeader: Members updated:', updatedMembers?.length);
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
		console.log("═══════════════════════════════════════════════");
		console.log("🎬 GROUP CALL BUTTON CLICKED (GroupChatHeader)!");
		console.log("═══════════════════════════════════════════════");
		
		try {
			const roomId = activeSession.item.matrixRoomId || activeSession.item.groupId;
			
			if (!roomId) {
				console.error('❌ No Matrix room ID found for session');
				alert('Cannot start call: No Matrix room found for this session');
				return;
			}

			// Check HTTPS
			if (window.location.protocol !== 'https:') {
				console.error('❌ Not on HTTPS! Safari requires HTTPS for camera/microphone access');
				const httpsUrl = window.location.href.replace('http://', 'https://');
				if (window.confirm('Camera/microphone access requires HTTPS. Redirect to secure connection?')) {
					window.location.href = httpsUrl;
				}
				return;
			}

			// Request media permissions IMMEDIATELY in click handler
			console.log('🎤 Requesting media permissions (SYNC with user click)...');
			
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ 
					video: isVideoActivated, 
					audio: true 
				});
				console.log('✅ Media permissions granted!', stream);
				
				// Store stream globally
				(window as any).__preRequestedMediaStream = stream;
				(window as any).__preRequestedMediaStreamTime = Date.now();
			} catch (mediaError: any) {
				console.error('❌ Media permission denied:', mediaError);
				
				let errorMsg = 'Cannot access camera/microphone. ';
				if (mediaError.name === 'NotAllowedError') {
					errorMsg += 'Please grant permissions in your browser settings.';
				} else if (mediaError.name === 'NotFoundError') {
					errorMsg += 'No camera/microphone found on this device.';
				} else if (mediaError.name === 'NotSupportedError') {
					errorMsg += 'Your browser does not support this feature. Please use HTTPS.';
				} else {
					errorMsg += mediaError.message || 'Unknown error.';
				}
				
				alert(errorMsg);
				return;
			}

			console.log('📞 Starting call via CallManager with roomId:', roomId);
			console.log('🎯 This is a GROUP CHAT - forcing isGroup=true');
			
			// Use CallManager (works for both 1-on-1 and group calls!)
			const { callManager } = require('../../../services/CallManager');
			callManager.startCall(roomId, isVideoActivated, true); // Force isGroup=true for group chats
			
			console.log('✅ Call initiated!');
		} catch (error) {
			console.error('💥 ERROR in handleStartVideoCall:', error);
			alert(`Call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
		console.log("═══════════════════════════════════════════════");
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
		smallIconBackgroundColor: 'grey',
		icon: (
			<CallOnIcon
				title={t('videoCall.button.startCall')}
				aria-label={t('videoCall.button.startCall')}
			/>
		)
	};

	// Video call button
	const buttonStartVideoCall: ButtonItem = {
		type: BUTTON_TYPES.SMALL_ICON,
		title: t('videoCall.button.startVideoCall'),
		smallIconBackgroundColor: 'grey',
		icon: (
			<CameraOnIcon
				title={t('videoCall.button.startVideoCall')}
				aria-label={t('videoCall.button.startVideoCall')}
			/>
		)
	};

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
						<div className="sessionInfo__groupIcon">
						<div className="sessionsListItem__stackedAvatars">
	{/* Always render 2 avatar placeholders */}
	{[0, 1].map((_, index) => (
		<div
			key={index}
			className="sessionsListItem__avatarWrapper"
		>
			<UserAvatar
				username={`placeholder-${index}`}
				displayName="User"
				userId={`placeholder-${index}`}
				size="32px"
			/>
		</div>
	))}

	{/* Optional third circle */}
	<div className="sessionsListItem__avatarWrapper sessionsListItem__avatarWrapper--plus">
		<div className="sessionsListItem__plusAvatar">+1</div>
	</div>
</div>
						</div>
						<h3>{typeof activeSession.item.topic === 'string' ? activeSession.item.topic : activeSession.item.topic?.name || ''}</h3>
					</div>
					{/* Matrix room participants */}
					{isLoadingMembers ? (
						<div className="sessionInfo__participants sessionInfo__participants--loading">
							<div className="sessionInfo__participants__skeleton"></div>
						</div>
					) : matrixMembers.length > 0 ? (
						<div className="sessionInfo__participants">
							{matrixMembers
								.filter(member => {
									// Filter out system users and current user if needed
									const userId = member.userId || '';
									return !userId.includes('@system') && !userId.includes('@caritas.local');
								})
								.map((member, index, filteredMembers) => {
									// Extract username from userId (format: @username:domain)
									// Always use username from userId, ignore member.name to ensure consistency
									const userId = member.userId || '';
									const username = userId.split(':')[0]?.replace('@', '') || userId;
									return (
										<span key={member.userId || index} className="sessionInfo__participant">
											{decodeUsername(username)}
											{index < filteredMembers.length - 1 && ', '}
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
					isConsultant && (
						<div
							className="sessionInfo__videoCallButtons"
							data-cy="session-header-video-call-buttons"
						>
							<Button
								buttonHandle={() => handleStartVideoCall(true)}
								item={buttonStartVideoCall}
							/>
							<Button
								buttonHandle={() => handleStartVideoCall(false)}
								item={buttonStartCall}
							/>
						</div>
					)}

				{/* MATRIX MIGRATION: Temporarily hide session menu for group chats */}
				{false && <SessionMenu
					hasUserInitiatedStopOrLeaveRequest={
						hasUserInitiatedStopOrLeaveRequest
					}
					isAskerInfoAvailable={isAskerInfoAvailable()}
					isJoinGroupChatView={isJoinGroupChatView}
					bannedUsers={bannedUsers}
				/>}
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