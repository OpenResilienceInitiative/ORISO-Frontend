import { NavActivityIcon } from '../app/navigationSidebarIcons';
import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { useNavigate } from 'react-router-dom';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { ReactComponent as OpenInNewIcon } from '../../resources/img/icons/open-in-new-tab.svg';
import MarkChatUnreadOutlinedIcon from '@mui/icons-material/MarkChatUnreadOutlined';
import { Menu, MenuItem } from '@mui/material';
import { getEventDescriptor, getEventIcon } from './eventDescriptors';
import {
	resolveEndedCallConversationPath,
	resolveNotificationActionPath,
	resolveStatusPageAction
} from './notificationActionTarget';
import { useActiveListItem } from '../../hooks/useActiveListItem';
import {
	filterTimelineItems,
	getFamiliesInFeed,
	TIMELINE_KIND_ORDER,
	TimelineFamilyFilter,
	TimelineKindId
} from './timelineFilter';
import { useDisplayFilter } from '../../hooks/useDisplayFilter';
import {
	DisplayFilterButton,
	DisplayFilterDialog,
	DisplayFilterKindOption,
	FilterChip,
	FilterChipRow,
	isDisplayFilterCustomised,
	reconcileActiveKind,
	orderChipKinds,
	resolveChipPresentation,
	kindsUnderOther,
	useDisplayFilterEmailColumn,
	useDisplayFilterLabels,
	visiblePillKinds
} from '../displayFilter';
import {
	applyTimelineFilter,
	isTimelineKindPartiallyHidden,
	timelineUnreadByKind
} from '../../utils/displayFilter/timeline';
import {
	TIMELINE_KIND_ICONS,
	timelineKindLabel
} from '../displayFilter/kindOptions';
import {
	NotificationsContext,
	NOTIFICATION_TYPE_ERROR,
	NOTIFICATION_TYPE_INFO,
	SessionsDataContext,
	UserDataContext,
	AUTHORITIES,
	hasUserAuthority
} from '../../globalState';
import { useResponsive } from '../../hooks/useResponsive';
import { useTranslation } from 'react-i18next';
import { apiDecideCaseHandoverClientConsent } from '../../api';
import { ResizableHandle } from '../sessionsList/ResizableHandle';
import { ListSearchField } from '../listSearchField/ListSearchField';
import { MatrixActivityPreviewHydrator } from './MatrixActivityPreviewHydrator';
import { ReactComponent as ImageMessageIcon } from '../../resources/img/icons/file-image.svg';
import { ReactComponent as FileMessageIcon } from '../../resources/img/icons/file-doc.svg';
import { ReactComponent as AudioMessageIcon } from '../../resources/img/icons/notification_audio.svg';
import { ReactComponent as VideoMessageIcon } from '../../resources/img/icons/video-call.svg';
import type { MatrixActivityPreviewKind } from '../../utils/matrixActivityPreview';
import { ConversationPreview } from './ConversationPreview';
import {
	activityEventCaseHandoverRequestId,
	activityEventCategory,
	activityEventSessionId,
	describeActivityEvent
} from './activityEvent';
import { useTimelineConversation } from './useTimelineConversation';
import { MarkAllReadButton } from './MarkAllReadButton';
import { useActivityTimeline } from './useActivityTimeline';
import { useActivityPreviewHydration } from './useActivityPreviewHydration';
import {
	isTimelineDraftId,
	mergeDraftsIntoFeed,
	toNonEmbeddedPath
} from './timelineDrafts';
import { useTimelineDrafts } from '../../hooks/useTimelineDrafts';
import { callManager } from '../../services/CallManager';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import {
	formatAbsoluteTime,
	formatClockParts,
	formatRelativeTime
} from './timelineTime';
import { ActivityTimelineEmptyState } from './ActivityTimelineEmptyState';
import { NOTIFICATION_SETTINGS_PATH } from '../profile/notificationSettingsPath';
import '../sessionsList/sessionsList.styles';
import './notificationsCenter.styles';

const TIMELINE_WIDTH_STORAGE_KEY = 'notificationsTimeline_width';
const TIMELINE_MIN_WIDTH = 300;
const TIMELINE_MAX_WIDTH = 600;
const TIMELINE_DEFAULT_WIDTH = 400;

/**
 * Keep paging (#1377 §5.1): a loaded page can be entirely hidden, so the
 * list requests older pages until this many visible rows exist or the
 * server has no more.
 */
const MIN_VISIBLE_TIMELINE_ROWS = 10;

const TIMELINE_DISPLAY_FILTER_DIALOG_ID = 'timeline-display-filter-dialog';

const MESSAGE_PREVIEW_ICONS: Partial<
	Record<
		MatrixActivityPreviewKind,
		React.ComponentType<React.SVGProps<SVGSVGElement>>
	>
> = {
	image: ImageMessageIcon,
	file: FileMessageIcon,
	audio: AudioMessageIcon,
	video: VideoMessageIcon
};

// The branch's own `formatRelativeTime` is gone on purpose: #845 replaced the
// hardcoded English strings ('now', 'Xm ago') with locale-aware formatting in
// `timelineTime.ts`, which is imported above.

// #876: a planned maintenance notice links out to the public status page
// instead of an in-app origin, so it never falls back to the sessions list.
const openStatusPage = (url: string) => {
	window.open(url, '_blank', 'noopener,noreferrer');
};

type JoinOutcome = Awaited<ReturnType<typeof callManager.joinExistingCall>>;

/**
 * Call cards join their existing authorized binding. A card that cannot join
 * here (incomplete, or group topology not loaded yet) opens its conversation.
 */
const joinNotificationCall = (
	item: NotificationFeedItem,
	topologyReady: boolean,
	isGroup: (roomRef: string) => boolean,
	onOutcome: (outcome: JoinOutcome) => void,
	onCannotJoin: () => void,
	onStart: (callId: string) => void
): boolean => {
	const params = item.params || {};
	if (
		getEventDescriptor(item.eventType).resolveActionTarget(params).kind !==
		'join'
	) {
		return false;
	}
	if (
		typeof params.callId !== 'string' ||
		!params.callId.trim() ||
		typeof params.roomRef !== 'string' ||
		!params.roomRef.trim() ||
		typeof params.callRoomId !== 'string' ||
		!params.callRoomId.trim() ||
		(params.callType !== 'audio' && params.callType !== 'video') ||
		// An empty session list would store a group call as one-to-one.
		!topologyReady
	) {
		onCannotJoin();
		return true;
	}
	onStart(params.callId);
	// The feed carries no call topology: the conversation the call belongs to decides.
	callManager
		.joinExistingCall(
			{
				callId: params.callId,
				roomRef: params.roomRef,
				callRoomId: params.callRoomId,
				callType: params.callType,
				state: 'running',
				participants: []
			},
			isGroup(params.roomRef)
		)
		.then(onOutcome, () => onOutcome('unavailable'));
	return true;
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
	const sessionsContext = useContext(SessionsDataContext);
	const sessions = sessionsContext?.sessions;
	const {
		notificationFeed: serverFeed,
		hasUnreadNotifications,
		markNotificationAsRead: markServerNotificationAsRead,
		markAllNotificationsAsRead,
		isMarkingAllRead = false,
		isClearingFeed = false,
		refreshNotificationFeed,
		loadOlderNotifications,
		hasOlderNotifications,
		isLoadingOlderNotifications,
		olderNotificationsError,
		addNotification
	} = useContext(NotificationsContext);
	// #1535: unsent drafts join the list here only, not the provider feed.
	const timelineDrafts = useTimelineDrafts();
	const notificationFeed = useMemo(
		() => mergeDraftsIntoFeed(serverFeed, timelineDrafts),
		[serverFeed, timelineDrafts]
	);
	const markNotificationAsRead = useCallback(
		(id: string) => {
			if (!isTimelineDraftId(id)) markServerNotificationAsRead(id);
		},
		[markServerNotificationAsRead]
	);
	// #1377 slice 3: the user's display filter for this list (spec §4/§5.1).
	const {
		effective: timelineFilter,
		override: timelineOverride,
		canWrite: canEditDisplayFilter,
		readOnly: displayFilterReadOnly,
		setSection: setTimelineOverride,
		resetSection: resetTimelineOverride
	} = useDisplayFilter('timeline');
	const displayFilterLabels = useDisplayFilterLabels('timeline');
	const displayFilterEmail = useDisplayFilterEmailColumn('timeline');
	const [displayFilterOpen, setDisplayFilterOpen] = useState(false);
	// The feed is reduced ONCE; chips and list both read `visibleFeed` so a
	// hidden kind leaves both in the same render (AC2).
	const visibleFeed = useMemo(
		() => applyTimelineFilter(notificationFeed, timelineFilter),
		[notificationFeed, timelineFilter]
	);
	// WP-06 Slice 1: timeline family filter chip + search. `null` = no chip
	// active = show everything (the former "All" chip duplicated this default
	// and is gone). Chips toggle and always compose on top of the search query.
	const [activeFamily, setActiveFamily] =
		useState<TimelineFamilyFilter>(null);
	const [unreadOnly, setUnreadOnly] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	// #924: decrypted card previews, behind the case-handover gate.
	const {
		sources: messagePreviewSources,
		onPreviewChange: handlePreviewChange,
		visiblePreview
	} = useActivityPreviewHydration(notificationFeed);
	const [caseHandoverConsentSubmitting, setCaseHandoverConsentSubmitting] =
		useState(false);
	const [caseHandoverConsentError, setCaseHandoverConsentError] =
		useState('');
	const [cardMenuAnchor, setCardMenuAnchor] = useState<HTMLElement | null>(
		null
	);
	const listScrollRef = useRef<HTMLDivElement | null>(null);
	const listAnchorRef = useRef<{ id: string; top: number } | null>(null);
	const anchorFrameRef = useRef<number | null>(null);
	const captureListAnchor = useCallback(() => {
		const list = listScrollRef.current;
		if (!list || list.scrollTop <= 0) {
			listAnchorRef.current = null;
			return;
		}
		const listTop = list.getBoundingClientRect().top;
		const firstVisible = Array.from(
			list.querySelectorAll<HTMLElement>('[data-notification-id]')
		).find((row) => row.getBoundingClientRect().bottom > listTop);
		listAnchorRef.current = firstVisible
			? {
					id: firstVisible.dataset.notificationId || '',
					top: firstVisible.getBoundingClientRect().top
				}
			: null;
	}, []);
	const scheduleCaptureListAnchor = useCallback(() => {
		if (anchorFrameRef.current !== null) return;
		anchorFrameRef.current = window.requestAnimationFrame(() => {
			anchorFrameRef.current = null;
			captureListAnchor();
		});
	}, [captureListAnchor]);

	useEffect(() => {
		const list = listScrollRef.current;
		if (!list) return;
		list.addEventListener('scroll', scheduleCaptureListAnchor, {
			passive: true
		});
		captureListAnchor();
		return () => {
			list.removeEventListener('scroll', scheduleCaptureListAnchor);
			if (anchorFrameRef.current !== null) {
				window.cancelAnimationFrame(anchorFrameRef.current);
				anchorFrameRef.current = null;
			}
		};
	}, [captureListAnchor, scheduleCaptureListAnchor]);

	// Preserve the first visible card when a live refresh prepends new events.
	// Appending an older page naturally keeps the same anchor position.
	//
	// `visiblePreview` belongs in the dependencies as much as the feed
	// does: a card above the viewport growing from one line to two on
	// decryption shifts the list by exactly as much as a prepended event would.
	useLayoutEffect(() => {
		const list = listScrollRef.current;
		if (!list) return;
		const rows = Array.from(
			list.querySelectorAll<HTMLElement>('[data-notification-id]')
		);
		const previousAnchor = listAnchorRef.current;
		if (previousAnchor) {
			const anchoredRow = rows.find(
				(row) => row.dataset.notificationId === previousAnchor.id
			);
			if (anchoredRow) {
				list.scrollTop +=
					anchoredRow.getBoundingClientRect().top -
					previousAnchor.top;
			}
		}

		captureListAnchor();
	}, [captureListAnchor, notificationFeed, visiblePreview]);

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

	// Kinds actually present in the VISIBLE feed, in canonical order.
	const familiesInFeed = useMemo(
		() => getFamiliesInFeed(visibleFeed),
		[visibleFeed]
	);
	// The dialog rows: every kind, "Termine" only once such an event exists
	// (§5.1), with the visible unread count per kind for the pill badges and
	// the profile's partial hiding for the mixed checkbox.
	const timelineKinds = useMemo<DisplayFilterKindOption[]>(() => {
		const unread = timelineUnreadByKind(visibleFeed);
		const presentKinds = new Set(getFamiliesInFeed(notificationFeed));
		return TIMELINE_KIND_ORDER.filter(
			(kind) => kind !== 'appointments' || presentKinds.has(kind)
		).map((kind) => ({
			id: kind,
			label: timelineKindLabel(translate, kind),
			icon: TIMELINE_KIND_ICONS[kind],
			chipLabel:
				kind === 'other'
					? translate('notifications.displayFilter.otherChip')
					: undefined,
			unreadCount: unread[kind] ?? 0,
			partial: isTimelineKindPartiallyHidden(timelineFilter, kind)
		}));
	}, [notificationFeed, timelineFilter, translate, visibleFeed]);
	const chipPresentation = resolveChipPresentation(timelineFilter);
	const pillKinds = useMemo(
		() =>
			orderChipKinds(
				visiblePillKinds(timelineFilter, timelineKinds, activeFamily),
				{ autoSort: chipPresentation.autoSort }
			),
		[activeFamily, chipPresentation.autoSort, timelineFilter, timelineKinds]
	);
	const displayFilterCustomised = isDisplayFilterCustomised(
		timelineFilter,
		timelineKinds
	);
	// A page can be entirely hidden: keep paging until enough is visible.
	useEffect(() => {
		if (
			visibleFeed.length >= MIN_VISIBLE_TIMELINE_ROWS ||
			notificationFeed.length === 0 ||
			!hasOlderNotifications ||
			isLoadingOlderNotifications ||
			olderNotificationsError
		) {
			return;
		}
		void loadOlderNotifications();
	}, [
		hasOlderNotifications,
		isLoadingOlderNotifications,
		loadOlderNotifications,
		notificationFeed.length,
		olderNotificationsError,
		visibleFeed.length
	]);
	// #1200: "Mark all as read" is only actionable while something is unread.
	// The provider's counter is the server-backed total, so unread activity on
	// pages that are not loaded yet still enables the action. With the display
	// filter (#1377 slice 7) that total leaves hidden kinds out, while ✓✓
	// still clears everything server-side (spec §6.1): unread rows the filter
	// hides on the loaded pages keep the action enabled.
	const hasUnreadActivity =
		hasUnreadNotifications || notificationFeed.some((row) => !row.readAt);
	// §5.1: an active family whose pill the effective filter took (a profile
	// change or another device) must not keep narrowing the feed with no
	// chip left to clear it. Same reconciliation as the sessions lists.
	useEffect(() => {
		setActiveFamily((current) =>
			current && current !== 'all'
				? (reconcileActiveKind(
						timelineFilter,
						current
					) as TimelineFamilyFilter)
				: current
		);
	}, [timelineFilter]);

	// WP-06 Slice 1: client-side filter (family chip + search). Search matches
	// the client-rendered strings only — ADR-AT-01 forbids server full-text.
	const filteredFeed = useMemo(
		() =>
			filterTimelineItems(
				visibleFeed,
				{
					family: activeFamily,
					query: searchQuery,
					unreadOnly,
					bundledUnderOther: kindsUnderOther(
						timelineFilter,
						timelineKinds
					)
				},
				(item) => {
					const { title, text } = describeActivityEvent(
						item,
						translate,
						i18n.language
					);
					return `${title} ${visiblePreview(item.id)?.text || text}`;
				}
			),
		[
			visibleFeed,
			activeFamily,
			timelineFilter,
			timelineKinds,
			searchQuery,
			unreadOnly,
			translate,
			i18n.language,
			visiblePreview
		]
	);

	// #1888: selection, #845 auto-read and "next unread" in one hook.
	const {
		selectedId: activeNotificationId,
		selectedEvent: selectedNotification,
		select: selectNotification,
		nextUnreadId,
		conversationShown: showEmbeddedChat,
		toggleConversation
	} = useActivityTimeline({
		feed: filteredFeed,
		routeSelection: activeSelection,
		isPhone: untilL,
		unreadOnly,
		markRead: markNotificationAsRead
	});

	// Clear any stale case-handover consent error when the selection changes.
	useEffect(() => {
		setCaseHandoverConsentError('');
	}, [activeNotificationId]);

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

	// Preview-first (design feedback 2026-07-12): a chat event shows its
	// conversation right away; the text detail is one toggle away via the card
	// menu (useActivityTimeline). E2EE note: the preview is the user's own
	// session view rendered in the same client — decryption stays client-side
	// (same boundary as ADR-AT-01).
	const selectedNotificationCategory = useMemo(
		() =>
			selectedNotification
				? activityEventCategory(selectedNotification)
				: 'system',
		[selectedNotification]
	);

	const selectedDisplay = useMemo(
		() =>
			selectedNotification
				? describeActivityEvent(
						selectedNotification,
						translate,
						i18n.language
					)
				: null,
		[selectedNotification, translate, i18n.language]
	);
	const {
		linksToStatusPage: selectedLinksToStatusPage,
		url: selectedStatusPageUrl
	} = useMemo(
		() => resolveStatusPageAction(selectedNotification),
		[selectedNotification]
	);
	const selectedOpenLabel = selectedLinksToStatusPage
		? translate('notifications.center.openStatusPage')
		: selectedNotification?.actionLabel ||
			translate(
				selectedNotification?.eventType === 'group_chat.opened'
					? 'notifications.center.join'
					: 'notifications.center.open'
			);
	const canOpenSelected =
		!selectedLinksToStatusPage || selectedStatusPageUrl !== null;
	const selectedSessionNumericId = useMemo(
		() =>
			selectedNotification
				? activityEventSessionId(selectedNotification)
				: null,
		[selectedNotification]
	);
	const selectedCaseHandoverRequestNumericId = useMemo(
		() =>
			selectedNotification
				? activityEventCaseHandoverRequestId(selectedNotification)
				: null,
		[selectedNotification]
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
	const isGroupCallRoom = (roomRef: string) =>
		Boolean(
			sessions?.some(
				(listItem) => listItem.chat?.matrixRoomId === roomRef
			)
		);
	// A call card opens its conversation, never a guessed default list.
	const openConversation = (
		item: NotificationFeedItem,
		fallbackText = translate('videoCall.timeline.endedElsewhere')
	) => {
		const path = toNonEmbeddedPath(
			resolveEndedCallConversationPath(item, getDefaultSessionsPath())
		);
		if (path) {
			navigate(path);
			return;
		}
		addNotification({
			notificationType: NOTIFICATION_TYPE_INFO,
			title: translate('notification.info'),
			text: fallbackText,
			closeable: true,
			timeout: 10000
		});
	};
	// A second click on a call that is still joining is not a busy line.
	const joiningCallId = useRef<string | null>(null);
	const joinCall = (item: NotificationFeedItem) => {
		const callId = item.params?.callId;
		if (callId && joiningCallId.current === callId) return true;
		return joinNotificationCall(
			item,
			Boolean(sessionsContext?.ready),
			isGroupCallRoom,
			(outcome) => {
				if (joiningCallId.current === callId)
					joiningCallId.current = null;
				if (outcome === 'joined') return;
				if (outcome === 'ended') {
					openConversation(item);
					return;
				}
				addNotification({
					notificationType: NOTIFICATION_TYPE_ERROR,
					title: translate('notification.error'),
					text: translate('videoCall.timeline.joinFailed'),
					closeable: true,
					announce: 'alert',
					timeout: 10000
				});
			},
			() =>
				openConversation(
					item,
					translate('videoCall.timeline.joinFailed')
				),
			(startedCallId) => {
				joiningCallId.current = startedCallId;
			}
		);
	};

	const openNotification = (item: (typeof notificationFeed)[number]) => {
		markNotificationAsRead(item.id);
		const statusPage = resolveStatusPageAction(item);
		if (untilL && statusPage.linksToStatusPage) {
			if (statusPage.url) {
				openStatusPage(statusPage.url);
			}
			return;
		}
		if (untilL) {
			if (joinCall(item)) return;
			const directPath = getNotificationActionPath(item);
			if (directPath) {
				navigate(directPath);
				return;
			}
			navigate(getDefaultSessionsPath());
			return;
		}
		selectNotification(item.id);
	};

	const handleOpenAction = () => {
		if (!selectedNotification) return;
		if (selectedLinksToStatusPage) {
			markNotificationAsRead(selectedNotification.id);
			if (selectedStatusPageUrl) {
				openStatusPage(selectedStatusPageUrl);
			}
			return;
		}
		markNotificationAsRead(selectedNotification.id);
		if (nextUnreadId) {
			selectNotification(nextUnreadId);
		}
		if (joinCall(selectedNotification)) return;
		const directPath = getNotificationActionPath(selectedNotification);
		if (directPath) {
			navigate(directPath);
			return;
		}
		navigate(getDefaultSessionsPath());
	};

	const handleNextNotification = () => {
		if (nextUnreadId) {
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

	const SelectedIcon = selectedDisplay
		? getEventIcon(selectedDisplay.descriptor.icon)
		: null;
	// #847 / #1824: the conversation behind the selected card, rendered from
	// the app's own Matrix client (no embeddedNotifications iframe, whose
	// session view registered an active view and suppressed the Timeline's
	// own message events), with D1 and D2 (useTimelineConversation).
	const conversation = useTimelineConversation({
		event: showEmbeddedChat ? selectedNotification : null,
		feed: notificationFeed,
		unreadOnly,
		markRead: markNotificationAsRead
	});

	if (notificationFeed.length === 0) {
		return (
			<div className="notificationsCenter notificationsCenter--empty">
				<ActivityTimelineEmptyState />
			</div>
		);
	}

	return (
		<div className="notificationsCenter">
			{messagePreviewSources.map((source) => (
				<MatrixActivityPreviewHydrator
					key={source.activityEventId}
					{...source}
					onPreviewChange={handlePreviewChange}
				/>
			))}
			<div
				className="notificationsCenter__listColumn"
				style={{ width: fromL ? `${listWidth}px` : undefined }}
			>
				<div className="sessionsListToolbar notificationsCenter__toolbar">
					<ListSearchField
						leading={
							<DisplayFilterButton
								label={displayFilterLabels.buttonLabel}
								customised={displayFilterCustomised}
								customisedLabel={
									displayFilterLabels.buttonCustomisedLabel
								}
								open={displayFilterOpen}
								controlsId={TIMELINE_DISPLAY_FILTER_DIALOG_ID}
								onClick={() => setDisplayFilterOpen(true)}
								compact
								data-cy="timeline-display-filter"
							/>
						}
						value={searchQuery}
						onChange={setSearchQuery}
						placeholder={translate(
							'notifications.center.searchPlaceholder'
						)}
						clearLabel={translate(
							'sessionList.toolbar.search.clear'
						)}
						menuLabel={translate(
							'sessionList.toolbar.search.toggle'
						)}
					/>
					{notificationFeed.length > 0 && (
						<FilterChipRow
							label={translate('notifications.center.title')}
						>
							{pillKinds.map((kind) => (
								<FilterChip
									key={kind.id}
									label={kind.label}
									icon={kind.icon!}
									assetIcon
									view={chipPresentation.view}
									count={kind.unreadCount}
									active={activeFamily === kind.id}
									onClick={() =>
										setActiveFamily((current) =>
											current === kind.id
												? null
												: (kind.id as TimelineKindId)
										)
									}
									data-cy={`timeline-chip-${kind.id}`}
								/>
							))}
							<button
								type="button"
								aria-pressed={unreadOnly}
								className={`sessionsListToolbar__chip ${
									unreadOnly
										? 'sessionsListToolbar__chip--active'
										: 'sessionsListToolbar__chip--iconOnly'
								}`}
								onClick={() => setUnreadOnly((value) => !value)}
								title={translate(
									'notifications.center.unreadFilter'
								)}
								aria-label={translate(
									'notifications.center.unreadFilter'
								)}
							>
								<MarkChatUnreadOutlinedIcon className="sessionsListToolbar__chipIconSvg" />
								<span
									className="sessionsListToolbar__chipLabel"
									aria-hidden={!unreadOnly}
								>
									{translate(
										'notifications.center.unreadFilter'
									)}
								</span>
							</button>
							<MarkAllReadButton
								hasUnread={hasUnreadActivity}
								busy={isMarkingAllRead || isClearingFeed}
								onClick={markAllNotificationsAsRead}
								label={translate(
									'notifications.center.markAllRead'
								)}
							/>
						</FilterChipRow>
					)}
				</div>
				<DisplayFilterDialog
					icon={
						<NavActivityIcon className="displayFilterDialog__heroIcon" />
					}
					id={TIMELINE_DISPLAY_FILTER_DIALOG_ID}
					open={displayFilterOpen}
					fullScreen={untilL}
					onClose={() => setDisplayFilterOpen(false)}
					kinds={timelineKinds}
					email={displayFilterEmail}
					value={timelineFilter}
					canReset={timelineOverride !== null}
					readOnly={displayFilterReadOnly || !canEditDisplayFilter}
					onChange={(next) => {
						setTimelineOverride(next);
						setActiveFamily(
							(current) =>
								reconcileActiveKind(
									next,
									current
								) as TimelineFamilyFilter
						);
					}}
					onReset={() => {
						resetTimelineOverride();
						setActiveFamily(null);
					}}
					onOpenProfile={() => {
						setDisplayFilterOpen(false);
						navigate(NOTIFICATION_SETTINGS_PATH);
					}}
					labels={displayFilterLabels.dialogLabels}
				/>
				<div className="notificationsCenter__list" ref={listScrollRef}>
					{filteredFeed.length === 0 ? (
						<div className="notificationsCenter__empty">
							{translate('notifications.center.noResults')}
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
							const { descriptor, title, text } =
								describeActivityEvent(
									item,
									translate,
									i18n.language
								);
							const hydratedPreview = visiblePreview(item.id);
							const visibleText = hydratedPreview?.text || text;
							const Icon = hydratedPreview?.kind
								? MESSAGE_PREVIEW_ICONS[hydratedPreview.kind] ||
									getEventIcon(descriptor.icon)
								: getEventIcon(descriptor.icon);
							return (
								<div
									key={item.id}
									data-notification-id={item.id}
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
													{visibleText}
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
													'notifications.center.cardMenu'
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
									{isActive && canOpenSelected && (
										<button
											type="button"
											className="notificationsCenter__expander"
											aria-label={
												selectedLinksToStatusPage
													? `${selectedOpenLabel} ${translate('notifications.center.opensInNewTab')}`
													: item.actionLabel ||
														translate(
															'notifications.center.open'
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
					{notificationFeed.length > 0 && (
						<div className="notificationsCenter__pagination">
							{olderNotificationsError ? (
								<>
									<span role="alert">
										{translate(
											'notifications.center.olderError'
										)}
									</span>
									<button
										type="button"
										disabled={isLoadingOlderNotifications}
										onClick={() =>
											void loadOlderNotifications()
										}
									>
										{translate(
											'notifications.center.retryOlder'
										)}
									</button>
								</>
							) : hasOlderNotifications ? (
								<button
									type="button"
									disabled={isLoadingOlderNotifications}
									onClick={() =>
										void loadOlderNotifications()
									}
								>
									{translate(
										isLoadingOlderNotifications
											? 'notifications.center.loadingOlder'
											: 'notifications.center.loadOlder'
									)}
								</button>
							) : (
								<span role="status">
									{translate(
										'notifications.center.endOfHistory'
									)}
								</span>
							)}
						</div>
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
					{canOpenSelected && (
						<MenuItem
							onClick={() => {
								setCardMenuAnchor(null);
								handleOpenAction();
							}}
						>
							{selectedOpenLabel}
						</MenuItem>
					)}
					{canShowChatPreview && (
						<MenuItem
							onClick={() => {
								toggleConversation();
								setCardMenuAnchor(null);
							}}
						>
							{translate(
								showEmbeddedChat
									? 'notifications.center.showDetails'
									: 'notifications.center.showPreview'
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
						{translate('notifications.center.markRead')}
					</MenuItem>
					<MenuItem
						disabled={isMarkingAllRead || isClearingFeed}
						aria-busy={isMarkingAllRead || isClearingFeed}
						onClick={() => {
							markAllNotificationsAsRead();
							setCardMenuAnchor(null);
						}}
					>
						{translate('notifications.center.markAllRead')}
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
							{translate('notifications.center.emptyDetail')}
						</div>
					) : showEmbeddedChat ? (
						<ConversationPreview
							roomId={conversation.roomId}
							threadRootId={conversation.preview?.threadRootId}
							access={conversation.preview ?? undefined}
							conversationPath={
								selectedNotification
									? getNotificationActionPath(
											selectedNotification
										)
									: null
							}
							onConversationRead={conversation.onConversationRead}
							onOpenConversation={handleOpenAction}
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
											'caseHandover.consent.approve'
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
											'caseHandover.consent.decline'
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
								{selectedLinksToStatusPage ? (
									selectedStatusPageUrl && (
										<a
											className="notificationsCenter__openButton"
											href={selectedStatusPageUrl}
											target="_blank"
											rel="noopener noreferrer"
											onClick={() =>
												markNotificationAsRead(
													selectedNotification.id
												)
											}
										>
											<OpenInNewIcon aria-hidden="true" />
											{selectedOpenLabel}
											<span className="sr-only">
												{' '}
												{translate(
													'notifications.center.opensInNewTab'
												)}
											</span>
										</a>
									)
								) : (
									<button
										type="button"
										className="notificationsCenter__openButton"
										onClick={handleOpenAction}
									>
										<OpenInFullIcon />
										{selectedOpenLabel}
									</button>
								)}
								<button
									type="button"
									className="notificationsCenter__nextButton"
									onClick={handleNextNotification}
									disabled={!nextUnreadId}
								>
									{translate('notifications.center.next')}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
