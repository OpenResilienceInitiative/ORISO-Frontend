import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useSyncExternalStore
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
	NotificationsContext,
	NotificationType
} from '../../globalState/provider/NotificationsProvider';
import {
	getShownChannel,
	isNotificationActiveViewRoute,
	pathSegments,
	subscribeShownChannel
} from '../session/notificationActiveView';
import { STAGE_LAYOUT } from '../chatStage/stageLayout';
import {
	normalizeLegacyChannelSearch,
	parseChannel
} from '../../utils/channelRoute';
import { ReactComponent as MentionIcon } from '../../resources/img/icons/modality-chat.svg';
import { ReactComponent as HandoverIcon } from '../../resources/img/icons/case_handover_200_24px.svg';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/close.svg';
import './notification.styles';

/**
 * In-app pop-up for events that need a person's attention (FE#779), built like
 * the live-chat pop-up (FE#1470). One card per conversation and kind, and per
 * thread for a mention in one: it counts up instead of stacking. It names the
 * actor where there is a public one, never message text, reasons or staff-only
 * details.
 *
 *  - mention:  a team-discussion post that mentions the counsellor
 *  - chatMention: a message in an ordinary chat that mentions the counsellor
 *  - handover: a case offered to the counsellor
 *  - consent:  a handover that waits for the advice seeker's yes (OPT_IN)
 */
export const NOTIFICATION_TYPE_EVENT_NOTICE = 'eventNotice';
export type NotificationTypeEventNotice = typeof NOTIFICATION_TYPE_EVENT_NOTICE;

export type EventNoticeKind =
	| 'mention'
	| 'chatMention'
	| 'handover'
	| 'consent';

const MENTION_NOTICE_EVENT = 'team.discussion.new';
/** ORISO-UserService#1510: the server marks a mention on these rows too. */
const CHAT_MENTION_NOTICE_EVENTS = ['message.new', 'thread.reply.new'];
const HANDOVER_NOTICE_EVENT = 'case.handover.offer.received';
const CONSENT_NOTICE_EVENT = 'case.handover.consent.requested';

export interface EventNoticeProps extends NotificationType {
	id: string;
	notificationType: NotificationTypeEventNotice;
	kind: EventNoticeKind;
	sessionId: string;
	/** Room to notice the target being opened by another route. */
	roomRef?: string | null;
	/** The thread a chat mention was made in; null for the main chat. */
	threadRootId?: string | null;
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

export const eventNoticeId = (
	kind: EventNoticeKind,
	sessionId: string,
	threadRootId?: string | null
) =>
	`event-notice:${kind}:${sessionId}${threadRootId ? `:thread:${threadRootId}` : ''}`;

/** The feed fields the pop-up decision reads. */
export interface EventNoticeFeedEvent {
	eventType: string;
	sourceSessionId?: string;
	actionPath?: string;
	params?: {
		recipientRole?: string | null;
		roomRef?: string | null;
		threadRootId?: string | null;
		senderName?: string | null;
		senderDisplayName?: string | null;
		initiatorName?: string | null;
		mentioned?: boolean | null;
		clientConsent?: string | null;
	};
}

// The producers of these events set no recipientRole; the link says whose
// row it is. An explicit role must agree with it.
const isCounsellorRow = (event: EventNoticeFeedEvent) => {
	const role = event.params?.recipientRole;
	return role
		? role === 'consultant'
		: !!event.actionPath?.startsWith('/sessions/consultant/');
};
const isAskerRow = (event: EventNoticeFeedEvent) => {
	const role = event.params?.recipientRole;
	return role
		? role === 'user' || role === 'asker'
		: !!event.actionPath?.startsWith('/sessions/user/');
};

/**
 * Which pop-up a feed event earns, if any. An ordinary message earns one only
 * when it mentions the counsellor, and the consent request only where it waits
 * for the advice seeker's own yes.
 */
export const eventNoticeKindFor = (
	event: EventNoticeFeedEvent
): EventNoticeKind | null => {
	if (!event.sourceSessionId) return null;
	if (
		event.eventType === MENTION_NOTICE_EVENT &&
		event.params?.mentioned === true &&
		isCounsellorRow(event)
	)
		return 'mention';
	if (
		CHAT_MENTION_NOTICE_EVENTS.includes(event.eventType) &&
		event.params?.mentioned === true &&
		isCounsellorRow(event)
	)
		return 'chatMention';
	if (event.eventType === HANDOVER_NOTICE_EVENT && isCounsellorRow(event))
		return 'handover';
	if (
		event.eventType === CONSENT_NOTICE_EVENT &&
		event.params?.clientConsent === 'OPT_IN' &&
		isAskerRow(event)
	)
		return 'consent';
	return null;
};

/** The public actor label; the consent card names no one (staff-only). */
export const eventNoticeActor = (
	kind: EventNoticeKind,
	event: EventNoticeFeedEvent
): string | null => {
	if (kind === 'consent') return null;
	const params = event.params;
	const name =
		kind === 'handover'
			? params?.initiatorName
			: params?.senderDisplayName || params?.senderName;
	return name || null;
};

interface NoticeTarget {
	sessionId?: string | null;
	roomRef?: string | null;
	threadRootId?: string | null;
}

/** Whether this conversation's detail view is the route and the tab visible. */
export const isConversationOpen = (
	target: NoticeTarget,
	pathname: string,
	search: string,
	visible: boolean
): boolean => {
	// Profile and settings subroutes replace the conversation on screen.
	if (!visible || !isNotificationActiveViewRoute(pathname, search))
		return false;
	const segments = pathSegments(pathname);
	const last = segments[segments.length - 1];
	return (
		(!!target.sessionId && last === String(target.sessionId)) ||
		(!!target.roomRef && segments.includes(target.roomRef))
	);
};

/**
 * Whether the enquiry's team discussion is on screen: the enquiry view with
 * the team channel (`?channel=team`, or the legacy `?teamDiscussion=1` the
 * notification links carry). The enquiry's main chat does not show the
 * discussion.
 */
export const isTeamDiscussionOpen = (
	target: NoticeTarget,
	pathname: string,
	search: string,
	visible: boolean
): boolean => {
	if (!visible) return false;
	const query = new URLSearchParams(search);
	if (query.get('channel') !== 'team' && query.get('teamDiscussion') !== '1')
		return false;
	// The bare query link renders the empty list view, not the discussion.
	return isConversationOpen(target, pathname, search, visible);
};

/**
 * On a phone a side channel fills the screen instead of the main chat. The
 * requested one counts too: the chat card has not reported yet while it loads.
 */
const isMainChatHidden = (search: string) =>
	window.innerWidth < STAGE_LAYOUT.DESKTOP_MIN_WIDTH &&
	(!!getShownChannel() ||
		!!parseChannel(normalizeLegacyChannelSearch(search) ?? search).channel);

/**
 * Whether this thread's panel is on screen. The parent chat does not show the
 * thread's replies.
 */
const isThreadOpen = (
	target: NoticeTarget,
	pathname: string,
	search: string,
	visible: boolean
): boolean => {
	const channel = getShownChannel();
	return (
		channel?.kind === 'thread' &&
		channel.rootId === target.threadRootId &&
		isConversationOpen(target, pathname, search, visible)
	);
};

/** Whether the counsellor/advice seeker is looking at this event's target. */
export const isEventNoticeTargetOpen = (
	kind: EventNoticeKind,
	target: NoticeTarget,
	pathname: string,
	search: string,
	visible: boolean
) => {
	if (kind === 'mention')
		return isTeamDiscussionOpen(target, pathname, search, visible);
	if (kind === 'chatMention') {
		if (target.threadRootId)
			return isThreadOpen(target, pathname, search, visible);
		if (isMainChatHidden(search)) return false;
	}
	return isConversationOpen(target, pathname, search, visible);
};

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
	const { pathname, search } = useLocation();
	const shownChannel = useSyncExternalStore(
		subscribeShownChannel,
		getShownChannel
	);
	useEffect(() => {
		const settleIfSeen = () => {
			if (
				isEventNoticeTargetOpen(
					kind,
					{
						sessionId: props.sessionId,
						roomRef: props.roomRef,
						threadRootId: props.threadRootId
					},
					pathname,
					search,
					document.visibilityState !== 'hidden'
				)
			)
				close();
		};
		settleIfSeen();
		document.addEventListener('visibilitychange', settleIfSeen);
		// Growing past the phone layout brings the main chat back on screen.
		window.addEventListener('resize', settleIfSeen);
		return () => {
			document.removeEventListener('visibilitychange', settleIfSeen);
			window.removeEventListener('resize', settleIfSeen);
		};
	}, [
		close,
		kind,
		pathname,
		props.roomRef,
		props.sessionId,
		props.threadRootId,
		search,
		shownChannel
	]);

	const Icon =
		kind === 'mention' || kind === 'chatMention'
			? MentionIcon
			: HandoverIcon;
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
				{kind === 'consent' && props.count === 1 && (
					<div data-cy="consent-notice-text">
						{t('notification.eventNotice.consent.text')}
					</div>
				)}
				{kind !== 'consent' && props.actorName && (
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
