import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
	getEventDescriptor,
	getEventIcon,
	renderEventStrings,
	familyLabelKey,
	isKnownEventType
} from './eventDescriptors';
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

// WP-06 Activity Timeline (Slice 0a): category is registry-driven for known
// event types; unknown / local-only types keep the legacy heuristic so nothing
// regresses while the backend is incremental.
const resolveItemCategory = (item: any): 'system' | 'message' =>
	isKnownEventType(item?.eventType)
		? getEventDescriptor(item.eventType).category
		: getNotificationCategory(item);

// WP-06: render an item's visible strings from its event descriptor's i18n
// templates (ADR-AT-01 — the server record is text-free), falling back to the
// server-provided title/text until the strict text-free migration (Slice 2).
const describeItem = (
	item: any,
	translate: (key: string, options?: Record<string, unknown>) => string
) => {
	const descriptor = getEventDescriptor(item?.eventType);
	const { title, text } = renderEventStrings(descriptor, translate, {
		fallbackTitle: item?.title,
		fallbackText: item?.text
	});
	return { descriptor, title, text };
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
				? resolveItemCategory(selectedNotification)
				: 'system',
		[selectedNotification]
	);
	const selectedDisplay = useMemo(
		() =>
			selectedNotification
				? describeItem(selectedNotification, translate)
				: null,
		[selectedNotification, translate]
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
	const getDefaultSessionsPath = useCallback(
		() =>
			hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
				? '/sessions/consultant/sessionView'
				: '/sessions/user/view',
		[userData]
	);
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
		getDefaultSessionsPath,
		selectedNotification?.actionPath,
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
								const category = resolveItemCategory(item);
								const isMessage = category === 'message';
								const { descriptor, title, text } =
									describeItem(item, translate);
								const Icon = getEventIcon(descriptor.icon);
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
												{translate(familyLabelKey(descriptor.family))}
											</span>
										</div>
										<div className="notificationsCenter__listItemBody">
											<div className="notificationsCenter__listItemIconCircle">
												<Icon />
											</div>
											<div className="notificationsCenter__listItemContent">
												<div className="notificationsCenter__listItemHeader">
													<span className="notificationsCenter__listItemTitle">
														{title}
													</span>
													<span className="notificationsCenter__listItemTime">
														{formatRelativeTime(
															item.createdAt,
															i18n.language
														)}
													</span>
												</div>
												<div className="notificationsCenter__listItemText">
													{text}
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
								{selectedDisplay?.title}
							</h3>
							<p className="notificationsCenter__detailText">
								{selectedDisplay?.text}
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
