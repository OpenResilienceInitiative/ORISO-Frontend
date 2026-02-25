import * as React from 'react';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ReactComponent as NotificationBellIcon } from '../../resources/img/icons/notification_bell.svg';
import {
	NotificationsContext,
	UserDataContext,
	AUTHORITIES,
	hasUserAuthority
} from '../../globalState';
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

export const NotificationsCenter = () => {
	const { t: translate, i18n } = useTranslation();
	const history = useHistory();
	const { userData } = useContext(UserDataContext);
	const {
		notificationFeed,
		markNotificationAsRead,
		markAllNotificationsAsRead,
		clearNotificationFeed
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
			notificationFeed.find((item) => item.id === selectedNotificationId) ||
			null,
		[notificationFeed, selectedNotificationId]
	);

	const openNotification = (id: string) => {
		setSelectedNotificationId(id);
		markNotificationAsRead(id);
	};

	const getDefaultSessionsPath = () =>
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
			? '/sessions/consultant/sessionView'
			: '/sessions/user/view';

	const handleOpenAction = () => {
		if (!selectedNotification) return;
		markNotificationAsRead(selectedNotification.id);
		if (selectedNotification.actionPath) {
			history.push(selectedNotification.actionPath);
			return;
		}
		history.push(getDefaultSessionsPath());
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
					<button
						type="button"
						className="notificationsCenter__actionButton"
						onClick={clearNotificationFeed}
					>
						{translate('notifications.center.clearAll', 'Clear all')}
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
						notificationFeed.map((item) => (
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
								onClick={() => openNotification(item.id)}
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
						))
					)}
				</div>
				<div className="notificationsCenter__detail">
					{selectedNotification ? (
						<div className="notificationsCenter__detailCard">
							<h3 className="notificationsCenter__detailTitle">
								{selectedNotification.title}
							</h3>
							<p className="notificationsCenter__detailText">
								{selectedNotification.text}
							</p>
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

