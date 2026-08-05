import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { useNavigate } from 'react-router-dom';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import MarkChatUnreadOutlinedIcon from '@mui/icons-material/MarkChatUnreadOutlined';
import { Menu, MenuItem } from '@mui/material';
import {
	getEventDescriptor,
	getEventIcon,
	renderEventStrings,
	familyLabelKey,
	isKnownEventType
} from './eventDescriptors';
import { EventFamily } from './eventDescriptors/types';
import {
	resolveNotificationActionPath,
	toInterpolationValues
} from './notificationActionTarget';
import { useActiveListItem } from '../../hooks/useActiveListItem';
import { pickActiveItemKey } from '../../utils/listItemSelection';
import {
	filterTimelineItems,
	getFamiliesInFeed,
	TimelineFamilyFilter
} from './timelineFilter';
import {
	NotificationsContext,
	UserDataContext,
	AUTHORITIES,
	hasUserAuthority
} from '../../globalState';
import { useResponsive } from '../../hooks/useResponsive';
import { useTranslation } from 'react-i18next';
import { apiDecideCaseHandoverClientConsent } from '../../api';
import { ResizableHandle } from '../sessionsList/ResizableHandle';
import { ListSearchField } from '../listSearchField/ListSearchField';
import { ReactComponent as RequestsFamilyIcon } from '../../resources/img/icons/timeline-request-client.svg';
import { ReactComponent as MessagesFamilyIcon } from '../../resources/img/icons/speech-bubble.svg';
import { ReactComponent as DraftsFamilyIcon } from '../../resources/img/icons/pen-paper.svg';
import { ReactComponent as HandoverFamilyIcon } from '../../resources/img/icons/persons-two.svg';
import { ReactComponent as CallsFamilyIcon } from '../../resources/img/icons/timeline-add-call.svg';
import { ReactComponent as SystemFamilyIcon } from '../../resources/img/icons/notification_bell.svg';
import { ReactComponent as AppointmentsFamilyIcon } from '../../resources/img/icons/calendar.svg';
import { ConversationPreview } from './ConversationPreview';
import { getNextNotificationId } from './notificationQueue';
import {
	formatAbsoluteTime,
	formatClockParts,
	formatRelativeTime
} from './timelineTime';
import { ActivityTimelineEmptyState } from './ActivityTimelineEmptyState';
import '../sessionsList/sessionsList.styles';
import './notificationsCenter.styles';

const TIMELINE_WIDTH_STORAGE_KEY = 'notificationsTimeline_width';
const TIMELINE_MIN_WIDTH = 300;
const TIMELINE_MAX_WIDTH = 600;
const TIMELINE_DEFAULT_WIDTH = 400;

const FAMILY_ICONS: Record<
	EventFamily,
	React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
	requests: RequestsFamilyIcon,
	messages: MessagesFamilyIcon,
	drafts: DraftsFamilyIcon,
	handover: HandoverFamilyIcon,
	calls: CallsFamilyIcon,
	system: SystemFamilyIcon,
	appointments: AppointmentsFamilyIcon
};

const getNotificationCategory = (item: any): 'system' | 'message' => {
	if (item?.category === 'message') return 'message';
	if (item?.actionPath?.includes('threadRootId=')) return 'message';
	return 'system';
};

// WP-06 Activity Timeline (Slice 0a): category is registry-driven for known
// event types; unknown / local-only types keep the legacy heuristic so nothing
// regresses while the backend is incremental.
const resolveItemCategory = (item: any): 'system' | 'message' =>
	isKnownEventType(item?.eventType)
		? getEventDescriptor(item.eventType).category
		: getNotificationCategory(item);

// WP-06: render an item's visible strings from its event descriptor's i18n
// templates (ADR-AT-01 — the server record is text-free), falling back to the
// server-provided title/text until the strict text-free migration (Slice 2).
const describeItem = (
	item: any,
	translate: (key: string, options?: Record<string, unknown>) => string
) => {
	const descriptor = getEventDescriptor(item?.eventType);
	const { title, text } = renderEventStrings(descriptor, translate, {
		fallbackTitle: item?.title,
		fallbackText: item?.text,
		// #846: params metadata feeds template placeholders such as
		// {{senderDisplayName}} — previously they rendered unresolved.
		interpolation: toInterpolationValues(item?.params)
	});
	return { descriptor, title, text };
};

const resolveSessionId = (item: any): string | null => {
	if (item?.sourceSessionId != null) {
		return String(item.sourceSessionId);
	}
	if (item?.params?.sourceSessionId != null) {
		return String(item.params.sourceSessionId);
	}
	if (item?.params?.seriesId != null) {
		return String(item.params.seriesId);
	}
	const path = item?.actionPath;
	if (!path) {
		return null;
	}
	const match = String(path).match(/\/(\d+)(?:\?|$)/);
	return match?.[1] || null;
};

const resolveThreadRootId = (item: any): string | null => {
	const path = item?.actionPath;
	if (!path || !String(path).includes('?')) {
		return null;
	}
	const query = String(path).split('?')[1];
	const params = new URLSearchParams(query);
	const threadRootId = params.get('threadRootId');
	return threadRootId ? decodeURIComponent(threadRootId) : null;
};

// #847: Matrix room for the embedded preview — params.roomRef when the
// backend sent it (#846), else the room segment of the stored actionPath
// (/sessions/<role>/<list>/<roomId>/<sessionId>).
const resolveRoomId = (item: any): string | null => {
	if (item?.params?.roomRef) {
		return String(item.params.roomRef);
	}
	const path = item?.actionPath;
	if (!path) {
		return null;
	}
	const segments = String(path).split('?')[0].split('/').filter(Boolean);
	const roomSegment = segments.find(
		(segment) => segment.startsWith('!') || segment.startsWith('%21')
	);
	return roomSegment ? decodeURIComponent(roomSegment) : null;
};

const resolveCaseHandoverRequestId = (item: any): string | null => {
	const path = item?.actionPath;
	if (!path || !String(path).includes('?')) {
		return null;
	}
	const query = String(path).split('?')[1];
	const params = new URLSearchParams(query);
	return params.get('caseHandoverRequestId');
};

const parseNumericId = (value?: string | null): number | null => {
	if (!value || !/^\d+$/.test(value)) {
		return null;
	}
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : null;
};

const toNonEmbeddedPath = (path?: string | null): string | null => {
	if (!path) {
		return null;
	}
	const [basePath, queryString = ''] = String(path).split('?');
	const query = new URLSearchParams(queryString);
	query.delete('embeddedNotifications');
	const finalQuery = query.toString();
	return `${basePath}${finalQuery ? `?${finalQuery}` : ''}`;
};

export const NotificationsCenter = () => {
	const { t: translate, i18n } = useTranslation();
	const navigate = useNavigate();
	// WP-06 Slice 0b: the route-derived global selection is the single source of
	// truth for the active list item. The timeline keeps its own in-page
	// (master-detail) selection, but defers to the active conversation when one
	// is open, so it can never disagree with the conversation/request lists.
	const { selection: activeSelection } = useActiveListItem();
	const { untilL, fromL } = useResponsive();
	const { userData } = useContext(UserDataContext);
	const {
		notificationFeed,
		markNotificationAsRead,
		markAllNotificationsAsRead,
		refreshNotificationFeed
	} = useContext(NotificationsContext);
	// Design feedback 2026-07-12: on mobile nothing is pre-selected — a
	// selection immediately opens the conversation there, so an auto-selected
	// first card would be surprising. Desktop keeps the first card selected so
	// the detail pane is never empty.
	const [selectedNotificationId, setSelectedNotificationId] = useState<
		string | null
	>(untilL ? null : notificationFeed[0]?.id || null);
	// WP-06 Slice 1: timeline family filter chip + search. `null` = no chip
	// active = show everything (the former "All" chip duplicated this default
	// and is gone). Chips toggle and always compose on top of the search query.
	const [activeFamily, setActiveFamily] =
		useState<TimelineFamilyFilter>(null);
	const [unreadOnly, setUnreadOnly] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [caseHandoverConsentSubmitting, setCaseHandoverConsentSubmitting] =
		useState(false);
	const [caseHandoverConsentError, setCaseHandoverConsentError] =
		useState('');
	// Timeline redesign: embedded conversation preview is opt-in through the
	// expander pill attached to the active card (Figma: Active Chat History
	// Selection state) instead of always-on.
	const [embeddedChatOpen, setEmbeddedChatOpen] = useState(false);
	const [cardMenuAnchor, setCardMenuAnchor] = useState<HTMLElement | null>(
		null
	);
	const listScrollRef = useRef<HTMLDivElement | null>(null);

	// Timeline redesign: resizable list column, same interaction pattern as the
	// conversation page (SessionsListWrapper + ResizableHandle).
	const [listWidth, setListWidth] = useState<number>(() => {
		const saved = localStorage.getItem(TIMELINE_WIDTH_STORAGE_KEY);
		const width = saved
			? Number.parseInt(saved, 10)
			: TIMELINE_DEFAULT_WIDTH;
		return Math.min(
			Math.max(
				Number.isNaN(width) ? TIMELINE_DEFAULT_WIDTH : width,
				TIMELINE_MIN_WIDTH
			),
			TIMELINE_MAX_WIDTH
		);
	});

	const handleListResize = useCallback((width: number) => {
		setListWidth(width);
		localStorage.setItem(TIMELINE_WIDTH_STORAGE_KEY, width.toString());
	}, []);

	// Families actually present in the feed, in canonical order (drives chips).
	const familiesInFeed = useMemo(
		() => getFamiliesInFeed(notificationFeed),
		[notificationFeed]
	);

	// WP-06 Slice 1: client-side filter (family chip + search). Search matches
	// the client-rendered strings only — ADR-AT-01 forbids server full-text.
	const filteredFeed = useMemo(
		() =>
			filterTimelineItems(
				notificationFeed,
				{ family: activeFamily, query: searchQuery, unreadOnly },
				(item) => {
					const { title, text } = describeItem(item, translate);
					return `${title} ${text}`;
				}
			),
		[notificationFeed, activeFamily, searchQuery, unreadOnly, translate]
	);

	// Keep the master-detail selection inside the visible (filtered) feed.
	// Mobile never auto-selects (see selectedNotificationId above).
	const effectiveSelectedId = useMemo(() => {
		if (
			selectedNotificationId &&
			filteredFeed.some((item) => item.id === selectedNotificationId)
		) {
			return selectedNotificationId;
		}
		return untilL ? null : (filteredFeed[0]?.id ?? null);
	}, [filteredFeed, selectedNotificationId, untilL]);

	useEffect(() => {
		if (selectedNotificationId !== effectiveSelectedId) {
			setSelectedNotificationId(effectiveSelectedId);
		}
	}, [effectiveSelectedId, selectedNotificationId]);

	// Clear any stale case-handover consent error when the selection changes.
	useEffect(() => {
		setCaseHandoverConsentError('');
	}, [selectedNotificationId]);

	// Clear the active family filter when that family is no longer in the feed
	// (no selection means "show everything" — there is no "All" chip).
	useEffect(() => {
		if (
			activeFamily &&
			activeFamily !== 'all' &&
			!familiesInFeed.includes(activeFamily)
		) {
			setActiveFamily(null);
		}
	}, [familiesInFeed, activeFamily]);

	// WP-06 Slice 0b: resolve a SINGLE active card id through the shared
	// selection primitive over the visible feed. When a conversation is
	// route-active its card wins; otherwise the in-page master-detail selection
	// is used. Exactly one card is active by construction.
	const activeNotificationId = useMemo(
		() =>
			pickActiveItemKey(
				filteredFeed,
				activeSelection,
				(item) => ({ sessionId: resolveSessionId(item) }),
				(item) => item.id,
				effectiveSelectedId
			),
		[filteredFeed, activeSelection, effectiveSelectedId]
	);

	// Preview-first (design feedback 2026-07-12): selecting a chat event shows
	// the embedded conversation preview right away (Slack-style activity view);
	// the plain text detail is one toggle away via the card menu. Non-message
	// events keep the text detail. The preview never outlives its notification.
	// E2EE note: the preview is the user's own session view rendered in the
	// same client — decryption stays client-side, nothing extra leaves the
	// device (same boundary as ADR-AT-01).
	useEffect(() => {
		const item =
			filteredFeed.find(
				(feedItem) => feedItem.id === activeNotificationId
			) || null;
		setEmbeddedChatOpen(
			Boolean(item && resolveItemCategory(item) === 'message')
		);
	}, [activeNotificationId, filteredFeed]);

	const selectedNotification = useMemo(
		() =>
			filteredFeed.find((item) => item.id === activeNotificationId) ||
			null,
		[filteredFeed, activeNotificationId]
	);
	const selectedNotificationCategory = useMemo(
		() =>
			selectedNotification
				? resolveItemCategory(selectedNotification)
				: 'system',
		[selectedNotification]
	);

	// #845: on desktop the selected card is rendered in the detail pane —
	// displayed means read (Slack semantics). This also covers the
	// auto-selected first card, which previously stayed unread and made
	// the Next button die on its first click. Skipped while the unread
	// filter is on: marking read would drop the card from the filtered
	// list and cascade-read the entire feed one selection at a time.
	useEffect(() => {
		if (untilL || unreadOnly) {
			return;
		}
		if (selectedNotification && !selectedNotification.readAt) {
			markNotificationAsRead(selectedNotification.id);
		}
	}, [untilL, unreadOnly, selectedNotification, markNotificationAsRead]);
	const selectedDisplay = useMemo(
		() =>
			selectedNotification
				? describeItem(selectedNotification, translate)
				: null,
		[selectedNotification, translate]
	);
	const selectedSessionId = useMemo(
		() => resolveSessionId(selectedNotification),
		[selectedNotification]
	);
	const selectedThreadRootId = useMemo(
		() => resolveThreadRootId(selectedNotification),
		[selectedNotification]
	);
	const selectedCaseHandoverRequestId = useMemo(
		() => resolveCaseHandoverRequestId(selectedNotification),
		[selectedNotification]
	);
	const selectedSessionNumericId = useMemo(
		() => parseNumericId(selectedSessionId),
		[selectedSessionId]
	);
	const selectedCaseHandoverRequestNumericId = useMemo(
		() => parseNumericId(selectedCaseHandoverRequestId),
		[selectedCaseHandoverRequestId]
	);
	const canShowChatPreview = selectedNotificationCategory === 'message';
	const canDecideCaseHandoverConsent =
		selectedNotification?.eventType === 'case.handover.consent.requested' &&
		selectedSessionNumericId !== null &&
		selectedCaseHandoverRequestNumericId !== null;
	const getDefaultSessionsPath = useCallback(
		() =>
			hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
				? '/sessions/consultant/sessionView'
				: '/sessions/user/view',
		[userData]
	);
	// #846: request-origin events (request.new, waiting_room.client.joined)
	// live in the consultant's enquiry list, not the sessions list.
	const getDefaultRequestsPath = useCallback(
		() =>
			hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
				? '/sessions/consultant/sessionPreview'
				: '/sessions/user/view',
		[userData]
	);
	const getNotificationActionPath = useCallback(
		(item: (typeof notificationFeed)[number]) =>
			toNonEmbeddedPath(
				resolveNotificationActionPath(
					item,
					getDefaultSessionsPath(),
					getDefaultRequestsPath()
				)
			),
		[getDefaultSessionsPath, getDefaultRequestsPath]
	);
	// #847: the preview renders from the app's own Matrix client — no more
	// embeddedNotifications iframe (a second SPA whose session view registered
	// an active view and suppressed the timeline's own message events).
	const selectedRoomId = useMemo(
		() =>
			canShowChatPreview && selectedNotification
				? resolveRoomId(selectedNotification)
				: null,
		[canShowChatPreview, selectedNotification]
	);

	const openNotification = (item: (typeof notificationFeed)[number]) => {
		markNotificationAsRead(item.id);
		if (untilL) {
			const directPath = getNotificationActionPath(item);
			if (directPath) {
				navigate(directPath);
				return;
			}
			navigate(getDefaultSessionsPath());
			return;
		}
		setSelectedNotificationId(item.id);
	};

	const handleOpenAction = () => {
		if (!selectedNotification) return;
		const nextUnreadId = getNextNotificationId(
			filteredFeed,
			selectedNotification.id,
			true
		);
		markNotificationAsRead(selectedNotification.id);
		if (nextUnreadId && nextUnreadId !== selectedNotification.id) {
			setSelectedNotificationId(nextUnreadId);
		}
		const directPath = getNotificationActionPath(selectedNotification);
		if (directPath) {
			navigate(directPath);
			return;
		}
		navigate(getDefaultSessionsPath());
	};

	const handleNextNotification = () => {
		const nextUnreadId = getNextNotificationId(
			filteredFeed,
			selectedNotificationId,
			true
		);
		// #845: defensive self-guard — the queue already excludes the
		// anchor, so a match is always a different card.
		if (nextUnreadId && nextUnreadId !== selectedNotificationId) {
			const nextItem = filteredFeed.find(
				(item) => item.id === nextUnreadId
			);
			if (nextItem) {
				openNotification(nextItem);
			}
		}
	};

	const handleCaseHandoverConsentDecision = (approved: boolean) => {
		if (
			!selectedNotification ||
			selectedSessionNumericId === null ||
			selectedCaseHandoverRequestNumericId === null
		) {
			setCaseHandoverConsentError(translate('caseHandover.error.failed'));
			return;
		}
		setCaseHandoverConsentSubmitting(true);
		setCaseHandoverConsentError('');
		apiDecideCaseHandoverClientConsent(
			selectedSessionNumericId,
			selectedCaseHandoverRequestNumericId,
			approved
		)
			.then(() => {
				markNotificationAsRead(selectedNotification.id);
				refreshNotificationFeed();
			})
			.catch(() => {
				setCaseHandoverConsentError(
					translate('caseHandover.error.failed')
				);
			})
			.finally(() => setCaseHandoverConsentSubmitting(false));
	};

	const nextUnreadId = getNextNotificationId(
		filteredFeed,
		selectedNotificationId,
		true
	);
	const SelectedIcon = selectedDisplay
		? getEventIcon(selectedDisplay.descriptor.icon)
		: null;
	const showEmbeddedChat = Boolean(embeddedChatOpen && canShowChatPreview);

	// Same filter-chip contract as the conversation page toolbar: inactive
	// chips are icon-only pills, the active chip expands with its label.
	// Chips are toggles (aria-pressed): clicking the active chip clears the
	// filter — no dedicated "All" chip, no selection means everything.
	const renderFamilyChip = (
		family: EventFamily,
		Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>,
		label: string
	) => {
		const isActive = activeFamily === family;
		return (
			<button
				key={family}
				type="button"
				aria-pressed={isActive}
				title={label}
				aria-label={label}
				className={`sessionsListToolbar__chip ${
					isActive
						? 'sessionsListToolbar__chip--active'
						: 'sessionsListToolbar__chip--iconOnly'
				}`}
				onClick={() => setActiveFamily(isActive ? null : family)}
			>
				<Icon className="sessionsListToolbar__chipIconSvg sessionsListToolbar__chipIconSvg--asset" />
				<span
					className="sessionsListToolbar__chipLabel"
					aria-hidden={!isActive}
				>
					{label}
				</span>
			</button>
		);
	};

	if (notificationFeed.length === 0) {
		return (
			<div className="notificationsCenter notificationsCenter--empty">
				<ActivityTimelineEmptyState />
			</div>
		);
	}

	return (
		<div className="notificationsCenter">
			<div
				className="notificationsCenter__listColumn"
				style={{ width: fromL ? `${listWidth}px` : undefined }}
			>
				<div className="sessionsListToolbar notificationsCenter__toolbar">
					<ListSearchField
						value={searchQuery}
						onChange={setSearchQuery}
						placeholder={translate(
							'notifications.center.searchPlaceholder',
							'Search activity…'
						)}
						clearLabel={translate(
							'sessionList.toolbar.search.clear',
							'Clear search'
						)}
						menuLabel={translate(
							'sessionList.toolbar.search.toggle',
							'Open or close search results'
						)}
					/>
					{notificationFeed.length > 0 && (
						<div className="sessionsListToolbar__chipsScroll">
							<div
								className="sessionsListToolbar__chipsRow"
								role="group"
								aria-label={translate(
									'notifications.center.title',
									'Notifications'
								)}
							>
								{familiesInFeed.map((family) =>
									renderFamilyChip(
										family,
										FAMILY_ICONS[family] ||
											SystemFamilyIcon,
										translate(familyLabelKey(family))
									)
								)}
								<button
									type="button"
									aria-pressed={unreadOnly}
									className={`sessionsListToolbar__chip ${
										unreadOnly
											? 'sessionsListToolbar__chip--active'
											: 'sessionsListToolbar__chip--iconOnly'
									}`}
									onClick={() =>
										setUnreadOnly((value) => !value)
									}
									title={translate(
										'notifications.center.unreadFilter',
										'Unread'
									)}
									aria-label={translate(
										'notifications.center.unreadFilter',
										'Unread'
									)}
								>
									<MarkChatUnreadOutlinedIcon className="sessionsListToolbar__chipIconSvg" />
									<span
										className="sessionsListToolbar__chipLabel"
										aria-hidden={!unreadOnly}
									>
										{translate(
											'notifications.center.unreadFilter',
											'Unread'
										)}
									</span>
								</button>
								<button
									type="button"
									className="sessionsListToolbar__chip sessionsListToolbar__chip--iconOnly"
									onClick={markAllNotificationsAsRead}
									title={translate(
										'notifications.center.markAllRead',
										'Mark all as read'
									)}
									aria-label={translate(
										'notifications.center.markAllRead',
										'Mark all as read'
									)}
								>
									<DoneAllIcon className="sessionsListToolbar__chipIconSvg" />
								</button>
							</div>
						</div>
					)}
				</div>
				<div className="notificationsCenter__list" ref={listScrollRef}>
					{filteredFeed.length === 0 ? (
						<div className="notificationsCenter__empty">
							{translate(
								'notifications.center.noResults',
								'No activity matches your filters.'
							)}
						</div>
					) : (
						filteredFeed.map((item, index) => {
							const isActive = activeNotificationId === item.id;
							// Same grouped-list contract as the conversation
							// sidebar: neighbours of the active card round the
							// corners facing it (--beforeActive/--afterActive).
							const activeIndex = filteredFeed.findIndex(
								(feedItem) =>
									feedItem.id === activeNotificationId
							);
							const isBeforeActive =
								activeIndex !== -1 && index === activeIndex - 1;
							const isAfterActive =
								activeIndex !== -1 && index === activeIndex + 1;
							const { descriptor, title, text } = describeItem(
								item,
								translate
							);
							const Icon = getEventIcon(descriptor.icon);
							return (
								<div
									key={item.id}
									className={`notificationsCenter__listRow ${
										isActive
											? 'notificationsCenter__listRow--active'
											: ''
									} ${
										isActive
											? 'notificationsCenter__listRow--withExpander'
											: ''
									} ${
										isBeforeActive
											? 'notificationsCenter__listRow--beforeActive'
											: ''
									} ${
										isAfterActive
											? 'notificationsCenter__listRow--afterActive'
											: ''
									}`}
								>
									<button
										type="button"
										className={`notificationsCenter__card ${
											isActive
												? 'notificationsCenter__card--active'
												: ''
										}`}
										onClick={() => openNotification(item)}
									>
										<span className="notificationsCenter__cardIconColumn">
											<span className="notificationsCenter__cardIcon">
												<Icon />
											</span>
											<span className="notificationsCenter__cardConnector" />
										</span>
										<span className="notificationsCenter__cardContent">
											<span className="notificationsCenter__cardTitleRow">
												<span className="notificationsCenter__cardTitle">
													{title}
												</span>
											</span>
											<span className="notificationsCenter__cardBodyRow">
												<span className="notificationsCenter__cardText">
													{text}
												</span>
												{!isActive && (
													<span className="notificationsCenter__cardTime">
														{formatRelativeTime(
															item.createdAt,
															i18n.language
														)}
													</span>
												)}
											</span>
											{isActive && (
												<span className="notificationsCenter__cardTime notificationsCenter__cardTime--footer">
													{formatRelativeTime(
														item.createdAt,
														i18n.language
													)}
												</span>
											)}
										</span>
										{!item.readAt && (
											<span className="notificationsCenter__cardUnread" />
										)}
									</button>
									{isActive && (
										<span
											className="notificationsCenter__cardMenu"
											onClick={(event) =>
												event.stopPropagation()
											}
											onKeyDown={(event) =>
												event.stopPropagation()
											}
											role="presentation"
										>
											<button
												type="button"
												className="notificationsCenter__cardMenuButton"
												aria-label={translate(
													'notifications.center.cardMenu',
													'Notification actions'
												)}
												onClick={(event) =>
													setCardMenuAnchor(
														event.currentTarget
													)
												}
											>
												<MoreHorizIcon />
											</button>
										</span>
									)}
									{/* Design feedback 2026-07-12: the side pill on the
									    active card navigates straight into the event's
									    origin (Figma arrow affordance) — it no longer
									    toggles the preview, which is open by default
									    for chat events. */}
									{isActive && (
										<button
											type="button"
											className="notificationsCenter__expander"
											aria-label={
												item.actionLabel ||
												translate(
													'notifications.center.open',
													'View Conversation'
												)
											}
											onClick={handleOpenAction}
										>
											<OpenInFullIcon />
										</button>
									)}
								</div>
							);
						})
					)}
				</div>
				<Menu
					anchorEl={cardMenuAnchor}
					open={Boolean(cardMenuAnchor)}
					onClose={() => setCardMenuAnchor(null)}
					anchorOrigin={{
						vertical: 'bottom',
						horizontal: 'right'
					}}
					transformOrigin={{ vertical: 'top', horizontal: 'right' }}
				>
					<MenuItem
						onClick={() => {
							setCardMenuAnchor(null);
							handleOpenAction();
						}}
					>
						{selectedNotification?.actionLabel ||
							translate(
								selectedNotification?.eventType ===
									'group_chat.opened'
									? 'notifications.center.join'
									: 'notifications.center.open',
								selectedNotification?.eventType ===
									'group_chat.opened'
									? 'Join'
									: 'Open chat'
							)}
					</MenuItem>
					{canShowChatPreview && (
						<MenuItem
							onClick={() => {
								setEmbeddedChatOpen((value) => !value);
								setCardMenuAnchor(null);
							}}
						>
							{translate(
								showEmbeddedChat
									? 'notifications.center.showDetails'
									: 'notifications.center.showPreview',
								showEmbeddedChat
									? 'Show details'
									: 'Show conversation preview'
							)}
						</MenuItem>
					)}
					<MenuItem
						onClick={() => {
							if (selectedNotification) {
								markNotificationAsRead(selectedNotification.id);
							}
							setCardMenuAnchor(null);
						}}
					>
						{translate(
							'notifications.center.markRead',
							'Mark as read'
						)}
					</MenuItem>
					<MenuItem
						onClick={() => {
							markAllNotificationsAsRead();
							setCardMenuAnchor(null);
						}}
					>
						{translate(
							'notifications.center.markAllRead',
							'Mark all as read'
						)}
					</MenuItem>
				</Menu>
				{fromL && (
					<ResizableHandle
						currentWidth={listWidth}
						onResize={handleListResize}
						scrollTargetRef={listScrollRef}
						minWidth={TIMELINE_MIN_WIDTH}
						maxWidth={TIMELINE_MAX_WIDTH}
					/>
				)}
			</div>
			<div className="notificationsCenter__detail">
				<div
					className={`notificationsCenter__detailCard ${
						showEmbeddedChat
							? 'notificationsCenter__detailCard--embedded'
							: ''
					}`}
				>
					{!selectedNotification ? (
						<div className="notificationsCenter__emptyDetail">
							{translate(
								'notifications.center.emptyDetail',
								'Select a notification to see the details.'
							)}
						</div>
					) : showEmbeddedChat ? (
						<ConversationPreview
							roomId={selectedRoomId}
							threadRootId={selectedThreadRootId}
						/>
					) : (
						<div className="notificationsCenter__detailBody">
							<div className="notificationsCenter__detailHeader">
								{SelectedIcon && (
									<span className="notificationsCenter__detailIcon">
										<SelectedIcon />
									</span>
								)}
								<h2 className="notificationsCenter__detailTitle">
									{selectedDisplay?.title}
								</h2>
							</div>
							<p className="notificationsCenter__detailText">
								{selectedDisplay?.text}
							</p>
							{/* #845: the pane never showed WHEN the event
							    happened; waiting-room events phrase it as
							    "waiting since" so the queue age is obvious. */}
							<p className="notificationsCenter__detailTimestamp">
								{selectedNotification?.eventType ===
								'waiting_room.client.joined'
									? translate(
											'notifications.center.waitingSince',
											{
												defaultValue:
													'Waiting since {{time}} ({{date}})',
												...formatClockParts(
													selectedNotification.createdAt,
													i18n.language
												)
											}
										)
									: formatAbsoluteTime(
											selectedNotification.createdAt,
											i18n.language
										)}
							</p>
							{selectedNotification?.eventType ===
								'case.handover.consent.requested' && (
								<div className="notificationsCenter__consentActions">
									<button
										type="button"
										className="notificationsCenter__consentButton notificationsCenter__consentButton--approve"
										onClick={() =>
											handleCaseHandoverConsentDecision(
												true
											)
										}
										disabled={
											!canDecideCaseHandoverConsent ||
											caseHandoverConsentSubmitting
										}
									>
										{translate(
											'caseHandover.consent.approve',
											'Approve'
										)}
									</button>
									<button
										type="button"
										className="notificationsCenter__consentButton"
										onClick={() =>
											handleCaseHandoverConsentDecision(
												false
											)
										}
										disabled={
											!canDecideCaseHandoverConsent ||
											caseHandoverConsentSubmitting
										}
									>
										{translate(
											'caseHandover.consent.decline',
											'Decline'
										)}
									</button>
									{caseHandoverConsentError && (
										<p
											className="notificationsCenter__detailText"
											role="alert"
										>
											{caseHandoverConsentError}
										</p>
									)}
								</div>
							)}
							<div className="notificationsCenter__detailActions">
								<button
									type="button"
									className="notificationsCenter__openButton"
									onClick={handleOpenAction}
								>
									<OpenInFullIcon />
									{selectedNotification.actionLabel ||
										translate(
											selectedNotification.eventType ===
												'group_chat.opened'
												? 'notifications.center.join'
												: 'notifications.center.open',
											selectedNotification.eventType ===
												'group_chat.opened'
												? 'Join'
												: 'Open chat'
										)}
								</button>
								<button
									type="button"
									className="notificationsCenter__nextButton"
									onClick={handleNextNotification}
									disabled={!nextUnreadId}
								>
									{translate(
										'notifications.center.next',
										'Next notification'
									)}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
