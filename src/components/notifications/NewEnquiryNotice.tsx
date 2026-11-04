import * as React from 'react';
import { useCallback, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
	NotificationsContext,
	NotificationType
} from '../../globalState/provider/NotificationsProvider';
import { ReactComponent as EnquiryIcon } from '../../resources/img/icons/navigation/counsellor_request_400.svg';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/close.svg';
import './notification.styles';

/**
 * In-app pop-up for a new enquiry to a counsellor (FE#1435), built like the
 * live-chat pop-up (FE#1470). One card for all new enquiries: it counts up
 * instead of stacking, and goes away once the counsellor opens Anfragen.
 */
export const NOTIFICATION_TYPE_NEW_ENQUIRY = 'newEnquiry';
export type NotificationTypeNewEnquiry = typeof NOTIFICATION_TYPE_NEW_ENQUIRY;
export const NEW_ENQUIRY_NOTICE_ID = 'new-enquiry';
export const ENQUIRY_LIST_PATH = '/sessions/consultant/sessionPreview';

/** Feed events that mean "a new enquiry is waiting to be taken". */
const NEW_ENQUIRY_EVENTS: ReadonlyArray<string> = [
	'request.new',
	'waiting_room.client.joined'
];

export interface NewEnquiryNoticeProps extends NotificationType {
	id: string;
	notificationType: NotificationTypeNewEnquiry;
	/** New enquiries since the pop-up appeared. */
	count: number;
	/** That enquiry while there is one, the Anfragen list from the second. */
	path: string;
}

export const isNotificationTypeNewEnquiry = (
	notification: NotificationType
): notification is NewEnquiryNoticeProps =>
	notification.notificationType === NOTIFICATION_TYPE_NEW_ENQUIRY;

/** The feed fields the pop-up decision reads. */
export interface NewEnquiryFeedEvent {
	eventType: string;
	sourceSessionId?: string;
	actionPath?: string;
}

/** True for a new enquiry addressed to a counsellor (its link is theirs). */
export const isNewEnquiryForCounsellor = (event: NewEnquiryFeedEvent) =>
	NEW_ENQUIRY_EVENTS.includes(event.eventType) &&
	!!event.actionPath?.startsWith(ENQUIRY_LIST_PATH);

/** Whether Anfragen (list or an enquiry in it) is on screen right now. */
export const isEnquiryListOpen = (pathname: string, visible: boolean) =>
	visible &&
	(pathname === ENQUIRY_LIST_PATH ||
		pathname.startsWith(`${ENQUIRY_LIST_PATH}/`));

/** Adds the card, or counts one more enquiry on the card already shown. */
export const upsertNewEnquiryNotice = <T extends NotificationType>(
	notifications: T[],
	notice: NewEnquiryNoticeProps
): (T | NewEnquiryNoticeProps)[] => {
	const index = notifications.findIndex(
		(item) =>
			item.id === notice.id &&
			item.notificationType === NOTIFICATION_TYPE_NEW_ENQUIRY
	);
	if (index === -1) return [...notifications, notice];
	const shown = notifications[index] as unknown as NewEnquiryNoticeProps;
	const next: (T | NewEnquiryNoticeProps)[] = [...notifications];
	next[index] = {
		...shown,
		count: shown.count + notice.count,
		path: ENQUIRY_LIST_PATH
	};
	return next;
};

export const NewEnquiryNotice = (props: NewEnquiryNoticeProps) => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { removeNotification } = useContext(NotificationsContext);
	const close = useCallback(
		() => removeNotification(props.id, NOTIFICATION_TYPE_NEW_ENQUIRY),
		[props.id, removeNotification]
	);
	const several = props.count > 1;
	const open = useCallback(() => {
		close();
		navigate(several ? ENQUIRY_LIST_PATH : props.path);
	}, [close, navigate, props.path, several]);
	// Opening Anfragen any other way (nav, feed) also settles the pop-up, but
	// only once it is really seen: a hidden tab keeps the card until it returns.
	const { pathname } = useLocation();
	useEffect(() => {
		const settleIfSeen = () => {
			if (
				isEnquiryListOpen(
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
	}, [close, pathname]);

	return (
		<div
			className="notification notification--info notification--newEnquiry"
			role="status"
			data-cy="new-enquiry-notice"
		>
			<div className="notification__header">
				<div className="notification__icon">
					<EnquiryIcon aria-hidden="true" focusable="false" />
				</div>
				<div className="notification__title">
					{t('notification.newEnquiry.title')}
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
				{several ? (
					<div data-cy="new-enquiry-count">
						{t('notification.newEnquiry.several', {
							count: props.count
						})}
					</div>
				) : (
					<div>{t('notification.newEnquiry.waiting')}</div>
				)}
			</div>
			<div className="notification__actions">
				<button
					type="button"
					className="notification__action"
					onClick={open}
					data-cy="new-enquiry-open"
				>
					{t(
						several
							? 'notification.newEnquiry.openList'
							: 'notification.newEnquiry.openOne'
					)}
				</button>
			</div>
		</div>
	);
};
