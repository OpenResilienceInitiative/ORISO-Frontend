import * as React from 'react';
import { useCallback, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
	NotificationsContext,
	NotificationType
} from '../../globalState/provider/NotificationsProvider';
import { ReactComponent as MentionIcon } from '../../resources/img/icons/modality-chat.svg';
import { ReactComponent as HandoverIcon } from '../../resources/img/icons/case_handover_200_24px.svg';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/close.svg';
import { isLiveChatOpen, LiveChatFeedEvent } from './LiveChatMessageNotice';
import './notification.styles';

/**
 * In-app pop-up for a mention or a case handover addressed to a counsellor
 * (FE#779), built like the live-chat pop-up (FE#1470). One card per
 * conversation and kind: it counts up instead of stacking and shows the
 * actor's name, never message text.
 */
export const NOTIFICATION_TYPE_EVENT_NOTICE = 'eventNotice';
export type NotificationTypeEventNotice = typeof NOTIFICATION_TYPE_EVENT_NOTICE;

export type EventNoticeKind = 'mention' | 'handover';

/** Handover events that tell a counsellor a case is coming to them. */
const HANDOVER_NOTICE_EVENTS: ReadonlyArray<string> = [
	'handover.requested',
	'case.handover.offer.received',
	'case.handover.granted'
];

export interface EventNoticeProps extends NotificationType {
	id: string;
	notificationType: NotificationTypeEventNotice;
	kind: EventNoticeKind;
	sessionId: string;
	/** Matrix room of the conversation, to notice it being opened elsewhere. */
	roomRef?: string | null;
	/** Who mentioned or handed over (metadata only, never content). */
	actorName?: string | null;
	/** Events of this kind in this conversation since the card appeared. */
	count: number;
	/** Where "Open" leads; null when the feed row names no target. */
	path: string | null;
}

export const isNotificationTypeEventNotice = (
	notification: NotificationType
): notification is EventNoticeProps =>
	notification.notificationType === NOTIFICATION_TYPE_EVENT_NOTICE;

export const eventNoticeId = (kind: EventNoticeKind, sessionId: string) =>
	`event-notice:${kind}:${sessionId}`;

/** The feed fields the pop-up decision reads. */
export interface EventNoticeFeedEvent extends LiveChatFeedEvent {
	params?: LiveChatFeedEvent['params'] & {
		initiatorName?: string | null;
	};
}

const isCounsellorRow = (event: EventNoticeFeedEvent) =>
	event.params?.recipientRole === 'consultant' ||
	(!event.params?.recipientRole &&
		!!event.actionPath?.startsWith('/sessions/consultant/'));

/**
 * Which pop-up a feed event earns, if any. Ordinary messages earn none, and a
 * live-chat mention stays on the live-chat card.
 */
export const eventNoticeKindFor = (
	event: EventNoticeFeedEvent
): EventNoticeKind | null => {
	if (!event.sourceSessionId || !isCounsellorRow(event)) return null;
	if (HANDOVER_NOTICE_EVENTS.includes(event.eventType)) return 'handover';
	if (
		event.params?.mentioned === true &&
		event.params?.conversationType !== 'LIVE_CHAT'
	)
		return 'mention';
	return null;
};

export const eventNoticeActor = (
	kind: EventNoticeKind,
	event: EventNoticeFeedEvent
): string | null =>
	(kind === 'handover'
		? (event.params?.initiatorName ?? event.params?.senderName)
		: event.params?.senderName) ?? null;

/** Whether the counsellor is looking at this conversation right now. */
export const isEventNoticeTargetOpen = (
	event: EventNoticeFeedEvent,
	pathname: string,
	visible: boolean
) => isLiveChatOpen(event, pathname, visible);

/** Adds the card, or counts one more event on the card already shown. */
export const upsertEventNotice = <T extends NotificationType>(
	notifications: T[],
	notice: EventNoticeProps
): (T | EventNoticeProps)[] => {
	const index = notifications.findIndex(
		(item) =>
			item.id === notice.id &&
			item.notificationType === NOTIFICATION_TYPE_EVENT_NOTICE
	);
	if (index === -1) return [...notifications, notice];
	const shown = notifications[index] as unknown as EventNoticeProps;
	const next: (T | EventNoticeProps)[] = [...notifications];
	next[index] = {
		...shown,
		actorName: notice.actorName ?? shown.actorName,
		path: notice.path ?? shown.path,
		count: shown.count + notice.count
	};
	return next;
};

export const EventNotice = (props: EventNoticeProps) => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { removeNotification } = useContext(NotificationsContext);
	const { kind } = props;
	const close = useCallback(
		() => removeNotification(props.id, NOTIFICATION_TYPE_EVENT_NOTICE),
		[props.id, removeNotification]
	);
	const open = useCallback(() => {
		close();
		if (props.path) navigate(props.path);
	}, [close, navigate, props.path]);
	// Opening the conversation any other way also settles the card, but only
	// once it is really seen: a hidden tab keeps the card until it returns.
	const { pathname } = useLocation();
	useEffect(() => {
		const settleIfSeen = () => {
			if (
				isEventNoticeTargetOpen(
					{
						eventType: 'message.new',
						sourceSessionId: props.sessionId,
						params: { roomRef: props.roomRef }
					},
					pathname,
					document.visibilityState !== 'hidden'
				)
			)
				close();
		};
		settleIfSeen();
		document.addEventListener('visibilitychange', settleIfSeen);
		return () =>
			document.removeEventListener('visibilitychange', settleIfSeen);
	}, [close, pathname, props.roomRef, props.sessionId]);

	const Icon = kind === 'handover' ? HandoverIcon : MentionIcon;
	return (
		<div
			className={`notification notification--info notification--eventNotice notification--${kind}`}
			role="status"
			data-cy={`${kind}-notice`}
		>
			<div className="notification__header">
				<div className="notification__icon">
					<Icon aria-hidden="true" focusable="false" />
				</div>
				<div className="notification__title">
					{t(`notification.eventNotice.${kind}.title`)}
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
				{props.actorName && (
					<div className="notification__sender">
						{t(`notification.eventNotice.${kind}.from`, {
							name: props.actorName
						})}
					</div>
				)}
				{props.count > 1 && (
					<div data-cy={`${kind}-notice-count`}>
						{t(`notification.eventNotice.${kind}.several`, {
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
						data-cy={`${kind}-notice-open`}
					>
						{t(`notification.eventNotice.${kind}.open`)}
					</button>
				</div>
			)}
		</div>
	);
};
