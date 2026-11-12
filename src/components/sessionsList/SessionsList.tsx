import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
	getSessionType,
	SESSION_LIST_TAB,
	SESSION_LIST_TAB_ARCHIVE,
	SESSION_LIST_TYPES,
	SESSION_TYPE_ARCHIVED,
	SESSION_TYPES
} from '../session/sessionHelpers';
import {
	AUTHORITIES,
	buildExtendedSession,
	ExtendedSessionInterface,
	getExtendedSession,
	hasUserAuthority,
	REMOVE_SESSIONS,
	SessionsDataContext,
	SessionTypeContext,
	SET_SESSIONS,
	UPDATE_SESSIONS,
	UserDataContext,
	useTenant,
	ActiveSessionProvider
} from '../../globalState';
import {
	ListItemInterface,
	STATUS_EMPTY,
	TopicSessionInterface
} from '../../globalState/interfaces';
import { SessionListItemComponent } from '../sessionsListItem/SessionListItemComponent';
import { SessionsListSkeleton } from '../sessionsListItem/SessionsListItemSkeleton';
import { getModality, Modality } from '../session/getModality';
import {
	apiGetAskerSessionList,
	apiGetConsultantSessionList,
	FETCH_ERRORS,
	SESSION_COUNT
} from '../../api';
import { useLiveChatAvailable } from '../../utils/liveChatToggle';
import { isLiveChatChipVisible } from './liveChatChipVisibility';
import { isMatrixRoom } from '../../utils/matrixRoomUtils';
import { Button } from '../button/Button';
import { CaseHandoverCurtainView } from '../session/CaseHandoverCurtain';
import { CaseHandoverBulkBar } from './CaseHandoverBulkBar';
import './sessionsList.styles';
import { SCROLL_PAGINATE_THRESHOLD } from './sessionsListConfig';
import clsx from 'clsx';
import useUpdatingRef from '../../hooks/useUpdatingRef';
import { apiGetSessionRoomsByRoomIds } from '../../api/apiGetSessionRooms';
import { useWatcher } from '../../hooks/useWatcher';
import { useSearchParam } from '../../hooks/useSearchParams';
import { apiGetChatRoomById } from '../../api/apiGetChatRoomById';
import FocusTrap from 'focus-trap-react';
import { useTranslation } from 'react-i18next';
import { EmptyListItem } from './EmptyListItem';
import { matrixLiveEventBridge } from '../../services/matrixLiveEventBridge';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import { useForegroundRefresh } from '../../hooks/useForegroundRefresh';
import {
	buildArchiveTabPath,
	buildCreateGroupChatPath,
	SessionsListToolbar,
	DisplayFilterKindChip
} from './SessionsListToolbar';
import {
	countUnreadSupervisedSessions,
	countUnreadOtherSessions,
	draftMatchesSession,
	isAnonymousAskerSession,
	isDirectLinkSession,
	normalizeSessionToolbarChip,
	sessionMatchesToolbar,
	SessionToolbarChipFilter
} from './sessionToolbarFilters';
import { sessionMatchesAgency, textAxisQuery } from './sessionSearchPeople';
import {
	useCaseHandoverSearch,
	useSearchPeopleResults
} from './useCaseHandoverSearch';
import { useCaseHandoverReasons } from '../caseHandover/useCaseHandoverReasons';
import { useSessionListViewState } from './SessionListViewStateContext';
import type { IUserDraftItem } from '../../api/apiUserDrafts';
import { useRemoteDrafts } from '../../hooks/useRemoteDrafts';
import { toDraftResumePath } from '../../services/draftNavigation';
import {
	canEditGroupChatSettings,
	canModerateGroupChat
} from '../groupChat/groupChatHelpers';
import {
	FutureZone,
	PULL_RELEASE_PX,
	type FutureZoneExtraRow,
	type FutureZoneHandle
} from './timeline/FutureZone';
import { AppointmentSplitButton } from './timeline/AppointmentSplitButton';
import { FUTURE_MONTHS, useFutureEntries } from './timeline/useFutureEntries';
import { useAddonCalendarEntries } from '../../addons/addonCalendar';
import { AddonCalendarPill } from '../../addons/AddonCalendarPill';
import { useAppointmentActions } from './timeline/useAppointmentActions';
import { AppointmentDateDialog } from './timeline/AppointmentDateDialog';
import {
	entriesForList,
	formatEntryDate,
	nextEntryBySession,
	roomKey,
	type FutureEntry,
	type TimelineSession
} from './timeline/timelineModel';
import { useTimelineSettings } from '../../hooks/useTimelineSettings';
import { refetchEnquiryListState } from './refetchEnquiryList';
import { createRefreshThrottle, isRoomInSessions } from './liveListRefresh';
import { countUnreadSessions } from '../../utils/sessionUnread';
import { useUnreadVersion } from '../../hooks/useUnreadVersion';
import { useActiveListItem } from '../../hooks/useActiveListItem';
import { useSessionListRail } from './SessionListRailContext';
import { useCaseHandoverBatch } from './useCaseHandoverBatch';
import { getFormatChipVisibility } from './formatChipVisibility';
import { useCounsellorAgencyFormats } from '../../hooks/useCounsellorAgencyFormats';
import { useResponsive } from '../../hooks/useResponsive';
import { useDisplayFilter } from '../../hooks/useDisplayFilter';
import {
	DisplayFilterDialog,
	DisplayFilterKindOption,
	isDisplayFilterCustomised,
	useDisplayFilterEmailColumn,
	useDisplayFilterBrowserUnavailable,
	useDisplayFilterBrowserMuted,
	useDisplayFilterLabels,
	visiblePillKinds,
	reconcileActiveKind,
	listedKinds,
	resolveKindAvailability,
	resolveChipPresentation,
	kindsUnderOther,
	matchesOtherChip,
	OTHER_KIND_ID,
	SESSION_COLUMNS,
	kindPillMode,
	resolveKindSetting
} from '../displayFilter';
import { sessionKindRegistry } from '../../utils/displayFilter/sessionKindRegistry';
import { NavChatsIcon, NavInboxIcon } from '../app/navigationSidebarIcons';
import { M3Snackbar } from '../m3Snackbar/M3Snackbar';
import {
	applyRequestsFilter,
	applySessionsFilter,
	classifyRequest,
	classifySession,
	REQUEST_KIND_ORDER,
	SESSION_KIND_CHIP,
	PILL_ONLY_SESSION_KINDS,
	SESSION_KIND_ORDER,
	SessionKindId,
	sessionPairId
} from '../../utils/displayFilter/sessions';
import { isChatItemUnread, isRoomUnread } from '../../utils/sessionUnread';
import {
	SESSION_KIND_ICONS,
	sessionKindLabel
} from '../displayFilter/kindOptions';
import { NOTIFICATION_SETTINGS_PATH } from '../profile/notificationSettingsPath';
import {
	apiGetDeletedAskerSessions,
	type DeletedAskerSession
} from '../../api/apiGetDeletedAskerSessions';
import { DeletedAskerListItem } from './DeletedAskerListItem';
import {
	buildDeletedAskerRows,
	placeDeletedAskerRows
} from './deletedAskerRows';

/** Keep paging while the display filter hides rows and fewer than this are visible (§5.2). */
const MIN_VISIBLE_SESSION_ROWS = 10;

const SESSIONS_DISPLAY_FILTER_DIALOG_ID = 'sessions-display-filter-dialog';

const normalizeTimestamp = (value?: string | number | null): number => {
	if (value === null || value === undefined || value === '') {
		return 0;
	}

	if (typeof value === 'number') {
		return value > 1_000_000_000_000 ? value : value * 1000;
	}

	const numericValue = Number(value);
	if (!Number.isNaN(numericValue)) {
		return numericValue > 1_000_000_000_000
			? numericValue
			: numericValue * 1000;
	}

	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
};

const liveChatArrivalTime = (createDate?: string): number => {
	if (!createDate) return Number.POSITIVE_INFINITY;
	// Some API responses omit the UTC suffix on a server timestamp.
	const withoutTimezone =
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(createDate);
	const arrival = Date.parse(withoutTimezone ? `${createDate}Z` : createDate);
	return Number.isFinite(arrival) ? arrival : Number.POSITIVE_INFINITY;
};

const formatDraftTime = (timestamp?: string | null) => {
	const time = normalizeTimestamp(timestamp);
	if (!time) {
		return '';
	}
	const diffMin = Math.max(0, Math.floor((Date.now() - time) / 60000));
	if (diffMin < 1) return 'now';
	if (diffMin < 60) return `${diffMin}m`;
	const diffHours = Math.floor(diffMin / 60);
	if (diffHours < 24) return `${diffHours}h`;
	return `${Math.floor(diffHours / 24)}d`;
};

const DraftMetadataListItem = ({
	draft,
	onOpen,
	translate
}: {
	draft: IUserDraftItem;
	onOpen: (draft: IUserDraftItem) => void;
	translate: (key: string) => string;
}) => (
	// A plain wrapper: the row is a button, which cannot be the list item (#1338).
	<div role="listitem">
		<button
			type="button"
			className="sessionsListDraftItem"
			data-cy="sessions-list-draft-item"
			onClick={() => onOpen(draft)}
			disabled={!draft.actionPath}
		>
			<span className="sessionsListDraftItem__tag">
				{translate('sessionList.toolbar.chips.drafts')}
			</span>
			<span className="sessionsListDraftItem__title">
				{draft.title || translate('drafts.center.untitledChat')}
			</span>
			<span className="sessionsListDraftItem__meta">
				{formatDraftTime(draft.updatedAt)}
			</span>
			<span className="sessionsListDraftItem__hint">
				{translate('sessionList.toolbar.draftMetadataOnly')}
			</span>
		</button>
	</div>
);

interface SessionsListProps {
	defaultLanguage: string;
	sessionTypes: SESSION_TYPES;
	scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export const SessionsList = ({
	defaultLanguage,
	sessionTypes,
	scrollContainerRef
}: SessionsListProps) => {
	const { t: translate } = useTranslation();
	const isRail = useSessionListRail();

	const { groupId: groupIdFromParam, sessionId: sessionIdFromParam } =
		useParams<{ groupId: string; sessionId: string }>();
	const { isActive } = useActiveListItem();
	const navigate = useNavigate();
	const location = useLocation();

	const initialId = useUpdatingRef(groupIdFromParam || sessionIdFromParam);
	const hasAutoOpenedRef = useRef(false);

	const internalListRef = useRef<HTMLDivElement | null>(null);
	const listRef = scrollContainerRef ?? internalListRef;

	const {
		sessions,
		dispatch,
		ready: sessionsReady
	} = useContext(SessionsDataContext);
	const { type, path: listPath } = useContext(SessionTypeContext);
	const { setSessionListViewState } = useSessionListViewState();

	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');

	// Unread axis (#1147): re-render when Matrix notification counts or read
	// receipts change so the toolbar filter/counter and list items update.
	const unreadVersion = useUnreadVersion();

	const { userData } = useContext(UserDataContext);
	const tenantData = useTenant();
	const { agencies: agencyFormats, isLoading: agencyFormatsLoading } =
		useCounsellorAgencyFormats(
			!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)
		);

	const [isLoading, setIsLoading] = useState(true);
	const [currentOffset, setCurrentOffset] = useState(0);
	const [totalItems, setTotalItems] = useState(0);
	const hasMoreSessionPages = totalItems > currentOffset + SESSION_COUNT;
	const [isReloadButtonVisible, setIsReloadButtonVisible] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const abortController = useRef<AbortController>(null);
	const enquiryRefresh = useRef<{
		controller: AbortController;
		promise: Promise<void>;
		pending: boolean;
	}>(null);
	const latestEnquiryRefresh = useRef<() => Promise<void>>(() =>
		Promise.resolve()
	);
	const [sessionToolbarSearch, setSessionToolbarSearch] = useState('');
	const [sessionToolbarSearchOpen, setSessionToolbarSearchOpen] =
		useState(false);
	const [sessionToolbarSelectedTopic, setSessionToolbarSelectedTopic] =
		useState<string | null>(null);
	const [sessionToolbarSelectedAgency, setSessionToolbarSelectedAgency] =
		useState<string | null>(null);
	const [filteredOutNoticeDismissed, setFilteredOutNoticeDismissed] =
		useState(false);
	const [caseHandoverBatchMode, setCaseHandoverBatchMode] = useState(false);
	const [caseHandoverReviewOpen, setCaseHandoverReviewOpen] = useState(false);
	const [caseHandoverWizardStep, setCaseHandoverWizardStep] = useState<
		'reason' | 'describe'
	>('reason');
	const [caseHandoverSelectedIds, setCaseHandoverSelectedIds] = useState<
		number[]
	>([]);
	const [caseHandoverReasonCode, setCaseHandoverReasonCode] = useState('');
	const [caseHandoverExplanation, setCaseHandoverExplanation] = useState('');
	const [caseHandoverBatchSummary, setCaseHandoverBatchSummary] =
		useState('');
	const caseHandoverBatch = useCaseHandoverBatch({
		actorId: userData.userId
	});
	/**
	 * Initial chip selection:
	 *   - enquiry list: honour ?chip=liveChat in the URL (sidebar toggle
	 *     deep-link), otherwise default to 'nearby' so the tab opens on the
	 *     registered enquiries feed
	 *   - my-session list: no default chip
	 */
	const readChipFromUrl = (): SessionToolbarChipFilter | null => {
		try {
			const params = new URLSearchParams(location.search);
			return normalizeSessionToolbarChip(params.get('chip'));
		} catch {
			/* ignore */
		}
		return null;
	};

	const [sessionToolbarChip, setSessionToolbarChip] =
		useState<SessionToolbarChipFilter | null>(() => {
			if (type !== SESSION_LIST_TYPES.ENQUIRY) return readChipFromUrl();
			return readChipFromUrl() ?? 'nearby';
		});
	/*
	 * Ref-mirror of the toolbar chip so the memoised `getConsultantSessionList`
	 * can read the current filter without taking a dep (and restarting the
	 * fetch whenever the user swaps tabs). Used to auto-page past all-anonymous
	 * first pages when Nearby is selected, and vice versa.
	 */
	const sessionToolbarChipRef = useRef<SessionToolbarChipFilter | null>(
		sessionToolbarChip
	);
	const skipChipRefetchRef = useRef(true);
	useEffect(() => {
		sessionToolbarChipRef.current = sessionToolbarChip;
	}, [sessionToolbarChip]);

	/**
	 * Keep the chip in sync with `?chip=…` changes after mount — this fires
	 * when the sidebar livechat toggle deep-links to the enquiry tab while
	 * we're already on it.
	 */
	useEffect(() => {
		if (
			type !== SESSION_LIST_TYPES.ENQUIRY &&
			type !== SESSION_LIST_TYPES.MY_SESSION
		) {
			return;
		}
		const fromUrl = readChipFromUrl();
		if (fromUrl && fromUrl !== sessionToolbarChip) {
			setSessionToolbarChip(fromUrl);
		} else if (
			type === SESSION_LIST_TYPES.MY_SESSION &&
			!fromUrl &&
			sessionToolbarChip
		) {
			setSessionToolbarChip(null);
		}
		/* eslint-disable-next-line react-hooks/exhaustive-deps */
	}, [location.search, type]);

	useGroupWatcher(isLoading);

	// If create new group chat
	const isCreateChatActive = groupIdFromParam === 'createGroupChat';

	/**
	 * Live-chat toggle state. When it flips, the enquiry list needs to
	 * refetch so anonymous enquiries appear/disappear without a reload.
	 * The flag is also read inside apiGetConsultantSessionList itself.
	 */
	const [liveChatAvailable] = useLiveChatAvailable(
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
	);
	// #1377 slices 4/5: the user's display filter for this list.
	const displayFilterSection =
		type === SESSION_LIST_TYPES.ENQUIRY ? 'requests' : 'sessions';
	const {
		effective: listDisplayFilter,
		override: listDisplayOverride,
		canWrite: canEditDisplayFilter,
		readOnly: displayFilterReadOnly,
		setSection: setListDisplayOverride,
		resetSection: resetListDisplayOverride
	} = useDisplayFilter(displayFilterSection);
	const displayFilterLabels = useDisplayFilterLabels(displayFilterSection);
	const displayFilterEmail =
		useDisplayFilterEmailColumn(displayFilterSection);
	const displayFilterBrowserUnavailable =
		useDisplayFilterBrowserUnavailable(displayFilterSection);
	const displayFilterBrowserMuted =
		useDisplayFilterBrowserMuted(displayFilterSection);
	// The kind options are built further down (they need the unread counts);
	// the toolbar predicate above them reads the latest list through a ref.
	const [displayFilterOpen, setDisplayFilterOpen] = useState(false);
	const { untilL } = useResponsive();

	const fetchEnquirySessionsWithAutoPage = useCallback(
		(
			offset: number,
			initialID?: string,
			count?: number,
			signal?: AbortSignal
		): Promise<{
			sessions: ListItemInterface[];
			total: number;
			nextOffset: number;
		}> => {
			const pageSize = count ?? SESSION_COUNT;

			const fetchPage = (
				pageOffset: number
			): Promise<{
				sessions: ListItemInterface[];
				total: number;
				nextOffset: number;
			}> =>
				apiGetConsultantSessionList({
					type,
					offset: pageOffset,
					sessionListTab,
					count: pageSize,
					signal
				}).then(({ sessions, total }) => {
					if (initialID) {
						if (
							getExtendedSession(initialID, sessions) ||
							total <= pageOffset + pageSize
						) {
							return {
								sessions,
								total,
								nextOffset: pageOffset + pageSize
							};
						}

						return fetchPage(pageOffset + pageSize).then(
							({
								sessions: moreSessions,
								total: nextTotal,
								nextOffset
							}) => ({
								sessions: [...sessions, ...moreSessions],
								total: nextTotal,
								nextOffset
							})
						);
					}

					if (
						type !== SESSION_LIST_TYPES.ENQUIRY ||
						sessions.length === 0 ||
						total <= pageOffset + pageSize
					) {
						return {
							sessions,
							total,
							nextOffset: pageOffset + pageSize
						};
					}

					const chip = sessionToolbarChipRef.current;
					if (chip !== 'nearby' && chip !== 'liveChat') {
						return {
							sessions,
							total,
							nextOffset: pageOffset + pageSize
						};
					}

					const anyMatch = sessions.some((raw) => {
						const isAnon = isAnonymousAskerSession(
							raw,
							{} as ExtendedSessionInterface
						);
						return chip === 'liveChat' ? isAnon : !isAnon;
					});
					if (
						anyMatch ||
						pageOffset + pageSize >= 10 * SESSION_COUNT
					) {
						return {
							sessions,
							total,
							nextOffset: pageOffset + pageSize
						};
					}

					return fetchPage(pageOffset + pageSize).then(
						({
							sessions: moreSessions,
							total: nextTotal,
							nextOffset
						}) => ({
							sessions: [...sessions, ...moreSessions],
							total: nextTotal,
							nextOffset
						})
					);
				});

			return fetchPage(offset);
		},
		[sessionListTab, type]
	);

	const getConsultantSessionList = useCallback(
		(
			offset: number,
			initialID?: string,
			count?: number
		): Promise<{ sessions: ListItemInterface[]; total: number }> => {
			setIsRequestInProgress(true);

			if (abortController.current) {
				abortController.current.abort();
			}

			const controller = new AbortController();
			abortController.current = controller;

			return fetchEnquirySessionsWithAutoPage(
				offset,
				initialID,
				count,
				controller.signal
			)
				.then(({ sessions, total, nextOffset }) => {
					// A superseded transport may still resolve after abort. Do not
					// let its pagination state or rows reach the caller.
					if (
						controller.signal.aborted ||
						abortController.current !== controller
					) {
						throw new Error(FETCH_ERRORS.ABORT);
					}
					const lastLoadedOffset = Math.max(
						0,
						nextOffset - SESSION_COUNT
					);
					setCurrentOffset(lastLoadedOffset);
					setTotalItems(total);
					return { sessions, total };
				})
				.catch((error) => {
					// Replaced requests no longer own the caller's error UI either.
					if (
						controller.signal.aborted ||
						abortController.current !== controller
					) {
						throw new Error(FETCH_ERRORS.ABORT);
					}
					throw error;
				})
				.finally(() => {
					if (abortController.current === controller) {
						setIsRequestInProgress(false);
					}
				});
		},
		[fetchEnquirySessionsWithAutoPage]
	);

	const refetchEnquiryList = useCallback(() => {
		if (type !== SESSION_LIST_TYPES.ENQUIRY) {
			return Promise.resolve();
		}

		const running = enquiryRefresh.current;
		if (
			running &&
			running.controller === abortController.current &&
			!running.controller.signal.aborted
		) {
			// Preserve a newer invalidation without cancelling a slow response.
			running.pending = true;
			return running.promise;
		}
		setIsRequestInProgress(true);
		abortController.current?.abort();
		const controller = new AbortController();
		abortController.current = controller;
		const request = {
			controller,
			promise: Promise.resolve(),
			pending: false
		};
		enquiryRefresh.current = request;
		request.promise = refetchEnquiryListState({
			signal: controller.signal,
			fetchPage: () =>
				fetchEnquirySessionsWithAutoPage(
					0,
					undefined,
					currentOffset + SESSION_COUNT,
					controller.signal
				),
			pageSize: SESSION_COUNT,
			replaceSessions: (sessions) => {
				dispatch({
					type: SET_SESSIONS,
					ready: true,
					sessions
				});
			},
			setTotalItems,
			setCurrentOffset
		}).finally(() => {
			if (enquiryRefresh.current === request)
				enquiryRefresh.current = null;
			// A live refresh takes ownership from pending pagination, including
			// its loading indicator. Older completions cannot unlock a newer request.
			if (abortController.current === controller) {
				setIsRequestInProgress(false);
				setIsLoading(false);
				if (request.pending && !controller.signal.aborted) {
					void latestEnquiryRefresh.current();
				}
			}
		});
		return request.promise;
	}, [currentOffset, dispatch, fetchEnquirySessionsWithAutoPage, type]);
	useEffect(() => {
		latestEnquiryRefresh.current = refetchEnquiryList;
	}, [refetchEnquiryList]);

	const refetchSessionList = useCallback(() => {
		if (type !== SESSION_LIST_TYPES.MY_SESSION) {
			return Promise.resolve();
		}

		// An asker's list comes from the asker endpoint; the counsellor one
		// answers 403, so every live refresh used to be a silent no-op and a
		// list that loaded empty right after registration stayed on
		// "keine aktiven Beratungen" until a reload (OBP 2.1 #3).
		if (hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)) {
			// `fresh`: a request still running from the first load was asked
			// before this signal and must not answer it.
			return apiGetAskerSessionList({ fresh: true }).then((response) => {
				// The asker request resolves a failure to an empty list, so an
				// empty answer may be an error: merge, never wipe loaded rows.
				// Removals arrive as their own REMOVE_SESSIONS events.
				const sessions = response?.sessions ?? [];
				if (sessions.length > 0) {
					dispatch({
						type: UPDATE_SESSIONS,
						ready: true,
						sessions
					});
				}
			});
		}

		const request = getConsultantSessionList(0);
		// The refresh now owns the list request. The request it replaced (the
		// first page, a chip switch or "load more") may not clear the loading
		// card any more, so this one must, or a skeleton stays below the rows
		// as an empty "ghost chat" (#2136).
		const controller = abortController.current;
		return request
			.then(({ sessions, total }) => {
				dispatch({
					type: SET_SESSIONS,
					ready: true,
					sessions
				});
				setTotalItems(total);
				setCurrentOffset(0);
			})
			.catch(() => {})
			.finally(() => {
				if (
					abortController.current === controller &&
					!controller.signal.aborted
				) {
					setIsLoading(false);
				}
			});
	}, [dispatch, getConsultantSessionList, type, userData]);

	/*
	 * Re-run the enquiry fetch when switching Nearby ↔ Live Chat so auto-paging
	 * scans for the right session type instead of only re-filtering stale pages.
	 * The same applies when the tab is cleared (all kinds): the page that was
	 * auto-paged for one type is not a complete first page for both.
	 */
	useEffect(() => {
		if (type !== SESSION_LIST_TYPES.ENQUIRY) {
			return;
		}
		if (
			sessionToolbarChip !== 'liveChat' &&
			sessionToolbarChip !== 'nearby' &&
			sessionToolbarChip !== null
		) {
			return;
		}
		if (skipChipRefetchRef.current) {
			skipChipRefetchRef.current = false;
			return;
		}

		setIsLoading(true);
		const request = getConsultantSessionList(0);
		const controller = abortController.current;
		request
			.then(({ sessions }) => {
				dispatch({
					type: SET_SESSIONS,
					ready: true,
					sessions
				});
			})
			.catch(() => {})
			.finally(() => {
				if (
					abortController.current === controller &&
					!controller.signal.aborted
				) {
					setIsLoading(false);
				}
			});
	}, [dispatch, getConsultantSessionList, sessionToolbarChip, type]);

	const scrollIntoView = useCallback(() => {
		const activeItem = document.querySelector('.sessionsListItem--active');
		if (activeItem) {
			activeItem.scrollIntoView(true);
			const wrapper = listRef.current;
			if (!wrapper) {
				return;
			}
			const firstItemId = document.querySelector('.sessionsListItem')
				? document
						.querySelector('.sessionsListItem')
						.getAttribute('data-group-id')
				: null;
			const lastItemId =
				wrapper.lastElementChild &&
				wrapper.lastElementChild.querySelector('.sessionsListItem')
					? wrapper.lastElementChild
							.querySelector('.sessionsListItem')
							.getAttribute('data-group-id')
					: null;
			if (
				initialId.current !== firstItemId &&
				initialId.current !== lastItemId
			) {
				wrapper.scrollTop -= 48;
			}
		}
	}, [initialId, listRef]);

	const refreshLoadedSessionsWithRoomState = useCallback(
		(loadedSessions: ListItemInterface[]) => {
			const rids = (loadedSessions || [])
				.map(
					(session) =>
						session?.chat?.matrixRoomId ||
						session?.session?.matrixRoomId
				)
				.filter(Boolean) as string[];

			if (!rids.length) {
				return Promise.resolve();
			}

			return apiGetSessionRoomsByRoomIds(rids)
				.then(({ sessions }) => {
					if (!sessions?.length) {
						return;
					}

					dispatch({
						type: UPDATE_SESSIONS,
						sessions
					});
				})
				.catch(() => {
					// keep list rendering stable if room-state refresh fails
				});
		},
		[dispatch]
	);

	// Initially load first sessions
	useEffect(() => {
		setIsLoading(true);
		setIsReloadButtonVisible(false);
		setCurrentOffset(0);
		if (hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)) {
			// Fetch asker data
			apiGetAskerSessionList()
				.then(({ sessions }) => {
					dispatch({
						type: SET_SESSIONS,
						ready: true,
						sessions
					});
					// Auto-open session if there's only one session AND we haven't already auto-opened
					// Only auto-open if we're on the base list page (not already viewing a session)
					const currentPath = location.pathname;
					// Use listPath from context, fallback to hardcoded path for askers
					const baseListPath = listPath || '/sessions/user/view';
					// Check if we're on the base list page (exact match or with trailing slash)
					const isOnBaseListPage =
						currentPath === baseListPath ||
						currentPath === `${baseListPath}/` ||
						currentPath === '/sessions/user/view' ||
						currentPath === '/sessions/user/view/';

					// Use sessionStorage to persist across remounts - but clear it if we're on the base page
					// This allows re-triggering if user navigates back to list
					const firstSession = sessions?.[0];
					const sessionId = firstSession?.session?.id;
					const autoOpenKey = `autoOpenedSession_${sessionId || ''}`;

					// Clear sessionStorage flag if we're back on the base list page (user navigated back)
					if (isOnBaseListPage) {
						sessionStorage.removeItem(autoOpenKey);
					}

					const hasAutoOpened =
						sessionStorage.getItem(autoOpenKey) === 'true';

					// console.log('🔍 Auto-open check:', {
					// sessionsCount: sessions?.length,
					// currentPath,
					// listPath,
					// baseListPath,
					// isOnBaseListPage,
					// hasAutoOpened,
					// hasAutoOpenedRef: hasAutoOpenedRef.current,
					// firstSession,
					// sessionId,
					// sessionStructure: firstSession ? Object.keys(firstSession) : null
					// });

					if (
						sessions?.length === 1 &&
						!hasAutoOpened &&
						!hasAutoOpenedRef.current &&
						isOnBaseListPage
					) {
						const session = sessions[0];
						const sessionId = session?.session?.id;
						const isEmptyEnquiry =
							session?.session?.status === STATUS_EMPTY;

						// console.log('✅ Auto-opening session:', {
						// sessionId,
						// groupId,
						// isEmptyEnquiry,
						// sessionStatus: session?.session?.status,
						// fullSession: session
						// });

						if (sessionId !== undefined) {
							// Mark as auto-opened IMMEDIATELY in both ref and sessionStorage
							hasAutoOpenedRef.current = true;
							sessionStorage.setItem(autoOpenKey, 'true');

							if (isEmptyEnquiry) {
								// Empty enquiry: go to write view
								const targetPath = `${baseListPath}/write/${sessionId}`;
								// console.log('🚀 Navigating to write view:', targetPath);
								navigate(targetPath);
							} else {
								const targetPath = `${baseListPath}/session/${sessionId}`;
								navigate(targetPath);
							}
						}
					}
				})
				.then(() => {
					setIsLoading(false);
				});
		} else {
			// Fetch consulting sessionsData
			// console.log('🔍 CONSULTANT: Fetching sessions, type:', type);
			const request = getConsultantSessionList(0, initialId.current);
			const controller = abortController.current;
			request
				.then(({ sessions }) => {
					// console.log('📦 CONSULTANT: Got', sessions?.length, 'sessions');
					dispatch({
						type: UPDATE_SESSIONS,
						ready: true,
						sessions
					});
					return refreshLoadedSessionsWithRoomState(sessions);
				})
				.then(() => {
					if (
						abortController.current !== controller ||
						controller.signal.aborted
					) {
						return;
					}
					setIsLoading(false);
					if (initialId.current) {
						setTimeout(() => {
							scrollIntoView();
						});
					}
				})
				.catch((error) => {
					if (
						abortController.current !== controller ||
						controller.signal.aborted ||
						error.message === FETCH_ERRORS.ABORT
					) {
						// No action necessary. Just make sure to NOT set
						// `isLoading` to false or `isReloadButtonVisible` to true.
						return;
					}

					setIsLoading(false);
					if (error.message === FETCH_ERRORS.EMPTY) {
						return;
					} else {
						setIsReloadButtonVisible(true);
					}
				});
		}

		return () => {
			if (abortController.current) {
				abortController.current.abort();
				abortController.current = null;
			}

			dispatch({
				type: SET_SESSIONS,
				sessions: [],
				ready: false
			});
		};
		/* eslint-disable */
	}, [
		dispatch,
		getConsultantSessionList,
		initialId,
		refreshLoadedSessionsWithRoomState,
		scrollIntoView,
		userData
	]);
	/* eslint-enable */

	const handleRIDs = useCallback(
		(rids: string[]) => {
			const loadedSessions = sessions;
			/*
			Always try to get each subscription from the backend because closed
			group chats still listed as sessions but no longer backed by a room
			 */
			Promise.all(
				rids.map((rid) => {
					// Get session from api
					return apiGetSessionRoomsByRoomIds([rid])
						.then(({ sessions }) => {
							const session = sessions[0];

							if (!session) {
								const loadedSession = loadedSessions.find(
									(s) => s?.chat?.matrixRoomId === rid
								);
								// If repetitive group chat reload it by id because groupId has changed
								if (
									loadedSession &&
									getModality(loadedSession) ===
										Modality.SELF_HELP
								) {
									return ['reload', loadedSession.chat.id];
								}
								return ['removed', rid];
							}

							const sessionType = getSessionType(
								session,
								userData.userId
							);

							// If subscription session type has changed add it to remove list for current view
							if (
								sessionTypes.indexOf(sessionType) < 0 ||
								(sessionType === SESSION_TYPE_ARCHIVED &&
									sessionListTab !==
										SESSION_LIST_TAB_ARCHIVE) ||
								(sessionType !== SESSION_TYPE_ARCHIVED &&
									sessionListTab === SESSION_LIST_TAB_ARCHIVE)
							) {
								return ['removed', rid];
							}

							return ['insert', session];
						})
						.catch(() => {
							const loadedSession = loadedSessions.find(
								(s) => s?.chat?.matrixRoomId === rid
							);
							// If repetitive group chat reload it by id because groupId has changed
							if (
								loadedSession &&
								getModality(loadedSession) ===
									Modality.SELF_HELP
							) {
								return ['reload', loadedSession.chat.id];
							}
							return ['removed', rid];
						});
				})
			).then((sessions) => {
				const updatedSessions = sessions
					.filter(([event]) => event === 'insert')
					.map(([, s]) => s);

				if (updatedSessions.length > 0) {
					dispatch({
						type: UPDATE_SESSIONS,
						sessions: updatedSessions as ListItemInterface[]
					});
				}

				const removedSessions = sessions
					.filter(([event]) => event === 'removed')
					.map(([, rid]) => rid);

				if (removedSessions.length > 0) {
					dispatch({
						type: REMOVE_SESSIONS,
						ids: removedSessions as string[]
					});
				}

				const reloadedSessions = sessions
					.filter(([event]) => event === 'reload')
					.map(([, id]) => id as number);

				if (reloadedSessions.length > 0) {
					Promise.all(
						reloadedSessions.map((id) => apiGetChatRoomById(id))
					).then((sessions) => {
						dispatch({
							type: UPDATE_SESSIONS,
							sessions: sessions.reduce<ListItemInterface[]>(
								(acc, { sessions }) => acc.concat(sessions),
								[]
							)
						});
					});
				}
			});
		},
		[dispatch, sessionListTab, sessionTypes, sessions, userData.userId]
	);

	const handleRIDsRef = useUpdatingRef(handleRIDs);
	const sessionsRef = useUpdatingRef(sessions);

	// #1206: one refetch per burst of messages from rooms this list does not know.
	const unknownRoomThrottle = useRef(createRefreshThrottle());

	const touchSessionsByRids = useCallback(
		(ridsWithTimestamp: Array<{ rid: string; timestamp: number }>) => {
			if (!ridsWithTimestamp.length) {
				return;
			}

			const touchedSessions = ridsWithTimestamp
				.map(({ rid, timestamp }) => {
					const existingSession = sessions.find(
						(s) =>
							s?.chat?.matrixRoomId === rid ||
							s?.session?.matrixRoomId === rid
					);
					if (!existingSession) {
						return null;
					}

					const timestampSeconds = Math.floor(timestamp / 1000);
					if (existingSession.chat) {
						return {
							...existingSession,
							chat: {
								...existingSession.chat,
								messageDate: timestampSeconds
							}
						};
					}

					if (existingSession.session) {
						return {
							...existingSession,
							session: {
								...existingSession.session,
								messageDate: timestampSeconds
							}
						};
					}

					return null;
				})
				.filter(Boolean) as ListItemInterface[];

			if (touchedSessions.length > 0) {
				dispatch({
					type: UPDATE_SESSIONS,
					sessions: touchedSessions
				});
			}
		},
		[dispatch, sessions]
	);

	useEffect(() => {
		const onNewMessageEvent = ({
			roomId,
			timestamp,
			refreshEnquiryList,
			refreshSessionList,
			sessionId
		}: {
			roomId?: string;
			timestamp?: number;
			refreshEnquiryList?: boolean;
			refreshSessionList?: boolean;
			sessionId?: number;
		}) => {
			if (sessionId) {
				dispatch({
					type: REMOVE_SESSIONS,
					ids: [sessionId]
				});
			}

			if (refreshEnquiryList && type === SESSION_LIST_TYPES.ENQUIRY) {
				void refetchEnquiryList();
			}

			if (refreshSessionList && type === SESSION_LIST_TYPES.MY_SESSION) {
				void refetchSessionList();
			}

			if (refreshEnquiryList || refreshSessionList) {
				return;
			}

			if (!roomId) {
				return;
			}

			// #1206: `touchSessionsByRids` can only update a session this list
			// already holds — it drops an unknown room. A message from a room
			// the list has never loaded is exactly the new enquiry (or the
			// session that just became a chat) the counsellor had to hard-
			// refresh for, so refetch instead of touching nothing. Throttled so
			// a burst from the same new room causes one refetch, not ten.
			if (!isRoomInSessions(sessionsRef.current, roomId)) {
				if (unknownRoomThrottle.current.shouldRefresh()) {
					void (type === SESSION_LIST_TYPES.ENQUIRY
						? refetchEnquiryList()
						: refetchSessionList());
				}
				return;
			}

			touchSessionsByRids([
				{
					rid: roomId,
					timestamp: timestamp || Date.now()
				}
			]);

			// Refresh the backend room state (lastMessage / messageDate) for
			// the touched session. Unread state is NOT part of this refetch:
			// it is derived client-side from the Matrix room (#1147).
			const touchesLoadedSession = sessionsRef.current.some(
				(s) =>
					s?.chat?.matrixRoomId === roomId ||
					s?.session?.matrixRoomId === roomId
			);
			if (touchesLoadedSession) {
				handleRIDsRef.current([roomId]);
			}
		};

		messageEventEmitter.on(onNewMessageEvent);
		return () => {
			messageEventEmitter.off(onNewMessageEvent);
		};
	}, [
		dispatch,
		handleRIDsRef,
		refetchEnquiryList,
		refetchSessionList,
		sessionsRef,
		touchSessionsByRids,
		type
	]);

	// Live events accelerate this bounded fallback; neither depends on alert settings.
	useForegroundRefresh(
		type === SESSION_LIST_TYPES.ENQUIRY,
		refetchEnquiryList
	);

	const loadMoreSessions = useCallback(() => {
		setIsLoading(true);
		getConsultantSessionList(currentOffset + SESSION_COUNT)
			.then(({ sessions }) => {
				dispatch({
					type: UPDATE_SESSIONS,
					ready: true,
					sessions
				});
				return refreshLoadedSessionsWithRoomState(sessions);
			})
			.then(() => {
				setIsLoading(false);
			})
			.catch((error) => {
				if (error.message === FETCH_ERRORS.ABORT) {
					// No action necessary. Just make sure to NOT set
					// `isLoading` to false or `isReloadButtonVisible` to true.
					return;
				}

				setIsLoading(false);
				setIsReloadButtonVisible(true);
			});
	}, [
		currentOffset,
		dispatch,
		getConsultantSessionList,
		refreshLoadedSessionsWithRoomState
	]);

	const handleListScroll = useCallback(() => {
		const list: any = listRef.current;
		if (!list) return;
		const scrollPosition = Math.ceil(list.scrollTop) + list.offsetHeight;
		if (scrollPosition + SCROLL_PAGINATE_THRESHOLD >= list.scrollHeight) {
			if (
				totalItems > currentOffset + SESSION_COUNT &&
				!isReloadButtonVisible &&
				!isRequestInProgress
			) {
				loadMoreSessions();
			}
		}
	}, [
		currentOffset,
		isReloadButtonVisible,
		isRequestInProgress,
		listRef,
		loadMoreSessions,
		totalItems
	]);

	const handleReloadButton = useCallback(() => {
		setIsReloadButtonVisible(false);
		loadMoreSessions();
	}, [loadMoreSessions]);

	const showConsultantToolbarActions =
		type === SESSION_LIST_TYPES.MY_SESSION &&
		!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData);
	// One source with the create flow: the list must not offer a filter, or an
	// entry point, for a format this Träger — or every one of the counsellor's
	// Beratungsstellen — has switched off.
	const {
		createGroupChat: showCreateGroupChatAction,
		groups: showGroupChip,
		internalGroup: showInternalGroupChip
	} = getFormatChipVisibility(
		tenantData,
		showConsultantToolbarActions && !agencyFormatsLoading,
		agencyFormats
	);
	const showCaseHandoverBatchUi =
		showConsultantToolbarActions &&
		sessionListTab !== SESSION_LIST_TAB_ARCHIVE;

	const showMySessionToolbar =
		type === SESSION_LIST_TYPES.MY_SESSION ||
		type === SESSION_LIST_TYPES.ENQUIRY;
	const visibleUserDrafts = useRemoteDrafts(showMySessionToolbar);
	const caseHandoverSearch = useCaseHandoverSearch({
		enabled: showConsultantToolbarActions,
		query: sessionToolbarSearch,
		archived: sessionListTab === SESSION_LIST_TAB_ARCHIVE,
		keepFound: caseHandoverBatchMode,
		searchOpen: sessionToolbarSearchOpen
	});
	const sessionToolbarSelectedPeople = caseHandoverSearch.selectedPersonIds;
	const caseHandoverReasons = useCaseHandoverReasons(caseHandoverBatchMode);
	// A chosen reason that is no longer offered is dropped.
	const { reasons: loadedReasons, loaded: reasonsLoaded } =
		caseHandoverReasons;
	useEffect(() => {
		if (!reasonsLoaded) return;
		setCaseHandoverReasonCode((current) =>
			loadedReasons.some((item) => item.code === current) ? current : ''
		);
	}, [loadedReasons, reasonsLoaded]);

	const handleOpenDraft = useCallback(
		(draft: IUserDraftItem) => {
			const path = toDraftResumePath(draft);
			if (path) navigate(path);
		},
		[navigate]
	);
	const translateKey = useCallback(
		(key: string) => {
			const translated = translate(key);
			return typeof translated === 'string'
				? translated
				: String(translated);
		},
		[translate]
	);

	const handleToolbarChipToggle = useCallback(
		(chip: SessionToolbarChipFilter) => {
			const nextChip = sessionToolbarChip === chip ? null : chip;
			setSessionToolbarChip(nextChip);

			const baseListPath = listPath || '/sessions/consultant/sessionView';
			const params = new URLSearchParams(location.search);
			params.delete('sessionListTab');
			if (nextChip) {
				params.set('chip', nextChip);
			} else {
				params.delete('chip');
			}
			const search = params.toString() ? `?${params.toString()}` : '';

			/* Route-driven chips (+ / archive) stay “selected” until URL changes.
			   Leaving create-group-chat when using a filter avoids + staying dark. */
			if (groupIdFromParam === 'createGroupChat') {
				navigate({ pathname: baseListPath, search });
				return;
			}

			/* Selecting a filter implies main list: drop archive tab so archive chip matches. */
			if (location.search !== search) {
				navigate(
					{ pathname: location.pathname, search },
					{ replace: true }
				);
			}
		},
		[
			groupIdFromParam,
			navigate,
			listPath,
			location.pathname,
			location.search,
			sessionToolbarChip
		]
	);

	const normalizeTimestamp = useCallback(
		(value?: string | number): number => {
			if (value === null || value === undefined || value === '') {
				return 0;
			}

			if (typeof value === 'number') {
				return value > 1_000_000_000_000 ? value : value * 1000;
			}

			const numericValue = Number(value);
			if (!Number.isNaN(numericValue)) {
				return numericValue > 1_000_000_000_000
					? numericValue
					: numericValue * 1000;
			}

			const parsed = Date.parse(value);
			return Number.isNaN(parsed) ? 0 : parsed;
		},
		[]
	);

	const getLastInteractionTimestamp = useCallback(
		(session: ExtendedSessionInterface): number => {
			const item = session?.item;
			if (!item) {
				return 0;
			}

			const matrixRoomId =
				typeof item.matrixRoomId === 'string' &&
				isMatrixRoom(item.matrixRoomId)
					? item.matrixRoomId
					: null;
			const matrixRoom = matrixRoomId
				? matrixLiveEventBridge.getClient()?.getRoom(matrixRoomId)
				: null;
			const matrixLastActiveTimestamp =
				matrixRoom?.getLastActiveTimestamp?.() ||
				matrixRoom
					?.getLiveTimeline?.()
					?.getEvents?.()
					?.slice(-1)?.[0]
					?.getTs?.() ||
				0;

			return Math.max(
				normalizeTimestamp(matrixLastActiveTimestamp),
				normalizeTimestamp(session.latestMessage),
				normalizeTimestamp(item.messageDate),
				normalizeTimestamp(item.messageTime),
				normalizeTimestamp(item.createDate),
				normalizeTimestamp(item.createdAt),
				normalizeTimestamp(item.startDate)
			);
		},
		[normalizeTimestamp]
	);

	const sortSessions = useCallback(
		(
			sessionA: ExtendedSessionInterface,
			sessionB: ExtendedSessionInterface
		) => {
			switch (type) {
				case SESSION_LIST_TYPES.ENQUIRY: {
					if (sessionA.isGroup || sessionB.isGroup) {
						return 0;
					}
					/*
					 * Compare createDate as timestamps — string-compare used to
					 * be fine for ISO-8601 but some backend responses omit the
					 * trailing `Z`, so "2026-04-18T09:00:00" vs
					 * "2026-04-18T09:00:00.123" sorted inconsistently and the
					 * list appeared shuffled until a second render fired.
					 * Missing dates sort to the end (oldest).
					 */
					const tsA = new Date(
						sessionA.item.createDate ?? 0
					).getTime();
					const tsB = new Date(
						sessionB.item.createDate ?? 0
					).getTime();
					if (!Number.isFinite(tsA) && !Number.isFinite(tsB))
						return 0;
					if (!Number.isFinite(tsA)) return 1;
					if (!Number.isFinite(tsB)) return -1;
					return tsB - tsA;
				}
				case SESSION_LIST_TYPES.MY_SESSION:
					return (
						getLastInteractionTimestamp(sessionB) -
						getLastInteractionTimestamp(sessionA)
					);
			}
			return 0;
		},
		[getLastInteractionTimestamp, type]
	);

	const filterSessions = useCallback(
		(session) => {
			// Filter group chats: show if consultant is owner OR participant (subscribed)
			if (session?.chat) {
				// For MY_SESSION type, filter group chats by participation
				if (
					type === SESSION_LIST_TYPES.MY_SESSION &&
					!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)
				) {
					// Check if consultant is the owner
					const isOwner = session?.consultant?.id === userData.userId;

					// Check if consultant is subscribed (participant in the room)
					// subscribed=true means the consultant is a member of the room
					const isParticipant = session?.chat?.subscribed === true;

					// Show if owner OR participant
					return isOwner || isParticipant;
				}
				// For other types or askers, show all chats
				return true;
				// If the user is marked for deletion we should hide the message from the list
			} else if (session?.user?.deleted) {
				return false;
			}

			switch (type) {
				// filter my sessions
				case SESSION_LIST_TYPES.MY_SESSION:
					// For askers, show all their sessions (API already filtered by user)
					// For consultants, API already filters to assigned/supervised sessions
					if (hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)) {
						return true; // Askers see all their own sessions
					}
					return true;
				// only show sessions without an assigned consultant in sessionPreview
				case SESSION_LIST_TYPES.ENQUIRY:
					return !session?.consultant?.id;
				default:
					return true;
			}
		},
		[type, userData]
	);

	const ref_list_array = useRef<any>([]);

	const handleKeyDownLisItemContent = (e, index) => {
		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
		if (sessions.length > 1) {
			switch (e.key) {
				case 'ArrowUp':
					if (index === 0) {
						break;
					} else {
						let indexOffset = 1;
						while (!ref_list_array.current[index - indexOffset]) {
							indexOffset++;
						}
						ref_list_array.current[index - indexOffset].focus();
						ref_list_array.current[index].setAttribute(
							'tabindex',
							'-1'
						);
						ref_list_array.current[
							index - indexOffset
						].setAttribute('tabindex', '0');
					}
					break;
				case 'ArrowDown':
					if (index === ref_list_array.current.length - 1) {
						break;
					} else {
						let indexOffset = 1;
						while (!ref_list_array.current[index + indexOffset]) {
							indexOffset++;
						}
						ref_list_array.current[index + indexOffset].focus();
						ref_list_array.current[index].setAttribute(
							'tabindex',
							'-1'
						);
						ref_list_array.current[
							index + indexOffset
						].setAttribute('tabindex', '0');
					}
					break;
			}
		}
	};
	const { candidateSessions } = caseHandoverSearch;
	const finalSessionsList = React.useMemo(() => {
		const baseSessions = (sessions || []).filter(filterSessions);
		if (candidateSessions.length === 0) {
			return baseSessions;
		}

		const baseSessionIds = new Set(
			baseSessions
				.map((session) => session.session?.id || session.chat?.id)
				.filter(Boolean)
				.map(String)
		);
		const candidates = candidateSessions
			.filter(filterSessions)
			.filter((session) => {
				const id = session.session?.id || session.chat?.id;
				return id !== undefined && !baseSessionIds.has(String(id));
			});

		return [...candidates, ...baseSessions];
	}, [candidateSessions, filterSessions, sessions]);
	const sessionToolbarPairs = React.useMemo(
		() =>
			finalSessionsList.map((raw) => ({
				raw,
				extended: buildExtendedSession(raw, groupIdFromParam)
			})),
		[finalSessionsList, groupIdFromParam]
	);
	const toolbarSearchTopicResults = React.useMemo(() => {
		const byId = new Map<string, { id: string; label: string }>();
		sessionToolbarPairs.forEach(({ raw, extended }) => {
			// Topics follow the chosen counselling centre (FE#1725 US13).
			if (!sessionMatchesAgency(raw, sessionToolbarSelectedAgency)) {
				return;
			}
			const topic = extended?.item?.topic as TopicSessionInterface | null;
			if (topic?.id !== undefined && topic?.name) {
				byId.set(String(topic.id), {
					id: String(topic.id),
					label: topic.name
				});
			}
		});
		return Array.from(byId.values()).sort((a, b) =>
			a.label.localeCompare(b.label)
		);
	}, [sessionToolbarPairs, sessionToolbarSelectedAgency]);
	const askerRoleLabel = translate('sessionList.toolbar.search.role.asker');
	const consultantRoleLabel = translate(
		'sessionList.toolbar.search.role.consultant'
	);
	/** The role labels the People tab shows also count as role words. */
	const searchRoleLabels = React.useMemo(
		() => ({ asker: askerRoleLabel, consultant: consultantRoleLabel }),
		[askerRoleLabel, consultantRoleLabel]
	);
	// Counsellors' internal and legal names are for staff only: an advice
	// seeker sees and searches the public name alone.
	const showStaffNames = !hasUserAuthority(
		AUTHORITIES.ASKER_DEFAULT,
		userData
	);
	const searchTextOptions = React.useMemo(
		() => ({ roleLabels: searchRoleLabels, internalNames: showStaffNames }),
		[searchRoleLabels, showStaffNames]
	);
	const toolbarSearchPeopleResults = useSearchPeopleResults(
		sessionToolbarPairs,
		{
			...searchRoleLabels,
			unknown: translate('sessionList.user.consultantUnknown')
		},
		{
			id: userData?.userId,
			name:
				userData?.displayName ||
				[userData?.firstName, userData?.lastName]
					.filter(Boolean)
					.join(' ') ||
				userData?.userName
		},
		// Only the handover search limits counsellors to takeable ones.
		showConsultantToolbarActions
			? caseHandoverSearch.takeableCases
			: undefined,
		showStaffNames
	);
	const listSearchQuery = textAxisQuery(
		sessionToolbarSearch,
		caseHandoverSearch.pickedPeople,
		searchRoleLabels
	);
	const { selectPeople } = caseHandoverSearch;
	const handleSelectedPeopleChange = useCallback(
		(ids: string[]) => selectPeople(ids, toolbarSearchPeopleResults),
		[selectPeople, toolbarSearchPeopleResults]
	);
	const handleSelectedAgencyChange = useCallback((id: string | null) => {
		setSessionToolbarSelectedAgency(id);
		setSessionToolbarSelectedTopic(null);
	}, []);
	const { reset: resetPickedPeople } = caseHandoverSearch;
	/**
	 * Clears type, centre, topic and archive-only; `everything` also clears
	 * text and people (the search's X, US14).
	 */
	const clearToolbarFilters = useCallback(
		(everything: boolean) => {
			if (everything) {
				setSessionToolbarSearch('');
				resetPickedPeople(caseHandoverSelectedIds);
			}
			setSessionToolbarSelectedTopic(null);
			setSessionToolbarSelectedAgency(null);
			setSessionToolbarChip(null);
			const params = new URLSearchParams(location.search);
			params.delete('chip');
			params.delete('sessionListTab');
			const search = params.toString() ? `?${params.toString()}` : '';
			if (location.search !== search) {
				navigate(
					{ pathname: location.pathname, search },
					{ replace: true }
				);
			}
		},
		[
			caseHandoverSelectedIds,
			location.pathname,
			location.search,
			navigate,
			resetPickedPeople
		]
	);
	const resetToolbarSearch = useCallback(
		() => clearToolbarFilters(true),
		[clearToolbarFilters]
	);
	const isSessionListItemActive = useCallback(
		(session: ExtendedSessionInterface) =>
			isActive({
				groupId: session?.item?.matrixRoomId,
				rid: session?.rid,
				sessionId: session?.item?.id
			}),
		[isActive]
	);
	// #1377 §5.2/§5.3: the display filter runs after `filterSessions` and
	// before the toolbar chip, so the chip refinement composes on top. The
	// route-active row survives (dimmed) while its kind is hidden. All of it
	// is memoised: unread/receipt events re-render this list often.
	const isEligibleForSupervision =
		showConsultantToolbarActions &&
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData);
	const canSupervise =
		isEligibleForSupervision &&
		sessionToolbarPairs.some(
			({ raw, extended }) =>
				classifySession(raw, extended, userData?.userId, true) ===
				'supervision'
		);
	const showSupervisionChip =
		canSupervise ||
		(isEligibleForSupervision &&
			type === SESSION_LIST_TYPES.MY_SESSION &&
			hasMoreSessionPages);
	const currentUserId = userData?.userId;
	const displayFiltered = useMemo(
		() =>
			type === SESSION_LIST_TYPES.ENQUIRY
				? applyRequestsFilter(sessionToolbarPairs, listDisplayFilter, {
						isActive: isSessionListItemActive
					})
				: type === SESSION_LIST_TYPES.MY_SESSION
					? applySessionsFilter(
							sessionToolbarPairs,
							listDisplayFilter,
							{
								currentUserId,
								canSupervise,
								isActive: isSessionListItemActive
							}
						)
					: {
							visible: sessionToolbarPairs,
							hiddenActiveIds: new Set<string>()
						},
		[
			canSupervise,
			currentUserId,
			isSessionListItemActive,
			listDisplayFilter,
			sessionToolbarPairs,
			type
		]
	);
	const displayVisiblePairs = displayFiltered.visible;
	const hiddenActiveRowIds = displayFiltered.hiddenActiveIds;
	const displayFilterHiddenCount =
		sessionToolbarPairs.length - displayVisiblePairs.length;
	const kindsBySessionId = React.useMemo(() => {
		const kinds: Record<string, string> = {};
		sessionToolbarPairs.forEach(({ raw, extended }) => {
			kinds[sessionPairId({ raw, extended })] =
				type === SESSION_LIST_TYPES.ENQUIRY
					? classifyRequest(raw, extended)
					: classifySession(
							raw,
							extended,
							userData?.userId,
							canSupervise
						);
		});
		return kinds;
	}, [canSupervise, sessionToolbarPairs, type, userData?.userId]);
	// The sound gate in NotificationsProvider looks the event's session up
	// here (#1377 "Ton" column, Frank 2026-09-16).
	useEffect(() => {
		sessionKindRegistry.publish(displayFilterSection, kindsBySessionId);
	}, [displayFilterSection, kindsBySessionId]);
	const rowsByKind = React.useMemo(() => {
		const counts: Record<string, number> = {};
		Object.values(kindsBySessionId).forEach((kind) => {
			counts[kind] = (counts[kind] ?? 0) + 1;
		});
		return counts;
	}, [kindsBySessionId]);
	// Unread per kind over the display-VISIBLE rows (§5.2 "hidden kinds are
	// excluded from the chip counts", §6.2 "don't count hidden chats").
	const unreadByKind = React.useMemo(() => {
		const counts: Record<string, number> = {};
		displayVisiblePairs.forEach(({ raw, extended }) => {
			if (hiddenActiveRowIds.has(sessionPairId({ raw, extended }))) {
				return;
			}
			if (!isChatItemUnread(raw.chat ?? raw.session)) {
				return;
			}
			const kind =
				type === SESSION_LIST_TYPES.ENQUIRY
					? classifyRequest(raw, extended)
					: classifySession(
							raw,
							extended,
							userData?.userId,
							canSupervise
						);
			counts[kind] = (counts[kind] ?? 0) + 1;
		});
		return counts;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		displayVisiblePairs,
		hiddenActiveRowIds,
		type,
		userData?.userId,
		canSupervise,
		unreadVersion
	]);
	// #1404 / Frank 2026-09-16: availability decides whether NEW live chats
	// are routed to me — the Live-Chat row's pill mode decides when the chip
	// is in the row (dynamic / bei Sitzung / fest); the open live chat never
	// loses its chip.
	const hasLiveChatRow = React.useMemo(
		() =>
			sessionToolbarPairs.some(({ raw, extended }) =>
				isAnonymousAskerSession(raw, extended)
			),
		[sessionToolbarPairs]
	);
	// FE#1952: the "Direktlinks" chip (and its display-filter row) appear once
	// the list holds a conversation that came in through a direct link.
	const hasDirectLinkRow = React.useMemo(
		() =>
			type === SESSION_LIST_TYPES.MY_SESSION &&
			sessionToolbarPairs.some(({ raw }) => isDirectLinkSession(raw)),
		[sessionToolbarPairs, type]
	);
	const activeIsLiveChat = React.useMemo(
		() =>
			sessionToolbarPairs.some(
				({ raw, extended }) =>
					isSessionListItemActive(extended) &&
					isAnonymousAskerSession(raw, extended)
			),
		[isSessionListItemActive, sessionToolbarPairs]
	);
	const showLiveChatChip = isLiveChatChipVisible({
		mode: kindPillMode(listDisplayFilter, 'liveChat'),
		available: liveChatAvailable,
		hasLiveChatRow,
		unreadCount: unreadByKind.liveChat ?? 0,
		activeIsLiveChat
	});
	const displayFilterKinds = React.useMemo<DisplayFilterKindOption[]>(() => {
		const order =
			type === SESSION_LIST_TYPES.ENQUIRY
				? REQUEST_KIND_ORDER
				: SESSION_KIND_ORDER;
		// Role/availability gates (not Träger switches): listed or not.
		const listed = (kind: string): boolean => {
			switch (kind) {
				case 'liveChat':
					// Always listed (Frank 2026-09-16): the pill has modes
					// (dynamic / pinned / off); availability only drives "dynamic".
					return true;
				case 'create':
					// Träger gate of the create flow: off → no row (absent).
					return (
						type === SESSION_LIST_TYPES.MY_SESSION &&
						showCreateGroupChatAction
					);
				case 'unread':
				case 'drafts':
				case 'archive':
				case 'appointments':
					return type === SESSION_LIST_TYPES.MY_SESSION;
				case 'supervision':
					return showSupervisionChip;
				case 'directLinks':
					return hasDirectLinkRow;
				default:
					return true;
			}
		};
		// Träger feature switches: off + rows → deactivated (listed, locked),
		// off + no rows → absent (not listed). Frank 2026-09-16.
		const traegerSwitch = (kind: string): boolean | null => {
			switch (kind) {
				case 'internalGroup':
					return showInternalGroupChip;
				case 'circle':
					return showGroupChip;
				default:
					return null;
			}
		};
		return listedKinds(
			order.filter(listed).map((kind) => {
				const formatEnabled = traegerSwitch(kind);
				return {
					id: kind,
					label: sessionKindLabel(translate, kind),
					chipLabel:
						kind === OTHER_KIND_ID
							? translate('notifications.displayFilter.otherChip')
							: undefined,
					icon: SESSION_KIND_ICONS[kind],
					unreadCount: unreadByKind[kind] ?? 0,
					modes: kind === 'liveChat',
					pillOnly: PILL_ONLY_SESSION_KINDS.includes(
						kind as SessionKindId
					),
					placeholder: kind === 'appointments',
					availability:
						formatEnabled === null
							? ('available' as const)
							: resolveKindAvailability({
									formatEnabled,
									rowCount: rowsByKind[kind] ?? 0
								})
				};
			})
		);
	}, [
		hasDirectLinkRow,
		rowsByKind,
		showSupervisionChip,
		showCreateGroupChatAction,
		showGroupChip,
		showInternalGroupChip,
		translate,
		type,
		unreadByKind
	]);
	// Sonstiges chip (Frank 2026-09-16): rows of unmapped kind plus rows of
	// every kind whose own pill is off. Classified here — the chip predicate
	// in `sessionMatchesToolbar` knows nothing about kinds.
	const toolbarMatches = useCallback(
		({
			raw,
			extended
		}: {
			raw: ListItemInterface;
			extended: ExtendedSessionInterface;
		}) =>
			(sessionToolbarChip !== 'other' ||
				// the open conversation stays whatever the bundle says
				isSessionListItemActive(extended) ||
				matchesOtherChip(
					listDisplayFilter,
					displayFilterKinds,
					type === SESSION_LIST_TYPES.ENQUIRY
						? classifyRequest(raw, extended)
						: classifySession(
								raw,
								extended,
								currentUserId,
								canSupervise
							)
				)) &&
			sessionMatchesToolbar(
				raw,
				extended,
				listSearchQuery,
				sessionToolbarChip === 'other' ? null : sessionToolbarChip,
				sessionToolbarSelectedPeople,
				visibleUserDrafts,
				currentUserId,
				/* #1404: never let the chip hide the conversation that is
				   open — the same route-active exception the display filter
				   already makes one layer earlier. */
				isSessionListItemActive(extended),
				searchTextOptions
			) &&
			sessionMatchesAgency(raw, sessionToolbarSelectedAgency) &&
			(!sessionToolbarSelectedTopic ||
				String(
					(extended?.item?.topic as TopicSessionInterface | null)
						?.id ?? ''
				) === sessionToolbarSelectedTopic),
		[
			canSupervise,
			currentUserId,
			displayFilterKinds,
			listDisplayFilter,
			isSessionListItemActive,
			sessionToolbarChip,
			listSearchQuery,
			searchTextOptions,
			sessionToolbarSelectedAgency,
			sessionToolbarSelectedPeople,
			sessionToolbarSelectedTopic,
			type,
			visibleUserDrafts
		]
	);
	const sessionToolbarFilteredPairs = useMemo(
		() => displayVisiblePairs.filter(toolbarMatches),
		[displayVisiblePairs, toolbarMatches]
	);
	// Sorted as pairs so the rendered row and the hidden-active lookup use
	// the same id (`sessionPairId`), whatever `item` the extended row holds.
	const sortedSessionPairs = useMemo(() => {
		const sorted = [...sessionToolbarFilteredPairs].sort((left, right) =>
			sortSessions(left.extended, right.extended)
		);
		if (type !== SESSION_LIST_TYPES.ENQUIRY) return sorted;

		// Replace only the Live Chat slots in a mixed view. Mail keeps its
		// existing order without a comparator that changes direction by pair.
		const isLiveChatRequest = ({
			raw,
			extended
		}: (typeof sorted)[number]) =>
			extended.isEnquiry && classifyRequest(raw, extended) === 'liveChat';
		const liveChats = sorted
			.filter(isLiveChatRequest)
			.sort((left, right) => {
				const a = left.extended.item;
				const b = right.extended.item;
				const arrivalA = liveChatArrivalTime(a?.createDate);
				const arrivalB = liveChatArrivalTime(b?.createDate);
				return arrivalA === arrivalB
					? (a?.id ?? 0) - (b?.id ?? 0)
					: arrivalA - arrivalB;
			});
		let liveChatIndex = 0;
		return sorted.map((pair) =>
			isLiveChatRequest(pair) ? liveChats[liveChatIndex++] : pair
		);
	}, [sessionToolbarFilteredPairs, sortSessions, type]);
	const sortedSessions = useMemo(
		() => sortedSessionPairs.map(({ extended }) => extended),
		[sortedSessionPairs]
	);
	const sortedSessionIds = useMemo(
		() => sortedSessionPairs.map(sessionPairId),
		[sortedSessionPairs]
	);

	/*
	 * ORISO-Frontend#1159: a grey "Gelöschte:r Ratsuchende:r" row where a
	 * deleted advice-seeker chat used to be. Only in the counsellor's unfiltered
	 * list: a placeholder matches no chip, search, person, centre or topic.
	 */
	// Not in the rail: its pills are tabs, and a placeholder is no tab.
	const showDeletedAskerRows =
		showConsultantToolbarActions &&
		!isRail &&
		sessionListTab !== SESSION_LIST_TAB_ARCHIVE;
	const [deletedAskerPlaceholders, setDeletedAskerPlaceholders] = useState<
		DeletedAskerSession[]
	>([]);
	useEffect(() => {
		if (!showDeletedAskerRows) {
			setDeletedAskerPlaceholders([]);
			return undefined;
		}
		const controller = new AbortController();
		apiGetDeletedAskerSessions(controller.signal).then((placeholders) => {
			if (!controller.signal.aborted) {
				setDeletedAskerPlaceholders(placeholders);
			}
		});
		return () => controller.abort();
	}, [showDeletedAskerRows]);
	const toolbarNarrowsList =
		!!sessionToolbarChip ||
		!!listSearchQuery ||
		sessionToolbarSelectedPeople.length > 0 ||
		!!sessionToolbarSelectedAgency ||
		!!sessionToolbarSelectedTopic;
	const deletedAskerPlacement = useMemo(() => {
		if (!showDeletedAskerRows || toolbarNarrowsList) {
			return { before: [], trailing: [] };
		}
		const markedForDeletion = (sessions ?? [])
			.filter(
				(raw: ListItemInterface) =>
					!raw?.chat &&
					raw?.user?.deleted &&
					typeof raw?.session?.id === 'number'
			)
			.map((raw: ListItemInterface) => ({
				sessionId: raw.session.id,
				lastInteraction: getLastInteractionTimestamp(
					buildExtendedSession(raw, groupIdFromParam)
				)
			}));
		const shownSessionIds = new Set<number>(
			sortedSessions
				.filter((session) => !session.isGroup)
				.map((session) => Number(session.item?.id))
		);
		return placeDeletedAskerRows(
			sortedSessions.map(getLastInteractionTimestamp),
			buildDeletedAskerRows(
				deletedAskerPlaceholders,
				markedForDeletion,
				shownSessionIds
			),
			totalItems > currentOffset + SESSION_COUNT
		);
	}, [
		currentOffset,
		deletedAskerPlaceholders,
		getLastInteractionTimestamp,
		groupIdFromParam,
		sessions,
		showDeletedAskerRows,
		sortedSessions,
		toolbarNarrowsList,
		totalItems
	]);
	const handleCaseHandoverSelect = useCallback((sessionId: number) => {
		setCaseHandoverSelectedIds((current) =>
			current.includes(sessionId)
				? current.filter((id) => id !== sessionId)
				: [...current, sessionId]
		);
	}, []);
	const caseHandoverContinueRef = useRef<HTMLButtonElement | null>(null);
	const caseHandoverWizardRef = useRef<HTMLDivElement | null>(null);
	const caseHandoverWizardWasOpen = useRef(false);
	// Focus into the wizard on open, back to the bar's Continue on close.
	useEffect(() => {
		if (caseHandoverReviewOpen) {
			caseHandoverWizardWasOpen.current = true;
			caseHandoverWizardRef.current?.focus();
			return;
		}
		if (caseHandoverWizardWasOpen.current) {
			caseHandoverWizardWasOpen.current = false;
			caseHandoverContinueRef.current?.focus();
		}
	}, [caseHandoverReviewOpen]);
	// Bulk bar Continue and the chevron's "Confirm selection" share this.
	const handleOpenCaseHandoverWizard = useCallback(() => {
		setCaseHandoverWizardStep('reason');
		setCaseHandoverBatchSummary('');
		setCaseHandoverReviewOpen(true);
	}, []);
	/** Cancel and Escape: back to the selection, which stays as it was. */
	const handleCancelCaseHandoverWizard = useCallback(() => {
		caseHandoverBatch.close(caseHandoverSelectedIds);
		setCaseHandoverReviewOpen(false);
		setCaseHandoverWizardStep('reason');
		setCaseHandoverBatchSummary('');
	}, [caseHandoverBatch, caseHandoverSelectedIds]);
	const handleCloseCaseHandoverBatch = useCallback(() => {
		caseHandoverBatch.close(caseHandoverSelectedIds, true);
		setCaseHandoverBatchMode(false);
		setCaseHandoverReviewOpen(false);
		setCaseHandoverSelectedIds([]);
		setCaseHandoverExplanation('');
		setCaseHandoverBatchSummary('');
	}, [caseHandoverBatch, caseHandoverSelectedIds]);
	useEffect(() => {
		if (
			sessionListTab === SESSION_LIST_TAB_ARCHIVE &&
			caseHandoverBatchMode
		) {
			handleCloseCaseHandoverBatch();
		}
	}, [caseHandoverBatchMode, handleCloseCaseHandoverBatch, sessionListTab]);
	const handleSubmitCaseHandoverBatch = useCallback(() => {
		if (
			caseHandoverSelectedIds.length === 0 ||
			!caseHandoverReasonCode ||
			!caseHandoverExplanation.trim()
		) {
			setCaseHandoverBatchSummary(
				translate('caseHandover.batch.required')
			);
			return;
		}
		setCaseHandoverBatchSummary('');
		void caseHandoverBatch.submit(
			caseHandoverSelectedIds,
			caseHandoverReasonCode,
			caseHandoverExplanation
		);
	}, [
		caseHandoverBatch,
		caseHandoverExplanation,
		caseHandoverReasonCode,
		caseHandoverSelectedIds,
		translate
	]);
	useEffect(() => {
		if (!caseHandoverBatch.outcome) return;
		const { granted, pending, denied, failed, unresolvedSessionIds } =
			caseHandoverBatch.outcome;
		setCaseHandoverBatchSummary(
			translate('caseHandover.batch.result', {
				granted,
				pending,
				denied,
				failed
			})
		);
		setCaseHandoverSelectedIds(unresolvedSessionIds);
		if (unresolvedSessionIds.length === 0) {
			setCaseHandoverReviewOpen(false);
			setCaseHandoverWizardStep('reason');
		}
		if (granted > 0 || pending > 0) void refetchSessionList();
	}, [caseHandoverBatch.outcome, refetchSessionList, translate]);
	useEffect(() => {
		if (caseHandoverBatch.error) {
			setCaseHandoverBatchSummary(translate('caseHandover.error.failed'));
		}
	}, [caseHandoverBatch.error, translate]);
	const unmatchedDrafts = React.useMemo(() => {
		if (sessionToolbarChip !== 'drafts') {
			return [];
		}

		return visibleUserDrafts
			.filter(
				(draft) =>
					draft.actionPath &&
					!sessionToolbarPairs.some(({ raw, extended }) =>
						draftMatchesSession(draft, raw, extended)
					)
			)
			.sort(
				(draftA, draftB) =>
					normalizeTimestamp(draftB.updatedAt) -
					normalizeTimestamp(draftA.updatedAt)
			);
	}, [
		normalizeTimestamp,
		sessionToolbarChip,
		sessionToolbarPairs,
		visibleUserDrafts
	]);
	const visibleListItemCount = sortedSessions.length + unmatchedDrafts.length;
	// Rows per kind over ALL loaded rows (before the display filter): the
	// Träger switch decides between "deactivated" (rows still exist) and
	// "absent" (nothing of that kind) by this count (Frank 2026-09-16).
	const chipPresentation = resolveChipPresentation(listDisplayFilter);
	// Chips of kinds the Träger switched off while rows exist: locked, the
	// click explains (snackbar) instead of filtering.
	const deactivatedKindChips = React.useMemo(() => {
		const locked: Partial<Record<DisplayFilterKindChip, boolean>> = {};
		displayFilterKinds.forEach((kind) => {
			const chip = SESSION_KIND_CHIP[kind.id];
			if (chip && kind.availability === 'deactivated') {
				locked[chip] = true;
			}
		});
		return locked;
	}, [displayFilterKinds]);
	const [deactivatedNotice, setDeactivatedNotice] = useState<string | null>(
		null
	);
	const handleDeactivatedChipClick = useCallback(
		(chip: DisplayFilterKindChip) => {
			const kind = displayFilterKinds.find(
				(candidate) => SESSION_KIND_CHIP[candidate.id] === chip
			);
			setDeactivatedNotice(
				translate('notifications.displayFilter.deactivatedNotice', {
					kind: kind?.label ?? ''
				})
			);
		},
		[displayFilterKinds, translate]
	);
	const displayFilterCustomised = isDisplayFilterCustomised(
		listDisplayFilter,
		displayFilterKinds
	);
	// §5.1: a chip whose kind lost its pill (or is hidden) is gone from the
	// row, so the refinement it stood for must not keep filtering the list.
	// Same reconciliation as the Zeitstrahl's active family.
	useEffect(() => {
		if (!sessionToolbarChip) {
			return;
		}
		if (
			sessionToolbarChip === 'supervision' &&
			sessionsReady &&
			!canSupervise &&
			(!hasMoreSessionPages || type !== SESSION_LIST_TYPES.MY_SESSION) &&
			!isLoading &&
			!isRequestInProgress &&
			!isReloadButtonVisible
		) {
			handleToolbarChipToggle(sessionToolbarChip);
			return;
		}
		const activeKind =
			displayFilterKinds.find(
				(kind) => SESSION_KIND_CHIP[kind.id] === sessionToolbarChip
			)?.id ?? null;
		if (!activeKind) {
			return;
		}
		// Frank 2026-09-16: a chip is a menu entry in every list — Anfragen
		// included (supersedes #1427's "tabs" rule: the Anzeigen picker of the
		// Anfragen dialog switches the chip, hiding is not offered there).
		if (reconcileActiveKind(listDisplayFilter, activeKind) === null) {
			// Through the toggle so `?chip=…` clears with the state; otherwise a
			// reload or the URL-sync effect restores the hidden tab.
			handleToolbarChipToggle(sessionToolbarChip);
		}
	}, [
		canSupervise,
		hasMoreSessionPages,
		isLoading,
		isRequestInProgress,
		isReloadButtonVisible,
		sessionsReady,
		displayFilterKinds,
		handleToolbarChipToggle,
		listDisplayFilter,
		sessionToolbarChip,
		type
	]);
	// Kind chips are menu entries (Frank 2026-09-16): pill on → chip, in
	// Gespräche and Anfragen alike; unread is a badge on the chip.
	const hiddenKindChips = React.useMemo(() => {
		const hidden: Partial<Record<DisplayFilterKindChip, boolean>> = {};
		const activeKind =
			displayFilterKinds.find(
				(kind) => SESSION_KIND_CHIP[kind.id] === sessionToolbarChip
			)?.id ?? null;
		const shown = new Set(
			visiblePillKinds(
				listDisplayFilter,
				displayFilterKinds,
				activeKind
			).map((kind) => kind.id)
		);
		displayFilterKinds.forEach((kind) => {
			const chip = SESSION_KIND_CHIP[kind.id];
			if (chip && !shown.has(kind.id)) {
				hidden[chip] = true;
			}
		});
		return hidden;
	}, [displayFilterKinds, listDisplayFilter, sessionToolbarChip]);
	const toolbarChipCounts = React.useMemo(() => {
		// Unread is derived from the Matrix client (#1147); `unreadVersion`
		// re-runs this memo when notification counts or receipts change.
		// §6.2: "Don't count hidden chats as unread" is the only thing the
		// sessions auto-read switch does. Off (the default) → hidden chats
		// still count in the aggregate Unread chip; Anfragen has no switch and
		// counts the visible rows.
		// With the switch on, the retained (dimmed) active row of a hidden
		// kind is exactly what must not count.
		const unreadSource =
			type === SESSION_LIST_TYPES.MY_SESSION &&
			!listDisplayFilter.autoReadHidden
				? sessionToolbarPairs
				: displayVisiblePairs.filter(
						(pair) => !hiddenActiveRowIds.has(sessionPairId(pair))
					);
		const counts: Partial<Record<SessionToolbarChipFilter, number>> = {
			unread: countUnreadSessions(unreadSource.map((p) => p.raw)),
			drafts: visibleUserDrafts.length,
			supervision: countUnreadSupervisedSessions(
				unreadSource,
				userData?.userId
			)
		};
		Object.entries(unreadByKind).forEach(([kind, count]) => {
			const chip = SESSION_KIND_CHIP[kind];
			if (chip && chip !== 'supervision') {
				counts[chip] = (counts[chip] ?? 0) + count;
			}
		});
		// Sonstiges bundles the kinds without their own pill (Frank 2026-09-16).
		counts.other = countUnreadOtherSessions(
			kindsUnderOther(listDisplayFilter, displayFilterKinds),
			unreadByKind,
			unreadSource,
			userData?.userId
		);
		return counts;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		displayVisiblePairs,
		hiddenActiveRowIds,
		listDisplayFilter,
		sessionToolbarPairs,
		type,
		unreadByKind,
		userData?.userId,
		visibleUserDrafts.length,
		unreadVersion
	]);
	// Filters can hide a whole loaded page, leaving no scroll trigger.
	useEffect(() => {
		// Enquiries merge two feeds with their own paging contract. Keep their
		// existing display-only paging. Only the Supervision chip adds a scan;
		// ordinary text searches must not fetch the entire conversation history.
		const ownConversations = type === SESSION_LIST_TYPES.MY_SESSION;
		const pageSupervisionRows =
			ownConversations &&
			sessionToolbarChip === 'supervision' &&
			!sessionToolbarSearch.trim();
		const toolbarHidesRows =
			pageSupervisionRows &&
			sessionToolbarFilteredPairs.length < displayVisiblePairs.length;
		const needsSupervisionPage =
			ownConversations &&
			sessionToolbarChip === 'supervision' &&
			!canSupervise;
		const visibleRows = pageSupervisionRows
			? sessionToolbarFilteredPairs.length
			: displayVisiblePairs.length;
		if (
			!showMySessionToolbar ||
			(displayFilterHiddenCount === 0 &&
				!toolbarHidesRows &&
				!needsSupervisionPage) ||
			visibleRows >= MIN_VISIBLE_SESSION_ROWS ||
			isLoading ||
			isRequestInProgress ||
			isReloadButtonVisible ||
			!hasMoreSessionPages
		) {
			return;
		}
		loadMoreSessions();
	}, [
		canSupervise,
		displayFilterHiddenCount,
		displayVisiblePairs.length,
		hasMoreSessionPages,
		isLoading,
		isReloadButtonVisible,
		isRequestInProgress,
		loadMoreSessions,
		sessionToolbarChip,
		sessionToolbarFilteredPairs.length,
		sessionToolbarSearch,
		showMySessionToolbar,
		type
	]);
	useEffect(() => {
		setSessionListViewState(type, {
			ready: !isLoading,
			visibleSessionCount: visibleListItemCount
		});
	}, [isLoading, setSessionListViewState, type, visibleListItemCount]);
	/** #1195 JOB1 — the counsellor's own agencies drive the two-agency filter. */
	const toolbarSearchAgencyResults = React.useMemo(
		() =>
			(userData?.agencies ?? []).map((agency) => ({
				id: String(agency.id),
				label: agency.name,
				subtitle: [agency.city, agency.postcode]
					.filter(Boolean)
					.join(' ')
			})),
		[userData]
	);
	const toolbarFilteredOutAll =
		showMySessionToolbar &&
		finalSessionsList.length > 0 &&
		visibleListItemCount === 0;
	const hasToolbarSearchFilter = Boolean(
		sessionToolbarSearch.trim() ||
			sessionToolbarSelectedPeople.length ||
			sessionToolbarSelectedTopic ||
			sessionToolbarSelectedAgency ||
			sessionToolbarChip
	);
	useEffect(() => {
		setFilteredOutNoticeDismissed(false);
	}, [
		sessionToolbarSearch,
		sessionToolbarSelectedPeople,
		sessionToolbarSelectedTopic,
		sessionToolbarSelectedAgency,
		sessionToolbarChip
	]);
	const showFilteredOutNotice =
		toolbarFilteredOutAll &&
		hasToolbarSearchFilter &&
		!filteredOutNoticeDismissed;
	/** Filters that hide cases besides the search itself (US17). */
	const hasHidingFilter = Boolean(
		sessionToolbarSelectedTopic ||
			sessionToolbarSelectedAgency ||
			sessionToolbarChip ||
			sessionListTab === SESSION_LIST_TAB_ARCHIVE
	);
	// ADR-021: the planned dates above "Jetzt". Every group series of the
	// list is loaded once (the chips must not refetch); what shows follows
	// the visible rows, so a filter applies to both sides of the handle.
	const { settings: timelineSettings } = useTimelineSettings();
	const isAskerList = hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData);
	const timelineApplies =
		type === SESSION_LIST_TYPES.MY_SESSION &&
		sessionListTab !== SESSION_LIST_TAB_ARCHIVE;
	// The ultra-thin rail has no zone, only the calendar mark on its pills.
	const showTimeline = timelineApplies && !isRail;
	const timelineSeries = React.useMemo<TimelineSession[]>(
		() =>
			sessionToolbarPairs
				.map(({ extended }) => extended)
				.filter(
					(session) =>
						session.isGroup &&
						session.item.repeatCount !== undefined
				)
				.map((session) => {
					const topic =
						typeof session.item.topic === 'string'
							? session.item.topic
							: session.item.topic?.name || 'Group chat';
					return {
						sessionId: session.item.id,
						title: topic,
						kind: 'group' as const,
						topic,
						lastActivity: 0,
						lastMessage: '',
						matrixRoomId:
							session.item.matrixRoomId ||
							session.rid ||
							undefined,
						canModerate: canModerateGroupChat(session, userData),
						canConfigure: canEditGroupChatSettings(
							session,
							userData
						)
					};
				}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[sessionToolbarPairs, userData]
	);
	const timelineConversations = React.useMemo<TimelineSession[]>(
		() =>
			sessionToolbarPairs
				.map(({ extended }) => extended)
				.filter((session) => !session.isGroup)
				.map((session) => {
					const topic =
						typeof session.item.topic === 'string'
							? session.item.topic
							: session.item.topic?.name || '';
					return {
						sessionId: session.item.id,
						title:
							session.consultant?.displayName ||
							session.user?.username ||
							session.consultant?.username ||
							topic,
						kind: 'one-to-one' as const,
						topic,
						lastActivity: 0,
						lastMessage: '',
						matrixRoomId:
							session.item.matrixRoomId ||
							session.rid ||
							undefined
					};
				}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[sessionToolbarPairs]
	);
	const { entries: futureEntries, markCancelled } = useFutureEntries({
		series: timelineSeries,
		conversations: timelineConversations,
		enabled: timelineApplies
	});
	const [movingEntry, setMovingEntry] = useState<FutureEntry | null>(null);
	const onAppointmentAction = useAppointmentActions({
		onCancelled: markCancelled,
		onMove: setMovingEntry
	});
	const visibleRooms = React.useMemo(
		() =>
			new Set(
				sortedSessions.map((session) =>
					roomKey(
						session.isGroup ? 'group' : 'one-to-one',
						session.item.id
					)
				)
			),
		[sortedSessions]
	);
	const hasAnyListFilter =
		hasHidingFilter || sessionToolbarSearch.trim() !== '';
	const zoneEntries = React.useMemo(
		() => entriesForList(futureEntries, visibleRooms, hasAnyListFilter),
		[futureEntries, visibleRooms, hasAnyListFilter]
	);
	const addonCalendarEntries = useAddonCalendarEntries({
		enabled: showTimeline,
		monthsAhead: FUTURE_MONTHS
	});
	// Add-on dates belong to no room, so a list filter hides them like
	// unmapped appointments.
	const addonZoneRows = React.useMemo<FutureZoneExtraRow[]>(
		() =>
			hasAnyListFilter
				? []
				: addonCalendarEntries.map((entry) => ({
						key: `addon:${entry.addon}:${entry.id}`,
						start: entry.start,
						end: entry.end,
						render: (now: Date) => (
							<AddonCalendarPill
								entry={entry}
								now={now}
								sessionsBasePath={
									isAskerList
										? '/sessions/user/view'
										: '/sessions/consultant/sessionView'
								}
							/>
						)
					})),
		[addonCalendarEntries, hasAnyListFilter, isAskerList]
	);
	// Every planned date counts for the clock, whatever the filter shows above.
	const nextGroupAppointment = React.useMemo(
		() =>
			nextEntryBySession(
				futureEntries.filter((entry) => entry.kind === 'group')
			),
		[futureEntries]
	);
	const nextConversationAppointment = React.useMemo(
		() =>
			nextEntryBySession(
				futureEntries.filter((entry) => entry.kind === 'one-to-one')
			),
		[futureEntries]
	);
	const nextAppointmentOf = (session: ExtendedSessionInterface) =>
		(session.isGroup
			? nextGroupAppointment
			: nextConversationAppointment
		).get(session.item.id);
	const upcomingLabelOf = (session: ExtendedSessionInterface) => {
		const next = nextAppointmentOf(session);
		return next
			? translate('sessionList.timeline.nextAppointment', {
					date: formatEntryDate(next.start)
				})
			: undefined;
	};
	const timelineRole = isAskerList ? 'asker' : 'counsellor';
	const appointmentActionOf = (session: ExtendedSessionInterface) => {
		const next = nextAppointmentOf(session);
		return next
			? ({
					openRoom,
					active
				}: {
					openRoom: () => void;
					active: boolean;
				}) => (
					<AppointmentSplitButton
						entry={next}
						role={timelineRole}
						active={active}
						fullWidth
						onOpen={openRoom}
						onAction={onAppointmentAction}
					/>
				)
			: undefined;
	};
	const singleTimeline =
		showTimeline && timelineSettings.scrollModel === 'single';
	const zoneRef = useRef<FutureZoneHandle>(null);
	const pullRef = useRef(0);
	const nowRef = useRef<HTMLDivElement>(null);
	// Measured on screen: "Jetzt" sits inside the positioned zone.
	const nowTopInList = () => {
		const el = listRef.current as HTMLDivElement | null;
		const marker = nowRef.current;
		return el && marker
			? marker.getBoundingClientRect().top -
					el.getBoundingClientRect().top +
					el.scrollTop
			: 0;
	};
	const [nowOffscreen, setNowOffscreen] = useState<'above' | 'below' | null>(
		null
	);
	// The clicked appointment stays marked until another room is opened.
	const [selectedTwin, setSelectedTwin] = useState<FutureEntry | null>(null);
	useEffect(() => {
		setSelectedTwin((current) =>
			current &&
			String(current.sessionId) === String(sessionIdFromParam || '')
				? current
				: null
		);
	}, [sessionIdFromParam, groupIdFromParam]);
	// Half / almost all of the list are stops: measured on the whole column,
	// which does not shrink while the zone opens.
	const innerWrapperRef = useRef<HTMLDivElement>(null);
	const [timelineListHeight, setTimelineListHeight] = useState(520);
	useEffect(() => {
		const el = innerWrapperRef.current;
		if (!el || !showTimeline || typeof ResizeObserver === 'undefined')
			return undefined;
		const observer = new ResizeObserver(() =>
			setTimelineListHeight(Math.round(el.clientHeight * 0.8))
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [showTimeline]);

	// Single timeline: a deliberate pull past the top releases the next stop.
	const handleTimelineWheel = (e: React.WheelEvent<HTMLDivElement>) => {
		if (!singleTimeline) return;
		const el = listRef.current as HTMLDivElement | null;
		if (!el || el.scrollTop > 0 || e.deltaY >= 0) {
			pullRef.current = 0;
			return;
		}
		pullRef.current += -e.deltaY;
		if (pullRef.current >= PULL_RELEASE_PX) {
			pullRef.current = 0;
			zoneRef.current?.stepOpen();
		}
	};
	const handleTimelineScroll = () => {
		handleListScroll();
		if (!singleTimeline) return;
		const el = listRef.current as HTMLDivElement | null;
		const marker = nowRef.current;
		if (!el || !marker) return;
		const markerTop = nowTopInList();
		if (el.scrollTop > markerTop + marker.offsetHeight)
			setNowOffscreen('above');
		else if (el.scrollTop + el.clientHeight < markerTop)
			setNowOffscreen('below');
		else setNowOffscreen(null);
	};
	const jumpToNow = () => {
		const el = listRef.current as HTMLDivElement | null;
		const marker = nowRef.current;
		if (el && marker)
			el.scrollTo({
				top: nowTopInList() - 8,
				behavior: 'smooth'
			});
	};

	const timelineZone = showTimeline &&
		zoneEntries.length + addonZoneRows.length > 0 && (
			<div
				className="sessionsList__timeline"
				data-cy="sessions-list-timeline"
			>
				<FutureZone
					ref={zoneRef}
					nowRef={nowRef}
					entries={zoneEntries}
					extraRows={addonZoneRows}
					role={timelineRole}
					listHeight={timelineListHeight}
					initialReveal={timelineSettings.reveal}
					memoryKey="sessionsList"
					selectedKey={selectedTwin?.key}
					onOpen={(entry) => {
						setSelectedTwin(entry);
						onAppointmentAction('open', entry);
					}}
					onAction={onAppointmentAction}
					unreadOf={(entry) => isRoomUnread(entry.matrixRoomId)}
					label={translate('sessionList.timeline.upcoming')}
					nowLabel={translate('sessionList.timeline.now')}
				/>
			</div>
		);

	return (
		<div
			ref={innerWrapperRef}
			className="sessionsList__innerWrapper"
			data-tour-target={
				type === SESSION_LIST_TYPES.ENQUIRY
					? 'consultant-enquiries-list'
					: 'consultant-sessions-list'
			}
		>
			{/* {showEnquiryFilterChips && (
				<EnquiryFilterChips
					translate={translate}
					activeChip={sessionToolbarChip}
					onChipToggle={handleToolbarChipToggle}
					showLiveChatChip={showLiveChatChip}
					showArchiveChip={
						resolveKindSetting(listDisplayFilter, 'archive').pill
					}
					showCreateChip={
						resolveKindSetting(listDisplayFilter, 'create').pill
					}
				/>
			)} */}
			{showMySessionToolbar && (
				<SessionsListToolbar
					translate={translate}
					searchValue={sessionToolbarSearch}
					onSearchChange={setSessionToolbarSearch}
					searchPeopleResults={toolbarSearchPeopleResults}
					searchPeopleStatus={caseHandoverSearch.eligibleStatus}
					searchPeopleHint={
						showConsultantToolbarActions
							? translate(
									'sessionList.toolbar.search.handoverPeopleHint'
								)
							: undefined
					}
					searchPeopleCappedNote={
						showConsultantToolbarActions &&
						caseHandoverSearch.eligibleCapped
							? translate(
									'sessionList.toolbar.search.handoverPeopleCapped'
								)
							: undefined
					}
					searchPeopleEligibleOnlyWhenBlank={
						showConsultantToolbarActions
					}
					onSearchOpenChange={setSessionToolbarSearchOpen}
					selectedPersonIds={sessionToolbarSelectedPeople}
					selectedPeopleDetails={caseHandoverSearch.pickedPeople}
					onSelectedPersonIdsChange={handleSelectedPeopleChange}
					onSearchReset={resetToolbarSearch}
					activeChip={isCreateChatActive ? null : sessionToolbarChip}
					onChipToggle={handleToolbarChipToggle}
					showConsultantActions={showConsultantToolbarActions}
					showCreateGroupChatAction={showCreateGroupChatAction}
					showSupervisionChip={showSupervisionChip}
					showGroupChip={showGroupChip}
					showInternalGroupChip={showInternalGroupChip}
					/* Live-Chat chip shows on Gespräch too once the sidebar
					   availability toggle is ON — it narrows the
					   my-sessions list to anonymous-asker chats using the
					   same username-prefix filter as the Anfragen chip. */
					showLiveChatChip={showLiveChatChip}
					showArchiveChip={
						resolveKindSetting(listDisplayFilter, 'archive').pill
					}
					showCreateChip={
						resolveKindSetting(listDisplayFilter, 'create').pill
					}
					createGroupChatPath={buildCreateGroupChatPath(
						sessionListTab || undefined
					)}
					archiveTabPath={buildArchiveTabPath()}
					archiveTabActive={
						sessionListTab === SESSION_LIST_TAB_ARCHIVE
					}
					createGroupChatActive={isCreateChatActive}
					chipCounts={toolbarChipCounts}
					hiddenKindChips={hiddenKindChips}
					deactivatedKindChips={deactivatedKindChips}
					deactivatedChipLabel={(name) =>
						translate(
							'notifications.displayFilter.deactivatedChip',
							{
								kind: name
							}
						)
					}
					onDeactivatedChipClick={handleDeactivatedChipClick}
					chipView={chipPresentation.view}
					chipAutoSort={chipPresentation.autoSort}
					showOtherChip
					showDirectLinksChip={
						hasDirectLinkRow || sessionToolbarChip === 'directLinks'
					}
					displayFilter={{
						label: displayFilterLabels.buttonLabel,
						customisedLabel:
							displayFilterLabels.buttonCustomisedLabel,
						customised: displayFilterCustomised,
						open: displayFilterOpen,
						controlsId: SESSIONS_DISPLAY_FILTER_DIALOG_ID,
						onOpen: () => setDisplayFilterOpen(true)
					}}
					searchAgencyResults={toolbarSearchAgencyResults}
					selectedAgencyId={sessionToolbarSelectedAgency}
					onSelectedAgencyIdChange={handleSelectedAgencyChange}
					searchTopicResults={toolbarSearchTopicResults}
					selectedTopicId={sessionToolbarSelectedTopic}
					onSelectedTopicIdChange={setSessionToolbarSelectedTopic}
					searchTypeResults={[
						{
							id: 'nearby',
							label: translate('sessionList.toolbar.chips.nearby')
						},
						...(hasDirectLinkRow
							? [
									{
										id: 'directLinks',
										label: translate(
											'sessionList.toolbar.chips.directLinks'
										)
									}
								]
							: []),
						{
							id: 'liveChat',
							label: translate(
								'sessionList.toolbar.chips.liveChat'
							)
						},
						{
							id: 'internalGroup',
							label: translate(
								'sessionList.toolbar.chips.internalGroup'
							)
						},
						{
							id: 'groups',
							label: translate('sessionList.toolbar.chips.groups')
						},
						{
							id: 'supervision',
							label: translate(
								'sessionList.toolbar.chips.supervision'
							)
						}
					]}
					selectedTypeId={sessionToolbarChip}
					onSelectedTypeIdChange={(id) =>
						handleToolbarChipToggle(
							(id ||
								sessionToolbarChip) as SessionToolbarChipFilter
						)
					}
					searchArchiveOnly={
						sessionListTab === SESSION_LIST_TAB_ARCHIVE
					}
					onSearchArchiveOnlyChange={(archiveOnly) =>
						navigate(
							archiveOnly
								? buildArchiveTabPath()
								: '/sessions/consultant/sessionView'
						)
					}
				/>
			)}
			{showMySessionToolbar && (
				<M3Snackbar
					open={showFilteredOutNotice}
					message={translate(
						'sessionList.toolbar.search.filteredOutAll'
					)}
					role="status"
					action={
						hasHidingFilter
							? {
									label: translate(
										'sessionList.toolbar.search.removeFiltersKeepSearch'
									),
									onClick: () => clearToolbarFilters(false),
									testId: 'session-search-filtered-out-reset'
								}
							: {
									label: translate(
										'sessionList.toolbar.search.clear'
									),
									onClick: resetToolbarSearch,
									testId: 'session-search-filtered-out-reset'
								}
					}
					onClose={() => setFilteredOutNoticeDismissed(true)}
					closeLabel={displayFilterLabels.dialogLabels.close}
					testId="session-search-filtered-out-notice"
				/>
			)}
			{showMySessionToolbar && (
				<M3Snackbar
					open={deactivatedNotice !== null}
					message={deactivatedNotice}
					role="status"
					onClose={() => setDeactivatedNotice(null)}
					closeLabel={displayFilterLabels.dialogLabels.close}
					testId="display-filter-deactivated-notice"
				/>
			)}
			{showMySessionToolbar && (
				<DisplayFilterDialog
					id={SESSIONS_DISPLAY_FILTER_DIALOG_ID}
					columns={SESSION_COLUMNS}
					icon={
						type === SESSION_LIST_TYPES.ENQUIRY ? (
							<NavInboxIcon className="displayFilterDialog__heroIcon" />
						) : (
							<NavChatsIcon className="displayFilterDialog__heroIcon" />
						)
					}
					open={displayFilterOpen}
					fullScreen={untilL}
					onClose={() => setDisplayFilterOpen(false)}
					kinds={displayFilterKinds}
					email={displayFilterEmail}
					browserUnavailableReason={displayFilterBrowserUnavailable}
					browserMutedNotice={displayFilterBrowserMuted}
					value={listDisplayFilter}
					canReset={listDisplayOverride !== null}
					canWrite={canEditDisplayFilter}
					readOnly={displayFilterReadOnly}
					showAutoRead={type === SESSION_LIST_TYPES.MY_SESSION}
					onChange={setListDisplayOverride}
					onReset={resetListDisplayOverride}
					onOpenProfile={() => {
						setDisplayFilterOpen(false);
						navigate(NOTIFICATION_SETTINGS_PATH);
					}}
					labels={displayFilterLabels.dialogLabels}
				/>
			)}
			{!singleTimeline && timelineZone}
			{showCaseHandoverBatchUi &&
				caseHandoverBatchMode &&
				caseHandoverBatchSummary &&
				!caseHandoverReviewOpen && (
					<div className="sessionsList__caseHandoverBatch">
						<div
							className="sessionsList__caseHandoverBatchSummary"
							role="status"
							aria-live="polite"
						>
							{caseHandoverBatchSummary}
						</div>
					</div>
				)}
			{showCaseHandoverBatchUi &&
				caseHandoverBatchMode &&
				caseHandoverReviewOpen && (
					// aria-modal promises an inert page: Tab and Shift+Tab stay
					// inside. Focus in and back to Continue is handled above.
					<FocusTrap
						focusTrapOptions={{
							initialFocus: false,
							returnFocusOnDeactivate: false,
							escapeDeactivates: false,
							allowOutsideClick: true,
							fallbackFocus: () =>
								caseHandoverWizardRef.current ?? document.body
						}}
					>
						<div
							className="sessionsList__caseHandoverWizardOverlay"
							role="dialog"
							aria-modal="true"
							aria-label={translate('caseHandover.batch.title')}
							ref={caseHandoverWizardRef}
							tabIndex={-1}
							onKeyDown={(event) => {
								if (event.key !== 'Escape') return;
								event.stopPropagation();
								handleCancelCaseHandoverWizard();
							}}
						>
							<div className="sessionsList__caseHandoverWizardShell">
								<div className="sessionsList__caseHandoverWizardBar">
									<strong>
										{translate('caseHandover.batch.title')}
									</strong>
									<span>
										{translate(
											'caseHandover.batch.selectedCount',
											{
												count: caseHandoverSelectedIds.length
											}
										)}
									</span>
									<button
										type="button"
										className="sessionsList__caseHandoverWizardClose"
										onClick={handleCancelCaseHandoverWizard}
									>
										{translate('caseHandover.batch.cancel')}
									</button>
								</div>
								<CaseHandoverCurtainView
									step={caseHandoverWizardStep}
									reasons={caseHandoverReasons.reasons}
									reasonCode={caseHandoverReasonCode}
									explanation={caseHandoverExplanation}
									isSubmitting={caseHandoverBatch.submitting}
									reasonsUnavailable={
										caseHandoverReasons.unavailable
									}
									reasonsLoadFailed={
										caseHandoverReasons.failed
									}
									onRetryReasons={caseHandoverReasons.retry}
									error={
										caseHandoverReviewOpen &&
										caseHandoverBatchSummary
											? caseHandoverBatchSummary
											: undefined
									}
									onStart={() =>
										setCaseHandoverWizardStep('reason')
									}
									onBack={() =>
										setCaseHandoverWizardStep('reason')
									}
									onNext={() =>
										setCaseHandoverWizardStep('describe')
									}
									onReasonSelect={setCaseHandoverReasonCode}
									onExplanationChange={
										setCaseHandoverExplanation
									}
									onSubmit={handleSubmitCaseHandoverBatch}
								/>
							</div>
						</div>
					</FocusTrap>
				)}
			<div className="sessionsList__scrollArea">
				<div
					className={clsx('sessionsList__scrollContainer', {
						'sessionsList__scrollContainer--hasToolbar':
							showMySessionToolbar,
						'sessionRailList': isRail
					})}
					ref={listRef}
					// Rail pills are tabs; full cards hold their own buttons (menu,
					// mail, call), which a tab may not contain, so they are list
					// items (#1338).
					role={isRail ? 'tablist' : 'list'}
					aria-orientation={isRail ? 'vertical' : undefined}
					aria-label={translate('sessionList.view.headline')}
					onScroll={handleTimelineScroll}
					onWheel={handleTimelineWheel}
				>
					{singleTimeline && timelineZone}
					{(!isLoading || finalSessionsList.length > 0) &&
						sortedSessions.map(
							(
								activeSession: ExtendedSessionInterface,
								index
							) => (
								<React.Fragment
									key={`${activeSession.isGroup ? 'chat' : 'session'}:${activeSession.item.id}`}
								>
									{deletedAskerPlacement.before[index]?.map(
										(row) => (
											<DeletedAskerListItem
												key={row.key}
												row={row}
												locale={defaultLanguage}
												translate={translate}
											/>
										)
									)}
									<ActiveSessionProvider
										activeSession={activeSession}
									>
										<div
											className={clsx(
												hiddenActiveRowIds.has(
													sortedSessionIds[index]
												) &&
													'sessionsList__hiddenActiveRow'
											)}
										>
											{hiddenActiveRowIds.has(
												sortedSessionIds[index]
											) && (
												// Announced like a status, without a
												// status role inside the list (#1338).
												<p
													className="sessionsList__hiddenActiveRowHint"
													aria-live="polite"
													aria-atomic="true"
												>
													{translate(
														'notifications.displayFilter.hiddenActiveRow'
													)}
												</p>
											)}
											<SessionListItemComponent
												defaultLanguage={
													defaultLanguage
												}
												itemRef={(el) =>
													(ref_list_array.current[
														index
													] = el)
												}
												handleKeyDownLisItemContent={(
													e
												) =>
													handleKeyDownLisItemContent(
														e,
														index
													)
												}
												index={index}
												isBeforeActive={
													!!sortedSessions[
														index + 1
													] &&
													isSessionListItemActive(
														sortedSessions[
															index + 1
														]
													)
												}
												isAfterActive={
													!!sortedSessions[
														index - 1
													] &&
													isSessionListItemActive(
														sortedSessions[
															index - 1
														]
													)
												}
												grouped={!isRail}
												upcomingAppointment={upcomingLabelOf(
													activeSession
												)}
												upcomingAppointmentModality={
													nextAppointmentOf(
														activeSession
													)?.modality
												}
												appointmentAction={appointmentActionOf(
													activeSession
												)}
												datePlacement={
													timelineSettings.pastDate
												}
												isGroupStart={
													index === 0 ||
													isSessionListItemActive(
														sortedSessions[
															index - 1
														]
													)
												}
												isGroupEnd={
													index ===
														sortedSessions.length -
															1 ||
													isSessionListItemActive(
														sortedSessions[
															index + 1
														]
													)
												}
												caseHandoverBatchMode={
													caseHandoverBatchMode
												}
												caseHandoverSelected={caseHandoverSelectedIds.includes(
													activeSession.item.id
												)}
												onCaseHandoverSelect={
													handleCaseHandoverSelect
												}
												onCaseHandoverBatchStart={() => {
													setCaseHandoverBatchMode(
														true
													);
													setCaseHandoverReviewOpen(
														false
													);
													setCaseHandoverBatchSummary(
														''
													);
												}}
												onCaseHandoverBatchConfirm={
													handleOpenCaseHandoverWizard
												}
												onCaseHandoverBatchClose={
													handleCloseCaseHandoverBatch
												}
											/>
										</div>
									</ActiveSessionProvider>
								</React.Fragment>
							)
						)}

					{/* A failed page load leaves the page count unknown, so rows
					    "older than everything" wait for a successful retry. */}
					{!isLoading &&
						!isReloadButtonVisible &&
						deletedAskerPlacement.trailing.map((row) => (
							<DeletedAskerListItem
								key={row.key}
								row={row}
								locale={defaultLanguage}
								translate={translate}
							/>
						))}

					{!isLoading &&
						sessionToolbarChip === 'drafts' &&
						unmatchedDrafts.map((draft) => (
							<DraftMetadataListItem
								key={draft.scopeKey}
								draft={draft}
								onOpen={handleOpenDraft}
								translate={translateKey}
							/>
						))}

					{isLoading && <SessionsListSkeleton />}

					{isReloadButtonVisible && (
						<div
							className="sessionsList__reloadWrapper"
							role="listitem"
						>
							<Button
								item={{
									label: translate(
										'sessionList.reloadButton.label'
									),
									function: '',
									type: 'LINK',
									id: 'reloadButton'
								}}
								buttonHandle={handleReloadButton}
							/>
						</div>
					)}
				</div>
				{singleTimeline && nowOffscreen && (
					<button
						type="button"
						className={`tlp__pill tlp__pill--${nowOffscreen}`}
						onClick={jumpToNow}
						data-cy="timeline-now-pill"
					>
						{nowOffscreen === 'above' ? '↑ ' : '↓ '}
						{translate('sessionList.timeline.now')}
					</button>
				)}
			</div>

			{!isLoading &&
				!isCreateChatActive &&
				!isReloadButtonVisible &&
				visibleListItemCount === 0 && (
					<EmptyListItem
						headlineOverride={
							toolbarFilteredOutAll
								? translate(
										'sessionList.toolbar.emptyFilterResult'
									)
								: undefined
						}
						sessionListTab={sessionListTab}
						type={type}
					/>
				)}
			{showCaseHandoverBatchUi &&
				caseHandoverBatchMode &&
				!caseHandoverReviewOpen && (
					<CaseHandoverBulkBar
						ref={caseHandoverContinueRef}
						count={caseHandoverSelectedIds.length}
						labels={{
							region: translate('caseHandover.bulkBar.label'),
							selected: translate(
								'caseHandover.bulkBar.selected',
								{ count: caseHandoverSelectedIds.length }
							),
							continueLabel: translate(
								'caseHandover.bulkBar.continue'
							),
							cancel: translate('caseHandover.bulkBar.cancel'),
							emptyHint: translate(
								'caseHandover.bulkBar.emptyHint'
							)
						}}
						onContinue={handleOpenCaseHandoverWizard}
						onCancel={handleCloseCaseHandoverBatch}
					/>
				)}
			{movingEntry?.sessionId !== undefined && (
				<AppointmentDateDialog
					sessionId={movingEntry.sessionId}
					matrixRoomId={movingEntry.matrixRoomId}
					entry={movingEntry}
					onClose={() => setMovingEntry(null)}
				/>
			)}
		</div>
	);
};

/*
Watch for inactive groups because there is no api endpoint
 */
const useGroupWatcher = (isLoading: boolean) => {
	const { sessions, dispatch } = useContext(SessionsDataContext);
	const location = useLocation();

	const hasSessionChanged = useCallback(
		(newSession) => {
			const oldSession = sessions.find(
				(s) => s.chat?.id === newSession.chat.id
			);
			return (
				!oldSession ||
				oldSession.chat.subscribed !== newSession.chat.subscribed ||
				oldSession.chat.active !== newSession.chat.active
			);
		},
		[sessions]
	);

	const refreshInactiveGroupSessions = useCallback(() => {
		const inactiveGroupSessions = sessions.filter(
			(s) => !!s.chat && !s.chat.subscribed
		);

		if ((location?.state as any)?.isEditMode) return;

		if (inactiveGroupSessions.length <= 0) {
			return;
		}

		return apiGetSessionRoomsByRoomIds(
			inactiveGroupSessions.map((s) => s.chat.matrixRoomId)
		)
			.then(({ sessions }) => {
				// Update sessions whose room still exists
				dispatch({
					type: UPDATE_SESSIONS,
					sessions: sessions.filter(hasSessionChanged)
				});

				// Remove sessions whose room is gone and that are not repetitive chats
				const removedGroupSessions = inactiveGroupSessions.filter(
					(inactiveGroupSession) =>
						!sessions.find(
							(s) =>
								s.chat.matrixRoomId ===
								inactiveGroupSession.chat.matrixRoomId
						)
				);
				if (removedGroupSessions.length > 0) {
					dispatch({
						type: REMOVE_SESSIONS,
						ids: removedGroupSessions
							.filter(
								(s) => getModality(s) !== Modality.SELF_HELP
							)
							.map((s) => s.chat.matrixRoomId)
					});
				}

				// Update repetitive chats by id because groupId has changed
				const repetitiveGroupSessions = removedGroupSessions.filter(
					(s) => getModality(s) === Modality.SELF_HELP
				);
				if (repetitiveGroupSessions.length > 0) {
					Promise.all(
						repetitiveGroupSessions.map((s) =>
							apiGetChatRoomById(s.chat.id)
						)
					).then((sessions) => {
						dispatch({
							type: UPDATE_SESSIONS,
							sessions: sessions.reduce<ListItemInterface[]>(
								(acc, { sessions }) => acc.concat(sessions),
								[]
							)
						});
					});
				}
			})
			.catch((e) => {
				// console.log(e);
			});
	}, [dispatch, hasSessionChanged, location?.state, sessions]);

	const [startWatcher, stopWatcher, isWatcherRunning] = useWatcher(
		refreshInactiveGroupSessions,
		5000
	);

	useEffect(() => {
		if (!isWatcherRunning && !isLoading) {
			startWatcher();
		}

		return () => {
			if (isWatcherRunning) {
				stopWatcher();
			}
		};
	}, [isLoading, isWatcherRunning, startWatcher, stopWatcher]);
};
