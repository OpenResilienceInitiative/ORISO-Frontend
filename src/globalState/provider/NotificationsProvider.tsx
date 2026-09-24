import * as React from 'react';
import {
	createContext,
	Dispatch,
	ReactNode,
	useEffect,
	useCallback,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore
} from 'react';
import { v4 as uuid } from 'uuid';
import { t } from 'i18next';
import { sendNotification } from '../../utils/notificationHelpers';
import {
	IncomingVideoCallProps,
	NotificationTypeCall
} from '../../components/incomingVideoCall/IncomingVideoCall';
import {
	apiClearEventNotifications,
	apiGetEventNotifications,
	apiMarkAllEventNotificationsRead,
	apiMarkEventNotificationRead,
	apiGetEventNotificationsUnreadCount,
	apiMarkEventNotificationsReadByTypes,
	type EventNotificationFeedItem
} from '../../api/apiEventNotifications';
import { FETCH_ERRORS } from '../../api/fetchData';
import {
	AUTH_SESSION_CHANGE_EVENT,
	getValueFromCookie
} from '../../components/sessionCookie/accessSessionCookie';
import { EventActionParams } from '../../components/notificationsCenter/eventDescriptors';
import { parseEventActionParams } from '../../components/notificationsCenter/notificationActionTarget';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import {
	installAudioUnlock,
	playNotificationSound
} from '../../utils/notificationSettings/soundPlayback';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';
import { getEventDescriptor } from '../../components/notificationsCenter/eventDescriptors';
import { displayFilterStore } from '../../utils/displayFilter/store';
import {
	isEventMutedByKind,
	soundOverrideForEvent
} from '../../utils/displayFilter/soundMask';
import {
	DisplayFilter,
	resolveEffective
} from '../../utils/displayFilter/model';
import {
	computeTimelineBadge,
	hiddenTimelineEventTypes,
	hiddenUnreadLocalIds,
	hiddenUnreadServerIds
} from '../../utils/displayFilter/timeline';

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
	/**
	 * Live-region role for a notice a screen-reader user must hear at once
	 * (e.g. live chat switched off, #1485). Unset notifications stay silent.
	 */
	announce?: 'alert' | 'status';
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
/** PATCH batch size of the auto-read pass (spec §6.1). */
const CONFIRMED_READ_CHUNK = 50;
/** Debounce of the auto-read pass after a feed or filter change. */
export const AUTO_READ_DEBOUNCE_MS = 300;

/** One feed response, numbered so stale ones can be told apart (§6.3). */
type FeedResponse = {
	/** Filter snapshot at request time, retained while responses are parked. */
	requestedExclusions: string[];
	page: number;
	seq: number;
	items: NotificationFeedItem[];
	unreadCount: number;
	/** Issued after a confirmed-read settlement, not an ordinary poll. */
	reconciliation: boolean;
	/** Slice 7: `unreadCount` already excludes the hidden event types. */
	excludesHidden: boolean;
	/**
	 * The server echoed exclusions different from the current request set.
	 * Rows may still apply, but its total is unusable. Responses requested
	 * for an old filter are discarded entirely before reaching this check.
	 */
	staleTotal: boolean;
};

/** Two sorted lists are the same set. */
const sameList = (
	left: ReadonlyArray<string>,
	right: ReadonlyArray<string>
): boolean =>
	left.length === right.length &&
	left.every((value, index) => value === right[index]);

type NotificationsContextProps = {
	notifications: NotificationType[];
	notificationFeed: NotificationFeedItem[];
	/**
	 * Unread total as the app has always shown it: seeded from the server,
	 * incremented by local rows, decremented optimistically.
	 */
	unreadNotificationCount: number;
	/** The last API `unreadCount` as received (spec §6.3, server only). */
	serverUnreadTotal: number;
	/**
	 * Slice 7: true when the server left the hidden event types out of
	 * `serverUnreadTotal` (exact badge, no "up to N hidden" hint).
	 */
	serverUnreadTotalExcludesHidden: boolean;
	/**
	 * Slice 7: true while the server holds unread rows at all, hidden kinds
	 * on unloaded pages included ("Mark all as read" clears everything, §6.1).
	 */
	hasUnreadNotifications: boolean;
	/** The effective Zeitstrahl display filter (spec §4). */
	timelineDisplayFilter: DisplayFilter;
	/** Visible unread for the rail badge (spec §6.3 v1 formula). */
	visibleUnreadCount: number;
	/** Unread server rows in loaded pages the filter hides (badge tooltip). */
	hiddenUnreadInLoadedPages: number;
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
	/**
	 * Confirmed-success read for the auto-read pass (spec §6.1): awaits each
	 * PATCH and updates `readAt` and the server total only on success.
	 */
	markNotificationsReadConfirmed: (ids: string[]) => Promise<void>;
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
	const [serverUnreadTotal, setServerUnreadTotal] = useState(0);
	// Local rows survive polling and never enter the server total.
	const unreadNotificationCount =
		serverUnreadTotal +
		notificationFeed.filter((item) => isLocalItem(item) && !item.readAt)
			.length;
	const [
		serverUnreadTotalExcludesHidden,
		setServerUnreadTotalExcludesHidden
	] = useState(false);
	const [hasOlderNotifications, setHasOlderNotifications] = useState(false);
	const [isLoadingOlderNotifications, setIsLoadingOlderNotifications] =
		useState(false);
	const [olderNotificationsError, setOlderNotificationsError] =
		useState(false);
	const highestLoadedPageRef = useRef(0);
	const loadingOlderRef = useRef(false);
	const feedEpochRef = useRef(0);
	// Keep the initial backlog silent and observe every subsequently new id,
	// including requests sorted beneath another event in the same feed page.
	const observedEventIdsRef = useRef<Set<string> | null>(null);
	const pendingLiveEventIdsRef = useRef(new Set<string>());
	const initialFeedTimeRef = useRef(Number.NEGATIVE_INFINITY);
	const observedRequestIdsRef = useRef<Set<string> | null>(null);

	// --- Request ordering and pending-read serialisation (spec §6.3) --------
	// Every feed request carries a number from one counter. Rows are applied
	// only above their page's newest-applied floor AND the read-settled floor;
	// the total comes from page 0 only. While a confirmed-read PATCH is in
	// flight every response is parked in full.
	const requestSeqRef = useRef(0);
	const pageFloorsRef = useRef<Map<number, number>>(new Map());
	const readSettledFloorRef = useRef(0);
	const pendingReadCountRef = useRef(0);
	const pendingReadIdsRef = useRef<Set<string>>(new Set());
	// A 404 from the bulk endpoint means an older server: fall back silently.
	const bulkReadUnsupportedRef = useRef(false);
	const bulkReadScheduledRef = useRef(false);
	const bulkReadPendingRef = useRef(false);
	/** Rows a successful bulk read already covered: never PATCHed per id. */
	const bulkReadDoneIdsRef = useRef<Set<string>>(new Set());
	/** Filter key of the last bulk read that succeeded (or was unsupported). */
	const lastBulkReadKeyRef = useRef('');
	/** Filter key whose bulk read failed: retried once per ordinary poll. */
	const bulkReadFailedKeyRef = useRef('');
	const settlementRef = useRef<{ anySuccess: boolean; failed: string[] }>({
		anySuccess: false,
		failed: []
	});
	const parkedPageZeroRef = useRef<FeedResponse | null>(null);
	const parkedOlderRef = useRef<Map<number, FeedResponse>>(new Map());
	// Failed ids wait for an ordinary poll issued after the settlement.
	const cooldownRef = useRef<Set<string>>(new Set());
	const cooldownSeqRef = useRef(0);

	const resetFeedState = useCallback(() => {
		loadingOlderRef.current = false;
		observedEventIdsRef.current = null;
		pendingLiveEventIdsRef.current.clear();
		observedRequestIdsRef.current = null;
		initialFeedTimeRef.current = Number.NEGATIVE_INFINITY;
		setNotificationFeed([]);
		setServerUnreadTotal(0);
		setServerUnreadTotalExcludesHidden(false);
		setUnfilteredUnreadTotal(null);
		setHasOlderNotifications(false);
		setIsLoadingOlderNotifications(false);
		setOlderNotificationsError(false);
		highestLoadedPageRef.current = 0;
		pageFloorsRef.current = new Map();
		readSettledFloorRef.current = 0;
		parkedPageZeroRef.current = null;
		parkedOlderRef.current = new Map();
		cooldownRef.current = new Set();
		bulkReadDoneIdsRef.current = new Set();
		// Pending-read bookkeeping belongs to the previous epoch: a request
		// still in flight for the old user must neither park the new user's
		// first page nor settle into it (its completions check the epoch).
		pendingReadCountRef.current = 0;
		pendingReadIdsRef.current = new Set();
		settlementRef.current = { anySuccess: false, failed: [] };
		bulkReadPendingRef.current = false;
		bulkReadScheduledRef.current = false;
		lastBulkReadKeyRef.current = '';
		bulkReadFailedKeyRef.current = '';
	}, []);

	// The Zeitstrahl display filter (#1377): the store needs no client to be
	// read, so this provider — mounted outside MatrixClientProvider — only
	// subscribes; AuthenticatedApp attaches the client.
	const displayFilterState = useSyncExternalStore(
		(listener) => displayFilterStore.subscribe(listener),
		() => displayFilterStore.getState()
	);
	const timelineDisplayFilter = useMemo(
		() => resolveEffective(displayFilterState.filters, 'timeline'),
		[displayFilterState.filters]
	);
	// Slice 7: what the server should leave out of the total (sorted).
	const hiddenEventTypes = useMemo(
		() => hiddenTimelineEventTypes(timelineDisplayFilter),
		[timelineDisplayFilter]
	);
	const [exclusionRefreshGeneration, setExclusionRefreshGeneration] =
		useState(0);
	const hiddenEventTypesRef = useRef(hiddenEventTypes);
	hiddenEventTypesRef.current = hiddenEventTypes;
	/** Whether the current total already leaves the hidden types out. */
	const serverUnreadTotalExcludesHiddenRef = useRef(false);
	serverUnreadTotalExcludesHiddenRef.current =
		serverUnreadTotalExcludesHidden;
	/**
	 * Slice 7: while an exact (exclusion-aware) total reads 0, the server
	 * may still hold unread rows of hidden types on unloaded pages. "Mark
	 * all as read" clears everything (§6.1), so it is gated by the
	 * unfiltered total, fetched only in that state.
	 */
	const [unfilteredUnreadTotal, setUnfilteredUnreadTotal] = useState<
		number | null
	>(null);
	/** Latest feed for callbacks that must not wait for a re-render. */
	const notificationFeedRef = useRef<NotificationFeedItem[]>([]);
	notificationFeedRef.current = notificationFeed;
	// Bumped when a bulk read settles so the per-id pass re-evaluates.
	const [bulkReadGeneration, setBulkReadGeneration] = useState(0);

	// One event-observation path owns sound and OS banners. Initial history is
	// silent; repeated polls and read-state changes cannot re-announce a row.
	const announceNewEvents = useCallback((feed: NotificationFeedItem[]) => {
		if (observedEventIdsRef.current === null) {
			observedEventIdsRef.current = new Set(
				feed
					.filter(
						(item) =>
							!pendingLiveEventIdsRef.current.has(
								item.params?.matrixEventId
							)
					)
					.map((item) => item.id)
			);
			initialFeedTimeRef.current = Math.max(
				Number.NEGATIVE_INFINITY,
				...feed.map((item) => new Date(item.createdAt).getTime())
			);
		}
		const observed = observedEventIdsRef.current;
		const { settings, device } = notificationSettingsStore.getState();
		for (const event of feed) {
			if (observed.has(event.id)) continue;
			observed.add(event.id);
			const pendingLive = pendingLiveEventIdsRef.current.delete(
				event.params?.matrixEventId
			);
			if (
				event.readAt ||
				(!pendingLive &&
					new Date(event.createdAt).getTime() <
						initialFeedTimeRef.current)
			)
				continue;
			const descriptor = getEventDescriptor(event.eventType);
			const mentioned = event.params?.mentioned === true;
			// #1377 "Ton": the user muted this kind of session in the list's
			// display filter → no sound, whatever the area settings say. Before
			// the account data is synced the store already holds the local
			// mirror of the last known filters, so a mute is honoured from the
			// first poll; waiting for `synced` would silence every sound while
			// account data is unreachable. The banner is unaffected.
			const displayFilter = displayFilterStore.getState();
			const mutedByKind = isEventMutedByKind(
				displayFilter.filters,
				event.sourceSessionId
			);
			if (!mutedByKind) {
				try {
					playNotificationSound(
						settings,
						device,
						descriptor.family,
						event.eventType,
						mentioned,
						Date.now(),
						soundOverrideForEvent(
							displayFilter.filters,
							event.sourceSessionId
						)
					);
				} catch {
					// Device audio support must not prevent feed or banner delivery.
				}
			}
			// OS surfaces contain only the generic localized event title. Never
			// copy server text or decrypted counselling content to the lock screen.
			try {
				sendNotification(
					t(descriptor.titleTemplate, { senderDisplayName: '' }),
					{
						family: descriptor.family,
						eventType: event.eventType,
						mentioned,
						showAlways: descriptor.family === 'requests',
						onclick: () => window.focus()
					}
				);
			} catch {
				// Some browsers expose Notification but reject its constructor.
				// The feed remains available and polling continues normally.
			}
		}
	}, []);

	/** Applies a response, or discards it when a floor says it is stale. */
	const applyFeedResponse = useCallback(
		(response: FeedResponse): boolean => {
			const { page, seq, items, unreadCount, reconciliation } = response;
			const pageFloor = pageFloorsRef.current.get(page) ?? 0;
			if (seq <= pageFloor || seq <= readSettledFloorRef.current) {
				return false;
			}
			if (
				!sameList(
					response.requestedExclusions,
					hiddenEventTypesRef.current
				)
			) {
				// A filter switch also invalidates parked rows, not only their total.
				// React batches discarded parked pages into one current-set refresh.
				setExclusionRefreshGeneration((value) => value + 1);
				return false;
			}
			pageFloorsRef.current.set(page, seq);
			if (page === 0) {
				const requests = items.filter(
					(item) => item.eventType === 'request.new'
				);
				const observed = observedRequestIdsRef.current;
				const hasNewRequest =
					observed !== null &&
					requests.some((item) => !observed.has(item.id));
				observedRequestIdsRef.current ??= new Set();
				requests.forEach((item) =>
					observedRequestIdsRef.current.add(item.id)
				);
				if (hasNewRequest) {
					messageEventEmitter.emit({
						refreshEnquiryList: true,
						source: 'notification-feed'
					});
				}
				announceNewEvents(items);
				setNotificationFeed((existing) =>
					// Page 0 is authoritative for its own window, so a row the
					// server dropped disappears here instead of surviving
					// until a reload.
					mergeNotificationFeed(items, existing, {
						reconcileWindow: true,
						olderPagesLoaded: highestLoadedPageRef.current > 0
					})
				);
				if (highestLoadedPageRef.current === 0) {
					setHasOlderNotifications(
						items.length === NOTIFICATION_FEED_MAX_ITEMS
					);
				}
				if (!response.staleTotal) {
					setServerUnreadTotal(unreadCount);
					setServerUnreadTotalExcludesHidden(response.excludesHidden);
					if (response.excludesHidden && unreadCount === 0) {
						const epoch = feedEpochRef.current;
						apiGetEventNotificationsUnreadCount()
							.then((result) => {
								if (epoch === feedEpochRef.current) {
									setUnfilteredUnreadTotal(
										Number(result?.unreadCount ?? 0)
									);
								}
							})
							.catch(() => undefined);
					} else {
						setUnfilteredUnreadTotal(null);
					}
				}
				// A healthy feed must not keep rendering the older-page error:
				// it was only ever cleared inside loadOlderNotifications, so a
				// user who never retried saw the error state on every
				// subsequent refresh.
				setOlderNotificationsError(false);
				if (!reconciliation && seq > cooldownSeqRef.current) {
					cooldownRef.current = new Set();
					if (bulkReadFailedKeyRef.current) {
						// One retry of a failed bulk read per ordinary poll,
						// never a tight loop (the effect re-runs per generation).
						bulkReadFailedKeyRef.current = '';
						setBulkReadGeneration((value) => value + 1);
					}
				}
			} else {
				setNotificationFeed((existing) =>
					mergeNotificationFeed(items, existing)
				);
				highestLoadedPageRef.current = Math.max(
					highestLoadedPageRef.current,
					page
				);
				setHasOlderNotifications(
					items.length === NOTIFICATION_FEED_MAX_ITEMS
				);
			}
			return true;
		},
		[announceNewEvents]
	);

	/** Parks the response while confirmed reads are pending, else applies. */
	const handleFeedResponse = useCallback(
		(response: FeedResponse): boolean => {
			if (pendingReadCountRef.current > 0) {
				if (response.page === 0) {
					const parked = parkedPageZeroRef.current;
					if (!parked || parked.seq < response.seq) {
						parkedPageZeroRef.current = response;
					}
				} else {
					const parked = parkedOlderRef.current.get(response.page);
					if (!parked || parked.seq < response.seq) {
						parkedOlderRef.current.set(response.page, response);
					}
				}
				return true;
			}
			return applyFeedResponse(response);
		},
		[applyFeedResponse]
	);

	const fetchFeedPage = useCallback(
		async (
			page: number,
			options: { reconciliation?: boolean } = {}
		): Promise<boolean> => {
			requestSeqRef.current += 1;
			const seq = requestSeqRef.current;
			const feedEpoch = feedEpochRef.current;
			const excluded = [...hiddenEventTypesRef.current];
			const response = await apiGetEventNotifications(
				page,
				NOTIFICATION_FEED_MAX_ITEMS,
				excluded
			);
			if (feedEpoch !== feedEpochRef.current) {
				return false;
			}
			const items: NotificationFeedItem[] = (response?.items || []).map(
				normalizeEventNotification
			);
			// Exact only when the server echoes exactly the set the filter
			// hides NOW (an older server ignores the parameter and echoes
			// nothing; a response for a set the user has since changed is a
			// bound, not an exact total for the new set).
			const echoed = Array.isArray(response?.excludedEventTypes)
				? [...response.excludedEventTypes].sort()
				: [];
			const current = hiddenEventTypesRef.current;
			return handleFeedResponse({
				requestedExclusions: excluded,
				page,
				seq,
				items,
				unreadCount: Number(response?.unreadCount || 0),
				reconciliation: options.reconciliation === true,
				excludesHidden: current.length > 0 && sameList(echoed, current),
				staleTotal: echoed.length > 0 && !sameList(echoed, current)
			});
		},
		[handleFeedResponse]
	);

	const refreshNotificationFeed = useCallback(async () => {
		const accessToken = getValueFromCookie('keycloak');
		if (!accessToken) {
			feedEpochRef.current += 1;
			// Do not hit protected endpoint before auth is available.
			resetFeedState();
			return;
		}
		try {
			await fetchFeedPage(0);
		} catch (error) {
			// Keep existing state but log failures to simplify diagnostics.
			// eslint-disable-next-line no-console
			console.warn('Failed to refresh notification feed', error);
		}
	}, [fetchFeedPage, resetFeedState]);

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
			await fetchFeedPage(page);
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
	}, [fetchFeedPage, hasOlderNotifications]);

	/**
	 * Last pending confirmed read settled: failed ids cool down first; with
	 * at least one success one reconciliation fetch is issued and the
	 * read-settled floor moves just below it (parked responses are stale by
	 * construction); with none, the parked responses apply as they are.
	 */
	const settlePendingReads = useCallback(() => {
		const { anySuccess, failed } = settlementRef.current;
		settlementRef.current = { anySuccess: false, failed: [] };
		failed.forEach((id) => cooldownRef.current.add(id));
		cooldownSeqRef.current = requestSeqRef.current;
		if (anySuccess) {
			parkedPageZeroRef.current = null;
			parkedOlderRef.current = new Map();
			readSettledFloorRef.current = requestSeqRef.current;
			void fetchFeedPage(0, { reconciliation: true }).catch(
				() => undefined
			);
			return;
		}
		const pageZero = parkedPageZeroRef.current;
		parkedPageZeroRef.current = null;
		if (pageZero) {
			applyFeedResponse(pageZero);
		}
		const older = Array.from(parkedOlderRef.current.values()).sort(
			(left, right) => left.page - right.page
		);
		parkedOlderRef.current = new Map();
		older.forEach((response) => applyFeedResponse(response));
	}, [applyFeedResponse, fetchFeedPage]);

	const markNotificationsReadConfirmed = useCallback(
		async (ids: string[]) => {
			const accessToken = getValueFromCookie('keycloak');
			if (!accessToken) {
				return;
			}
			const localIds = ids.filter((id) => id.startsWith('local-'));
			if (localIds.length > 0) {
				// Client-only rows: no request, never in the server total.
				const now = new Date().toISOString();
				const local = new Set(localIds);
				setNotificationFeed((existing) =>
					existing.map((item) =>
						local.has(item.id) && !item.readAt
							? { ...item, readAt: now }
							: item
					)
				);
			}
			const serverIds = ids.filter(
				(id) =>
					!id.startsWith('local-') &&
					!pendingReadIdsRef.current.has(id) &&
					!cooldownRef.current.has(id)
			);
			if (serverIds.length === 0) {
				return;
			}
			const feedEpoch = feedEpochRef.current;
			serverIds.forEach((id) => pendingReadIdsRef.current.add(id));
			pendingReadCountRef.current += serverIds.length;
			for (
				let offset = 0;
				offset < serverIds.length;
				offset += CONFIRMED_READ_CHUNK
			) {
				const chunk = serverIds.slice(
					offset,
					offset + CONFIRMED_READ_CHUNK
				);
				await Promise.all(
					chunk.map((id) =>
						apiMarkEventNotificationRead(id)
							.then(() => {
								if (feedEpoch !== feedEpochRef.current) {
									return;
								}
								const now = new Date().toISOString();
								// Same state update: the row leaves the hidden
								// count and the total together (§6.3).
								setNotificationFeed((existing) =>
									existing.map((item) =>
										item.id === id && !item.readAt
											? { ...item, readAt: now }
											: item
									)
								);
								setServerUnreadTotal((value) =>
									Math.max(0, value - 1)
								);
								settlementRef.current.anySuccess = true;
							})
							.catch(() => {
								settlementRef.current.failed.push(id);
							})
							.finally(() => {
								if (feedEpoch !== feedEpochRef.current) {
									// The epoch reset already dropped this
									// request's bookkeeping.
									return;
								}
								pendingReadIdsRef.current.delete(id);
								pendingReadCountRef.current -= 1;
								if (pendingReadCountRef.current === 0) {
									settlePendingReads();
								}
							})
					)
				);
			}
		},
		[settlePendingReads]
	);

	/**
	 * Slice 7: "hidden ⇒ read" across unloaded pages through the bulk
	 * endpoint. Runs through the same pending-read serialisation as the
	 * per-id path (responses park meanwhile; a success issues the
	 * reconciliation fetch), and once per filter change. A 404 marks the
	 * server as older and the per-id path stays the only one.
	 */
	const markHiddenReadOnServer = useCallback(
		async (
			eventTypes: ReadonlyArray<string>
		): Promise<'done' | 'pending' | 'failed'> => {
			if (bulkReadUnsupportedRef.current || eventTypes.length === 0) {
				return 'done';
			}
			if (bulkReadPendingRef.current || !getValueFromCookie('keycloak')) {
				// Not done yet: the effect runs again once the pending request
				// has settled (`bulkReadGeneration`) and retries with the
				// current set, so a filter changed mid-request is not skipped.
				return 'pending';
			}
			const feedEpoch = feedEpochRef.current;
			bulkReadPendingRef.current = true;
			pendingReadCountRef.current += 1;
			try {
				const result =
					await apiMarkEventNotificationsReadByTypes(eventTypes);
				if (feedEpoch !== feedEpochRef.current) {
					return 'done';
				}
				settlementRef.current.anySuccess = true;
				// The server has read them: reflect it on the loaded rows and
				// the total now; the reconciliation fetch confirms both.
				const types = new Set(eventTypes);
				const now = new Date().toISOString();
				// Recorded synchronously (not inside the state updater, which
				// runs at the next render): a per-id timer firing before that
				// render must already see these ids as covered.
				const covered = new Set(
					notificationFeedRef.current
						.filter(
							(row) =>
								!row.readAt &&
								!row.id.startsWith('local-') &&
								types.has(row.eventType)
						)
						.map((row) => row.id)
				);
				covered.forEach((id) => bulkReadDoneIdsRef.current.add(id));
				setNotificationFeed((existing) =>
					existing.map((row) =>
						covered.has(row.id) && !row.readAt
							? { ...row, readAt: now }
							: row
					)
				);
				const updated = Number(result?.updated ?? 0);
				// An exact total (server echoed the exclusions) never counted
				// these rows: subtracting again would remove visible unread.
				if (
					updated > 0 &&
					!serverUnreadTotalExcludesHiddenRef.current
				) {
					setServerUnreadTotal((value) =>
						Math.max(0, value - updated)
					);
				}
				return 'done';
			} catch (error) {
				const message = (error as { message?: string })?.message;
				if (
					message === FETCH_ERRORS.NO_MATCH ||
					message === 'notFound' ||
					(error as { status?: number })?.status === 404
				) {
					bulkReadUnsupportedRef.current = true;
					return 'done';
				}
				// Anything else (500, network): not "done" — retried once per
				// ordinary poll or at the next filter change, never in a loop.
				console.warn('Bulk hidden-read failed; will retry', error);
				return 'failed';
			} finally {
				if (feedEpoch === feedEpochRef.current) {
					bulkReadPendingRef.current = false;
					pendingReadCountRef.current -= 1;
					if (pendingReadCountRef.current === 0) {
						settlePendingReads();
					}
				}
				setBulkReadGeneration((value) => value + 1);
			}
		},
		[settlePendingReads]
	);
	const displayFilterSynced = displayFilterState.synced;
	useEffect(() => {
		if (
			!timelineDisplayFilter.autoReadHidden ||
			hiddenEventTypes.length === 0
		) {
			lastBulkReadKeyRef.current = '';
			return undefined;
		}
		if (!displayFilterSynced) {
			// Before the initial sync the filter may be a stale mirror; a
			// read is irreversible, so it waits for account data (§7.2).
			return undefined;
		}
		const key = hiddenEventTypes.join(',');
		if (
			key === lastBulkReadKeyRef.current ||
			key === bulkReadFailedKeyRef.current ||
			bulkReadUnsupportedRef.current
		) {
			return undefined;
		}
		// Claimed synchronously so a per-id timer created in the same commit
		// leaves these rows to the bulk read whatever the timer order.
		bulkReadScheduledRef.current = true;
		const timer = window.setTimeout(() => {
			bulkReadScheduledRef.current = false;
			// Recorded only once the request succeeded or the server is known
			// to be older; a failed request must not count as done.
			void markHiddenReadOnServer(hiddenEventTypes).then((result) => {
				if (result === 'done') {
					lastBulkReadKeyRef.current = key;
				} else if (result === 'failed') {
					bulkReadFailedKeyRef.current = key;
				}
			});
		}, AUTO_READ_DEBOUNCE_MS);
		return () => {
			bulkReadScheduledRef.current = false;
			window.clearTimeout(timer);
		};
	}, [
		bulkReadGeneration,
		displayFilterSynced,
		hiddenEventTypes,
		markHiddenReadOnServer,
		timelineDisplayFilter.autoReadHidden
	]);

	// Auto-read pass (spec §6.1): on every feed or filter change, every
	// hidden unread row is marked read — server rows through the confirmed
	// path (skipping pending and cooled-down ids), local rows locally.
	useEffect(() => {
		if (
			!timelineDisplayFilter.autoReadHidden ||
			!displayFilterSynced ||
			bulkReadPendingRef.current
		) {
			return undefined;
		}
		const localIds = hiddenUnreadLocalIds(
			notificationFeed,
			timelineDisplayFilter
		);
		const serverIds = hiddenUnreadServerIds(
			notificationFeed,
			timelineDisplayFilter
		).filter(
			(id) =>
				!pendingReadIdsRef.current.has(id) &&
				!cooldownRef.current.has(id) &&
				!bulkReadDoneIdsRef.current.has(id)
		);
		if (localIds.length === 0 && serverIds.length === 0) {
			return undefined;
		}
		const timer = window.setTimeout(() => {
			if (bulkReadScheduledRef.current || bulkReadPendingRef.current) {
				// The bulk read (slice 7) covers these rows; this pass runs
				// again once it has settled (`bulkReadGeneration`).
				return;
			}
			// A bulk read may have settled between scheduling and firing.
			const remaining = serverIds.filter(
				(id) => !bulkReadDoneIdsRef.current.has(id)
			);
			if (localIds.length === 0 && remaining.length === 0) {
				return;
			}
			void markNotificationsReadConfirmed([...localIds, ...remaining]);
		}, AUTO_READ_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [
		displayFilterSynced,
		notificationFeed,
		timelineDisplayFilter,
		markNotificationsReadConfirmed,
		bulkReadGeneration
	]);

	const badge = useMemo(
		() =>
			computeTimelineBadge(
				notificationFeed,
				timelineDisplayFilter,
				serverUnreadTotal,
				{ serverTotalExcludesHidden: serverUnreadTotalExcludesHidden }
			),
		[
			notificationFeed,
			timelineDisplayFilter,
			serverUnreadTotal,
			serverUnreadTotalExcludesHidden
		]
	);

	const refreshNotificationFeedSafe = useCallback(() => {
		void refreshNotificationFeed();
	}, [refreshNotificationFeed]);

	useEffect(() => {
		refreshNotificationFeedSafe();
		const interval = window.setInterval(refreshNotificationFeedSafe, 15000);
		return () => window.clearInterval(interval);
	}, [refreshNotificationFeedSafe, exclusionRefreshGeneration]);

	// This provider lives above the router, so it outlives the session. When
	// the auth session is torn down (sign-out, expired refresh token) the
	// feed is reset at once and in-flight responses are dropped through the
	// epoch, instead of polling on with a leftover token until the next tick.
	useEffect(() => {
		window.addEventListener(
			AUTH_SESSION_CHANGE_EVENT,
			refreshNotificationFeedSafe
		);
		return () =>
			window.removeEventListener(
				AUTH_SESSION_CHANGE_EVENT,
				refreshNotificationFeedSafe
			);
	}, [refreshNotificationFeedSafe]);

	// Slice 7: an exact total describes one exclusion set. When the set
	// changes, the stored total is at best a bound (the v1 formula applies)
	// until the next response for the new set: the bulk read's
	// reconciliation fetch with auto-read on, otherwise the next poll.
	const lastExclusionKeyRef = useRef<string | null>(null);
	useEffect(() => {
		const key = hiddenEventTypes.join(',');
		if (lastExclusionKeyRef.current === null) {
			lastExclusionKeyRef.current = key;
			return;
		}
		if (key === lastExclusionKeyRef.current) {
			return;
		}
		lastExclusionKeyRef.current = key;
		setServerUnreadTotalExcludesHidden(false);
	}, [hiddenEventTypes]);

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
		const onLiveEvent = (event) => {
			if (event.source === 'notification-feed') return;
			if (
				observedEventIdsRef.current === null &&
				event.matrixEventId &&
				event.isOwnMessage === false
			) {
				pendingLiveEventIdsRef.current.add(event.matrixEventId);
			}
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
		// Opening an already-read card calls this too: the totals move only
		// on an unread → read transition of a row we know.
		const row = notificationFeedRef.current.find((item) => item.id === id);
		const wasUnread = !!row && !row.readAt;
		// Update the callback snapshot synchronously: repeated reads in one
		// React batch must decrement the badge only once.
		const now = new Date().toISOString();
		notificationFeedRef.current = notificationFeedRef.current.map((item) =>
			item.id === id && !item.readAt ? { ...item, readAt: now } : item
		);
		if (!id.startsWith('local-')) {
			apiMarkEventNotificationRead(id).catch(() => undefined);
			if (wasUnread) {
				setServerUnreadTotal((value) => Math.max(0, value - 1));
			}
		}
		setNotificationFeed((existing) =>
			existing.map((item) =>
				item.id === id && !item.readAt
					? { ...item, readAt: new Date().toISOString() }
					: item
			)
		);
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
		setServerUnreadTotal(0);
		setUnfilteredUnreadTotal(null);
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
				serverUnreadTotal,
				serverUnreadTotalExcludesHidden,
				hasUnreadNotifications:
					unreadNotificationCount > 0 ||
					(unfilteredUnreadTotal ?? 0) > 0,
				timelineDisplayFilter,
				visibleUnreadCount: badge.visibleUnreadCount,
				hiddenUnreadInLoadedPages:
					badge.hiddenServerUnreadInLoadedPages,
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
				markNotificationsReadConfirmed,
				markAllNotificationsAsRead,
				clearNotificationFeed
			}}
		>
			{props.children}
		</NotificationsContext.Provider>
	);
}
