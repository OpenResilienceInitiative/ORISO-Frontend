import { CarimatMessageContainer } from '../carimat/CarimatMessageContainer';
import { NotificationSetupMessage } from '../erstantwort/NotificationSetupMessage';
import { notificationChannelPolicy } from '../erstantwort/notificationChannelPolicy';
import { CaseHandoverInformationalBody } from '../caseHandover/CaseHandoverInformationalBody';
import { notificationConversationType } from '../erstantwort/notificationConversationType';
import { AVATAR_SIZES } from '../pseudonym/avatarSizes';
import {
	ChatMenuDropdown,
	ChatMenuDropdownItem
} from '../chatMenuDropdown/ChatMenuDropdown';
import { MenuBackdrop } from '../chatMenuDropdown/MenuBackdrop';
import { useMenuEffects } from '../../features/menu-effects/useMenuEffects';
import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import sanitizeHtml from 'sanitize-html';
import { PrettyDate } from '../../utils/dateHelpers';
import { getMatrixClientLogger } from '../../utils/matrixLogging';
import {
	UserDataContext,
	hasUserAuthority,
	AUTHORITIES,
	E2EEContext,
	ServerSettingsContext,
	ActiveSessionContext,
	useTenant
} from '../../globalState';
import { STATUS_ARCHIVED } from '../../globalState/interfaces';
import { MessageDisplayName } from './MessageDisplayName';
import { formatToHHMM } from '../../utils/dateHelpers';
import { markdownToDraft } from 'markdown-draft-js';
import { stateToHTML } from 'draft-js-export-html';
import { convertFromRaw } from 'draft-js';
import {
	markdownToDraftDefaultOptions,
	normalizeHighlightColor,
	sanitizeHtmlDefaultOptions,
	urlifyLinksInText
} from '../messageSubmitInterface/richtextHelpers';
import { VideoCallMessage } from './VideoCallMessage';
import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';
import { CallTimelineMessage } from './CallTimelineMessage';
import { apiCallState } from '../../api/apiCallState';
import { callManager } from '../../services/CallManager';
import { ErstantwortMessage } from '../erstantwort/ErstantwortMessage';
import { ErstantwortSequence } from '../erstantwort/ErstantwortSequence';
import { isErstantwortMessage } from '../erstantwort/erstantwortPayload';
import { getErstantwortRenderModeForSession } from '../erstantwort/erstantwortRoomGate';
import { MessageAttachment } from './MessageAttachment';
import type { MediaCheckState } from './MessageAttachment';
import type { ChatAttachment, ChatFile } from './chatAttachmentTypes';
import { getModality, Modality } from '../session/getModality';
import {
	hasMediaInlineDisplayFeature,
	type MediaChatType
} from '../../utils/mediaUploadHelpers';
import './message.styles';
import { Appointment } from './Appointment';
import { decryptText, MissingKeyError } from '../../utils/encryptionHelpers';
import { e2eeParams } from '../../hooks/useE2EE';
import { E2EEActivatedMessage } from './E2EEActivatedMessage';
import { HistoricalReassignMessage } from './ReassignMessage';

import { MasterKeyLostMessage } from './MasterKeyLostMessage';
import { ALIAS_MESSAGE_TYPES } from '../../api/apiSendAliasMessage';
import { useTranslation } from 'react-i18next';
import { ERROR_LEVEL_WARN, TError } from '../../api/apiPostError';
import { ReactComponent as DeletedIcon } from '../../resources/img/icons/deleted.svg';
import { ReactComponent as AgencyIcon } from '../../resources/img/icons/chat-agency-house-heart.svg';
import {
	IBooleanSetting,
	SETTING_MESSAGE_ALLOWDELETING
} from '../../api/apiMatrixSettingsPublic';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { ReactComponent as XIllustration } from '../../resources/img/illustrations/x.svg';
import { BUTTON_TYPES } from '../button/Button';
import { getCurrentMatrixUserId } from '../../utils/matrixSession';
import { VideoChatDetails, VideoChatDetailsAlias } from './VideoChatDetails';
import { MessageAvatar } from './MessageAvatar';
import clsx from 'clsx';
import { ReactComponent as ThreadEntryIcon } from '../../resources/img/icons/fab-menu-thread.svg';
import { ReactComponent as ArrowForwardIcon } from '../../resources/img/icons/arrow-forward.svg';
import { ReactComponent as PenIcon } from '../../resources/img/icons/pen.svg';
import { ReactComponent as TrashIcon } from '../../resources/img/icons/trash.svg';
import { ReactComponent as PersonsIcon } from '../../resources/img/icons/persons-two-google.svg';
import { ReactComponent as PersonCircleIcon } from '../../resources/img/icons/person-circle.svg';
import { ReactComponent as ShieldPersonIcon } from '../../resources/img/icons/timeline-shield-person.svg';
import { ReactComponent as KeyboardArrowUpIcon } from '../../resources/img/icons/keyboard_arrow_up.svg';
import {
	chatEndedTextKey,
	parseMessagePrefixes,
	SYSTEM_NOTIFICATION_USER_LEFT_CHAT,
	SYSTEM_NOTIFICATION_INQUIRY_ACCEPTED,
	SYSTEM_NOTIFICATION_CASE_HANDOVER_GRANTED,
	SYSTEM_NOTIFICATION_SUPERVISION_NOTICE
} from './messageConstants';
import { CaseHandoverSystemMessageBody } from '../caseHandover/CaseHandoverClientCards';
import { resolveAnonymousChatDisplayName } from '../../utils/anonymousChatDisplayName';
import { getVisibleCaseHandoverInternalDetailsForViewer } from '../caseHandover/caseHandoverPrivacy';
import { neutralLegacyReasonLabel } from '../caseHandover/caseHandoverReasons';
import { createPortal } from 'react-dom';
import {
	autoUpdate,
	computePosition,
	flip,
	offset,
	shift
} from '@floating-ui/dom';
import type { Placement, VirtualElement } from '@floating-ui/dom';
import { ReactComponent as StackVerticalIcon } from '../../resources/img/icons/stack-vertical.svg';
import {
	formatMessagePersonName,
	formatAgencyLineWithI18n,
	resolveIncomingConsultantNameForAsker,
	resolveOwnConsultantName
} from './messageNameUtils';
import { useMatrixRoomUsers } from '../../hooks/useMatrixRoomUsers';
import { ConsultantListContext } from '../../globalState/provider/ConsultantListProvider';
import { AggregatedReaction } from '../../utils/messageRelations';
import { ReactComponent as DeliverySentIcon } from '../../resources/img/icons/delivery-sent.svg';
import { ReactComponent as DeliveryReadIcon } from '../../resources/img/icons/delivery-read.svg';
import { ReactComponent as DeliveryFailedIcon } from '../../resources/img/icons/delivery-failed.svg';
import {
	CarimatAvatar,
	CarimatHeader,
	CarimatMessageBubble
} from '../carimat/CarimatMessageFrame';
import { ReactComponent as HandoverTopicIcon } from '../../resources/img/icons/case-handover/case-handover.svg';
import { ReactComponent as AcceptanceTopicIcon } from '../../resources/img/icons/case-handover/case-accepted.svg';
import { MessageDateDivider } from './MessageDateDivider';
import AddReactionOutlinedIcon from '@mui/icons-material/AddReactionOutlined';
import { EmojiPickerPopup } from '../messageSubmitInterface/inputField/EmojiPickerPopup';
import { getQuickEmojis, rememberEmoji } from '../../utils/recentEmojis';
import {
	directAvatarChoice,
	memberAvatarChoice
} from '../../utils/sessionAvatarChoice';
import { chosenAvatarOf, counsellorChoiceOf } from '../../utils/avatarChoice';

/* How recently an Erstantwort event must have arrived for its staged reveal to
   play. Generous on purpose: the cost of skipping the animation on a genuinely
   new event is that the person sees the text immediately, while the cost of
   replaying it on old history is a wall of text re-typing itself every time the
   list scrolls. */
const ERSTANTWORT_FRESH_WINDOW_MS = 60_000;

// Slack-style long-press on the bubble opens the message action menu.
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

const logger = getMatrixClientLogger();

/**
 * The body a message starts its very first render with.
 *
 * `null` means "not known yet" and is only correct while a decryption is
 * genuinely pending. Anything that needs no decryption is resolved immediately,
 * because the alternative — filling it from an effect — draws the bubble, the
 * timestamp and the read receipts one tick before the text exists (#1253).
 */
export const initialDecryptedBody = (
	isE2eeEnabled: boolean,
	message?: string
): string | null | undefined => (isE2eeEnabled && message ? null : message);

// Open state (Figma 666:25242): the library kebab on a primary-container pill.
const ActiveKebabIcon = () => (
	<span className="messageItem__kebabIconActive" aria-hidden>
		<StackVerticalIcon />
	</span>
);

const MenuReplyDirectIcon = () => (
	<svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden>
		<path
			d="M16 14V10C16 9.16667 15.7083 8.45833 15.125 7.875C14.5417 7.29167 13.8333 7 13 7H3.825L7.425 10.6L6 12L0 6L6 0L7.425 1.4L3.825 5H13C14.3833 5 15.5625 5.4875 16.5375 6.4625C17.5125 7.4375 18 8.61667 18 10V14H16Z"
			fill="#4B515A"
		/>
	</svg>
);
const MenuReplyThreadIcon = () => <ThreadEntryIcon aria-hidden />;
const MenuMarkTextIcon = () => (
	<svg width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden>
		<path
			d="M2 22C0.895431 22 0 21.1046 0 20C0 18.8954 0.895431 18 2 18H18C19.1046 18 20 18.8954 20 20C20 21.1046 19.1046 22 18 22H2ZM4 14H5.4L13.2 6.225L11.775 4.8L4 12.6V14ZM2 16V11.75L13.2 0.575C13.3833 0.391667 13.5958 0.25 13.8375 0.15C14.0792 0.05 14.3333 0 14.6 0C14.8667 0 15.125 0.05 15.375 0.15C15.625 0.25 15.85 0.4 16.05 0.6L17.425 2C17.625 2.18333 17.7708 2.4 17.8625 2.65C17.9542 2.9 18 3.15833 18 3.425C18 3.675 17.9542 3.92083 17.8625 4.1625C17.7708 4.40417 17.625 4.625 17.425 4.825L6.25 16H2Z"
			fill="#4B515A"
		/>
	</svg>
);
const MenuForwardIcon = () => <ArrowForwardIcon aria-hidden />;
const MenuEditIcon = () => <PenIcon aria-hidden />;
const MenuDeleteIcon = () => <TrashIcon aria-hidden />;

const VisibilityPeopleIcon = () => <PersonsIcon aria-hidden />;

const VisibilityClientIcon = () => <PersonCircleIcon aria-hidden />;

const VisibilityCounsellorIcon = () => (
	<svg
		width="9"
		height="14"
		viewBox="0 0 9 14"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M4.33333 0C4.88889 0 5.36111 0.194444 5.75 0.583333C6.13889 0.972222 6.33333 1.44444 6.33333 2C6.33333 2.55556 6.13889 3.02778 5.75 3.41667C5.36111 3.80556 4.88889 4 4.33333 4C3.77778 4 3.30556 3.80556 2.91667 3.41667C2.52778 3.02778 2.33333 2.55556 2.33333 2C2.33333 1.44444 2.52778 0.972222 2.91667 0.583333C3.30556 0.194444 3.77778 0 4.33333 0ZM4.33333 4.66667C4.85556 4.66667 5.37222 4.72778 5.88333 4.85C6.39444 4.97222 6.85556 5.14444 7.26667 5.36667C7.68889 5.57778 8.02778 5.82778 8.28333 6.11667C8.53889 6.40556 8.66667 6.72222 8.66667 7.06667V10.9333C8.66667 11.1222 8.62222 11.3083 8.53333 11.4917C8.44444 11.675 8.32222 11.8444 8.16667 12C8.01111 12.1556 7.83056 12.3 7.625 12.4333C7.41944 12.5667 7.18889 12.6889 6.93333 12.8V11.3C6.93333 10.8778 6.64167 10.5333 6.05833 10.2667C5.475 10 4.9 9.86667 4.33333 9.86667C3.77778 9.86667 3.24167 9.98056 2.725 10.2083C2.20833 10.4361 1.88889 10.7333 1.76667 11.1C2.18889 11.2667 2.62222 11.3833 3.06667 11.45C3.51111 11.5167 3.96667 11.5556 4.43333 11.5667H5V13.3C4.92222 13.3222 4.84167 13.3333 4.75833 13.3333H4.5C4.1 13.3333 3.64167 13.2889 3.125 13.2C2.60833 13.1111 2.11667 12.9722 1.65 12.7833C1.18333 12.5944 0.791667 12.3472 0.475 12.0417C0.158333 11.7361 0 11.3667 0 10.9333V7.06667C0 6.72222 0.127778 6.40556 0.383333 6.11667C0.638889 5.82778 0.972222 5.57778 1.38333 5.36667C1.80556 5.14444 2.27222 4.97222 2.78333 4.85C3.29444 4.72778 3.81111 4.66667 4.33333 4.66667ZM4.33333 8.66667C4.7 8.66667 5.01389 8.53611 5.275 8.275C5.53611 8.01389 5.66667 7.7 5.66667 7.33333C5.66667 6.96667 5.53611 6.65278 5.275 6.39167C5.01389 6.13056 4.7 6 4.33333 6C3.96667 6 3.65278 6.13056 3.39167 6.39167C3.13056 6.65278 3 6.96667 3 7.33333C3 7.7 3.13056 8.01389 3.39167 8.275C3.65278 8.53611 3.96667 8.66667 4.33333 8.66667Z"
			fill="#4C555F"
		/>
	</svg>
);

const VisibilityModeratorIcon = () => <ShieldPersonIcon aria-hidden />;

const ChevronIcon = ({ className }: { className?: string }) => (
	<KeyboardArrowUpIcon className={className} aria-hidden />
);

export interface VideoCallMessageDTO {
	eventType: 'IGNORED_CALL';
	initiatorMatrixUserId: string;
	initiatorUserName: string;
}

export interface MessageItem {
	_id: string;
	message: string;
	messageDate: PrettyDate;
	messageTime: string;
	displayName: string;
	username: string;
	askerMatrixUserId?: string;
	userId: string;
	consultant?: {
		username: string;
	};
	groupId?: string;
	isNotRead: boolean;
	alias?: {
		videoCallMessageDTO?: VideoCallMessageDTO;
		content?: string;
		messageType: ALIAS_MESSAGE_TYPES;
	};
	attachments?: ChatAttachment[];
	file?: ChatFile;
	t: null | 'e2e' | 'rm' | 'room-removed-read-only' | 'room-set-read-only';
	rid: string;
	isVideoActive?: boolean;
	callLifecycle?: CallLifecycleMessage;
	/** Relations foundation (#435): id of the replied-to event, if a reply. */
	replyToEventId?: string | null;
	/** MSC3440: thread root event id when the message is a thread reply. */
	threadRootEventId?: string | null;
	/** Editing (m.replace, #435): true when a later m.replace was applied. */
	isEdited?: boolean;
}

interface MessageItemComponentProps extends MessageItem {
	isOnlyEnquiry?: boolean;
	/** Keep the complete enquiry visible while deciding whether to accept it. */
	showFullContent?: boolean;
	hideSystemMessages?: boolean;
	isMyMessage: boolean;
	clientName: string;
	isUserBanned: boolean;
	renderMode?: 'main' | 'thread';
	threadsEnabled?: boolean;
	threadRootId?: string | null;
	forceShow?: boolean;
	threadSummary?: {
		replyCount: number;
		lastReplyText: string;
	};
	onOpenThread?: (opener?: HTMLElement) => void;
	/** Relations foundation (#435): this message replies to that event. */
	replyToEventId?: string | null;
	/** Resolved quote of the replied-to message (author + text), if known. */
	replyQuote?: { author: string; text: string } | null;
	/** Start a direct reply to THIS message (wires the composer). */
	onReplyDirect?: () => void;
	/** Start editing THIS message (wires the composer, own messages only). */
	onEditDirect?: () => void;
	/** Delete THIS message via Matrix redact (own messages only, #827). */
	onDeleteDirect?: () => void;
	/** Reactions (m.annotation, #435): aggregated pills for this message. */
	reactions?: AggregatedReaction[];
	/** Add own reaction with the given emoji key. */
	onReact?: (key: string) => void;
	/** Remove own reaction by redacting the given reaction event id. */
	onUnreact?: (reactionEventId: string) => void;
	/** Send failure: cross instead of checkmarks in the bubble time rail. */
	sendFailed?: boolean;
	/**
	 * This client could not decrypt the Matrix event (UTD). Rendered with the
	 * failure cross while the adjacent decryption card explains that the
	 * incoming message is unavailable.
	 */
	encryptionBroke?: boolean;
	handleDecryptionErrors: (
		id: string,
		messageTime: string,
		error: TError
	) => void;
	handleDecryptionSuccess: (id: string) => void;
	e2eeParams: e2eeParams & { subscriptionKeyLost: boolean };
	/**
	 * #420: the Activity Timeline preview shows the real row, but nothing in
	 * it may write — no action menu, no reacting, no joining a call, no
	 * consent or notification setup. Reading stays (text, links, files).
	 */
	readOnly?: boolean;
	/**
	 * #1824: the row is shown outside its conversation (the Activity Timeline
	 * preview). Message actions stay available where their handlers are wired
	 * (reply, edit, delete, react), but nothing that leaves the Timeline is
	 * offered: no joining a call, no consent or notification setup, no
	 * Erstantwort actions, and no menu entries without a handler here.
	 */
	embedded?: boolean;
}

export const MessageItemComponent = ({
	_id,
	alias,
	userId,
	message,
	messageDate,
	messageTime,
	isMyMessage: isOwnEvent,
	showFullContent = false,
	hideSystemMessages = false,
	displayName,
	username,
	askerMatrixUserId,
	attachments,
	file,
	isNotRead,
	t,
	rid,
	handleDecryptionErrors,
	handleDecryptionSuccess,
	e2eeParams,
	isVideoActive,
	isUserBanned,
	callLifecycle,
	renderMode = 'main',
	threadsEnabled = true,
	threadRootId,
	forceShow = false,
	threadSummary,
	onOpenThread,
	replyToEventId,
	threadRootEventId,
	isEdited,
	replyQuote,
	onReplyDirect,
	onEditDirect,
	onDeleteDirect,
	reactions,
	onReact,
	onUnreact,
	sendFailed,
	encryptionBroke,
	readOnly = false,
	embedded = false
}: MessageItemComponentProps) => {
	const { t: translate } = useTranslation();
	const blocksLeavingActions = readOnly || embedded;
	const { activeSession, avatarMembers = [] } =
		useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);
	const { getSetting } = useContext(ServerSettingsContext);
	const tenant = useTenant();
	const matrixRoomUsersContext = useMatrixRoomUsers();
	const [showGrantNotifications, setShowGrantNotifications] = useState(false);
	const [deleteOverlay, setDeleteOverlay] = useState(false);
	const [isDeleteRequestInProgress, setIsDeleteRequestInProgress] =
		useState(false);
	const consultantContext = useContext(ConsultantListContext);
	const getComparableRecipientIds = useCallback(
		(rawValue?: string | null) => {
			const baseValue = (rawValue || '').trim().toLowerCase();
			if (!baseValue) {
				return new Set<string>();
			}
			const identifiers = new Set<string>([baseValue]);
			if (baseValue.startsWith('@')) {
				const usernameWithDomain = baseValue.slice(1);
				const [username] = usernameWithDomain.split(':');
				if (username) {
					identifiers.add(username);
					identifiers.add(`@${username}`);
				}
			} else {
				identifiers.add(`@${baseValue}`);
			}
			return identifiers;
		},
		[]
	);

	const currentRecipientIdentifiers = useMemo(() => {
		const matrixUserIdFromSession = getCurrentMatrixUserId();
		const merged = new Set<string>();
		[
			matrixUserIdFromSession,
			userData?.userName,
			userData?.displayName
		].forEach((value) => {
			getComparableRecipientIds(value).forEach((entry) =>
				merged.add(entry)
			);
		});
		return merged;
	}, [getComparableRecipientIds, userData?.displayName, userData?.userName]);

	const [isExpanded, setIsExpanded] = useState(false);
	const { motionEnabled } = useMenuEffects();
	const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
	const [actionMenuPosition, setActionMenuPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const actionMenuRef = React.useRef<HTMLDivElement | null>(null);
	// #1081: both menus are anchored with floating-ui instead of a one-shot
	// calculation, so they follow their message while the timeline scrolls and
	// stay on screen at any menu length. The anchor is either the trigger
	// button or — for a long-press — a virtual element at the press point.
	const [actionMenuAnchor, setActionMenuAnchor] = useState<
		Element | VirtualElement | null
	>(null);
	const [actionMenuPlacement, setActionMenuPlacement] =
		useState<Placement>('right-start');
	const [actionMenuOrigin, setActionMenuOrigin] = useState('left top');
	// Quick-reaction row: the user's own recent picks, refreshed every time the
	// menu opens, plus the "more" button that hands over to the full picker.
	const [quickEmojis, setQuickEmojis] = useState<string[]>(getQuickEmojis);
	const [isQuickEmojiPickerOpen, setIsQuickEmojiPickerOpen] = useState(false);
	const quickEmojiMoreRef = React.useRef<HTMLButtonElement | null>(null);
	const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false);
	const [visibilityMenuPosition, setVisibilityMenuPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const visibilityMenuRef = React.useRef<HTMLDivElement | null>(null);
	const [visibilityMenuAnchor, setVisibilityMenuAnchor] =
		useState<Element | null>(null);
	const [visibilityMenuPlacement, setVisibilityMenuPlacement] =
		useState<Placement>('right-start');
	const [visibilityMenuOrigin, setVisibilityMenuOrigin] =
		useState('left top');
	const resetMessageMenus = useCallback(() => {
		setIsActionMenuOpen(false);
		setIsVisibilityMenuOpen(false);
		setActionMenuPosition(null);
		setVisibilityMenuPosition(null);
	}, []);
	const closeMessageMenus = useCallback(() => {
		const anchor = isActionMenuOpen
			? actionMenuAnchor
			: visibilityMenuAnchor;
		resetMessageMenus();
		if (anchor instanceof HTMLElement) anchor.focus();
	}, [
		isActionMenuOpen,
		actionMenuAnchor,
		visibilityMenuAnchor,
		resetMessageMenus
	]);
	useEffect(() => {
		if (!isActionMenuOpen && !isVisibilityMenuOpen) return;
		const onKey = (event: KeyboardEvent) => {
			const menu = isActionMenuOpen
				? actionMenuRef.current
				: visibilityMenuRef.current;
			if (
				menu?.contains(event.target as Node) &&
				['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
			) {
				const items = Array.from(
					menu.querySelectorAll<HTMLElement>(
						'button:not(:disabled), a[href]'
					)
				);
				const index = items.indexOf(
					document.activeElement as HTMLElement
				);
				const next =
					event.key === 'Home'
						? 0
						: event.key === 'End'
							? items.length - 1
							: (index +
									(event.key === 'ArrowDown' ? 1 : -1) +
									items.length) %
								items.length;
				event.preventDefault();
				items[next]?.focus();
			}

			if (
				event.key === 'Escape' &&
				!event.defaultPrevented &&
				!isQuickEmojiPickerOpen
			) {
				event.preventDefault();
				closeMessageMenus();
			}
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [
		isActionMenuOpen,
		isVisibilityMenuOpen,
		isQuickEmojiPickerOpen,
		closeMessageMenus
	]);
	const actionMenuReady = isActionMenuOpen && Boolean(actionMenuPosition);
	const visibilityMenuReady =
		isVisibilityMenuOpen && Boolean(visibilityMenuPosition);
	useEffect(() => {
		const menu = actionMenuReady
			? actionMenuRef.current
			: visibilityMenuReady
				? visibilityMenuRef.current
				: null;
		menu?.querySelector<HTMLElement>(
			'button:not(:disabled), a[href]'
		)?.focus();
	}, [actionMenuReady, visibilityMenuReady]);
	// Slack-style long-press on the bubble opens the action menu (mobile).
	const longPressTimerRef = React.useRef<number | null>(null);
	const longPressStartRef = React.useRef<{ x: number; y: number } | null>(
		null
	);
	const longPressFiredRef = React.useRef(false);
	const [expandedVisibilitySections, setExpandedVisibilitySections] =
		useState<{
			clients: boolean;
			counsellors: boolean;
			moderators: boolean;
		}>({
			clients: true,
			counsellors: true,
			moderators: true
		});

	const { isE2eeEnabled } = useContext(E2EEContext);

	const [decryptedMessage, setDecryptedMessage] = useState<
		string | null | undefined
	>(() => initialDecryptedBody(isE2eeEnabled, message));

	// Character limit for collapsing messages
	const MESSAGE_CHAR_LIMIT = 300;

	// Reset expanded state only when message ID changes (not when message content changes)
	useEffect(() => {
		setIsExpanded(false);
	}, [_id]);

	useEffect(() => {
		if (isActionMenuOpen) {
			// Re-read on open: an emoji picked in the composer (or on another
			// message) must show up here without a reload.
			setQuickEmojis(getQuickEmojis());
			return;
		}
		setIsQuickEmojiPickerOpen(false);
	}, [isActionMenuOpen, closeMessageMenus, actionMenuAnchor]);

	/** React with `emoji` and promote it to the front of the recent list. */
	const applyQuickReaction = useCallback(
		(emoji: string) => {
			rememberEmoji(emoji);
			setQuickEmojis(getQuickEmojis());
			onReact?.(emoji);
			setIsQuickEmojiPickerOpen(false);
			closeMessageMenus();
		},
		[onReact, closeMessageMenus]
	);

	useEffect(() => {
		if (!isActionMenuOpen) {
			return;
		}
		const handleOutsideClick = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (!target) {
				return;
			}
			// The full emoji picker portals to <body>, so it sits outside the
			// menu element. Without this exemption picking an emoji from it
			// would close the menu (and unmount the picker) on mousedown,
			// before the click that selects the emoji ever lands.
			if (
				target instanceof Element &&
				target.closest('[data-testid="emoji-picker-popup"]')
			) {
				return;
			}
			if (
				!actionMenuRef.current?.contains(target) &&
				!(
					actionMenuAnchor instanceof HTMLElement &&
					actionMenuAnchor.contains(target)
				)
			) {
				event.preventDefault();
				closeMessageMenus();
			}
		};
		document.addEventListener('mousedown', handleOutsideClick);
		return () =>
			document.removeEventListener('mousedown', handleOutsideClick);
	}, [isActionMenuOpen, closeMessageMenus, actionMenuAnchor]);

	useEffect(() => {
		if (!isVisibilityMenuOpen) {
			return;
		}
		const handleOutsideClick = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (!target) {
				return;
			}
			if (
				!visibilityMenuRef.current?.contains(target) &&
				!visibilityMenuAnchor?.contains(target)
			) {
				event.preventDefault();
				closeMessageMenus();
				setVisibilityMenuPosition(null);
			}
		};
		document.addEventListener('mousedown', handleOutsideClick);
		return () =>
			document.removeEventListener('mousedown', handleOutsideClick);
	}, [isVisibilityMenuOpen, closeMessageMenus, visibilityMenuAnchor]);

	useEffect(
		() => () => {
			if (longPressTimerRef.current !== null) {
				window.clearTimeout(longPressTimerRef.current);
			}
		},
		[]
	);

	useEffect((): (() => void) | void => {
		if (!isE2eeEnabled || !message) {
			setDecryptedMessage(message);
			return;
		}

		/* A decryption that resolves late must not overwrite the body of the
		   message that replaced it. Without this, a slow result can land after
		   the component has already moved on (#1253). */
		let cancelled = false;

		decryptText(
			message,
			e2eeParams.keyID,
			e2eeParams.key,
			e2eeParams.encrypted,
			t === 'e2e'
		)
			.catch((e) => {
				if (!(e instanceof MissingKeyError)) {
					handleDecryptionErrors(_id, messageTime, {
						name: e.name,
						message: e.message,
						stack: e.stack,
						level: ERROR_LEVEL_WARN
					});
				}

				return translate('e2ee.message.encryption.text');
			})
			.then((text) => {
				if (cancelled) {
					return;
				}
				setDecryptedMessage(text);
				handleDecryptionSuccess(_id);
			});

		return () => {
			cancelled = true;
		};
	}, [
		translate,
		message,
		t,
		isE2eeEnabled,
		handleDecryptionErrors,
		e2eeParams.keyID,
		e2eeParams.key,
		e2eeParams.encrypted,
		messageTime,
		_id,
		handleDecryptionSuccess
	]);

	const parsedMessage = useMemo(
		() => parseMessagePrefixes(decryptedMessage),
		[decryptedMessage]
	);
	/* #1188: a system notice belongs to the conversation, not to the account
	   that happened to post it. Laid out as "mine", the takeover notice lost
	   its header and sat on the right for the counsellor who took the case. */
	const isMyMessage = isOwnEvent && !parsedMessage.isSystemNotification;
	const roomUser = useMemo(() => {
		if (!matrixRoomUsersContext?.users?.length) {
			return null;
		}
		return (
			matrixRoomUsersContext.users.find(
				(entry) => entry?._id === userId
			) ||
			matrixRoomUsersContext.users.find(
				(entry) => entry?.username === username
			) ||
			null
		);
	}, [matrixRoomUsersContext?.users, userId, username]);
	const consultantMatch = useMemo(() => {
		const consultantList = consultantContext?.consultantList || [];
		if (!consultantList.length) {
			return null;
		}
		const normalize = (value?: string) =>
			(value || '').trim().toLowerCase().replace(/^@/, '').split(':')[0];
		const targetUsername = normalize(username);
		const targetDisplayName = normalize(displayName);
		return (
			consultantList.find(
				(entry) => normalize(entry?.username) === targetUsername
			) ||
			consultantList.find(
				(entry) => normalize(entry?.rawUsername) === targetUsername
			) ||
			consultantList.find(
				(entry) =>
					normalize(entry?.consultantDisplayName) ===
					targetDisplayName
			) ||
			consultantList.find((entry) => entry?.value === userId) ||
			null
		);
	}, [consultantContext?.consultantList, displayName, userId, username]);
	const normalizeAudienceLabel = useCallback(
		(rawValue: string) => {
			const trimmed = (rawValue || '').trim();
			if (!trimmed) {
				return '';
			}
			if (trimmed.toLowerCase() === '__all__') {
				return translate('message.audience.all');
			}
			let normalized = trimmed;
			if (normalized.startsWith('@')) {
				normalized = normalized.slice(1);
			}
			if (normalized.includes(':')) {
				normalized = normalized.split(':')[0];
			}
			normalized = normalized.replace(/[_-]+/g, ' ').trim();
			const roleSplitMatch = normalized.match(
				/^(.*?)(consultant|user|supervisor|moderator)(\d*)$/i
			);
			if (roleSplitMatch?.[1] && roleSplitMatch?.[2]) {
				normalized = `${roleSplitMatch[1]} ${roleSplitMatch[2]}${
					roleSplitMatch[3] || ''
				}`;
			}
			return normalized || trimmed;
		},
		[translate]
	);
	const makeComparableAudienceLabel = useCallback(
		(value: string) =>
			`${value || ''}`
				.toLowerCase()
				.replace(/\s+/g, '')
				.replace(/[^a-z0-9]/gi, ''),
		[]
	);
	const senderComparableLabels = useMemo(() => {
		const values = [displayName, username, userId];
		return new Set(
			values
				.map((value) => normalizeAudienceLabel(`${value || ''}`))
				.filter(Boolean)
				.map((value) => makeComparableAudienceLabel(value))
				.filter(Boolean)
		);
	}, [
		displayName,
		makeComparableAudienceLabel,
		normalizeAudienceLabel,
		userId,
		username
	]);
	const rawVisibleAudienceLabels = useMemo(() => {
		return parsedMessage.visibleToUserIds
			.map((entry) => normalizeAudienceLabel(entry))
			.filter(Boolean);
	}, [normalizeAudienceLabel, parsedMessage.visibleToUserIds]);
	const visibleAudienceLabels = useMemo(() => {
		return rawVisibleAudienceLabels
			.filter(
				(label) =>
					!(
						isMyMessage &&
						senderComparableLabels.has(
							makeComparableAudienceLabel(label)
						)
					)
			)
			.filter(Boolean);
	}, [
		isMyMessage,
		makeComparableAudienceLabel,
		rawVisibleAudienceLabels,
		senderComparableLabels
	]);
	const getAudienceRoleFromLabel = useCallback(
		(rawLabel: string): 'clients' | 'counsellors' | 'moderators' => {
			const normalized = `${rawLabel || ''}`.toLowerCase();
			if (
				normalized.includes('moderator') ||
				normalized.includes('supervisor')
			) {
				return 'moderators';
			}
			if (
				normalized.includes('counsellor') ||
				normalized.includes('counselor') ||
				normalized.includes('consultant') ||
				normalized.includes('berater')
			) {
				return 'counsellors';
			}
			return 'clients';
		},
		[]
	);
	/**
	 * Whether this message goes to *everyone* in the room.
	 *
	 * Lifted out of `visibilityGroups` so the render condition can read it too:
	 * the visibility chip exists to mark a message only **some** participants
	 * can see, so showing it with the label "Alle" states the opposite of what
	 * the chip means.
	 *
	 * `__all__` is the explicit marker; an empty recipient list in a group is
	 * the implicit one (nothing was restricted, so everyone is addressed).
	 */
	const isAllAudienceSelected = useMemo(() => {
		const includesAllAudience = parsedMessage.visibleToUserIds.some(
			(entry) => `${entry || ''}`.trim().toLowerCase() === '__all__'
		);
		const assumeAllAudienceByDefault =
			parsedMessage.visibleToUserIds.length === 0 &&
			!!activeSession?.isGroup;
		return includesAllAudience || assumeAllAudienceByDefault;
	}, [parsedMessage.visibleToUserIds, activeSession?.isGroup]);
	const visibilityGroups = useMemo(() => {
		const selectedComparableLabels = new Set(
			visibleAudienceLabels.map((entry) =>
				makeComparableAudienceLabel(entry)
			)
		);
		const allCandidates = new Map<string, string>();
		const addCandidate = (rawValue?: string | null) => {
			const label = normalizeAudienceLabel(`${rawValue || ''}`);
			if (!label) {
				return;
			}
			const compact = label.trim();
			const compactLower = compact.toLowerCase();
			if (
				compactLower === 'all' ||
				compactLower.startsWith('enc.') ||
				compactLower.includes('.onugc')
			) {
				return;
			}
			const key = makeComparableAudienceLabel(compact);
			if (!key) {
				return;
			}
			if (senderComparableLabels.has(key)) {
				return;
			}
			const existing = allCandidates.get(key);
			if (!existing) {
				allCandidates.set(key, compact);
				return;
			}
			const shouldReplace =
				(/\s/.test(compact) && !/\s/.test(existing)) ||
				compact.length > existing.length;
			if (shouldReplace) {
				allCandidates.set(key, compact);
			}
		};

		visibleAudienceLabels.forEach((label) => addCandidate(label));
		addCandidate(activeSession?.user?.username);
		addCandidate(activeSession?.consultant?.displayName);
		addCandidate(activeSession?.consultant?.username);

		(activeSession?.item?.moderators || []).forEach((moderatorId) => {
			const roomMatch = (matrixRoomUsersContext?.users || []).find(
				(entry) => entry?._id === moderatorId
			);
			addCandidate(
				roomMatch?.displayName || roomMatch?.username || moderatorId
			);
		});

		(consultantContext?.consultantList || []).forEach((entry) => {
			addCandidate(entry?.consultantDisplayName);
		});

		type AudienceChipEntry = { label: string; selected: boolean };
		const clients: AudienceChipEntry[] = [];
		const counsellors: AudienceChipEntry[] = [];
		const moderators: AudienceChipEntry[] = [];

		Array.from(allCandidates.values())
			.sort((a, b) => a.localeCompare(b))
			.forEach((label) => {
				const role = getAudienceRoleFromLabel(label);
				const isSelected =
					isAllAudienceSelected ||
					selectedComparableLabels.has(
						makeComparableAudienceLabel(label)
					);
				const chip = { label, selected: isSelected };
				if (role === 'moderators') {
					moderators.push(chip);
					return;
				}
				if (role === 'counsellors') {
					counsellors.push(chip);
					return;
				}
				clients.push(chip);
			});

		return {
			clients,
			counsellors,
			moderators
		};
	}, [
		activeSession?.consultant?.displayName,
		activeSession?.consultant?.username,
		activeSession?.item?.moderators,
		activeSession?.user?.username,
		consultantContext?.consultantList,
		makeComparableAudienceLabel,
		getAudienceRoleFromLabel,
		normalizeAudienceLabel,
		matrixRoomUsersContext?.users,
		senderComparableLabels,
		visibleAudienceLabels,
		// `parsedMessage.visibleToUserIds` and `activeSession?.isGroup` moved out
		// with `isAllAudienceSelected`; this memo now depends on the derived
		// value instead of on both inputs.
		isAllAudienceSelected
	]);
	const visibleAudienceSummaryLabels = useMemo(() => {
		const sourceLabels =
			visibleAudienceLabels.length > 0
				? visibleAudienceLabels
				: rawVisibleAudienceLabels;
		const grouped = {
			clients: [] as string[],
			counsellors: [] as string[],
			moderators: [] as string[]
		};
		sourceLabels.forEach((label) => {
			const role = getAudienceRoleFromLabel(label);
			grouped[role].push(label);
		});
		const summary: string[] = [];
		(['clients', 'counsellors', 'moderators'] as const).forEach((role) => {
			const entries = grouped[role];
			if (entries.length === 0) {
				return;
			}
			if (entries.length === 1) {
				summary.push(entries[0]);
				return;
			}
			const roleLabel =
				role === 'clients'
					? translate('message.audience.clients')
					: role === 'counsellors'
						? translate('message.audience.counsellors')
						: translate('message.audience.moderators');
			summary.push(`${entries.length} ${roleLabel}`);
		});
		if (
			summary.length === 0 &&
			rawVisibleAudienceLabels.length === 0 &&
			activeSession?.isGroup
		) {
			summary.push(translate('message.audience.all'));
		}
		return summary;
	}, [
		activeSession?.isGroup,
		getAudienceRoleFromLabel,
		rawVisibleAudienceLabels,
		translate,
		visibleAudienceLabels
	]);

	/**
	 * The rendered body is a pure function of the decrypted text, so it is
	 * derived here rather than pushed into state by an effect. As state it
	 * needed a second tick after decryption before the body existed, which is
	 * the window the empty bubble was drawn in (#1253).
	 */
	const renderedMessage = useMemo<string | null>((): string | null => {
		const renderImageMarkers = (content: string) =>
			content.replace(
				/\[image:\s*(https?:\/\/[^\]\s]+)\s*\]/gi,
				(_match, imageUrl: string) =>
					`<img class="messageItem__inlineImage" src="${imageUrl}" alt="${translate('message.thread.inlineImageAlt')}" loading="lazy" decoding="async" />`
			);
		const decodeHtmlEntities = (content: string) => {
			if (!content || !content.includes('&')) {
				return content;
			}
			const textarea = document.createElement('textarea');
			textarea.innerHTML = content;
			return textarea.value;
		};
		const normalizeMarkTagsToHighlightTokens = (content: string) =>
			content.replace(
				/<mark([^>]*)>([\s\S]*?)<\/mark>/gi,
				(_match, attrs: string, inner: string) => {
					const styleMatch = attrs.match(
						/style\s*=\s*["']([^"']*)["']/i
					);
					const dataColorMatch = attrs.match(
						/data-color\s*=\s*["']([^"']+)["']/i
					);
					const styleColorMatch = styleMatch?.[1]?.match(
						/background-color\s*:\s*([^;]+)/i
					);
					const color =
						normalizeHighlightColor(dataColorMatch?.[1] || '') ||
						normalizeHighlightColor(styleColorMatch?.[1] || '') ||
						normalizeHighlightColor(attrs || '');
					if (!color) {
						return `<mark>${inner}</mark>`;
					}
					return `[[hl:${color}]]${inner}[[/hl]]`;
				}
			);
		const renderHighlightTokens = (content: string) =>
			content.replace(
				/\[\[hl:([^\]]+)\]\]([\s\S]*?)\[\[\/hl\]\]|\[hl:([^\]]+)\]([\s\S]*?)\[\/hl\]/gi,
				(
					_match,
					doubleBracketColorRaw: string,
					doubleBracketInner: string,
					legacyColorRaw: string,
					legacyInner: string
				) => {
					const colorRaw = doubleBracketColorRaw || legacyColorRaw;
					const inner = doubleBracketInner ?? legacyInner;
					const color = normalizeHighlightColor(colorRaw);
					if (!color) {
						return `<mark>${inner}</mark>`;
					}
					return `<span class="messageItem__highlight" data-color="${color}">${inner}</span>`;
				}
			);
		const renderAlignmentTokens = (content: string) =>
			content.replace(
				/\[\[align:(left|center|right)\]\]([\s\S]*?)\[\[\/align\]\]/gi,
				(_match, alignRaw: string, inner: string) => {
					const align = alignRaw.toLowerCase();
					if (!['left', 'center', 'right'].includes(align)) {
						return inner;
					}
					return `<div class="messageItem__align messageItem__align--${align}">${inner}</div>`;
				}
			);

		const decodedMessage = decodeHtmlEntities(
			parsedMessage.cleanedMessage || ''
		);
		const preparedMessage = renderAlignmentTokens(
			renderHighlightTokens(
				renderImageMarkers(
					normalizeMarkTagsToHighlightTokens(decodedMessage)
				)
			)
		);
		const hasRichHtml =
			/<(p|h[1-6]|strong|em|u|mark|span|blockquote|ul|ol|li|a|br|img|sup|sub|code|pre)\b/i.test(
				preparedMessage
			);
		if (hasRichHtml) {
			return sanitizeHtml(preparedMessage, sanitizeHtmlDefaultOptions);
		}

		try {
			const rawMessageObject = markdownToDraft(
				preparedMessage,
				markdownToDraftDefaultOptions
			);
			const contentStateMessage = convertFromRaw(rawMessageObject);

			return contentStateMessage.hasText()
				? sanitizeHtml(
						renderHighlightTokens(
							renderImageMarkers(
								urlifyLinksInText(
									stateToHTML(contentStateMessage)
								)
							)
						),
						sanitizeHtmlDefaultOptions
					)
				: '';
		} catch (error) {
			// Markdown parsing failed; fall back to the sanitized raw message.
			logger.debug(
				'Message markdown render failed, using raw text',
				error
			);
			return sanitizeHtml(preparedMessage, sanitizeHtmlDefaultOptions);
		}
		// `parsedMessage` is itself memoized on `decryptedMessage`, so this one
		// dependency already tracks every change to the decrypted body.
	}, [parsedMessage.cleanedMessage, translate]);

	const isSupervisorFeedback = parsedMessage.isSupervisorFeedback;
	const isSystemNotification = parsedMessage.isSystemNotification;
	const persistedHandoverGrant =
		parsedMessage.systemNotificationHandoverGrant;
	const isPersistedGrantForAsker =
		Boolean(persistedHandoverGrant) &&
		hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
		!activeSession.isGroup &&
		notificationConversationType(activeSession) === 'AGENCY_COUNSELLING';
	const persistedAcceptance = parsedMessage.systemNotificationAcceptance;
	const isAcceptedNoticeForAsker =
		persistedAcceptance?.sessionId === activeSession.item.id &&
		hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
		!activeSession.isGroup &&
		notificationConversationType(activeSession) === 'AGENCY_COUNSELLING';
	/* ADR-018 / ORISO-Frontend#772. Keyed off the raw body rather than off
	   `parsedMessage.systemNotificationType`, because the payload version has to
	   be inspected too: an event from a newer server must render nothing at all
	   rather than fall through to the generic system-notification chrome, which
	   would show a raw JSON blob. */
	const isErstantwortEvent = useMemo(
		() => isErstantwortMessage(decryptedMessage),
		[decryptedMessage]
	);
	const erstantwortModality = useMemo(
		() => notificationConversationType(activeSession),
		[activeSession]
	);
	const grantNotificationPolicy = notificationChannelPolicy(
		tenant?.settings,
		erstantwortModality
	);
	useEffect(
		() => setShowGrantNotifications(false),
		[activeSession.item.id, userData?.userId, tenant?.id, _id]
	);
	/* An Erstantwort in an internal counsellor room would be a category error —
	   INTERNAL_GROUP has no advice seeker to greet — and the catalogue silently
	   resolves anything unknown to Agency Counselling, so it would render the
	   wrong sequence rather than none. Such an event renders one neutral line
	   instead of falling through to the generic chrome (raw JSON payload).
	   Decision lives in erstantwortRoomGate.ts. */
	const erstantwortRenderMode = getErstantwortRenderModeForSession(
		isErstantwortEvent,
		activeSession
	);
	/* Only a freshly arrived event plays the stagger. The message list mounts and
	   unmounts items on scroll and on pagination, and ErstantwortSequence resets
	   `revealed` to 0 on every mount — so without this an event received days ago
	   types itself out again each time it scrolls into view, and `onFirstReveal`
	   fires again with it. */
	const isRecentErstantwortEvent = useMemo(() => {
		const timestamp = Number(messageTime);
		if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
		return Date.now() - timestamp < ERSTANTWORT_FRESH_WINDOW_MS;
	}, [messageTime]);
	const isUserLeftChatEvent =
		parsedMessage.systemNotificationType ===
		SYSTEM_NOTIFICATION_USER_LEFT_CHAT;
	const isInquiryAcceptedEvent =
		parsedMessage.systemNotificationType ===
		SYSTEM_NOTIFICATION_INQUIRY_ACCEPTED;
	const isCaseHandoverGrantedEvent =
		parsedMessage.systemNotificationType ===
		SYSTEM_NOTIFICATION_CASE_HANDOVER_GRANTED;
	/* T49: the supervision side room's notice is drawn with the SAME organism
	   as the main chat's Carimat message (ErstantwortSequence → pseudonymCard),
	   under the room's name — never with the generic chrome below. */
	const isSupervisionNoticeEvent =
		parsedMessage.systemNotificationType ===
		SYSTEM_NOTIFICATION_SUPERVISION_NOTICE;
	const userLeftChatEventText = translate(
		chatEndedTextKey(
			parsedMessage.systemNotificationEndedBy,
			hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
		)
	);
	const systemNotificationTitle =
		parsedMessage.systemNotificationTitle ||
		translate('message.systemNotificationTitle');
	const systemNotificationDescription =
		parsedMessage.systemNotificationDescription ||
		parsedMessage.cleanedMessage;
	const systemNotificationReasonLabel = neutralLegacyReasonLabel(
		translate,
		parsedMessage.systemNotificationReasonLabel
	);
	const systemNotificationExplanation =
		parsedMessage.systemNotificationExplanation;
	const visibleCaseHandoverInternalDetails =
		getVisibleCaseHandoverInternalDetailsForViewer(
			userData?.grantedAuthorities,
			{
				reasonLabel: systemNotificationReasonLabel,
				explanation: systemNotificationExplanation
			}
		);
	const systemNotificationRawDescription =
		parsedMessage.systemNotificationDescription;
	/* The stored description is frozen in the server's language; the header is
	   translated here, so the body must be too or the bubble mixes languages. */
	const acceptedDescription = translate(
		'notifications.events.inquiryAccepted.text'
	);
	const renderedMessageWithoutPrefix = renderedMessage;

	const hasRenderedMessage =
		renderedMessageWithoutPrefix && renderedMessageWithoutPrefix.length > 0;

	/**
	 * Two different things used to look identical here (#1253): `null` means the
	 * body is not known yet — a decryption is still in flight — while `''` means
	 * it is known and genuinely empty. Only the first must never be dressed up
	 * as a finished message.
	 */
	const isBodyResolved =
		decryptedMessage !== null && decryptedMessage !== undefined;

	const getMessageDate = () => {
		// Defence in depth (N-2): a message without a date must never send
		// the whole conversation to the error page.
		const label = messageDate?.str || messageDate?.date;
		if (label) {
			return <MessageDateDivider label={translate(label)} />;
		}
		return null;
	};

	/**
	 * The counselling centre line under the sender name (#895). Shown for
	 * messages a counsellor wrote — both to the advice seeker, who chose that
	 * agency by postcode during registration, and to the counsellor, whose own
	 * messages carry the same professional identity.
	 *
	 * Live Chat is cross-agency and registrationless, so `activeSession.agency`
	 * is simply absent until a counsellor picks the conversation up; the line
	 * then stays away rather than rendering an empty row.
	 */
	const agencyLine = useMemo(
		() => formatAgencyLineWithI18n(activeSession?.agency, translate),
		[activeSession?.agency, translate]
	);

	const getUsernameType = () => {
		if (isMyMessage) {
			return 'self';
		}
		if (displayName === 'system' || isSystemNotification) {
			return 'system';
		}
		if (isUserMessage()) {
			return 'user';
		}
		return 'consultant';
	};

	const isUserMessage = () =>
		userId === askerMatrixUserId ||
		(activeSession.isGroup &&
			!activeSession.item.moderators?.includes(userId));

	// WP-4 media check (epic ORISO-Admin#366): images from anonymous live-chat
	// guests render blurred until the counsellor reveals them (phase 1: the
	// human is the check); inline display is a per-chat-type tenant switch.
	const isLiveChatModality =
		getModality(activeSession) === Modality.LIVE_CHAT;
	const mediaChatType: MediaChatType = activeSession?.isGroup
		? 'group'
		: isLiveChatModality
			? 'anonymous'
			: 'oneOnOne';
	const getAttachmentMediaCheckState = (
		attachment: ChatAttachment
	): MediaCheckState => {
		const scannerState = attachment.mediaCheckState;
		if (scannerState === 'blocked') {
			return 'blocked';
		}
		return isLiveChatModality && !isMyMessage && isUserMessage()
			? 'unchecked'
			: 'safe';
	};
	const attachmentInlineDisplayEnabled = hasMediaInlineDisplayFeature(
		tenant?.settings,
		mediaChatType
	);

	const videoCallMessage: VideoCallMessageDTO = alias?.videoCallMessageDTO;
	/* ADR-018 retires the FURTHER_STEPS renderer together with the alias path
	   it keyed off: no Matrix code path produces an `alias` object, so this
	   branch never fired. `UPDATE_SESSION_DATA` shared the same renderer and is
	   still discarded below, where it always was. */
	const isUpdateSessionDataMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.UPDATE_SESSION_DATA;
	const isVideoCallMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.VIDEOCALL;
	const isUserMutedMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.USER_MUTED;
	const isE2EEActivatedMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.E2EE_ACTIVATED;
	const isReassignmentMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.REASSIGN_CONSULTANT;
	const isMasterKeyLostMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.MASTER_KEY_LOST;
	const isAppointmentDefined =
		alias?.messageType === ALIAS_MESSAGE_TYPES.INITIAL_APPOINTMENT_DEFINED;
	const isFullWidthMessage =
		isVideoCallMessage && !videoCallMessage?.eventType;
	const canDeleteMessage =
		Boolean(onDeleteDirect) &&
		activeSession?.item?.status !== STATUS_ARCHIVED &&
		Boolean(
			getSetting<IBooleanSetting>(SETTING_MESSAGE_ALLOWDELETING)?.value
		);
	const actionMenuItems = useMemo(
		() => [
			// Relations foundation (#435): only offer direct reply where a
			// handler is wired (main timeline; not the thread panel).
			...(onReplyDirect
				? [
						{
							key: 'reply-direct',
							label: translate('message.menu.replyDirect'),
							icon: <MenuReplyDirectIcon />
						}
					]
				: []),
			...(!embedded || onOpenThread
				? [
						{
							key: 'reply-thread',
							label: translate('message.menu.replyThread'),
							icon: <MenuReplyThreadIcon />
						}
					]
				: []),
			// Editing (m.replace, #435): own messages only, where a handler
			// is wired (main timeline; not the thread panel).
			...(onEditDirect
				? [
						{
							key: 'edit',
							label: translate('message.menu.edit'),
							icon: <MenuEditIcon />
						}
					]
				: []),
			// #1824: no handlers outside the conversation.
			...(embedded
				? []
				: [
						{
							key: 'mark-text',
							label: translate('message.menu.markText'),
							icon: <MenuMarkTextIcon />
						},
						{
							key: 'forward',
							label: translate('message.menu.forward'),
							icon: <MenuForwardIcon />
						}
					]),
			// Delete (#827): Matrix redact handler + allow-deleting + not archived.
			...(canDeleteMessage
				? [
						{
							key: 'delete',
							label: translate('message.menu.delete'),
							icon: <MenuDeleteIcon />
						}
					]
				: [])
		],
		[
			translate,
			onReplyDirect,
			onEditDirect,
			canDeleteMessage,
			embedded,
			onOpenThread
		]
	);

	// #1824: a row without menu entries (e.g. a supervisor in the Timeline
	// preview, who may only react) shows no menu button and no long-press.
	const hasMenuActions = !readOnly && actionMenuItems.length > 0;

	const handleActionMenuItemClick = useCallback(
		(actionKey: string) => {
			closeMessageMenus();
			if (actionKey === 'reply-thread' && onOpenThread) {
				onOpenThread();
			}
			// Relations foundation (#435): direct reply finally has a handler.
			if (actionKey === 'reply-direct' && onReplyDirect) {
				onReplyDirect();
			}
			if (actionKey === 'edit' && onEditDirect) {
				onEditDirect();
			}
			if (actionKey === 'delete' && onDeleteDirect) {
				setDeleteOverlay(true);
			}
		},
		[
			onOpenThread,
			onReplyDirect,
			onEditDirect,
			onDeleteDirect,
			closeMessageMenus
		]
	);

	const confirmDeleteMessage = useCallback(() => {
		if (!onDeleteDirect || isDeleteRequestInProgress) {
			return;
		}
		setIsDeleteRequestInProgress(true);
		try {
			onDeleteDirect();
			setDeleteOverlay(false);
		} finally {
			setIsDeleteRequestInProgress(false);
		}
	}, [onDeleteDirect, isDeleteRequestInProgress]);

	const deleteOverlayItem: OverlayItem = useMemo(
		() => ({
			headline: translate('message.delete.overlay.headline'),
			copy: translate('message.delete.overlay.copy'),
			svg: XIllustration,
			illustrationBackground: 'neutral',
			buttonSet: [
				{
					label: translate('message.delete.overlay.cancel'),
					function: OVERLAY_FUNCTIONS.CLOSE,
					type: BUTTON_TYPES.SECONDARY,
					disabled: isDeleteRequestInProgress
				},
				{
					label: translate('message.delete.overlay.confirm'),
					function: 'CONFIRM',
					type: BUTTON_TYPES.PRIMARY,
					disabled: isDeleteRequestInProgress
				}
			],
			handleOverlay: (functionName) => {
				if (functionName === 'CONFIRM') {
					confirmDeleteMessage();
					return;
				}
				setDeleteOverlay(false);
			}
		}),
		[confirmDeleteMessage, isDeleteRequestInProgress, translate]
	);

	/**
	 * Opens the menu against a fixed point — the long-press position. floating-ui
	 * takes a virtual element, so the same positioning path serves both the
	 * point and the button anchor below.
	 */
	const openActionMenuAt = useCallback((clientX: number, clientY: number) => {
		setIsVisibilityMenuOpen(false);
		setVisibilityMenuPosition(null);
		setVisibilityMenuAnchor(null);
		setActionMenuPlacement('right-start');
		setActionMenuAnchor({
			getBoundingClientRect: () =>
				({
					width: 0,
					height: 0,
					x: clientX,
					y: clientY,
					top: clientY,
					left: clientX,
					right: clientX,
					bottom: clientY
				}) as DOMRect
		});
		setIsActionMenuOpen(true);
	}, []);

	const toggleActionMenu = useCallback(
		(
			event: React.MouseEvent<HTMLButtonElement>,
			side: 'left' | 'right'
		) => {
			event.preventDefault();
			event.stopPropagation();
			// The trigger keeps focus, so reset without the closer's focus move.
			resetMessageMenus();
			if (isActionMenuOpen) {
				setActionMenuAnchor(null);
				return;
			}
			setVisibilityMenuAnchor(null);
			// The kebab sits outside the bubble, so the menu opens away from it:
			// to the right on the incoming side, to the left on the outgoing one.
			setActionMenuPlacement(
				side === 'left' ? 'right-start' : 'left-start'
			);
			setActionMenuAnchor(event.currentTarget);
			setIsActionMenuOpen(true);
		},
		[isActionMenuOpen, resetMessageMenus]
	);

	// Keeps the action menu on its anchor across scroll, resize and any change
	// in menu height — replacing a one-shot calculation that assumed a fixed
	// 300px menu and never ran again.
	useEffect(() => {
		const menuEl = actionMenuRef.current;
		if (!isActionMenuOpen || !actionMenuAnchor || !menuEl) {
			return undefined;
		}
		return autoUpdate(actionMenuAnchor, menuEl, () => {
			computePosition(actionMenuAnchor, menuEl, {
				strategy: 'fixed',
				placement: actionMenuPlacement,
				middleware: [offset(10), flip(), shift({ padding: 12 })]
			}).then(({ x, y, placement }) => {
				setActionMenuPosition({ left: x, top: y });
				setActionMenuOrigin(
					placement.startsWith('left') ? 'right top' : 'left top'
				);
			});
		});
	}, [isActionMenuOpen, actionMenuAnchor, actionMenuPlacement]);

	useEffect(() => {
		const menuEl = visibilityMenuRef.current;
		if (!isVisibilityMenuOpen || !visibilityMenuAnchor || !menuEl) {
			return undefined;
		}
		return autoUpdate(visibilityMenuAnchor, menuEl, () => {
			computePosition(visibilityMenuAnchor, menuEl, {
				strategy: 'fixed',
				placement: visibilityMenuPlacement,
				middleware: [offset(6), flip(), shift({ padding: 12 })]
			}).then(({ x, y, placement }) => {
				setVisibilityMenuPosition({ left: x, top: y });
				setVisibilityMenuOrigin(
					placement.startsWith('left') ? 'right top' : 'left top'
				);
			});
		});
	}, [isVisibilityMenuOpen, visibilityMenuAnchor, visibilityMenuPlacement]);

	// Slack-style long-press on the message bubble opens the action menu at
	// the press position (touch and mouse alike).
	const cancelLongPress = useCallback(() => {
		if (longPressTimerRef.current !== null) {
			window.clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
		longPressStartRef.current = null;
	}, []);

	const handleBubblePointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (
				isActionMenuOpen ||
				alias?.messageType ||
				isSystemNotification
			) {
				return;
			}
			const { clientX, clientY } = event;
			longPressFiredRef.current = false;
			longPressStartRef.current = { x: clientX, y: clientY };
			if (longPressTimerRef.current !== null) {
				window.clearTimeout(longPressTimerRef.current);
			}
			longPressTimerRef.current = window.setTimeout(() => {
				longPressTimerRef.current = null;
				longPressStartRef.current = null;
				longPressFiredRef.current = true;
				openActionMenuAt(clientX, clientY);
			}, LONG_PRESS_MS);
		},
		[
			isActionMenuOpen,
			alias?.messageType,
			isSystemNotification,
			openActionMenuAt
		]
	);

	const handleBubblePointerMove = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			const start = longPressStartRef.current;
			if (!start) {
				return;
			}
			if (
				Math.abs(event.clientX - start.x) >
					LONG_PRESS_MOVE_TOLERANCE_PX ||
				Math.abs(event.clientY - start.y) > LONG_PRESS_MOVE_TOLERANCE_PX
			) {
				cancelLongPress();
			}
		},
		[cancelLongPress]
	);

	const handleBubbleContextMenu = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			// Long-press on touch devices fires contextmenu; swallow it once
			// the menu has been opened via the long-press timer.
			if (longPressFiredRef.current || isActionMenuOpen) {
				event.preventDefault();
			}
		},
		[isActionMenuOpen]
	);

	const toggleVisibilityMenu = useCallback(
		(
			event: React.MouseEvent<HTMLButtonElement>,
			side: 'left' | 'right'
		) => {
			event.preventDefault();
			event.stopPropagation();
			resetMessageMenus();
			if (isVisibilityMenuOpen) {
				setVisibilityMenuAnchor(null);
				return;
			}
			setActionMenuAnchor(null);
			// Open beside the chip, then flip if the viewport edge requires it.
			setVisibilityMenuPlacement(
				side === 'left' ? 'right-start' : 'left-start'
			);
			setVisibilityMenuAnchor(event.currentTarget);
			setIsVisibilityMenuOpen(true);
		},
		[isVisibilityMenuOpen, resetMessageMenus]
	);
	const toggleVisibilitySection = useCallback(
		(section: 'clients' | 'counsellors' | 'moderators') => {
			setExpandedVisibilitySections((previous) => ({
				...previous,
				[section]: !previous[section]
			}));
		},
		[]
	);

	// WORKAROUND for reassignment last message bug
	// don't show this message in the session view
	if (
		alias?.messageType ===
		ALIAS_MESSAGE_TYPES.REASSIGN_CONSULTANT_RESET_LAST_MESSAGE
	) {
		return null;
	}

	const isMySession = activeSession?.consultant?.id === userData?.userId;
	const isAppointmentSet =
		alias?.messageType === ALIAS_MESSAGE_TYPES.APPOINTMENT_SET ||
		alias?.messageType === ALIAS_MESSAGE_TYPES.APPOINTMENT_RESCHEDULED ||
		alias?.messageType === ALIAS_MESSAGE_TYPES.APPOINTMENT_CANCELLED;
	const isDeleteMessage = t === 'rm';
	const isRoomRemovedReadOnly = t === 'room-removed-read-only';
	const isRoomSetReadOnly = t === 'room-set-read-only';
	const showVisibleAudience =
		visibleAudienceSummaryLabels.length > 0 &&
		// A restriction chip must only appear when the message is actually
		// restricted. Without this guard a normal group message renders
		// "visible only to: Alle", which says the opposite of what it means.
		!isAllAudienceSelected &&
		!isDeleteMessage &&
		!isSystemNotification &&
		!alias?.messageType;
	/**
	 * Who counts as an advice seeker reading this thread (#1486).
	 *
	 * `ASKER_DEFAULT` alone missed the anonymous Live Chat guest, who is
	 * granted `ANONYMOUS_DEFAULT` instead — so the asker-facing name
	 * resolution never ran for them and the bubble fell through to the
	 * counsellor's legal name from the consultant list. This is the same test
	 * `SessionHeaderComponent` already applies, so the bubble and the chat
	 * header now agree on who is reading.
	 */
	const isAskerViewer =
		hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) ||
		hasUserAuthority(AUTHORITIES.ANONYMOUS_DEFAULT, userData) ||
		(userData?.userRoles || []).includes('USER') ||
		(userData?.userRoles || []).includes('ANONYMOUS');
	const resolvedIncomingAvatarChoice = activeSession?.isGroup
		? memberAvatarChoice(userId, avatarMembers)
		: activeSession
			? directAvatarChoice(userId, activeSession)
			: null;
	// A counsellor always sits on the tenant's primary pair, picked or not.
	const incomingAvatarChoice = isUserMessage()
		? resolvedIncomingAvatarChoice
		: counsellorChoiceOf(resolvedIncomingAvatarChoice);
	const askerIncomingConsultantName =
		!isMyMessage && isAskerViewer
			? resolveIncomingConsultantNameForAsker({
					sessionConsultantDisplayName:
						activeSession?.consultant?.displayName,
					matrixDisplayName: roomUser?.displayName,
					eventDisplayName: displayName,
					username
				})
			: null;
	/**
	 * An incoming message is published under a display name or, failing that,
	 * the User-ID — never a real name (#1486).
	 *
	 * The bubble used to hand `consultantMatch.firstName`/`lastName` from the
	 * consultant list to `formatMessagePersonName`, which preferred them, so a
	 * counsellor's legal name appeared above their bubble and overrode the
	 * identity they publish. Display name + User-ID are the only two sources
	 * the bubble, the chat header and the session list have in common, so the
	 * bubble now uses exactly those and passes no name parts at all.
	 */
	// #1839: a live-chat guest's own messages carry the pseudonym the list and
	// the header show, not their encoded Matrix name.
	const liveChatGuestName =
		!isMyMessage &&
		isLiveChatModality &&
		!!askerMatrixUserId &&
		userId === askerMatrixUserId
			? resolveAnonymousChatDisplayName(activeSession?.user)
			: null;
	const resolvedIncomingDisplayName = askerIncomingConsultantName
		? askerIncomingConsultantName.displayName
		: !isMyMessage
			? consultantMatch?.consultantDisplayName ||
				liveChatGuestName ||
				roomUser?.displayName ||
				displayName
			: displayName;
	const ownConsultantName =
		isMyMessage && !isUserMessage()
			? resolveOwnConsultantName({
					displayName: userData?.displayName,
					firstName: userData?.firstName,
					lastName: userData?.lastName,
					username: userData?.userName || username
				})
			: null;
	const formattedName = formatMessagePersonName(
		ownConsultantName?.displayName ?? resolvedIncomingDisplayName,
		username,
		// Own messages may still fall back to the viewer's own name — it is
		// their own screen. Incoming messages never carry one (#1486).
		ownConsultantName
			? ownConsultantName.firstName
			: isMyMessage
				? userData?.firstName
				: undefined,
		ownConsultantName
			? ownConsultantName.lastName
			: isMyMessage
				? userData?.lastName
				: undefined
	);
	/**
	 * Own counsellor messages render outside MessageDisplayName (that
	 * header is gated by !isMyMessage), so the agency line has to be
	 * supplied here. Advice-seeker own messages stay one-line.
	 * See OpenResilienceInitiative/ORISO-Frontend#895 / PR #949.
	 */
	const profileSubtitle = isMyMessage && !isUserMessage() ? agencyLine : '';
	const isRejectedCallInGroupChat =
		alias?.messageType === ALIAS_MESSAGE_TYPES.VIDEOCALL &&
		videoCallMessage?.eventType === 'IGNORED_CALL' &&
		activeSession?.isGroup;

	// Delivery status per Figma (node 7086-57415): the bubble time rail carries
	// one of three states for own messages —
	//   • Send Success    → single grey check (reached the server, not yet read)
	//   • Recipient Read   → double red check ("gelesen")
	//   • Encryption broke → red cross (the message never reached the server, or
	//     end-to-end encryption failed for the recipient).
	// `sendFailed` and `encryptionBroke` both resolve to the cross: to the user
	// they mean the same thing — "this did not get delivered, resend it".
	const deliveryState: 'failed' | 'read' | 'sent' =
		sendFailed || encryptionBroke ? 'failed' : isNotRead ? 'sent' : 'read';
	const deliveryStatusLabel =
		deliveryState === 'failed'
			? encryptionBroke
				? translate('message.encryptionBroke.status')
				: translate('message.sendFailed.status')
			: translate(
					deliveryState === 'sent' ? 'message.sent' : 'message.read'
				);
	// The delivery cross for a broken decryption belongs on the affected
	// message whether or not it is ours: you can always decrypt your own
	// sends, so `encryptionBroke` in practice flags an INCOMING message the
	// recipient's client could not decrypt. Own-message sent/read status stays
	// own-only as before.
	const deliveryStatusInBubble =
		t !== 'rm' && (isMyMessage || encryptionBroke) ? (
			<span
				className={clsx(
					'messageItem__deliveryStatus',
					`messageItem__deliveryStatus--${deliveryState}`
				)}
				role="img"
				aria-label={deliveryStatusLabel}
				title={deliveryStatusLabel}
			>
				{deliveryState === 'failed' ? (
					<DeliveryFailedIcon aria-hidden focusable="false" />
				) : deliveryState === 'sent' ? (
					<DeliverySentIcon aria-hidden focusable="false" />
				) : (
					<DeliveryReadIcon aria-hidden focusable="false" />
				)}
			</span>
		) : null;

	const messageTimeInBubble = messageTime ? (
		<span
			className={clsx(
				'messageItem__messageTime',
				isMyMessage && 'messageItem__messageTime--outgoing'
			)}
		>
			{formatToHHMM(messageTime)}
			{deliveryStatusInBubble}
			{/* Editing (m.replace, #435): marker next to the bubble timestamp. */}
			{isEdited && (
				<span
					className="messageItem__editedMarker"
					title={translate('message.edit.markerTitle')}
				>
					{translate('message.edit.marker')}
				</span>
			)}
		</span>
	) : null;

	const threadEntryClassName = clsx(
		'messageItem__threadButton',
		isMyMessage && 'messageItem__threadButton--right'
	);
	const threadEntryContent = threadSummary ? (
		<>
			<ThreadEntryIcon
				className="messageItem__threadButtonIcon"
				aria-hidden="true"
			/>
			<span className="messageItem__threadButtonMain">
				{translate('message.thread.replies', {
					count: threadSummary.replyCount
				})}
			</span>
			{threadSummary.lastReplyText && (
				<span
					className="messageItem__threadButtonMeta"
					data-cy="thread-entry-preview"
				>
					{threadSummary.lastReplyText}
				</span>
			)}
		</>
	) : null;

	// Reactions (Figma 336-12244 / 336-12225): white chips inside the bubble,
	// sharing one rail with the timestamp. Adding happens via the action menu.
	const reactionChips =
		reactions && reactions.length > 0 ? (
			<div
				className={clsx(
					'messageItem__reactions',
					isMyMessage && 'messageItem__reactions--right'
				)}
			>
				{reactions.map((reaction) => {
					const pillClassName = clsx(
						'messageItem__reactionPill',
						reaction.ownEventId && 'messageItem__reactionPill--mine'
					);
					const pillLabel = translate('message.reaction.count', {
						key: reaction.key,
						count: reaction.count
					});
					const pillContent = (
						<>
							<span aria-hidden>{reaction.key}</span>
							<span className="messageItem__reactionPillCount">
								{reaction.count}
							</span>
						</>
					);
					return readOnly ? (
						<span
							key={reaction.key}
							className={pillClassName}
							role="img"
							aria-label={pillLabel}
						>
							{pillContent}
						</span>
					) : (
						<button
							key={reaction.key}
							type="button"
							className={pillClassName}
							onClick={() =>
								reaction.ownEventId
									? onUnreact?.(reaction.ownEventId)
									: onReact?.(reaction.key)
							}
							aria-label={pillLabel}
						>
							{pillContent}
						</button>
					);
				})}
			</div>
		) : null;

	// Desktop conditional width (Figma note): bubbles stay at 460px; texts
	// that would exceed ~4 lines at that width widen to 770px. Applied via
	// CSS only from the large breakpoint up. Measure the RENDERED text (like
	// the MESSAGE_CHAR_LIMIT truncation does) so markdown/HTML syntax does
	// not inflate the count; fall back to the raw source until rendered.
	const isWideMessage =
		(renderedMessage ?? message ?? '').replace(/<[^>]+>/g, '').length > 220;

	// "Time + Emoji Rail" (Figma): incoming = chips left / time right,
	// outgoing = time left / chips right.
	const timeRailInBubble = (
		<div
			className={clsx(
				'messageItem__timeRail',
				isMyMessage && 'messageItem__timeRail--outgoing'
			)}
		>
			{!isMyMessage && reactionChips}
			{messageTimeInBubble}
			{isMyMessage && reactionChips}
		</div>
	);

	const MessageBubble = isSystemNotification ? CarimatMessageBubble : 'div';

	const assistantBubbleProps: React.ComponentProps<
		typeof CarimatMessageBubble
	> = isSystemNotification
		? {
				variant: 'notice',
				topic: isCaseHandoverGrantedEvent
					? translate(
							persistedHandoverGrant?.accessType === 'CO_ACCESS'
								? 'caseHandover.consent.info.noticeTitle'
								: 'caseHandover.systemMessage.tookOverTitle'
						)
					: isInquiryAcceptedEvent
						? translate('caseHandover.accepted.title')
						: systemNotificationTitle,
				topicIcon: isCaseHandoverGrantedEvent ? (
					<HandoverTopicIcon />
				) : isInquiryAcceptedEvent ? (
					<AcceptanceTopicIcon />
				) : undefined
			}
		: {};

	const messageContent = (): React.ReactElement => {
		switch (true) {
			case isMasterKeyLostMessage:
				return (
					<MasterKeyLostMessage
						subscriptionKeyLost={e2eeParams.subscriptionKeyLost}
					/>
				);
			case isE2EEActivatedMessage:
				return <E2EEActivatedMessage />;
			case isReassignmentMessage:
				// `decryptedMessage` is the plaintext in E2EE and plain rooms alike.
				return (
					<HistoricalReassignMessage
						message={decryptedMessage || ''}
						// Includes anonymous guests: no legal-name lookup (#1486).
						isAsker={isAskerViewer}
						isMySession={isMySession}
					/>
				);
			case isAppointmentSet:
				return (
					<Appointment
						data={alias.content}
						messageType={alias.messageType}
					/>
				);
			case isVideoCallMessage && !videoCallMessage?.eventType:
				const parsedMessage = JSON.parse(
					alias.content
				) as VideoChatDetailsAlias;
				return (
					<VideoChatDetails
						data={parsedMessage}
						isVideoActive={isVideoActive}
					/>
				);
			case isVideoCallMessage &&
				videoCallMessage?.eventType === 'IGNORED_CALL':
				return (
					<VideoCallMessage
						videoCallMessage={videoCallMessage}
						activeSessionUsername={
							activeSession.user?.username ||
							activeSession.consultant?.displayName ||
							activeSession.consultant?.username
						}
						activeSessionAskerRcId={
							activeSession.item.askerMatrixUserId
						}
					/>
				);
			case isDeleteMessage:
				return (
					<div className="messageItem__message messageItem__message--deleted">
						<div className="flex flex--ai-c">
							<div className="mr--1">
								<DeletedIcon
									width={14}
									height={14}
									aria-hidden="true"
									focusable="false"
								/>
							</div>
							<div>
								{translate(
									isMyMessage
										? 'message.delete.deleted.own'
										: 'message.delete.deleted.other'
								)}
							</div>
						</div>
						{timeRailInBubble}
					</div>
				);
			default:
				return (
					<>
						{!isMyMessage && (
							<div className="messageItem__header">
								{isSystemNotification ? (
									<CarimatHeader
										subtitle={
											isCaseHandoverGrantedEvent
												? translate(
														'caseHandover.systemMessage.noActionNeeded'
													)
												: translate(
														'message.systemNotification'
													)
										}
									/>
								) : (
									<MessageDisplayName
										isMyMessage={isMyMessage}
										isUser={isUserMessage()}
										type={getUsernameType()}
										subtitle={
											getUsernameType() ===
												'consultant' ||
											(getUsernameType() === 'self' &&
												!isUserMessage())
												? agencyLine
												: ''
										}
										userId={userId}
										username={username}
										displayName={
											resolvedIncomingDisplayName
										}
									/>
								)}
							</div>
						)}

						{showVisibleAudience && isMyMessage && (
							<div className="messageItem__visibleOnly">
								<span className="messageItem__visibleOnlyLabel">
									{translate('message.visibleOnlyTo')}
								</span>
								{visibleAudienceSummaryLabels.map(
									(label, index) => (
										<span
											key={`visible-to-right-${index}-${label}`}
											className="messageItem__visibleOnlyChip"
										>
											<span
												className="messageItem__visibleOnlyChipIcon"
												aria-hidden
											>
												{getAudienceRoleFromLabel(
													label
												) === 'moderators' ? (
													<VisibilityModeratorIcon />
												) : getAudienceRoleFromLabel(
														label
												  ) === 'counsellors' ? (
													<VisibilityCounsellorIcon />
												) : (
													<VisibilityClientIcon />
												)}
											</span>
											{label}
										</span>
									)
								)}
							</div>
						)}
						<MessageBubble
							{...assistantBubbleProps}
							className={`${
								isMyMessage
									? 'messageItem__message messageItem__message--myMessage'
									: 'messageItem__message'
							} ${isSystemNotification ? 'messageItem__message--systemNotification' : ''} ${isWideMessage ? 'messageItem__message--wide' : ''}`}
							{...(!hasMenuActions
								? {}
								: {
										onPointerDown: handleBubblePointerDown,
										onPointerMove: handleBubblePointerMove,
										onPointerUp: cancelLongPress,
										onPointerLeave: cancelLongPress,
										onPointerCancel: cancelLongPress,
										onContextMenu: handleBubbleContextMenu
									})}
						>
							{isSystemNotification &&
								(isCaseHandoverGrantedEvent ||
									isInquiryAcceptedEvent) && (
									<CaseHandoverSystemMessageBody
										{...visibleCaseHandoverInternalDetails}
									>
										{isAcceptedNoticeForAsker ? (
											<CaseHandoverInformationalBody
												mode="OPT_IN"
												conversationType={
													erstantwortModality
												}
												key={`${activeSession.item.id}:${tenant?.id}:${userData?.userId}`}
												description={
													acceptedDescription
												}
												sessionId={
													activeSession.item.id
												}
												readOnly={blocksLeavingActions}
												onSetupNotifications={
													!blocksLeavingActions &&
													(grantNotificationPolicy.emailAllowed ||
														grantNotificationPolicy.browserAllowed)
														? () =>
																setShowGrantNotifications(
																	true
																)
														: undefined
												}
											/>
										) : isPersistedGrantForAsker ? (
											<CaseHandoverInformationalBody
												mode={
													persistedHandoverGrant.clientConsent
												}
												conversationType={
													erstantwortModality
												}
												key={`${activeSession.item.id}:${tenant?.id}:${userData?.userId}`}
												description={
													systemNotificationRawDescription
												}
												sessionId={
													activeSession.item.id
												}
												readOnly={blocksLeavingActions}
												onSetupNotifications={
													!blocksLeavingActions &&
													(grantNotificationPolicy.emailAllowed ||
														grantNotificationPolicy.browserAllowed)
														? () =>
																setShowGrantNotifications(
																	true
																)
														: undefined
												}
											/>
										) : (
											systemNotificationRawDescription && (
												<p className="messageItem__systemNotificationDescription">
													{
														systemNotificationRawDescription
													}
												</p>
											)
										)}
									</CaseHandoverSystemMessageBody>
								)}
							{/*
							 * The bubble carries the body only. Title and the
							 * "Systembenachrichtigung" qualifier live in the header,
							 * matching the shipped `MessageSendFailed` pattern and
							 * Figma App.Oriso 8607-28488. Previously all three sat
							 * here — a chip, a headline and a description — so one
							 * notice wore three labels. See ORISO-Frontend#892.
							 */}
							{isSystemNotification &&
								!isCaseHandoverGrantedEvent &&
								!isInquiryAcceptedEvent &&
								systemNotificationDescription && (
									<div className="messageItem__systemNotificationDescription">
										{systemNotificationDescription}
									</div>
								)}
							{isSupervisorFeedback && (
								<div className="messageItem__feedbackTag">
									{translate('message.feedbackTag')}
								</div>
							)}
							{/* Relations foundation (#435): quote of the replied-to
							    message, rendered from the m.in_reply_to relation. */}
							{replyToEventId && !isSystemNotification && (
								<div
									className={`messageItem__replyQuote ${
										isMyMessage
											? 'messageItem__replyQuote--myMessage'
											: ''
									}`}
									aria-label={translate(
										'message.reply.quoteLabel'
									)}
								>
									<span className="messageItem__replyQuoteAuthor">
										{replyQuote?.author ||
											translate(
												'message.reply.quoteUnknown'
											)}
									</span>
									{replyQuote?.text && (
										<span className="messageItem__replyQuoteText">
											{replyQuote.text}
										</span>
									)}
								</div>
							)}
							{!isSystemNotification &&
								renderedMessageWithoutPrefix &&
								!attachments &&
								(() => {
									// Check if message is long (strip HTML tags for accurate length)
									const textContent =
										renderedMessageWithoutPrefix.replace(
											/<[^>]*>/g,
											''
										);
									const isLongMessage =
										!showFullContent &&
										textContent.length > MESSAGE_CHAR_LIMIT;

									// Helper function to safely truncate HTML while preserving structure
									const truncateHtml = (
										html: string,
										maxLength: number
									): string => {
										// Check if we're in a browser environment
										if (typeof document === 'undefined') {
											// Fallback for SSR: simple truncation (may break HTML tags)
											const textContent = html.replace(
												/<[^>]*>/g,
												''
											);
											if (textContent.length <= maxLength)
												return html;
											const truncatedText =
												textContent.substring(
													0,
													maxLength
												);
											const lastSpace =
												truncatedText.lastIndexOf(' ');
											const cutPoint =
												lastSpace > maxLength * 0.8
													? lastSpace
													: maxLength;
											return (
												html.substring(
													0,
													Math.min(
														cutPoint,
														html.length
													)
												) + '...'
											);
										}

										// Create a temporary DOM element to parse HTML
										const tempDiv =
											document.createElement('div');
										tempDiv.innerHTML = html;

										// Get text content and find truncation point
										const text =
											tempDiv.textContent ||
											tempDiv.innerText ||
											'';
										if (text.length <= maxLength)
											return html;

										// Find a good word boundary
										let truncateAt = maxLength;
										const truncatedText = text.substring(
											0,
											maxLength
										);
										const lastSpace =
											truncatedText.lastIndexOf(' ');
										if (
											lastSpace > maxLength * 0.8 &&
											lastSpace > 0
										) {
											truncateAt = lastSpace;
										}

										// Walk through nodes and truncate at the right point
										let currentLength = 0;
										const walker =
											document.createTreeWalker(
												tempDiv,
												NodeFilter.SHOW_TEXT,
												null
											);

										let node;
										let targetNode = null;
										let targetRemaining = 0;

										while ((node = walker.nextNode())) {
											const nodeLength =
												node.textContent?.length || 0;
											if (
												currentLength + nodeLength >=
												truncateAt
											) {
												targetNode = node;
												targetRemaining =
													truncateAt - currentLength;
												break;
											}
											currentLength += nodeLength;
										}

										if (
											targetNode &&
											targetNode.textContent
										) {
											// Truncate the target node
											targetNode.textContent =
												targetNode.textContent.substring(
													0,
													targetRemaining
												) + '...';

											// Remove all following siblings of the target node's parent
											let parent = targetNode.parentNode;
											if (parent) {
												let sibling =
													targetNode.nextSibling;
												while (sibling) {
													const next =
														sibling.nextSibling;
													parent.removeChild(sibling);
													sibling = next;
												}
											}

											// Also remove any remaining text nodes via walker
											let nextNode;
											while (
												(nextNode = walker.nextNode())
											) {
												if (nextNode.parentNode) {
													nextNode.parentNode.removeChild(
														nextNode
													);
												}
											}
										}

										const result = tempDiv.innerHTML;
										// Verify truncation worked - if result is still too long, use simple fallback
										const resultText = result.replace(
											/<[^>]*>/g,
											''
										);
										if (
											resultText.length >
											maxLength + 50
										) {
											// Fallback: simple truncation
											const simpleTruncated =
												text.substring(0, truncateAt) +
												'...';
											return simpleTruncated;
										}

										return result;
									};

									// Truncate message if not expanded
									const displayMessage =
										isLongMessage && !isExpanded
											? truncateHtml(
													renderedMessageWithoutPrefix,
													MESSAGE_CHAR_LIMIT
												)
											: renderedMessageWithoutPrefix;

									return (
										<>
											<span
												dangerouslySetInnerHTML={{
													__html: displayMessage
												}}
											/>
											{isLongMessage && (
												<button
													className={`messageItem__expandBtn ${isMyMessage ? 'messageItem__expandBtn--myMessage' : 'messageItem__expandBtn--incoming'}`}
													onClick={(e) => {
														e.preventDefault();
														e.stopPropagation();
														setIsExpanded(
															!isExpanded
														);
													}}
													type="button"
												>
													{isExpanded
														? translate(
																'message.showLess'
															)
														: translate(
																'message.showMore'
															)}
												</button>
											)}
										</>
									);
								})()}
							{attachments &&
								attachments.map((attachment, key) => (
									<MessageAttachment
										key={key}
										attachment={attachment}
										rid={rid}
										file={file}
										t={t}
										hasRenderedMessage={hasRenderedMessage}
										mediaCheckState={getAttachmentMediaCheckState(
											attachment
										)}
										inlineDisplayEnabled={
											attachmentInlineDisplayEnabled
										}
									/>
								))}
							{/*
							 * Figma App.Oriso 8498-32373 shows the time rail on system
							 * notices too — they are messages, so they carry a timestamp
							 * like every other bubble in the stream.
							 */}
							{timeRailInBubble}
						</MessageBubble>
						{showVisibleAudience && !isMyMessage && (
							<div className="messageItem__visibleOnly">
								<span className="messageItem__visibleOnlyLabel">
									{translate('message.visibleOnlyTo')}
								</span>
								{visibleAudienceSummaryLabels.map(
									(label, index) => (
										<span
											key={`visible-to-left-${index}-${label}`}
											className="messageItem__visibleOnlyChip"
										>
											<span
												className="messageItem__visibleOnlyChipIcon"
												aria-hidden
											>
												{getAudienceRoleFromLabel(
													label
												) === 'moderators' ? (
													<VisibilityModeratorIcon />
												) : getAudienceRoleFromLabel(
														label
												  ) === 'counsellors' ? (
													<VisibilityCounsellorIcon />
												) : (
													<VisibilityClientIcon />
												)}
											</span>
											{label}
										</span>
									)
								)}
							</div>
						)}
					</>
				);
		}
	};

	if (
		isUserMutedMessage ||
		isAppointmentDefined ||
		isRoomRemovedReadOnly ||
		isRoomSetReadOnly
	)
		return null;

	if (isUpdateSessionDataMessage || isRejectedCallInGroupChat) {
		return null;
	}

	// Frontend-only recipient visibility: targeted messages are visible only to
	// selected recipients and the sender.
	if (parsedMessage.visibleToUserIds.length > 0 && !isMyMessage) {
		const canCurrentUserSeeMessage = parsedMessage.visibleToUserIds.some(
			(recipient) => {
				const recipientIds = getComparableRecipientIds(recipient);
				for (const id of recipientIds) {
					if (currentRecipientIdentifiers.has(id)) {
						return true;
					}
				}
				return false;
			}
		);
		if (!canCurrentUserSeeMessage) {
			return null;
		}
	}

	// MSC3440 (#435) / ADR-017 hard cut: thread membership comes ONLY from the
	// m.thread relation. Legacy [THREAD:...] prefix messages carry no thread
	// semantics anymore and render flat.
	const effectiveThreadRootId = threadRootEventId || null;
	const isThreadReply = Boolean(effectiveThreadRootId);
	if (!forceShow) {
		if (renderMode === 'main' && threadsEnabled && isThreadReply) {
			return null;
		}
		if (renderMode === 'thread') {
			if (!threadsEnabled) {
				return null;
			}
			if (!isThreadReply) {
				return null;
			}
			if (threadRootId && effectiveThreadRootId !== threadRootId) {
				return null;
			}
		}
	}

	if (
		hideSystemMessages &&
		(isSystemNotification || Boolean(alias?.messageType))
	) {
		return null;
	}

	if (callLifecycle && callLifecycle.roomRef === rid) {
		return (
			<div className="messageItem">
				{getMessageDate()}
				<CallTimelineMessage
					call={callLifecycle}
					loadState={apiCallState}
					onJoin={
						blocksLeavingActions ||
						isUserBanned ||
						activeSession?.item?.status === STATUS_ARCHIVED
							? undefined
							: () =>
									callManager.joinExistingCall(
										callLifecycle,
										/*
										 * The card's own answer first.
										 *
										 * `activeSession.isGroup` describes
										 * the CLIENT session, which is false
										 * for a supervision call inside a 1:1
										 * one — and a call rejoined as
										 * non-group is ended for everybody
										 * when one person leaves, because
										 * `endCall` publishes a remote hangup
										 * and finalises the lifecycle. The
										 * side that started the call wrote
										 * what it is; cards from before that
										 * field existed fall back to the old
										 * guess.
										 */
										callLifecycle.isGroup ??
											Boolean(activeSession?.isGroup)
									)
					}
				/>
			</div>
		);
	}

	/* ADR-018: the Erstantwort is one persisted [SYSTEM_NOTIFICATION] event
	   carrying a versioned Baustein payload, not a message body. It returns
	   early — before the generic system-notification chrome — because it renders
	   as its own staged Carimat sequence, and the surrounding message frame
	   (avatar, meta line, reactions, delivery ticks) would duplicate what the
	   sequence already draws. */
	if (erstantwortRenderMode === 'sequence') {
		return (
			<div
				className="messageItem messageItem--erstantwort"
				data-message-id={_id}
			>
				{getMessageDate()}
				<ErstantwortMessage
					readOnly={blocksLeavingActions}
					rawMessage={decryptedMessage}
					messageId={_id}
					conversationType={erstantwortModality}
					isAskerEmailEnabled={
						tenant?.settings?.featureAskerEmailEnabled
					}
					skipAnimation={!isRecentErstantwortEvent}
				/>
			</div>
		);
	}

	if (erstantwortRenderMode === 'unavailable') {
		return (
			<div
				className="messageItem messageItem--chatEvent messageItem--erstantwortUnavailable"
				data-message-id={_id}
			>
				{getMessageDate()}
				<div
					className="messageItem__chatEvent"
					data-testid="erstantwort-unavailable"
				>
					{translate('erstantwort.unavailableInRoom')}
				</div>
			</div>
		);
	}

	if (isSupervisionNoticeEvent) {
		return (
			<div
				className="messageItem messageItem--erstantwort messageItem--supervisionNotice"
				data-message-id={_id}
			>
				{getMessageDate()}
				<ErstantwortSequence
					name={systemNotificationTitle}
					subtitle={translate('message.systemNotification')}
					bausteine={[
						{
							id: 'supervision-notice',
							body: systemNotificationDescription
						}
					]}
					skipAnimation
				/>
			</div>
		);
	}

	if (isUserLeftChatEvent) {
		return (
			<div className="messageItem messageItem--chatEvent">
				{getMessageDate()}
				<div className="messageItem__chatEvent">
					{userLeftChatEventText}
				</div>
			</div>
		);
	}

	/* #1253: while the body is still unknown, draw nothing at all rather than a
	   convincing bubble with a timestamp and read receipts around an empty
	   middle. A message that carries an attachment or is a system notification
	   has content of its own and is unaffected. */
	if (!isBodyResolved && !isSystemNotification && !attachments) {
		return null;
	}

	const withGrantNotifications = (message: React.ReactNode) => (
		<>
			{isSystemNotification ? (
				<CarimatMessageContainer className="carimatPersistedEvent">
					{message}
				</CarimatMessageContainer>
			) : (
				message
			)}
			{showGrantNotifications &&
				(grantNotificationPolicy.emailAllowed ||
					grantNotificationPolicy.browserAllowed) && (
					<NotificationSetupMessage
						startOpen
						subtitle={translate('profile.notifications.title')}
						isEmailEnabled={grantNotificationPolicy.emailAllowed}
						isBrowserEnabled={
							grantNotificationPolicy.browserAllowed
						}
					/>
				)}
		</>
	);

	return withGrantNotifications(
		<div
			// Anchor for `?at=<eventId>` (channelRoute.ts): the card scrolls
			// this bubble into view after the history has loaded.
			data-message-id={_id}
			className={`messageItem ${isSystemNotification ? 'carimatMessageFrame' : ''} ${
				isMyMessage ? 'messageItem--right' : ''
			} ${isFullWidthMessage ? 'messageItem--full' : ''} ${
				alias?.messageType &&
				`${alias?.messageType.toLowerCase()} systemMessage`
			} ${isSupervisorFeedback ? 'messageItem--feedback' : ''}`}
		>
			{getMessageDate()}
			<div
				className={`
				messageItem__messageWrap ${isSystemNotification ? 'carimatMessageFrame__row' : ''}
				${isMyMessage ? 'messageItem__messageWrap--right' : 'messageItem__messageWrap--left'}
				${
					isE2EEActivatedMessage
						? 'messageItem__messageWrap--e2eeActivatedMessage'
						: ''
				}
			`}
			>
				{!alias?.messageType &&
					!isMyMessage &&
					!isSystemNotification && (
						<div className="messageItem__sideColumn messageItem__sideColumn--left">
							<div className="messageItem__sideColumnGroup messageItem__sideColumnGroup--left">
								<div className="messageItem__avatar">
									<MessageAvatar
										isGroup={!!activeSession?.isGroup}
										isSystemNotification={false}
										userId={userId}
										username={username}
										choice={incomingAvatarChoice}
										displayName={
											resolvedIncomingDisplayName
										}
										size={AVATAR_SIZES.message}
									/>
								</div>
								{hasMenuActions && (
									<button
										type="button"
										className="messageItem__kebabButton messageItem__kebabButton--left"
										aria-label={translate(
											'message.menu.open'
										)}
										onClick={(event) =>
											toggleActionMenu(event, 'left')
										}
									>
										{isActionMenuOpen ? (
											<ActiveKebabIcon />
										) : (
											<StackVerticalIcon className="messageItem__kebabIconDefault" />
										)}
									</button>
								)}
							</div>
							{showVisibleAudience && (
								<button
									type="button"
									className={clsx(
										'messageItem__visibilityChip',
										'messageItem__visibilityChip--incoming',
										isVisibilityMenuOpen &&
											'messageItem__visibilityChip--active'
									)}
									onClick={(event) =>
										toggleVisibilityMenu(event, 'left')
									}
									aria-label={translate(
										'message.visibility.open'
									)}
								>
									<span className="messageItem__visibilityChipCount">
										+
										{(visibleAudienceLabels.length > 0
											? visibleAudienceLabels.length
											: rawVisibleAudienceLabels.length) ||
											0}
									</span>
									<span className="messageItem__visibilityChipIcon">
										<VisibilityPeopleIcon />
									</span>
								</button>
							)}
						</div>
					)}
				{!alias?.messageType &&
					!isMyMessage &&
					isSystemNotification && (
						<CarimatAvatar
							menu={
								hasMenuActions && (
									<button
										type="button"
										className="messageItem__kebabButton messageItem__kebabButton--left"
										aria-label={translate(
											'message.menu.open'
										)}
										onClick={(event) =>
											toggleActionMenu(event, 'left')
										}
									>
										{isActionMenuOpen ? (
											<ActiveKebabIcon />
										) : (
											<StackVerticalIcon className="messageItem__kebabIconDefault" />
										)}
									</button>
								)
							}
						/>
					)}
				{!alias?.messageType &&
					isMyMessage &&
					!isSystemNotification && (
						<div className="messageItem__sideColumn messageItem__sideColumn--right">
							{showVisibleAudience && (
								<button
									type="button"
									className={clsx(
										'messageItem__visibilityChip',
										'messageItem__visibilityChip--outgoing',
										isVisibilityMenuOpen &&
											'messageItem__visibilityChip--active'
									)}
									onClick={(event) =>
										toggleVisibilityMenu(event, 'right')
									}
									aria-label={translate(
										'message.visibility.open'
									)}
								>
									<span className="messageItem__visibilityChipCount">
										+
										{(visibleAudienceLabels.length > 0
											? visibleAudienceLabels.length
											: rawVisibleAudienceLabels.length) ||
											0}
									</span>
									<span className="messageItem__visibilityChipIcon">
										<VisibilityPeopleIcon />
									</span>
								</button>
							)}
							<div className="messageItem__sideColumnGroup messageItem__sideColumnGroup--right">
								{hasMenuActions && (
									<button
										type="button"
										className="messageItem__kebabButton messageItem__kebabButton--right"
										aria-label={translate(
											'message.menu.open'
										)}
										onClick={(event) =>
											toggleActionMenu(event, 'right')
										}
									>
										{isActionMenuOpen ? (
											<ActiveKebabIcon />
										) : (
											<StackVerticalIcon className="messageItem__kebabIconDefault" />
										)}
									</button>
								)}
								<div className="messageItem__avatar">
									<MessageAvatar
										isGroup={!!activeSession?.isGroup}
										isSystemNotification={false}
										userId={userId}
										username={username}
										displayName={
											ownConsultantName?.displayName ??
											displayName
										}
										firstName={
											ownConsultantName
												? ownConsultantName.firstName
												: userData?.firstName
										}
										lastName={
											ownConsultantName
												? ownConsultantName.lastName
												: userData?.lastName
										}
										size={AVATAR_SIZES.message}
										choice={
											isUserMessage()
												? chosenAvatarOf(userData)
												: counsellorChoiceOf(
														chosenAvatarOf(userData)
													)
										}
									/>
								</div>
							</div>
						</div>
					)}

				<div
					className={clsx(
						'messageItem__content',
						isSystemNotification && 'carimatMessageFrame__content'
					)}
				>
					{messageContent()}
					{isMyMessage && formattedName && !alias?.messageType && (
						<div className="messageItem__senderInfo">
							<div className="messageItem__senderInfoPrimary">
								<div className="messageItem__senderInfoName">
									{formattedName}
								</div>
							</div>
							{profileSubtitle ? (
								<div className="messageItem__senderInfoSubtitle">
									<span>{profileSubtitle}</span>
									<AgencyIcon
										className="messageItem__senderInfoMetaIcon"
										aria-hidden="true"
										focusable="false"
									/>
								</div>
							) : null}
						</div>
					)}
					{/* T21: the thread entry under a root message — reply count
				    and "Author: last reply…" on one line, opens the thread. */}
					{renderMode === 'main' &&
						threadsEnabled &&
						!alias?.messageType &&
						(onOpenThread || readOnly) &&
						threadSummary &&
						threadSummary.replyCount > 0 &&
						(readOnly ? (
							// #420: the preview shows that a thread exists,
							// without opening it.
							<div
								className={clsx(
									threadEntryClassName,
									'messageItem__threadButton--static'
								)}
								data-cy="thread-entry"
								title={threadSummary.lastReplyText}
							>
								{threadEntryContent}
							</div>
						) : (
							<button
								type="button"
								className={threadEntryClassName}
								data-cy="thread-entry"
								aria-label={[
									translate('message.thread.open'),
									translate('message.thread.replies', {
										count: threadSummary.replyCount
									}),
									threadSummary.lastReplyText
								]
									.filter(Boolean)
									.join(' – ')}
								title={threadSummary.lastReplyText}
								onClick={(event) => {
									event.preventDefault();
									event.stopPropagation();
									onOpenThread?.(event.currentTarget);
								}}
							>
								{threadEntryContent}
							</button>
						))}
				</div>
			</div>
			{/* Mounted only while a menu is open: one per message would subscribe the whole timeline. */}
			{(isActionMenuOpen || isVisibilityMenuOpen) && (
				<MenuBackdrop open zIndex={8999} onClose={closeMessageMenus} />
			)}
			{isActionMenuOpen
				? createPortal(
						<ChatMenuDropdown
							density="compact"
							className="messageItem__actionMenu"
							ref={actionMenuRef}
							role="menu"
							style={{
								position: 'fixed',
								maxHeight: 'calc(100vh - 24px)',
								overflowY: 'auto',
								// Off-screen until floating-ui has measured the
								// rendered menu — it needs the real element, so
								// the first paint cannot already know where it
								// goes (same pattern as ToolbarMenu).
								animation:
									motionEnabled && actionMenuPosition
										? 'oriso-menu-reveal 160ms ease-out both'
										: 'none',
								transformOrigin: actionMenuOrigin,
								top: `${actionMenuPosition?.top ?? -9999}px`,
								left: `${actionMenuPosition?.left ?? -9999}px`,
								zIndex: 99999
							}}
						>
							{onReact && (
								<div
									className="messageItem__actionMenuReactions"
									role="group"
									aria-label={translate(
										'message.reaction.add'
									)}
								>
									{quickEmojis.map((emoji) => {
										const ownReaction = (
											reactions || []
										).find(
											(reaction) =>
												reaction.key === emoji &&
												reaction.ownEventId
										);
										return (
											<button
												key={emoji}
												type="button"
												role="menuitem"
												className={clsx(
													'messageItem__actionMenuReactionEmoji',
													ownReaction &&
														'messageItem__actionMenuReactionEmoji--mine'
												)}
												onClick={() => {
													if (
														ownReaction?.ownEventId
													) {
														onUnreact?.(
															ownReaction.ownEventId
														);
														closeMessageMenus();
														return;
													}
													applyQuickReaction(emoji);
												}}
											>
												{emoji}
											</button>
										);
									})}
									<button
										ref={quickEmojiMoreRef}
										type="button"
										role="menuitem"
										className="messageItem__actionMenuReactionMore"
										aria-haspopup="dialog"
										aria-expanded={isQuickEmojiPickerOpen}
										// Same exemption the composer's emoji
										// toggle uses: without it, the picker's
										// pointerdown-outside handler closes the
										// picker on this button, then the click
										// toggles it open again.
										data-emoji-picker-toggle=""
										aria-label={translate(
											'message.reaction.more'
										)}
										onClick={() =>
											setIsQuickEmojiPickerOpen(
												(open) => !open
											)
										}
									>
										<AddReactionOutlinedIcon fontSize="inherit" />
									</button>
									{isQuickEmojiPickerOpen && (
										<EmojiPickerPopup
											direction="down"
											// Beside the menu, not over it:
											// anchored to the menu itself so
											// the picker never covers "Reply
											// directly" & co.
											anchorEl={actionMenuRef.current}
											placement="right-start"
											onPick={applyQuickReaction}
											onClose={() =>
												setIsQuickEmojiPickerOpen(false)
											}
										/>
									)}
								</div>
							)}
							{actionMenuItems.map((item) => (
								<ChatMenuDropdownItem
									key={item.key}
									className="messageItem__actionMenuItem"
									role="menuitem"
									icon={item.icon}
									title={item.label}
									onClick={() =>
										handleActionMenuItemClick(item.key)
									}
								/>
							))}
						</ChatMenuDropdown>,
						document.body
					)
				: null}
			{isVisibilityMenuOpen
				? createPortal(
						<div
							className="messageItem__visibilityMenu"
							ref={visibilityMenuRef}
							role="menu"
							style={{
								position: 'fixed',
								maxHeight: 'calc(100vh - 24px)',
								overflowY: 'auto',
								animation:
									motionEnabled && visibilityMenuPosition
										? 'oriso-menu-reveal 160ms ease-out both'
										: 'none',
								transformOrigin: visibilityMenuOrigin,
								top: `${visibilityMenuPosition?.top ?? -9999}px`,
								left: `${visibilityMenuPosition?.left ?? -9999}px`,
								zIndex: 9000
							}}
						>
							<div className="messageItem__visibilityMenuSubheading">
								{translate('message.visibility.people')}
							</div>
							<div className="messageItem__visibilityMenuHeading">
								{translate('message.visibility.title')}
							</div>
							<div className="messageItem__visibilityMenuDivider" />
							<div className="messageItem__visibilityMenuSections">
								{(
									[
										{
											key: 'clients',
											title: translate(
												'message.audience.clients'
											),
											items: visibilityGroups.clients,
											role: 'clients' as const
										},
										{
											key: 'counsellors',
											title: translate(
												'message.audience.counsellors'
											),
											items: visibilityGroups.counsellors,
											role: 'counsellors' as const
										},
										{
											key: 'moderators',
											title: translate(
												'message.audience.moderators'
											),
											items: visibilityGroups.moderators,
											role: 'moderators' as const
										}
									] as const
								).map((section) => (
									<div
										key={section.key}
										className="messageItem__visibilityMenuSection"
									>
										<button
											type="button"
											className="messageItem__visibilityMenuSectionHeader"
											onClick={() =>
												toggleVisibilitySection(
													section.key
												)
											}
										>
											{(() => {
												const selectedCount =
													section.items.filter(
														(item) => item.selected
													).length;
												const hasAllSelected =
													section.items.length > 0 &&
													selectedCount ===
														section.items.length;
												const hasPartialSelected =
													selectedCount > 0 &&
													selectedCount <
														section.items.length;
												return (
													<span className="messageItem__visibilityMenuSectionTitleWrap">
														<span
															className={clsx(
																'messageItem__visibilityMenuSectionRadio',
																hasAllSelected &&
																	'messageItem__visibilityMenuSectionRadio--selected',
																hasPartialSelected &&
																	'messageItem__visibilityMenuSectionRadio--partial'
															)}
														/>
														<span className="messageItem__visibilityMenuSectionTitle">
															{section.title}
														</span>
													</span>
												);
											})()}
											<ChevronIcon
												className={clsx(
													'messageItem__visibilityMenuSectionChevronIcon',
													expandedVisibilitySections[
														section.key
													] &&
														'messageItem__visibilityMenuSectionChevronIcon--open'
												)}
											/>
										</button>
										<div
											className={clsx(
												'messageItem__visibilityMenuSectionBody',
												expandedVisibilitySections[
													section.key
												] &&
													'messageItem__visibilityMenuSectionBody--expanded'
											)}
										>
											<div className="messageItem__visibilityMenuPills">
												{section.items.length === 0 ? (
													<span className="messageItem__visibilityMenuEmpty">
														{section.key ===
														'clients'
															? translate(
																	'message.audience.clientsEmpty'
																)
															: section.key ===
																  'counsellors'
																? translate(
																		'message.audience.counsellorsEmpty'
																	)
																: translate(
																		'message.audience.moderatorsEmpty'
																	)}
													</span>
												) : (
													section.items.map(
														(item, index) => (
															<span
																key={`${section.key}-${item.label}-${index}`}
																className={clsx(
																	'messageItem__visibilityMenuPill',
																	item.selected &&
																		'messageItem__visibilityMenuPill--active'
																)}
															>
																<span
																	className={clsx(
																		'messageItem__visibilityMenuPillIcon',
																		section.role ===
																			'counsellors' &&
																			'messageItem__visibilityMenuPillIcon--counsellor'
																	)}
																	aria-hidden
																>
																	{section.role ===
																	'moderators' ? (
																		<VisibilityModeratorIcon />
																	) : section.role ===
																	  'counsellors' ? (
																		<VisibilityCounsellorIcon />
																	) : (
																		<VisibilityClientIcon />
																	)}
																</span>
																{item.label}
															</span>
														)
													)
												)}
											</div>
										</div>
									</div>
								))}
							</div>
						</div>,
						document.body
					)
				: null}
			{deleteOverlay && (
				<Overlay
					item={deleteOverlayItem}
					handleOverlayClose={() => {
						setDeleteOverlay(false);
					}}
				/>
			)}
		</div>
	);
};
