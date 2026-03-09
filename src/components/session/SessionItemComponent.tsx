import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	lazy,
	Suspense
} from 'react';
import { ResizeObserver } from '@juggle/resize-observer';
import clsx from 'clsx';
import { scrollToEnd, isMyMessage, SESSION_LIST_TYPES } from './sessionHelpers';
import { formatToHHMM } from '../../utils/dateHelpers';
import {
	MessageItem,
	MessageItemComponent
} from '../message/MessageItemComponent';
import { SessionHeaderComponent } from '../sessionHeader/SessionHeaderComponent';
import { Button, BUTTON_TYPES, ButtonItem } from '../button/Button';
import {
	AUTHORITIES,
	getContact,
	hasUserAuthority,
	NotificationsContext,
	NOTIFICATION_TYPE_INFO,
	UserDataContext,
	SessionTypeContext,
	useTenant,
	ActiveSessionContext
} from '../../globalState';
import { useLocation } from 'react-router-dom';
import { RocketChatUsersOfRoomProvider } from '../../globalState/provider/RocketChatUsersOfRoomProvider';
import './session.styles';
import { useDebouncedCallback } from 'use-debounce';
import { ReactComponent as ArrowDoubleDownIcon } from '../../resources/img/icons/arrow-double-down.svg';
import smoothScroll from './smoothScrollHelper';
import { DragAndDropArea } from '../dragAndDropArea/DragAndDropArea';
import useMeasure from 'react-use-measure';
import { AcceptAssign } from './AcceptAssign';
import { useTranslation } from 'react-i18next';
import useDebounceCallback from '../../hooks/useDebounceCallback';
import { apiPostError, TError } from '../../api/apiPostError';
import { useE2EE } from '../../hooks/useE2EE';
import { MessageSubmitInterfaceSkeleton } from '../messageSubmitInterface/messageSubmitInterfaceSkeleton';
import { EncryptionBanner } from './EncryptionBanner';
import { apiGetSessionSupervisors } from '../../api/apiGetSessionSupervisors';
import { apiPatchNotificationActiveView } from '../../api/apiPatchNotificationActiveView';
import { parseMessagePrefixes } from '../message/messageConstants';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';

const MessageSubmitInterfaceComponent = lazy(() =>
	import('../messageSubmitInterface/messageSubmitInterfaceComponent').then(
		(m) => ({ default: m.MessageSubmitInterfaceComponent })
	)
);

interface SessionItemProps {
	isTyping?: Function;
	messages?: MessageItem[];
	typingUsers: string[];
	hasUserInitiatedStopOrLeaveRequest: React.MutableRefObject<boolean>;
	bannedUsers: string[];
	refreshMessages?: () => void;
}

let initMessageCount: number;

export const SessionItemComponent = (props: SessionItemProps) => {
	const { t: translate } = useTranslation();
	const tenantData = useTenant();

	const { activeSession } = useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);
	const { addEventNotification } = useContext(NotificationsContext);
	const { type } = useContext(SessionTypeContext);
	const location = useLocation();
	const isEmbeddedNotificationsView =
		new URLSearchParams(location.search).get('embeddedNotifications') ===
		'1';
	const [isSupervisor, setIsSupervisor] = useState(false);

	// Threads feature toggle (tenant-level). Master switch disables for all chat types.
	// When enabled, per-chat-type switches decide if threads are available in 1-on-1 vs group chats.
	const {
		featureSupervisionEnabled = true,
		featureSupervisionAnonymousChatsEnabled = true,
		featureSupervisionOneOnOneChatsEnabled = true,
		featureThreadsEnabled = true,
		featureThreadsAnonymousChatsEnabled = true,
		featureThreadsGroupChatsEnabled = true,
		featureThreadsOneOnOneEnabled = true,
		featureThreadsSupervisionChatsEnabled = true
	} = getTenantSettings();
	const contact = getContact(activeSession);
	const isAnonymousChat =
		activeSession.item.postcode === 0 ||
		activeSession.item.postcode?.toString() === '00000' ||
		(activeSession.item as any).registrationType === 'ANONYMOUS' ||
		contact?.username?.startsWith('Anonymous-') ||
		activeSession.user?.username?.startsWith('Anonymous-');
	const chatType: 'anonymous' | 'oneOnOne' | 'group' | 'supervision' = isSupervisor
		? 'supervision'
		: activeSession.isGroup
			? 'group'
			: isAnonymousChat
				? 'anonymous'
				: 'oneOnOne';

	const isThreadsEnabled =
		featureThreadsEnabled !== false &&
		(chatType === 'group'
			? featureThreadsGroupChatsEnabled !== false
			: chatType === 'anonymous'
				? featureThreadsAnonymousChatsEnabled !== false
				: chatType === 'supervision'
					? featureThreadsSupervisionChatsEnabled !== false
					: featureThreadsOneOnOneEnabled !== false);
	const isSupervisionEnabledForCurrentChat =
		featureSupervisionEnabled !== false &&
		(isAnonymousChat
			? featureSupervisionAnonymousChatsEnabled !== false
			: featureSupervisionOneOnOneChatsEnabled !== false);

	const messages = useMemo(() => props.messages, [props && props.messages]); // eslint-disable-line react-hooks/exhaustive-deps
	const [initialScrollCompleted, setInitialScrollCompleted] = useState(false);
	const scrollContainerRef = React.useRef<HTMLDivElement>(null);
	const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
	const [draggedFile, setDraggedFile] = useState<File | null>(null);
	const [isDragOverDropArea, setDragOverDropArea] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const dragCancelRef = useRef<NodeJS.Timeout | null>(null);
	const [newMessages, setNewMessages] = useState(0);
	const [canWriteMessage, setCanWriteMessage] = useState(false);
	const [supervisionReason, setSupervisionReason] = useState<string | null>(null);
	const [activeThreadRootId, setActiveThreadRootId] = useState<string | null>(null);
	const [activeThreadRootMessage, setActiveThreadRootMessage] = useState<MessageItem | null>(null);
	const knownMessageIdsRef = useRef<Set<string>>(new Set());
	const threadSummaries = useMemo(() => {
		const map = new Map<string, { replyCount: number; lastReplyText: string }>();
		if (!messages) {
			return map;
		}
		messages.forEach((message) => {
			const parsed = parseMessagePrefixes(message.message);
			if (parsed.isThreadMessage && parsed.threadRootId) {
				const existing = map.get(parsed.threadRootId) || {
					replyCount: 0,
					lastReplyText: ''
				};
				existing.replyCount += 1;
				existing.lastReplyText = 'Last reply at ' + formatToHHMM(message.messageTime);
				map.set(parsed.threadRootId, existing);
			}
		});
		return map;
	}, [messages]);
	const [headerRef, headerBounds] = useMeasure({ polyfill: ResizeObserver });
	const { ready, key, keyID, encrypted, subscriptionKeyLost } = useE2EE(
		activeSession.rid
	);

	// MATRIX MIGRATION: Create Matrix-aware isMyMessage function
	const isMyMessageMatrix = useCallback((messageUserId: string) => {
		// For Matrix sessions, check if sender matches current user's Matrix user ID
		// Matrix room IDs start with '!' and Matrix user IDs start with '@'
		const isMatrixSession = activeSession.rid?.startsWith('!') || messageUserId?.includes('@');
		
		if (isMatrixSession && messageUserId?.includes('@')) {
			// Get current user's Matrix user ID from localStorage or cookie (rc_uid stores Matrix ID for Matrix sessions)
			const myMatrixUserId = localStorage.getItem('matrix_user_id') || 
				(typeof document !== 'undefined' && document.cookie
					.split('; ')
					.find(row => row.startsWith('rc_uid='))
					?.split('=')[1]);
			
			// Compare full Matrix user IDs (e.g., @username:domain)
			// This works for both normal and anonymous users
			if (myMatrixUserId && messageUserId) {
				return myMatrixUserId === messageUserId;
			}
		}
		// For RocketChat sessions, use the standard check
		return isMyMessage(messageUserId);
	}, [activeSession.rid]);

	// Check if current user is a supervisor
	useEffect(() => {
		if (!isSupervisionEnabledForCurrentChat) {
			setIsSupervisor(false);
			setSupervisionReason(null);
			return;
		}
		if (hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) && activeSession.item.id) {
			apiGetSessionSupervisors(activeSession.item.id)
				.then((supervisors) => {
					const isCurrentUserSupervisor = supervisors.some(
						s => s.supervisorConsultantId === userData.userId
					);
					setIsSupervisor(isCurrentUserSupervisor);
					const currentSupervisor = supervisors.find(
						s => s.supervisorConsultantId === userData.userId
					);
					setSupervisionReason(currentSupervisor?.notes || null);
				})
				.catch((error) => {
					// console.error('Failed to check supervisor status:', error);
					setIsSupervisor(false);
					setSupervisionReason(null);
				});
		} else {
			setIsSupervisor(false);
			setSupervisionReason(null);
		}
	}, [activeSession.item.id, userData, isSupervisionEnabledForCurrentChat]);

	useEffect(() => {
		const canWrite = type !== SESSION_LIST_TYPES.ENQUIRY;
		// console.log('🔥 SessionItemComponent: canWriteMessage =', canWrite, '(type:', type, ', isGroup:', activeSession.isGroup, ', isSupervisor:', isSupervisor, ')');
		setCanWriteMessage(canWrite);
	}, [type, userData, activeSession, activeSession.isGroup, isSupervisor]);

	useEffect(() => {
		if (messages && messages.length > 0 && !initialScrollCompleted) {
			enableInitialScroll();
		}
	}, [messages, initialScrollCompleted]);

	useEffect(() => {
		knownMessageIdsRef.current = new Set((messages || []).map((m) => m._id));
	}, [activeSession.item.id]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!messages || messages.length === 0 || !isThreadsEnabled) {
			return;
		}

		if (knownMessageIdsRef.current.size === 0) {
			knownMessageIdsRef.current = new Set(messages.map((m) => m._id));
			return;
		}

		const contactName =
			getContact(activeSession)?.username ||
			translate('sessionList.user.consultantUnknown');
		const newThreadReplies = messages.filter((message) => {
			if (knownMessageIdsRef.current.has(message._id)) {
				return false;
			}
			const parsed = parseMessagePrefixes(message.message);
			if (!parsed.isThreadMessage || !parsed.threadRootId) {
				return false;
			}
			if (activeThreadRootId === parsed.threadRootId) {
				return false;
			}
			if (isMyMessageMatrix(message.userId)) {
				return false;
			}
			return true;
		});

		newThreadReplies.forEach((message) => {
			const parsed = parseMessagePrefixes(message.message);
			const params = new URLSearchParams(location.search);
			if (parsed.threadRootId) {
				params.set('threadRootId', parsed.threadRootId);
			}
			params.set('threadMessageId', message._id);
			const actionPath = `${location.pathname}?${params.toString()}`;
			const snippet = (parsed.cleanedMessage || '')
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 120);
			addEventNotification({
				type: NOTIFICATION_TYPE_INFO,
				eventType: 'thread.reply.new',
				title: translate(
					'notifications.threadReply.title',
					'New thread reply'
				),
				text: `${contactName}: ${snippet || 'New reply in thread'}`,
				actionPath,
				actionLabel: translate(
					'notifications.center.open',
					'Open chat'
				),
				sourceSessionId: activeSession.item.id,
				category: 'message'
			});
		});

		messages.forEach((message) => knownMessageIdsRef.current.add(message._id));
	}, [
		messages,
		isThreadsEnabled,
		activeThreadRootId,
		location.pathname,
		location.search,
		addEventNotification,
		activeSession,
		isMyMessageMatrix,
		translate
	]);

	useEffect(() => {
		if (!isThreadsEnabled || !messages || messages.length === 0) {
			return;
		}
		const params = new URLSearchParams(location.search);
		const threadRootId = params.get('threadRootId');
		if (!threadRootId) {
			return;
		}
		const rootMessage = messages.find((message) => message._id === threadRootId);
		if (rootMessage) {
			setActiveThreadRootId(rootMessage._id);
			setActiveThreadRootMessage(rootMessage);
		}
	}, [location.search, isThreadsEnabled, messages]);

	const resetUnreadCount = () => {
		setNewMessages(0);
		initMessageCount = messages?.length;
		scrollContainerRef.current
			.querySelectorAll('.messageItem__divider--lastRead')
			.forEach((e) => e.remove());
	};

	useEffect(() => {
		const enableDraggingOnWindow = () => {
			window.ondragover = (ev: any) => {
				setIsDragging(true);
				cancelDraggingOnOutsideWindow();

				const isOutsideDropZone =
					!ev.target.classList.contains('dragAndDropArea');
				if (isOutsideDropZone) {
					ev.preventDefault();
					ev.dataTransfer.dropEffect = 'none';
					ev.dataTransfer.effectAllowed = 'none';
				}
			};
			window.ondragleave = () => onDragLeave();
			window.ondragend = window.ondrop = () => setIsDragging(false);
		};

		if (!canWriteMessage) {
			return;
		}

		enableDraggingOnWindow();
		return () => disableDraggingOnWindow();
	}, [canWriteMessage]);

	useEffect(() => {
		if (scrollContainerRef.current) {
			resetUnreadCount();
		}
	}, [scrollContainerRef]); // eslint-disable-line

	useEffect(() => {
		if (!messages) {
			return;
		}

		if (
			initialScrollCompleted &&
			isMyMessageMatrix(messages[messages.length - 1]?.userId)
		) {
			resetUnreadCount();
			scrollToEnd(0, true);
		} else {
			// if first unread message -> prepend element
			if (newMessages === 0 && !isScrolledToBottom) {
				const scrollContainer = scrollContainerRef.current;
				const firstUnreadItem = Array.from(
					scrollContainer.querySelectorAll('.messageItem')
				).pop();
				const lastReadDivider = document.createElement('div');
				lastReadDivider.innerHTML = translate(
					'session.divider.lastRead'
				);
				lastReadDivider.className =
					'messageItem__divider messageItem__divider--lastRead';
				firstUnreadItem.prepend(lastReadDivider);
			}

			if (isScrolledToBottom && initialScrollCompleted) {
				resetUnreadCount();
				scrollToEnd(0, true);
			}

			setNewMessages(messages.length - initMessageCount);
		}
	}, [messages?.length]); // eslint-disable-line

	useEffect(() => {
		if (isScrolledToBottom) {
			resetUnreadCount();
		}
	}, [isScrolledToBottom]); // eslint-disable-line

	const getPlaceholder = () => {
		if (activeSession.isGroup) {
			return translate('enquiry.write.input.placeholder.groupChat');
		} else if (hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)) {
			return translate('enquiry.write.input.placeholder.asker');
		} else if (hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)) {
			return translate('enquiry.write.input.placeholder.consultant');
		}
		return translate('enquiry.write.input.placeholder.asker');
	};

	/* eslint-disable */
	const handleScroll = useDebouncedCallback((e) => {
		const scrollPosition = Math.round(
			e.target.scrollHeight - e.target.scrollTop
		);
		const containerHeight = e.target.clientHeight;
		const isBottom =
			scrollPosition >= containerHeight - 1 &&
			scrollPosition <= containerHeight + 1;

		setIsScrolledToBottom(isBottom);
	}, 100);
	/* eslint-enable */

	const handleScrollToBottomButtonClick = () => {
		if (newMessages > 0) {
			const scrollContainer = scrollContainerRef.current;
			const sessionHeader =
				scrollContainer.parentElement.getElementsByClassName(
					'sessionInfo'
				)[0] as HTMLElement;
			const messageItems = scrollContainer.querySelectorAll(
				'.messageItem:not(.messageItem--right)'
			);
			const firstUnreadItem = messageItems[
				messageItems.length - newMessages
			] as HTMLElement;
			const firstUnreadItemOffet =
				firstUnreadItem.offsetTop - sessionHeader.offsetHeight;

			if (scrollContainer.scrollTop < firstUnreadItemOffet) {
				smoothScroll({
					duration: 1000,
					element: scrollContainer,
					to: firstUnreadItemOffet
				});
			} else {
				scrollToEnd(0, true);
			}
		} else {
			scrollToEnd(0, true);
		}
	};

	const enableInitialScroll = () => {
		if (!initialScrollCompleted) {
			setInitialScrollCompleted(true);
			scrollToEnd(500, true);
		}
	};

	const isOnlyEnquiry = type === SESSION_LIST_TYPES.ENQUIRY;

	const scrollBottomButtonItem: ButtonItem = {
		icon: <ArrowDoubleDownIcon />,
		type: BUTTON_TYPES.SMALL_ICON,
		smallIconBackgroundColor: 'alternate',
		title: translate('app.scrollDown')
	};

	// cancels dragging automatically if user drags outside the
	// browser window (there is no build-in mechanic for that)
	const cancelDraggingOnOutsideWindow = () => {
		if (dragCancelRef.current) {
			clearTimeout(dragCancelRef.current);
		}

		dragCancelRef.current = setTimeout(() => {
			setIsDragging(false);
		}, 300);
	};

	const disableDraggingOnWindow = () => {
		setIsDragging(false);
		window.ondrag = undefined;
	};

	const onDragEnter = () => setDragOverDropArea(true);
	const onDragLeave = () => setDragOverDropArea(false);

	const onFileDragged = (file: File) => {
		setDraggedFile(file);
		onDragLeave();
	};

	const handleMessageSendSuccess = () => {
		setDraggedFile(null);
		
		// MATRIX MIGRATION: Refresh messages after sending for Matrix sessions
		if (!activeSession.rid && props.refreshMessages) {
			// console.log('🔄 MATRIX: Refreshing messages after send...');
			setTimeout(() => {
				props.refreshMessages();
			}, 500); // Small delay to ensure message is processed
		}
	};

	const handleOpenThread = useCallback((message: MessageItem) => {
		setActiveThreadRootId(message._id);
		setActiveThreadRootMessage(message);
	}, []);

	const handleCloseThread = useCallback(() => {
		setActiveThreadRootId(null);
		setActiveThreadRootMessage(null);
	}, []);

	// If threads become disabled while a thread panel is open, close it immediately.
	useEffect(() => {
		if (!isThreadsEnabled && activeThreadRootId) {
			handleCloseThread();
		}
	}, [isThreadsEnabled, activeThreadRootId, handleCloseThread]);

	useEffect(() => {
		const roomId =
			(activeSession.rid && activeSession.rid.startsWith('!')
				? activeSession.rid
				: activeSession.item?.matrixRoomId || activeSession.rid || null) ||
			null;
		if (!roomId) {
			return;
		}

		apiPatchNotificationActiveView({
			roomId,
			threadRootId: activeThreadRootId,
			active: true
		}).catch(() => undefined);

		const heartbeat = window.setInterval(() => {
			apiPatchNotificationActiveView({
				roomId,
				threadRootId: activeThreadRootId,
				active: true
			}).catch(() => undefined);
		}, 10000);

		return () => {
			window.clearInterval(heartbeat);
			apiPatchNotificationActiveView({
				roomId,
				threadRootId: null,
				active: false
			}).catch(() => undefined);
		};
	}, [activeSession.rid, activeSession.item?.matrixRoomId, activeThreadRootId]);

	// Track the decryption success because we have a short timing issue when
	// message is send before the room encryption
	const decryptionSuccess = useRef([]);
	const handleDecryptionSuccess = useCallback((id: string) => {
		if (decryptionSuccess.current.includes(id)) {
			return;
		}

		decryptionSuccess.current.push(id);
	}, []);
	const lastDecryptionError = useRef(0);
	const handleDecryptionErrors = useDebounceCallback(
		useCallback((collectedErrors: [[string, number, TError]]) => {
			Promise.all(
				collectedErrors
					// Filter already tracked error messages
					.filter(([, ts]) => ts > lastDecryptionError.current)
					.filter(([id]) => !decryptionSuccess.current.includes(id))
					// Keep only last error of one type
					.reduce((acc, [, timestamp, collectedError], i) => {
						const trackedErrorIndex = acc.findIndex(
							([, accError]) =>
								accError.message === collectedError.message
						);
						if (
							trackedErrorIndex >= 0 &&
							acc[trackedErrorIndex][1].message ===
								collectedError.message
						) {
							if (timestamp > acc[trackedErrorIndex][0]) {
								acc.splice(
									trackedErrorIndex,
									1,
									collectedErrors[i]
								);
							}
						} else {
							acc.push(collectedErrors[i]);
						}
						return acc;
					}, [])
					.map(([, timestamp, collectedError]) => {
						lastDecryptionError.current =
							timestamp > lastDecryptionError.current
								? timestamp
								: lastDecryptionError.current;

						return apiPostError(collectedError);
					})
			).then((a) => {
				if (a.length > 0) {
					// console.log(`${a.length} error(s) reported.`);
				}
			});
		}, []),
		1000,
		true
	);

	return (
		<div className="session">
			<div
				ref={headerRef}
				style={isEmbeddedNotificationsView ? { display: 'none' } : undefined}
			>
				{!isEmbeddedNotificationsView && (
					<SessionHeaderComponent
						consultantAbsent={
							activeSession.consultant &&
							activeSession.consultant.absent
								? activeSession.consultant
								: null
						}
						hasUserInitiatedStopOrLeaveRequest={
							props.hasUserInitiatedStopOrLeaveRequest
						}
						bannedUsers={props.bannedUsers}
					/>
				)}
			</div>

			<div
				id="session-scroll-container"
				className={clsx(
					'session__content',
					isDragging && 'drag-in-progress',
					activeThreadRootId && 'session__content--withThread'
				)}
				ref={scrollContainerRef}
				onScroll={(e) => handleScroll(e)}
				onDragEnter={onDragEnter}
			>
				{isSupervisor && supervisionReason && (
					<div className="session__supervisionReason">
						<div className="session__supervisionReasonTitle">
							{translate('session.supervisor.reason.title', 'Supervisionsgrund')}
						</div>
						<div className="session__supervisionReasonText">
							{supervisionReason}
						</div>
					</div>
				)}
				<EncryptionBanner />
				<div className={'message-holder'}>
					{/* MATRIX MIGRATION: For Matrix sessions (no rid), skip E2EE ready check */}
					{messages &&
						(ready || !activeSession.rid) &&
						messages.map((message: MessageItem, index) => (
							<React.Fragment key={`${message._id}-${index}`}>
								<MessageItemComponent
									clientName={
										getContact(activeSession)?.username ||
										translate(
											'sessionList.user.consultantUnknown'
										)
									}
									askerRcId={
										!activeSession.rid &&
										message.userId &&
										!message.userId.includes(
											activeSession.consultant?.username || ''
										)
											? message.userId
											: activeSession.item.askerRcId
									}
									isOnlyEnquiry={isOnlyEnquiry}
									isMyMessage={isMyMessageMatrix(message.userId)}
									isUserBanned={props.bannedUsers.includes(
										message.username
									)}
									handleDecryptionErrors={
										handleDecryptionErrors
									}
									handleDecryptionSuccess={
										handleDecryptionSuccess
									}
									e2eeParams={{
										key,
										keyID,
										encrypted,
										subscriptionKeyLost
									}}
									renderMode="main"
									threadsEnabled={isThreadsEnabled}
									threadSummary={threadSummaries.get(message._id)}
									onOpenThread={
										isThreadsEnabled ? () => handleOpenThread(message) : undefined
									}
									{...message}
								/>
							</React.Fragment>
						))}
					<div
						className={`session__scrollToBottom ${
							isScrolledToBottom
								? 'session__scrollToBottom--disabled'
								: ''
						}`}
					>
						{newMessages > 0 && (
							<span className="session__unreadCount">
								{newMessages > 99
									? translate('session.unreadCount.maxValue')
									: newMessages}
							</span>
						)}
						<Button
							item={scrollBottomButtonItem}
							isLink={false}
							buttonHandle={handleScrollToBottomButtonClick}
						/>
					</div>
				</div>
			</div>

			{isThreadsEnabled && activeThreadRootId && (
				<div className="session__threadPanel">
					<div className="session__threadHeader">
						<div className="session__threadTitle">
							{translate('message.thread.title', 'Thread')}
						</div>
						<button
							type="button"
							className="session__threadClose"
							onClick={handleCloseThread}
						>
							×
						</button>
					</div>
					<div className="session__threadBody">
						{activeThreadRootMessage && (
							<MessageItemComponent
								clientName={
									getContact(activeSession)?.username ||
									translate('sessionList.user.consultantUnknown')
								}
								askerRcId={
									!activeSession.rid &&
									activeThreadRootMessage.userId &&
									!activeThreadRootMessage.userId.includes(
										activeSession.consultant?.username || ''
									)
										? activeThreadRootMessage.userId
										: activeSession.item.askerRcId
								}
								isOnlyEnquiry={isOnlyEnquiry}
								isMyMessage={isMyMessageMatrix(activeThreadRootMessage.userId)}
								isUserBanned={props.bannedUsers.includes(
									activeThreadRootMessage.username
								)}
								handleDecryptionErrors={handleDecryptionErrors}
								handleDecryptionSuccess={handleDecryptionSuccess}
								e2eeParams={{
									key,
									keyID,
									encrypted,
									subscriptionKeyLost
								}}
								renderMode="thread"
								threadsEnabled={true}
								forceShow={true}
								{...activeThreadRootMessage}
							/>
						)}
						{messages &&
							(ready || !activeSession.rid) &&
							messages.map((message: MessageItem, index) => (
								<React.Fragment key={`thread-${message._id}-${index}`}>
									<MessageItemComponent
										clientName={
											getContact(activeSession)?.username ||
											translate('sessionList.user.consultantUnknown')
										}
										askerRcId={
											!activeSession.rid &&
											message.userId &&
											!message.userId.includes(
												activeSession.consultant?.username || ''
											)
												? message.userId
												: activeSession.item.askerRcId
										}
										isOnlyEnquiry={isOnlyEnquiry}
										isMyMessage={isMyMessageMatrix(message.userId)}
										isUserBanned={props.bannedUsers.includes(
											message.username
										)}
										handleDecryptionErrors={handleDecryptionErrors}
										handleDecryptionSuccess={handleDecryptionSuccess}
										e2eeParams={{
											key,
											keyID,
											encrypted,
											subscriptionKeyLost
										}}
										renderMode="thread"
										threadsEnabled={true}
										threadRootId={activeThreadRootId}
										{...message}
									/>
								</React.Fragment>
							))}
					</div>
					<div className="session__threadInput">
						<MessageSubmitInterfaceComponent
							isTyping={props.isTyping}
							className="session__submit-interface"
							placeholder={translate(
								'message.thread.placeholder',
								'Reply in thread'
							)}
							typingUsers={props.typingUsers}
							handleMessageSendSuccess={handleMessageSendSuccess}
							isSupervisor={isSupervisor}
							threadRootId={activeThreadRootId}
							threadParentPreview={
								activeThreadRootMessage
									? parseMessagePrefixes(activeThreadRootMessage.message)
											.cleanedMessage
									: null
							}
						/>
					</div>
				</div>
			)}

			{type === SESSION_LIST_TYPES.ENQUIRY && (
				<AcceptAssign btnLabel={'enquiry.acceptButton.known'} />
			)}

			{canWriteMessage && (
				<>
					{isSupervisor && (
						<div className="session__supervisorInputNote" style={{
							textAlign: 'center'
						}}>
							{translate(
								'session.supervisor.input.note',
								'Messages you send here are visible only to consultants.'
							)}
						</div>
					)}
					<Suspense
						fallback={
							<MessageSubmitInterfaceSkeleton
								placeholder={getPlaceholder()}
								className={clsx('session__submit-interface')}
							/>
						}
					>
						<MessageSubmitInterfaceComponent
							isTyping={props.isTyping}
							className={clsx(
								'session__submit-interface',
								!isScrolledToBottom &&
									'session__submit-interface--scrolled-up',
								activeThreadRootId && 'session__submit-interface--withThread'
							)}
							placeholder={getPlaceholder()}
							typingUsers={props.typingUsers}
							preselectedFile={draggedFile}
							handleMessageSendSuccess={handleMessageSendSuccess}
							isSupervisor={isSupervisor}
						/>
					</Suspense>
					{!tenantData?.settings?.featureAttachmentUploadDisabled && (
						<DragAndDropArea
							onFileDragged={onFileDragged}
							isDragging={isDragging}
							canDrop={isDragOverDropArea}
							onDragLeave={onDragLeave}
							styleOverride={{ top: headerBounds.height + 'px' }}
						/>
					)}
				</>
			)}
		</div>
	);
};
