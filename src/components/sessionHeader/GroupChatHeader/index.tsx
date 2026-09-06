import React, { useContext, useMemo, useRef, useState, useEffect } from 'react';
import { Link, generatePath } from 'react-router-dom';
import {
	AUTHORITIES,
	SessionTypeContext,
	UserDataContext,
	hasUserAuthority,
	ActiveSessionContext
} from '../../../globalState';
import { useSearchParam } from '../../../hooks/useSearchParams';
import { SESSION_LIST_TAB } from '../../session/sessionHelpers';
import { mobileListView } from '../../app/navigationHandler';
import { BackIcon, GroupChatInfoIcon } from '../../../resources/img/icons';
import { useTranslation } from 'react-i18next';
import { decodeUsername } from '../../../utils/encryptionHelpers';
import { BUTTON_TYPES, Button, ButtonItem } from '../../button/Button';
import { useMatrixClient } from '../../../globalState/context/MatrixClientContext';
import { RoomMember } from 'matrix-js-sdk';
import { MemberAvatarStack, StackMember } from '../MemberAvatarStack';
import { chatTransportService } from '../../../services/chatTransportService';
import {
	ActivityMap,
	getLastActivityByUserId,
	sortMembersByActivity
} from './memberActivity';
import { getTenantSettings } from '../../../utils/tenantSettingsHelper';
import { stopMediaStreamTracks } from '../../../utils/callMediaStreamCleanup';
import { ChatroomMainInteractionIcon } from '../ChatroomMainInteractionIcon';
import { groupChatCallCapabilities } from './groupChatCallCapabilities';
import { SessionMenu } from '../../sessionMenu/SessionMenu';
import { shouldShowGroupChatMenu } from './groupChatHeaderMenu';
import { getModality, Modality } from '../../session/getModality';
import { isSystemMatrixUser } from '../../../utils/systemMatrixUsers';

// Width of the title row taken by the type pill (incl. "+" button), the flex
// gaps and a minimum for the room title; the avatar stack gets the rest.
const TITLE_ROW_RESERVED_WIDTH = 76 + 12 * 2 + 140;

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
	const { t } = useTranslation(['common', 'consultingTypes', 'agencies']);
	const { activeSession } = useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);
	const { matrixClientService } = useMatrixClient();

	// MATRIX: room members + per-member latest activity (#1193 Job 1).
	// The header subscribes to membership and timeline events instead of
	// polling, so the avatar order updates live without a page reload.
	const [matrixMembers, setMatrixMembers] = useState<RoomMember[]>([]);
	const [memberActivity, setMemberActivity] = useState<ActivityMap>(
		() => new Map()
	);
	const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(true);
	const titleRowRef = useRef<HTMLDivElement>(null);
	const matrixRoomId = activeSession.item.matrixRoomId;

	useEffect(() => {
		setIsLoadingMembers(true);

		if (!matrixRoomId) {
			setMatrixMembers([]);
			setMemberActivity(new Map());
			setIsLoadingMembers(false);
			return;
		}

		let cancelled = false;
		let subscribed = false;
		let offMembers: (() => void) | null = null;
		let offTimeline: (() => void) | null = null;
		let retryTimer: number | null = null;
		const detachers: Array<() => void> = [];

		// Read joined members (minus supervisors, power level 10) and the latest
		// timeline timestamp per sender. Returns false while the client/room is
		// not synced yet.
		const readRoom = (): boolean => {
			const client = matrixClientService?.getClient?.();
			const room = client?.getRoom?.(matrixRoomId);
			if (!room) {
				return false;
			}
			const joined: RoomMember[] = room.getJoinedMembers?.() || [];
			const activeMembers = joined.filter((m: RoomMember) => {
				try {
					return (room.getMember(m.userId)?.powerLevel || 0) !== 10;
				} catch (err) {
					return true; // Include if we can't determine power level
				}
			});
			if (!cancelled) {
				setMatrixMembers(activeMembers);
				setMemberActivity(getLastActivityByUserId(room));
				setIsLoadingMembers(false);
			}
			return true;
		};

		// Idempotent per channel: a retry only registers the channel that is
		// not attached yet, so the header never holds duplicate listeners.
		const subscribe = (): boolean => {
			if (!offMembers) {
				offMembers = chatTransportService.onMatrixRoomMembers(
					matrixRoomId,
					readRoom
				);
				if (offMembers) detachers.push(offMembers);
			}
			if (!offTimeline) {
				offTimeline = chatTransportService.onMatrixTimelineRaw(
					matrixRoomId,
					readRoom
				);
				if (offTimeline) detachers.push(offTimeline);
			}
			return Boolean(offMembers && offTimeline);
		};

		const attempt = (): boolean => {
			if (!subscribed) {
				subscribed = subscribe();
			}
			return readRoom() && subscribed;
		};

		// The Matrix client / room may not be synced right after login: retry
		// every 500 ms for up to 20 s, then give up gracefully (empty stack).
		if (!attempt()) {
			let retries = 0;
			const maxRetries = 40;
			retryTimer = window.setInterval(() => {
				retries += 1;
				if (attempt() || retries >= maxRetries) {
					if (retryTimer) {
						window.clearInterval(retryTimer);
						retryTimer = null;
					}
					if (retries >= maxRetries && !cancelled) {
						setIsLoadingMembers(false);
					}
				}
			}, 500);
		}

		return () => {
			cancelled = true;
			if (retryTimer) {
				window.clearInterval(retryTimer);
			}
			detachers.forEach((detach) => detach());
		};
	}, [matrixRoomId, matrixClientService]);
	const { path: listPath } = useContext(SessionTypeContext);
	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');
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
				activeSession.item.matrixRoomId ||
				activeSession.item.matrixRoomId;

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
				stopMediaStreamTracks(stream);
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
	const modalityCalls = groupChatCallCapabilities(
		activeSession.item.modality,
		getModality(activeSession) === Modality.INTERNAL_GROUP
	);
	const isAudioCallsEnabled =
		isCallsEnabled &&
		modalityCalls.audio &&
		featureAudioCallsEnabled !== false &&
		featureAudioCallsGroupChatsEnabled !== false;
	const isVideoCallsEnabled =
		isCallsEnabled &&
		modalityCalls.video &&
		featureVideoCallsEnabled !== false &&
		featureVideoCallsGroupChatsEnabled !== false;

	const isActive = activeSession.item.active;
	const getSessionListTab = () =>
		`${sessionListTab ? `?sessionListTab=${sessionListTab}` : ''}`;
	const baseUrl = `${listPath}/:groupId/:id/:subRoute?/:extraPath?${getSessionListTab()}`;
	const groupChatInfoLink = generatePath(baseUrl, {
		groupId: activeSession.item.matrixRoomId,
		id: String(activeSession.item.id),
		subRoute: 'groupChatInfo'
	});
	// #1193 Job 1: latest-active participant first. Job 2 (overlap + "+N")
	// is handled by MemberAvatarStack; Figma #430 caps the visible avatars at 4.
	const visibleMembers = useMemo(
		() =>
			sortMembersByActivity(
				matrixMembers.filter(
					(member) => !isSystemMatrixUser(member.userId)
				),
				memberActivity
			),
		[matrixMembers, memberActivity]
	);
	const stackMembers: StackMember[] = useMemo(
		() =>
			visibleMembers.map((member) => {
				const userId = member.userId || '';
				const parsedUsername =
					userId.split(':')[0]?.replace('@', '') || userId;
				return {
					userId: member.userId || parsedUsername,
					username: parsedUsername,
					displayName: decodeUsername(member.name || parsedUsername)
				};
			}),
		[visibleMembers]
	);

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
					<div className="sessionInfo__titleRow" ref={titleRowRef}>
						<div className="sessionInfo__memberStack">
							<ChatroomMainInteractionIcon
								type="internal"
								showAddIcon={isActive && !isJoinGroupChatView}
							/>
							<MemberAvatarStack
								members={stackMembers}
								measureRef={titleRowRef}
								reservedWidth={TITLE_ROW_RESERVED_WIDTH}
								countLabel={(hidden) =>
									`+${t('message.audience.multiCount', {
										count: hidden
									})}`
								}
							/>
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
							data-tour-target="groupchat-call-button"
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

				{shouldShowGroupChatMenu({
					isActive,
					isJoinGroupChatView
				}) && (
					<SessionMenu
						hasUserInitiatedStopOrLeaveRequest={
							hasUserInitiatedStopOrLeaveRequest
						}
						isAskerInfoAvailable={false}
						isJoinGroupChatView={isJoinGroupChatView}
						bannedUsers={bannedUsers}
					/>
				)}
			</div>
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
