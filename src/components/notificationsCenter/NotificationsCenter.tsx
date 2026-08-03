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
import { resolveNotificationActionPath } from './notificationActionTarget';
import { useActiveListItem } from '../../hooks/useActiveListItem';
import { pickActiveItemKey } from '../../utils/listItemSelection';
import {
	filterTimelineItems,
	getFamiliesInFeed,
	TimelineFamilyFilter
} from './timelineFilter';
import {
	NotificationsContext,
	SessionsDataContext,
	UserDataContext,
	AUTHORITIES,
	hasUserAuthority
} from '../../globalState';
import { getExtendedSession } from '../../globalState/helpers/stateHelpers';
import { useResponsive } from '../../hooks/useResponsive';
import { useTranslation } from 'react-i18next';
import { apiDecideCaseHandoverClientConsent } from '../../api';
import { ResizableHandle } from '../sessionsList/ResizableHandle';
import { ListSearchField } from '../listSearchField/ListSearchField';
import { MatrixActivityPreviewHydrator } from './MatrixActivityPreviewHydrator';
import { ReactComponent as RequestsFamilyIcon } from '../../resources/img/icons/timeline-request-client.svg';
import { ReactComponent as MessagesFamilyIcon } from '../../resources/img/icons/speech-bubble.svg';
import { ReactComponent as DraftsFamilyIcon } from '../../resources/img/icons/pen-paper.svg';
import { ReactComponent as HandoverFamilyIcon } from '../../resources/img/icons/persons-two.svg';
import { ReactComponent as CallsFamilyIcon } from '../../resources/img/icons/timeline-add-call.svg';
import { ReactComponent as SystemFamilyIcon } from '../../resources/img/icons/notification_bell.svg';
import { ReactComponent as AppointmentsFamilyIcon } from '../../resources/img/icons/calendar.svg';
import { ReactComponent as ImageMessageIcon } from '../../resources/img/icons/file-image.svg';
import { ReactComponent as FileMessageIcon } from '../../resources/img/icons/file-doc.svg';
import { ReactComponent as AudioMessageIcon } from '../../resources/img/icons/notification_audio.svg';
import { ReactComponent as VideoMessageIcon } from '../../resources/img/icons/video-call.svg';
import type {
	MatrixActivityPreviewKind,
	MatrixActivityPreviewLabels
} from '../../utils/matrixActivityPreview';
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

const formatRelativeTime = (createdAt: string, locale?: string) => {
	const normalizedCreatedAt =
		createdAt &&
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(createdAt) &&
		!/Z|[+-]\d{2}:\d{2}$/.test(createdAt)
			? `${createdAt}Z`
			: createdAt;
	const date = new Date(normalizedCreatedAt);
	const diffMs = Date.now() - date.getTime();
	const diffMin = Math.max(0, Math.floor(diffMs / (1000 * 60)));
	if (diffMin < 1) return 'now';
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHours = Math.floor(diffMin / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleString(locale || 'de-DE');
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
		fallbackText: item?.text
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
	const sessionsContext = useContext(SessionsDataContext);
	const sessions = sessionsContext?.sessions;
	const {
		notificationFeed,
		markNotificationAsRead,
		markAllNotificationsAsRead,
		refreshNotificationFeed,
		loadOlderNotifications,
		hasOlderNotifications,
		isLoadingOlderNotifications,
		olderNotificationsError
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
	const [hydratedMessagePreviews, setHydratedMessagePreviews] = useState<
		Record<string, { text: string; kind: MatrixActivityPreviewKind }>
	>({});
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
	}, [captureListAnchor, notificationFeed]);

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
	const previewLabels = useMemo<MatrixActivityPreviewLabels>(
		() => ({
			image: translate('notifications.center.preview.image', 'Image'),
			file: translate('notifications.center.preview.file', 'File'),
			audio: translate(
				'notifications.center.preview.audio',
				'Audio message'
			),
			video: translate('notifications.center.preview.video', 'Video'),
			notice: translate('notifications.center.preview.notice', 'Notice'),
			unsupported: translate(
				'notifications.center.preview.unsupported',
				'Unsupported message'
			),
			pending: translate(
				'notifications.center.preview.pending',
				'Waiting for decryption'
			),
			roomUnavailable: translate(
				'notifications.center.preview.roomUnavailable',
				'Conversation unavailable on this device'
			),
			eventUnavailable: translate(
				'notifications.center.preview.eventUnavailable',
				'Message unavailable in local history'
			)
		}),
		[translate]
	);
	const messagePreviewSources = useMemo(
		() =>
			notificationFeed.flatMap((item) => {
				if (
					item.eventType !== 'message.new' &&
					item.eventType !== 'thread.reply.new'
				) {
					return [];
				}
				const matrixEventId = item.params?.matrixEventId;
				const sessionId = resolveSessionId(item);
				const roomRef =
					item.params?.roomRef ||
					getExtendedSession(sessionId || undefined, sessions || [])
						?.rid;
				if (!matrixEventId || !roomRef) {
					return [];
				}
				return [
					{
						activityEventId: item.id,
						roomRef,
						matrixEventId,
						senderName: item.params?.senderName,
						fallbackText: describeItem(item, translate).text,
						labels: previewLabels
					}
				];
			}),
		[notificationFeed, previewLabels, sessions, translate]
	);
	const handlePreviewChange = useCallback(
		(
			activityEventId: string,
			preview: string,
			kind: MatrixActivityPreviewKind
		) => {
			setHydratedMessagePreviews((current) =>
				current[activityEventId]?.text === preview &&
				current[activityEventId]?.kind === kind
					? current
					: {
							...current,
							[activityEventId]: { text: preview, kind }
						}
			);
		},
		[]
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
					return `${title} ${
						hydratedMessagePreviews[item.id]?.text || text
					}`;
				}
			),
		[
			notificationFeed,
			activeFamily,
			searchQuery,
			unreadOnly,
			translate,
			hydratedMessagePreviews
		]
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
	const getNotificationActionPath = useCallback(
		(item: (typeof notificationFeed)[number]) =>
			toNonEmbeddedPath(
				resolveNotificationActionPath(item, getDefaultSessionsPath())
			),
		[getDefaultSessionsPath]
	);
	const embeddedChatPath = useMemo(() => {
		if (!canShowChatPreview) {
			return null;
		}
		const basePath = selectedNotification?.actionPath
			? selectedNotification.actionPath
			: selectedSessionId
				? `${getDefaultSessionsPath()}/session/${selectedSessionId}${
						selectedThreadRootId
							? `?threadRootId=${encodeURIComponent(selectedThreadRootId)}`
							: ''
					}`
				: null;
		if (!basePath) {
			return null;
		}
		const hasQuery = basePath.includes('?');
		return `${basePath}${hasQuery ? '&' : '?'}embeddedNotifications=1`;
	}, [
		canShowChatPreview,
		getDefaultSessionsPath,
		selectedNotification?.actionPath,
		selectedSessionId,
		selectedThreadRootId
	]);

	const getNextNotificationId = (
		fromId: string | null,
		unreadOnly: boolean
	): string | null => {
		if (filteredFeed.length === 0) {
			return null;
		}
		const startIndex = fromId
			? filteredFeed.findIndex((item) => item.id === fromId)
			: -1;
		const matchesRule = (item: (typeof filteredFeed)[number]) =>
			!unreadOnly || !item.readAt;

		for (let i = startIndex + 1; i < filteredFeed.length; i++) {
			if (matchesRule(filteredFeed[i])) {
				return filteredFeed[i].id;
			}
		}
		for (let i = 0; i <= startIndex; i++) {
			if (i >= 0 && matchesRule(filteredFeed[i])) {
				return filteredFeed[i].id;
			}
		}
		return null;
	};

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
			selectedNotificationId,
			true
		);
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

	const nextUnreadId = getNextNotificationId(selectedNotificationId, true);
	const SelectedIcon = selectedDisplay
		? getEventIcon(selectedDisplay.descriptor.icon)
		: null;
	const showEmbeddedChat = Boolean(
		embeddedChatOpen && canShowChatPreview && embeddedChatPath
	);

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
					{notificationFeed.length === 0 ? (
						<div className="notificationsCenter__empty">
							{translate(
								'notifications.center.empty',
								'No notifications yet.'
							)}
						</div>
					) : filteredFeed.length === 0 ? (
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
							const hydratedPreview =
								hydratedMessagePreviews[item.id];
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
					{notificationFeed.length > 0 && (
						<div className="notificationsCenter__pagination">
							{olderNotificationsError ? (
								<>
									<span role="alert">
										{translate(
											'notifications.center.olderError',
											'Could not load older activity.'
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
											'notifications.center.retryOlder',
											'Try again'
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
											: 'notifications.center.loadOlder',
										isLoadingOlderNotifications
											? 'Loading older activity…'
											: 'Load older activity'
									)}
								</button>
							) : (
								<span role="status">
									{translate(
										'notifications.center.endOfHistory',
										'End of activity history'
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
						<iframe
							title="notifications-chat-session"
							src={embeddedChatPath}
							className="notificationsCenter__embeddedSessionFrame"
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
