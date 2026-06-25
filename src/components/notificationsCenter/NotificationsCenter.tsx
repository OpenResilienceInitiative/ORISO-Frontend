import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
	getEventDescriptor,
	getEventIcon,
	renderEventStrings,
	familyLabelKey,
	isKnownEventType
} from './eventDescriptors';
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
import './notificationsCenter.styles';

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
	if (item?.sourceSessionId) {
		return String(item.sourceSessionId);
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
	const history = useHistory();
	// WP-06 Slice 0b: the route-derived global selection is the single source of
	// truth for the active list item. The timeline keeps its own in-page
	// (master-detail) selection, but defers to the active conversation when one
	// is open, so it can never disagree with the conversation/request lists.
	const { selection: activeSelection } = useActiveListItem();
	const { untilL } = useResponsive();
	const { userData } = useContext(UserDataContext);
	const {
		notificationFeed,
		markNotificationAsRead,
		markAllNotificationsAsRead,
		refreshNotificationFeed
	} = useContext(NotificationsContext);
	const [selectedNotificationId, setSelectedNotificationId] = useState<
		string | null
	>(notificationFeed[0]?.id || null);
	// WP-06 Slice 1: timeline family filter chip (exactly one active) + search.
	const [activeFamily, setActiveFamily] =
		useState<TimelineFamilyFilter>('all');
	const [searchQuery, setSearchQuery] = useState('');
	const [caseHandoverConsentSubmitting, setCaseHandoverConsentSubmitting] =
		useState(false);

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
				{ family: activeFamily, query: searchQuery },
				(item) => {
					const { title, text } = describeItem(item, translate);
					return `${title} ${text}`;
				}
			),
		[notificationFeed, activeFamily, searchQuery, translate]
	);

	// Keep the master-detail selection inside the visible (filtered) feed.
	const effectiveSelectedId = useMemo(() => {
		if (
			selectedNotificationId &&
			filteredFeed.some((item) => item.id === selectedNotificationId)
		) {
			return selectedNotificationId;
		}
		return filteredFeed[0]?.id ?? null;
	}, [filteredFeed, selectedNotificationId]);

	useEffect(() => {
		if (selectedNotificationId !== effectiveSelectedId) {
			setSelectedNotificationId(effectiveSelectedId);
		}
	}, [effectiveSelectedId, selectedNotificationId]);

	// Drop back to "All" if the active family is no longer in the feed.
	useEffect(() => {
		if (activeFamily !== 'all' && !familiesInFeed.includes(activeFamily)) {
			setActiveFamily('all');
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
	const canShowChatPreview = selectedNotificationCategory === 'message';
	const canDecideCaseHandoverConsent =
		selectedNotification?.eventType === 'case.handover.consent.requested' &&
		Boolean(selectedSessionId) &&
		Boolean(selectedCaseHandoverRequestId);
	const getDefaultSessionsPath = useCallback(
		() =>
			hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
				? '/sessions/consultant/sessionView'
				: '/sessions/user/view',
		[userData]
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
			const directPath = toNonEmbeddedPath(item.actionPath);
			if (directPath) {
				history.push(directPath);
				return;
			}
			history.push(getDefaultSessionsPath());
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
		const directPath = toNonEmbeddedPath(selectedNotification.actionPath);
		if (directPath) {
			history.push(directPath);
			return;
		}
		history.push(getDefaultSessionsPath());
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
			!selectedSessionId ||
			!selectedCaseHandoverRequestId
		) {
			return;
		}
		setCaseHandoverConsentSubmitting(true);
		apiDecideCaseHandoverClientConsent(
			Number(selectedSessionId),
			Number(selectedCaseHandoverRequestId),
			approved
		)
			.then(() => {
				markNotificationAsRead(selectedNotification.id);
				refreshNotificationFeed();
			})
			.finally(() => setCaseHandoverConsentSubmitting(false));
	};

	const nextUnreadId = getNextNotificationId(selectedNotificationId, true);

	return (
		<div className="notificationsCenter">
			<div className="notificationsCenter__header">
				<div className="notificationsCenter__titleBlock">
					<h2 className="notificationsCenter__title">
						{translate(
							'notifications.center.title',
							'Notifications'
						)}
					</h2>
					<p className="notificationsCenter__subtitle">
						{translate(
							'notifications.center.subtitle',
							'Recent activities and updates from your chats.'
						)}
					</p>
				</div>
				<div className="notificationsCenter__actions">
					<button
						type="button"
						className="notificationsCenter__actionButton"
						onClick={markAllNotificationsAsRead}
					>
						{translate(
							'notifications.center.markAllRead',
							'Mark all as read'
						)}
					</button>
				</div>
			</div>
			<div className="notificationsCenter__content">
				<div className="notificationsCenter__list">
					{notificationFeed.length > 0 && (
						<div className="notificationsCenter__filters">
							<div
								className="notificationsCenter__chips"
								role="tablist"
								aria-label={translate(
									'notifications.center.title',
									'Notifications'
								)}
							>
								<button
									type="button"
									role="tab"
									aria-selected={activeFamily === 'all'}
									className={`notificationsCenter__chip ${
										activeFamily === 'all'
											? 'notificationsCenter__chip--active'
											: ''
									}`}
									onClick={() => setActiveFamily('all')}
								>
									{translate(
										'notifications.families.all',
										'All'
									)}
								</button>
								{familiesInFeed.map((family) => (
									<button
										key={family}
										type="button"
										role="tab"
										aria-selected={activeFamily === family}
										className={`notificationsCenter__chip ${
											activeFamily === family
												? 'notificationsCenter__chip--active'
												: ''
										}`}
										onClick={() => setActiveFamily(family)}
									>
										{translate(familyLabelKey(family))}
									</button>
								))}
							</div>
							<input
								type="search"
								className="notificationsCenter__search"
								placeholder={translate(
									'notifications.center.searchPlaceholder',
									'Search activity…'
								)}
								value={searchQuery}
								onChange={(event) =>
									setSearchQuery(event.target.value)
								}
								aria-label={translate(
									'notifications.center.searchPlaceholder',
									'Search activity…'
								)}
							/>
						</div>
					)}
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
						filteredFeed.map((item) =>
							(() => {
								const category = resolveItemCategory(item);
								const isMessage = category === 'message';
								const { descriptor, title, text } =
									describeItem(item, translate);
								const Icon = getEventIcon(descriptor.icon);
								return (
									<button
										type="button"
										key={item.id}
										className={`notificationsCenter__listItem ${
											activeNotificationId === item.id
												? 'notificationsCenter__listItem--active'
												: ''
										}`}
										onClick={() => openNotification(item)}
									>
										<div className="notificationsCenter__listItemTagRow">
											<span
												className={`notificationsCenter__listItemTag ${
													isMessage
														? 'notificationsCenter__listItemTag--message'
														: 'notificationsCenter__listItemTag--system'
												}`}
											>
												{translate(
													familyLabelKey(
														descriptor.family
													)
												)}
											</span>
										</div>
										<div className="notificationsCenter__listItemBody">
											<div className="notificationsCenter__listItemIconCircle">
												<Icon />
											</div>
											<div className="notificationsCenter__listItemContent">
												<div className="notificationsCenter__listItemHeader">
													<span className="notificationsCenter__listItemTitle">
														{title}
													</span>
													<span className="notificationsCenter__listItemTime">
														{formatRelativeTime(
															item.createdAt,
															i18n.language
														)}
													</span>
												</div>
												<div className="notificationsCenter__listItemText">
													{text}
												</div>
											</div>
										</div>
										{!item.readAt && (
											<span className="notificationsCenter__listItemUnread" />
										)}
									</button>
								);
							})()
						)
					)}
				</div>
				<div
					className={`notificationsCenter__detail ${
						canShowChatPreview && embeddedChatPath
							? 'notificationsCenter__detail--embeddedChat'
							: ''
					}`}
				>
					{selectedNotification ? (
						<div className="notificationsCenter__detailCard">
							<h3 className="notificationsCenter__detailTitle">
								{selectedDisplay?.title}
							</h3>
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
								</div>
							)}
							<div className="notificationsCenter__detailActions">
								<button
									type="button"
									className="notificationsCenter__openButton"
									onClick={handleOpenAction}
								>
									{selectedNotification.actionLabel ||
										translate(
											'notifications.center.open',
											'Open chat'
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
							{canShowChatPreview && embeddedChatPath && (
								<div className="notificationsCenter__embeddedSession">
									<iframe
										title="notifications-chat-session"
										src={embeddedChatPath}
										className="notificationsCenter__embeddedSessionFrame"
									/>
								</div>
							)}
						</div>
					) : (
						<div className="notificationsCenter__emptyDetail">
							{translate(
								'notifications.center.emptyDetail',
								'Select a notification to see the details.'
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
