import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import sanitizeHtml from 'sanitize-html';
import { PrettyDate } from '../../utils/dateHelpers';
import {
	UserDataContext,
	hasUserAuthority,
	AUTHORITIES,
	E2EEContext,
	RocketChatGlobalSettingsContext,
	ActiveSessionContext
} from '../../globalState';
import { STATUS_ARCHIVED } from '../../globalState/interfaces';
import { isUserModerator } from '../session/sessionHelpers';
import { MessageMetaData } from './MessageMetaData';
import { MessageDisplayName } from './MessageDisplayName';
import { markdownToDraft } from 'markdown-draft-js';
import { stateToHTML } from 'draft-js-export-html';
import { convertFromRaw, ContentState } from 'draft-js';
import {
	markdownToDraftDefaultOptions,
	sanitizeHtmlDefaultOptions,
	urlifyLinksInText
} from '../messageSubmitInterface/richtextHelpers';
import { VideoCallMessage } from './VideoCallMessage';
import { FurtherSteps } from './FurtherSteps';
import { MessageAttachment } from './MessageAttachment';
import { Text } from '../text/Text';
import './message.styles';
import { Appointment } from './Appointment';
import { decryptText, MissingKeyError } from '../../utils/encryptionHelpers';
import { e2eeParams } from '../../hooks/useE2EE';
import { E2EEActivatedMessage } from './E2EEActivatedMessage';
import {
	ReassignRequestAcceptedMessage,
	ReassignRequestDeclinedMessage,
	ReassignRequestMessage,
	ReassignRequestSentMessage
} from './ReassignMessage';
import {
	apiSendAliasMessage,
	ConsultantReassignment,
	ReassignStatus
} from '../../api/apiSendAliasMessage';
import { apiPatchMessage } from '../../api/apiPatchMessage';
import { apiSessionAssign } from '../../api';

import { MasterKeyLostMessage } from './MasterKeyLostMessage';
import { ALIAS_MESSAGE_TYPES } from '../../api/apiSendAliasMessage';
import { useTranslation } from 'react-i18next';
import { ERROR_LEVEL_WARN, TError } from '../../api/apiPostError';
import { ReactComponent as TrashIcon } from '../../resources/img/icons/trash.svg';
import { ReactComponent as DeletedIcon } from '../../resources/img/icons/deleted.svg';
import {
	IBooleanSetting,
	SETTING_MESSAGE_ALLOWDELETING
} from '../../api/apiRocketChatSettingsPublic';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { ReactComponent as XIllustration } from '../../resources/img/illustrations/x.svg';
import { BUTTON_TYPES } from '../button/Button';
import { apiDeleteMessage } from '../../api/apiDeleteMessage';
import { FlyoutMenu } from '../flyoutMenu/FlyoutMenu';
import { BanUser, BanUserOverlay } from '../banUser/BanUser';
import { getValueFromCookie } from '../sessionCookie/accessSessionCookie';
import { VideoChatDetails, VideoChatDetailsAlias } from './VideoChatDetails';
import { UserAvatar } from './UserAvatar';

export interface VideoCallMessageDTO {
	eventType: 'IGNORED_CALL';
	initiatorRcUserId: string;
	initiatorUserName: string;
}

export interface MessageItem {
	_id: string;
	message: string;
	messageDate: PrettyDate;
	messageTime: string;
	displayName: string;
	username: string;
	askerRcId?: string;
	userId: string;
	consultant?: {
		username: string;
	};
	groupId?: string;
	isNotRead: boolean;
	alias?: {
		videoCallMessageDTO?: VideoCallMessageDTO;
		content?: string;
		messageType: ALIAS_MESSAGE_TYPES;
	};
	attachments?: MessageService.Schemas.AttachmentDTO[];
	file?: MessageService.Schemas.FileDTO;
	t: null | 'e2e' | 'rm' | 'room-removed-read-only' | 'room-set-read-only';
	rid: string;
	isVideoActive?: boolean;
}

interface MessageItemComponentProps extends MessageItem {
	isOnlyEnquiry?: boolean;
	isMyMessage: boolean;
	clientName: string;
	isUserBanned: boolean;
	handleDecryptionErrors: (
		id: string,
		messageTime: string,
		error: TError
	) => void;
	handleDecryptionSuccess: (id: string) => void;
	e2eeParams: e2eeParams & { subscriptionKeyLost: boolean };
}

export const MessageItemComponent = ({
	_id,
	alias,
	userId,
	message,
	messageDate,
	messageTime,
	isMyMessage,
	displayName,
	username,
	askerRcId,
	attachments,
	file,
	isNotRead,
	isUserBanned,
	t,
	rid,
	handleDecryptionErrors,
	handleDecryptionSuccess,
	e2eeParams,
	isVideoActive
}: MessageItemComponentProps) => {
	const { t: translate } = useTranslation();
	const { activeSession, reloadActiveSession } =
		useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);

	const [renderedMessage, setRenderedMessage] = useState<string | null>(null);
	const [decryptedMessage, setDecryptedMessage] = useState<
		string | null | undefined
	>(null);

	const [isExpanded, setIsExpanded] = useState(false);

	const { isE2eeEnabled } = useContext(E2EEContext);
	
	// Character limit for collapsing messages
	const MESSAGE_CHAR_LIMIT = 300;

	// Reset expanded state only when message ID changes (not when message content changes)
	useEffect(() => {
		setIsExpanded(false);
	}, [_id]);

	useEffect((): void => {
		if (isE2eeEnabled && message) {
			decryptText(
				message,
				e2eeParams.keyID,
				e2eeParams.key,
				e2eeParams.encrypted,
				t === 'e2e'
			)
				.catch((e) => {
					if (!(e instanceof MissingKeyError)) {
						handleDecryptionErrors(_id, messageTime, {
							name: e.name,
							message: e.message,
							stack: e.stack,
							level: ERROR_LEVEL_WARN
						});
					}

					return translate('e2ee.message.encryption.text');
				})
				.then(setDecryptedMessage)
				.then(() => handleDecryptionSuccess(_id));
		} else {
			setDecryptedMessage(message);
		}
	}, [
		translate,
		message,
		t,
		isE2eeEnabled,
		handleDecryptionErrors,
		e2eeParams.keyID,
		e2eeParams.key,
		e2eeParams.encrypted,
		messageTime,
		_id,
		handleDecryptionSuccess
	]);

	useEffect((): void => {
		const rawMessageObject = markdownToDraft(
			decryptedMessage,
			markdownToDraftDefaultOptions
		);
		const contentStateMessage: ContentState =
			convertFromRaw(rawMessageObject);

		setRenderedMessage(
			contentStateMessage.hasText()
				? sanitizeHtml(
						urlifyLinksInText(stateToHTML(contentStateMessage)),
						sanitizeHtmlDefaultOptions
					)
				: ''
		);
	}, [decryptedMessage]);

	const hasRenderedMessage = renderedMessage && renderedMessage.length > 0;

	const getMessageDate = () => {
		if (messageDate.str || messageDate.date) {
			return (
				<div className="messageItem__divider">
					<Text
						text={translate(
							messageDate.str ? messageDate.str : messageDate.date
						)}
						type="divider"
					/>
				</div>
			);
		}
		return null;
	};

	const getUsernameType = () => {
		if (isMyMessage) {
			return 'self';
		}
		if (displayName === 'system') {
			return 'system';
		}
		if (isUserMessage()) {
			return 'user';
		}
		return 'consultant';
	};

	const clickReassignRequestMessage = (accepted, toConsultantId) => {
		if (accepted) {
			apiSessionAssign(activeSession.item.id, toConsultantId)
				.then(() => {
					apiPatchMessage(
						toConsultantId,
						ReassignStatus.CONFIRMED,
						_id
					)
						.then(() => {
							// WORKAROUND for an issue with reassignment and old users breaking the lastMessage for this session
							apiSendAliasMessage({
								rcGroupId: activeSession.rid,
								type: ALIAS_MESSAGE_TYPES.REASSIGN_CONSULTANT_RESET_LAST_MESSAGE
							});
							reloadActiveSession();
						})
						.catch((error) => console.log(error));
				})
				.catch((error) => console.log(error));
		} else {
			apiPatchMessage(toConsultantId, ReassignStatus.REJECTED, _id).catch(
				(error) => console.log(error)
			);
		}
	};

	const isUserMessage = () =>
		userId === askerRcId ||
		(activeSession.isGroup &&
			!activeSession.item.moderators?.includes(userId));

	const videoCallMessage: VideoCallMessageDTO = alias?.videoCallMessageDTO;
	const isFurtherStepsMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.FURTHER_STEPS;
	const isUpdateSessionDataMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.UPDATE_SESSION_DATA;
	const isVideoCallMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.VIDEOCALL;
	const isUserMutedMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.USER_MUTED;
	const isE2EEActivatedMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.E2EE_ACTIVATED;
	const isReassignmentMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.REASSIGN_CONSULTANT;
	const isMasterKeyLostMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.MASTER_KEY_LOST;
	const isAppointmentDefined =
		alias?.messageType === ALIAS_MESSAGE_TYPES.INITIAL_APPOINTMENT_DEFINED;
	const isFullWidthMessage =
		isVideoCallMessage && !videoCallMessage?.eventType;

	// WORKAROUND for reassignment last message bug
	// don't show this message in the session view
	if (
		alias?.messageType ===
		ALIAS_MESSAGE_TYPES.REASSIGN_CONSULTANT_RESET_LAST_MESSAGE
	) {
		return null;
	}

	const isMySession = activeSession?.consultant?.id === userData?.userId;
	const isAppointmentSet =
		alias?.messageType === ALIAS_MESSAGE_TYPES.APPOINTMENT_SET ||
		alias?.messageType === ALIAS_MESSAGE_TYPES.APPOINTMENT_RESCHEDULED ||
		alias?.messageType === ALIAS_MESSAGE_TYPES.APPOINTMENT_CANCELLED;
	const isDeleteMessage = t === 'rm';
	const isRoomRemovedReadOnly = t === 'room-removed-read-only';
	const isRoomSetReadOnly = t === 'room-set-read-only';
	const isRejectedCallInGroupChat =
		alias?.messageType === ALIAS_MESSAGE_TYPES.VIDEOCALL &&
		videoCallMessage?.eventType === 'IGNORED_CALL' &&
		activeSession?.isGroup;

	const messageContent = (): JSX.Element => {
		switch (true) {
			case isMasterKeyLostMessage:
				return (
					<MasterKeyLostMessage
						subscriptionKeyLost={e2eeParams.subscriptionKeyLost}
					/>
				);
			case isE2EEActivatedMessage:
				return <E2EEActivatedMessage />;
			case isReassignmentMessage:
				if (message) {
					const isAsker = hasUserAuthority(
						AUTHORITIES.ASKER_DEFAULT,
						userData
					);

					const reassignmentParams: ConsultantReassignment =
						JSON.parse(message);
					switch (reassignmentParams.status) {
						case ReassignStatus.REQUESTED:
							return isAsker ? (
								<ReassignRequestMessage
									{...reassignmentParams}
									onClick={(accepted) =>
										clickReassignRequestMessage(
											accepted,
											reassignmentParams.toConsultantId
										)
									}
								/>
							) : (
								<ReassignRequestSentMessage
									{...reassignmentParams}
									isMySession={isMySession}
								/>
							);
						case ReassignStatus.CONFIRMED:
							return (
								<ReassignRequestAcceptedMessage
									isAsker={isAsker}
									isMySession={isMySession}
									{...reassignmentParams}
								/>
							);
						case ReassignStatus.REJECTED:
							return (
								<ReassignRequestDeclinedMessage
									isAsker={isAsker}
									isMySession={isMySession}
									{...reassignmentParams}
								/>
							);
					}
				}
				return;
			case isFurtherStepsMessage:
				return <FurtherSteps />;
			case isUpdateSessionDataMessage:
				return <FurtherSteps />;
			case isAppointmentSet:
				return (
					<Appointment
						data={alias.content}
						messageType={alias.messageType}
					/>
				);
			case isVideoCallMessage && !videoCallMessage?.eventType:
				const parsedMessage = JSON.parse(
					alias.content
				) as VideoChatDetailsAlias;
				return (
					<VideoChatDetails
						data={parsedMessage}
						isVideoActive={isVideoActive}
					/>
				);
			case isVideoCallMessage &&
				videoCallMessage?.eventType === 'IGNORED_CALL':
				return (
					<VideoCallMessage
						videoCallMessage={videoCallMessage}
						activeSessionUsername={
							activeSession.user?.username ||
							activeSession.consultant?.displayName ||
							activeSession.consultant?.username
						}
						activeSessionAskerRcId={activeSession.item.askerRcId}
					/>
				);
			case isDeleteMessage:
				return (
					<div className="messageItem__message messageItem__message--deleted flex flex--ai-c">
						<div className="mr--1">
							<DeletedIcon
								width={14}
								height={14}
								aria-hidden="true"
								focusable="false"
							/>
						</div>
						<div>
							{translate(
								isMyMessage
									? 'message.delete.deleted.own'
									: 'message.delete.deleted.other'
							)}
						</div>
					</div>
				);
			default:
				return (
					<>
						<div className="flex flex--jc-sb">
							<MessageDisplayName
								isMyMessage={isMyMessage}
								isUser={isUserMessage()}
								type={getUsernameType()}
								userId={userId}
								username={username}
								displayName={displayName}
							/>
							{/* MATRIX MIGRATION: Temporarily hide message menu */}
							{false && <MessageFlyoutMenu
								_id={_id}
								userId={userId}
								username={username}
								isUserBanned={isUserBanned}
								isMyMessage={isMyMessage}
								isArchived={
									activeSession.item.status ===
									STATUS_ARCHIVED
								}
							/>}
						</div>

					<div
						className={
							isMyMessage
								? `messageItem__message messageItem__message--myMessage`
								: `messageItem__message`
						}
					>
						{renderedMessage && !attachments && (() => {
							// Check if message is long (strip HTML tags for accurate length)
							const textContent = renderedMessage.replace(/<[^>]*>/g, '');
							const isLongMessage = textContent.length > MESSAGE_CHAR_LIMIT;
							
							// Helper function to safely truncate HTML while preserving structure
							const truncateHtml = (html: string, maxLength: number): string => {
								// Check if we're in a browser environment
								if (typeof document === 'undefined') {
									// Fallback for SSR: simple truncation (may break HTML tags)
									const textContent = html.replace(/<[^>]*>/g, '');
									if (textContent.length <= maxLength) return html;
									const truncatedText = textContent.substring(0, maxLength);
									const lastSpace = truncatedText.lastIndexOf(' ');
									const cutPoint = lastSpace > maxLength * 0.8 ? lastSpace : maxLength;
									return html.substring(0, Math.min(cutPoint, html.length)) + '...';
								}
								
								// Create a temporary DOM element to parse HTML
								const tempDiv = document.createElement('div');
								tempDiv.innerHTML = html;
								
								// Get text content and find truncation point
								const text = tempDiv.textContent || tempDiv.innerText || '';
								if (text.length <= maxLength) return html;
								
								// Find a good word boundary
								let truncateAt = maxLength;
								const truncatedText = text.substring(0, maxLength);
								const lastSpace = truncatedText.lastIndexOf(' ');
								if (lastSpace > maxLength * 0.8 && lastSpace > 0) {
									truncateAt = lastSpace;
								}
								
								// Walk through nodes and truncate at the right point
								let currentLength = 0;
								const walker = document.createTreeWalker(
									tempDiv,
									NodeFilter.SHOW_TEXT,
									null
								);
								
								let node;
								let targetNode = null;
								let targetRemaining = 0;
								
								while ((node = walker.nextNode())) {
									const nodeLength = node.textContent?.length || 0;
									if (currentLength + nodeLength >= truncateAt) {
										targetNode = node;
										targetRemaining = truncateAt - currentLength;
										break;
									}
									currentLength += nodeLength;
								}
								
								if (targetNode && targetNode.textContent) {
									// Truncate the target node
									targetNode.textContent = targetNode.textContent.substring(0, targetRemaining) + '...';
									
									// Remove all following siblings of the target node's parent
									let parent = targetNode.parentNode;
									if (parent) {
										let sibling = targetNode.nextSibling;
										while (sibling) {
											const next = sibling.nextSibling;
											parent.removeChild(sibling);
											sibling = next;
										}
									}
									
									// Also remove any remaining text nodes via walker
									let nextNode;
									while ((nextNode = walker.nextNode())) {
										if (nextNode.parentNode) {
											nextNode.parentNode.removeChild(nextNode);
										}
									}
								}
								
								const result = tempDiv.innerHTML;
								// Verify truncation worked - if result is still too long, use simple fallback
								const resultText = result.replace(/<[^>]*>/g, '');
								if (resultText.length > maxLength + 50) {
									// Fallback: simple truncation
									const simpleTruncated = text.substring(0, truncateAt) + '...';
									return simpleTruncated;
								}
								
								return result;
							};
							
							// Truncate message if not expanded
							const displayMessage = isLongMessage && !isExpanded
								? truncateHtml(renderedMessage, MESSAGE_CHAR_LIMIT)
								: renderedMessage;
							
							return (
								<>
									<span
										dangerouslySetInnerHTML={{
											__html: displayMessage
										}}
									/>
									{isLongMessage && (
										<button
											className={`messageItem__expandBtn ${isMyMessage ? 'messageItem__expandBtn--myMessage' : 'messageItem__expandBtn--incoming'}`}
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												setIsExpanded(!isExpanded);
											}}
											type="button"
										>
											{isExpanded ? translate('message.showLess') : translate('message.showMore')}
										</button>
									)}
								</>
							);
						})()}
						{attachments &&
							attachments.map((attachment, key) => (
								<MessageAttachment
									key={key}
									attachment={attachment}
									rid={rid}
									file={file}
									t={t}
									hasRenderedMessage={hasRenderedMessage}
								/>
							))}
					</div>
					</>
				);
		}
	};

	if (
		isUserMutedMessage ||
		isAppointmentDefined ||
		isRoomRemovedReadOnly ||
		isRoomSetReadOnly
	)
		return null;

	if (isUpdateSessionDataMessage || isRejectedCallInGroupChat) {
		return null;
	}

	return (
		<div
			className={`messageItem ${
				isMyMessage ? 'messageItem--right' : ''
			} ${isFullWidthMessage ? 'messageItem--full' : ''} ${
				alias?.messageType &&
				`${alias?.messageType.toLowerCase()} systemMessage`
			}`}
		>
			{getMessageDate()}
			<div
				className={`
					messageItem__messageWrap
					${isMyMessage ? 'messageItem__messageWrap--right' : ''}
					${isFurtherStepsMessage ? 'messageItem__messageWrap--furtherSteps' : ''}
					${
						isE2EEActivatedMessage
							? 'messageItem__messageWrap--e2eeActivatedMessage'
							: ''
					}
				`}
			>
				{/* Add Element-style user avatar for non-system messages */}
				{!alias?.messageType && !isMyMessage && (
					<div className="messageItem__avatar">
						<UserAvatar
							username={username}
							displayName={displayName}
							userId={userId}
							size="32px"
						/>
					</div>
				)}
				
				<div className="messageItem__content">
					{messageContent()}

					<MessageMetaData
						isMyMessage={isMyMessage}
						isNotRead={isNotRead}
						messageTime={messageTime}
						t={t}
						type={getUsernameType()}
						isReadStatusDisabled={isVideoCallMessage}
					/>
				</div>
			</div>
		</div>
	);
};

const MessageFlyoutMenu = ({
	_id,
	userId,
	isUserBanned,
	isMyMessage,
	isArchived,
	username
}: {
	_id: string;
	userId: string;
	username: string;
	isUserBanned: boolean;
	isMyMessage: boolean;
	isArchived: boolean;
}) => {
	const { activeSession } = useContext(ActiveSessionContext);
	const { getSetting } = useContext(RocketChatGlobalSettingsContext);
	const [isUserBanOverlayOpen, setIsUserBanOverlayOpen] =
		useState<boolean>(false);

	const currentUserIsModerator = isUserModerator({
		chatItem: activeSession.item,
		rcUserId: getValueFromCookie('rc_uid')
	});

	const subscriberIsModerator = isUserModerator({
		chatItem: activeSession.item,
		rcUserId: userId
	});

	return (
		<>
			<FlyoutMenu position={isMyMessage ? 'left-top' : 'right-top'}>
				{currentUserIsModerator &&
					!subscriberIsModerator &&
					!isUserBanned && (
						<BanUser
							userName={username}
							rcUserId={userId}
							chatId={activeSession.item.id}
							handleUserBan={() => {
								setIsUserBanOverlayOpen(true);
							}}
						/>
					)}

				{isMyMessage &&
					!isArchived &&
					getSetting<IBooleanSetting>(
						SETTING_MESSAGE_ALLOWDELETING
					) && (
						<DeleteMessage
							messageId={_id}
							className="flyoutMenu__item--delete"
						/>
					)}
			</FlyoutMenu>
			<BanUserOverlay
				overlayActive={isUserBanOverlayOpen}
				userName={username}
				handleOverlay={() => {
					setIsUserBanOverlayOpen(false);
				}}
			></BanUserOverlay>
		</>
	);
};

const DeleteMessage = ({
	messageId,
	className
}: {
	messageId: string;
	className?: string;
}) => {
	const { t: translate } = useTranslation();
	const [deleteOverlay, setDeleteOverlay] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);

	const deleteMessage = useCallback(() => {
		setIsRequestInProgress(true);
		apiDeleteMessage(messageId)
			.then(() => setDeleteOverlay(false))
			.then(() => setIsRequestInProgress(false));
	}, [messageId]);

	const deleteOverlayItem: OverlayItem = useMemo(
		() => ({
			headline: translate('message.delete.overlay.headline'),
			copy: translate('message.delete.overlay.copy'),
			svg: XIllustration,
			illustrationBackground: 'neutral',
			buttonSet: [
				{
					label: translate('message.delete.overlay.cancel'),
					function: OVERLAY_FUNCTIONS.CLOSE,
					type: BUTTON_TYPES.SECONDARY,
					disabled: isRequestInProgress
				},
				{
					label: translate('message.delete.overlay.confirm'),
					function: 'CONFIRM',
					type: BUTTON_TYPES.PRIMARY,
					disabled: isRequestInProgress
				}
			],
			handleOverlay: (functionName) => {
				if (functionName === 'CONFIRM') {
					deleteMessage();
					return;
				}
				setDeleteOverlay(false);
			}
		}),
		[deleteMessage, isRequestInProgress, translate]
	);

	return (
		<>
			<button
				onClick={() => setDeleteOverlay(true)}
				className={`flex ${className}`}
			>
				<div className="mr--1">
					<TrashIcon
						width={24}
						height={24}
						style={{ display: 'block', padding: '2px 0' }}
						aria-hidden="true"
						focusable="false"
					/>
				</div>
				<div>{translate('message.delete.delete')}</div>
			</button>
			{deleteOverlay && (
				<Overlay
					item={deleteOverlayItem}
					handleOverlayClose={() => {
						setDeleteOverlay(false);
					}}
				/>
			)}
		</>
	);
};
