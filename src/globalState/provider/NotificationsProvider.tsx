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
import {
	IncomingVideoCallProps,
	NotificationTypeCall
} from '../../components/incomingVideoCall/IncomingVideoCall';
import {
	apiClearEventNotifications,
	apiGetEventNotifications,
	apiMarkAllEventNotificationsRead,
	apiMarkEventNotificationRead,
	apiMarkEventNotificationsReadByTypes,
	type EventNotificationFeedItem
} from '../../api/apiEventNotifications';
import { FETCH_ERRORS } from '../../api/fetchData';
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
import { displayFilterStore } from '../../utils/displayFilter/store';
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
const AUTO_READ_DEBOUNCE_MS = 300;

/** One feed response, numbered so stale ones can be told apart (§6.3). */
type FeedResponse = {
	page: number;
	seq: number;
	items: NotificationFeedItem[];
	unreadCount: number;
	/** Issued after a confirmed-read settlement, not an ordinary poll. */
	reconciliation: boolean;
	/** Slice 7: `unreadCount` already excludes the hidden event types. */
	excludesHidden: boolean;
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
	const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
	const [serverUnreadTotal, setServerUnreadTotal] = useState(0);
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
	// #576: id of the newest event slot we already reconciled, so a feed refresh
	// only announces a genuinely newer event (not every poll, and never on the
	// backlog surfaced when an event above it is read).
	const lastAnnouncedEventIdRef = useRef<string | null>(null);

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
		setNotificationFeed([]);
		setUnreadNotificationCount(0);
		setServerUnreadTotal(0);
		setServerUnreadTotalExcludesHidden(false);
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
	const hiddenEventTypesRef = useRef(hiddenEventTypes);
	hiddenEventTypesRef.current = hiddenEventTypes;
	/** Latest feed for callbacks that must not wait for a re-render. */
	const notificationFeedRef = useRef<NotificationFeedItem[]>([]);
	notificationFeedRef.current = notificationFeed;
	// Bumped when a bulk read settles so the per-id pass re-evaluates.
	const [bulkReadGeneration, setBulkReadGeneration] = useState(0);

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

	/** Applies a response, or discards it when a floor says it is stale. */
	const applyFeedResponse = useCallback(
		(response: FeedResponse): boolean => {
			const { page, seq, items, unreadCount, reconciliation } = response;
			const pageFloor = pageFloorsRef.current.get(page) ?? 0;
			if (seq <= pageFloor || seq <= readSettledFloorRef.current) {
				return false;
			}
			pageFloorsRef.current.set(page, seq);
			if (page === 0) {
				maybePlaySoundForNewEvent(items);
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
				setUnreadNotificationCount(unreadCount);
				setServerUnreadTotal(unreadCount);
				setServerUnreadTotalExcludesHidden(response.excludesHidden);
				// A healthy feed must not keep rendering the older-page error:
				// it was only ever cleared inside loadOlderNotifications, so a
				// user who never retried saw the error state on every
				// subsequent refresh.
				setOlderNotificationsError(false);
				if (!reconciliation && seq > cooldownSeqRef.current) {
					cooldownRef.current = new Set();
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
		[maybePlaySoundForNewEvent]
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
			const excluded = hiddenEventTypesRef.current;
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
			// Exact only when the server echoes exactly what was asked (an
			// older server ignores the parameter and echoes nothing).
			const echoed = Array.isArray(response?.excludedEventTypes)
				? [...response.excludedEventTypes].sort()
				: [];
			return handleFeedResponse({
				page,
				seq,
				items,
				unreadCount: Number(response?.unreadCount || 0),
				reconciliation: options.reconciliation === true,
				excludesHidden:
					excluded.length > 0 && sameList(echoed, excluded)
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
								setUnreadNotificationCount((value) =>
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
		async (eventTypes: ReadonlyArray<string>): Promise<boolean> => {
			if (
				bulkReadUnsupportedRef.current ||
				bulkReadPendingRef.current ||
				eventTypes.length === 0 ||
				!getValueFromCookie('keycloak')
			) {
				return true;
			}
			const feedEpoch = feedEpochRef.current;
			bulkReadPendingRef.current = true;
			pendingReadCountRef.current += 1;
			try {
				const result =
					await apiMarkEventNotificationsReadByTypes(eventTypes);
				if (feedEpoch !== feedEpochRef.current) {
					return true;
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
				if (updated > 0) {
					setServerUnreadTotal((value) =>
						Math.max(0, value - updated)
					);
					setUnreadNotificationCount((value) =>
						Math.max(0, value - updated)
					);
				}
				return true;
			} catch (error) {
				const message = (error as { message?: string })?.message;
				if (
					message === FETCH_ERRORS.NO_MATCH ||
					message === 'notFound' ||
					(error as { status?: number })?.status === 404
				) {
					bulkReadUnsupportedRef.current = true;
					return true;
				}
				// Anything else (500, network): not "done" — the next filter
				// change tries again instead of leaving unloaded pages unread.
				console.warn('Bulk hidden-read failed; will retry', error);
				return false;
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
	useEffect(() => {
		if (
			!timelineDisplayFilter.autoReadHidden ||
			hiddenEventTypes.length === 0
		) {
			lastBulkReadKeyRef.current = '';
			return undefined;
		}
		const key = hiddenEventTypes.join(',');
		if (
			key === lastBulkReadKeyRef.current ||
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
			void markHiddenReadOnServer(hiddenEventTypes).then((done) => {
				if (done) {
					lastBulkReadKeyRef.current = key;
				}
			});
		}, AUTO_READ_DEBOUNCE_MS);
		return () => {
			bulkReadScheduledRef.current = false;
			window.clearTimeout(timer);
		};
	}, [
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
			// Local rows never enter `serverUnreadTotal` (spec §6.3).
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
			setServerUnreadTotal((value) => Math.max(0, value - 1));
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
		setServerUnreadTotal(0);
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
