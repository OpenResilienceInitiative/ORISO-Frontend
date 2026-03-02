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
import {
	apiClearEventNotifications,
	apiGetEventNotifications,
	apiMarkAllEventNotificationsRead,
	apiMarkEventNotificationRead
} from '../../api/apiEventNotifications';
import { getValueFromCookie } from '../../components/sessionCookie/accessSessionCookie';

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
	actionPath?: string;
	actionLabel?: string;
	sourceSessionId?: string | number;
	category?: 'system' | 'message';
};

export type NotificationFeedItem = {
	id: string;
	type: NotificationTypes;
	title: string;
	text: string;
	eventType: string;
	createdAt: string;
	readAt?: string | null;
	actionPath?: string;
	actionLabel?: string;
	sourceSessionId?: string;
	category: 'system' | 'message';
};

export type EventNotificationInput = {
	type?: NotificationTypes;
	title: string;
	text: string;
	eventType: string;
	category?: 'system' | 'message';
	actionPath?: string;
	actionLabel?: string;
	sourceSessionId?: string | number;
};

const NOTIFICATION_FEED_MAX_ITEMS = 50;

type NotificationsContextProps = {
	notifications: NotificationType[];
	notificationFeed: NotificationFeedItem[];
	unreadNotificationCount: number;
	setNotifications: Function;
	hasNotification: Function;
	addNotification: Dispatch<NotificationDefaultType | IncomingVideoCallProps>;
	addEventNotification: (event: EventNotificationInput) => void;
	refreshNotificationFeed: () => void;
	removeNotification: Function;
	markNotificationAsRead: (id: string) => void;
	markAllNotificationsAsRead: () => void;
	clearNotificationFeed: () => void;
};

export const NotificationsContext =
	createContext<NotificationsContextProps | null>(null);

export function NotificationsProvider(props) {
	const [notifications, setNotifications] = useState([]);
	const [notificationFeed, setNotificationFeed] = useState<
		NotificationFeedItem[]
	>([]);
	const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

	const refreshNotificationFeed = useCallback(async () => {
		const accessToken = getValueFromCookie('keycloak');
		if (!accessToken) {
			// Do not hit protected endpoint before auth is available.
			setNotificationFeed([]);
			setUnreadNotificationCount(0);
			return;
		}

		try {
			const response = await apiGetEventNotifications(0, NOTIFICATION_FEED_MAX_ITEMS);
			const normalized: NotificationFeedItem[] = (response?.items || []).map(
				(item) => ({
					id: String(item.id),
					type: item.category === 'message' ? NOTIFICATION_TYPE_INFO : NOTIFICATION_TYPE_INFO,
					title: item.title || 'Notification',
					text: item.text || '',
					eventType: item.eventType || 'event',
					createdAt: item.createdAt || new Date().toISOString(),
					readAt: item.readAt ?? null,
					actionPath: item.actionPath,
					actionLabel: item.actionLabel,
					sourceSessionId:
						item.sourceSessionId != null ? String(item.sourceSessionId) : undefined,
					category: item.category === 'message' ? 'message' : 'system'
				})
			);
			setNotificationFeed(normalized);
			setUnreadNotificationCount(Number(response?.unreadCount || 0));
		} catch (error) {
			// Keep existing state but log failures to simplify diagnostics.
			// eslint-disable-next-line no-console
			console.warn('Failed to refresh notification feed', error);
		}
	}, []);

	const refreshNotificationFeedSafe = useCallback(() => {
		void refreshNotificationFeed();
	}, [refreshNotificationFeed]);

	useEffect(() => {
		refreshNotificationFeedSafe();
		const interval = window.setInterval(refreshNotificationFeedSafe, 15000);
		return () => window.clearInterval(interval);
	}, [refreshNotificationFeedSafe]);

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
			const titleRaw =
				'title' in newNotification ? newNotification.title : undefined;
			const textRaw =
				'text' in newNotification ? newNotification.text : undefined;
			const title = typeof titleRaw === 'string' ? titleRaw : undefined;
			const text = typeof textRaw === 'string' ? textRaw : undefined;
			if (!isCallNotification && (title || text)) {
				const feedItem: NotificationFeedItem = {
					id: String(newNotification.id),
					type: newNotification.notificationType,
					title: title ?? 'Benachrichtigung',
					text: text ?? '',
					createdAt: new Date().toISOString()
				};
				setNotificationFeed((existing) =>
					[feedItem, ...existing].slice(0, NOTIFICATION_FEED_MAX_ITEMS)
				);
			}
		},
		[hasNotification, notifications]
	);

	const addEventNotification = useCallback((event: EventNotificationInput) => {
		// Fallback for local-only events until every producer is fully backend-backed.
		const feedItem: NotificationFeedItem = {
			id: `local-${uuid()}`,
			type: event.type || NOTIFICATION_TYPE_INFO,
			title: event.title,
			text: event.text,
			eventType: event.eventType,
			createdAt: new Date().toISOString(),
			readAt: null,
			actionPath: event.actionPath,
			actionLabel: event.actionLabel,
			sourceSessionId:
				event.sourceSessionId != null
					? String(event.sourceSessionId)
					: undefined,
			category: event.category === 'message' ? 'message' : 'system'
		};
		setNotificationFeed((existing) =>
			[feedItem, ...existing].slice(0, NOTIFICATION_FEED_MAX_ITEMS)
		);
		setUnreadNotificationCount((value) => value + 1);
	}, []);

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

	const markNotificationAsRead = useCallback((id: string) => {
		const accessToken = getValueFromCookie('keycloak');
		if (!accessToken) {
			return;
		}
		if (!id.startsWith('local-')) {
			apiMarkEventNotificationRead(id).catch(() => undefined);
		}
		setNotificationFeed((existing) =>
			existing.map((item) =>
				item.id === id && !item.readAt
					? { ...item, readAt: new Date().toISOString() }
					: item
			)
		);
		setUnreadNotificationCount((value) => Math.max(0, value - 1));
	}, []);

	const markAllNotificationsAsRead = useCallback(() => {
		const accessToken = getValueFromCookie('keycloak');
		if (!accessToken) {
			return;
		}
		apiMarkAllEventNotificationsRead().catch(() => undefined);
		const now = new Date().toISOString();
		setNotificationFeed((existing) =>
			existing.map((item) => (item.readAt ? item : { ...item, readAt: now }))
		);
		setUnreadNotificationCount(0);
	}, []);

	const clearNotificationFeed = useCallback(() => {
		const accessToken = getValueFromCookie('keycloak');
		if (!accessToken) {
			setNotificationFeed([]);
			setUnreadNotificationCount(0);
			return;
		}
		apiClearEventNotifications().catch(() => undefined);
		setNotificationFeed([]);
		setUnreadNotificationCount(0);
	}, []);

	return (
		<NotificationsContext.Provider
			value={{
				notifications,
				notificationFeed,
				unreadNotificationCount,
				setNotifications,
				hasNotification,
				addNotification,
				addEventNotification,
				refreshNotificationFeed: refreshNotificationFeedSafe,
				removeNotification,
				markNotificationAsRead,
				markAllNotificationsAsRead,
				clearNotificationFeed
			}}
		>
			{props.children}
		</NotificationsContext.Provider>
	);
}
