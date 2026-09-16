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
	apiGetCaseHandoverCandidates,
	apiGetCaseHandoverReasons,
	apiGetConsultantSessionList,
	apiRequestCaseHandoverBatchAccess,
	CaseHandoverReason,
	FETCH_ERRORS,
	SESSION_COUNT
} from '../../api';
import { useLiveChatAvailable } from '../../utils/liveChatToggle';
import { isMatrixRoom } from '../../utils/matrixRoomUtils';
import { Button } from '../button/Button';
import { CaseHandoverCurtainView } from '../session/CaseHandoverCurtain';
import './sessionsList.styles';
import { SCROLL_PAGINATE_THRESHOLD } from './sessionsListConfig';
import clsx from 'clsx';
import useUpdatingRef from '../../hooks/useUpdatingRef';
import { apiGetSessionRoomsByRoomIds } from '../../api/apiGetSessionRooms';
import { useWatcher } from '../../hooks/useWatcher';
import { useSearchParam } from '../../hooks/useSearchParams';
import { apiGetChatRoomById } from '../../api/apiGetChatRoomById';
import { useTranslation } from 'react-i18next';
import { EmptyListItem } from './EmptyListItem';
import { matrixLiveEventBridge } from '../../services/matrixLiveEventBridge';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import {
	buildArchiveTabPath,
	buildCreateGroupChatPath,
	SessionSearchPersonResult,
	SessionsListToolbar,
	DisplayFilterKindChip
} from './SessionsListToolbar';
import {
	draftMatchesSession,
	isAnonymousAskerSession,
	normalizeSessionToolbarChip,
	sessionMatchesToolbar,
	SessionToolbarChipFilter
} from './sessionToolbarFilters';
import {
	buildSearchPeopleResults,
	sessionMatchesAgencies
} from './sessionSearchPeople';
import { useSessionListViewState } from './SessionListViewStateContext';
import { apiGetUserDrafts, IUserDraftItem } from '../../api/apiUserDrafts';
import {
	DRAFTS_UPDATED_EVENT,
	hasDraftContent,
	REMOTE_DRAFT_INDEX_SCOPE
} from '../../services/draftStore';
import { FutureTimelinePanel } from './FutureTimelinePanel';
import { canModerateGroupChat } from '../groupChat/groupChatHelpers';
import { ChatOccurrence } from '../../api/apiGetChatOccurrences';
import { refetchEnquiryListState } from './refetchEnquiryList';
import { createRefreshThrottle, isRoomInSessions } from './liveListRefresh';
import { countUnreadSessions } from '../../utils/sessionUnread';
import { useUnreadVersion } from '../../hooks/useUnreadVersion';
import { useSessionListRail } from './SessionListRailContext';
import { getFormatChipVisibility } from './formatChipVisibility';
import { useResponsive } from '../../hooks/useResponsive';
import { useDisplayFilter } from '../../hooks/useDisplayFilter';
import {
	DisplayFilterDialog,
	DisplayFilterKindOption,
	isDisplayFilterCustomised,
	useDisplayFilterLabels,
	visiblePillKinds,
	reconcileActiveKind,
	listedKinds,
	resolveKindAvailability,
	resolveChipPresentation,
	kindsUnderOther,
	matchesOtherChip,
	OTHER_KIND_ID
} from '../displayFilter';
import { M3Snackbar } from '../m3Snackbar/M3Snackbar';
import {
	applyRequestsFilter,
	applySessionsFilter,
	classifyRequest,
	classifySession,
	isKindShown,
	REQUEST_KIND_ORDER,
	SESSION_KIND_CHIP,
	SESSION_KIND_ORDER,
	sessionPairId
} from '../../utils/displayFilter/sessions';
import { isChatItemUnread } from '../../utils/sessionUnread';
import {
	SESSION_KIND_ICONS,
	sessionKindLabel
} from '../displayFilter/kindOptions';

/** Keep paging while the display filter hides rows and fewer than this are visible (§5.2). */
const MIN_VISIBLE_SESSION_ROWS = 10;
const SESSIONS_DISPLAY_FILTER_DIALOG_ID = 'sessions-display-filter-dialog';

const withDraftScopeParam = (path: string, draftScopeKey: string) => {
	const [basePath, queryString = ''] = path.split('?');
	const query = new URLSearchParams(queryString);
	query.delete('embeddedNotifications');
	query.set('draftScopeKey', draftScopeKey);
	const finalQuery = query.toString();
	return `${basePath}${finalQuery ? `?${finalQuery}` : ''}`;
};

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
	translate: (key: string, fallback?: string) => string;
}) => (
	<button
		type="button"
		className="sessionsListDraftItem"
		data-cy="sessions-list-draft-item"
		onClick={() => onOpen(draft)}
		disabled={!draft.actionPath}
	>
		<span className="sessionsListDraftItem__tag">
			{translate('sessionList.toolbar.chips.drafts', 'Drafts')}
		</span>
		<span className="sessionsListDraftItem__title">
			{draft.title || translate('drafts.center.untitledChat', 'Chat')}
		</span>
		<span className="sessionsListDraftItem__meta">
			{formatDraftTime(draft.updatedAt)}
		</span>
		<span className="sessionsListDraftItem__hint">
			{translate(
				'sessionList.toolbar.draftMetadataOnly',
				'Unsent message saved'
			)}
		</span>
	</button>
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
	const navigate = useNavigate();
	const location = useLocation();

	const initialId = useUpdatingRef(groupIdFromParam || sessionIdFromParam);
	const hasAutoOpenedRef = useRef(false);

	const internalListRef = useRef<HTMLDivElement | null>(null);
	const listRef = scrollContainerRef ?? internalListRef;

	const { sessions, dispatch } = useContext(SessionsDataContext);
	const { type, path: listPath } = useContext(SessionTypeContext);
	const { setSessionListViewState } = useSessionListViewState();

	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');

	// Unread axis (#1147): re-render when Matrix notification counts or read
	// receipts change so the toolbar filter/counter and list items update.
	const unreadVersion = useUnreadVersion();

	const { userData } = useContext(UserDataContext);
	const tenantData = useTenant();

	const [isLoading, setIsLoading] = useState(true);
	const [currentOffset, setCurrentOffset] = useState(0);
	const [totalItems, setTotalItems] = useState(0);
	const [isReloadButtonVisible, setIsReloadButtonVisible] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const abortController = useRef<AbortController>(null);
	const [sessionToolbarSearch, setSessionToolbarSearch] = useState('');
	const [sessionToolbarSelectedTopic, setSessionToolbarSelectedTopic] =
		useState<string | null>(null);
	const [sessionToolbarSelectedAgencies, setSessionToolbarSelectedAgencies] =
		useState<string[]>([]);
	const [sessionToolbarSelectedPeople, setSessionToolbarSelectedPeople] =
		useState<string[]>([]);
	const [caseHandoverCandidateSessions, setCaseHandoverCandidateSessions] =
		useState<ListItemInterface[]>([]);
	const [userDrafts, setUserDrafts] = useState<IUserDraftItem[]>([]);
	const [caseHandoverBatchMode, setCaseHandoverBatchMode] = useState(false);
	const [caseHandoverReviewOpen, setCaseHandoverReviewOpen] = useState(false);
	const [caseHandoverWizardStep, setCaseHandoverWizardStep] = useState<
		'reason' | 'describe'
	>('reason');
	const [caseHandoverSelectedIds, setCaseHandoverSelectedIds] = useState<
		number[]
	>([]);
	const [caseHandoverReasons, setCaseHandoverReasons] = useState<
		CaseHandoverReason[]
	>([]);
	const [caseHandoverReasonCode, setCaseHandoverReasonCode] = useState('');
	const [caseHandoverExplanation, setCaseHandoverExplanation] = useState('');
	const [caseHandoverBatchSubmitting, setCaseHandoverBatchSubmitting] =
		useState(false);
	const [caseHandoverBatchSummary, setCaseHandoverBatchSummary] =
		useState('');
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
	const [liveChatAvailable] = useLiveChatAvailable();
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
	// The kind options are built further down (they need the unread counts);
	// the toolbar predicate above them reads the latest list through a ref.
	const displayFilterKindsForOther = useRef<DisplayFilterKindOption[]>([]);
	const [displayFilterOpen, setDisplayFilterOpen] = useState(false);
	const { untilL } = useResponsive();

	const fetchEnquirySessionsWithAutoPage = useCallback(
		(
			offset: number,
			initialID?: string,
			count?: number,
			signal?: AbortSignal
		): Promise<{ sessions: ListItemInterface[]; total: number }> => {
			const pageSize = count ?? SESSION_COUNT;

			const fetchPage = (
				pageOffset: number
			): Promise<{ sessions: ListItemInterface[]; total: number }> =>
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
							return { sessions, total };
						}

						return fetchPage(pageOffset + pageSize).then(
							({ sessions: moreSessions, total: nextTotal }) => ({
								sessions: [...sessions, ...moreSessions],
								total: nextTotal
							})
						);
					}

					if (
						type !== SESSION_LIST_TYPES.ENQUIRY ||
						sessions.length === 0 ||
						total <= pageOffset + sessions.length
					) {
						return { sessions, total };
					}

					const chip = sessionToolbarChipRef.current;
					if (chip !== 'nearby' && chip !== 'liveChat') {
						return { sessions, total };
					}

					const anyMatch = sessions.some((raw) => {
						const isAnon = isAnonymousAskerSession(
							raw,
							{} as ExtendedSessionInterface
						);
						return chip === 'liveChat' ? isAnon : !isAnon;
					});
					const pagesFetched =
						(pageOffset + sessions.length) / SESSION_COUNT;
					if (anyMatch || pagesFetched >= 10) {
						return { sessions, total };
					}

					return fetchPage(pageOffset + sessions.length).then(
						({ sessions: moreSessions, total: nextTotal }) => ({
							sessions: [...sessions, ...moreSessions],
							total: nextTotal
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

			abortController.current = new AbortController();

			return fetchEnquirySessionsWithAutoPage(
				offset,
				initialID,
				count,
				abortController.current.signal
			).then(({ sessions, total }) => {
				const pageSize = count ?? SESSION_COUNT;
				const lastLoadedOffset =
					offset + Math.max(0, sessions.length - pageSize);
				setCurrentOffset(lastLoadedOffset);
				setTotalItems(total);
				setIsRequestInProgress(false);
				return { sessions, total };
			});
		},
		[fetchEnquirySessionsWithAutoPage]
	);

	const refetchEnquiryList = useCallback(() => {
		if (type !== SESSION_LIST_TYPES.ENQUIRY) {
			return Promise.resolve();
		}

		return refetchEnquiryListState({
			fetchPage: () => fetchEnquirySessionsWithAutoPage(0),
			replaceSessions: (sessions) => {
				dispatch({
					type: SET_SESSIONS,
					ready: true,
					sessions
				});
			},
			setTotalItems,
			setCurrentOffset
		});
	}, [dispatch, fetchEnquirySessionsWithAutoPage, type]);

	const refetchSessionList = useCallback(() => {
		if (type !== SESSION_LIST_TYPES.MY_SESSION) {
			return Promise.resolve();
		}

		return getConsultantSessionList(0)
			.then(({ sessions, total }) => {
				dispatch({
					type: SET_SESSIONS,
					ready: true,
					sessions
				});
				setTotalItems(total);
				setCurrentOffset(0);
			})
			.catch(() => {});
	}, [dispatch, getConsultantSessionList, type]);

	/*
	 * Re-run the enquiry fetch when switching Nearby ↔ Live Chat so auto-paging
	 * scans for the right session type instead of only re-filtering stale pages.
	 */
	useEffect(() => {
		if (type !== SESSION_LIST_TYPES.ENQUIRY) {
			return;
		}
		if (
			sessionToolbarChip !== 'liveChat' &&
			sessionToolbarChip !== 'nearby'
		) {
			return;
		}
		if (skipChipRefetchRef.current) {
			skipChipRefetchRef.current = false;
			return;
		}

		setIsLoading(true);
		getConsultantSessionList(0)
			.then(({ sessions }) => {
				dispatch({
					type: SET_SESSIONS,
					ready: true,
					sessions
				});
			})
			.catch(() => {})
			.finally(() => setIsLoading(false));
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
			getConsultantSessionList(0, initialId.current)
				.then(({ sessions }) => {
					// console.log('📦 CONSULTANT: Got', sessions?.length, 'sessions');
					dispatch({
						type: UPDATE_SESSIONS,
						ready: true,
						sessions
					});
					return refreshLoadedSessionsWithRoomState(sessions);
				})
				.catch((error) => {
					// console.error('❌ CONSULTANT: Error fetching sessions:', error);
					setIsLoading(false);
				})
				.then(() => setIsLoading(false))
				.then(() => {
					if (initialId.current) {
						setTimeout(() => {
							scrollIntoView();
						});
					}
				})
				.catch((error) => {
					if (error.message === FETCH_ERRORS.ABORT) {
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

	/*
	 * Legacy invite-link enquiries do not emit newAnonymousEnquiry over STOMP.
	 * Poll while Live Chat is selected (without aborting the main list fetch).
	 */
	useEffect(() => {
		if (type !== SESSION_LIST_TYPES.ENQUIRY) {
			return;
		}
		if (sessionToolbarChip !== 'liveChat') {
			return;
		}

		const intervalId = window.setInterval(() => {
			refetchEnquiryList();
		}, 15000);
		return () => window.clearInterval(intervalId);
	}, [refetchEnquiryList, sessionToolbarChip, type]);

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
	// entry point, for a format this Träger has switched off.
	const {
		createGroupChat: showCreateGroupChatAction,
		groups: showGroupChip,
		internalGroup: showInternalGroupChip
	} = getFormatChipVisibility(tenantData, showConsultantToolbarActions);
	const showCaseHandoverBatchUi =
		showConsultantToolbarActions &&
		sessionListTab !== SESSION_LIST_TAB_ARCHIVE;

	const showMySessionToolbar =
		type === SESSION_LIST_TYPES.MY_SESSION ||
		type === SESSION_LIST_TYPES.ENQUIRY;
	const visibleUserDrafts = React.useMemo(
		() =>
			userDrafts.filter(
				(draft) =>
					draft.scopeKey !== REMOTE_DRAFT_INDEX_SCOPE &&
					// #976: zero-content rows persisted by older builds still sit
					// in the backend. They can never be opened, so they must not
					// keep the drafts badge lit either.
					hasDraftContent(draft.text)
			),
		[userDrafts]
	);
	useEffect(() => {
		const query = sessionToolbarSearch.trim();

		if (!showConsultantToolbarActions) {
			setCaseHandoverCandidateSessions([]);
			return;
		}

		if (!query) {
			setCaseHandoverCandidateSessions([]);
			return;
		}

		const controller = new AbortController();
		const timeoutId = window.setTimeout(() => {
			apiGetCaseHandoverCandidates({
				query,
				count: 50,
				archived: sessionListTab === SESSION_LIST_TAB_ARCHIVE,
				signal: controller.signal
			})
				.then(({ sessions: candidateSessions }) => {
					setCaseHandoverCandidateSessions(candidateSessions || []);
				})
				.catch((error) => {
					if (error?.message !== FETCH_ERRORS.ABORT) {
						setCaseHandoverCandidateSessions([]);
					}
				});
		}, 250);

		return () => {
			window.clearTimeout(timeoutId);
			controller.abort();
		};
	}, [sessionListTab, sessionToolbarSearch, showConsultantToolbarActions]);
	const loadUserDrafts = useCallback(async () => {
		if (!showMySessionToolbar) {
			setUserDrafts([]);
			return;
		}

		const response = await apiGetUserDrafts(0, 200).catch(() => null);
		setUserDrafts(response?.items || []);
	}, [showMySessionToolbar]);

	useEffect(() => {
		if (!showMySessionToolbar) {
			setUserDrafts([]);
			return;
		}

		void loadUserDrafts();

		const handleDraftsUpdated = () => {
			void loadUserDrafts();
		};
		const intervalId = window.setInterval(loadUserDrafts, 60000);
		window.addEventListener('focus', handleDraftsUpdated);
		window.addEventListener(
			DRAFTS_UPDATED_EVENT,
			handleDraftsUpdated as EventListener
		);

		return () => {
			window.clearInterval(intervalId);
			window.removeEventListener('focus', handleDraftsUpdated);
			window.removeEventListener(
				DRAFTS_UPDATED_EVENT,
				handleDraftsUpdated as EventListener
			);
		};
	}, [loadUserDrafts, showMySessionToolbar]);

	useEffect(() => {
		if (!caseHandoverBatchMode) {
			return;
		}
		apiGetCaseHandoverReasons()
			.then((items) => {
				setCaseHandoverReasons(items || []);
				setCaseHandoverReasonCode((current) =>
					items?.some((item) => item.code === current) ? current : ''
				);
			})
			.catch(() => {
				setCaseHandoverReasons([]);
			});
	}, [caseHandoverBatchMode]);

	const handleOpenDraft = useCallback(
		(draft: IUserDraftItem) => {
			if (!draft.actionPath) {
				return;
			}
			navigate(withDraftScopeParam(draft.actionPath, draft.scopeKey));
		},
		[navigate]
	);
	const translateWithFallback = useCallback(
		(key: string, fallback?: string) => {
			const translated = fallback
				? translate(key, { defaultValue: fallback })
				: translate(key);
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
	const finalSessionsList = React.useMemo(() => {
		const baseSessions = (sessions || []).filter(filterSessions);
		if (caseHandoverCandidateSessions.length === 0) {
			return baseSessions;
		}

		const baseSessionIds = new Set(
			baseSessions
				.map((session) => session.session?.id || session.chat?.id)
				.filter(Boolean)
				.map(String)
		);
		const candidates = caseHandoverCandidateSessions
			.filter(filterSessions)
			.filter((session) => {
				const id = session.session?.id || session.chat?.id;
				return id !== undefined && !baseSessionIds.has(String(id));
			});

		return [...candidates, ...baseSessions];
	}, [caseHandoverCandidateSessions, filterSessions, sessions]);
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
		sessionToolbarPairs.forEach(({ extended }) => {
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
	}, [sessionToolbarPairs]);
	const isSessionListItemActive = useCallback(
		(session: ExtendedSessionInterface) =>
			(session?.rid && session.rid === groupIdFromParam) ||
			(session?.item?.id !== undefined &&
				String(session.item.id) === String(sessionIdFromParam || '')),
		[groupIdFromParam, sessionIdFromParam]
	);
	// #1377 §5.2/§5.3: the display filter runs after `filterSessions` and
	// before the toolbar chip, so the chip refinement composes on top. The
	// route-active row survives (dimmed) while its kind is hidden. All of it
	// is memoised: unread/receipt events re-render this list often.
	const canSupervise =
		showConsultantToolbarActions &&
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData);
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
				matchesOtherChip(
					listDisplayFilter,
					displayFilterKindsForOther.current,
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
				sessionToolbarSearch,
				sessionToolbarChip === 'other' ? null : sessionToolbarChip,
				sessionToolbarSelectedPeople,
				visibleUserDrafts,
				currentUserId
			) &&
			sessionMatchesAgencies(
				raw,
				sessionToolbarSelectedAgencies.map(Number)
			) &&
			(!sessionToolbarSelectedTopic ||
				String(
					(extended?.item?.topic as TopicSessionInterface | null)
						?.id ?? ''
				) === sessionToolbarSelectedTopic),
		[
			canSupervise,
			currentUserId,
			listDisplayFilter,
			sessionToolbarChip,
			sessionToolbarSearch,
			sessionToolbarSelectedAgencies,
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
	const sortedSessionPairs = useMemo(
		() =>
			[...sessionToolbarFilteredPairs].sort((left, right) =>
				sortSessions(left.extended, right.extended)
			),
		[sessionToolbarFilteredPairs, sortSessions]
	);
	const sortedSessions = useMemo(
		() => sortedSessionPairs.map(({ extended }) => extended),
		[sortedSessionPairs]
	);
	const sortedSessionIds = useMemo(
		() => sortedSessionPairs.map(sessionPairId),
		[sortedSessionPairs]
	);
	// The future panel is gated by its own show-only kind, never by the row
	// filter (§5.2): its input is the toolbar-matched set BEFORE the display
	// filter, so hiding "Circles" does not remove the panel.
	const futureSourceSessions = useMemo(
		() =>
			sessionToolbarPairs
				.filter(toolbarMatches)
				.map(({ extended }) => extended)
				.sort(sortSessions),
		[sessionToolbarPairs, sortSessions, toolbarMatches]
	);
	const handleCaseHandoverSelect = useCallback((sessionId: number) => {
		setCaseHandoverSelectedIds((current) =>
			current.includes(sessionId)
				? current.filter((id) => id !== sessionId)
				: [...current, sessionId]
		);
	}, []);
	const handleCloseCaseHandoverBatch = useCallback(() => {
		setCaseHandoverBatchMode(false);
		setCaseHandoverReviewOpen(false);
		setCaseHandoverSelectedIds([]);
		setCaseHandoverExplanation('');
		setCaseHandoverBatchSummary('');
	}, []);
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
		setCaseHandoverBatchSubmitting(true);
		setCaseHandoverBatchSummary('');
		apiRequestCaseHandoverBatchAccess(
			caseHandoverSelectedIds,
			caseHandoverReasonCode,
			caseHandoverExplanation
		)
			.then((results) => {
				const successful = (results || []).filter(
					(result) => result.success
				).length;
				const failed = (results || []).length - successful;
				setCaseHandoverBatchSummary(
					translate('caseHandover.batch.result', {
						successful,
						failed
					})
				);
				setCaseHandoverSelectedIds([]);
				setCaseHandoverReviewOpen(false);
				setCaseHandoverWizardStep('reason');
				void refetchSessionList();
			})
			.catch(() => {
				setCaseHandoverBatchSummary(
					translate('caseHandover.error.failed')
				);
			})
			.finally(() => setCaseHandoverBatchSubmitting(false));
	}, [
		caseHandoverExplanation,
		caseHandoverReasonCode,
		caseHandoverSelectedIds,
		refetchSessionList,
		translate
	]);
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
	const rowsByKind = React.useMemo(() => {
		const counts: Record<string, number> = {};
		sessionToolbarPairs.forEach(({ raw, extended }) => {
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
	}, [canSupervise, sessionToolbarPairs, type, userData?.userId]);
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
	const displayFilterKinds = React.useMemo<DisplayFilterKindOption[]>(() => {
		const order =
			type === SESSION_LIST_TYPES.ENQUIRY
				? REQUEST_KIND_ORDER
				: SESSION_KIND_ORDER;
		// Role/availability gates (not Träger switches): listed or not.
		const listed = (kind: string): boolean => {
			switch (kind) {
				case 'liveChat':
					return liveChatAvailable;
				case 'futureTimeline':
					return showGroupChip;
				case 'supervision':
					return canSupervise;
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
					showOnly: kind === 'futureTimeline',
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
		canSupervise,
		liveChatAvailable,
		rowsByKind,
		showGroupChip,
		showInternalGroupChip,
		translate,
		type,
		unreadByKind
	]);
	displayFilterKindsForOther.current = displayFilterKinds;
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
		const activeKind =
			displayFilterKinds.find(
				(kind) => SESSION_KIND_CHIP[kind.id] === sessionToolbarChip
			)?.id ?? null;
		if (
			activeKind &&
			reconcileActiveKind(listDisplayFilter, activeKind) === null
		) {
			setSessionToolbarChip(null);
		}
	}, [displayFilterKinds, listDisplayFilter, sessionToolbarChip]);
	// Kind chips are user-gated (§5.1): pill on and unread rows, or active.
	const hiddenKindChips = React.useMemo(() => {
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
		const hidden: Partial<Record<DisplayFilterKindChip, boolean>> = {};
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
			drafts: visibleUserDrafts.length
		};
		Object.entries(unreadByKind).forEach(([kind, count]) => {
			const chip = SESSION_KIND_CHIP[kind];
			if (chip) {
				counts[chip] = (counts[chip] ?? 0) + count;
			}
		});
		// Sonstiges bundles the kinds without their own pill (Frank 2026-09-16).
		kindsUnderOther(
			listDisplayFilter,
			displayFilterKindsForOther.current
		).forEach((kind) => {
			counts.other = (counts.other ?? 0) + (unreadByKind[kind] ?? 0);
		});
		return counts;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		displayVisiblePairs,
		hiddenActiveRowIds,
		listDisplayFilter,
		sessionToolbarPairs,
		type,
		unreadByKind,
		visibleUserDrafts.length,
		unreadVersion
	]);
	// A page can be entirely hidden (§5.2): keep paging until enough shows.
	useEffect(() => {
		if (
			!showMySessionToolbar ||
			displayFilterHiddenCount === 0 ||
			displayVisiblePairs.length >= MIN_VISIBLE_SESSION_ROWS ||
			isLoading ||
			isRequestInProgress ||
			isReloadButtonVisible ||
			totalItems <= currentOffset + SESSION_COUNT
		) {
			return;
		}
		loadMoreSessions();
	}, [
		currentOffset,
		displayFilterHiddenCount,
		displayVisiblePairs.length,
		isLoading,
		isReloadButtonVisible,
		isRequestInProgress,
		loadMoreSessions,
		showMySessionToolbar,
		totalItems
	]);
	useEffect(() => {
		setSessionListViewState(type, {
			ready: !isLoading,
			visibleSessionCount: visibleListItemCount
		});
	}, [isLoading, setSessionListViewState, type, visibleListItemCount]);
	/**
	 * #1195 JOB2/JOB5 — clients and counsellors are separate roles, so a session
	 * contributes one row per person instead of one row named after the client
	 * but hard-coded to `Berater:in`.
	 */
	const toolbarSearchPeopleResults: SessionSearchPersonResult[] =
		React.useMemo(
			() =>
				buildSearchPeopleResults(sessionToolbarPairs, {
					asker: translate('sessionList.toolbar.search.role.asker'),
					consultant: translate(
						'sessionList.toolbar.search.role.consultant'
					),
					unknown: translate('sessionList.user.consultantUnknown')
				}),
			[sessionToolbarPairs, translate]
		);
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
	const showSupervisionChip =
		showConsultantToolbarActions &&
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData);
	const toolbarFilteredOutAll =
		showMySessionToolbar &&
		finalSessionsList.length > 0 &&
		visibleListItemCount === 0;
	const futureTimelineSeries = React.useMemo(
		() =>
			futureSourceSessions
				.filter(
					(session) =>
						session.isGroup &&
						session.item.repeatCount !== undefined
				)
				.map((session) => ({
					id: session.item.id,
					canModerate: canModerateGroupChat(session, userData),
					topic:
						typeof session.item.topic === 'string'
							? session.item.topic
							: session.item.topic?.name || 'Group chat'
				})),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[futureSourceSessions, userData]
	);
	const handleDuplicateOccurrence = React.useCallback(
		(occurrence: ChatOccurrence, topic: string) => {
			navigate(buildCreateGroupChatPath(sessionListTab || undefined), {
				state: {
					duplicateOccurrence: {
						topic,
						start: occurrence.start,
						duration: occurrence.duration,
						modality: occurrence.modality
					}
				}
			});
		},
		[navigate, sessionListTab]
	);

	return (
		<div
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
					showLiveChatChip={liveChatAvailable}
				/>
			)} */}
			{showMySessionToolbar && (
				<SessionsListToolbar
					translate={translate}
					searchValue={sessionToolbarSearch}
					onSearchChange={setSessionToolbarSearch}
					searchPeopleResults={toolbarSearchPeopleResults}
					selectedPersonIds={sessionToolbarSelectedPeople}
					onSelectedPersonIdsChange={setSessionToolbarSelectedPeople}
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
					showLiveChatChip={liveChatAvailable}
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
					selectedAgencyIds={sessionToolbarSelectedAgencies}
					onSelectedAgencyIdsChange={
						setSessionToolbarSelectedAgencies
					}
					searchTopicResults={toolbarSearchTopicResults}
					selectedTopicId={sessionToolbarSelectedTopic}
					onSelectedTopicIdChange={setSessionToolbarSelectedTopic}
					searchTypeResults={[
						{
							id: 'nearby',
							label: translate('sessionList.toolbar.chips.nearby')
						},
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
					open={displayFilterOpen}
					fullScreen={untilL}
					onClose={() => setDisplayFilterOpen(false)}
					kinds={displayFilterKinds}
					value={listDisplayFilter}
					canReset={listDisplayOverride !== null}
					readOnly={displayFilterReadOnly || !canEditDisplayFilter}
					showAutoRead={type === SESSION_LIST_TYPES.MY_SESSION}
					onChange={setListDisplayOverride}
					onReset={resetListDisplayOverride}
					onOpenProfile={() => {
						setDisplayFilterOpen(false);
						navigate('/profile/notifications/browser');
					}}
					labels={displayFilterLabels.dialogLabels}
				/>
			)}
			{showMySessionToolbar &&
				futureTimelineSeries.length > 0 &&
				(type !== SESSION_LIST_TYPES.MY_SESSION ||
					isKindShown(listDisplayFilter, 'futureTimeline')) && (
					<FutureTimelinePanel
						series={futureTimelineSeries}
						consultantId={userData.userId}
						includeAppointments={sessionToolbarChip === null}
						onDuplicateOccurrence={handleDuplicateOccurrence}
					/>
				)}
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
					<div
						className="sessionsList__caseHandoverWizardOverlay"
						role="dialog"
						aria-modal="true"
						aria-label={translate('caseHandover.batch.title')}
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
									onClick={() => {
										setCaseHandoverReviewOpen(false);
										setCaseHandoverWizardStep('reason');
									}}
								>
									{translate('caseHandover.batch.cancel')}
								</button>
							</div>
							<CaseHandoverCurtainView
								step={caseHandoverWizardStep}
								reasons={caseHandoverReasons}
								reasonCode={caseHandoverReasonCode}
								explanation={caseHandoverExplanation}
								isSubmitting={caseHandoverBatchSubmitting}
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
								onExplanationChange={setCaseHandoverExplanation}
								onSubmit={handleSubmitCaseHandoverBatch}
							/>
						</div>
					</div>
				)}
			<div className="sessionsList__scrollArea">
				<div
					className={clsx('sessionsList__scrollContainer', {
						'sessionsList__scrollContainer--hasToolbar':
							showMySessionToolbar,
						'sessionRailList': isRail
					})}
					ref={listRef}
					role={isRail ? 'tablist' : undefined}
					aria-orientation={isRail ? 'vertical' : undefined}
					aria-label={
						isRail
							? translate('sessionList.view.headline')
							: undefined
					}
					onScroll={handleListScroll}
				>
					{(!isLoading || finalSessionsList.length > 0) &&
						sortedSessions.map(
							(
								activeSession: ExtendedSessionInterface,
								index
							) => (
								<ActiveSessionProvider
									key={activeSession.item.id}
									activeSession={activeSession}
								>
									<div
										className={clsx(
											hiddenActiveRowIds.has(
												sortedSessionIds[index]
											) && 'sessionsList__hiddenActiveRow'
										)}
									>
										{hiddenActiveRowIds.has(
											sortedSessionIds[index]
										) && (
											<p
												className="sessionsList__hiddenActiveRowHint"
												role="status"
											>
												{translate(
													'notifications.displayFilter.hiddenActiveRow'
												)}
											</p>
										)}
										<SessionListItemComponent
											defaultLanguage={defaultLanguage}
											itemRef={(el) =>
												(ref_list_array.current[index] =
													el)
											}
											handleKeyDownLisItemContent={(e) =>
												handleKeyDownLisItemContent(
													e,
													index
												)
											}
											index={index}
											isBeforeActive={
												!!sortedSessions[index + 1] &&
												isSessionListItemActive(
													sortedSessions[index + 1]
												)
											}
											isAfterActive={
												!!sortedSessions[index - 1] &&
												isSessionListItemActive(
													sortedSessions[index - 1]
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
												setCaseHandoverBatchMode(true);
												setCaseHandoverReviewOpen(
													false
												);
												setCaseHandoverBatchSummary('');
											}}
											onCaseHandoverBatchConfirm={() =>
												setCaseHandoverReviewOpen(true)
											}
											onCaseHandoverBatchClose={
												handleCloseCaseHandoverBatch
											}
										/>
									</div>
								</ActiveSessionProvider>
							)
						)}

					{!isLoading &&
						sessionToolbarChip === 'drafts' &&
						unmatchedDrafts.map((draft) => (
							<DraftMetadataListItem
								key={draft.scopeKey}
								draft={draft}
								onOpen={handleOpenDraft}
								translate={translateWithFallback}
							/>
						))}

					{isLoading && <SessionsListSkeleton />}

					{isReloadButtonVisible && (
						<div className="sessionsList__reloadWrapper">
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
