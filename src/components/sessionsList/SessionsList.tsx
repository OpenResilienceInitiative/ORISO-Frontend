import * as React from 'react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import {
	getChatItemForSession,
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
	RocketChatContext,
	SessionsDataContext,
	SessionTypeContext,
	SET_SESSIONS,
	UPDATE_SESSIONS,
	UserDataContext,
	ActiveSessionProvider
} from '../../globalState';
import {
	ListItemInterface,
	STATUS_EMPTY,
	TopicSessionInterface
} from '../../globalState/interfaces';
import { SessionListItemComponent } from '../sessionsListItem/SessionListItemComponent';
import { SessionsListSkeleton } from '../sessionsListItem/SessionsListItemSkeleton';
import {
	apiGetAskerSessionList,
	apiGetConsultantSessionList,
	FETCH_ERRORS,
	SESSION_COUNT
} from '../../api';
import { useLiveChatAvailable } from '../../utils/liveChatToggle';
import { Button } from '../button/Button';
import './sessionsList.styles';
import { SCROLL_PAGINATE_THRESHOLD } from './sessionsListConfig';
import clsx from 'clsx';
import useUpdatingRef from '../../hooks/useUpdatingRef';
import useDebounceCallback from '../../hooks/useDebounceCallback';
import {
	EVENT_ROOMS_CHANGED,
	EVENT_SUBSCRIPTIONS_CHANGED,
	SUB_STREAM_NOTIFY_USER
} from '../app/RocketChat';
import { getValueFromCookie } from '../sessionCookie/accessSessionCookie';
import { apiGetSessionRoomsByGroupIds } from '../../api/apiGetSessionRooms';
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
	SessionToolbarChipFilter,
	SessionsListToolbar
} from './SessionsListToolbar';
import { EnquiryFilterChips } from './EnquiryFilterChips';

function buildSessionSearchHaystack(
	raw: ListItemInterface,
	extended: ExtendedSessionInterface
): string {
	const parts: string[] = [];
	const item = extended.item;
	if (item?.topic) {
		parts.push(
			typeof item.topic === 'string'
				? item.topic
				: (item.topic as TopicSessionInterface).name || ''
		);
	}
	if (item) {
		if ('lastMessage' in item && item.lastMessage) {
			parts.push(String(item.lastMessage));
		}
		if ('e2eLastMessage' in item && item.e2eLastMessage?.msg) {
			parts.push(String(item.e2eLastMessage.msg));
		}
		if ('hintMessage' in item && item.hintMessage) {
			parts.push(String(item.hintMessage));
		}
	}
	if (raw.latestMessage) {
		parts.push(String(raw.latestMessage));
	}
	if (raw.user?.username) {
		parts.push(raw.user.username);
	}
	if (raw.consultant?.displayName) {
		parts.push(raw.consultant.displayName);
	}
	if (raw.consultant?.username) {
		parts.push(raw.consultant.username);
	}
	if (raw.agency?.name) {
		parts.push(raw.agency.name);
	}
	return parts.filter(Boolean).join(' ');
}

/**
 * Anonymous-chat sessions are identified by the ORISO convention that the
 * asker's keycloak username is prefixed `Anonymous-` (capital A — the
 * pseudonym-registration flow writes that). Using just the prefix keeps the
 * split clean even though all sessions in this deployment share the same
 * registrationType + `postcode='00000'` on the DB side.
 */
function isAnonymousAskerSession(
	raw: ListItemInterface,
	_extended: ExtendedSessionInterface
): boolean {
	const candidates = [
		(raw as any)?.user?.username,
		(raw as any)?.session?.askerUserName,
		(raw as any)?.consultant?.username
	];
	return candidates.some(
		(u) => typeof u === 'string' && u.startsWith('Anonymous-')
	);
}

function sessionMatchesToolbar(
	raw: ListItemInterface,
	extended: ExtendedSessionInterface,
	query: string,
	chip: SessionToolbarChipFilter | null,
	selectedPersonIds: string[],
	currentUserId?: string
): boolean {
	const chatItem = getChatItemForSession(raw);

	/*
	 * Enquiry-feed axis (Anfragen tab):
	 *   - chip === 'liveChat' → only anonymous asker sessions
	 *   - chip === 'chats'    → only NON-anonymous sessions
	 *   - anything else / null → don't filter on this axis
	 * Runs client-side against the /enquiries/registered feed because this
	 * install doesn't populate registration_type=ANONYMOUS in the DB.
	 */
	const isAnonymous = isAnonymousAskerSession(raw, extended);
	if (chip === 'liveChat' && !isAnonymous) {
		return false;
	}
	if (chip === 'chats' && isAnonymous) {
		return false;
	}

	if (chip === 'neu') {
		if (!chatItem || chatItem.messagesRead !== false) {
			return false;
		}
	} else if (chip === 'oneToOne') {
		if (extended.isGroup) {
			return false;
		}
	} else if (chip === 'groups') {
		if (!extended.isGroup) {
			return false;
		}
	} else if (chip === 'supervision') {
		if (!raw.consultant?.id) {
			return false;
		}
		if (String(raw.consultant.id) === String(currentUserId || '')) {
			// Assigned consultant chats are excluded; only supervised chats remain.
			return false;
		}
	}

	const toolbarPersonId =
		String(raw.session?.id || raw.chat?.id || '') ||
		String(raw.chat?.groupId || '') ||
		String(extended.item?.id || '');
	if (selectedPersonIds.length > 0) {
		if (!toolbarPersonId || !selectedPersonIds.includes(toolbarPersonId)) {
			return false;
		}
	}

	const q = query.trim().toLowerCase();
	if (!q) {
		return true;
	}
	return buildSessionSearchHaystack(raw, extended).toLowerCase().includes(q);
}

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

	const { rcGroupId: groupIdFromParam, sessionId: sessionIdFromParam } =
		useParams<{ rcGroupId: string; sessionId: string }>();
	const history = useHistory();
	const location = useLocation();

	const initialId = useUpdatingRef(groupIdFromParam || sessionIdFromParam);
	const hasAutoOpenedRef = useRef(false);

	const rcUid = useRef(getValueFromCookie('rc_uid'));
	const internalListRef = useRef<HTMLDivElement | null>(null);
	const listRef = scrollContainerRef ?? internalListRef;

	const { sessions, dispatch } = useContext(SessionsDataContext);
	const { type, path: listPath } = useContext(SessionTypeContext);

	const {
		subscribe,
		unsubscribe,
		ready: socketReady
	} = useContext(RocketChatContext);

	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');

	const { userData } = useContext(UserDataContext);

	const [isLoading, setIsLoading] = useState(true);
	const [currentOffset, setCurrentOffset] = useState(0);
	const [totalItems, setTotalItems] = useState(0);
	const [isReloadButtonVisible, setIsReloadButtonVisible] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const abortController = useRef<AbortController>(null);
	const [sessionToolbarSearch, setSessionToolbarSearch] = useState('');
	const [sessionToolbarSelectedPeople, setSessionToolbarSelectedPeople] =
		useState<string[]>([]);
	/**
	 * Initial chip selection:
	 *   - enquiry list: honour ?chip=liveChat in the URL (sidebar toggle
	 *     deep-link), otherwise default to 'chats' so the tab opens on the
	 *     registered enquiries feed
	 *   - my-session list: no default chip
	 */
	const readChipFromUrl = (): SessionToolbarChipFilter | null => {
		try {
			const params = new URLSearchParams(window.location.search);
			const fromUrl = params.get('chip');
			if (fromUrl === 'liveChat' || fromUrl === 'chats') {
				return fromUrl;
			}
		} catch {
			/* ignore */
		}
		return null;
	};

	const [sessionToolbarChip, setSessionToolbarChip] =
		useState<SessionToolbarChipFilter | null>(() => {
			if (type !== SESSION_LIST_TYPES.ENQUIRY) return null;
			return readChipFromUrl() ?? 'chats';
		});
	/*
	 * Ref-mirror of the toolbar chip so the memoised `getConsultantSessionList`
	 * can read the current filter without taking a dep (and restarting the
	 * fetch whenever the user swaps tabs). Used to auto-page past all-anonymous
	 * first pages when Chats is selected, and vice versa.
	 */
	const sessionToolbarChipRef = useRef<SessionToolbarChipFilter | null>(
		sessionToolbarChip
	);
	useEffect(() => {
		sessionToolbarChipRef.current = sessionToolbarChip;
	}, [sessionToolbarChip]);

	/**
	 * Keep the chip in sync with `?chip=…` changes after mount — this fires
	 * when the sidebar livechat toggle deep-links to the enquiry tab while
	 * we're already on it.
	 */
	useEffect(() => {
		if (type !== SESSION_LIST_TYPES.ENQUIRY) return;
		const fromUrl = readChipFromUrl();
		if (fromUrl && fromUrl !== sessionToolbarChip) {
			setSessionToolbarChip(fromUrl);
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

			return apiGetConsultantSessionList({
				type,
				offset,
				sessionListTab: sessionListTab,
				count: count ?? SESSION_COUNT,
				signal: abortController.current.signal
			})
				.then(({ sessions, total }) => {
					if (!initialID) {
						return { sessions, total };
					}

					// Check if selected room already loaded
					if (
						getExtendedSession(initialID, sessions) ||
						total <= offset + SESSION_COUNT
					) {
						return {
							sessions,
							total
						};
					}

					return getConsultantSessionList(
						offset + SESSION_COUNT,
						initialID
					).then(({ sessions: moreSessions, total }) => {
						return {
							sessions: [...sessions, ...moreSessions],
							total
						};
					});
				})
				.then(({ sessions, total }) => {
					/*
					 * Auto-page past all-anonymous (or all-registered) first
					 * pages on the Enquiry tab so the selected chip filter
					 * isn't empty when it has matches further down the feed.
					 * Scroll-triggered fetches (offset > 0) and explicit
					 * initialID lookups run above; this branch only fires for
					 * the implicit "initial fetch" case.
					 */
					if (
						!initialID &&
						type === SESSION_LIST_TYPES.ENQUIRY &&
						sessions.length > 0 &&
						total > offset + sessions.length
					) {
						const chip = sessionToolbarChipRef.current;
						if (chip === 'chats' || chip === 'liveChat') {
							const anyMatch = sessions.some((raw) => {
								const isAnon = isAnonymousAskerSession(
									raw,
									{} as ExtendedSessionInterface
								);
								return chip === 'liveChat' ? isAnon : !isAnon;
							});
							/* Cap at 10 pages so a consultant with thousands
							   of one-sided enquiries can't hang the list. */
							const pagesFetched =
								(offset + sessions.length) / SESSION_COUNT;
							if (!anyMatch && pagesFetched < 10) {
								return getConsultantSessionList(
									offset + sessions.length
								).then(
									({ sessions: moreSessions, total: t }) => ({
										sessions: [
											...sessions,
											...moreSessions
										],
										total: t
									})
								);
							}
						}
					}
					return { sessions, total };
				})
				.then(({ sessions, total }) => {
					const pageSize = count ?? SESSION_COUNT;
					/* When the Enquiry auto-pager above fetched extra pages,
					   sessions.length > pageSize — advance currentOffset to
					   the start of the deepest page so loadMoreSessions
					   doesn't re-fetch what's already in state. */
					const lastLoadedOffset =
						offset + Math.max(0, sessions.length - pageSize);
					setCurrentOffset(lastLoadedOffset);
					setTotalItems(total);
					setIsRequestInProgress(false);
					return { sessions, total };
				});
		},
		/* eslint-disable-next-line react-hooks/exhaustive-deps */
		[sessionListTab, type, liveChatAvailable]
	);

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
						session?.chat?.groupId || session?.session?.groupId
				)
				.filter(Boolean) as string[];

			if (!rids.length) {
				return Promise.resolve();
			}

			return apiGetSessionRoomsByGroupIds(rids)
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
						const groupId = session?.session?.groupId;
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

							// Check if groupId looks like a Matrix room ID (starts with ! or contains :)
							const isMatrixRoomId =
								groupId &&
								(groupId.startsWith('!') ||
									groupId.includes(':'));

							if (isEmptyEnquiry) {
								// Empty enquiry: go to write view
								const targetPath = `${baseListPath}/write/${sessionId}`;
								// console.log('🚀 Navigating to write view:', targetPath);
								history.push(targetPath);
							} else if (groupId && !isMatrixRoomId) {
								// Original RocketChat behavior: navigate with groupId
								const targetPath = `${baseListPath}/${groupId}/${sessionId}`;
								// console.log('🚀 Navigating with groupId:', targetPath);
								history.push(targetPath);
							} else {
								// MATRIX MIGRATION FIX: Navigate by session ID for Matrix rooms or sessions without groupId
								const targetPath = `${baseListPath}/session/${sessionId}`;
								// console.log('🚀 Navigating by session ID:', targetPath);
								history.push(targetPath);
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
	// Refresh myself
	const subscribed = useRef(false);

	const handleRIDs = useCallback(
		(rids: string[]) => {
			const loadedSessions = sessions;
			/*
			Always try to get each subscription from the backend because closed
			group chats still in sessions but removed in rocket.chat
			 */
			Promise.all(
				rids.map((rid) => {
					// Get session from api
					return apiGetSessionRoomsByGroupIds([rid])
						.then(({ sessions }) => {
							const session = sessions[0];

							if (!session) {
								const loadedSession = loadedSessions.find(
									(s) => s?.chat?.groupId === rid
								);
								// If repetitive group chat reload it by id because groupId has changed
								if (loadedSession?.chat?.repetitive) {
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
								(s) => s?.chat?.groupId === rid
							);
							// If repetitive group chat reload it by id because groupId has changed
							if (loadedSession?.chat?.repetitive) {
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

	const touchSessionsByRids = useCallback(
		(ridsWithTimestamp: Array<{ rid: string; timestamp: number }>) => {
			if (!ridsWithTimestamp.length) {
				return;
			}

			const touchedSessions = ridsWithTimestamp
				.map(({ rid, timestamp }) => {
					const existingSession = sessions.find(
						(s) =>
							s?.chat?.groupId === rid ||
							s?.session?.groupId === rid ||
							(s?.session as { matrixRoomId?: string })
								?.matrixRoomId === rid
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

	const onRoomsChanged = useCallback(
		(args) => {
			if (args.length === 0) return;

			const roomEvents = args
				// Get all collected roomEvents
				.map(([roomEvent]) => roomEvent)
				.filter(([, room]) => room._id !== 'GENERAL')
				// Reduce all room events of the same room to a single roomEvent
				.reduce((acc, [event, room]) => {
					const index = acc.findIndex(([, r]) => r._id === room._id);
					if (index < 0) {
						acc.push([event, room]);
					} else {
						// Keep last event because insert/update is equal
						// only removed is different
						acc.splice(index, 1, [event, room]);
					}
					return acc;
				}, []);

			if (roomEvents.length === 0) return;

			touchSessionsByRids(
				roomEvents.map(([, room]) => {
					const rawTimestamp =
						room?.lm?.$date ||
						room?.lm ||
						room?.lastMessage?.ts?.$date ||
						room?.lastMessage?.ts ||
						room?.ts?.$date ||
						room?.ts ||
						room?._updatedAt?.$date ||
						room?._updatedAt ||
						Date.now();
					const parsedTimestamp = Number.isNaN(Number(rawTimestamp))
						? Date.parse(rawTimestamp)
						: Number(rawTimestamp);

					return {
						rid: room._id,
						timestamp:
							!parsedTimestamp || Number.isNaN(parsedTimestamp)
								? Date.now()
								: parsedTimestamp
					};
				})
			);

			handleRIDs(roomEvents.map(([, room]) => room._id));
		},
		[handleRIDs, touchSessionsByRids]
	);

	const onSubscriptionsChanged = useCallback(
		(args) => {
			if (args.length === 0) return;

			const subscriptionEvents = args
				// Get all collected roomEvents
				.map(([subscriptionEvent]) => subscriptionEvent)
				.filter(([, subscription]) => subscription.rid !== 'GENERAL')
				// Reduce all room events of the same room to a single roomEvent
				.reduce((acc, [event, subscription]) => {
					const index = acc.findIndex(
						([, r]) => r.rid === subscription.rid
					);
					if (index < 0) {
						acc.push([event, subscription]);
					} else {
						// Keep last event because insert/update is equal
						// only removed is different
						acc.splice(index, 1, [event, subscription]);
					}
					return acc;
				}, []);

			if (subscriptionEvents.length === 0) return;

			touchSessionsByRids(
				subscriptionEvents.map(([, subscription]) => {
					const rawTimestamp =
						subscription?.ts?.$date ||
						subscription?.ts ||
						subscription?._updatedAt?.$date ||
						subscription?._updatedAt ||
						Date.now();
					const parsedTimestamp = Number.isNaN(Number(rawTimestamp))
						? Date.parse(rawTimestamp)
						: Number(rawTimestamp);

					return {
						rid: subscription.rid,
						timestamp:
							!parsedTimestamp || Number.isNaN(parsedTimestamp)
								? Date.now()
								: parsedTimestamp
					};
				})
			);

			handleRIDs(
				subscriptionEvents.map(([, subscription]) => subscription.rid)
			);
		},
		[handleRIDs, touchSessionsByRids]
	);

	const onDebounceSubscriptionsChanged = useUpdatingRef(
		useDebounceCallback(onSubscriptionsChanged, 500, true)
	);

	const onDebounceRoomsChanged = useUpdatingRef(
		useDebounceCallback(onRoomsChanged, 500, true)
	);

	// Subscribe to all my messages
	useEffect(() => {
		const userId = rcUid.current;

		if (socketReady && !subscribed.current) {
			subscribed.current = true;
			subscribe(
				{
					name: SUB_STREAM_NOTIFY_USER,
					event: EVENT_SUBSCRIPTIONS_CHANGED,
					userId
				},
				onDebounceSubscriptionsChanged
			);
			subscribe(
				{
					name: SUB_STREAM_NOTIFY_USER,
					event: EVENT_ROOMS_CHANGED,
					userId
				},
				onDebounceRoomsChanged
			);
		} else if (!socketReady) {
			// Reconnect
			subscribed.current = false;
		}

		return () => {
			if (subscribed.current) {
				subscribed.current = false;
				unsubscribe(
					{
						name: SUB_STREAM_NOTIFY_USER,
						event: EVENT_SUBSCRIPTIONS_CHANGED,
						userId
					},
					onDebounceSubscriptionsChanged
				);
				unsubscribe(
					{
						name: SUB_STREAM_NOTIFY_USER,
						event: EVENT_ROOMS_CHANGED,
						userId
					},
					onDebounceRoomsChanged
				);
			}
		};
	}, [
		onDebounceRoomsChanged,
		onDebounceSubscriptionsChanged,
		socketReady,
		subscribe,
		subscribed,
		unsubscribe
	]);

	useEffect(() => {
		const onNewMessageEvent = ({
			roomId,
			timestamp
		}: {
			roomId?: string;
			timestamp?: number;
		}) => {
			if (!roomId) {
				return;
			}

			touchSessionsByRids([
				{
					rid: roomId,
					timestamp: timestamp || Date.now()
				}
			]);
		};

		messageEventEmitter.on(onNewMessageEvent);
		return () => {
			messageEventEmitter.off(onNewMessageEvent);
		};
	}, [touchSessionsByRids]);

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

	const showMySessionToolbar = type === SESSION_LIST_TYPES.MY_SESSION;
	/**
	 * Enquiry tab gets its own compact chip row (Chats + Live Chat). It
	 * shares the same `sessionToolbarChip` state as the Gespräch toolbar so
	 * the same in-memory filter path handles both.
	 */
	const showEnquiryFilterChips =
		type === SESSION_LIST_TYPES.ENQUIRY &&
		!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData);

	const handleToolbarChipToggle = useCallback(
		(chip: SessionToolbarChipFilter) => {
			const nextChip = sessionToolbarChip === chip ? null : chip;
			setSessionToolbarChip(nextChip);

			const baseListPath = listPath || '/sessions/consultant/sessionView';

			/* Route-driven chips (+ / archive) stay “selected” until URL changes.
			   Leaving create-group-chat when using a filter avoids + staying dark. */
			if (groupIdFromParam === 'createGroupChat') {
				const params = new URLSearchParams(location.search);
				params.delete('sessionListTab');
				const search = params.toString() ? `?${params.toString()}` : '';
				history.push({ pathname: baseListPath, search });
				return;
			}

			/* Selecting a filter implies main list: drop archive tab so archive chip matches. */
			if (
				sessionListTab === SESSION_LIST_TAB_ARCHIVE &&
				nextChip !== null
			) {
				const params = new URLSearchParams(location.search);
				params.delete('sessionListTab');
				const search = params.toString() ? `?${params.toString()}` : '';
				history.replace({ pathname: location.pathname, search });
			}
		},
		[
			groupIdFromParam,
			history,
			listPath,
			location.pathname,
			location.search,
			sessionListTab,
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
				(item as { matrixRoomId?: string })?.matrixRoomId ||
				(typeof item.groupId === 'string' &&
				item.groupId.startsWith('!')
					? item.groupId
					: null);
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
					return !session?.consultant; // Only show unassigned enquiries
				default:
					return true;
			}
		},
		[type, userData]
	);

	const ref_list_array = useRef<any>([]);

	const handleKeyDownLisItemContent = (e, index) => {
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
	const finalSessionsList = (sessions || []).filter(filterSessions);
	const sessionToolbarPairs = finalSessionsList.map((raw) => ({
		raw,
		extended: buildExtendedSession(raw, groupIdFromParam)
	}));
	const sessionToolbarFilteredPairs = sessionToolbarPairs.filter(
		({ raw, extended }) =>
			sessionMatchesToolbar(
				raw,
				extended,
				sessionToolbarSearch,
				sessionToolbarChip,
				sessionToolbarSelectedPeople,
				userData?.userId
			)
	);
	const sortedSessions = sessionToolbarFilteredPairs
		.map(({ extended }) => extended)
		.sort(sortSessions);
	const toolbarSearchPeopleResults: SessionSearchPersonResult[] =
		React.useMemo(() => {
			const seen = new Set<string>();
			return sessionToolbarPairs
				.map(({ raw, extended }) => {
					const id =
						String(raw.session?.id || raw.chat?.id || '') ||
						String(raw.chat?.groupId || '') ||
						String(extended.item?.id || '');
					if (!id || seen.has(id)) {
						return null;
					}
					seen.add(id);
					const name =
						raw.user?.username ||
						raw.consultant?.displayName ||
						raw.consultant?.username ||
						translate('sessionList.user.consultantUnknown');
					const consultantLabel =
						raw.consultant?.displayName ||
						raw.consultant?.username ||
						translate('sessionList.user.consultantUnknown');
					const subtitle = `Berater:in ${consultantLabel}${
						raw.session?.postcode ? ` ${raw.session.postcode}` : ''
					}`.trim();
					return {
						id,
						name,
						subtitle
					};
				})
				.filter((entry): entry is SessionSearchPersonResult =>
					Boolean(entry)
				);
		}, [sessionToolbarPairs, translate]);
	const showSupervisionChip = finalSessionsList.some((raw) => {
		if (!hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)) {
			return false;
		}
		if (!raw.consultant?.id) {
			return false;
		}
		return String(raw.consultant.id) !== String(userData?.userId || '');
	});
	const toolbarFilteredOutAll =
		showMySessionToolbar &&
		finalSessionsList.length > 0 &&
		sortedSessions.length === 0;
	const isSessionListItemActive = (session: ExtendedSessionInterface) =>
		(session?.rid && session.rid === groupIdFromParam) ||
		(session?.item?.id !== undefined &&
			String(session.item.id) === String(sessionIdFromParam || ''));

	return (
		<div className="sessionsList__innerWrapper">
			{showEnquiryFilterChips && (
				<EnquiryFilterChips
					translate={translate}
					activeChip={sessionToolbarChip}
					onChipToggle={handleToolbarChipToggle}
					showLiveChatChip={liveChatAvailable}
				/>
			)}
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
					showSupervisionChip={showSupervisionChip}
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
				/>
			)}
			<div className="sessionsList__scrollArea">
				<div
					className={clsx('sessionsList__scrollContainer', {
						'sessionsList__scrollContainer--hasToolbar':
							showMySessionToolbar
					})}
					ref={listRef}
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
									<SessionListItemComponent
										defaultLanguage={defaultLanguage}
										itemRef={(el) =>
											(ref_list_array.current[index] = el)
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
									/>
								</ActiveSessionProvider>
							)
						)}

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
				sortedSessions.length === 0 && (
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
	const history = useHistory();

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

		if ((history?.location?.state as any)?.isEditMode) return;

		if (inactiveGroupSessions.length <= 0) {
			return;
		}

		return apiGetSessionRoomsByGroupIds(
			inactiveGroupSessions.map((s) => s.chat.groupId)
		)
			.then(({ sessions }) => {
				// Update sessions which still exists in rocket.chat
				dispatch({
					type: UPDATE_SESSIONS,
					sessions: sessions.filter(hasSessionChanged)
				});

				// Remove sessions which not exists in rocket.chat anymore and not repetitive chats
				const removedGroupSessions = inactiveGroupSessions.filter(
					(inactiveGroupSession) =>
						!sessions.find(
							(s) =>
								s.chat.groupId ===
								inactiveGroupSession.chat.groupId
						)
				);
				if (removedGroupSessions.length > 0) {
					dispatch({
						type: REMOVE_SESSIONS,
						ids: removedGroupSessions
							.filter((s) => !s.chat.repetitive)
							.map((s) => s.chat.groupId)
					});
				}

				// Update repetitive chats by id because groupId has changed
				const repetitiveGroupSessions = removedGroupSessions.filter(
					(s) => s.chat.repetitive
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
	}, [dispatch, hasSessionChanged, history?.location?.state, sessions]);

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
