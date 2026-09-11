import * as React from 'react';
import {
	createContext,
	Dispatch,
	ReactNode,
	useEffect,
	useCallback,
	useRef,
	useState
} from 'react';
import { v4 as uuid } from 'uuid';
import {
	IncomingVideoCallProps,
	NotificationTypeCall
} from '../../components/incomingVideoCall/IncomingVideoCall';
import {
	apiClearEventNotifications,
	apiGetEventNotifications,
	apiMarkAllEventNotificationsRead,
	apiMarkEventNotificationRead,
	type EventNotificationFeedItem
} from '../../api/apiEventNotifications';
import { getValueFromCookie } from '../../components/sessionCookie/accessSessionCookie';
import { EventActionParams } from '../../components/notificationsCenter/eventDescriptors';
import { parseEventActionParams } from '../../components/notificationsCenter/notificationActionTarget';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import {
	installAudioUnlock,
	playNotificationSound,
	selectEventToAnnounce
} from '../../utils/notificationSettings/soundPlayback';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';
import { getEventDescriptor } from '../../components/notificationsCenter/eventDescriptors';

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
	params?: EventActionParams;
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
	params?: EventActionParams;
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
	loadOlderNotifications: () => Promise<void>;
	hasOlderNotifications: boolean;
	isLoadingOlderNotifications: boolean;
	olderNotificationsError: boolean;
	removeNotification: Function;
	markNotificationAsRead: (id: string) => void;
	markAllNotificationsAsRead: () => void;
	clearNotificationFeed: () => void;
};

export const NotificationsContext =
	createContext<NotificationsContextProps | null>(null);

const normalizeEventNotification = (
	item: EventNotificationFeedItem
): NotificationFeedItem => ({
	id: String(item.id),
	type: NOTIFICATION_TYPE_INFO,
	// Left empty rather than defaulted to an English literal: the presentation
	// layer already resolves a localized title from the event type, and
	// 'Notification' rendered untranslated inside the German UI.
	title: item.title || '',
	text: item.text || '',
	eventType: item.eventType || 'event',
	createdAt: item.createdAt || new Date().toISOString(),
	readAt: item.readAt ?? null,
	actionPath: item.actionPath,
	actionLabel: item.actionLabel,
	sourceSessionId:
		item.sourceSessionId != null ? String(item.sourceSessionId) : undefined,
	params: parseEventActionParams(item.params),
	category: item.category === 'message' ? 'message' : 'system'
});

const sortNewestFirst = (items: NotificationFeedItem[]) =>
	items.sort((left, right) => {
		const timeOrder =
			new Date(right.createdAt).getTime() -
			new Date(left.createdAt).getTime();
		return timeOrder || left.id.localeCompare(right.id);
	});

/** Client-side rows (incoming calls, toasts) the server never knows about. */
const isLocalItem = (item: NotificationFeedItem) =>
	item.id.startsWith('local-');

/**
 * Cap on client-side rows only.
 *
 * The feed itself is deliberately uncapped now that older pages load on demand
 * (#930), but `local-*` rows are never reconciled away by a page-0 response, so
 * without a bound they accumulate for as long as the tab lives.
 */
const MAX_LOCAL_FEED_ITEMS = NOTIFICATION_FEED_MAX_ITEMS;

const capLocalItems = (
	items: NotificationFeedItem[]
): NotificationFeedItem[] => {
	const local = items.filter(isLocalItem);
	if (local.length <= MAX_LOCAL_FEED_ITEMS) {
		return items;
	}
	// `items` is already newest-first, so the tail is the oldest local rows.
	const dropped = new Set(
		local.slice(MAX_LOCAL_FEED_ITEMS).map((item) => item.id)
	);
	return items.filter((item) => !dropped.has(item.id));
};

/**
 * Merge a freshly fetched page into the feed, newest first, with ids as the
 * deterministic tie-break and dedupe key.
 *
 * `windowStart` marks the oldest item of the incoming page. Existing backend
 * rows at or above that point but missing from the response were deleted or
 * cleared on the server and must disappear — a plain union kept them on screen
 * until a reload. Rows below the window belong to older pages the response
 * never covered, and local rows are not the server's to remove.
 */
const mergeNotificationFeed = (
	incoming: NotificationFeedItem[],
	existing: NotificationFeedItem[],
	options: { reconcileWindow?: boolean; olderPagesLoaded?: boolean } = {}
): NotificationFeedItem[] => {
	const incomingIds = new Set(incoming.map((item) => item.id));
	// An empty page describes no window, so it can only be read as "nothing
	// left" while page 0 is the whole feed. With older pages loaded it would
	// otherwise delete rows this response never covered, and one transient
	// empty answer would blank everything.
	const reconcile =
		options.reconcileWindow &&
		(incoming.length > 0 || !options.olderPagesLoaded);
	const windowStart = incoming.length
		? Math.min(
				...incoming.map((item) => new Date(item.createdAt).getTime())
			)
		: Number.NEGATIVE_INFINITY;

	const retained = reconcile
		? existing.filter((item) => {
				if (incomingIds.has(item.id) || isLocalItem(item)) {
					return true;
				}
				return new Date(item.createdAt).getTime() < windowStart;
			})
		: existing;

	const byId = new Map(retained.map((item) => [item.id, item]));
	incoming.forEach((item) => byId.set(item.id, item));
	return capLocalItems(sortNewestFirst(Array.from(byId.values())));
};

export function NotificationsProvider(props) {
	const [notifications, setNotifications] = useState([]);
	const [notificationFeed, setNotificationFeed] = useState<
		NotificationFeedItem[]
	>([]);
	const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
	const [hasOlderNotifications, setHasOlderNotifications] = useState(false);
	const [isLoadingOlderNotifications, setIsLoadingOlderNotifications] =
		useState(false);
	const [olderNotificationsError, setOlderNotificationsError] =
		useState(false);
	const highestLoadedPageRef = useRef(0);
	const loadingOlderRef = useRef(false);
	const feedEpochRef = useRef(0);
	// #576: id of the newest event slot we already reconciled, so a feed refresh
	// only announces a genuinely newer event (not every poll, and never on the
	// backlog surfaced when an event above it is read).
	const lastAnnouncedEventIdRef = useRef<string | null>(null);
	const resetFeedState = useCallback(() => {
		loadingOlderRef.current = false;
		setNotificationFeed([]);
		setUnreadNotificationCount(0);
		setHasOlderNotifications(false);
		setIsLoadingOlderNotifications(false);
		setOlderNotificationsError(false);
		highestLoadedPageRef.current = 0;
	}, []);

	// #576: play the configured sound for a genuinely new, unread top event —
	// decoupled from the OS popup, so it also sounds with the tab focused. The
	// sound routes through the single suppression gate (DND, per-conversation
	// level, mute, family-off) inside playNotificationSound.
	const maybePlaySoundForNewEvent = useCallback(
		(feed: NotificationFeedItem[]) => {
			const { announce, nextMarker } = selectEventToAnnounce(
				feed,
				lastAnnouncedEventIdRef.current
			);
			lastAnnouncedEventIdRef.current = nextMarker;
			if (!announce) {
				return;
			}
			const { settings, device } = notificationSettingsStore.getState();
			const family = getEventDescriptor(announce.eventType).family;
			const isMention = announce.params?.mentioned === true;
			playNotificationSound(
				settings,
				device,
				family,
				announce.eventType,
				isMention
			);
		},
		[]
	);

	const refreshNotificationFeed = useCallback(async () => {
		const accessToken = getValueFromCookie('keycloak');
		if (!accessToken) {
			feedEpochRef.current += 1;
			// Do not hit protected endpoint before auth is available.
			resetFeedState();
			return;
		}

		const feedEpoch = feedEpochRef.current;
		try {
			const response = await apiGetEventNotifications(
				0,
				NOTIFICATION_FEED_MAX_ITEMS
			);
			const normalized: NotificationFeedItem[] = (
				response?.items || []
			).map(normalizeEventNotification);
			if (feedEpoch !== feedEpochRef.current) return;
			maybePlaySoundForNewEvent(normalized);
			setNotificationFeed((existing) =>
				// Page 0 is authoritative for its own window, so a row the
				// server dropped disappears here instead of surviving until a
				// reload.
				mergeNotificationFeed(normalized, existing, {
					reconcileWindow: true,
					olderPagesLoaded: highestLoadedPageRef.current > 0
				})
			);
			if (highestLoadedPageRef.current === 0) {
				setHasOlderNotifications(
					normalized.length === NOTIFICATION_FEED_MAX_ITEMS
				);
			}
			setUnreadNotificationCount(Number(response?.unreadCount || 0));
			// A healthy feed must not keep rendering the older-page error: it
			// was only ever cleared inside loadOlderNotifications, so a user who
			// never retried saw the error state on every subsequent refresh.
			setOlderNotificationsError(false);
		} catch (error) {
			// Keep existing state but log failures to simplify diagnostics.
			// eslint-disable-next-line no-console
			console.warn('Failed to refresh notification feed', error);
		}
	}, [maybePlaySoundForNewEvent, resetFeedState]);

	const loadOlderNotifications = useCallback(async () => {
		if (loadingOlderRef.current || !hasOlderNotifications) return;
		const accessToken = getValueFromCookie('keycloak');
		if (!accessToken) return;

		loadingOlderRef.current = true;
		setIsLoadingOlderNotifications(true);
		setOlderNotificationsError(false);
		const page = highestLoadedPageRef.current + 1;
		const feedEpoch = feedEpochRef.current;
		try {
			const response = await apiGetEventNotifications(
				page,
				NOTIFICATION_FEED_MAX_ITEMS
			);
			const normalized = (response?.items || []).map(
				normalizeEventNotification
			);
			if (feedEpoch !== feedEpochRef.current) return;
			setNotificationFeed((existing) =>
				mergeNotificationFeed(normalized, existing)
			);
			highestLoadedPageRef.current = page;
			setHasOlderNotifications(
				normalized.length === NOTIFICATION_FEED_MAX_ITEMS
			);
		} catch (error) {
			if (feedEpoch !== feedEpochRef.current) return;
			setOlderNotificationsError(true);
			// eslint-disable-next-line no-console
			console.warn('Failed to load older notification feed', error);
		} finally {
			if (feedEpoch === feedEpochRef.current) {
				loadingOlderRef.current = false;
				setIsLoadingOlderNotifications(false);
			}
		}
	}, [hasOlderNotifications]);

	const refreshNotificationFeedSafe = useCallback(() => {
		void refreshNotificationFeed();
	}, [refreshNotificationFeed]);

	useEffect(() => {
		refreshNotificationFeedSafe();
		const interval = window.setInterval(refreshNotificationFeedSafe, 15000);
		return () => window.clearInterval(interval);
	}, [refreshNotificationFeedSafe]);

	// Safari: programmatic audio.play() is only allowed on an element that was
	// played from a user gesture — prime one on the first pointer/keydown.
	useEffect(() => installAudioUnlock(), []);

	// Refresh trigger (#845, corrected): there is NO backend live push — the
	// LiveService transport is a 410 tombstone (ORISO-UserService
	// DeprecatedLiveProxyController). `messageEventEmitter` is fed by the
	// client's OWN Matrix sync (WebsocketHandler → matrixLiveEventBridge
	// 'directMessage'), so this only fires early for rooms this client
	// syncs; everything else arrives via the 15s poll above. Debounced so
	// a burst of events collapses into a single refetch.
	useEffect(() => {
		let debounceTimer: number | undefined;
		const onLiveEvent = () => {
			window.clearTimeout(debounceTimer);
			debounceTimer = window.setTimeout(refreshNotificationFeedSafe, 400);
		};
		messageEventEmitter.on(onLiveEvent);
		return () => {
			messageEventEmitter.off(onLiveEvent);
			window.clearTimeout(debounceTimer);
		};
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
		},
		[hasNotification, notifications]
	);

	const addEventNotification = useCallback(
		(event: EventNotificationInput) => {
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
				params: event.params,
				category: event.category === 'message' ? 'message' : 'system'
			};
			setNotificationFeed((existing) =>
				mergeNotificationFeed([feedItem], existing)
			);
			setUnreadNotificationCount((value) => value + 1);
		},
		[]
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
			existing.map((item) =>
				item.readAt ? item : { ...item, readAt: now }
			)
		);
		setUnreadNotificationCount(0);
	}, []);

	const clearNotificationFeed = useCallback(() => {
		feedEpochRef.current += 1;
		const accessToken = getValueFromCookie('keycloak');
		if (accessToken) {
			apiClearEventNotifications().catch(() => undefined);
		}
		resetFeedState();
	}, [resetFeedState]);

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
				loadOlderNotifications,
				hasOlderNotifications,
				isLoadingOlderNotifications,
				olderNotificationsError,
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
