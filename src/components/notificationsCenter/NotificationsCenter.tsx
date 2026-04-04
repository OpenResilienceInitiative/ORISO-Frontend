import * as React from 'react';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ReactComponent as NotificationBellIcon } from '../../resources/img/icons/notification_bell.svg';
import { apiUrl } from '../../resources/scripts/endpoints';
import { FETCH_METHODS, fetchData } from '../../api/fetchData';
import {
	buildThreadPrefix,
	parseMessagePrefixes
} from '../message/messageConstants';
import { UserAvatar } from '../message/UserAvatar';
import { apiPostMessageEventNotification } from '../../api/apiPostMessageEventNotification';
import {
	NotificationsContext,
	UserDataContext,
	AUTHORITIES,
	hasUserAuthority
} from '../../globalState';
import { useResponsive } from '../../hooks/useResponsive';
import { useTranslation } from 'react-i18next';
import './notificationsCenter.styles';

const formatRelativeTime = (createdAt: string, locale?: string) => {
	const normalizedCreatedAt =
		createdAt &&
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(createdAt) &&
		!/Z|[+-]\d{2}:\d{2}$/.test(createdAt)
			? `${createdAt}Z`
			: createdAt;
	const date = new Date(normalizedCreatedAt);
	const diffMs = Date.now() - date.getTime();
	const diffMin = Math.max(0, Math.floor(diffMs / (1000 * 60)));
	if (diffMin < 1) return 'now';
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHours = Math.floor(diffMin / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleString(locale || 'de-DE');
};

const getNotificationCategory = (item: any): 'system' | 'message' => {
	if (item?.category === 'message') return 'message';
	if (item?.actionPath?.includes('threadRootId=')) return 'message';
	return 'system';
};

const getChatKey = (item: any): string => {
	if (item?.sourceSessionId) {
		return `session-${String(item.sourceSessionId)}`;
	}
	if (item?.actionPath) {
		return `path-${String(item.actionPath).split('?')[0]}`;
	}
	return `misc-${item?.id || 'unknown'}`;
};

const resolveSessionId = (item: any): string | null => {
	if (item?.sourceSessionId) {
		return String(item.sourceSessionId);
	}
	const path = item?.actionPath;
	if (!path) {
		return null;
	}
	const match = String(path).match(/\/(\d+)(?:\?|$)/);
	return match?.[1] || null;
};

const resolveRoomRef = (item: any): string | null => {
	const path = item?.actionPath;
	if (!path) {
		return null;
	}
	const pathWithoutQuery = String(path).split('?')[0];
	const parts = pathWithoutQuery.split('/').filter(Boolean);
	if (parts.length < 2) {
		return null;
	}
	const maybeRoomRef = parts[parts.length - 2];
	return maybeRoomRef || null;
};

const resolveThreadRootId = (item: any): string | null => {
	const path = item?.actionPath;
	if (!path || !String(path).includes('?')) {
		return null;
	}
	const query = String(path).split('?')[1];
	const params = new URLSearchParams(query);
	const threadRootId = params.get('threadRootId');
	return threadRootId ? decodeURIComponent(threadRootId) : null;
};

const toNonEmbeddedPath = (path?: string | null): string | null => {
	if (!path) {
		return null;
	}
	const [basePath, queryString = ''] = String(path).split('?');
	const query = new URLSearchParams(queryString);
	query.delete('embeddedNotifications');
	const finalQuery = query.toString();
	return `${basePath}${finalQuery ? `?${finalQuery}` : ''}`;
};

type ChatPreviewMessage = {
	id: string;
	sender: string;
	text: string;
	timestamp?: number;
	threadRootId?: string | null;
	isThreadMessage?: boolean;
};

export const NotificationsCenter = () => {
	const { t: translate, i18n } = useTranslation();
	const history = useHistory();
	const { untilL } = useResponsive();
	const { userData } = useContext(UserDataContext);
	const {
		notificationFeed,
		markNotificationAsRead,
		markAllNotificationsAsRead
	} = useContext(NotificationsContext);
	const [selectedNotificationId, setSelectedNotificationId] = useState<
		string | null
	>(notificationFeed[0]?.id || null);
	const [chatPreviewMessages, setChatPreviewMessages] = useState<
		ChatPreviewMessage[]
	>([]);
	const [chatPreviewLoading, setChatPreviewLoading] = useState(false);
	const [chatReplyText, setChatReplyText] = useState('');
	const [isSendingChatReply, setIsSendingChatReply] = useState(false);
	const [chatPreviewRefreshToken, setChatPreviewRefreshToken] = useState(0);

	useEffect(() => {
		if (!selectedNotificationId && notificationFeed.length > 0) {
			setSelectedNotificationId(notificationFeed[0].id);
			return;
		}
		if (
			selectedNotificationId &&
			!notificationFeed.some((item) => item.id === selectedNotificationId)
		) {
			setSelectedNotificationId(notificationFeed[0]?.id || null);
		}
	}, [notificationFeed, selectedNotificationId]);

	const selectedNotification = useMemo(
		() =>
			notificationFeed.find(
				(item) => item.id === selectedNotificationId
			) || null,
		[notificationFeed, selectedNotificationId]
	);
	const selectedNotificationCategory = useMemo(
		() =>
			selectedNotification
				? getNotificationCategory(selectedNotification)
				: 'system',
		[selectedNotification]
	);
	const selectedSessionId = useMemo(
		() => resolveSessionId(selectedNotification),
		[selectedNotification]
	);
	const selectedThreadRootId = useMemo(
		() => resolveThreadRootId(selectedNotification),
		[selectedNotification]
	);
	const canShowChatPreview = selectedNotificationCategory === 'message';
	const embeddedChatPath = useMemo(() => {
		if (!canShowChatPreview) {
			return null;
		}
		const basePath = selectedNotification?.actionPath
			? selectedNotification.actionPath
			: selectedSessionId
				? `${getDefaultSessionsPath()}/session/${selectedSessionId}${
						selectedThreadRootId
							? `?threadRootId=${encodeURIComponent(selectedThreadRootId)}`
							: ''
					}`
				: null;
		if (!basePath) {
			return null;
		}
		const hasQuery = basePath.includes('?');
		return `${basePath}${hasQuery ? '&' : '?'}embeddedNotifications=1`;
	}, [
		canShowChatPreview,
		selectedNotification?.actionPath,
		selectedSessionId,
		selectedThreadRootId
	]);

	useEffect(() => {
		setChatReplyText('');
	}, [selectedNotificationId]);

	useEffect(() => {
		const fetchChatPreview = async () => {
			if (selectedNotificationCategory !== 'message') {
				setChatPreviewMessages([]);
				setChatPreviewLoading(false);
				return;
			}
			if (!selectedSessionId) {
				setChatPreviewMessages([]);
				setChatPreviewLoading(false);
				return;
			}
			const hasExistingPreview = chatPreviewMessages.length > 0;
			if (!hasExistingPreview) {
				setChatPreviewLoading(true);
			}
			try {
				const payload = (await fetchData({
					url: `${apiUrl}/service/matrix/sessions/${selectedSessionId}/messages`,
					method: FETCH_METHODS.GET,
					responseHandling: []
				})) as {
					messages?: Array<any>;
				};
				const rawMessages = payload?.messages || [];
				const previewItems = rawMessages
					.slice(0, 16)
					.reverse()
					.map((msg) => {
						const body = msg?.content?.body || '';
						const parsed = parseMessagePrefixes(body);
						const cleaned = parsed.cleanedMessage;
						const fallbackText =
							msg?.content?.msgtype &&
							msg.content.msgtype !== 'm.text'
								? 'Attachment'
								: '';
						return {
							id: String(msg?.event_id || Math.random()),
							sender:
								String(msg?.sender || '')
									.split(':')[0]
									.replace('@', '') || 'unknown',
							text: cleaned || fallbackText,
							timestamp: Number(msg?.origin_server_ts || 0),
							threadRootId: parsed.threadRootId || null,
							isThreadMessage: parsed.isThreadMessage
						};
					})
					.filter((entry) => {
						if (!entry.text) {
							return false;
						}
						// For thread notifications show only that thread; for regular message notifications show main chat flow.
						if (selectedThreadRootId) {
							return entry.threadRootId === selectedThreadRootId;
						}
						return !entry.isThreadMessage;
					});

				setChatPreviewMessages(previewItems);
			} catch (_error) {
				setChatPreviewMessages([]);
			} finally {
				setChatPreviewLoading(false);
			}
		};

		void fetchChatPreview();
	}, [
		chatPreviewRefreshToken,
		selectedNotificationCategory,
		selectedSessionId,
		selectedThreadRootId
	]);

	const getNextNotificationId = (
		fromId: string | null,
		unreadOnly: boolean
	): string | null => {
		if (notificationFeed.length === 0) {
			return null;
		}
		const startIndex = fromId
			? notificationFeed.findIndex((item) => item.id === fromId)
			: -1;
		const matchesRule = (item: (typeof notificationFeed)[number]) =>
			!unreadOnly || !item.readAt;

		for (let i = startIndex + 1; i < notificationFeed.length; i++) {
			if (matchesRule(notificationFeed[i])) {
				return notificationFeed[i].id;
			}
		}
		for (let i = 0; i <= startIndex; i++) {
			if (i >= 0 && matchesRule(notificationFeed[i])) {
				return notificationFeed[i].id;
			}
		}
		return null;
	};

	const getDefaultSessionsPath = () =>
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
			? '/sessions/consultant/sessionView'
			: '/sessions/user/view';

	const openNotification = (item: (typeof notificationFeed)[number]) => {
		markNotificationAsRead(item.id);
		if (untilL) {
			const directPath = toNonEmbeddedPath(item.actionPath);
			if (directPath) {
				history.push(directPath);
				return;
			}
			history.push(getDefaultSessionsPath());
			return;
		}
		setSelectedNotificationId(item.id);
	};

	const handleOpenAction = () => {
		if (!selectedNotification) return;
		const nextUnreadId = getNextNotificationId(
			selectedNotification.id,
			true
		);
		markNotificationAsRead(selectedNotification.id);
		if (nextUnreadId && nextUnreadId !== selectedNotification.id) {
			setSelectedNotificationId(nextUnreadId);
		}
		const directPath = toNonEmbeddedPath(selectedNotification.actionPath);
		if (directPath) {
			history.push(directPath);
			return;
		}
		history.push(getDefaultSessionsPath());
	};

	const handleNextNotification = () => {
		const nextUnreadId = getNextNotificationId(
			selectedNotificationId,
			true
		);
		if (nextUnreadId) {
			const nextItem = notificationFeed.find(
				(item) => item.id === nextUnreadId
			);
			if (nextItem) {
				openNotification(nextItem);
			}
		}
	};

	const nextUnreadId = getNextNotificationId(selectedNotificationId, true);
	const selectedRoomRef = resolveRoomRef(selectedNotification);

	const handleSendChatReply = async () => {
		if (
			!canShowChatPreview ||
			!selectedSessionId ||
			!chatReplyText.trim() ||
			isSendingChatReply
		) {
			return;
		}
		setIsSendingChatReply(true);
		try {
			const cleanMessage = chatReplyText.trim();
			const outboundMessage = selectedThreadRootId
				? `${buildThreadPrefix(selectedThreadRootId)} ${cleanMessage}`
				: cleanMessage;

			await fetchData({
				url: `${apiUrl}/service/matrix/sessions/${selectedSessionId}/messages`,
				method: FETCH_METHODS.POST,
				bodyData: JSON.stringify({ message: outboundMessage }),
				responseHandling: []
			});

			if (selectedRoomRef) {
				void apiPostMessageEventNotification({
					roomId: selectedRoomRef,
					messagePreview: cleanMessage,
					matrixRoom: selectedRoomRef.startsWith('!'),
					threadRootId: selectedThreadRootId || null,
					supervisorMessage: false,
					senderDisplayName:
						userData?.displayName || userData?.userName || null,
					threadParentPreview: null
				}).catch(() => undefined);
			}

			setChatReplyText('');
			setChatPreviewRefreshToken((prev) => prev + 1);
		} finally {
			setIsSendingChatReply(false);
		}
	};

	return (
		<div className="notificationsCenter">
			<div className="notificationsCenter__header">
				<div className="notificationsCenter__titleBlock">
					<h2 className="notificationsCenter__title">
						{translate(
							'notifications.center.title',
							'Notifications'
						)}
					</h2>
					<p className="notificationsCenter__subtitle">
						{translate(
							'notifications.center.subtitle',
							'Recent activities and updates from your chats.'
						)}
					</p>
				</div>
				<div className="notificationsCenter__actions">
					<button
						type="button"
						className="notificationsCenter__actionButton"
						onClick={markAllNotificationsAsRead}
					>
						{translate(
							'notifications.center.markAllRead',
							'Mark all as read'
						)}
					</button>
				</div>
			</div>
			<div className="notificationsCenter__content">
				<div className="notificationsCenter__list">
					{notificationFeed.length === 0 ? (
						<div className="notificationsCenter__empty">
							{translate(
								'notifications.center.empty',
								'No notifications yet.'
							)}
						</div>
					) : (
						notificationFeed.map((item) =>
							(() => {
								const category = getNotificationCategory(item);
								const isMessage = category === 'message';
								return (
									<button
										type="button"
										key={item.id}
										className={`notificationsCenter__listItem ${
											selectedNotificationId === item.id
												? 'notificationsCenter__listItem--active'
												: ''
										}`}
										onClick={() => openNotification(item)}
									>
										<div className="notificationsCenter__listItemTagRow">
											<span
												className={`notificationsCenter__listItemTag ${
													isMessage
														? 'notificationsCenter__listItemTag--message'
														: 'notificationsCenter__listItemTag--system'
												}`}
											>
												{isMessage
													? translate(
															'notifications.center.messageTag',
															'Message notification'
														)
													: translate(
															'notifications.center.systemTag',
															'System notification'
														)}
											</span>
										</div>
										<div className="notificationsCenter__listItemBody">
											<div className="notificationsCenter__listItemIconCircle">
												<NotificationBellIcon />
											</div>
											<div className="notificationsCenter__listItemContent">
												<div className="notificationsCenter__listItemHeader">
													<span className="notificationsCenter__listItemTitle">
														{item.title}
													</span>
													<span className="notificationsCenter__listItemTime">
														{formatRelativeTime(
															item.createdAt,
															i18n.language
														)}
													</span>
												</div>
												<div className="notificationsCenter__listItemText">
													{item.text}
												</div>
											</div>
										</div>
										{!item.readAt && (
											<span className="notificationsCenter__listItemUnread" />
										)}
									</button>
								);
							})()
						)
					)}
				</div>
				<div
					className={`notificationsCenter__detail ${
						canShowChatPreview && embeddedChatPath
							? 'notificationsCenter__detail--embeddedChat'
							: ''
					}`}
				>
					{selectedNotification ? (
						<div className="notificationsCenter__detailCard">
							<h3 className="notificationsCenter__detailTitle">
								{selectedNotification.title}
							</h3>
							<p className="notificationsCenter__detailText">
								{selectedNotification.text}
							</p>
							<div className="notificationsCenter__detailActions">
								<button
									type="button"
									className="notificationsCenter__openButton"
									onClick={handleOpenAction}
								>
									{selectedNotification.actionLabel ||
										translate(
											'notifications.center.open',
											'Open chat'
										)}
								</button>
								<button
									type="button"
									className="notificationsCenter__nextButton"
									onClick={handleNextNotification}
									disabled={!nextUnreadId}
								>
									{translate(
										'notifications.center.next',
										'Next notification'
									)}
								</button>
							</div>
							{canShowChatPreview && embeddedChatPath && (
								<div className="notificationsCenter__embeddedSession">
									<iframe
										title="notifications-chat-session"
										src={embeddedChatPath}
										className="notificationsCenter__embeddedSessionFrame"
									/>
								</div>
							)}
							{canShowChatPreview && !embeddedChatPath && (
								<div className="notificationsCenter__chatPreview">
									<div className="notificationsCenter__chatPreviewHeader">
										<div className="notificationsCenter__chatPreviewTitle">
											{translate(
												'notifications.center.chatPreview',
												'Chat preview'
											)}
										</div>
										{selectedSessionId && (
											<div className="notificationsCenter__chatPreviewMeta">
												{`#${selectedSessionId}`}
											</div>
										)}
									</div>
									<div className="notificationsCenter__chatPreviewBody">
										{!selectedSessionId ? (
											<div className="notificationsCenter__chatPreviewEmpty">
												{translate(
													'notifications.center.chatPreviewNoSession',
													'No chat linked to this notification.'
												)}
											</div>
										) : chatPreviewLoading &&
										  chatPreviewMessages.length === 0 ? (
											<div className="notificationsCenter__chatPreviewEmpty">
												{translate(
													'notifications.center.chatPreviewLoading',
													'Loading chat preview...'
												)}
											</div>
										) : chatPreviewMessages.length === 0 ? (
											<div className="notificationsCenter__chatPreviewEmpty">
												{translate(
													'notifications.center.chatPreviewEmpty',
													'No visible messages yet.'
												)}
											</div>
										) : (
											chatPreviewMessages.map((entry) => (
												<div
													key={entry.id}
													className="notificationsCenter__chatPreviewMessage"
												>
													<div className="notificationsCenter__chatPreviewMessageAvatar">
														<UserAvatar
															username={
																entry.sender
															}
															displayName={
																entry.sender
															}
															userId={
																entry.sender
															}
															size="28px"
														/>
													</div>
													<div className="notificationsCenter__chatPreviewMessageContent">
														<span className="notificationsCenter__chatPreviewSender">
															{entry.sender}
														</span>
														<span className="notificationsCenter__chatPreviewText">
															{entry.text}
														</span>
													</div>
												</div>
											))
										)}
									</div>
									<div className="notificationsCenter__chatComposer">
										<input
											type="text"
											className="notificationsCenter__chatComposerInput"
											placeholder={
												selectedThreadRootId
													? translate(
															'notifications.center.replyInThread',
															'Reply in this thread...'
														)
													: translate(
															'notifications.center.replyInChat',
															'Write a message...'
														)
											}
											value={chatReplyText}
											onChange={(event) =>
												setChatReplyText(
													event.target.value
												)
											}
											onKeyDown={(event) => {
												if (event.key === 'Enter') {
													event.preventDefault();
													void handleSendChatReply();
												}
											}}
										/>
										<button
											type="button"
											className="notificationsCenter__chatComposerSend"
											onClick={() =>
												void handleSendChatReply()
											}
											disabled={
												isSendingChatReply ||
												!chatReplyText.trim()
											}
										>
											{isSendingChatReply
												? translate(
														'notifications.center.sending',
														'Sending...'
													)
												: translate(
														'notifications.center.send',
														'Send'
													)}
										</button>
									</div>
								</div>
							)}
						</div>
					) : (
						<div className="notificationsCenter__emptyDetail">
							{translate(
								'notifications.center.emptyDetail',
								'Select a notification to see the details.'
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
