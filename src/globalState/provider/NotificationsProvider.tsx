import * as React from 'react';
import {
	createContext,
	Dispatch,
	ReactNode,
	useEffect,
	useCallback,
	useState
} from 'react';
import { v4 as uuid } from 'uuid';
import {
	IncomingVideoCallProps,
	NOTIFICATION_TYPE_CALL,
	NotificationTypeCall
} from '../../components/incomingVideoCall/IncomingVideoCall';

export const NOTIFICATION_DEFAULT_TIMEOUT = 3000;

export const NOTIFICATION_TYPE_NONE = 'none';
export type NotificationTypeNone = typeof NOTIFICATION_TYPE_NONE;

export const NOTIFICATION_TYPE_INFO = 'info';
export type NotificationTypeInfo = typeof NOTIFICATION_TYPE_INFO;

export const NOTIFICATION_TYPE_WARNING = 'warning';
export type NotificationTypeWarning = typeof NOTIFICATION_TYPE_WARNING;

export const NOTIFICATION_TYPE_ERROR = 'error';
export type NotificationTypeError = typeof NOTIFICATION_TYPE_ERROR;

export const NOTIFICATION_TYPE_SUCCESS = 'success';
export type NotificationTypeSuccess = typeof NOTIFICATION_TYPE_SUCCESS;

export type NotificationTypes =
	| NotificationTypeCall
	| NotificationTypeError
	| NotificationTypeInfo
	| NotificationTypeWarning
	| NotificationTypeSuccess
	| NotificationTypeNone;

export type NotificationType = {
	id?: string | number;
	notificationType: NotificationTypes;
	timeout?: number;
	title?: string;
};

export type NotificationDefaultType = NotificationType & {
	notificationType:
		| NotificationTypeInfo
		| NotificationTypeError
		| NotificationTypeSuccess
		| NotificationTypeWarning
		| NotificationTypeNone;
	title: ReactNode;
	text: ReactNode;
	closeable?: boolean;
	onClose?: (notification: NotificationDefaultType) => void;
};

export type NotificationFeedItem = {
	id: string;
	type: NotificationTypes;
	title: string;
	text: string;
	createdAt: string;
};

const NOTIFICATION_FEED_STORAGE_KEY = 'oriso.notificationFeed';
const NOTIFICATION_FEED_MAX_ITEMS = 50;

type NotificationsContextProps = {
	notifications: NotificationType[];
	notificationFeed: NotificationFeedItem[];
	setNotifications: Function;
	hasNotification: Function;
	addNotification: Dispatch<NotificationDefaultType | IncomingVideoCallProps>;
	removeNotification: Function;
};

export const NotificationsContext =
	createContext<NotificationsContextProps | null>(null);

export function NotificationsProvider(props) {
	const [notifications, setNotifications] = useState([]);
	const [notificationFeed, setNotificationFeed] = useState<
		NotificationFeedItem[]
	>([]);

	useEffect(() => {
		try {
			const raw = localStorage.getItem(NOTIFICATION_FEED_STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				setNotificationFeed(parsed.slice(0, NOTIFICATION_FEED_MAX_ITEMS));
			}
		} catch (error) {
			// ignore invalid persisted data
		}
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem(
				NOTIFICATION_FEED_STORAGE_KEY,
				JSON.stringify(notificationFeed)
			);
		} catch (error) {
			// ignore storage errors
		}
	}, [notificationFeed]);

	const hasNotification = useCallback(
		(id: string | number, type: NotificationTypes): boolean =>
			notifications.some(
				(notification) =>
					notification.id === id &&
					notification.notificationType === type
			),
		[notifications]
	);

	const addNotification = useCallback(
		(notification: NotificationType) => {
			if (
				notification.id &&
				hasNotification(notification.id, notification.notificationType)
			) {
				return;
			}

			let newNotification = { ...notification };
			if (!notification.id) {
				newNotification.id = uuid();
				if (!notification.timeout) {
					newNotification.timeout = NOTIFICATION_DEFAULT_TIMEOUT;
				}
			}

			setNotifications([...notifications, newNotification]);

			const isCallNotification =
				newNotification.notificationType === NOTIFICATION_TYPE_CALL;
			const hasFeedContent =
				'title' in newNotification || 'text' in newNotification;
			if (!isCallNotification && hasFeedContent) {
				const titleRaw =
					'title' in newNotification ? newNotification.title : undefined;
				const textRaw =
					'text' in newNotification ? newNotification.text : undefined;
				const title =
					typeof titleRaw === 'string'
						? titleRaw
						: String(titleRaw ?? 'Benachrichtigung');
				const text =
					typeof textRaw === 'string' ? textRaw : String(textRaw ?? '');
				const feedItem: NotificationFeedItem = {
					id: String(newNotification.id),
					type: newNotification.notificationType,
					title,
					text,
					createdAt: new Date().toISOString()
				};
				setNotificationFeed((existing) =>
					[feedItem, ...existing].slice(0, NOTIFICATION_FEED_MAX_ITEMS)
				);
			}
		},
		[hasNotification, notifications]
	);

	const removeNotification = useCallback(
		(id: string | number, type: NotificationTypes) => {
			if (!hasNotification(id, type)) {
				return;
			}

			setNotifications(
				[...notifications].filter(
					(notification) =>
						!(
							notification.id === id &&
							notification.notificationType === type
						)
				)
			);
		},
		[hasNotification, notifications]
	);

	return (
		<NotificationsContext.Provider
			value={{
				notifications,
				notificationFeed,
				setNotifications,
				hasNotification,
				addNotification,
				removeNotification
			}}
		>
			{props.children}
		</NotificationsContext.Provider>
	);
}
