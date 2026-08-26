import * as React from 'react';
import { useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { generatePath, useLocation, useNavigate } from 'react-router-dom';
import { useActiveListItem } from '../../hooks/useActiveListItem';
import { getDisplayablePostcode } from '../sessionsList/sessionClassification';
import { getModality, Modality } from '../session/getModality';
import {
	convertISO8601ToMSSinceEpoch,
	getPrettyDateFromMessageDate,
	MILLISECONDS_PER_SECOND
} from '../../utils/dateHelpers';
import { isMatrixRoomIdHeuristic } from '../../utils/matrixRoomUtils';
import { getCurrentMatrixUserId } from '../../utils/matrixSession';
import { isChatItemUnread } from '../../utils/sessionUnread';
import { useUnreadVersion } from '../../hooks/useUnreadVersion';
import { resolveAnonymousChatDisplayName } from '../../utils/anonymousChatDisplayName';
import { UserAvatar } from '../message/UserAvatar';
import { MessageAvatar } from '../message/MessageAvatar';
import { formatMessagePersonName } from '../message/messageNameUtils';
import { ConsultantSearchLoader } from '../sessionHeader/ConsultantSearchLoader';
import { MenuVerticalIcon, ShowPasswordIcon } from '../../resources/img/icons';
import { config } from '../../resources/scripts/config';
import { ReactComponent as ArchiveIcon } from '../../resources/img/icons/inbox.svg';
import { ReactComponent as TrashIcon } from '../../resources/img/icons/trash.svg';
import { ReactComponent as HelpIcon } from '../../resources/img/icons/i.svg';
import { ReactComponent as EditGroupChatIcon } from '../../resources/img/icons/gear.svg';
import { LegalLinkMenuIcon } from '../legalLinks/LegalLinkMenuIcon';
import { ReactComponent as TextModalityIcon } from '../../resources/img/icons/chat.svg';
import { ReactComponent as AudioModalityIcon } from '../../resources/img/icons/call.svg';
import { ReactComponent as VideoModalityIcon } from '../../resources/img/icons/video-call.svg';
import mailConversationIcon from '../../resources/img/icons/chatroom/mail_conv_type_200.svg';
import internalConversationIcon from '../../resources/img/icons/chatroom/internal_conversation_200.svg';
import selfHelpIcon from '../../resources/img/icons/session-toolbar/supervision_chats.svg';
import teamImage from '../../resources/img/illustrations/Team.svg';
import {
	SESSION_LIST_TAB,
	SESSION_LIST_TAB_ARCHIVE
} from '../session/sessionHelpers';
import {
	AUTHORITIES,
	E2EEContext,
	hasUserAuthority,
	SessionTypeContext,
	useConsultingType,
	UserDataContext,
	ActiveSessionContext,
	useTopic,
	SessionsDataContext,
	REMOVE_SESSIONS
} from '../../globalState';
import { TopicSessionInterface } from '../../globalState/interfaces';
import { markdownToDraft } from 'markdown-draft-js';
import { convertFromRaw } from 'draft-js';
import './sessionsListItem.styles';
import { SessionListItemVideoCall } from './SessionListItemVideoCall';
import { SessionListItemAttachment } from './SessionListItemAttachment';
import clsx from 'clsx';
import {
	TeamDiscussionBadge,
	getCachedTeamDiscussion
} from '../teamDiscussion/TeamDiscussionBadge';
import {
	decryptText,
	MissingKeyError,
	WrongKeyError
} from '../../utils/encryptionHelpers';
import { parseMessagePrefixes } from '../message/messageConstants';
import { useE2EE } from '../../hooks/useE2EE';
import { useSearchParam } from '../../hooks/useSearchParams';
import { SessionListItemLastMessage } from './SessionListItemLastMessage';
import { getSessionNavigationPath } from './sessionsListItemHelpers';
import {
	getChatroomSettingsMenuVisibility,
	withTeamDiscussionParam
} from './chatroomSettingsMenu';
import DeleteSession from '../session/DeleteSession';
import { isGroupChatOwner } from '../groupChat/groupChatHelpers';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import { ALIAS_MESSAGE_TYPES } from '../../api/apiSendAliasMessage';
import { useTranslation } from 'react-i18next';
import {
	apiGetCaseHandoverStatus,
	apiPutArchive,
	apiPutDearchive,
	CaseHandoverStatus,
	FETCH_ERRORS
} from '../../api';
import { Overlay, OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import { archiveSessionSuccessOverlayItem } from '../sessionMenu/sessionMenuHelpers';
import { mobileListView } from '../app/navigationHandler';
import LegalLinks from '../legalLinks/LegalLinks';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { LegalLinkModal } from '../legalLinks/LegalLinkModal';
import { getSessionDropdownPosition } from './sessionDropdownPosition';
import { useMatrixSessionPreview } from '../../hooks/useMatrixSessionPreview';
import {
	getLatestMatrixRoomPreview,
	getPreviewLastMessageType,
	MatrixRoomPreview
} from './matrixRoomPreview';
import {
	isCaseHandoverAccessControlled,
	isCaseHandoverCandidate,
	isCaseHandoverDenied,
	isCaseHandoverPending
} from '../session/caseHandoverHelpers';
import {
	CaseHandoverActionButton,
	CaseHandoverActionState
} from './CaseHandoverActionButton';
interface SessionListItemProps {
	defaultLanguage: string;
	itemRef?: any;
	handleKeyDownLisItemContent?: Function;
	index: number;
	isBeforeActive?: boolean;
	isAfterActive?: boolean;
	caseHandoverBatchMode?: boolean;
	caseHandoverSelected?: boolean;
	onCaseHandoverSelect?: (sessionId: number) => void;
	onCaseHandoverBatchStart?: () => void;
	onCaseHandoverBatchConfirm?: () => void;
	onCaseHandoverBatchClose?: () => void;
}

export const SessionListItemComponent = ({
	defaultLanguage,
	itemRef,
	handleKeyDownLisItemContent,
	index,
	isBeforeActive = false,
	isAfterActive = false,
	caseHandoverBatchMode = false,
	caseHandoverSelected = false,
	onCaseHandoverSelect,
	onCaseHandoverBatchStart,
	onCaseHandoverBatchConfirm,
	onCaseHandoverBatchClose
}: SessionListItemProps) => {
	const { t: translate } = useTranslation(['common']);
	const location = useLocation();
	// WP-06 Slice 0b: route-derived single source of truth for the active item
	// (replaces the per-component rid/sessionId comparison below).
	const { isActive } = useActiveListItem();
	const navigate = useNavigate();

	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');
	const getSessionListTab = () =>
		`${sessionListTab ? `?sessionListTab=${sessionListTab}` : ''}`;
	const { userData } = useContext(UserDataContext);
	const { path: listPath, type } = useContext(SessionTypeContext);
	const { isE2eeEnabled } = useContext(E2EEContext);
	const activeSessionContext = useContext(ActiveSessionContext);
	const activeSession = activeSessionContext?.activeSession;
	const GroupModalityIcon =
		activeSession?.item?.modality === 'VIDEO'
			? VideoModalityIcon
			: activeSession?.item?.modality === 'AUDIO'
				? AudioModalityIcon
				: TextModalityIcon;
	const reloadActiveSession = activeSessionContext?.reloadActiveSession;
	const sessionItem = activeSession?.item;
	// Unread axis (#1147): derived from the Matrix room, NOT from the DTO's
	// `messagesRead` (hard-coded true by the backend). `unreadVersion` bumps
	// on notification-count/receipt changes so the styling stays live.
	const unreadVersion = useUnreadVersion();
	const isItemUnread = useMemo(
		() => isChatItemUnread(sessionItem),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[sessionItem, unreadVersion]
	);
	const { dispatch: sessionsDispatch } = useContext(SessionsDataContext);
	const legalLinks = useContext(LegalLinksContext);

	// Dropdown menu state
	const [flyoutOpen, setFlyoutOpen] = useState(false);
	const menuIconRef = React.useRef<HTMLButtonElement>(null);
	const dropdownRef = React.useRef<HTMLDivElement>(null);
	const [dropdownPosition, setDropdownPosition] = useState({
		top: 0,
		left: 0
	});
	// FE#781: the delete confirmation must outlive the menu. `DeleteSession` is
	// therefore mounted at the component root, not inside the flyout — clicking
	// the confirm overlay counts as an outside click and closes the flyout, so
	// anything rendered inside it would unmount mid-confirmation.
	const openDeleteConfirmRef = React.useRef<(() => void) | null>(null);
	const dropdownId = `session-list-item-menu-${sessionItem?.id ?? 'inactive'}`;
	const dropdownLabel = translate('groupChat.info.settings.headline');
	const [overlayItem, setOverlayItem] = useState(null);
	const [overlayActive, setOverlayActive] = useState(false);
	const [legalModal, setLegalModal] = useState<{
		title: string;
		url: string;
	} | null>(null);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const [caseHandoverStatus, setCaseHandoverStatus] =
		useState<CaseHandoverStatus | null>(null);
	const [caseHandoverStatusLoading, setCaseHandoverStatusLoading] =
		useState(false);
	// FE#781: after acceptance the Team-Besprechung entry point only survives
	// as read-only archive access, so the menu must know whether a discussion
	// exists. Resolved lazily on menu open (cached per session by the badge
	// helper) rather than eagerly for every list item.
	const [hasExistingTeamDiscussion, setHasExistingTeamDiscussion] =
		useState(false);

	useEffect(() => {
		setFlyoutOpen(false);
	}, [sessionItem?.id, location.pathname, location.search]);

	// Is List Item active
	const isChatActive = activeSession
		? isActive({
				groupId: sessionItem?.matrixRoomId,
				rid: activeSession.rid,
				sessionId: sessionItem?.id
			})
		: false;

	const language = sessionItem?.language || defaultLanguage;
	const consultingType = useConsultingType(sessionItem?.consultingType);
	const topicId = (sessionItem?.topic as TopicSessionInterface)?.id || null;
	const topic = useTopic(topicId);
	const autoSelectPostcode =
		consultingType?.registration?.autoSelectPostcode ??
		config.registration.consultingTypeDefaults.autoSelectPostcode;

	const { key, keyID, encrypted, ready } = useE2EE(
		sessionItem?.matrixRoomId || null,
		sessionItem?.lastMessageType === ALIAS_MESSAGE_TYPES.MASTER_KEY_LOST
	);
	const isMatrixBackedSession =
		isMatrixRoomIdHeuristic(sessionItem?.matrixRoomId) ||
		isMatrixRoomIdHeuristic(sessionItem?.matrixRoomId);
	const [plainTextLastMessage, setPlainTextLastMessage] = useState<
		string | null
	>(null);
	const matrixRoomId = isMatrixRoomIdHeuristic(sessionItem?.matrixRoomId)
		? sessionItem?.matrixRoomId
		: null;
	const caseHandoverAccessControlled = isCaseHandoverAccessControlled({
		activeSession,
		userData,
		type
	});
	const caseHandoverCandidate = isCaseHandoverCandidate({
		activeSession,
		userData,
		type,
		sessionListTab
	});
	const caseHandoverContentLocked =
		caseHandoverAccessControlled && !caseHandoverStatus?.canViewContent;
	const matrixSessionPreview = useMatrixSessionPreview(
		matrixRoomId,
		isMatrixBackedSession && !caseHandoverContentLocked,
		getLatestMatrixRoomPreview
	);

	useEffect(() => {
		if (caseHandoverContentLocked) {
			setPlainTextLastMessage(
				translate('caseHandover.list.hiddenPreview')
			);
			return;
		}

		if (isMatrixBackedSession) {
			const formatPreview = (preview: MatrixRoomPreview | null) => {
				if (!preview || preview.kind === 'encrypted') {
					return translate('e2ee.message.encryption.text');
				}
				if (preview.kind === 'text') {
					return preview.text || '';
				}
				return translate(
					`sessionList.preview.${preview.kind}`,
					preview.kind
				);
			};
			setPlainTextLastMessage(formatPreview(matrixSessionPreview));
		}
	}, [
		caseHandoverContentLocked,
		isMatrixBackedSession,
		matrixSessionPreview,
		translate
	]);

	useEffect(() => {
		if (caseHandoverContentLocked || isMatrixBackedSession) {
			return;
		}

		if (!ready) {
			return;
		}

		if (!sessionItem) {
			return;
		}

		if (isE2eeEnabled) {
			if (!sessionItem.e2eLastMessage) return;
			decryptText(
				sessionItem.e2eLastMessage.msg,
				keyID,
				key,
				encrypted,
				sessionItem.e2eLastMessage.t === 'e2e'
			)
				.catch((e): string =>
					translate(
						e instanceof MissingKeyError ||
							e instanceof WrongKeyError
							? e.message
							: 'e2ee.message.encryption.error'
					)
				)
				.then((message) => {
					const rawMessageObject = markdownToDraft(message);
					const contentStateMessage =
						convertFromRaw(rawMessageObject);
					setPlainTextLastMessage(contentStateMessage.getPlainText());
				});
		} else {
			if (
				sessionItem.e2eLastMessage &&
				sessionItem.e2eLastMessage.t === 'e2e'
			) {
				setPlainTextLastMessage(
					translate('e2ee.message.encryption.text')
				);
			} else {
				const rawMessageObject = markdownToDraft(
					sessionItem.lastMessage
				);
				const contentStateMessage = convertFromRaw(rawMessageObject);
				setPlainTextLastMessage(contentStateMessage.getPlainText());
			}
		}
	}, [
		isE2eeEnabled,
		key,
		keyID,
		encrypted,
		sessionItem,
		isMatrixBackedSession,
		caseHandoverContentLocked,
		translate,
		ready
	]);

	useEffect(() => {
		let cancelled = false;
		if (!caseHandoverAccessControlled || !activeSession?.item?.id) {
			setCaseHandoverStatus(null);
			setCaseHandoverStatusLoading(false);
			return () => {
				cancelled = true;
			};
		}

		setCaseHandoverStatusLoading(true);
		apiGetCaseHandoverStatus(activeSession.item.id)
			.then((status) => {
				if (!cancelled) {
					setCaseHandoverStatus(status);
				}
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}

				if (error?.message === FETCH_ERRORS.FORBIDDEN) {
					setCaseHandoverStatus({
						sessionId: activeSession.item.id,
						status: 'DENIED',
						canViewContent: false,
						clientConsentRequired: false,
						auditOutcome: 'ACCESS_DENIED'
					});
					return;
				}

				setCaseHandoverStatus(null);
			})
			.finally(() => {
				if (!cancelled) {
					setCaseHandoverStatusLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [activeSession?.item?.id, caseHandoverAccessControlled]);

	const isAsker = hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData);
	const isSupervisorView =
		!isAsker &&
		!!activeSession?.consultant?.id &&
		activeSession.consultant.id !== userData.userId;

	// FE#781 — Chatroom Settings menu, see chatroomSettingsMenu.ts.
	const { featureTeamDiscussionEnabled = true } = getTenantSettings();
	const isAgencyCounselling =
		!!activeSession &&
		getModality(activeSession) === Modality.AGENCY_COUNSELLING;
	const chatroomSettingsMenu = getChatroomSettingsMenuVisibility({
		isAsker,
		isConsultant: hasUserAuthority(
			AUTHORITIES.CONSULTANT_DEFAULT,
			userData
		),
		isSupervisorView,
		isSession: !!activeSession?.isSession,
		isEnquiry: !!activeSession?.isEnquiry,
		isGroup: !!activeSession?.isGroup,
		listType: type,
		isArchiveTab: sessionListTab === SESSION_LIST_TAB_ARCHIVE,
		isAgencyCounselling,
		teamDiscussionFeatureEnabled: featureTeamDiscussionEnabled,
		hasExistingTeamDiscussion,
		isGroupChatOwner:
			!!activeSession && isGroupChatOwner(activeSession, userData),
		isGroupChatActive: !!activeSession?.item?.active,
		hasMatrixRoom: !!activeSession?.item?.matrixRoomId
	});
	// Every flag below requires `!isAsker`, so this stays false for askers —
	// their menu is gated separately on the legal-links branch.
	const hasChatroomSettingsActions =
		chatroomSettingsMenu.showArchive ||
		chatroomSettingsMenu.showDearchive ||
		chatroomSettingsMenu.showDelete ||
		chatroomSettingsMenu.showRequestHelp ||
		chatroomSettingsMenu.showChatSettings;

	// Only an accepted session needs the lookup — an open enquiry always allows
	// starting a discussion, so its availability is already decided above.
	const needsTeamDiscussionLookup =
		flyoutOpen &&
		!isAsker &&
		featureTeamDiscussionEnabled &&
		isAgencyCounselling &&
		!activeSession?.isGroup &&
		!activeSession?.isEnquiry &&
		!!sessionItem?.id;

	useEffect(() => {
		// Reset first: list items are reused across sessions, and a stale `true`
		// would offer a Team-Besprechung that this session does not have.
		setHasExistingTeamDiscussion(false);
		if (!needsTeamDiscussionLookup) {
			return;
		}
		let cancelled = false;
		getCachedTeamDiscussion(sessionItem.id).then((discussion) => {
			if (!cancelled) {
				setHasExistingTeamDiscussion(!!discussion);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [needsTeamDiscussionLookup, sessionItem?.id]);

	const caseHandoverActionState: CaseHandoverActionState =
		caseHandoverStatus?.canViewContent
			? 'accessGranted'
			: isCaseHandoverPending(caseHandoverStatus?.status)
				? 'awaitingApproval'
				: isCaseHandoverDenied(caseHandoverStatus?.status)
					? 'accessDenied'
					: 'requestAccess';
	const canBatchSelectCaseHandover =
		caseHandoverBatchMode &&
		caseHandoverCandidate &&
		!caseHandoverStatusLoading &&
		!caseHandoverStatus?.canViewContent &&
		!isCaseHandoverPending(caseHandoverStatus?.status);
	const canShowCaseHandoverAction =
		caseHandoverCandidate &&
		!caseHandoverStatusLoading &&
		(!caseHandoverStatus?.canViewContent ||
			Boolean(caseHandoverStatus?.requestId));

	const displayLastMessage = useMemo(() => {
		if (!plainTextLastMessage) return plainTextLastMessage;
		const parsed = parseMessagePrefixes(plainTextLastMessage);
		const normalizeIds = (rawValue?: string | null) => {
			const compact = (rawValue || '').trim().toLowerCase();
			if (!compact) {
				return [];
			}
			if (compact.startsWith('@')) {
				const username = compact.slice(1).split(':')[0];
				return [compact, username, `@${username}`].filter(Boolean);
			}
			return [compact, `@${compact}`];
		};
		const matrixUserIdFromSession = getCurrentMatrixUserId();
		const currentUserIds = new Set<string>([
			...normalizeIds(matrixUserIdFromSession),
			...normalizeIds(userData?.userName)
		]);
		if (parsed.visibleToUserIds?.length) {
			const isVisible = parsed.visibleToUserIds.some((entry) =>
				normalizeIds(entry).some((normalizedEntry) =>
					currentUserIds.has(normalizedEntry)
				)
			);
			if (!isVisible) {
				return '';
			}
		}
		return parsed.cleanedMessage;
	}, [plainTextLastMessage, userData?.userName]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (flyoutOpen) {
				const target = e.target as HTMLElement;
				if (
					!target.closest('.sessionsListItem__menuIcon') &&
					!target.closest('.sessionsListItem__dropdown')
				) {
					setFlyoutOpen(false);
				}
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [flyoutOpen]);

	useEffect(() => {
		if (!flyoutOpen) {
			return undefined;
		}

		const animationFrame = window.requestAnimationFrame(() => {
			const firstFocusable = dropdownRef.current?.querySelector<
				HTMLButtonElement | HTMLAnchorElement
			>(
				'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
			);
			firstFocusable?.focus();
		});

		const handleMenuDocumentKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setFlyoutOpen(false);
				menuIconRef.current?.focus();
			}

			if (
				e.key === 'Tab' &&
				e.target instanceof Node &&
				dropdownRef.current?.contains(e.target)
			) {
				e.preventDefault();
				setFlyoutOpen(false);
				menuIconRef.current?.focus();
			}
		};

		document.addEventListener('keydown', handleMenuDocumentKeyDown);
		return () => {
			window.cancelAnimationFrame(animationFrame);
			document.removeEventListener('keydown', handleMenuDocumentKeyDown);
		};
	}, [flyoutOpen]);

	// Recalculate dropdown position when it's open and window resizes/scrolls
	useEffect(() => {
		if (flyoutOpen && menuIconRef.current) {
			const updatePosition = () => {
				if (menuIconRef.current) {
					const rect = menuIconRef.current.getBoundingClientRect();
					setDropdownPosition(
						getSessionDropdownPosition(rect, window.innerWidth)
					);
				}
			};

			window.addEventListener('scroll', updatePosition, true);
			window.addEventListener('resize', updatePosition);

			return () => {
				window.removeEventListener('scroll', updatePosition, true);
				window.removeEventListener('resize', updatePosition);
			};
		}
	}, [flyoutOpen]);

	if (!activeSession) {
		return null;
	}

	// MATRIX MIGRATION: If consulting type or topic is missing, render simplified card
	if (!consultingType) {
		// console.warn('⚠️ Missing consulting type for session', activeSession.item.id);
		return (
			<div
				onClick={() =>
					navigate(
						`/sessions/consultant/sessionView/${activeSession.item.id}`
					)
				}
				style={{
					backgroundColor: 'white',
					padding: '15px',
					margin: '5px 10px',
					border: '1px solid #ddd',
					borderRadius: '8px',
					cursor: 'pointer',
					boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
				}}
			>
				<div
					style={{
						fontSize: '14px',
						fontWeight: 'bold',
						marginBottom: '8px'
					}}
				>
					🔔{' '}
					{formatMessagePersonName(
						undefined,
						activeSession.user?.username
					) || translate('sessionList.user.unknown')}
				</div>
				<div style={{ fontSize: '12px', color: '#666' }}>
					Session ID: {activeSession.item.id} | Postcode:{' '}
					{activeSession.item.postcode}
				</div>
				<div
					style={{
						fontSize: '11px',
						color: '#999',
						marginTop: '5px'
					}}
				>
					Status: NEW (Waiting for consultant)
				</div>
			</div>
		);
	}

	// Single source of truth for this item's route — the card click and the
	// menu's Request Help entry must never drift apart.
	const getSessionPath = () =>
		getSessionNavigationPath({
			listPath,
			sessionId: activeSession.item.id,
			groupId: activeSession.item.matrixRoomId,
			rid: activeSession.rid,
			isGroup: activeSession.isGroup,
			isAsker,
			isEmptyEnquiry: activeSession.isEmptyEnquiry,
			isLiveChat: getModality(activeSession) === Modality.LIVE_CHAT,
			tabSuffix: getSessionListTab()
		});

	const handleOnClick = () => {
		if (activeSession.item.id !== undefined) {
			navigate(getSessionPath());
		}
	};

	const isMenuInteractionTarget = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		Boolean(
			target.closest(
				'.sessionsListItem__menuIcon, .sessionsListItem__dropdown'
			)
		);

	const handleKeyDownListItem = (e: React.KeyboardEvent<HTMLElement>) => {
		if (isMenuInteractionTarget(e.target)) {
			return;
		}

		handleKeyDownLisItemContent?.(e);
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleOnClick();
		}
	};

	// Dropdown menu handlers
	const handleMenuClick = (e: React.MouseEvent) => {
		e.stopPropagation(); // Prevent card click
		const newState = !flyoutOpen;
		if (newState && menuIconRef.current) {
			// Calculate position when opening - use getBoundingClientRect for viewport coordinates
			const rect = menuIconRef.current.getBoundingClientRect();
			setDropdownPosition(
				getSessionDropdownPosition(rect, window.innerWidth)
			);
		}
		setFlyoutOpen(newState);
	};

	const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
		e.stopPropagation();

		if (e.key === 'Escape' && flyoutOpen) {
			setFlyoutOpen(false);
			e.currentTarget.focus();
		}
	};

	const closeFlyoutAndReturnFocus = () => {
		setFlyoutOpen(false);
		menuIconRef.current?.focus();
	};

	const handleDropdownKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === 'Tab') {
			e.preventDefault();
			e.stopPropagation();
			closeFlyoutAndReturnFocus();
		}

		if (e.key === 'Escape') {
			e.stopPropagation();
			closeFlyoutAndReturnFocus();
		}
	};

	const handleArchiveSession = () => {
		setFlyoutOpen(false);
		setOverlayItem(archiveSessionSuccessOverlayItem);
		setOverlayActive(true);
	};

	const handleDearchiveSession = () => {
		setFlyoutOpen(false);
		apiPutDearchive(activeSession.item.id)
			.then(() => {
				reloadActiveSession?.();
				setTimeout(() => {
					if (window.innerWidth >= 900) {
						navigate(
							`${listPath}/${activeSession.item.matrixRoomId}/${activeSession.item.id}${getSessionListTab()}`
						);
					} else {
						mobileListView();
						navigate(listPath);
					}
				}, 1000);
			})
			.catch((error) => {
				// console.error(error);
			});
	};

	// Closes the menu first, then opens the confirmation that lives outside it.
	const handleDeleteSession = () => {
		setFlyoutOpen(false);
		openDeleteConfirmRef.current?.();
	};

	// FE#781: mirrors the header menu's post-delete behaviour (SessionMenu's
	// onSuccessDeleteSession) — the deleted chat leaves the list and the user
	// lands back on the list instead of a dangling detail route.
	const handleDeleteSessionSuccess = () => {
		setFlyoutOpen(false);
		sessionsDispatch({
			type: REMOVE_SESSIONS,
			ids: activeSession.item.matrixRoomId
				? [activeSession.item.matrixRoomId]
				: [activeSession.item.id]
		});
		mobileListView();
		navigate(listPath + getSessionListTab());
	};

	// FE#781 / ADR-016: reuses SessionStream's `teamDiscussion=1` contract so
	// the list menu opens the very same Team-Besprechung panel, expanded.
	const handleRequestHelp = () => {
		setFlyoutOpen(false);
		navigate(withTeamDiscussionParam(getSessionPath()));
	};

	// #1189: same destination and router state as the header menu's entry
	// (SessionMenu.tsx). `isEditMode` is what makes CreateConversationView open
	// the existing chat instead of a blank create form.
	const handleChatSettings = () => {
		setFlyoutOpen(false);
		navigate(
			generatePath(
				`${listPath}/:groupId/:id/:subRoute?/:extraPath?${getSessionListTab()}`,
				{
					groupId: activeSession.item.matrixRoomId,
					id: String(activeSession.item.id),
					subRoute: 'editGroupChat'
				}
			),
			{ state: { isEditMode: true, prevIsInfoPage: false } }
		);
	};

	const handleOverlayAction = (buttonFunction: string) => {
		if (isRequestInProgress) {
			return null;
		}
		setIsRequestInProgress(true);
		if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
			setOverlayActive(false);
			setOverlayItem(null);
			setIsRequestInProgress(false);
		} else if (buttonFunction === OVERLAY_FUNCTIONS.ARCHIVE) {
			const sessionId = activeSession.item.id;
			const sessionGroupId = activeSession.item.matrixRoomId;

			apiPutArchive(sessionId)
				.then(() => {
					sessionsDispatch({
						type: REMOVE_SESSIONS,
						ids: sessionGroupId ? [sessionGroupId] : [sessionId]
					});

					mobileListView();
					navigate(listPath);
				})
				.catch((error) => {
					// console.error(error);
				})
				.finally(() => {
					setOverlayActive(false);
					setOverlayItem(null);
					setIsRequestInProgress(false);
					setFlyoutOpen(false);
				});
		}
	};

	const prettyPrintDate = (
		messageDate: number, // seconds since epoch
		createDate: string // ISO8601 string
	) => {
		// Prioritize messageDate (last message) over createDate
		const dateToUse =
			messageDate && messageDate > 0
				? messageDate * MILLISECONDS_PER_SECOND
				: convertISO8601ToMSSinceEpoch(createDate);

		const prettyDate = getPrettyDateFromMessageDate(
			dateToUse / MILLISECONDS_PER_SECOND
		);

		return prettyDate.str ? translate(prettyDate.str) : prettyDate.date;
	};

	if (activeSession.isGroup) {
		const isMyChat = () =>
			activeSession.consultant &&
			userData.userId === activeSession.consultant.id;
		const defaultSubjectText = isMyChat()
			? translate('groupChat.listItem.subjectEmpty.self')
			: translate('groupChat.listItem.subjectEmpty.other');
		const groupModality = getModality(activeSession);
		return (
			<div
				onClick={handleOnClick}
				className={clsx(
					'sessionsListItem',
					'sessionsListItem--groupChat',
					isChatActive && 'sessionsListItem--active',
					flyoutOpen && 'sessionsListItem--menuOpen',
					!isChatActive && !isItemUnread && 'sessionsListItem--read',
					isBeforeActive && 'sessionsListItem--beforeActive',
					isAfterActive && 'sessionsListItem--afterActive'
				)}
				data-group-id={activeSession.rid ? activeSession.rid : ''}
				data-cy="session-list-item"
			>
				<div
					className={clsx(
						'sessionsListItem__content',
						isChatActive && 'sessionsListItem__content--active'
					)}
					onKeyDown={(e) => handleKeyDownListItem(e)}
					ref={itemRef}
					tabIndex={index === 0 ? 0 : -1}
					role="tab"
					aria-selected={isChatActive}
				>
					<div className="sessionsListItem__row">
						<div className="sessionsListItem__rowLeft">
							{activeSession.isGroup && (
								<div className="sessionsListItem__topic">
									{translate('groupChat.noTopicSpecified')}
								</div>
							)}
						</div>
						<div className="sessionsListItem__rowRight"></div>
					</div>
					<div className="sessionsListItem__row">
						<div className="sessionInfo__groupIcon">
							<div className="sessionsListItem__stackedAvatars">
								{/* Always render 2 avatar placeholders */}
								{[0, 1].map((_, index) => (
									<div
										key={index}
										className="sessionsListItem__avatarWrapper"
									>
										<UserAvatar
											username={`placeholder-${index}`}
											displayName="User"
											userId={`placeholder-${index}`}
											size="32px"
											ring={false}
										/>
									</div>
								))}

								{/* Optional third circle */}
								<div className="sessionsListItem__avatarWrapper sessionsListItem__avatarWrapper--plus">
									<div className="sessionsListItem__plusAvatar">
										+1
									</div>
								</div>
							</div>
						</div>
						<div
							className={clsx(
								'sessionsListItem__username',
								!isItemUnread &&
									'sessionsListItem__username--readLabel'
							)}
						>
							{typeof activeSession.item.topic === 'string'
								? activeSession.item.topic
								: activeSession.item.topic?.name || ''}
						</div>
					</div>
					<div className="sessionsListItem__row">
						<SessionListItemLastMessage
							lastMessage={
								displayLastMessage
									? displayLastMessage
									: defaultSubjectText
							}
						/>
						{activeSession.item.attachment && (
							<SessionListItemAttachment
								attachment={activeSession.item.attachment}
							/>
						)}
						{groupModality === Modality.INTERNAL_GROUP && (
							<div
								className={clsx(
									'sessionsListItem__consultingTypeIcon',
									'sessionsListItem__consultingTypeIcon--internal'
								)}
							>
								<img
									src={internalConversationIcon}
									alt={translate(
										'sessionList.item.sessionType.internal',
										'Interna'
									)}
									className="sessionsListItem__consultingTypeIcon--internalIcon"
								/>
								<span className="sessionsListItem__consultingTypeIcon--internalLabel">
									{translate(
										'sessionList.item.sessionType.internal',
										'Interna'
									)}
								</span>
							</div>
						)}
						{groupModality === Modality.SELF_HELP && (
							<div
								className={clsx(
									'sessionsListItem__consultingTypeIcon',
									'sessionsListItem__consultingTypeIcon--selfHelp'
								)}
							>
								<img
									src={selfHelpIcon}
									alt={translate(
										'sessionList.item.sessionType.selfHelp',
										'Gesprächskreis'
									)}
									className="sessionsListItem__consultingTypeIcon--selfHelpIcon"
								/>
								<span className="sessionsListItem__consultingTypeIcon--selfHelpLabel">
									{translate(
										'sessionList.item.sessionType.selfHelp',
										'Gesprächskreis'
									)}
								</span>
							</div>
						)}
						{groupModality !== Modality.INTERNAL_GROUP &&
							groupModality !== Modality.SELF_HELP && (
								<div className="sessionsListItem__consultingTypeIcon">
									<img
										src={teamImage}
										alt="Team Beratung"
										className="sessionsListItem__consultingTypeIcon--team"
									/>
								</div>
							)}
					</div>
				</div>
			</div>
		);
	}

	const hasConsultantData = !!activeSession.consultant;
	let sessionTopic = '';

	// Card title: never surface raw technical usernames
	// ("ruhiges_Yak_Kim_234", "testuser@example.invalid") — humanize via the
	// same name pipeline the chat messages use.
	if (isAsker) {
		if (hasConsultantData) {
			sessionTopic = formatMessagePersonName(
				activeSession.consultant.displayName,
				activeSession.consultant.username
			);
		} else if (activeSession.isEmptyEnquiry) {
			sessionTopic = translate('sessionList.user.writeEnquiry');
		} else {
			sessionTopic = translate('sessionList.user.consultantUnknown');
		}
	} else {
		sessionTopic = formatMessagePersonName(
			resolveAnonymousChatDisplayName(activeSession.user) || undefined,
			activeSession.user?.username
		);
	}

	const postcodeLabel = getDisplayablePostcode(activeSession.item.postcode);
	const modality = getModality(activeSession);
	const isAnonymousChat = getModality(activeSession) === Modality.LIVE_CHAT;
	const shouldShowPostcode =
		!isAsker &&
		!autoSelectPostcode &&
		!isAnonymousChat &&
		Boolean(postcodeLabel);

	return (
		<div
			onClick={handleOnClick}
			className={clsx(
				`sessionsListItem`,
				isChatActive && `sessionsListItem--active`,
				flyoutOpen && 'sessionsListItem--menuOpen',
				isAnonymousChat && `sessionsListItem--anonymous`,
				!isChatActive && !isItemUnread && 'sessionsListItem--read',
				caseHandoverContentLocked &&
					'sessionsListItem--caseHandoverLocked',
				isBeforeActive && 'sessionsListItem--beforeActive',
				isAfterActive && 'sessionsListItem--afterActive'
			)}
			data-group-id={activeSession.item.matrixRoomId}
			data-cy="session-list-item"
		>
			<div
				className={clsx(
					'sessionsListItem__content',
					isAnonymousChat && 'sessionsListItem__content--anonymous'
				)}
				onKeyDown={(e) => handleKeyDownListItem(e)}
				ref={itemRef}
				tabIndex={index === 0 ? 0 : -1}
				role="tab"
				aria-selected={isChatActive}
			>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__rowLeft">
						{isAnonymousChat ? (
							<>
								{/* Anonymous live-chat askers usually don't
								   pick a topic. Fall back to the "No topic
								   specified" chip used by group-chat cards
								   so the topic column is never empty. */}
								<div className="sessionsListItem__topic">
									{topic?.name ||
										translate('groupChat.noTopicSpecified')}
								</div>
								<div className="sessionsListItem__consultingType" />
							</>
						) : shouldShowPostcode && topic?.name ? (
							<div className="sessionsListItem__topicPostcodeGroup">
								<div className="sessionsListItem__topic">
									{topic.name}
								</div>
								<div className="sessionsListItem__postcode">
									{postcodeLabel}
								</div>
							</div>
						) : (
							<>
								{topic?.name && (
									<div className="sessionsListItem__topic">
										{topic.name}
									</div>
								)}
								<div className="sessionsListItem__consultingType">
									{shouldShowPostcode ? (
										<div
											className={clsx(
												'sessionsListItem__postcode',
												'sessionsListItem__postcode--standalone'
											)}
										>
											{postcodeLabel}
										</div>
									) : null}
								</div>
							</>
						)}
					</div>
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">
							{prettyPrintDate(
								activeSession.item.messageDate,
								activeSession.item.createDate
							)}
						</div>
						{!(isAsker && activeSession.isGroup) &&
							(isAsker || hasChatroomSettingsActions) && (
								<>
									<button
										type="button"
										ref={menuIconRef}
										className="sessionsListItem__menuIcon"
										onClick={handleMenuClick}
										onKeyDown={handleMenuKeyDown}
										aria-label={dropdownLabel}
										aria-haspopup="dialog"
										aria-expanded={flyoutOpen}
										aria-controls={
											flyoutOpen ? dropdownId : undefined
										}
									>
										<MenuVerticalIcon />
									</button>
									{flyoutOpen &&
										createPortal(
											<div
												id={dropdownId}
												ref={dropdownRef}
												className="sessionsListItem__dropdown"
												onKeyDown={
													handleDropdownKeyDown
												}
												role="dialog"
												aria-label={dropdownLabel}
												style={{
													top:
														dropdownPosition.top > 0
															? `${dropdownPosition.top}px`
															: '40px',
													left:
														dropdownPosition.left >
														0
															? `${dropdownPosition.left}px`
															: 'auto',
													right: 'auto',
													zIndex: 999999
												}}
											>
												<div className="sessionsListItem__dropdownHeader">
													<p className="sessionsListItem__dropdownSubtitle">
														{translate(
															'groupChat.info.settings.subtitle'
														)}
													</p>
													<h1 className="sessionsListItem__dropdownTitle">
														{translate(
															'groupChat.info.settings.headline'
														)}
													</h1>
												</div>
												<div className="sessionsListItem__dropdownDivider" />
												{isAsker ? (
													<>
														<div className="sessionsListItem__dropdownContent">
															<LegalLinks
																legalLinks={
																	legalLinks
																}
																params={{
																	aid: activeSession
																		?.agency
																		?.id
																}}
																filter={(
																	link
																) =>
																	link.label ===
																	'login.legal.infoText.dataprotection'
																}
															>
																{(
																	label,
																	url,
																	rawLabel
																) => (
																	<button
																		type="button"
																		className="sessionsListItem__dropdownOption"
																		onClick={() => {
																			setFlyoutOpen(
																				false
																			);
																			setLegalModal(
																				{
																					title: translate(
																						'chatFlyout.privacyPolicy'
																					),
																					url
																				}
																			);
																		}}
																	>
																		<LegalLinkMenuIcon
																			className="sessionsListItem__dropdownOptionIcon"
																			title={
																				label
																			}
																			url={
																				url
																			}
																			rawLabel={
																				rawLabel
																			}
																		/>
																		<div className="sessionsListItem__dropdownOptionCenter">
																			<div className="sessionsListItem__dropdownOptionTitleRow">
																				<span className="sessionsListItem__dropdownOptionTitle">
																					{translate(
																						'chatFlyout.privacyPolicy'
																					)}
																				</span>
																			</div>
																			<p className="sessionsListItem__dropdownOptionDescription">
																				{translate(
																					'chatFlyout.privacyPolicyDescription'
																				)}
																			</p>
																		</div>
																	</button>
																)}
															</LegalLinks>
															<LegalLinks
																legalLinks={
																	legalLinks
																}
																params={{
																	aid: activeSession
																		?.agency
																		?.id
																}}
																filter={(
																	link
																) =>
																	link.label ===
																	'login.legal.infoText.impressum'
																}
															>
																{(
																	label,
																	url,
																	rawLabel
																) => (
																	<button
																		type="button"
																		className="sessionsListItem__dropdownOption"
																		onClick={() => {
																			setFlyoutOpen(
																				false
																			);
																			setLegalModal(
																				{
																					title: translate(
																						'chatFlyout.imprint'
																					),
																					url
																				}
																			);
																		}}
																	>
																		<LegalLinkMenuIcon
																			className="sessionsListItem__dropdownOptionIcon"
																			title={
																				label
																			}
																			url={
																				url
																			}
																			rawLabel={
																				rawLabel
																			}
																		/>
																		<div className="sessionsListItem__dropdownOptionCenter">
																			<div className="sessionsListItem__dropdownOptionTitleRow">
																				<span className="sessionsListItem__dropdownOptionTitle">
																					{translate(
																						'chatFlyout.imprint'
																					)}
																				</span>
																			</div>
																		</div>
																	</button>
																)}
															</LegalLinks>
														</div>
													</>
												) : (
													<>
														<div className="sessionsListItem__dropdownContent">
															{chatroomSettingsMenu.showChatSettings && (
																<button
																	onClick={
																		handleChatSettings
																	}
																	className="sessionsListItem__dropdownOption"
																	type="button"
																	data-cy="session-list-menu-chat-settings"
																>
																	<EditGroupChatIcon className="sessionsListItem__dropdownOptionIcon" />
																	<div className="sessionsListItem__dropdownOptionCenter">
																		<div className="sessionsListItem__dropdownOptionTitleRow">
																			<span className="sessionsListItem__dropdownOptionTitle">
																				{translate(
																					'chatFlyout.editGroupChat'
																				)}
																			</span>
																		</div>
																		<p className="sessionsListItem__dropdownOptionDescription">
																			{translate(
																				'chatFlyout.editGroupChatDescription'
																			)}
																		</p>
																	</div>
																</button>
															)}
															{chatroomSettingsMenu.showArchive && (
																<button
																	onClick={
																		handleArchiveSession
																	}
																	className="sessionsListItem__dropdownOption"
																	type="button"
																	data-cy="session-list-menu-archive"
																>
																	<ArchiveIcon className="sessionsListItem__dropdownOptionIcon" />
																	<div className="sessionsListItem__dropdownOptionCenter">
																		<div className="sessionsListItem__dropdownOptionTitleRow">
																			<span className="sessionsListItem__dropdownOptionTitle">
																				{translate(
																					'chatFlyout.archive'
																				)}
																			</span>
																		</div>
																		<p className="sessionsListItem__dropdownOptionDescription">
																			{translate(
																				'chatFlyout.archiveDescription'
																			)}
																		</p>
																	</div>
																</button>
															)}
															{chatroomSettingsMenu.showDearchive && (
																<button
																	onClick={
																		handleDearchiveSession
																	}
																	className="sessionsListItem__dropdownOption"
																	type="button"
																	data-cy="session-list-menu-dearchive"
																>
																	<ArchiveIcon className="sessionsListItem__dropdownOptionIcon" />
																	<div className="sessionsListItem__dropdownOptionCenter">
																		<div className="sessionsListItem__dropdownOptionTitleRow">
																			<span className="sessionsListItem__dropdownOptionTitle">
																				{translate(
																					'chatFlyout.dearchive'
																				)}
																			</span>
																		</div>
																		<p className="sessionsListItem__dropdownOptionDescription">
																			{translate(
																				'chatFlyout.dearchiveDescription'
																			)}
																		</p>
																	</div>
																</button>
															)}
															{chatroomSettingsMenu.showDelete && (
																<button
																	onClick={
																		handleDeleteSession
																	}
																	className="sessionsListItem__dropdownOption"
																	type="button"
																	data-cy="session-list-menu-delete"
																>
																	<TrashIcon className="sessionsListItem__dropdownOptionIcon" />
																	<div className="sessionsListItem__dropdownOptionCenter">
																		<div className="sessionsListItem__dropdownOptionTitleRow">
																			<span className="sessionsListItem__dropdownOptionTitle">
																				{translate(
																					'chatFlyout.remove'
																				)}
																			</span>
																		</div>
																		<p className="sessionsListItem__dropdownOptionDescription">
																			{translate(
																				'chatFlyout.removeDescription'
																			)}
																		</p>
																	</div>
																</button>
															)}
															{chatroomSettingsMenu.showRequestHelp && (
																<button
																	onClick={
																		handleRequestHelp
																	}
																	className="sessionsListItem__dropdownOption"
																	type="button"
																	data-cy="session-list-menu-request-help"
																>
																	<HelpIcon className="sessionsListItem__dropdownOptionIcon" />
																	<div className="sessionsListItem__dropdownOptionCenter">
																		<div className="sessionsListItem__dropdownOptionTitleRow">
																			<span className="sessionsListItem__dropdownOptionTitle">
																				{translate(
																					'chatFlyout.help'
																				)}
																			</span>
																		</div>
																		<p className="sessionsListItem__dropdownOptionDescription">
																			{translate(
																				'chatFlyout.helpDescription'
																			)}
																		</p>
																	</div>
																</button>
															)}
														</div>
													</>
												)}
											</div>,
											document.body
										)}
								</>
							)}
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__icon">
						{isSupervisorView ? (
							<div
								style={{
									width: '32px',
									height: '32px',
									borderRadius: '50%',
									backgroundColor: '#fde8e8',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center'
								}}
							>
								<ShowPasswordIcon
									style={{
										width: '18px',
										height: '18px',
										color: '#c62828'
									}}
								/>
							</div>
						) : isAsker && !hasConsultantData ? (
							<ConsultantSearchLoader size="32px" />
						) : !isAsker ? (
							// Restored username+icon linkage: the asker card
							// shows the SAME animal avatar the chat derives
							// from the rc user id (generateAvatarForUser).
							<MessageAvatar
								isGroup={!!activeSession.isGroup}
								isSystemNotification={false}
								userId={
									activeSession.item.askerMatrixUserId ||
									activeSession.user?.username ||
									'unknown'
								}
								username={activeSession.user?.username || ''}
								displayName={sessionTopic}
								size={32}
							/>
						) : (
							<UserAvatar
								username={
									activeSession.consultant?.username || 'User'
								}
								displayName={sessionTopic}
								userId={
									activeSession.consultant?.id || 'unknown'
								}
								size="32px"
							/>
						)}
					</div>
					<div
						className={clsx(
							'sessionsListItem__username',
							!isItemUnread &&
								'sessionsListItem__username--readLabel'
						)}
					>
						{activeSession.isGroup &&
							activeSession.item.modality && (
								<GroupModalityIcon
									className="sessionsListItem__groupModalityIcon"
									aria-label={translate(
										`groupChat.create.modality.options.${activeSession.item.modality.toLowerCase()}`
									)}
								/>
							)}
						{sessionTopic}
					</div>
				</div>
				<div className="sessionsListItem__row">
					{/* Figma nodes 115/1139/312: when the case-handover action
					    button is shown it takes the place of the last-message
					    preview (the text sits "under" the button). Without a
					    button the normal last message is shown. */}
					{!canShowCaseHandoverAction && (
						<SessionListItemLastMessage
							lastMessage={
								caseHandoverContentLocked
									? translate(
											'caseHandover.list.hiddenPreview'
										)
									: displayLastMessage
							}
							lastMessageType={
								caseHandoverContentLocked
									? null
									: getPreviewLastMessageType(
											isMatrixBackedSession,
											activeSession.item.lastMessageType
										)
							}
							language={language}
							showLanguage={
								language &&
								activeSession.isEnquiry &&
								!activeSession.isEmptyEnquiry
							}
							showSpan={activeSession.isEmptyEnquiry}
						/>
					)}
					{!caseHandoverContentLocked &&
						activeSession.item.attachment && (
							<SessionListItemAttachment
								attachment={activeSession.item.attachment}
							/>
						)}
					{!caseHandoverContentLocked &&
						activeSession.item.videoCallMessageDTO && (
							<SessionListItemVideoCall
								videoCallMessage={
									activeSession.item.videoCallMessageDTO
								}
								listItemUsername={
									activeSession.user?.username ||
									activeSession.consultant?.username
								}
								listItemAskerRcId={
									activeSession.item.askerMatrixUserId
								}
							/>
						)}
					{canShowCaseHandoverAction && (
						<CaseHandoverActionButton
							labels={{
								requestAccess: translate(
									'caseHandover.list.requestAccess'
								),
								awaitingApproval: translate(
									'caseHandover.list.awaitingApproval'
								),
								accessGranted: translate(
									'caseHandover.list.accessGranted'
								),
								accessDenied: translate(
									'caseHandover.list.accessDenied'
								),
								selectCase: translate(
									'caseHandover.batch.selectCase'
								),
								menuLabel: translate('caseHandover.menu.label'),
								selectMultipleTitle: translate(
									'caseHandover.menu.selectMultiple.title'
								),
								selectMultipleDescription: translate(
									'caseHandover.menu.selectMultiple.description'
								),
								confirmSelectionTitle: translate(
									'caseHandover.menu.confirmSelection.title'
								),
								confirmSelectionDescription: translate(
									'caseHandover.menu.confirmSelection.description'
								),
								deselectTitle: translate(
									'caseHandover.menu.deselect.title'
								),
								deselectDescription: translate(
									'caseHandover.menu.deselect.description'
								)
							}}
							state={caseHandoverActionState}
							active={isChatActive}
							batchMode={caseHandoverBatchMode}
							selected={caseHandoverSelected}
							disabled={
								caseHandoverBatchMode &&
								!canBatchSelectCaseHandover
							}
							onRequestAccess={handleOnClick}
							onToggleSelect={() =>
								onCaseHandoverSelect?.(activeSession.item.id)
							}
							onSelectMultiple={onCaseHandoverBatchStart}
							onConfirmSelection={onCaseHandoverBatchConfirm}
							onDeselectAndClose={onCaseHandoverBatchClose}
						/>
					)}
					{/* Consulting-type modality icon (Mail / Live Chat / Interna
					    / Gesprächskreis) — always shown, including alongside the
					    case-handover action button (Figma node 115). */}
					{
						<>
							{modality === Modality.LIVE_CHAT && (
								<div
									className={clsx(
										'sessionsListItem__consultingTypeIcon',
										'sessionsListItem__consultingTypeIcon--liveChat'
									)}
								>
									<svg
										width="22"
										height="19"
										viewBox="0 0 22 19"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
										aria-hidden="true"
									>
										<path
											d="M0 18V6L8 0L14.95 5.19175C14.55 5.20842 14.1639 5.25008 13.7917 5.31675C13.4194 5.38342 13.0527 5.47783 12.6917 5.6L8 2.08325L1.66675 6.83325V16.3333H8.11675C8.25558 16.6444 8.41525 16.9361 8.59575 17.2083C8.77642 17.4806 8.97225 17.7445 9.18325 18H0ZM10.8333 17.5833C10.2056 16.9832 9.71533 16.2847 9.3625 15.4875C9.00967 14.6903 8.83325 13.8612 8.83325 13C8.83325 11.2278 9.44992 9.72925 10.6832 8.50425C11.9166 7.27925 13.4111 6.66675 15.1667 6.66675C16.9389 6.66675 18.4375 7.27925 19.6625 8.50425C20.8875 9.72925 21.5 11.2278 21.5 13C21.5 13.8612 21.3306 14.6876 20.9918 15.4792C20.6528 16.2709 20.1638 16.9639 19.525 17.5583L18.7 16.7332C19.2388 16.2499 19.6458 15.6861 19.9207 15.0418C20.1957 14.3973 20.3333 13.7167 20.3333 13C20.3333 11.5555 19.8333 10.3332 18.8333 9.33325C17.8333 8.33325 16.6111 7.83325 15.1667 7.83325C13.7389 7.83325 12.5208 8.33325 11.5125 9.33325C10.5042 10.3332 10 11.5555 10 13C10 13.7167 10.1431 14.3986 10.4292 15.0457C10.7153 15.6931 11.1249 16.2584 11.6582 16.7417L10.8333 17.5833ZM12.6083 15.7917C12.2083 15.4306 11.8958 15.0083 11.6708 14.525C11.4458 14.0417 11.3333 13.5333 11.3333 13C11.3333 11.9278 11.7083 11.0209 12.4583 10.2793C13.2083 9.53758 14.1111 9.16675 15.1667 9.16675C16.2389 9.16675 17.1458 9.53758 17.8875 10.2793C18.6292 11.0209 19 11.9278 19 13C19 13.5278 18.8958 14.0362 18.6875 14.525C18.4792 15.0138 18.1722 15.4388 17.7667 15.8L16.925 14.9832C17.2138 14.7277 17.4374 14.4277 17.5958 14.0832C17.7541 13.7389 17.8333 13.3778 17.8333 13C17.8333 12.2555 17.5749 11.6249 17.0583 11.1082C16.5416 10.5916 15.9111 10.3333 15.1667 10.3333C14.4334 10.3333 13.8056 10.5916 13.2833 11.1082C12.7611 11.6249 12.5 12.2555 12.5 13C12.5 13.3778 12.5833 13.7362 12.75 14.075C12.9167 14.4138 13.1389 14.7111 13.4167 14.9668L12.6083 15.7917ZM14.5833 19V13.9168C14.4332 13.8056 14.3124 13.6708 14.2208 13.5125C14.1291 13.3542 14.0833 13.1833 14.0833 13C14.0833 12.6945 14.1888 12.4376 14.4 12.2292C14.6112 12.0209 14.8667 11.9167 15.1667 11.9167C15.4722 11.9167 15.7292 12.0209 15.9375 12.2292C16.1458 12.4376 16.25 12.6945 16.25 13C16.25 13.1833 16.2097 13.3556 16.1292 13.5168C16.0486 13.6778 15.9222 13.8111 15.75 13.9168V19H14.5833Z"
											fill="#4B515A"
										/>
									</svg>
									<span className="sessionsListItem__consultingTypeIcon--liveChatLabel">
										{translate(
											'sessionList.item.sessionType.liveChat',
											'Live Chat'
										)}
									</span>
								</div>
							)}
							{modality === Modality.AGENCY_COUNSELLING && (
								<div
									className={clsx(
										'sessionsListItem__consultingTypeIcon',
										'sessionsListItem__consultingTypeIcon--nearby'
									)}
								>
									<img
										src={mailConversationIcon}
										alt={translate(
											'sessionList.toolbar.chips.nearby',
											'Mail'
										)}
										className="sessionsListItem__consultingTypeIcon--nearbyIcon"
									/>
									<span className="sessionsListItem__consultingTypeIcon--nearbyLabel">
										{translate(
											'sessionList.toolbar.chips.nearby',
											'Mail'
										)}
									</span>
								</div>
							)}
							{modality === Modality.INTERNAL_GROUP && (
								<div
									className={clsx(
										'sessionsListItem__consultingTypeIcon',
										'sessionsListItem__consultingTypeIcon--internal'
									)}
								>
									<img
										src={internalConversationIcon}
										alt={translate(
											'sessionList.item.sessionType.internal',
											'Interna'
										)}
										className="sessionsListItem__consultingTypeIcon--internalIcon"
									/>
									<span className="sessionsListItem__consultingTypeIcon--internalLabel">
										{translate(
											'sessionList.item.sessionType.internal',
											'Interna'
										)}
									</span>
								</div>
							)}
							{/* FE#514: team-only discussion exists on this
							    enquiry (consultants only, ADR-016). */}
							{!isAsker &&
								activeSession.isEnquiry &&
								modality === Modality.AGENCY_COUNSELLING &&
								activeSession.item?.id && (
									<TeamDiscussionBadge
										sessionId={activeSession.item.id}
									/>
								)}
							{modality === Modality.SELF_HELP && (
								<div
									className={clsx(
										'sessionsListItem__consultingTypeIcon',
										'sessionsListItem__consultingTypeIcon--selfHelp'
									)}
								>
									<img
										src={selfHelpIcon}
										alt={translate(
											'sessionList.item.sessionType.selfHelp',
											'Gesprächskreis'
										)}
										className="sessionsListItem__consultingTypeIcon--selfHelpIcon"
									/>
									<span className="sessionsListItem__consultingTypeIcon--selfHelpLabel">
										{translate(
											'sessionList.item.sessionType.selfHelp',
											'Gesprächskreis'
										)}
									</span>
								</div>
							)}
						</>
					}
				</div>
			</div>
			{overlayActive && overlayItem && (
				<Overlay
					item={overlayItem}
					handleOverlay={handleOverlayAction}
				/>
			)}
			{legalModal && (
				<LegalLinkModal
					title={legalModal.title}
					url={legalModal.url}
					onClose={() => setLegalModal(null)}
				/>
			)}
			{/* FE#781: mounted outside the flyout so the confirmation overlay
			    survives the menu closing. Renders nothing itself — it only
			    hands the menu item its opener. */}
			{chatroomSettingsMenu.showDelete && (
				<DeleteSession
					chatId={activeSession.item.id}
					onSuccess={handleDeleteSessionSuccess}
				>
					{(openConfirm) => {
						openDeleteConfirmRef.current = openConfirm;
						return null;
					}}
				</DeleteSession>
			)}
		</div>
	);
};
