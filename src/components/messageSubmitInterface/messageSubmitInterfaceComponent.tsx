import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';

import { SendButton } from './inputField/SendButton';
import { deriveSendButtonState } from './inputField/sendButtonState';
import { DragHandle } from './inputField/DragHandle';
import { ComposerToolbar } from './inputField/ComposerToolbar';
import { DefaultActionBar } from './inputField/DefaultActionBar';
import { EmojiPickerPopup } from './inputField/EmojiPickerPopup';
import { RecipientSplitButton } from './inputField/RecipientSplitButton';
import { getMenuDirection } from './inputField/menuDirection';
import {
	clampComposerHeight as clampComposerHeightPure,
	getComposerHeightBounds as getComposerHeightBoundsPure,
	stepComposerHeight
} from './inputField/composerResize';
import { isAskerEnquirySubmission } from './messageEncryptionMode';
import { resolveAsideTargetRoomId } from './asideRouting';
import { reloadSessionAfterSendIfNeeded } from './sessionRefreshAfterSend';
import { chatTransportService } from '../../services/chatTransportService';
import { extractMentionedUserIds } from '../../utils/messageMentions';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { getModality, Modality } from '../session/getModality';
import { STATUS_ENQUIRY } from '../../globalState/interfaces/SessionsDataInterface';
import {
	AUTHORITIES,
	getContact,
	hasUserAuthority,
	E2EEContext,
	SessionTypeContext,
	useTenant,
	UserDataContext,
	ActiveSessionContext
} from '../../globalState';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import { STATUS_ARCHIVED } from '../../globalState/interfaces';
import {
	apiGetAgencyConsultantList,
	apiPutDearchive,
	apiGetSessionSupervisors,
	apiSendEnquiry,
	apiSendMatrixAttachmentMessage,
	apiSendMessage
} from '../../api';
import {
	MessageSubmitInfo,
	MessageSubmitInfoInterface
} from './MessageSubmitInfo';
import {
	ATTACHMENT_MAX_SIZE_IN_MB,
	getAttachmentSizeMBForKB
} from './attachmentHelpers';
import { ContentState, convertToRaw, EditorState } from 'draft-js';
import { draftToMarkdown } from 'markdown-draft-js';
import {
	escapeMarkdownChars,
	INPUT_MAX_LENGTH,
	normalizeHighlightColor
} from './richtextHelpers';
import { resolveComposerMessageSnapshot } from './composerMessageSnapshot';
import { ReactComponent as AudioOnIcon } from '../../resources/img/icons/audio-on.svg';
import { ReactComponent as RemoveIcon } from '../../resources/img/icons/x.svg';
import { ReactComponent as CalendarMonthIcon } from '../../resources/img/icons/calendar-month-navigation.svg';
import './emojiPicker.styles';
import './messageSubmitInterface.styles';
import clsx from 'clsx';
import { mobileListView } from '../app/navigationHandler';
import { Button, ButtonItem, BUTTON_TYPES } from '../button/Button';
import { Headline } from '../headline/Headline';
import { useTranslation } from 'react-i18next';
import {
	SUPERVISOR_FEEDBACK_PREFIX,
	buildVisibleToPrefix
} from '../message/messageConstants';
import { useE2EE } from '../../hooks/useE2EE';
import { apiPostError, ERROR_LEVEL_WARN } from '../../api/apiPostError';
import { useE2EEViewElements } from '../../hooks/useE2EEViewElements';
import { Overlay } from '../overlay/Overlay';
import { useTimeoutOverlay } from '../../hooks/useTimeoutOverlay';
import { SubscriptionKeyLost } from '../session/SubscriptionKeyLost';
import { RoomNotFound } from '../session/RoomNotFound';
import { useDraftMessage } from './useDraftMessage';
import {
	OVERLAY_E2EE,
	OVERLAY_REQUEST
} from '../../globalState/interfaces/AppConfig/OverlaysConfigInterface';
import { getIconForAttachmentType } from '../message/messageHelpers';
import { TipTapComposer, TipTapComposerRef } from './TipTapComposer';
import { HIGHLIGHT_SNIPPET_SELECTED_EVENT } from './highlightSnippetEvents';
import { isMyMessage } from '../session/sessionHelpers';
import { transportMarkupToComposerHtml } from './transportMarkupToComposerHtml';
import type { MessageItem } from '../message/MessageItemComponent';
import { useKeyboardShortcuts } from '../../features/keyboard-shortcuts/context/KeyboardShortcutsProvider';
import {
	hasOpenModalDialog,
	resolveEffectiveBinding
} from '../../features/keyboard-shortcuts/utils/resolveAction';
import {
	isImeComposing,
	matchesShortcut
} from '../../features/keyboard-shortcuts/utils/match';

type AttachmentUploadControl = Pick<XMLHttpRequest, 'abort'>;
const VOICE_RECORDING_MAX_DURATION_SEC = 180;
const MESSAGE_LENGTH_WARNING_THRESHOLD = Math.floor(INPUT_MAX_LENGTH * 0.9);

const getPlainTextFromComposerValue = (rawMessage?: string | null): string => {
	const value = rawMessage || '';
	if (!value.trim()) {
		return '';
	}

	const normalizedValue = value
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, '\n');

	if (typeof document !== 'undefined') {
		const container = document.createElement('div');
		container.innerHTML = normalizedValue;
		return (container.textContent || '')
			.replace(/\u00a0/g, ' ')
			.replace(/\u200b/g, '');
	}

	return normalizedValue
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&#160;/gi, ' ')
		.replace(/\u00a0/g, ' ')
		.replace(/\u200b/g, '');
};

const INFO_TYPES = {
	ABSENT: 'ABSENT',
	ARCHIVED: 'ARCHIVED',
	ATTACHMENT_SIZE_ERROR: 'ATTACHMENT_SIZE_ERROR',
	ATTACHMENT_FORMAT_ERROR: 'ATTACHMENT_FORMAT_ERROR',
	ATTACHMENT_QUOTA_REACHED_ERROR: 'ATTACHMENT_QUOTA_REACHED_ERROR',
	ATTACHMENT_OTHER_ERROR: 'ATTACHMENT_OTHER_ERROR',
	MESSAGE_SEND_ERROR: 'MESSAGE_SEND_ERROR',
	VOICE_RECORDING_ERROR: 'VOICE_RECORDING_ERROR'
};

export interface MessageSubmitInterfaceComponentProps {
	className?: string;
	onSendButton?: Function;
	isTyping?: Function;
	placeholder: string;
	typingUsers?: string[];
	language?: string;
	preselectedFile?: File;
	handleMessageSendSuccess?: Function;
	/** Anonymous enquiry after "Jetzt Chat starten" — use live chat send, not enquiry API. */
	isAnonymousLiveChat?: boolean;
	isSupervisor?: boolean;
	/** ADR-008: per-session supervision side room id; aside sends go here, never the client room. */
	supervisionRoomId?: string;
	threadRootId?: string | null;
	threadParentPreview?: string | null;
	/**
	 * Relations foundation (#435): direct-reply context. When set, the next
	 * send carries an m.in_reply_to relation to this event and the composer
	 * shows a cancelable quote preview.
	 */
	replyTo?: { eventId: string; author: string; text: string } | null;
	onCancelReply?: () => void;
	/**
	 * Editing (m.replace, #435): when set, the composer prefills this
	 * message's text and the next send edits it in place instead of sending
	 * a new message.
	 */
	editingMessage?: { eventId: string; text: string } | null;
	onCancelEdit?: () => void;
	mobileUnreadCount?: number;
	mobileIsScrolledToBottom?: boolean;
	onMobileNavigateBack?: () => void;
	onMobileNavigateDown?: () => void;
	onMobileNavigateBottom?: () => void;
	/** All messages in the current session — used to find the last own message for editing. */
	messages?: MessageItem[];
	/** Close the thread panel (for Escape shortcut). */
	onCloseThread?: () => void;
	/** Notify parent of a local optimistic edit (messageId → new text). */
	onLocalMessageEdit?: (messageId: string, newText: string) => void;
	/** Prefer Matrix-aware ownership from SessionItem when provided. */
	isOwnMessage?: (userId: string) => boolean;
}

export const MessageSubmitInterfaceComponent = ({
	className,
	onSendButton,
	isTyping,
	placeholder,
	typingUsers,
	language,
	preselectedFile,
	handleMessageSendSuccess: onMessageSendSuccess,
	isAnonymousLiveChat = false,
	isSupervisor,
	supervisionRoomId,
	threadRootId,
	threadParentPreview,
	replyTo,
	onCancelReply,
	editingMessage,
	onCancelEdit,
	mobileUnreadCount = 0,
	mobileIsScrolledToBottom = false,
	onMobileNavigateBack,
	onMobileNavigateDown,
	onMobileNavigateBottom,
	messages,
	onCloseThread,
	onLocalMessageEdit,
	isOwnMessage
}: MessageSubmitInterfaceComponentProps) => {
	const ComposerMobileBackIcon = () => (
		<svg
			width="5"
			height="10"
			viewBox="0 0 5 10"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<path d="M5 10L0 5L5 0V10Z" fill="#1D1B20" />
		</svg>
	);

	const ComposerMobileDownIcon = () => (
		<svg
			width="10"
			height="5"
			viewBox="0 0 10 5"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<path d="M5 5L0 0H10L5 5Z" fill="#1D1B20" />
		</svg>
	);

	const AudienceAllMultiIcon = () => (
		<svg
			width="19"
			height="14"
			viewBox="0 0 19 14"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<path
				d="M0 13.3333V11C0 10.5278 0.121528 10.0937 0.364583 9.69792C0.607639 9.30208 0.930556 9 1.33333 8.79167C2.19444 8.36111 3.06944 8.03819 3.95833 7.82292C4.84722 7.60764 5.75 7.5 6.66667 7.5C7.58333 7.5 8.48611 7.60764 9.375 7.82292C10.2639 8.03819 11.1389 8.36111 12 8.79167C12.4028 9 12.7257 9.30208 12.9688 9.69792C13.2118 10.0937 13.3333 10.5278 13.3333 11V13.3333H0ZM15 13.3333V10.8333C15 10.2222 14.8299 9.63542 14.4896 9.07292C14.1493 8.51042 13.6667 8.02778 13.0417 7.625C13.75 7.70833 14.4167 7.85069 15.0417 8.05208C15.6667 8.25347 16.25 8.5 16.7917 8.79167C17.2917 9.06944 17.6736 9.37847 17.9375 9.71875C18.2014 10.059 18.3333 10.4306 18.3333 10.8333V13.3333H15ZM6.66667 6.66667C5.75 6.66667 4.96528 6.34028 4.3125 5.6875C3.65972 5.03472 3.33333 4.25 3.33333 3.33333C3.33333 2.41667 3.65972 1.63194 4.3125 0.979167C4.96528 0.326389 5.75 0 6.66667 0C7.58333 0 8.36806 0.326389 9.02083 0.979167C9.67361 1.63194 10 2.41667 10 3.33333C10 4.25 9.67361 5.03472 9.02083 5.6875C8.36806 6.34028 7.58333 6.66667 6.66667 6.66667ZM15 3.33333C15 4.25 14.6736 5.03472 14.0208 5.6875C13.3681 6.34028 12.5833 6.66667 11.6667 6.66667C11.5139 6.66667 11.3194 6.6493 11.0833 6.61458C10.8472 6.57986 10.6528 6.54167 10.5 6.5C10.875 6.05556 11.1632 5.5625 11.3646 5.02083C11.566 4.47917 11.6667 3.91667 11.6667 3.33333C11.6667 2.75 11.566 2.1875 11.3646 1.64583C11.1632 1.10417 10.875 0.611111 10.5 0.166667C10.6944 0.0972222 10.8889 0.0520833 11.0833 0.03125C11.2778 0.0104167 11.4722 0 11.6667 0C12.5833 0 13.3681 0.326389 14.0208 0.979167C14.6736 1.63194 15 2.41667 15 3.33333Z"
				fill="currentColor"
			/>
		</svg>
	);

	const AudienceChipChevronIcon = ({ className }: { className?: string }) => (
		<svg
			width="11"
			height="7"
			viewBox="0 0 11 7"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden="true"
		>
			<path
				d="M5.5 2.56667L1.28333 6.78333L0 5.5L5.5 0L11 5.5L9.71667 6.78333L5.5 2.56667Z"
				fill="currentColor"
			/>
		</svg>
	);

	const AudienceSingleUserIcon = () => (
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<path
				d="M2.56667 10.0667C3.13333 9.63333 3.76667 9.29167 4.46667 9.04167C5.16667 8.79167 5.9 8.66667 6.66667 8.66667C7.43333 8.66667 8.16667 8.79167 8.86667 9.04167C9.56667 9.29167 10.2 9.63333 10.7667 10.0667C11.1556 9.61111 11.4583 9.09445 11.675 8.51667C11.8917 7.93889 12 7.32222 12 6.66667C12 5.18889 11.4806 3.93056 10.4417 2.89167C9.40278 1.85278 8.14444 1.33333 6.66667 1.33333C5.18889 1.33333 3.93056 1.85278 2.89167 2.89167C1.85278 3.93056 1.33333 5.18889 1.33333 6.66667C1.33333 7.32222 1.44167 7.93889 1.65833 8.51667C1.875 9.09445 2.17778 9.61111 2.56667 10.0667ZM6.66667 7.33333C6.01111 7.33333 5.45833 7.10833 5.00833 6.65833C4.55833 6.20833 4.33333 5.65556 4.33333 5C4.33333 4.34444 4.55833 3.79167 5.00833 3.34167C5.45833 2.89167 6.01111 2.66667 6.66667 2.66667C7.32222 2.66667 7.875 2.89167 8.325 3.34167C8.775 3.79167 9 4.34444 9 5C9 5.65556 8.775 6.20833 8.325 6.65833C7.875 7.10833 7.32222 7.33333 6.66667 7.33333ZM6.66667 13.3333C5.74444 13.3333 4.87778 13.1583 4.06667 12.8083C3.25556 12.4583 2.55 11.9833 1.95 11.3833C1.35 10.7833 0.875 10.0778 0.525 9.26667C0.175 8.45556 0 7.58889 0 6.66667C0 5.74444 0.175 4.87778 0.525 4.06667C0.875 3.25556 1.35 2.55 1.95 1.95C2.55 1.35 3.25556 0.875 4.06667 0.525C4.87778 0.175 5.74444 0 6.66667 0C7.58889 0 8.45556 0.175 9.26667 0.525C10.0778 0.875 10.7833 1.35 11.3833 1.95C11.9833 2.55 12.4583 3.25556 12.8083 4.06667C13.1583 4.87778 13.3333 5.74444 13.3333 6.66667C13.3333 7.58889 13.1583 8.45556 12.8083 9.26667C12.4583 10.0778 11.9833 10.7833 11.3833 11.3833C10.7833 11.9833 10.0778 12.4583 9.26667 12.8083C8.45556 13.1583 7.58889 13.3333 6.66667 13.3333Z"
				fill="white"
			/>
		</svg>
	);

	const AudienceSingleConsultantIcon = () => (
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

	const AudienceModeratorIcon = () => (
		<svg
			width="11"
			height="14"
			viewBox="0 0 11 14"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<path
				d="M3.675 6.65833C3.225 6.20833 3 5.65556 3 5C3 4.34444 3.225 3.79167 3.675 3.34167C4.125 2.89167 4.67778 2.66667 5.33333 2.66667C5.98889 2.66667 6.54167 2.89167 6.99167 3.34167C7.44167 3.79167 7.66667 4.34444 7.66667 5C7.66667 5.65556 7.44167 6.20833 6.99167 6.65833C6.54167 7.10833 5.98889 7.33333 5.33333 7.33333C4.67778 7.33333 4.125 7.10833 3.675 6.65833ZM5.33333 13.3333C3.78889 12.9444 2.51389 12.0583 1.50833 10.675C0.502778 9.29167 0 7.75556 0 6.06667V2L5.33333 0L10.6667 2V6.06667C10.6667 7.75556 10.1639 9.29167 9.15833 10.675C8.15278 12.0583 6.87778 12.9444 5.33333 13.3333ZM5.33333 1.41667L1.33333 2.91667V6.06667C1.33333 6.66667 1.41667 7.25 1.58333 7.81667C1.75 8.38333 1.97778 8.91667 2.26667 9.41667C2.73333 9.18333 3.22222 9 3.73333 8.86667C4.24444 8.73333 4.77778 8.66667 5.33333 8.66667C5.88889 8.66667 6.42222 8.73333 6.93333 8.86667C7.44445 9 7.93333 9.18333 8.4 9.41667C8.68889 8.91667 8.91667 8.38333 9.08333 7.81667C9.25 7.25 9.33333 6.66667 9.33333 6.06667V2.91667L5.33333 1.41667Z"
				fill="white"
			/>
		</svg>
	);

	const { t: translate } = useTranslation();

	// Debug logging
	useEffect(() => {
		// console.log('🔥 MessageSubmitInterface MOUNTED');
		return () => {
			// console.log('🔥 MessageSubmitInterface UNMOUNTED');
		};
	}, []);
	const tenant = useTenant();
	const navigate = useNavigate();
	const location = useLocation();

	const textareaInputRef = useRef<HTMLDivElement>(null);
	const inputWrapperRef = useRef<HTMLSpanElement>(null);
	const audienceMenuRef = useRef<HTMLDivElement>(null);
	const attachmentInputRef = useRef<HTMLInputElement>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	const voiceRecordingTimerRef = useRef<number | null>(null);
	const voiceRecordingDurationRef = useRef(0);
	const voiceRecordingStartedAtRef = useRef<number | null>(null);
	const voiceDiscardAfterStopRef = useRef(false);
	const voiceSendAfterStopRef = useRef(false);

	const { userData } = useContext(UserDataContext);
	const { activeSession, reloadActiveSession } =
		useContext(ActiveSessionContext);
	const { type, path: listPath } = useContext(SessionTypeContext);
	const { isE2eeEnabled } = useContext(E2EEContext);
	const { matrixClientService } = useMatrixClient();
	const resolvedChatSession = useMemo(
		() => chatTransportService.resolveSession(activeSession),
		[activeSession]
	);

	const [activeInfo, setActiveInfo] = useState(null);
	const [attachmentSelected, setAttachmentSelected] = useState<File | null>(
		null
	);
	const [uploadProgress, setUploadProgress] = useState<number | null>(null);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const [attachmentUpload, setAttachmentUpload] =
		useState<AttachmentUploadControl | null>(null);
	const [editorState, setEditorState] = useState(EditorState.createEmpty());
	const [composerText, setComposerText] = useState('');
	const [highlightedSnippet, setHighlightedSnippet] = useState<string | null>(
		null
	);
	const composerRef = useRef<TipTapComposerRef | null>(null);
	// Rich text mode is permanently on; only the value is needed.
	const [isRichtextActive] = useState(true);
	const [isConsultantAbsent, setIsConsultantAbsent] = useState(
		hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
			activeSession.consultant?.absent
	);
	const [isSessionArchived, setIsSessionArchived] = useState(
		activeSession.item.status === STATUS_ARCHIVED
	);
	const [isTypingActive, setIsTypingActive] = useState(activeSession.isGroup);
	const [showAppointmentButton, setShowAppointmentButton] = useState(false);
	const [isVoiceRecording, setIsVoiceRecording] = useState(false);
	const [voiceRecordingDurationSec, setVoiceRecordingDurationSec] =
		useState(0);
	const [voiceAttachmentDurationSec, setVoiceAttachmentDurationSec] =
		useState(0);
	const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
	const [isEmojiStripOpen, setIsEmojiStripOpen] = useState(false);
	const [isCompactActionStripOpen, setIsCompactActionStripOpen] =
		useState(true);
	const [editingMessageId, setEditingMessageId] = useState<string | null>(
		null
	);
	const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
		typeof window !== 'undefined' ? window.innerWidth <= 899 : false
	);
	const [isExpandedComposer, setIsExpandedComposer] = useState(false);
	const [composerHeight, setComposerHeight] = useState<number | null>(null);
	const [isComposerResizing, setIsComposerResizing] = useState(false);
	const [isComposerSelected, setIsComposerSelected] = useState(false);
	const composerResizeStartRef = useRef<{
		pointerId: number;
		startY: number;
		startHeight: number;
	} | null>(null);
	const [isAudienceMenuOpen, setIsAudienceMenuOpen] = useState(false);
	// Only the setter is needed while the audience blur overlay is disabled
	// (see audienceMenuOverlayStyle below).
	const [, setAudienceOverlayBounds] = useState<{
		top: number;
		left: number;
		width: number;
		height: number;
		borderRadius: string;
	} | null>(null);
	const [audienceOptions, setAudienceOptions] = useState<
		Array<{ value: string; label: string }>
	>([{ value: '__all__', label: 'ALL' }]);
	const [selectedAudienceValues, setSelectedAudienceValues] = useState<
		string[]
	>(['__all__']);
	const [audienceRefreshTick, setAudienceRefreshTick] = useState(0);
	const [sessionSupervisors, setSessionSupervisors] = useState<
		Array<{ id: string; username: string }>
	>([]);
	const [agencyConsultantDirectory, setAgencyConsultantDirectory] = useState<
		Map<string, { displayName: string; username: string }>
	>(new Map());
	const [expandedAudienceSections, setExpandedAudienceSections] = useState({
		clients: true,
		counsellors: true,
		moderators: true
	});
	const audienceSelectionStorageKey = useMemo(() => {
		const sessionId = activeSession?.item?.id;
		if (!sessionId) {
			return '';
		}
		return `oriso.audienceSelection.${sessionId}`;
	}, [activeSession?.item?.id]);

	const normalizeInitialAlignment = useCallback((rawValue: string) => {
		if (!rawValue) {
			return rawValue;
		}
		return rawValue
			.replace(/text-align\s*:\s*right/gi, 'text-align: left')
			.replace(
				/data-text-align\s*=\s*["']right["']/gi,
				'data-text-align="left"'
			);
	}, []);

	const focusEditorInput = useCallback(() => {
		const inputElement = textareaInputRef.current;
		if (!inputElement) {
			return;
		}

		const editorElement = inputElement.querySelector(
			'[contenteditable="true"]'
		) as HTMLElement | null;
		if (!editorElement) {
			return;
		}

		const activeElement = document.activeElement as HTMLElement | null;
		const activeTagName = activeElement?.tagName?.toLowerCase();
		const isTypingInAnotherInput =
			!!activeElement &&
			!inputElement.contains(activeElement) &&
			(activeElement.isContentEditable ||
				activeTagName === 'input' ||
				activeTagName === 'textarea' ||
				activeTagName === 'select');

		if (isTypingInAnotherInput) {
			return;
		}

		// Avoid browser auto-scrolling the whole page when focusing the editor.
		if (typeof (editorElement as any).focus === 'function') {
			(editorElement as any).focus({ preventScroll: true });
		}
	}, []);

	// This loads the keys for current activeSession.rid which is already set:
	// to groupChat.groupId on group chats
	// to session.groupId on session chats
	const {
		subscriptionKeyLost,
		roomNotFound,
		encryptRoom,
		ready: e2EEReady
	} = useE2EE(activeSession.rid || null);

	const {
		visible: e2eeOverlayVisible,
		setState: setE2EEState,
		overlay: e2eeOverlay
	} = useE2EEViewElements();

	const { visible: requestOverlayVisible, overlay: requestOverlay } =
		useTimeoutOverlay(
			// Disable the request overlay if upload is in progess because upload progress is shown in the ui already
			isRequestInProgress &&
				!(uploadProgress > 0 && uploadProgress < 100),
			null,
			null,
			null,
			5000
		);

	useEffect(() => {
		setIsConsultantAbsent(
			hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
				activeSession.consultant?.absent
		);
		setIsSessionArchived(activeSession.item.status === STATUS_ARCHIVED);
		setIsTypingActive(activeSession.isGroup);
	}, [activeSession, activeSession.item.status, userData]);

	const draftActionPath = useMemo(() => {
		const params = new URLSearchParams(location.search);
		params.delete('embeddedNotifications');
		params.delete('draftScopeKey');
		if (threadRootId) {
			params.set('threadRootId', threadRootId);
		} else {
			params.delete('threadRootId');
		}
		const query = params.toString();
		return `${location.pathname}${query ? `?${query}` : ''}`;
	}, [location.pathname, location.search, threadRootId]);

	const contact = getContact(activeSession);
	const isAnonymousChat = getModality(activeSession) === Modality.LIVE_CHAT;

	const draftTitle = useMemo(() => {
		const topicName =
			typeof activeSession?.item?.topic === 'object'
				? activeSession?.item?.topic?.name
				: activeSession?.item?.topic;
		return contact?.displayName || contact?.username || topicName || null;
	}, [activeSession, contact]);

	const forcedDraftScopeKey = useMemo(() => {
		const params = new URLSearchParams(location.search);
		const allScopeKeys = params.getAll('draftScopeKey');
		return allScopeKeys.length
			? allScopeKeys[allScopeKeys.length - 1]
			: null;
	}, [location.search]);

	const loadDraftIntoComposer = useCallback(
		(loadedState: EditorState, rawDraft?: string) => {
			try {
				setEditorState(loadedState);
				const draftValue = (rawDraft || '').trim();
				if (draftValue) {
					// TipTap drafts are saved as HTML now; load raw draft directly to preserve formatting.
					const normalizedDraft = normalizeInitialAlignment(
						rawDraft || ''
					);
					setComposerText(normalizedDraft || '');
					composerRef.current?.setText(normalizedDraft || '');
					return;
				}
				// Backward fallback for any legacy empty/raw conversion edge-cases.
				const contentState = loadedState.getCurrentContent();
				const rawObject = convertToRaw(
					escapeMarkdownChars(contentState)
				);
				const markdownString = draftToMarkdown(rawObject, {
					escapeMarkdownCharacters: false
				});
				const normalizedDraft =
					normalizeInitialAlignment(markdownString);
				setComposerText(normalizedDraft);
				composerRef.current?.setText(normalizedDraft);
			} catch {
				setComposerText('');
				composerRef.current?.clear();
			}
		},
		[normalizeInitialAlignment]
	);

	// Editing (#435): prefill the composer with the message being edited.
	// Depend on the specific fields (not the object identity) so a new
	// editingMessage reference with the same content doesn't re-run the effect.
	const editingMessageEventId = editingMessage?.eventId;
	const editingMessageText = editingMessage?.text;
	useEffect(() => {
		if (editingMessageText === undefined) {
			return;
		}
		setComposerText(editingMessageText);
		composerRef.current?.setText(editingMessageText);
		composerRef.current?.focus();
	}, [editingMessageEventId, editingMessageText]);

	const isAnonymousEnquiryComposer =
		type === SESSION_LIST_TYPES.ENQUIRY && isAnonymousChat;
	const hasMatrixRoom = Boolean(resolvedChatSession.matrixRoomId);
	const isAskerEnquiry = isAskerEnquirySubmission({
		isEnquiryListType: type === SESSION_LIST_TYPES.ENQUIRY,
		sessionStatus: activeSession.item?.status,
		hasAskerAuthority: hasUserAuthority(
			AUTHORITIES.ASKER_DEFAULT,
			userData
		),
		isAnonymousLiveChat,
		hasMatrixRoom
	});

	const {
		onChange: onDraftMessageChange,
		loaded: draftLoaded,
		clearDraftMessage
	} = useDraftMessage(
		!isRequestInProgress && !isAnonymousEnquiryComposer,
		loadDraftIntoComposer,
		{
			threadRootId: threadRootId || null,
			actionPath: draftActionPath,
			sessionId: activeSession?.item?.id ?? null,
			roomRef: activeSession?.rid ?? null,
			title: draftTitle,
			forcedScopeKey: forcedDraftScopeKey
		}
	);

	const handleComposerChange = useCallback(
		(nextValue: string) => {
			setComposerText(nextValue);
			onDraftMessageChange(nextValue);
			if (isTyping) {
				isTyping(!nextValue.trim().length);
			}
			const draftContentState = ContentState.createFromText(nextValue);
			setEditorState(EditorState.createWithContent(draftContentState));
		},
		[isTyping, onDraftMessageChange]
	);

	useEffect(() => {
		const handleSnippet = (event: Event) => {
			const customEvent = event as CustomEvent<{
				text?: string;
				anchorId?: string;
			}>;
			const snippet = customEvent?.detail?.text || '';
			if (!snippet.trim()) {
				return;
			}
			setHighlightedSnippet(snippet);
			composerRef.current?.insertSnippet({
				text: snippet,
				anchorId: customEvent?.detail?.anchorId || null
			});
		};
		window.addEventListener(
			HIGHLIGHT_SNIPPET_SELECTED_EVENT,
			handleSnippet
		);
		return () => {
			window.removeEventListener(
				HIGHLIGHT_SNIPPET_SELECTED_EVENT,
				handleSnippet
			);
		};
	}, []);

	useEffect(() => {
		if (
			isSessionArchived &&
			hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
		) {
			setActiveInfo(INFO_TYPES.ARCHIVED);
		} else if (isConsultantAbsent) {
			setActiveInfo(INFO_TYPES.ABSENT);
		} else {
			setActiveInfo(null);
		}
	}, [isConsultantAbsent, isSessionArchived, userData]);

	const getTypedMarkdownMessage = useCallback(() => {
		const liveEditorHtml = composerRef.current?.getHTML();
		// Use latest editor snapshot first to avoid stale last-action/last-char issues.
		return resolveComposerMessageSnapshot(liveEditorHtml, composerText);
	}, [composerText]);

	const hasMessageContent = useCallback((rawMessage?: string | null) => {
		return getPlainTextFromComposerValue(rawMessage).trim().length > 0;
	}, []);

	const encodeHighlightColorsForTransport = useCallback(
		(rawMessage: string) => {
			if (!rawMessage) {
				return rawMessage;
			}
			return rawMessage.replace(
				/<mark([^>]*)>([\s\S]*?)<\/mark>/gi,
				(_full, attrs: string, inner: string) => {
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
					// Use a backend-safe token format to avoid downstream conversions that drop color.
					return `[[hl:${color}]]${inner}[[/hl]]`;
				}
			);
		},
		[]
	);

	const encodeAlignmentForTransport = useCallback((rawMessage: string) => {
		if (!rawMessage) {
			return rawMessage;
		}
		return rawMessage.replace(
			/<(p|h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi,
			(_full, tagName: string, attrs: string, inner: string) => {
				const styleAlignMatch = attrs.match(
					/text-align\s*:\s*(left|center|right)/i
				);
				const dataAlignMatch = attrs.match(
					/data-text-align\s*=\s*["'](left|center|right)["']/i
				);
				const align = (
					dataAlignMatch?.[1] ||
					styleAlignMatch?.[1] ||
					''
				).toLowerCase();
				if (!align) {
					return `<${tagName}${attrs}>${inner}</${tagName}>`;
				}
				return `[[align:${align}]]<${tagName}>${inner}</${tagName}>[[/align]]`;
			}
		);
	}, []);

	useEffect(() => {
		if (!activeInfo && isConsultantAbsent) {
			setActiveInfo(INFO_TYPES.ABSENT);
		}
	}, [activeInfo]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		resizeTextarea();
		const toolbar: HTMLDivElement | null =
			document.querySelector('.textarea__toolbar');
		const richtextToggle: HTMLSpanElement | null = document.querySelector(
			'.textarea__richtextToggle'
		);
		if (isRichtextActive) {
			toolbar?.classList.add('textarea__toolbar--active');
			richtextToggle?.classList.add('textarea__richtextToggle--active');
		} else {
			toolbar?.classList.remove('textarea__toolbar--active');
			richtextToggle?.classList.remove(
				'textarea__richtextToggle--active'
			);
		}
	}, [isRichtextActive]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		resizeTextarea();
	}, [attachmentSelected]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		const uploadProgressBar = document.querySelector(
			'.textarea__attachmentSelected__progress'
		);
		if (uploadProgressBar && uploadProgress > 0 && uploadProgress <= 100) {
			uploadProgressBar.setAttribute(
				'style',
				`width: ${uploadProgress}%`
			);
		}
	}, [uploadProgress]);

	useEffect(() => {
		if (hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)) {
			return;
		}

		if (activeSession.isEmptyEnquiry) {
			setShowAppointmentButton(userData.appointmentFeatureEnabled);
		}
	}, [activeSession?.isEmptyEnquiry, userData]);

	const removeSelectedAttachment = useCallback(() => {
		const attachmentInput: any = attachmentInputRef.current;
		if (attachmentInput) {
			attachmentInput.value = '';
		}
	}, []);

	const cleanupAttachment = useCallback(() => {
		setUploadProgress(0);
		setAttachmentSelected(null);
		setAttachmentUpload(null);
		setVoiceAttachmentDurationSec(0);
		if (voicePreviewUrl) {
			URL.revokeObjectURL(voicePreviewUrl);
		}
		setVoicePreviewUrl(null);
		removeSelectedAttachment();
	}, [removeSelectedAttachment, voicePreviewUrl]);

	const cleanupVoiceRecorder = useCallback(() => {
		if (voiceRecordingTimerRef.current) {
			window.clearInterval(voiceRecordingTimerRef.current);
			voiceRecordingTimerRef.current = null;
		}
		setIsVoiceRecording(false);
		setVoiceRecordingDurationSec(0);
		voiceRecordingDurationRef.current = 0;
		voiceRecordingStartedAtRef.current = null;
		voiceDiscardAfterStopRef.current = false;
		voiceSendAfterStopRef.current = false;
		if (mediaRecorderRef.current) {
			mediaRecorderRef.current = null;
		}
		if (mediaStreamRef.current) {
			mediaStreamRef.current.getTracks().forEach((track) => track.stop());
			mediaStreamRef.current = null;
		}
	}, []);

	const handleAttachmentUploadError = useCallback(
		(infoType: string) => {
			setActiveInfo(infoType);
			cleanupAttachment();
			setTimeout(() => setIsRequestInProgress(false), 1200);
		},
		[cleanupAttachment]
	);

	const stopVoiceRecording = useCallback(
		(options?: { discard?: boolean; sendAfterStop?: boolean }) => {
			voiceDiscardAfterStopRef.current = !!options?.discard;
			voiceSendAfterStopRef.current = !!options?.sendAfterStop;
			const recorder = mediaRecorderRef.current;
			if (recorder && recorder.state !== 'inactive') {
				recorder.stop();
				return;
			}
			cleanupVoiceRecorder();
		},
		[cleanupVoiceRecorder]
	);

	const scrollEditorToBottom = useCallback(() => {
		const textInput: any = textareaInputRef.current;
		if (!textInput) return;

		// Find all possible scrollable elements
		const editorContent = textInput.querySelector(
			'.public-DraftEditor-content'
		);
		const editorRoot = textInput.querySelector('.DraftEditor-root');
		const editorContentDiv = textInput.querySelector(
			'.public-DraftEditor-content > div'
		);

		// Function to perform the scroll on all possible elements
		const doScroll = () => {
			// Scroll the main editor content
			if (editorContent) {
				const scrollHeight = editorContent.scrollHeight;
				const clientHeight = editorContent.clientHeight;
				if (scrollHeight > clientHeight) {
					editorContent.scrollTop = scrollHeight + 1000;
				}
			}

			// Scroll the editor root container
			if (editorRoot) {
				const scrollHeight = editorRoot.scrollHeight;
				const clientHeight = editorRoot.clientHeight;
				if (scrollHeight > clientHeight) {
					editorRoot.scrollTop = scrollHeight + 1000;
				}
			}

			// Scroll the textInput container itself
			if (textInput.scrollHeight > textInput.clientHeight) {
				textInput.scrollTop = textInput.scrollHeight + 1000;
			}

			// Try scrollIntoView on the last element as fallback
			if (editorContentDiv) {
				const lastChild = editorContentDiv.lastElementChild;
				if (lastChild) {
					lastChild.scrollIntoView({
						behavior: 'auto',
						block: 'end',
						inline: 'nearest'
					});
				}
			}
		};

		// Scroll immediately
		doScroll();

		// Scroll after DOM update (requestAnimationFrame) - multiple frames for rich text
		requestAnimationFrame(() => {
			doScroll();
			requestAnimationFrame(() => {
				doScroll();
				// Extra frames for rich text mode (Draft.js + toolbar needs more time)
				if (isRichtextActive) {
					requestAnimationFrame(() => {
						doScroll();
						requestAnimationFrame(() => {
							doScroll();
							requestAnimationFrame(() => {
								doScroll();
							});
						});
					});
				}
			});
		});

		// Multiple delayed scrolls to catch late DOM updates
		// When rich text is active with toolbar, we need even more aggressive scrolling
		if (isRichtextActive) {
			setTimeout(() => doScroll(), 0);
			setTimeout(() => doScroll(), 10);
			setTimeout(() => doScroll(), 30);
			setTimeout(() => doScroll(), 50);
			setTimeout(() => doScroll(), 100);
			setTimeout(() => doScroll(), 200);
			setTimeout(() => doScroll(), 400);
			setTimeout(() => doScroll(), 600);
			setTimeout(() => doScroll(), 800);
			setTimeout(() => doScroll(), 1000);
		} else {
			setTimeout(() => doScroll(), 10);
			setTimeout(() => doScroll(), 50);
			setTimeout(() => doScroll(), 100);
		}
	}, [isRichtextActive]);

	// Auto-scroll when editorState changes (especially for Enter key creating new lines in rich text mode)
	// This useEffect watches for editorState changes and scrolls, catching cases where
	// handleEditorChange might not trigger scroll properly (e.g., Enter key creating new lines)
	// Only needed when rich text formatting is active (Draft.js editor)
	useEffect(() => {
		if (editorState && draftLoaded && isRichtextActive) {
			// Use multiple attempts with longer delays to catch DOM updates at different stages
			// Enter key especially needs time for Draft.js to render the new line
			// Rich text mode needs more aggressive scrolling due to Draft.js DOM update delays
			const timeoutId1 = setTimeout(() => scrollEditorToBottom(), 0);
			const timeoutId2 = setTimeout(() => scrollEditorToBottom(), 50);
			const timeoutId3 = setTimeout(() => scrollEditorToBottom(), 150);
			const timeoutId4 = setTimeout(() => scrollEditorToBottom(), 300);
			const timeoutId5 = setTimeout(() => scrollEditorToBottom(), 500);
			const timeoutId6 = setTimeout(() => scrollEditorToBottom(), 700);
			return () => {
				clearTimeout(timeoutId1);
				clearTimeout(timeoutId2);
				clearTimeout(timeoutId3);
				clearTimeout(timeoutId4);
				clearTimeout(timeoutId5);
				clearTimeout(timeoutId6);
			};
		}
	}, [editorState, draftLoaded, isRichtextActive, scrollEditorToBottom]);

	const resizeTextarea = useCallback(() => {
		const textInput: any = textareaInputRef.current;
		if (!textInput) return;
		// Figma-locked composer uses fixed geometry; avoid runtime inline style overrides.
		if (composerRef.current) {
			return;
		}

		// Check if editor is empty - if so, reset to default height
		const hasText = editorState.getCurrentContent().hasText();

		// default values
		let textareaMaxHeight;
		if (window.innerWidth <= 900) {
			textareaMaxHeight = 118;
		} else {
			textareaMaxHeight = 218;
		}
		const fileHeight = 48;

		// Default min heights from CSS: mobile 88px, desktop 106px
		const defaultMinHeight = window.innerWidth <= 900 ? 88 : 106;

		// If editor is empty, force it back to default height
		if (!hasText) {
			let textInputStyles = `height: ${defaultMinHeight}px !important; max-height: ${defaultMinHeight}px !important; min-height: ${defaultMinHeight}px !important; overflow-y: hidden !important;`;
			const textInputMarginTop = '';
			const textInputMarginBottom = attachmentSelected
				? `margin-bottom: ${fileHeight}px !important;`
				: '';
			textInputStyles += ` ${textInputMarginTop} ${textInputMarginBottom}`;

			if (attachmentSelected) {
				textInputStyles += `border-bottom: none !important; border-bottom-right-radius: 0 !important;`;
			}

			textInput.setAttribute('style', textInputStyles);

			// Force Draft.js containers to reset height
			const editorContainer = textInput.querySelector('.ProseMirror');
			if (editorContainer) {
				editorContainer.setAttribute(
					'style',
					`height: ${defaultMinHeight}px !important; max-height: ${defaultMinHeight}px !important;`
				);
			}
			const editorContentDiv = textInput.querySelector('.ProseMirror p');
			if (editorContentDiv) {
				editorContentDiv.setAttribute(
					'style',
					`height: auto !important; max-height: none !important;`
				);
			}
			return;
		}

		// If editor has text, allow it to grow normally
		const textHeight = document.querySelector('.ProseMirror')?.scrollHeight;
		let textInputMaxHeight = textareaMaxHeight;
		textInputMaxHeight = attachmentSelected
			? textInputMaxHeight - fileHeight
			: textInputMaxHeight;

		const currentInputHeight =
			textHeight > textInputMaxHeight ? textInputMaxHeight : textHeight;

		// add input styles
		const currentOverflow =
			textHeight <= textareaMaxHeight
				? 'overflow-y: hidden;'
				: 'overflow-y: scroll;';
		const textInputMarginTop = '';
		const textInputMarginBottom = attachmentSelected
			? `margin-bottom: ${fileHeight}px;`
			: '';
		let textInputStyles = `min-height: ${currentInputHeight}px; ${currentOverflow} ${textInputMarginTop} ${textInputMarginBottom}`;
		textInputStyles = attachmentSelected
			? textInputStyles +
				`border-bottom: none; border-bottom-right-radius: 0;`
			: textInputStyles;
		textInput?.setAttribute('style', textInputStyles);

		const textareaContainer = textInput?.closest('.textarea');
		const textareaContainerHeight = textareaContainer?.offsetHeight;
		const scrollButton = textareaContainer
			?.closest('.session')
			?.getElementsByClassName('session__scrollToBottom')[0];
		if (scrollButton) {
			scrollButton.style.bottom = textareaContainerHeight + 24 + 'px';
		}

		// Auto-scroll to bottom after resize completes (especially important for bullet lists)
		scrollEditorToBottom();
	}, [attachmentSelected, editorState, scrollEditorToBottom]);

	// Keep chat input ready for direct typing when opening/changing chats.
	useEffect(() => {
		// Do not steal focus from explicit thread reply input.
		if (threadRootId) {
			return;
		}
		if (!draftLoaded) {
			return;
		}
		// On mobile, auto-focus can trigger viewport scrolling that shifts header/composer.
		if (window.innerWidth <= 900) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			composerRef.current?.runAction('alignLeft');
			focusEditorInput();
		}, 0);

		return () => window.clearTimeout(timeoutId);
	}, [
		activeSession.item.groupId,
		activeSession.item.id,
		draftLoaded,
		focusEditorInput,
		threadRootId
	]);

	// Keep mobile stable: avoid page-level scroll jumps on focus/viewport resize.
	useEffect(() => {
		return;
	}, []);

	const sendEnquiry = useCallback(
		(message, isEncrypted) => {
			return apiSendEnquiry(
				activeSession.item.id,
				message,
				isEncrypted,
				language
			)
				.then((response) =>
					encryptRoom(setE2EEState, response.rcGroupId).then(() => {
						onSendButton && onSendButton(response);
					})
				)
				.then(async () => {
					setEditorState(EditorState.createEmpty());
					setComposerText('');
					composerRef.current?.clear();
					await clearDraftMessage();
					setActiveInfo('');
				})
				.then(() => setIsRequestInProgress(false))
				.catch((error) => {
					setIsRequestInProgress(false);
					setActiveInfo(INFO_TYPES.MESSAGE_SEND_ERROR);
					apiPostError({
						name: error?.name || 'EnquiryMessageSendError',
						message:
							error?.message || 'Failed to send enquiry message',
						stack: error?.stack,
						level: ERROR_LEVEL_WARN
					}).then();
				});
		},
		[
			activeSession.item.id,
			encryptRoom,
			language,
			onSendButton,
			clearDraftMessage,
			setE2EEState
		]
	);

	const handleMessageSendSuccess = useCallback(() => {
		reloadSessionAfterSendIfNeeded(
			{
				isMatrixSession: resolvedChatSession.isMatrixSession,
				clientRoomId: resolvedChatSession.matrixRoomId
			},
			reloadActiveSession
		);
		onMessageSendSuccess?.();
		setEditorState(EditorState.createEmpty());
		setComposerText('');
		composerRef.current?.clear();
		setSelectedAudienceValues(
			audienceOptions.some((option) => option.value === '__all__')
				? ['__all__']
				: audienceOptions[0]?.value
					? [audienceOptions[0].value]
					: ['__all__']
		);
		setIsAudienceMenuOpen(false);
		clearDraftMessage();
		setActiveInfo('');
		// Force reset to default height after clearing - use multiple timeouts to ensure DOM updates
		setTimeout(() => {
			resizeTextarea();
		}, 0);
		setTimeout(() => {
			resizeTextarea();
		}, 50);
		setTimeout(() => {
			resizeTextarea();
		}, 100);
		setTimeout(() => {
			resizeTextarea();
		}, 200);
		setTimeout(() => setIsRequestInProgress(false), 1200);
	}, [
		audienceOptions,
		clearDraftMessage,
		onMessageSendSuccess,
		reloadActiveSession,
		resolvedChatSession.isMatrixSession,
		resolvedChatSession.matrixRoomId,
		resizeTextarea
	]);

	const sendMessage = useCallback(
		async (message, attachment: File, isEncrypted, isAside = false) => {
			const sendToRoomWithId = activeSession.rid || activeSession.item.id;
			// Determine if this is a Matrix-backed session.
			// Some sessions still have a legacy rid while exposing matrixRoomId.
			const isMatrixSession = resolvedChatSession.isMatrixSession;
			const matrixSessionId = isMatrixSession
				? Number(resolvedChatSession.sessionId) || undefined
				: undefined;
			const clientRoomId = isMatrixSession
				? resolvedChatSession.matrixRoomId
				: undefined;
			// ADR-008: aside messages (supervisor feedback / explicit VISIBLE_TO)
			// go to the supervision side room, never the client-facing room.
			const asideRouting = resolveAsideTargetRoomId({
				isAside,
				clientRoomId,
				supervisionRoomId
			});
			if (asideRouting.abort) {
				// An aside with no side room must never leak into the client
				// room — abort the send and surface an error instead.
				setIsRequestInProgress(false);
				handleAttachmentUploadError(INFO_TYPES.ATTACHMENT_OTHER_ERROR);
				apiPostError({
					name: 'SupervisionAsideRoutingError',
					message:
						'Aside message has no supervision side room id; send aborted to avoid leaking into the client room',
					level: ERROR_LEVEL_WARN
				}).then();
				return;
			}
			const matrixRoomId = asideRouting.targetRoomId ?? undefined;
			const getSendMailNotificationStatus = () => !activeSession.isGroup;

			// Editing (m.replace, #435): replaces the target event's content;
			// no attachments, prefixes, or reply/thread relations apply.
			if (editingMessage) {
				if (!matrixRoomId) {
					setIsRequestInProgress(false);
					apiPostError({
						name: 'MatrixMessageEditError',
						message:
							'Cannot edit message: session has no Matrix room',
						level: ERROR_LEVEL_WARN
					}).then();
					return;
				}
				await chatTransportService
					.editTextMessage({
						matrixRoomId,
						targetEventId: editingMessage.eventId,
						message
					})
					.then(() => {
						onSendButton && onSendButton();
						handleMessageSendSuccess();
						onCancelEdit && onCancelEdit();
					})
					.catch((error) => {
						setIsRequestInProgress(false);
						apiPostError({
							name: error?.name || 'MatrixMessageEditError',
							message:
								error?.message ||
								'Failed to edit Matrix chat message',
							stack: error?.stack,
							level: ERROR_LEVEL_WARN
						}).then();
					});
				return;
			}

			if (attachment) {
				// Matrix attachments stay on the SDK media path.
				if (matrixSessionId) {
					try {
						if (!matrixRoomId) {
							throw new Error('Matrix room ID is missing');
						}

						const abortController = new AbortController();
						setAttachmentUpload({
							abort: () => abortController.abort()
						});

						await apiSendMatrixAttachmentMessage(
							matrixRoomId,
							attachment,
							{
								abortController,
								uploadProgress: setUploadProgress,
								threadRootId: threadRootId || null,
								supervisorMessage: !!isSupervisor,
								senderDisplayName:
									userData?.displayName ||
									userData?.userName ||
									`${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() ||
									'User'
							}
						);
					} catch (error: any) {
						const status =
							error?.status ||
							error?.httpStatus ||
							error?.statusCode;
						if (status === 413) {
							handleAttachmentUploadError(
								INFO_TYPES.ATTACHMENT_SIZE_ERROR
							);
						} else if (status === 415) {
							handleAttachmentUploadError(
								INFO_TYPES.ATTACHMENT_FORMAT_ERROR
							);
						} else {
							handleAttachmentUploadError(
								INFO_TYPES.ATTACHMENT_OTHER_ERROR
							);
						}
						return;
					}
				} else {
					// Sessions without a Matrix room cannot receive
					// attachments anymore (legacy Rocket.Chat upload removed).
					handleAttachmentUploadError(
						INFO_TYPES.ATTACHMENT_OTHER_ERROR
					);
					return;
				}
			}

			// For Matrix: if we uploaded an attachment, the message was already sent with it
			// Only send a separate text message if there's text and no attachment
			const hasTextContent = hasMessageContent(getTypedMarkdownMessage());
			const shouldSendTextMessage =
				hasTextContent && (!attachment || !matrixSessionId);

			if (shouldSendTextMessage) {
				// Intentional mentions (#435): read from the composer's own
				// HTML (mention pills carry data-mention-matrix-id there)
				// before it is cleared by handleMessageSendSuccess.
				const mentionedUserIds = extractMentionedUserIds(
					composerRef.current?.getHTML()
				);
				// MATRIX MIGRATION: For group chats, Matrix room ID is in activeSession.rid
				await apiSendMessage(
					message,
					sendToRoomWithId,
					getSendMailNotificationStatus() && !attachment,
					isEncrypted,
					matrixSessionId,
					matrixRoomId, // Pass Matrix room ID for SDK sending
					threadRootId || null,
					!!isSupervisor,
					userData?.displayName ||
						userData?.userName ||
						`${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() ||
						'User',
					matrixClientService,
					replyTo?.eventId || null,
					mentionedUserIds
				)
					.then(() => encryptRoom(setE2EEState))
					.then(() => {
						onSendButton && onSendButton();
						handleMessageSendSuccess();
						cleanupAttachment();
						// Reply context is consumed by the send (#435).
						onCancelReply && onCancelReply();
					})
					.catch((error) => {
						setIsRequestInProgress(false);
						apiPostError({
							name: error?.name || 'MatrixMessageSendError',
							message:
								error?.message ||
								'Failed to send Matrix chat message',
							stack: error?.stack,
							level: ERROR_LEVEL_WARN
						}).then();
					});
			} else {
				// Matrix file upload already sent the message
				onSendButton && onSendButton();
				handleMessageSendSuccess();
				cleanupAttachment();
				setIsRequestInProgress(false);
			}
		},
		[
			activeSession,
			cleanupAttachment,
			encryptRoom,
			getTypedMarkdownMessage,
			hasMessageContent,
			handleAttachmentUploadError,
			handleMessageSendSuccess,
			isSupervisor,
			matrixClientService,
			onSendButton,
			resolvedChatSession,
			setE2EEState,
			supervisionRoomId,
			threadRootId,
			replyTo?.eventId,
			onCancelReply,
			editingMessage,
			onCancelEdit,
			userData?.displayName,
			userData?.firstName,
			userData?.lastName,
			userData?.userName
		]
	);

	const prepareAndSendMessage = useCallback(async () => {
		const attachmentInput: any = attachmentInputRef.current;
		const selectedFile = attachmentInput && attachmentInput.files[0];
		const attachment = preselectedFile || selectedFile;

		const currentTypedMessage = getTypedMarkdownMessage();
		if (
			getPlainTextFromComposerValue(currentTypedMessage).length >
			INPUT_MAX_LENGTH
		) {
			return null;
		}

		if (hasMessageContent(currentTypedMessage) || attachment) {
			setIsRequestInProgress(true);
		} else {
			return null;
		}

		let message = encodeAlignmentForTransport(
			encodeHighlightColorsForTransport(currentTypedMessage)
		).trim();
		const prefixParts: string[] = [];
		// Relations foundation (#435): thread membership travels as the
		// MSC3440 m.thread relation on the event (see chatTransportService),
		// not as a [THREAD:...] text prefix anymore. Old messages with the
		// prefix keep rendering via the legacy parse fallback.
		// VISIBLE_TO recipient targeting is an opt-in supervisor/coordinator aside
		// (ADR-008) and only exists when the audience selector is actually shown —
		// i.e. there is more than one human counterpart (group / supervision). In a
		// 1:1 conversation the selector is hidden, so a reply must never carry a
		// VISIBLE_TO prefix, regardless of any stale selection state.
		const humanTargetCount = audienceOptions.filter(
			(option) => option.value !== '__all__'
		).length;
		const explicitAudience = selectedAudienceValues.filter(
			(value) => value !== '__all__'
		);
		const hasExplicitAudience =
			humanTargetCount > 1 && explicitAudience.length > 0;
		if (hasExplicitAudience) {
			prefixParts.push(buildVisibleToPrefix(explicitAudience));
		}
		if (isSupervisor) {
			prefixParts.push(SUPERVISOR_FEEDBACK_PREFIX);
		}
		// ADR-008: any message carrying an aside (supervisor feedback OR an
		// explicit VISIBLE_TO audience) must be routed to the supervision side
		// room, never the client-facing room.
		const isAside = Boolean(isSupervisor) || hasExplicitAudience;
		if (prefixParts.length && message.length > 0) {
			message = `${prefixParts.join(' ')} ${message}`;
		}
		// Legacy Rocket.Chat client-side message encryption is removed;
		// Matrix messages go through the SDK path unencrypted (ADR-004).
		const isEncrypted = false;

		if (isAskerEnquiry) {
			await sendEnquiry(message, isEncrypted);
			return;
		}

		// Shortcut: edit an existing message via Matrix m.replace
		if (editingMessageId) {
			const matrixRoomId = resolvedChatSession.matrixRoomId;
			if (matrixRoomId && matrixClientService) {
				try {
					await matrixClientService.editMessage(
						matrixRoomId,
						editingMessageId,
						getPlainTextFromComposerValue(message) || message
					);
					onLocalMessageEdit?.(editingMessageId, message);
				} catch {
					// Editing failed silently — fall through to clear state
				}
			}
			setEditingMessageId(null);
			setIsRequestInProgress(false);
			composerRef.current?.clear();
			setComposerText('');
			return;
		}

		await sendMessage(message, attachment, isEncrypted, isAside);
	}, [
		editingMessageId,
		encodeAlignmentForTransport,
		encodeHighlightColorsForTransport,
		getTypedMarkdownMessage,
		hasMessageContent,
		isAskerEnquiry,
		matrixClientService,
		onLocalMessageEdit,
		preselectedFile,
		resolvedChatSession,
		sendEnquiry,
		sendMessage,
		selectedAudienceValues,
		audienceOptions,
		isSupervisor
	]);

	const handleButtonClick = useCallback(() => {
		if (uploadProgress || isRequestInProgress) {
			return null;
		}
		if (isVoiceRecording) {
			stopVoiceRecording({ sendAfterStop: true });
			return null;
		}
		if (
			getPlainTextFromComposerValue(getTypedMarkdownMessage()).length >
			INPUT_MAX_LENGTH
		) {
			return null;
		}

		if (isSessionArchived) {
			apiPutDearchive(activeSession.item.id)
				.then(prepareAndSendMessage)
				.then(() => {
					reloadActiveSession();
					if (
						!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)
					) {
						// Short timeout to wait for RC events finished
						setTimeout(() => {
							if (window.innerWidth >= 900) {
								navigate(
									`${listPath}/${activeSession.item.groupId}/${activeSession.item.id}`
								);
							} else {
								mobileListView();
								navigate(listPath);
							}
						}, 1000);
					}
				})
				.catch((error) => {
					// console.error(error);
				});
		} else {
			prepareAndSendMessage().then();
		}
	}, [
		activeSession.item.groupId,
		activeSession.item.id,
		getTypedMarkdownMessage,
		navigate,
		isRequestInProgress,
		isVoiceRecording,
		isSessionArchived,
		listPath,
		prepareAndSendMessage,
		reloadActiveSession,
		stopVoiceRecording,
		uploadProgress,
		userData
	]);

	const handleFormSubmit = useCallback(
		(event: React.FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			handleButtonClick();
		},
		[handleButtonClick]
	);

	const handleAttachmentSelect = useCallback(() => {
		const attachmentInput: any = attachmentInputRef.current;
		attachmentInput.click();
	}, []);

	const displayAttachmentToUpload = useCallback((attachment: File) => {
		setAttachmentSelected(attachment);
		setActiveInfo('');
		// Clear any existing text in the input when attachment is selected
		setEditorState(EditorState.createEmpty());
		setComposerText('');
		composerRef.current?.clear();
	}, []);

	const handleLargeAttachments = useCallback(() => {
		removeSelectedAttachment();
		setActiveInfo(INFO_TYPES.ATTACHMENT_SIZE_ERROR);
	}, [removeSelectedAttachment]);

	const handleAttachmentChange = useCallback(() => {
		const attachmentInput: any = attachmentInputRef.current;
		const attachment = attachmentInput.files[0];
		const attachmentSizeMB = getAttachmentSizeMBForKB(attachment.size);
		attachmentSizeMB > ATTACHMENT_MAX_SIZE_IN_MB
			? handleLargeAttachments()
			: displayAttachmentToUpload(attachment);
	}, [displayAttachmentToUpload, handleLargeAttachments]);

	const handlePreselectedAttachmentChange = useCallback(() => {
		const attachment = preselectedFile;
		const attachmentSizeMB = getAttachmentSizeMBForKB(attachment.size);
		attachmentSizeMB > ATTACHMENT_MAX_SIZE_IN_MB
			? handleLargeAttachments()
			: displayAttachmentToUpload(attachment);
	}, [displayAttachmentToUpload, handleLargeAttachments, preselectedFile]);

	useEffect(() => {
		if (!preselectedFile) return;
		handlePreselectedAttachmentChange();
	}, [handlePreselectedAttachmentChange, preselectedFile]);

	useEffect(() => {
		return () => {
			cleanupVoiceRecorder();
		};
	}, [cleanupVoiceRecorder]);

	const handleAttachmentRemoval = useCallback(() => {
		if (uploadProgress && attachmentUpload) {
			attachmentUpload.abort();
			setTimeout(() => setIsRequestInProgress(false), 1200);
		}
		setActiveInfo('');
		cleanupAttachment();
	}, [attachmentUpload, cleanupAttachment, uploadProgress]);

	const getMessageSubmitInfo = useCallback((): MessageSubmitInfoInterface => {
		let infoData;
		if (activeInfo === INFO_TYPES.ABSENT) {
			const contact = getContact(activeSession);
			infoData = {
				isInfo: true,
				infoHeadline: `${
					contact?.displayName ||
					contact?.username ||
					translate('sessionList.user.consultantUnknown')
				} ${translate('consultant.absent.message')} `,
				infoMessage: activeSession.consultant.absenceMessage
			};
		} else if (activeInfo === INFO_TYPES.ATTACHMENT_SIZE_ERROR) {
			infoData = {
				isInfo: false,
				infoHeadline: translate('attachments.error.size.headline'),
				infoMessage: translate('attachments.error.size.message', {
					attachment_filesize: ATTACHMENT_MAX_SIZE_IN_MB
				})
			};
		} else if (activeInfo === INFO_TYPES.ATTACHMENT_FORMAT_ERROR) {
			infoData = {
				isInfo: false,
				infoHeadline: translate('attachments.error.format.headline'),
				infoMessage: translate('attachments.error.format.message')
			};
		} else if (activeInfo === INFO_TYPES.ATTACHMENT_QUOTA_REACHED_ERROR) {
			infoData = {
				isInfo: false,
				infoHeadline: translate('attachments.error.quota.headline'),
				infoMessage: translate('attachments.error.quota.message')
			};
		} else if (activeInfo === INFO_TYPES.ATTACHMENT_OTHER_ERROR) {
			infoData = {
				isInfo: false,
				infoHeadline: translate('attachments.error.other.headline'),
				infoMessage: translate('attachments.error.other.message')
			};
		} else if (activeInfo === INFO_TYPES.MESSAGE_SEND_ERROR) {
			infoData = {
				isInfo: false,
				infoHeadline: translate('statusOverlay.error.headline'),
				infoMessage: translate('statusOverlay.error.text')
			};
		} else if (activeInfo === INFO_TYPES.VOICE_RECORDING_ERROR) {
			infoData = {
				isInfo: false,
				infoHeadline: translate(
					'voice.recording.error.headline',
					'Voice recording is unavailable'
				),
				infoMessage: translate(
					'voice.recording.error.message',
					'Please allow microphone access and try again.'
				)
			};
		} else if (activeInfo === INFO_TYPES.ARCHIVED) {
			infoData = {
				isInfo: true,
				infoHeadline: translate('archive.submitInfo.headline'),
				infoMessage: translate('archive.submitInfo.message')
			};
		}

		return infoData;
	}, [activeInfo, activeSession, translate]);

	const handleBookingButton = useCallback(() => {
		navigate('/booking/');
	}, [navigate]);

	const hasUploadFunctionality =
		!isAskerEnquiry && !tenant?.settings?.featureAttachmentUploadDisabled;
	const currentChatType: 'anonymous' | 'oneOnOne' | 'group' | 'supervision' =
		isSupervisor
			? 'supervision'
			: activeSession.isGroup
				? 'group'
				: isAnonymousChat
					? 'anonymous'
					: 'oneOnOne';
	const {
		featureVoiceMessagesEnabled = true,
		featureVoiceMessagesAnonymousChatsEnabled = true,
		featureVoiceMessagesOneOnOneChatsEnabled = true,
		featureVoiceMessagesGroupChatsEnabled = true,
		featureVoiceMessagesSupervisionChatsEnabled = true
	} = tenant?.settings || {};
	const isVoiceMessageEnabledForCurrentChat =
		featureVoiceMessagesEnabled !== false &&
		(currentChatType === 'anonymous'
			? featureVoiceMessagesAnonymousChatsEnabled !== false
			: currentChatType === 'group'
				? featureVoiceMessagesGroupChatsEnabled !== false
				: currentChatType === 'supervision'
					? featureVoiceMessagesSupervisionChatsEnabled !== false
					: featureVoiceMessagesOneOnOneChatsEnabled !== false);

	const getMatrixRoomId = useCallback(
		() => resolvedChatSession.matrixRoomId || null,
		[resolvedChatSession]
	);

	const deriveLabelFromUserId = useCallback((rawUserId: string) => {
		if (!rawUserId) {
			return '';
		}
		const compact = rawUserId.trim();
		if (compact.startsWith('@')) {
			const username = compact.split(':')[0].replace('@', '');
			return username || compact;
		}
		return compact;
	}, []);

	const formatAudiencePersonLabel = useCallback(
		(rawLabel?: string, rawUserId?: string) => {
			const source = (rawLabel || '').trim();
			const fallback = deriveLabelFromUserId(rawUserId || rawLabel || '');
			const normalized = source || fallback;
			if (!normalized) {
				return '';
			}

			const sanitized = normalized
				.replace(/^@/, '')
				.split(':')[0]
				.trim()
				.replace(/\s+/g, ' ');
			const parts = sanitized.split(' ').filter(Boolean);
			if (parts.length < 2) {
				return sanitized;
			}

			const firstInitial = parts[0].charAt(0).toUpperCase();
			const lastNameRaw = parts[parts.length - 1];
			const lastName =
				lastNameRaw.charAt(0).toUpperCase() + lastNameRaw.slice(1);
			return `${firstInitial}. ${lastName}`;
		},
		[deriveLabelFromUserId]
	);

	const getComparableAudienceIds = useCallback((rawValue?: string | null) => {
		const compact = (rawValue || '').trim().toLowerCase();
		if (!compact) {
			return new Set<string>();
		}
		const ids = new Set<string>();
		const addVariants = (value: string) => {
			const normalized = (value || '').trim().toLowerCase();
			if (!normalized) {
				return;
			}
			ids.add(normalized);
			ids.add(normalized.replace(/\s+/g, ''));
			ids.add(normalized.replace(/[^a-z0-9]/gi, ''));
			normalized
				.split(/[^a-z0-9]+/gi)
				.filter(Boolean)
				.filter((token) => token.length >= 4 && token !== 'enc')
				.forEach((token) => ids.add(token));
			const consultantTokenMatches =
				normalized.match(/consultant\d+/gi) || [];
			consultantTokenMatches.forEach((token) =>
				ids.add(token.toLowerCase())
			);
		};
		addVariants(compact);
		const withoutAt = compact.startsWith('@') ? compact.slice(1) : compact;
		const localPart = withoutAt.split(':')[0];
		addVariants(withoutAt);
		addVariants(localPart);
		ids.add(`@${withoutAt}`);
		if (localPart) {
			ids.add(`@${localPart}`);
		}
		return ids;
	}, []);

	useEffect(() => {
		setAudienceRefreshTick((prev) => prev + 1);
		const timeoutA = window.setTimeout(
			() => setAudienceRefreshTick((prev) => prev + 1),
			700
		);
		const timeoutB = window.setTimeout(
			() => setAudienceRefreshTick((prev) => prev + 1),
			1800
		);
		return () => {
			window.clearTimeout(timeoutA);
			window.clearTimeout(timeoutB);
		};
	}, [activeSession?.item?.id, threadRootId]);

	useEffect(() => {
		const sessionId = Number(activeSession?.item?.id);
		const hasAskerAuthority = hasUserAuthority(
			AUTHORITIES.ASKER_DEFAULT,
			userData
		);
		const hasConsultantAuthority = hasUserAuthority(
			AUTHORITIES.CONSULTANT_DEFAULT,
			userData
		);
		const isAskerOnly = hasAskerAuthority && !hasConsultantAuthority;
		if (isAskerOnly || isAnonymousChat) {
			setSessionSupervisors([]);
			return;
		}
		if (!sessionId || Number.isNaN(sessionId)) {
			setSessionSupervisors([]);
			return;
		}
		let cancelled = false;
		apiGetSessionSupervisors(sessionId)
			.then((supervisors) => {
				if (cancelled) {
					return;
				}
				const mapped = (Array.isArray(supervisors) ? supervisors : [])
					.map((entry) => ({
						id: `${entry?.supervisorConsultantId || ''}`.trim(),
						username: `${entry?.supervisorUsername || ''}`.trim()
					}))
					.filter((entry) => entry.id || entry.username);
				setSessionSupervisors(mapped);
			})
			.catch(() => {
				if (cancelled) {
					return;
				}
				setSessionSupervisors([]);
			});
		return () => {
			cancelled = true;
		};
	}, [activeSession?.item?.id, isAnonymousChat, userData]);

	useEffect(() => {
		const agencyId =
			`${activeSession?.item?.agencyId || activeSession?.agency?.id || ''}`.trim();
		const hasAskerAuthority = hasUserAuthority(
			AUTHORITIES.ASKER_DEFAULT,
			userData
		);
		const hasConsultantAuthority = hasUserAuthority(
			AUTHORITIES.CONSULTANT_DEFAULT,
			userData
		);
		const isAskerOnly = hasAskerAuthority && !hasConsultantAuthority;
		if (isAskerOnly || isAnonymousChat) {
			setAgencyConsultantDirectory(new Map());
			return;
		}
		if (!agencyId) {
			setAgencyConsultantDirectory(new Map());
			return;
		}
		let cancelled = false;
		apiGetAgencyConsultantList(agencyId)
			.then((consultants) => {
				if (cancelled) {
					return;
				}
				const nextDirectory = new Map<
					string,
					{ displayName: string; username: string }
				>();
				(Array.isArray(consultants) ? consultants : []).forEach(
					(consultant) => {
						const consultantId =
							`${consultant?.consultantId || ''}`.trim();
						if (!consultantId) {
							return;
						}
						const displayName =
							`${consultant?.displayName || ''}`.trim();
						const fallbackName = `${consultant?.firstName || ''} ${
							consultant?.lastName || ''
						}`
							.trim()
							.replace(/\s+/g, ' ');
						const username = `${consultant?.username || ''}`.trim();
						nextDirectory.set(consultantId, {
							displayName:
								displayName ||
								fallbackName ||
								username ||
								consultantId,
							username
						});
					}
				);
				setAgencyConsultantDirectory(nextDirectory);
			})
			.catch(() => {
				if (cancelled) {
					return;
				}
				setAgencyConsultantDirectory(new Map());
			});
		return () => {
			cancelled = true;
		};
	}, [
		activeSession?.item?.agencyId,
		activeSession?.agency?.id,
		isAnonymousChat,
		userData
	]);

	useEffect(() => {
		const defaultOption = {
			value: '__all__',
			label: translate('message.audience.sendToAll', 'Send to all')
		};
		const isInquiryNotAccepted =
			type === SESSION_LIST_TYPES.ENQUIRY ||
			activeSession?.item?.status === STATUS_ENQUIRY;
		if (isInquiryNotAccepted) {
			setAudienceOptions([defaultOption]);
			setSelectedAudienceValues(['__all__']);
			return;
		}
		const collected = new Map<string, string>();
		const selfIdentifiers = new Set<string>();
		const matrixUserIdFromCookie =
			typeof document !== 'undefined'
				? document.cookie
						.split('; ')
						.find((entry) => entry.startsWith('rc_uid='))
						?.split('=')[1] || ''
				: '';
		[
			matrixUserIdFromCookie,
			userData?.userName,
			userData?.displayName
		].forEach((rawValue) => {
			getComparableAudienceIds(rawValue).forEach((id) =>
				selfIdentifiers.add(id)
			);
		});
		const roomId = getMatrixRoomId();
		const matrixClient = matrixClientService?.getClient?.();
		const room =
			roomId && matrixClient ? matrixClient.getRoom(roomId) : null;
		const roomMembers =
			room?.getMembers?.() || room?.getJoinedMembers?.() || [];
		const restrictToSupervisionAudience = sessionSupervisors.length > 0;
		const supervisorLabelByComparableId = new Map<string, string>();
		sessionSupervisors.forEach((supervisor) => {
			const mappedConsultant = agencyConsultantDirectory.get(
				supervisor.id
			);
			const preferredLabel = `${
				mappedConsultant?.displayName ||
				supervisor.username ||
				supervisor.id
			}`.trim();
			if (!preferredLabel) {
				return;
			}
			[supervisor.id, supervisor.username].forEach((rawValue) => {
				getComparableAudienceIds(rawValue).forEach((id) => {
					if (!supervisorLabelByComparableId.has(id)) {
						supervisorLabelByComparableId.set(id, preferredLabel);
					}
				});
			});
		});

		roomMembers.forEach((member: any) => {
			if (restrictToSupervisionAudience) {
				return;
			}
			const memberId = `${member?.userId || ''}`.trim();
			if (!memberId) {
				return;
			}
			if (
				memberId.includes('@system') ||
				memberId.includes('@caritas.local') ||
				// Agency provisioning/service bots (@agency-<id>-service) are not
				// human recipients — never offer them as an audience target.
				/^@agency-\d+-service:/.test(memberId)
			) {
				return;
			}
			const memberComparableIds = getComparableAudienceIds(memberId);
			const isSelf = Array.from(memberComparableIds).some((id) =>
				selfIdentifiers.has(id)
			);
			if (isSelf) {
				return;
			}
			const memberName = `${member?.name || ''}`.trim();
			if (
				memberName.toLowerCase().startsWith('enc.') &&
				!Array.from(memberComparableIds).some((id) =>
					supervisorLabelByComparableId.has(id)
				)
			) {
				return;
			}
			const supervisorLabel = Array.from(memberComparableIds)
				.map((id) => supervisorLabelByComparableId.get(id))
				.find(Boolean);
			collected.set(
				memberId,
				formatAudiencePersonLabel(
					supervisorLabel || memberName,
					supervisorLabel || memberId
				)
			);
		});

		const addAudienceCandidate = (
			rawId: string,
			fallbackLabel?: string
		) => {
			const compactId = `${rawId || ''}`.trim();
			if (!compactId) {
				return;
			}
			const comparableIds = getComparableAudienceIds(compactId);
			const isSelf = Array.from(comparableIds).some((id) =>
				selfIdentifiers.has(id)
			);
			if (isSelf) {
				return;
			}
			if (Array.from(comparableIds).some((id) => collected.has(id))) {
				return;
			}
			const existingKey = Array.from(collected.keys()).find((key) =>
				Array.from(comparableIds).some((id) =>
					getComparableAudienceIds(key).has(id)
				)
			);
			if (existingKey) {
				return;
			}
			collected.set(
				compactId,
				formatAudiencePersonLabel(
					`${fallbackLabel || ''}`.trim(),
					compactId
				)
			);
		};
		const askerId = `${activeSession?.item?.askerRcId || ''}`.trim();
		addAudienceCandidate(askerId);
		const askerUsername = `${activeSession?.user?.username || ''}`.trim();
		addAudienceCandidate(askerUsername, askerUsername);
		if (!restrictToSupervisionAudience) {
			const consultantUsername =
				`${activeSession?.consultant?.username || ''}`.trim();
			addAudienceCandidate(
				consultantUsername,
				`${activeSession?.consultant?.displayName || consultantUsername}`.trim()
			);
			const contactUsername = `${contact?.username || ''}`.trim();
			addAudienceCandidate(contactUsername, contactUsername);
		}
		sessionSupervisors.forEach((supervisor) => {
			const mappedConsultant = agencyConsultantDirectory.get(
				supervisor.id
			);
			const supervisorLabel = `${
				mappedConsultant?.displayName ||
				supervisor.username ||
				supervisor.id
			}`.trim();
			if (supervisor.username) {
				addAudienceCandidate(supervisor.username, supervisorLabel);
			}
			if (supervisor.id.startsWith('@')) {
				addAudienceCandidate(supervisor.id, supervisorLabel);
			}
		});

		const mapped = Array.from(collected.entries())
			.map(([value, label]) => {
				const supervisorLabel = Array.from(
					getComparableAudienceIds(value)
				)
					.map((id) => supervisorLabelByComparableId.get(id))
					.find(Boolean);
				return {
					value,
					label: supervisorLabel
						? formatAudiencePersonLabel(
								supervisorLabel,
								supervisorLabel
							)
						: label
				};
			})
			.sort((a, b) => a.label.localeCompare(b.label));
		// The audience selector (and thus any VISIBLE_TO targeting) is meant for
		// group/supervision conversations with more than one human counterpart.
		// A 1:1 conversation has no real targets here (the asker is filtered out
		// by their enc.* member name), so it collapses to zero options and the
		// selector stays hidden (showAudienceSelector: audienceTargetCount <= 1).
		const includeAllOption = mapped.length > 1;
		const nextOptions = includeAllOption
			? [defaultOption, ...mapped]
			: mapped;
		setAudienceOptions(nextOptions);
		setSelectedAudienceValues((currentValues) => {
			const hasAllOption = nextOptions.some(
				(option) => option.value === '__all__'
			);
			if (hasAllOption && currentValues.includes('__all__')) {
				return ['__all__'];
			}
			const stillAvailable = currentValues.filter((value) =>
				nextOptions.some((option) => option.value === value)
			);
			if (stillAvailable.length > 0) {
				return stillAvailable;
			}
			if (includeAllOption) {
				return ['__all__'];
			}
			return nextOptions[0]?.value ? [nextOptions[0].value] : ['__all__'];
		});
	}, [
		type,
		activeSession?.item?.status,
		activeSession?.consultant?.username,
		activeSession?.consultant?.displayName,
		activeSession?.consultant?.id,
		activeSession?.item?.askerRcId,
		activeSession?.user?.username,
		activeSession?.item?.id,
		contact?.username,
		deriveLabelFromUserId,
		formatAudiencePersonLabel,
		getComparableAudienceIds,
		getMatrixRoomId,
		audienceRefreshTick,
		sessionSupervisors,
		agencyConsultantDirectory,
		currentChatType,
		activeSession?.isGroup,
		translate,
		userData?.displayName,
		userData?.userName,
		matrixClientService
	]);

	useEffect(() => {
		setIsAudienceMenuOpen(false);
		setSelectedAudienceValues((currentValues) => {
			const hasSendToAll = audienceOptions.some(
				(option) => option.value === '__all__'
			);
			if (hasSendToAll) {
				return ['__all__'];
			}
			const stillAvailable = currentValues.filter((value) =>
				audienceOptions.some((option) => option.value === value)
			);
			if (stillAvailable.length > 0) {
				return stillAvailable;
			}
			return audienceOptions[0]?.value
				? [audienceOptions[0].value]
				: ['__all__'];
		});
	}, [activeSession?.item?.id, threadRootId, audienceOptions]);

	useEffect(() => {
		if (!audienceSelectionStorageKey) {
			return;
		}
		const hasAllOption = audienceOptions.some(
			(option) => option.value === '__all__'
		);
		if (hasAllOption) {
			// Always default to "All" when available.
			setSelectedAudienceValues(['__all__']);
			return;
		}
		try {
			const saved = window.localStorage.getItem(
				audienceSelectionStorageKey
			);
			if (!saved) {
				return;
			}
			const parsed = JSON.parse(saved);
			if (!Array.isArray(parsed)) {
				return;
			}
			const valid = parsed.filter((value) =>
				audienceOptions.some((option) => option.value === value)
			);
			if (valid.length > 0) {
				setSelectedAudienceValues(valid);
			}
		} catch (_error) {
			// Ignore broken local storage values.
		}
	}, [audienceOptions, audienceSelectionStorageKey]);

	useEffect(() => {
		if (!audienceSelectionStorageKey) {
			return;
		}
		try {
			window.localStorage.setItem(
				audienceSelectionStorageKey,
				JSON.stringify(selectedAudienceValues)
			);
		} catch (_error) {
			// Ignore quota/storage exceptions.
		}
	}, [audienceSelectionStorageKey, selectedAudienceValues]);

	useEffect(() => {
		if (!isAudienceMenuOpen) {
			setAudienceOverlayBounds(null);
			return;
		}
		const handleOutsideClick = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (!target) {
				return;
			}
			if (!audienceMenuRef.current?.contains(target)) {
				setIsAudienceMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', handleOutsideClick);
		return () =>
			document.removeEventListener('mousedown', handleOutsideClick);
	}, [isAudienceMenuOpen]);
	useEffect(() => {
		if (!isAudienceMenuOpen) {
			return;
		}
		const updateAudienceOverlayBounds = () => {
			const sessionElement = audienceMenuRef.current?.closest(
				'.session'
			) as HTMLElement | null;
			if (!sessionElement) {
				setAudienceOverlayBounds(null);
				return;
			}
			const rect = sessionElement.getBoundingClientRect();
			const computedStyle = window.getComputedStyle(sessionElement);
			setAudienceOverlayBounds({
				top: rect.top,
				left: rect.left,
				width: rect.width,
				height: rect.height,
				borderRadius: computedStyle.borderRadius || '0px'
			});
		};
		updateAudienceOverlayBounds();
		window.addEventListener('resize', updateAudienceOverlayBounds);
		window.addEventListener('scroll', updateAudienceOverlayBounds, true);
		return () => {
			window.removeEventListener('resize', updateAudienceOverlayBounds);
			window.removeEventListener(
				'scroll',
				updateAudienceOverlayBounds,
				true
			);
		};
	}, [isAudienceMenuOpen]);

	const selectedAudienceLabels = useMemo(() => {
		const isAllSelected =
			selectedAudienceValues.length === 0 ||
			selectedAudienceValues.includes('__all__');
		if (isAllSelected) {
			return [translate('message.audience.sendToAll', 'Send to all')];
		}
		const labels = selectedAudienceValues
			.map(
				(value) =>
					audienceOptions.find((option) => option.value === value)
						?.label || value
			)
			.filter(Boolean);
		return Array.from(new Set(labels));
	}, [audienceOptions, selectedAudienceValues, translate]);
	const isClientUser = useMemo(() => {
		const hasAskerAuthority = hasUserAuthority(
			AUTHORITIES.ASKER_DEFAULT,
			userData
		);
		const hasConsultantAuthority = hasUserAuthority(
			AUTHORITIES.CONSULTANT_DEFAULT,
			userData
		);
		// "Client" here means pure asker only; consultant/supervisor views must keep Send-to available.
		return hasAskerAuthority && !hasConsultantAuthority;
	}, [userData]);
	const audienceTargetCount = useMemo(
		() =>
			audienceOptions.filter((option) => option.value !== '__all__')
				.length,
		[audienceOptions]
	);
	const selectedAudienceChipLabel = useMemo(() => {
		const isAllSelected =
			selectedAudienceValues.length === 0 ||
			selectedAudienceValues.includes('__all__');
		if (isAllSelected) {
			return translate('message.audience.all', 'Alle');
		}
		if (selectedAudienceLabels.length === 1) {
			return selectedAudienceLabels[0];
		}
		return translate('message.audience.multiCount', '{{count}} Personen', {
			count: selectedAudienceLabels.length,
			defaultValue: `${selectedAudienceLabels.length} Personen`
		});
	}, [selectedAudienceLabels, selectedAudienceValues, translate]);
	const showAudienceSelector = useMemo(() => {
		if (isClientUser) {
			return false;
		}
		if (audienceTargetCount <= 1) {
			return false;
		}
		return audienceOptions.some((option) => option.value === '__all__');
	}, [audienceOptions, audienceTargetCount, isClientUser]);
	const selectedAudienceIcon = useMemo(() => {
		const isAllSelected =
			selectedAudienceValues.length === 0 ||
			selectedAudienceValues.includes('__all__');
		if (isAllSelected || selectedAudienceValues.length > 1) {
			return <AudienceAllMultiIcon />;
		}
		const selectedValue = selectedAudienceValues[0];
		const normalizedValue = `${selectedValue || ''}`.toLowerCase();
		const selectedLabel =
			`${selectedAudienceLabels[0] || ''}`.toLowerCase();
		const looksLikeModerator =
			normalizedValue.includes('moderator') ||
			normalizedValue.includes('supervisor') ||
			selectedLabel.includes('moderator') ||
			selectedLabel.includes('supervisor');
		const looksLikeConsultant =
			normalizedValue.includes('consultant') ||
			selectedLabel.includes('consultant') ||
			selectedLabel.includes('counsellor') ||
			selectedLabel.includes('counselor') ||
			selectedLabel.includes('berater');
		if (looksLikeModerator) {
			return <AudienceModeratorIcon />;
		}
		return looksLikeConsultant ? (
			<AudienceSingleConsultantIcon />
		) : (
			<AudienceSingleUserIcon />
		);
	}, [selectedAudienceLabels, selectedAudienceValues]);
	const isMultiAudienceSelection = useMemo(() => {
		const explicitAudience = selectedAudienceValues.filter(
			(value) => value !== '__all__'
		);
		return explicitAudience.length > 1;
	}, [selectedAudienceValues]);
	const isAllAudienceChip = useMemo(
		() =>
			selectedAudienceValues.length === 0 ||
			selectedAudienceValues.includes('__all__'),
		[selectedAudienceValues]
	);
	const isAllAudienceSelectedInMenu = useMemo(
		() =>
			selectedAudienceValues.length === 0 ||
			selectedAudienceValues.includes('__all__'),
		[selectedAudienceValues]
	);
	const audienceSelfComparableIds = useMemo(() => {
		const ids = new Set<string>();
		[userData?.userName, userData?.displayName].forEach((rawValue) => {
			getComparableAudienceIds(rawValue).forEach((id) => ids.add(id));
		});
		return ids;
	}, [getComparableAudienceIds, userData?.displayName, userData?.userName]);
	const audienceSelectableOptions = useMemo(
		() => audienceOptions.filter((option) => option.value !== '__all__'),
		[audienceOptions]
	);
	const audienceSupervisorComparableIds = useMemo(() => {
		const ids = new Set<string>();
		const moderatorIds = Array.isArray(activeSession?.item?.moderators)
			? activeSession.item.moderators
			: [];
		[
			...moderatorIds,
			...sessionSupervisors.map((entry) => entry.id),
			...sessionSupervisors.map((entry) => entry.username)
		].forEach((rawValue) => {
			getComparableAudienceIds(rawValue).forEach((id) => ids.add(id));
		});
		return ids;
	}, [
		activeSession?.item?.moderators,
		getComparableAudienceIds,
		sessionSupervisors
	]);
	const audienceGroupedSections = useMemo(() => {
		const clientsComparable = new Set<string>();
		const counsellorsComparable = new Set<string>();
		[activeSession?.item?.askerRcId, activeSession?.user?.username].forEach(
			(rawValue) => {
				getComparableAudienceIds(rawValue).forEach((id) =>
					clientsComparable.add(id)
				);
			}
		);
		[
			activeSession?.consultant?.id,
			activeSession?.consultant?.username,
			activeSession?.consultant?.displayName
		].forEach((rawValue) => {
			getComparableAudienceIds(rawValue).forEach((id) =>
				counsellorsComparable.add(id)
			);
		});

		const grouped = {
			clients: [] as Array<{
				value: string;
				label: string;
				disabled: boolean;
			}>,
			counsellors: [] as Array<{
				value: string;
				label: string;
				disabled: boolean;
			}>,
			moderators: [] as Array<{
				value: string;
				label: string;
				disabled: boolean;
			}>
		};
		audienceSelectableOptions.forEach((option) => {
			const comparableIds = new Set<string>([
				...Array.from(getComparableAudienceIds(option.value)),
				...Array.from(getComparableAudienceIds(option.label)),
				...Array.from(
					getComparableAudienceIds(
						deriveLabelFromUserId(option.value)
					)
				)
			]);
			const disabled = Array.from(comparableIds).some((id) =>
				audienceSelfComparableIds.has(id)
			);
			const isClient = Array.from(comparableIds).some((id) =>
				clientsComparable.has(id)
			);
			const isModeratorByRole = Array.from(comparableIds).some((id) =>
				audienceSupervisorComparableIds.has(id)
			);
			if (isModeratorByRole) {
				grouped.moderators.push({ ...option, disabled });
				return;
			}
			if (isClient) {
				grouped.clients.push({ ...option, disabled });
				return;
			}
			const isCounsellorById = Array.from(comparableIds).some((id) =>
				counsellorsComparable.has(id)
			);
			if (isCounsellorById || !isClient) {
				grouped.counsellors.push({ ...option, disabled });
				return;
			}
			grouped.moderators.push({ ...option, disabled });
		});
		return grouped;
	}, [
		activeSession?.consultant?.displayName,
		activeSession?.consultant?.id,
		activeSession?.consultant?.username,
		activeSession?.item?.askerRcId,
		activeSession?.user?.username,
		audienceSelectableOptions,
		audienceSelfComparableIds,
		audienceSupervisorComparableIds,
		deriveLabelFromUserId,
		getComparableAudienceIds
	]);
	const sectionDefinitions = useMemo(
		() =>
			[
				{ key: 'clients' as const },
				{ key: 'counsellors' as const },
				{ key: 'moderators' as const }
			] as const,
		[]
	);

	const toggleAudienceSelection = useCallback((value: string) => {
		setSelectedAudienceValues((previousValues) => {
			if (value === '__all__') {
				return ['__all__'];
			}
			const withoutAll = previousValues.filter(
				(entry) => entry !== '__all__'
			);
			if (withoutAll.includes(value)) {
				const nextValues = withoutAll.filter(
					(entry) => entry !== value
				);
				return nextValues.length > 0 ? nextValues : ['__all__'];
			}
			return [...withoutAll, value];
		});
	}, []);
	const toggleAudienceSectionExpanded = useCallback(
		(sectionKey: 'clients' | 'counsellors' | 'moderators') => {
			setExpandedAudienceSections((previousValue) => ({
				...previousValue,
				[sectionKey]: !previousValue[sectionKey]
			}));
		},
		[]
	);
	const toggleAudienceSectionSelectAll = useCallback(
		(sectionKey: 'clients' | 'counsellors' | 'moderators') => {
			const sectionValues = audienceGroupedSections[sectionKey]
				.filter((entry) => !entry.disabled)
				.map((entry) => entry.value);
			if (sectionValues.length === 0) {
				return;
			}
			setSelectedAudienceValues((previousValues) => {
				const allVisibleValues = [
					...audienceGroupedSections.clients,
					...audienceGroupedSections.counsellors,
					...audienceGroupedSections.moderators
				]
					.filter((entry) => !entry.disabled)
					.map((entry) => entry.value);
				const withoutAll = previousValues.includes('__all__')
					? allVisibleValues
					: previousValues.filter((value) => value !== '__all__');
				const hasAllSelected = sectionValues.every((value) =>
					withoutAll.includes(value)
				);
				if (hasAllSelected) {
					const nextValues = withoutAll.filter(
						(value) => !sectionValues.includes(value)
					);
					return nextValues.length > 0 ? nextValues : ['__all__'];
				}
				const nextValues = Array.from(
					new Set([...withoutAll, ...sectionValues])
				);
				const isEverythingSelected =
					allVisibleValues.length > 0 &&
					allVisibleValues.every((value) =>
						nextValues.includes(value)
					);
				return isEverythingSelected ? ['__all__'] : nextValues;
			});
		},
		[audienceGroupedSections]
	);

	const startVoiceRecording = useCallback(async () => {
		if (
			!hasUploadFunctionality ||
			!isVoiceMessageEnabledForCurrentChat ||
			attachmentSelected ||
			uploadProgress
		) {
			return;
		}
		if (
			!navigator.mediaDevices?.getUserMedia ||
			typeof MediaRecorder === 'undefined'
		) {
			setActiveInfo(INFO_TYPES.VOICE_RECORDING_ERROR);
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true
			});
			mediaStreamRef.current = stream;
			const mimeTypeCandidates = [
				'audio/webm;codecs=opus',
				'audio/ogg;codecs=opus',
				'audio/webm'
			];
			const supportedMimeType = mimeTypeCandidates.find((mimeType) =>
				MediaRecorder.isTypeSupported(mimeType)
			);
			const recorder = supportedMimeType
				? new MediaRecorder(stream, { mimeType: supportedMimeType })
				: new MediaRecorder(stream);
			const chunks: BlobPart[] = [];

			recorder.ondataavailable = (event: BlobEvent) => {
				if (event.data && event.data.size > 0) {
					chunks.push(event.data);
				}
			};
			recorder.onstop = () => {
				const discardAfterStop = voiceDiscardAfterStopRef.current;
				const sendAfterStop = voiceSendAfterStopRef.current;
				voiceDiscardAfterStopRef.current = false;
				voiceSendAfterStopRef.current = false;
				if (discardAfterStop) {
					cleanupVoiceRecorder();
					return;
				}

				const mimeType =
					recorder.mimeType || supportedMimeType || 'audio/webm';
				const blob = new Blob(chunks, { type: mimeType });
				if (blob.size > 0) {
					const elapsedMs = voiceRecordingStartedAtRef.current
						? Math.max(
								1000,
								Date.now() - voiceRecordingStartedAtRef.current
							)
						: Math.max(
								1000,
								voiceRecordingDurationRef.current * 1000
							);
					const elapsedSec = Math.max(
						1,
						Math.round(elapsedMs / 1000)
					);
					const extension = mimeType.includes('ogg') ? 'ogg' : 'webm';
					const voiceFile = new File(
						[blob],
						`voice-message-${Date.now()}-s${elapsedSec}-ms${elapsedMs}.${extension}`,
						{
							type: mimeType,
							lastModified: Date.now()
						}
					);
					if (sendAfterStop) {
						setIsRequestInProgress(true);
						sendMessage('', voiceFile, isE2eeEnabled);
					} else {
						if (voicePreviewUrl) {
							URL.revokeObjectURL(voicePreviewUrl);
						}
						setVoicePreviewUrl(URL.createObjectURL(blob));
						setVoiceAttachmentDurationSec(elapsedSec);
						displayAttachmentToUpload(voiceFile);
					}
				}
				cleanupVoiceRecorder();
			};
			recorder.onerror = () => {
				setActiveInfo(INFO_TYPES.VOICE_RECORDING_ERROR);
				cleanupVoiceRecorder();
			};

			mediaRecorderRef.current = recorder;
			setActiveInfo('');
			voiceRecordingDurationRef.current = 0;
			setVoiceRecordingDurationSec(0);
			voiceRecordingStartedAtRef.current = Date.now();
			setIsVoiceRecording(true);
			voiceRecordingTimerRef.current = window.setInterval(() => {
				setVoiceRecordingDurationSec((value) => {
					const next = value + 1;
					voiceRecordingDurationRef.current = next;
					if (next >= VOICE_RECORDING_MAX_DURATION_SEC) {
						stopVoiceRecording();
					}
					return next;
				});
			}, 1000);
			recorder.start();
		} catch {
			setActiveInfo(INFO_TYPES.VOICE_RECORDING_ERROR);
			cleanupVoiceRecorder();
		}
	}, [
		hasUploadFunctionality,
		isVoiceMessageEnabledForCurrentChat,
		attachmentSelected,
		uploadProgress,
		displayAttachmentToUpload,
		cleanupVoiceRecorder,
		stopVoiceRecording,
		sendMessage,
		isE2eeEnabled,
		voicePreviewUrl
	]);

	const toggleVoiceRecording = useCallback(() => {
		if (isVoiceRecording) {
			stopVoiceRecording();
		} else {
			startVoiceRecording();
		}
	}, [isVoiceRecording, startVoiceRecording, stopVoiceRecording]);

	const bookingButton: ButtonItem = useMemo(
		() => ({
			label: translate('message.submit.booking.buttonLabel'),
			type: BUTTON_TYPES.PRIMARY
		}),
		[translate]
	);

	const getAttachmentIcon = useCallback((type: string) => {
		const Icon = getIconForAttachmentType(type);
		if (Icon) {
			return <Icon aria-hidden="true" focusable="false" />;
		}
		return null;
	}, []);

	const isVoiceAttachmentSelected =
		!!attachmentSelected?.type?.startsWith('audio/');
	const formatRecordingDuration = useCallback((totalSeconds: number) => {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
	}, []);
	const typedMessage = getTypedMarkdownMessage();
	const typedMessageLength =
		getPlainTextFromComposerValue(typedMessage).length;
	const isMessageLengthWarning =
		typedMessageLength >= MESSAGE_LENGTH_WARNING_THRESHOLD;
	const isMessageOverLimit = typedMessageLength > INPUT_MAX_LENGTH;
	const characterCounterAnnouncement = isMessageOverLimit
		? translate(
				'message.submit.characterCounter.overLimit',
				'Message is over the character limit.'
			)
		: isMessageLengthWarning
			? translate(
					'message.submit.characterCounter.warning',
					'Message is approaching the character limit.'
				)
			: '';
	const canSendMessage =
		(!!attachmentSelected || hasMessageContent(typedMessage)) &&
		!isMessageOverLimit;

	const handleToolbarAction = useCallback((action: string) => {
		composerRef.current?.runAction(action);
	}, []);

	const isToolbarActionSelected = useCallback(
		(action: string) =>
			composerRef.current?.isActionActive(action) || false,
		// composerText is intentionally listed: it forces the toolbar to
		// re-evaluate the active formatting state as the user types.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[composerText]
	);

	const openCompactActionStrip = useCallback(() => {
		setIsCompactActionStripOpen(true);
		setIsEmojiStripOpen(false);
	}, []);

	const closeCompactActionStrip = useCallback(() => {
		setIsCompactActionStripOpen(false);
	}, []);

	// ── Keyboard shortcut handlers ───────────────────────────────────────────
	// TipTap stores empty docs as markup (e.g. <p></p>) — use plain text.
	const isComposerEmpty =
		!hasMessageContent(composerText) && !attachmentSelected;

	const handleEditLast = useCallback((): boolean => {
		if (!messages || messages.length === 0) {
			return false;
		}
		const owns = isOwnMessage ?? isMyMessage;
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (!owns(msg.userId)) {
				continue;
			}
			// Skip deleted (t === 'rm') and aliased (system) messages
			if (msg.t === 'rm' || msg.alias) {
				continue;
			}
			if (!msg.message?.trim()) {
				continue;
			}
			const composerHtml = transportMarkupToComposerHtml(msg.message);
			if (!hasMessageContent(composerHtml)) {
				continue;
			}
			setEditingMessageId(msg._id);
			setComposerText(composerHtml);
			composerRef.current?.setText(composerHtml);
			requestAnimationFrame(() => composerRef.current?.focus());
			return true;
		}
		return false;
	}, [messages, isOwnMessage, hasMessageContent]);

	const handleCancelEdit = useCallback((): boolean => {
		if (isEmojiStripOpen) {
			setIsEmojiStripOpen(false);
			return true;
		}
		if (editingMessageId) {
			setEditingMessageId(null);
			setComposerText('');
			composerRef.current?.clear();
			requestAnimationFrame(() => composerRef.current?.focus());
			return true;
		}
		if (highlightedSnippet) {
			setHighlightedSnippet(null);
			return true;
		}
		if (onCloseThread) {
			onCloseThread();
			return true;
		}
		if (isExpandedComposer) {
			setIsExpandedComposer(false);
			return true;
		}
		return false;
	}, [
		isEmojiStripOpen,
		editingMessageId,
		highlightedSnippet,
		onCloseThread,
		isExpandedComposer
	]);

	const handleUpload = useCallback((): boolean => {
		if (!hasUploadFunctionality || !!uploadProgress || isVoiceRecording) {
			return false;
		}
		handleAttachmentSelect();
		return true;
	}, [
		hasUploadFunctionality,
		uploadProgress,
		isVoiceRecording,
		handleAttachmentSelect
	]);

	const handleOpenEmoji = useCallback((): boolean => {
		if (isEmojiStripOpen) {
			setIsEmojiStripOpen(false);
			return true;
		}
		openCompactActionStrip();
		setIsEmojiStripOpen(true);
		return true;
	}, [isEmojiStripOpen, openCompactActionStrip]);

	const { preferences: shortcutPreferences, platform: shortcutPlatform } =
		useKeyboardShortcuts();

	// Window capture so ⌘/Ctrl+E toggles even when focus is inside the picker.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || isImeComposing(event)) {
				return;
			}
			if (hasOpenModalDialog()) {
				return;
			}
			const binding = resolveEffectiveBinding(
				shortcutPreferences,
				'chat.openEmojiPicker',
				shortcutPlatform
			);
			if (
				!binding ||
				!matchesShortcut(event, binding, shortcutPlatform)
			) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			handleOpenEmoji();
		};
		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
	}, [shortcutPreferences, shortcutPlatform, handleOpenEmoji]);

	// Listen for CustomEvents dispatched from CommandPaletteDialog
	useEffect(() => {
		const onUploadEvent = () => {
			if (
				hasUploadFunctionality &&
				!uploadProgress &&
				!isVoiceRecording
			) {
				handleAttachmentSelect();
			}
		};
		const onEmojiEvent = () => {
			handleOpenEmoji();
		};
		window.addEventListener('oriso:shortcut:uploadFile', onUploadEvent);
		window.addEventListener('oriso:shortcut:openEmoji', onEmojiEvent);
		return () => {
			window.removeEventListener(
				'oriso:shortcut:uploadFile',
				onUploadEvent
			);
			window.removeEventListener(
				'oriso:shortcut:openEmoji',
				onEmojiEvent
			);
		};
	}, [
		hasUploadFunctionality,
		uploadProgress,
		isVoiceRecording,
		handleAttachmentSelect,
		handleOpenEmoji
	]);
	// ── End shortcut handlers ────────────────────────────────────────────────

	const toggleExpandedComposer = useCallback(() => {
		setIsExpandedComposer((prev) => !prev);
	}, []);

	const expandedComposerStyle = useMemo(() => {
		if (!isExpandedComposer) {
			return undefined;
		}
		return {
			position: 'fixed' as const,
			inset: '0',
			zIndex: 4000,
			pointerEvents: 'none' as const
		};
	}, [isExpandedComposer]);
	// Blur is intentionally disabled for now.
	// To re-enable: remove the immediate `display: 'none'` return below
	// and uncomment the blur style block.
	const audienceMenuOverlayStyle = useMemo<React.CSSProperties>(() => {
		return {
			display: 'none'
		};

		/*
		const baseStyle: React.CSSProperties = {
			position: 'fixed',
			background: 'rgba(255, 255, 255, 0.8)',
			backdropFilter: 'blur(4px)',
			WebkitBackdropFilter: 'blur(4px)',
			zIndex: 999998,
			pointerEvents: 'none'
		};
		if (!audienceOverlayBounds) {
			return {
				...baseStyle,
				inset: 0
			};
		}
		return {
			...baseStyle,
			top: `${audienceOverlayBounds.top}px`,
			left: `${audienceOverlayBounds.left}px`,
			width: `${audienceOverlayBounds.width}px`,
			height: `${audienceOverlayBounds.height}px`,
			borderRadius: audienceOverlayBounds.borderRadius
		};
		*/
	}, []);

	const handleEmojiPick = useCallback((emoji: string) => {
		if (!emoji) {
			return;
		}
		// Keep the picker open so users can insert multiple emojis.
		composerRef.current?.insertText(`${emoji} `);
	}, []);

	const handleMentionInsert = useCallback(() => {
		composerRef.current?.focus();
		composerRef.current?.insertMentionTrigger();
	}, []);

	// Live snapshot for the mention provider — the TipTap extension is created
	// once on mount, so its getCandidates closure reads through this ref to
	// always see the current agency directory and room membership.
	const mentionDataRef = useRef({
		directory: agencyConsultantDirectory,
		inRoomValues: new Set<string>(),
		matrixUserIdByComparableId: new Map<string, string>(),
		selfId: userData?.userId as string | undefined
	});
	mentionDataRef.current = {
		directory: agencyConsultantDirectory,
		inRoomValues: new Set(
			audienceOptions
				.filter((option) => option.value !== '__all__')
				.flatMap((option) => [
					...Array.from(getComparableAudienceIds(option.value)),
					...Array.from(getComparableAudienceIds(option.label))
				])
		),
		// Intentional mentions (#435): audienceOptions already resolves room
		// members to their real Matrix user id (option.value is member.userId
		// for room members — see the audience-options effect above). Reusing
		// that instead of a second room-member fetch keeps this a single
		// source of truth, and only ever a *resolved* member id ends up here.
		matrixUserIdByComparableId: new Map(
			audienceOptions
				.filter(
					(option) =>
						option.value !== '__all__' &&
						/^@[^:@\s]+:.+$/.test(option.value)
				)
				.flatMap((option) =>
					Array.from(
						new Set([
							...Array.from(
								getComparableAudienceIds(option.value)
							),
							...Array.from(
								getComparableAudienceIds(option.label)
							)
						])
					).map((id): [string, string] => [id, option.value])
				)
		),
		selfId: userData?.userId
	};

	const mentionProvider = useMemo(
		() => ({
			selfId: userData?.userId,
			notInChatLabel: translate(
				'message.mention.notInChat',
				'nicht im Chat'
			),
			getCandidates: () => {
				const { directory, inRoomValues, matrixUserIdByComparableId } =
					mentionDataRef.current;
				return Array.from(directory.entries()).map(
					([consultantId, info]) => {
						const comparableIds = getComparableAudienceIds(
							info.username
						);
						const matrixUserId = Array.from(comparableIds)
							.map((id) => matrixUserIdByComparableId.get(id))
							.find(Boolean);
						return {
							id: consultantId,
							displayName: info.displayName,
							username: info.username,
							matrixUserId,
							isInRoom: Array.from(comparableIds).some((id) =>
								inRoomValues.has(id)
							)
						};
					}
				);
			}
		}),
		// Stable identity: reads live data through the ref.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[]
	);

	const handleToolbarMouseDown = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			const target = event.target as HTMLElement | null;
			if (target?.closest('button')) {
				// Keep editor selection from collapsing when clicking toolbar buttons.
				event.preventDefault();
			}
		},
		[]
	);
	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const handleResize = () =>
			setIsMobileViewport(window.innerWidth <= 899);
		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);
	const unreadMobileBadgeCount = Math.max(0, Number(mobileUnreadCount) || 0);
	const handleMobileBackNavigation = useCallback(() => {
		onMobileNavigateBack?.();
	}, [onMobileNavigateBack]);
	const handleMobileBottomNavigation = useCallback(() => {
		onMobileNavigateBottom?.();
	}, [onMobileNavigateBottom]);

	const getComposerHeightBounds = useCallback(
		() =>
			getComposerHeightBoundsPure({
				viewportWidth: window.innerWidth,
				viewportHeight: window.innerHeight
			}),
		[]
	);

	const clampComposerHeight = useCallback(
		(height: number) =>
			clampComposerHeightPure(height, getComposerHeightBounds()),
		[getComposerHeightBounds]
	);

	const handleComposerResizePointerDown = useCallback(
		(e: React.PointerEvent<HTMLButtonElement>) => {
			if (e.pointerType === 'mouse' && e.button !== 0) return;
			e.preventDefault();
			e.stopPropagation();

			const target = e.currentTarget;
			const composerShell = target.closest(
				'.textarea__wrapper-send-message'
			) as HTMLElement | null;
			const startHeight =
				composerShell?.getBoundingClientRect().height ||
				composerHeight ||
				getComposerHeightBounds().minHeight;

			composerResizeStartRef.current = {
				pointerId: e.pointerId,
				startY: e.clientY,
				startHeight
			};
			setIsComposerResizing(true);

			try {
				target.setPointerCapture(e.pointerId);
			} catch {}

			const handlePointerMove = (event: PointerEvent) => {
				const start = composerResizeStartRef.current;
				if (!start || event.pointerId !== start.pointerId) {
					return;
				}

				const deltaY = event.clientY - start.startY;
				setComposerHeight(
					clampComposerHeight(start.startHeight - deltaY)
				);
			};

			const cleanup = (event?: PointerEvent) => {
				if (
					event &&
					composerResizeStartRef.current &&
					event.pointerId !== composerResizeStartRef.current.pointerId
				) {
					return;
				}
				document.removeEventListener('pointermove', handlePointerMove);
				document.removeEventListener('pointerup', cleanup);
				document.removeEventListener('pointercancel', cleanup);
				try {
					target.releasePointerCapture(e.pointerId);
				} catch {}
				composerResizeStartRef.current = null;
				setIsComposerResizing(false);
			};

			document.addEventListener('pointermove', handlePointerMove);
			document.addEventListener('pointerup', cleanup);
			document.addEventListener('pointercancel', cleanup);
		},
		[
			clampComposerHeight,
			composerHeight,
			getComposerHeightBounds,
			setComposerHeight
		]
	);

	const handleComposerResizeKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>) => {
			const bounds = getComposerHeightBounds();
			const nextHeight = stepComposerHeight(
				composerHeight || bounds.minHeight,
				{ key: e.key, shiftKey: e.shiftKey },
				bounds
			);
			if (nextHeight === null) {
				return;
			}
			e.preventDefault();
			setComposerHeight(nextHeight);
		},
		[composerHeight, getComposerHeightBounds, setComposerHeight]
	);

	const composerMenuDirection = getMenuDirection({
		isExpanded: isExpandedComposer,
		isMobile: isMobileViewport
	});

	const matrixRoomId = resolvedChatSession.matrixRoomId || null;

	// MATRIX MIGRATION: legacy RocketChat E2EE gates do not apply to Matrix rooms.
	if (!e2EEReady && activeSession.rid && !matrixRoomId) {
		return null;
	}

	if (subscriptionKeyLost && activeSession.rid && !matrixRoomId) {
		return <SubscriptionKeyLost />;
	}

	if (roomNotFound && activeSession.rid && !matrixRoomId) {
		return <RoomNotFound />;
	}

	return (
		<div
			className={clsx(
				className,
				'messageSubmit__wrapper',
				isExpandedComposer && 'messageSubmit__wrapper--expanded',
				isTypingActive && 'messageSubmit__wrapper--withTyping',
				isComposerResizing && 'messageSubmit__wrapper--resizing'
			)}
			style={expandedComposerStyle}
		>
			{activeInfo && <MessageSubmitInfo {...getMessageSubmitInfo()} />}
			{highlightedSnippet && (
				<div className="textarea__snippetInfo">
					{translate('chat.highlightSnippet.ready', {
						defaultValue: 'Text snippet added to your reply'
					})}
				</div>
			)}

			<form className="textarea" onSubmit={handleFormSubmit}>
				{/* Relations foundation (#435): cancelable reply-quote preview,
				    docked inside the composer box above the input. */}
				{replyTo && (
					<div className="messageSubmit__replyPreview" role="status">
						<div className="messageSubmit__replyPreviewContent">
							<span className="messageSubmit__replyPreviewLabel">
								{translate(
									'message.reply.previewLabel',
									'Antwort an'
								)}{' '}
								<strong>{replyTo.author}</strong>
							</span>
							<span className="messageSubmit__replyPreviewText">
								{replyTo.text}
							</span>
						</div>
						<button
							type="button"
							className="messageSubmit__replyPreviewCancel"
							onClick={() => onCancelReply && onCancelReply()}
							aria-label={translate(
								'message.reply.cancel',
								'Antwort verwerfen'
							)}
						>
							×
						</button>
					</div>
				)}
				{/* Editing (m.replace, #435): cancelable edit-in-progress banner,
				    same dock as the reply preview. */}
				{editingMessage && (
					<div className="messageSubmit__editPreview" role="status">
						<span className="messageSubmit__editPreviewLabel">
							{translate(
								'message.edit.previewLabel',
								'Nachricht bearbeiten'
							)}
						</span>
						<button
							type="button"
							className="messageSubmit__editPreviewCancel"
							onClick={() => onCancelEdit && onCancelEdit()}
							aria-label={translate(
								'message.edit.cancel',
								'Bearbeiten abbrechen'
							)}
						>
							×
						</button>
					</div>
				)}
				<div
					className={clsx(
						'textarea__wrapper',
						isExpandedComposer &&
							'textarea__wrapper--expandedOverlay'
					)}
				>
					<div
						className={clsx(
							'textarea__wrapper-send-message',
							canSendMessage &&
								'textarea__wrapper-send-message--ready',
							isComposerSelected &&
								'textarea__wrapper-send-message--selected',
							isExpandedComposer &&
								'textarea__wrapper-send-message--expanded',
							isComposerResizing &&
								'textarea__wrapper-send-message--resizing'
						)}
						style={
							!isExpandedComposer && composerHeight
								? ({
										'--composer-height': `${composerHeight}px`
									} as React.CSSProperties)
								: undefined
						}
					>
						{!isMobileViewport &&
							!threadRootId &&
							!isExpandedComposer && (
								<DragHandle
									onPointerDown={
										handleComposerResizePointerDown
									}
									onKeyDown={handleComposerResizeKeyDown}
									touched={isComposerResizing}
									ariaLabel={translate(
										'message.mobileNav.dragToExpand',
										'Drag to resize composer'
									)}
								/>
							)}
						{isMobileViewport &&
							!threadRootId &&
							!isExpandedComposer && (
								<div className="textarea__mobileNavigator">
									<button
										type="button"
										className="textarea__mobileNavigatorButton textarea__mobileNavigatorButton--left"
										onClick={handleMobileBackNavigation}
										aria-label={translate(
											'message.mobileNav.back',
											'Navigate up'
										)}
									>
										<ComposerMobileBackIcon />
									</button>
									<button
										type="button"
										className="textarea__mobileNavigatorCenter"
										onPointerDown={
											handleComposerResizePointerDown
										}
										onKeyDown={handleComposerResizeKeyDown}
										aria-label={translate(
											'message.mobileNav.dragToExpand',
											'Drag to resize composer'
										)}
									>
										<span className="textarea__mobileNavigatorHandle" />
									</button>
									<button
										type="button"
										className="textarea__mobileNavigatorButton textarea__mobileNavigatorButton--right"
										onClick={handleMobileBottomNavigation}
										aria-label={translate(
											'message.mobileNav.scrollToBottom',
											'Scroll to bottom'
										)}
									>
										<ComposerMobileDownIcon />
										{unreadMobileBadgeCount > 0 && (
											<span className="textarea__mobileNavigatorBadge">
												{unreadMobileBadgeCount > 99
													? '99+'
													: unreadMobileBadgeCount}
											</span>
										)}
									</button>
								</div>
							)}
						{showAudienceSelector && (
							<div
								className={clsx(
									'textarea__audienceSelector',
									isAllAudienceChip
										? 'textarea__audienceSelector--all'
										: 'textarea__audienceSelector--target'
								)}
								ref={audienceMenuRef}
							>
								<RecipientSplitButton
									label={selectedAudienceChipLabel}
									icon={selectedAudienceIcon}
									isOpen={isAudienceMenuOpen}
									isMulti={isMultiAudienceSelection}
									onToggle={() =>
										setIsAudienceMenuOpen(
											(previousState) => !previousState
										)
									}
									chevronLabel={translate(
										'message.audience.openMenu',
										'Open send-to menu'
									)}
								/>
								{isAudienceMenuOpen && (
									<>
										{typeof document !== 'undefined' &&
											createPortal(
												<div
													className="textarea__audienceSelectorMenuOverlay"
													style={
														audienceMenuOverlayStyle
													}
													onClick={() =>
														setIsAudienceMenuOpen(
															false
														)
													}
													aria-hidden="true"
												/>,
												document.body
											)}
										<div
											className="textarea__audienceSelectorMenu"
											role="dialog"
											aria-label={translate(
												'message.audience.menuAriaLabel',
												'Send to selector'
											)}
										>
											<button
												type="button"
												className="textarea__audienceSelectorMenuClose"
												onClick={() =>
													setIsAudienceMenuOpen(false)
												}
												aria-label={translate(
													'message.audience.closeMenu',
													'Close send-to menu'
												)}
											>
												<svg
													width="32"
													height="32"
													viewBox="0 0 32 32"
													fill="none"
													xmlns="http://www.w3.org/2000/svg"
												>
													<rect
														width="32"
														height="32"
														rx="16"
														fill="#CC1E1C"
													/>
													<path
														d="M20.0003 12.0001L12.0003 20.0001M12.0003 12.0001L20.0003 20.0001M29.3337 16.0001C29.3337 23.3639 23.3641 29.3334 16.0003 29.3334C8.63653 29.3334 2.66699 23.3639 2.66699 16.0001C2.66699 8.63628 8.63653 2.66675 16.0003 2.66675C23.3641 2.66675 29.3337 8.63628 29.3337 16.0001Z"
														fill="none"
														stroke="white"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
												</svg>
											</button>
											<p className="textarea__audienceSelectorMenuSubheading">
												{translate(
													'message.audience.menuSubheading',
													'Wähle wer diese Nachricht sehen soll'
												)}
											</p>
											<p className="textarea__audienceSelectorMenuHeading">
												{translate(
													'message.audience.menuHeading',
													'Adressaten wählen'
												)}
											</p>
											<div className="textarea__audienceSelectorMenuDivider" />
											<div className="textarea__audienceSelectorMenuSections">
												{sectionDefinitions.map(
													(sectionDefinition) => {
														const sectionOptions =
															audienceGroupedSections[
																sectionDefinition
																	.key
															];
														const selectableOptions =
															sectionOptions.filter(
																(option) =>
																	!option.disabled
															);
														const selectedCount =
															selectableOptions.filter(
																(option) =>
																	selectedAudienceValues.includes(
																		option.value
																	)
															).length;
														const hasAllSelected =
															isAllAudienceSelectedInMenu ||
															(selectableOptions.length >
																0 &&
																selectedCount ===
																	selectableOptions.length);
														const hasPartialSelected =
															!isAllAudienceSelectedInMenu &&
															selectedCount > 0 &&
															selectedCount <
																selectableOptions.length;
														const sectionSelectLabel =
															selectedCount > 0
																? sectionDefinition.key ===
																	'clients'
																	? translate(
																			'message.audience.clientsSelected',
																			'{{count}} Clients Selected',
																			{
																				count: selectedCount
																			}
																		)
																	: sectionDefinition.key ===
																		  'counsellors'
																		? translate(
																				'message.audience.counsellorsSelected',
																				'{{count}} Counsellors Selected',
																				{
																					count: selectedCount
																				}
																			)
																		: translate(
																				'message.audience.moderatorsSelected',
																				'{{count}} Moderators Selected',
																				{
																					count: selectedCount
																				}
																			)
																: sectionDefinition.key ===
																	  'clients'
																	? translate(
																			'message.audience.clientsSelectAll',
																			'Select All Clients'
																		)
																	: sectionDefinition.key ===
																		  'counsellors'
																		? translate(
																				'message.audience.counsellorsSelect',
																				'Select All Counsellors'
																			)
																		: translate(
																				'message.audience.moderatorsSelect',
																				'Select All Moderators'
																			);
														return (
															<div
																key={
																	sectionDefinition.key
																}
																className="textarea__audienceSelectorSection"
															>
																<div className="textarea__audienceSelectorSectionHeader">
																	<button
																		type="button"
																		className="textarea__audienceSelectorSectionSelectAll"
																		onClick={() =>
																			toggleAudienceSectionSelectAll(
																				sectionDefinition.key
																			)
																		}
																	>
																		<span
																			className={clsx(
																				'textarea__audienceSelectorSectionRadio',
																				hasAllSelected &&
																					'textarea__audienceSelectorSectionRadio--selected',
																				hasPartialSelected &&
																					'textarea__audienceSelectorSectionRadio--partial'
																			)}
																		/>
																		<span className="textarea__audienceSelectorSectionTitle">
																			{selectedCount >
																			0 ? (
																				<>
																					<span className="textarea__audienceSelectorSectionTitleCount">
																						{
																							selectedCount
																						}
																					</span>{' '}
																					{sectionSelectLabel.replace(
																						/^\d+\s*/,
																						''
																					)}
																				</>
																			) : (
																				sectionSelectLabel
																			)}
																		</span>
																	</button>
																	<button
																		type="button"
																		className="textarea__audienceSelectorSectionChevron"
																		onClick={() =>
																			toggleAudienceSectionExpanded(
																				sectionDefinition.key
																			)
																		}
																		aria-label={translate(
																			'message.audience.toggleSection',
																			'Toggle section'
																		)}
																		aria-expanded={
																			expandedAudienceSections[
																				sectionDefinition
																					.key
																			]
																		}
																	>
																		<AudienceChipChevronIcon
																			className={clsx(
																				'textarea__audienceSelectorSectionChevronIcon',
																				expandedAudienceSections[
																					sectionDefinition
																						.key
																				] &&
																					'textarea__audienceSelectorSectionChevronIcon--open'
																			)}
																		/>
																	</button>
																</div>
																<div
																	className={clsx(
																		'textarea__audienceSelectorSectionBody',
																		expandedAudienceSections[
																			sectionDefinition
																				.key
																		] &&
																			'textarea__audienceSelectorSectionBody--open'
																	)}
																>
																	{sectionOptions.length ===
																	0 ? (
																		<div className="textarea__audienceSelectorSectionEmpty">
																			{sectionDefinition.key ===
																			'clients'
																				? translate(
																						'message.audience.clientsEmpty',
																						'No clients are in this room'
																					)
																				: sectionDefinition.key ===
																					  'counsellors'
																					? translate(
																							'message.audience.counsellorsEmpty',
																							'No counsellors are in this room'
																						)
																					: translate(
																							'message.audience.moderatorsEmpty',
																							'No moderators are in this room'
																						)}
																		</div>
																	) : (
																		sectionOptions.map(
																			(
																				option
																			) => {
																				const isSelected =
																					isAllAudienceSelectedInMenu ||
																					selectedAudienceValues.includes(
																						option.value
																					);
																				return (
																					<button
																						type="button"
																						key={
																							option.value
																						}
																						className={clsx(
																							'textarea__audienceSelectorPill',
																							isSelected &&
																								'textarea__audienceSelectorPill--selected',
																							option.disabled &&
																								'textarea__audienceSelectorPill--disabled'
																						)}
																						disabled={
																							option.disabled
																						}
																						onClick={() => {
																							if (
																								option.disabled
																							) {
																								return;
																							}
																							toggleAudienceSelection(
																								option.value
																							);
																						}}
																					>
																						<span
																							className={clsx(
																								'textarea__audienceSelectorPillIcon',
																								sectionDefinition.key ===
																									'counsellors' &&
																									'textarea__audienceSelectorPillIcon--counsellor'
																							)}
																						>
																							{sectionDefinition.key ===
																							'moderators' ? (
																								<AudienceModeratorIcon />
																							) : sectionDefinition.key ===
																							  'counsellors' ? (
																								<AudienceSingleConsultantIcon />
																							) : (
																								<AudienceSingleUserIcon />
																							)}
																						</span>
																						<span className="textarea__audienceSelectorPillText">
																							{
																								option.label
																							}
																						</span>
																					</button>
																				);
																			}
																		)
																	)}
																</div>
															</div>
														);
													}
												)}
											</div>
											<div className="textarea__audienceSelectorMenuFooter">
												<button
													type="button"
													className="textarea__audienceSelectorMenuSelectAll"
													onClick={() =>
														toggleAudienceSelection(
															'__all__'
														)
													}
												>
													<span
														className={clsx(
															'textarea__audienceSelectorSectionRadio',
															isAllAudienceSelectedInMenu &&
																'textarea__audienceSelectorSectionRadio--selected'
														)}
													/>
													<span>
														{translate(
															'message.audience.selectAllBottom',
															'Select All'
														)}
													</span>
												</button>
											</div>
										</div>
									</>
								)}
							</div>
						)}
						<span
							className="textarea__inputWrapper"
							ref={inputWrapperRef}
						>
							<div
								className={clsx(
									'textarea__input',
									attachmentSelected &&
										'textarea__input--attachmentMode',
									editingMessageId &&
										'textarea__input--editing'
								)}
								ref={textareaInputRef}
								onKeyUp={(e) => {
									resizeTextarea();
									// Auto-scroll on Enter key or any key press
									// Enter key especially needs multiple delayed scrolls to catch DOM updates
									// Rich text mode needs more aggressive scrolling due to Draft.js DOM update delays
									if (e.key === 'Enter' && isRichtextActive) {
										// Multiple delayed scrolls for Enter key in rich text mode to ensure DOM has updated
										setTimeout(
											() => scrollEditorToBottom(),
											0
										);
										setTimeout(
											() => scrollEditorToBottom(),
											50
										);
										setTimeout(
											() => scrollEditorToBottom(),
											150
										);
										setTimeout(
											() => scrollEditorToBottom(),
											300
										);
										setTimeout(
											() => scrollEditorToBottom(),
											500
										);
										setTimeout(
											() => scrollEditorToBottom(),
											700
										);
									} else if (e.key === 'Enter') {
										// Enter key in non-rich text mode (simpler, less delays needed)
										setTimeout(
											() => scrollEditorToBottom(),
											0
										);
										setTimeout(
											() => scrollEditorToBottom(),
											50
										);
									} else {
										setTimeout(
											() => scrollEditorToBottom(),
											0
										);
									}
								}}
							>
								{attachmentSelected ? (
									<div className="textarea__attachmentMode">
										<div className="textarea__attachmentModeCard">
											<span className="textarea__attachmentModeIcon">
												{getAttachmentIcon(
													attachmentSelected.type
												)}
											</span>
											<div className="textarea__attachmentModeInfo">
												<p className="textarea__attachmentModeName">
													{attachmentSelected.name}
												</p>
												<span className="textarea__attachmentModeMeta">
													{Math.max(
														1,
														Math.round(
															attachmentSelected.size /
																1024
														)
													)}{' '}
													KB
												</span>
											</div>
											<button
												type="button"
												className="textarea__attachmentModeRemove"
												onClick={
													handleAttachmentRemoval
												}
												aria-label={translate(
													'app.remove'
												)}
											>
												<RemoveIcon />
											</button>
										</div>
									</div>
								) : (
									<>
										{editingMessageId && (
											<div
												className="textarea__editingBanner"
												role="status"
											>
												<span className="textarea__editingBanner__label">
													{translate(
														'shortcuts.editingBanner'
													)}
												</span>
												<button
													type="button"
													className="textarea__editingBanner__cancel"
													onClick={() => {
														handleCancelEdit();
													}}
												>
													{translate(
														'shortcuts.editingCancel'
													)}
												</button>
											</div>
										)}
										<div
											className="textarea__figmaToolbar"
											onMouseDown={handleToolbarMouseDown}
										>
											{isCompactActionStripOpen ? (
												<span className="composerToolbar__menuAnchor composerToolbar__menuAnchor--bar">
													<DefaultActionBar
														onOpenTools={
															closeCompactActionStrip
														}
														showMic={
															hasUploadFunctionality &&
															isVoiceMessageEnabledForCurrentChat
														}
														isRecording={
															isVoiceRecording
														}
														onMicClick={
															toggleVoiceRecording
														}
														isEmojiOpen={
															isEmojiStripOpen
														}
														onEmojiClick={() =>
															setIsEmojiStripOpen(
																(prev) => !prev
															)
														}
														onMentionClick={
															handleMentionInsert
														}
														showAttachment={
															hasUploadFunctionality
														}
														onAttachmentClick={
															handleAttachmentSelect
														}
														isExpanded={
															isExpandedComposer
														}
														onExpandToggle={
															toggleExpandedComposer
														}
														translate={translate}
													/>
													{isEmojiStripOpen && (
														<EmojiPickerPopup
															direction={
																composerMenuDirection
															}
															onPick={
																handleEmojiPick
															}
															onClose={() =>
																setIsEmojiStripOpen(
																	false
																)
															}
														/>
													)}
												</span>
											) : (
												<ComposerToolbar
													direction={
														composerMenuDirection
													}
													isMobile={isMobileViewport}
													isExpanded={
														isExpandedComposer
													}
													onAction={
														handleToolbarAction
													}
													isActionSelected={
														isToolbarActionSelected
													}
													onCollapse={
														openCompactActionStrip
													}
													onExpandToggle={
														toggleExpandedComposer
													}
													translate={translate}
												/>
											)}
										</div>
										<TipTapComposer
											ref={composerRef}
											value={composerText}
											onChange={handleComposerChange}
											placeholder={placeholder}
											showToolbar={false}
											readOnly={!!uploadProgress}
											maxLength={INPUT_MAX_LENGTH}
											onFocusChange={
												setIsComposerSelected
											}
											mentionProvider={mentionProvider}
											isComposerEmpty={isComposerEmpty}
											onEditLast={handleEditLast}
											onCancel={handleCancelEdit}
											onUpload={handleUpload}
											onSubmitShortcut={() => {
												if (
													!uploadProgress &&
													!isRequestInProgress
												) {
													handleButtonClick();
												}
											}}
										/>
										<span
											className="sr-only"
											role="status"
											aria-live="polite"
										>
											{characterCounterAnnouncement}
										</span>
									</>
								)}
							</div>
							{hasUploadFunctionality &&
								(isVoiceRecording ? (
									<span
										className={clsx(
											'textarea__attachmentSelect',
											'textarea__attachmentSelect--recording'
										)}
									>
										<span className="textarea__voiceRecordingBar">
											<span className="textarea__voiceRecordingDot"></span>
											<span className="textarea__voiceRecordingLabel">
												{translate(
													'voice.recording.active',
													'Recording...'
												)}
											</span>
											<span className="textarea__voiceRecordButton__timer">
												{formatRecordingDuration(
													voiceRecordingDurationSec
												)}
											</span>
											<button
												type="button"
												className="textarea__voiceActionButton textarea__voiceActionButton--cancel"
												onClick={() =>
													stopVoiceRecording({
														discard: true
													})
												}
											>
												{translate(
													'app.cancel',
													'Cancel'
												)}
											</button>
											<button
												type="button"
												className="textarea__voiceActionButton textarea__voiceActionButton--stop"
												onClick={() =>
													stopVoiceRecording({
														sendAfterStop: true
													})
												}
											>
												{translate('app.stop', 'Stop')}
											</button>
										</span>
									</span>
								) : attachmentSelected &&
								  isVoiceAttachmentSelected ? (
									<div className="textarea__attachmentWrapper">
										<div className="textarea__voicePreview">
											<span className="textarea__voicePreview__meta">
												<AudioOnIcon />
												<span>
													{translate(
														'voice.recording.preview',
														'Voice message'
													)}
												</span>
												<span className="textarea__voicePreview__duration">
													{formatRecordingDuration(
														voiceAttachmentDurationSec
													)}
												</span>
											</span>
											{voicePreviewUrl && (
												<audio
													className="textarea__voicePreview__audio"
													controls
													src={voicePreviewUrl}
												/>
											)}
											<span className="textarea__attachmentSelected__remove">
												<RemoveIcon
													onClick={
														handleAttachmentRemoval
													}
													title={translate(
														'app.remove'
													)}
													aria-label={translate(
														'app.remove'
													)}
												/>
											</span>
										</div>
									</div>
								) : null)}
						</span>
						<div className="textarea__buttons">
							<SendButton
								type="submit"
								onSend={handleButtonClick}
								state={deriveSendButtonState({
									hasContent: canSendMessage,
									isSending: isRequestInProgress,
									isDisabled:
										!!uploadProgress || isVoiceRecording
								})}
							/>
						</div>
					</div>
					{showAppointmentButton && (
						<div className="textarea__wrapper-booking">
							<Headline
								semanticLevel="5"
								text={translate(
									'message.submit.booking.headline'
								)}
								className="textarea__wrapper-booking-headline"
							/>
							<Button
								item={bookingButton}
								isLink={true}
								buttonHandle={handleBookingButton}
								customIcon={<CalendarMonthIcon />}
							/>
						</div>
					)}
				</div>
				{hasUploadFunctionality && (
					<input
						ref={attachmentInputRef}
						onChange={handleAttachmentChange}
						className="textarea__attachmentInput"
						type="file"
						id="dataUpload"
						name="dataUpload"
						accept="image/jpeg, image/png, .pdf, .docx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, audio/webm, audio/ogg, audio/mpeg"
					/>
				)}
			</form>

			{requestOverlayVisible && (
				<Overlay item={requestOverlay} name={OVERLAY_REQUEST} />
			)}
			{e2eeOverlayVisible && (
				<Overlay item={e2eeOverlay} name={OVERLAY_E2EE} />
			)}
		</div>
	);
};
