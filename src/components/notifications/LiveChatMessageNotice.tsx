import * as React from 'react';
import { useCallback, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
	NotificationsContext,
	NotificationType
} from '../../globalState/provider/NotificationsProvider';
import { ReactComponent as LiveChatIcon } from '../../resources/img/icons/modality-chat.svg';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/close.svg';
import './notification.styles';

/**
 * In-app pop-up for a new live-chat message to a counsellor (FE#1470). The OS
 * banner only shows while the tab is unfocused and permission was granted;
 * this one shows inside the app, so a counsellor working in another chat
 * still notices a waiting live-chat seeker.
 */
export const NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE = 'liveChatMessage';
export type NotificationTypeLiveChatMessage =
	typeof NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE;

export interface LiveChatMessageNoticeProps extends NotificationType {
	id: string;
	notificationType: NotificationTypeLiveChatMessage;
	sessionId: string;
	/** Matrix room of the chat, to notice it being opened by another route. */
	roomRef?: string | null;
	/** Sender label from the feed row (metadata only, never content). */
	senderName?: string | null;
	/** New messages in this chat since the pop-up appeared. */
	count: number;
	/** Where "Open chat" leads; null when the feed row names no target. */
	path: string | null;
}

export const isNotificationTypeLiveChatMessage = (
	notification: NotificationType
): notification is LiveChatMessageNoticeProps =>
	notification.notificationType === NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE;

export const liveChatMessageNoticeId = (sessionId: string) =>
	`live-chat-message:${sessionId}`;

/** The feed fields the pop-up decision reads. */
export interface LiveChatFeedEvent {
	eventType: string;
	sourceSessionId?: string;
	actionPath?: string;
	params?: {
		conversationType?: string | null;
		recipientRole?: string | null;
		senderName?: string | null;
		roomRef?: string | null;
		mentioned?: boolean | null;
	};
}

const pathSegments = (path: string) =>
	path.split(/[?#]/)[0].split('/').filter(Boolean).map(decodeURIComponent);

/**
 * Whether the counsellor is looking at this chat right now: its session view
 * is the current route and the tab is visible. Then the message is on screen
 * and needs neither pop-up nor tone.
 */
export const isLiveChatOpen = (
	event: LiveChatFeedEvent,
	pathname: string,
	visible: boolean
): boolean => {
	if (!visible) return false;
	const segments = pathSegments(pathname);
	if (!segments.includes('sessionView')) return false;
	const sessionId = event.sourceSessionId;
	const roomRef = event.params?.roomRef;
	const last = segments[segments.length - 1];
	return (
		(!!sessionId && last === String(sessionId)) ||
		(!!roomRef && segments.includes(roomRef))
	);
};

/** True for a new live-chat message addressed to a counsellor. */
export const isLiveChatMessageForCounsellor = (event: LiveChatFeedEvent) =>
	event.eventType === 'message.new' &&
	event.params?.conversationType === 'LIVE_CHAT' &&
	event.params?.recipientRole === 'consultant' &&
	!!event.sourceSessionId;

/**
 * Adds the pop-up for a chat, or counts one more message on the pop-up that
 * chat already shows, so a burst never stacks cards for one seeker.
 */
export const upsertLiveChatMessageNotice = <T extends NotificationType>(
	notifications: T[],
	notice: LiveChatMessageNoticeProps
): (T | LiveChatMessageNoticeProps)[] => {
	const index = notifications.findIndex(
		(item) =>
			item.id === notice.id &&
			item.notificationType === NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE
	);
	if (index === -1) return [...notifications, notice];
	const shown = notifications[index] as unknown as LiveChatMessageNoticeProps;
	const next: (T | LiveChatMessageNoticeProps)[] = [...notifications];
	next[index] = {
		...shown,
		senderName: notice.senderName ?? shown.senderName,
		path: notice.path ?? shown.path,
		count: shown.count + notice.count
	};
	return next;
};

export const LiveChatMessageNotice = (props: LiveChatMessageNoticeProps) => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { removeNotification } = useContext(NotificationsContext);
	const close = useCallback(
		() => removeNotification(props.id, NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE),
		[props.id, removeNotification]
	);
	const open = useCallback(() => {
		close();
		if (props.path) navigate(props.path);
	}, [close, navigate, props.path]);
	// Opening the chat any other way (list, feed) also settles the pop-up.
	const { pathname } = useLocation();
	useEffect(() => {
		if (
			isLiveChatOpen(
				{
					eventType: 'message.new',
					sourceSessionId: props.sessionId,
					params: { roomRef: props.roomRef }
				},
				pathname,
				true
			)
		)
			close();
	}, [close, pathname, props.roomRef, props.sessionId]);

	return (
		<div
			className="notification notification--info notification--liveChatMessage"
			role="status"
			data-cy="live-chat-message-notice"
		>
			<div className="notification__header">
				<div className="notification__icon">
					<LiveChatIcon aria-hidden="true" focusable="false" />
				</div>
				<div className="notification__title">
					{t('notification.liveChatMessage.title')}
				</div>
				<button
					type="button"
					className="notification__close"
					onClick={close}
					aria-label={t('app.close')}
					title={t('app.close')}
				>
					<CloseIcon aria-hidden="true" focusable="false" />
				</button>
			</div>
			<div className="notification__text">
				{props.senderName && (
					<div className="notification__sender">
						{t('notification.liveChatMessage.from', {
							name: props.senderName
						})}
					</div>
				)}
				{props.count > 1 && (
					<div data-cy="live-chat-message-count">
						{t('notification.liveChatMessage.several', {
							count: props.count
						})}
					</div>
				)}
			</div>
			{props.path && (
				<div className="notification__actions">
					<button
						type="button"
						className="notification__action"
						onClick={open}
						data-cy="live-chat-message-open"
					>
						{t('notification.liveChatMessage.open')}
					</button>
				</div>
			)}
		</div>
	);
};
