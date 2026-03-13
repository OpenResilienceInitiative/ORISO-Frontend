import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { useHistory, useLocation } from 'react-router-dom';

import { SendMessageButton } from './SendMessageButton';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
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
import { STATUS_ARCHIVED } from '../../globalState/interfaces';
import {
	apiPutDearchive,
	apiSendEnquiry,
	apiSendMessage,
	apiUploadAttachment,
	apiMatrixUploadFile,
	apiMatrixSendFileMessage
} from '../../api';
import {
	MessageSubmitInfo,
	MessageSubmitInfoInterface
} from './MessageSubmitInfo';
import {
	ATTACHMENT_MAX_SIZE_IN_MB,
	getAttachmentSizeMBForKB
} from './attachmentHelpers';
import { TypingIndicator } from '../typingIndicator/typingIndicator';
import PluginsEditor from '@draft-js-plugins/editor';
import {
	convertToRaw,
	DraftHandleValue,
	EditorState,
	RichUtils
} from 'draft-js';
import { draftToMarkdown } from 'markdown-draft-js';
import createLinkifyPlugin from '@draft-js-plugins/linkify';
import createToolbarPlugin from '@draft-js-plugins/static-toolbar';
import {
	BoldButton,
	ItalicButton,
	UnorderedListButton
} from '@draft-js-plugins/buttons';
import createEmojiPlugin from '@draft-js-plugins/emoji';
import {
	emojiPickerCustomClasses,
	escapeMarkdownChars,
	handleEditorBeforeInput,
	handleEditorPastedText,
	toolbarCustomClasses
} from './richtextHelpers';
import { ReactComponent as EmojiIcon } from '../../resources/img/icons/smiley-positive.svg';
import { ReactComponent as ClipIcon } from '../../resources/img/icons/clip.svg';
import { ReactComponent as AudioOnIcon } from '../../resources/img/icons/audio-on.svg';
import { ReactComponent as RichtextToggleIcon } from '../../resources/img/icons/richtext-toggle.svg';
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
	buildThreadPrefix
} from '../message/messageConstants';
import {
	encryptAttachment,
	encryptText,
	getSignature
} from '../../utils/encryptionHelpers';
import { useE2EE } from '../../hooks/useE2EE';
import { apiPostError, ERROR_LEVEL_WARN } from '../../api/apiPostError';
import { useE2EEViewElements } from '../../hooks/useE2EEViewElements';
import { Overlay } from '../overlay/Overlay';
import { useTimeoutOverlay } from '../../hooks/useTimeoutOverlay';
import { SubscriptionKeyLost } from '../session/SubscriptionKeyLost';
import { RoomNotFound } from '../session/RoomNotFound';
import { useDraftMessage } from './useDraftMessage';
import {
	STORAGE_KEY_ATTACHMENT_ENCRYPTION,
	useDevToolbar
} from '../devToolbar/DevToolbar';
import {
	OVERLAY_E2EE,
	OVERLAY_REQUEST
} from '../../globalState/interfaces/AppConfig/OverlaysConfigInterface';
import { getIconForAttachmentType } from '../message/messageHelpers';

//Linkify Plugin
const omitKey = (key, { [key]: _, ...obj }) => obj;
const linkifyPlugin = createLinkifyPlugin({
	component: (props) => {
		return (
			/* eslint-disable */
			<a
				{...omitKey('blockKey', props)}
				href={props.href}
				onClick={() => window.open(props.href, '_blank')}
			></a>
			/* eslint-enable */
		);
	}
});

//Static Toolbar Plugin
const staticToolbarPlugin = createToolbarPlugin({
	theme: toolbarCustomClasses
});
const { Toolbar } = staticToolbarPlugin;
const VOICE_RECORDING_MAX_DURATION_SEC = 180;

const INFO_TYPES = {
	ABSENT: 'ABSENT',
	ARCHIVED: 'ARCHIVED',
	ATTACHMENT_SIZE_ERROR: 'ATTACHMENT_SIZE_ERROR',
	ATTACHMENT_FORMAT_ERROR: 'ATTACHMENT_FORMAT_ERROR',
	ATTACHMENT_QUOTA_REACHED_ERROR: 'ATTACHMENT_QUOTA_REACHED_ERROR',
	ATTACHMENT_OTHER_ERROR: 'ATTACHMENT_OTHER_ERROR',
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
	isSupervisor?: boolean;
	threadRootId?: string | null;
	threadParentPreview?: string | null;
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
	isSupervisor,
	threadRootId,
	threadParentPreview
}: MessageSubmitInterfaceComponentProps) => {
	const { t: translate } = useTranslation();
	
	// Debug logging
	useEffect(() => {
		// console.log('🔥 MessageSubmitInterface MOUNTED');
		return () => {
			// console.log('🔥 MessageSubmitInterface UNMOUNTED');
		};
	}, []);
	const tenant = useTenant();
	const history = useHistory();
	const location = useLocation();
	const { getDevToolbarOption } = useDevToolbar();

	const textareaInputRef = useRef<HTMLDivElement>(null);
	const inputWrapperRef = useRef<HTMLSpanElement>(null);
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

	const [activeInfo, setActiveInfo] = useState(null);
	const [attachmentSelected, setAttachmentSelected] = useState<File | null>(
		null
	);
	const [uploadProgress, setUploadProgress] = useState(null);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const [attachmentUpload, setAttachmentUpload] =
		useState<XMLHttpRequest | null>(null);
	const [editorState, setEditorState] = useState(EditorState.createEmpty());
	const [isRichtextActive, setIsRichtextActive] = useState(false);
	const [isInputFocused, setIsInputFocused] = useState(false);
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
	const [voiceRecordingDurationSec, setVoiceRecordingDurationSec] = useState(0);
	const [voiceAttachmentDurationSec, setVoiceAttachmentDurationSec] = useState(0);
	const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);

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

		editorElement.focus();
	}, []);

	//Emoji Picker Plugin
	const emojiPlugin = useMemo(
		() =>
			createEmojiPlugin({
				theme: emojiPickerCustomClasses,
				useNativeArt: true,
				disableInlineEmojis: true,
				selectButtonContent: (
					<EmojiIcon
						aria-label={translate('enquiry.write.input.emojies')}
						title={translate('enquiry.write.input.emojies')}
					/>
				)
			}),
		[translate]
	);
	const { EmojiSelect } = emojiPlugin;

	// This loads the keys for current activeSession.rid which is already set:
	// to groupChat.groupId on group chats
	// to session.groupId on session chats
	const {
		keyID,
		key,
		encrypted,
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

	const draftTitle = useMemo(() => {
		const contact = getContact(activeSession);
		const topicName =
			typeof activeSession?.item?.topic === 'object'
				? activeSession?.item?.topic?.name
				: activeSession?.item?.topic;
		return (
			contact?.displayName ||
			contact?.username ||
			topicName ||
			null
		);
	}, [activeSession]);

	const forcedDraftScopeKey = useMemo(() => {
		const params = new URLSearchParams(location.search);
		const allScopeKeys = params.getAll('draftScopeKey');
		return allScopeKeys.length ? allScopeKeys[allScopeKeys.length - 1] : null;
	}, [location.search]);

	const {
		onChange: onDraftMessageChange,
		loaded: draftLoaded,
		clearDraftMessage
	} = useDraftMessage(!isRequestInProgress, setEditorState, {
		threadRootId: threadRootId || null,
		actionPath: draftActionPath,
		sessionId: activeSession?.item?.id ?? null,
		roomRef: activeSession?.rid ?? null,
		title: draftTitle,
		forcedScopeKey: forcedDraftScopeKey
	});


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

	const getTypedMarkdownMessage = useCallback(
		(currentEditorState?: EditorState) => {
			const contentState = currentEditorState
				? currentEditorState.getCurrentContent()
				: editorState.getCurrentContent();
			const rawObject = convertToRaw(escapeMarkdownChars(contentState));
			const markdownString = draftToMarkdown(rawObject, {
				escapeMarkdownCharacters: false
			});
			return markdownString.trim();
		},
		[editorState]
	);

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
		const editorContent = textInput.querySelector('.public-DraftEditor-content');
		const editorRoot = textInput.querySelector('.DraftEditor-root');
		const editorContentDiv = textInput.querySelector('.public-DraftEditor-content > div');
		
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
					lastChild.scrollIntoView({ behavior: 'auto', block: 'end', inline: 'nearest' });
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

	const handleEditorChange = useCallback(
		(currentEditorState) => {
			if (
				draftLoaded &&
				currentEditorState.getCurrentContent() !==
					editorState.getCurrentContent() &&
				isTyping
			) {
				isTyping(!currentEditorState.getCurrentContent().hasText());
			}
			setEditorState(currentEditorState);
			onDraftMessageChange(getTypedMarkdownMessage(currentEditorState));
			// Auto-scroll to bottom when content changes (new lines, formatting, bullet lists, etc.)
			// scrollEditorToBottom handles multiple attempts internally to catch DOM updates
			scrollEditorToBottom();
		},
		[
			draftLoaded,
			editorState,
			getTypedMarkdownMessage,
			isTyping,
			onDraftMessageChange,
			scrollEditorToBottom
		]
	);

	const handleEditorKeyCommand = useCallback(
		(command) => {
			const newState = RichUtils.handleKeyCommand(editorState, command);
			if (newState) {
				handleEditorChange(newState);
				// Auto-scroll after formatting is applied
				// Use multiple delays to catch DOM updates at different stages
				// Rich text mode needs more aggressive scrolling due to Draft.js DOM update delays
				if (isRichtextActive) {
					setTimeout(() => scrollEditorToBottom(), 0);
					setTimeout(() => scrollEditorToBottom(), 50);
					setTimeout(() => scrollEditorToBottom(), 150);
					setTimeout(() => scrollEditorToBottom(), 300);
					setTimeout(() => scrollEditorToBottom(), 500);
					setTimeout(() => scrollEditorToBottom(), 700);
				} else {
					setTimeout(() => scrollEditorToBottom(), 0);
					setTimeout(() => scrollEditorToBottom(), 50);
				}
				return 'handled';
			}
			return 'not-handled';
		},
		[editorState, handleEditorChange, isRichtextActive, scrollEditorToBottom]
	);

	const resizeTextarea = useCallback(() => {
		const textInput: any = textareaInputRef.current;
		if (!textInput) return;
		
		// Check if editor is empty - if so, reset to default height
		const hasText = editorState.getCurrentContent().hasText();
		
		// default values
		let textareaMaxHeight;
		if (window.innerWidth <= 900) {
			textareaMaxHeight = 118;
		} else {
			textareaMaxHeight = 218;
		}
		const richtextHeight = 38;
		const fileHeight = 48;

		// Default min heights from CSS: mobile 88px, desktop 106px
		const defaultMinHeight = window.innerWidth <= 900 ? 88 : 106;

		// If editor is empty, force it back to default height
		if (!hasText) {
			let textInputStyles = `height: ${defaultMinHeight}px !important; max-height: ${defaultMinHeight}px !important; min-height: ${defaultMinHeight}px !important; overflow-y: hidden !important;`;
			const textInputMarginTop = isRichtextActive
				? `margin-top: ${richtextHeight}px !important;`
				: '';
			const textInputMarginBottom = attachmentSelected
				? `margin-bottom: ${fileHeight}px !important;`
				: '';
			textInputStyles += ` ${textInputMarginTop} ${textInputMarginBottom}`;
			
			if (isRichtextActive) {
				textInputStyles += `border-top: none !important; border-top-right-radius: 0 !important; box-shadow: none !important;`;
			}
			if (attachmentSelected) {
				textInputStyles += `border-bottom: none !important; border-bottom-right-radius: 0 !important;`;
			}
			
			textInput.setAttribute('style', textInputStyles);
			
			// Force Draft.js containers to reset height
			const editorContainer = textInput.querySelector('.DraftEditor-root');
			if (editorContainer) {
				editorContainer.setAttribute('style', `height: ${defaultMinHeight}px !important; max-height: ${defaultMinHeight}px !important;`);
			}
			const editorContent = textInput.querySelector('.public-DraftEditor-content');
			if (editorContent) {
				editorContent.setAttribute('style', `height: ${defaultMinHeight}px !important; max-height: ${defaultMinHeight}px !important;`);
			}
			const editorContentDiv = textInput.querySelector('.public-DraftEditor-content > div');
			if (editorContentDiv) {
				editorContentDiv.setAttribute('style', `height: auto !important; max-height: none !important;`);
			}
			return;
		}

		// If editor has text, allow it to grow normally
		const textHeight = document.querySelector(
			'.public-DraftEditor-content > div'
		)?.scrollHeight;
		let textInputMaxHeight = isRichtextActive
			? textareaMaxHeight - richtextHeight
			: textareaMaxHeight;
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
		const textInputMarginTop = isRichtextActive
			? `margin-top: ${richtextHeight}px;`
			: '';
		const textInputMarginBottom = attachmentSelected
			? `margin-bottom: ${fileHeight}px;`
			: '';
		let textInputStyles = `min-height: ${currentInputHeight}px; ${currentOverflow} ${textInputMarginTop} ${textInputMarginBottom}`;
		textInputStyles = isRichtextActive
			? textInputStyles +
				`border-top: none; border-top-right-radius: 0; box-shadow: none;`
			: textInputStyles;
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
	}, [attachmentSelected, isRichtextActive, editorState, scrollEditorToBottom]);

	const toggleAbsentMessage = useCallback(() => {
		//TODO: not react way: use state and based on that set a class
		const infoWrapper = document.querySelector('.messageSubmitInfoWrapper');
		if (infoWrapper) {
			infoWrapper.classList.toggle('messageSubmitInfoWrapper--hidden');
		}
	}, []);

	// Track focus state for styling featureWrapper border - using activeElement check
	useEffect(() => {
		const checkFocus = () => {
			const inputElement = textareaInputRef.current;
			if (!inputElement) {
				setIsInputFocused(false);
				return;
			}

			// Find the Draft.js contenteditable element
			const editorElement = inputElement.querySelector('[contenteditable="true"]');
			const activeElement = document.activeElement;
			
			// Check if editor or any child is focused
			const isFocused = activeElement === editorElement || 
				(editorElement && editorElement.contains(activeElement)) ||
				(activeElement && inputElement.contains(activeElement));

			if (isFocused !== isInputFocused) {
				setIsInputFocused(isFocused);
				// console.log('🎯 Focus changed:', isFocused, 'Active element:', activeElement);
			}
		};

		// Check on focus/blur events
		const handleFocus = (e: FocusEvent) => {
			const inputElement = textareaInputRef.current;
			if (inputElement && inputElement.contains(e.target as Node)) {
				setTimeout(() => {
					setIsInputFocused(true);
					// console.log('🎯 Focus IN detected');
				}, 10);
			}
		};

		const handleBlur = (e: FocusEvent) => {
			const inputElement = textareaInputRef.current;
			if (inputElement && inputElement.contains(e.target as Node)) {
				setTimeout(() => {
					setIsInputFocused(false);
					// console.log('🎯 Focus OUT detected');
				}, 10);
			}
		};

		// Check periodically in case events are missed
		const interval = setInterval(checkFocus, 100);

		// Initial check
		checkFocus();

		document.addEventListener('focusin', handleFocus, true);
		document.addEventListener('focusout', handleBlur, true);

		return () => {
			clearInterval(interval);
			document.removeEventListener('focusin', handleFocus, true);
			document.removeEventListener('focusout', handleBlur, true);
		};
	}, [isInputFocused]);

	// Keep chat input ready for direct typing when opening/changing chats.
	useEffect(() => {
		// Do not steal focus from explicit thread reply input.
		if (threadRootId) {
			return;
		}
		if (!draftLoaded) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
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

	// Handle mobile keyboard - scroll input into view when focused
	useEffect(() => {
		const inputElement = textareaInputRef.current;
		if (!inputElement) return;

		const isMobile = window.innerWidth <= 900;
		if (!isMobile) return;

		const editorElement = inputElement.querySelector('[contenteditable="true"]') as HTMLElement;
		if (!editorElement) return;

		const scrollInputIntoView = () => {
			// Use visual viewport if available (modern mobile browsers)
			if (window.visualViewport) {
				// Wait for keyboard to appear
				setTimeout(() => {
					editorElement.scrollIntoView({ 
						behavior: 'smooth', 
						block: 'center',
						inline: 'nearest'
					});
				}, 300);
			} else {
				// Fallback for older browsers
				setTimeout(() => {
					editorElement.scrollIntoView({ 
						behavior: 'smooth', 
						block: 'center',
						inline: 'nearest'
					});
				}, 300);
			}
		};

		const handleFocus = () => {
			scrollInputIntoView();
		};

		// Handle visual viewport resize (keyboard appearing/disappearing)
		const handleViewportResize = () => {
			if (document.activeElement === editorElement || editorElement.contains(document.activeElement)) {
				scrollInputIntoView();
			}
		};

		editorElement.addEventListener('focus', handleFocus);
		
		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', handleViewportResize);
		}

		return () => {
			editorElement.removeEventListener('focus', handleFocus);
			if (window.visualViewport) {
				window.visualViewport.removeEventListener('resize', handleViewportResize);
			}
		};
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
				.then(() => setEditorState(EditorState.createEmpty()))
				.then(() => setIsRequestInProgress(false))
				.catch((error) => {
					// console.log(error);
				});
		},
		[
			activeSession.item.id,
			encryptRoom,
			language,
			onSendButton,
			setE2EEState
		]
	);

	const handleMessageSendSuccess = useCallback(() => {
		onMessageSendSuccess?.();
		setEditorState(EditorState.createEmpty());
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
	}, [clearDraftMessage, onMessageSendSuccess, resizeTextarea]);

	const sendMessage = useCallback(
		async (message, attachment: File, isEncrypted) => {
			const sendToRoomWithId = activeSession.rid || activeSession.item.id;
		// MATRIX MIGRATION: Determine if this is a Matrix session
		// Matrix sessions have either no rid, or rid is a Matrix room ID (starts with '!')
		const isMatrixSession = (!activeSession.rid || (activeSession.rid && activeSession.rid.startsWith('!'))) && activeSession.item?.id;
		const matrixSessionId = isMatrixSession ? activeSession.item.id : undefined;
			const getSendMailNotificationStatus = () => !activeSession.isGroup;

			if (attachment) {
				let res: any;

				// MATRIX MIGRATION: Use direct Matrix upload for Matrix sessions
				if (matrixSessionId) {
					// console.log('📤 Using Matrix direct upload for session:', matrixSessionId);
					
					try {
						// Upload file to Matrix via UserService
						// UserService handles: upload + send message automatically
						const uploadResult = await apiMatrixUploadFile(
							attachment,
							matrixSessionId,
							setUploadProgress,
							setAttachmentUpload
						);
						
						// console.log('✅ Matrix upload and message sent successfully!', uploadResult);
						res = { success: true };
					} catch (error: any) {
						// console.error('❌ Matrix upload failed:', error);
						const xhr = error as XMLHttpRequest;
						if (xhr.status === 413) {
							handleAttachmentUploadError(
								INFO_TYPES.ATTACHMENT_SIZE_ERROR
							);
						} else if (xhr.status === 415) {
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
					// Legacy RocketChat upload path
					const isAttachmentEncryptionEnabledDevTools = parseInt(
						getDevToolbarOption(STORAGE_KEY_ATTACHMENT_ENCRYPTION)
					);
					let attachmentFile = attachment;
					let signature = null;
					let encryptEnabled =
						isEncrypted && !!isAttachmentEncryptionEnabledDevTools;

					if (encryptEnabled) {
						try {
							signature = await getSignature(attachment);
							attachmentFile = await encryptAttachment(
								attachment,
								keyID,
								key
							);
						} catch (e: any) {
							encryptEnabled = false;

							apiPostError({
								name: e.name,
								message: e.message,
								stack: e.stack,
								level: ERROR_LEVEL_WARN
							}).then();
						}
					}

					res = await apiUploadAttachment(
						attachmentFile,
						sendToRoomWithId,
						getSendMailNotificationStatus(),
						setUploadProgress,
						setAttachmentUpload,
						encryptEnabled,
						signature
					).catch((res: XMLHttpRequest) => {
						if (res.status === 413) {
							handleAttachmentUploadError(
								INFO_TYPES.ATTACHMENT_SIZE_ERROR
							);
						} else if (res.status === 415) {
							handleAttachmentUploadError(
								INFO_TYPES.ATTACHMENT_FORMAT_ERROR
							);
						} else if (
							res.status === 403 &&
							res.getResponseHeader('X-Reason') === 'QUOTA_REACHED'
						) {
							handleAttachmentUploadError(
								INFO_TYPES.ATTACHMENT_QUOTA_REACHED_ERROR
							);
						} else {
							handleAttachmentUploadError(
								INFO_TYPES.ATTACHMENT_OTHER_ERROR
							);
						}

						return null;
					});

					if (!res) {
						return;
					}
				}
			}

			// For Matrix: if we uploaded an attachment, the message was already sent with it
			// Only send a separate text message if there's text and no attachment
			const shouldSendTextMessage = getTypedMarkdownMessage() && (!attachment || !matrixSessionId);
			
			if (shouldSendTextMessage) {
				// MATRIX MIGRATION: For group chats, Matrix room ID is in activeSession.rid
				const matrixRoomId = activeSession.rid && activeSession.rid.startsWith('!') 
					? activeSession.rid 
					: activeSession.item?.matrixRoomId;
				
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
					threadParentPreview || null
				)
					.then(() => encryptRoom(setE2EEState))
					.then(() => {
						onSendButton && onSendButton();
						handleMessageSendSuccess();
						cleanupAttachment();
					})
					.catch((error) => {
						setIsRequestInProgress(false);
						// console.log(error);
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
			activeSession.isGroup,
			activeSession.item.id,
			activeSession.rid,
			cleanupAttachment,
			encryptRoom,
			getDevToolbarOption,
			getTypedMarkdownMessage,
			handleAttachmentUploadError,
			handleMessageSendSuccess,
			key,
			keyID,
			onSendButton,
			setE2EEState
		]
	);

	const prepareAndSendMessage = useCallback(async () => {
		const attachmentInput: any = attachmentInputRef.current;
		const selectedFile = attachmentInput && attachmentInput.files[0];
		const attachment = preselectedFile || selectedFile;

		if (isE2eeEnabled && encrypted && !keyID) {
			// console.error("Can't send message without key");
			return;
		}

		if (getTypedMarkdownMessage() || attachment) {
			setIsRequestInProgress(true);
		} else {
			return null;
		}

		let message = getTypedMarkdownMessage().trim();
		const prefixParts: string[] = [];
		if (threadRootId) {
			prefixParts.push(buildThreadPrefix(threadRootId));
		}
		if (isSupervisor) {
			prefixParts.push(SUPERVISOR_FEEDBACK_PREFIX);
		}
		if (prefixParts.length && message.length > 0) {
			message = `${prefixParts.join(' ')} ${message}`;
		}
		let isEncrypted = isE2eeEnabled;
		if (message.length > 0 && isE2eeEnabled) {
			try {
				message = await encryptText(message, keyID, key);
			} catch (e: any) {
				apiPostError({
					name: e.name,
					message: e.message,
					stack: e.stack,
					level: ERROR_LEVEL_WARN
				}).then();

				isEncrypted = false;
			}
		}

		if (
			type === SESSION_LIST_TYPES.ENQUIRY &&
			hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)
		) {
			await sendEnquiry(message, isEncrypted);
			return;
		}

		await sendMessage(message, attachment, isEncrypted);
	}, [
		encrypted,
		getTypedMarkdownMessage,
		isE2eeEnabled,
		key,
		keyID,
		preselectedFile,
		sendEnquiry,
		sendMessage,
		type,
		userData
	]);

	const handleButtonClick = useCallback(() => {
		if (uploadProgress || isRequestInProgress) {
			return null;
		}
		if (isVoiceRecording) {
			stopVoiceRecording({ sendAfterStop: true });
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
								history.push(
									`${listPath}/${activeSession.item.groupId}/${activeSession.item.id}}`
								);
							} else {
								mobileListView();
								history.push(listPath);
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
		history,
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

	// Key binding function for Draft.js to handle Ctrl+Enter / Cmd+Enter
	// Only returns a command when modifier keys are pressed, otherwise returns undefined
	// to let Draft.js handle Enter normally (create new line)
	const keyBindingFn = useCallback((e: React.KeyboardEvent) => {
		// Handle Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac) to send message
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			return 'send-message';
		}
		// Return undefined (not null) to let Draft.js handle Enter normally
		return undefined;
	}, []);

	// Enhanced handleEditorKeyCommand to handle send message shortcut
	const enhancedHandleEditorKeyCommand = useCallback(
		(command) => {
			// Handle send message command (Ctrl+Enter / Cmd+Enter)
			if (command === 'send-message') {
				if (!uploadProgress && !isRequestInProgress) {
					handleButtonClick();
				}
				return 'handled';
			}
			// If command is null/undefined, return 'not-handled' to let Draft.js handle Enter normally
			if (command == null) {
				return 'not-handled';
			}
			// For all other commands, delegate to original handler
			return handleEditorKeyCommand(command);
		},
		[handleEditorKeyCommand, uploadProgress, isRequestInProgress, handleButtonClick]
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
		history.push('/booking/');
	}, [history]);

	const hasUploadFunctionality =
		(type !== SESSION_LIST_TYPES.ENQUIRY ||
			(type === SESSION_LIST_TYPES.ENQUIRY &&
				!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData))) &&
		!tenant?.settings?.featureAttachmentUploadDisabled;
	const contact = getContact(activeSession);
	const isAnonymousChat =
		activeSession.item.postcode === 0 ||
		activeSession.item.postcode?.toString() === '00000' ||
		(activeSession.item as any).registrationType === 'ANONYMOUS' ||
		contact?.username?.startsWith('Anonymous-') ||
		activeSession.user?.username?.startsWith('Anonymous-');
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

				const mimeType = recorder.mimeType || supportedMimeType || 'audio/webm';
				const blob = new Blob(chunks, { type: mimeType });
				if (blob.size > 0) {
					const elapsedMs = voiceRecordingStartedAtRef.current
						? Math.max(1000, Date.now() - voiceRecordingStartedAtRef.current)
						: Math.max(1000, voiceRecordingDurationRef.current * 1000);
					const elapsedSec = Math.max(1, Math.round(elapsedMs / 1000));
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

	const isVoiceAttachmentSelected = !!attachmentSelected?.type?.startsWith('audio/');
	const formatRecordingDuration = useCallback((totalSeconds: number) => {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
	}, []);

	// MATRIX MIGRATION: Skip E2EE check for Matrix sessions (no rid)
	if (!e2EEReady && activeSession.rid) {
		return null;
	}

	if (subscriptionKeyLost && activeSession.rid) {
		return <SubscriptionKeyLost />;
	}

	// Ignore the missing room if session has no roomId
	if (roomNotFound && activeSession.rid) {
		return <RoomNotFound />;
	}

	return (
		<div
			className={clsx(
				className,
				'messageSubmit__wrapper',
				isTypingActive && 'messageSubmit__wrapper--withTyping'
			)}
		>
			{isTypingActive && (
				<TypingIndicator
					disabled={!(typingUsers && typingUsers.length > 0)}
					typingUsers={typingUsers}
				/>
			)}
			{activeInfo && <MessageSubmitInfo {...getMessageSubmitInfo()} />}

			<form className="textarea">
				<div className={'textarea__wrapper'}>
					<div className="textarea__wrapper-send-message">
						<span className={`textarea__featureWrapper ${isInputFocused ? 'textarea__featureWrapper--focused' : ''}`}>
							<span className="textarea__richtextToggle">
								<RichtextToggleIcon
									width="20"
									height="20"
									onClick={() =>
										setIsRichtextActive(!isRichtextActive)
									}
									title={translate(
										'enquiry.write.input.format'
									)}
									aria-label={translate(
										'enquiry.write.input.format'
									)}
								/>
							</span>
							<EmojiSelect />
						</span>
						<span
							className="textarea__inputWrapper"
							ref={inputWrapperRef}
						>
							<div
								className="textarea__input"
								ref={textareaInputRef}
								onKeyUp={(e) => {
									resizeTextarea();
									// Auto-scroll on Enter key or any key press
									// Enter key especially needs multiple delayed scrolls to catch DOM updates
									// Rich text mode needs more aggressive scrolling due to Draft.js DOM update delays
									if (e.key === 'Enter' && isRichtextActive) {
										// Multiple delayed scrolls for Enter key in rich text mode to ensure DOM has updated
										setTimeout(() => scrollEditorToBottom(), 0);
										setTimeout(() => scrollEditorToBottom(), 50);
										setTimeout(() => scrollEditorToBottom(), 150);
										setTimeout(() => scrollEditorToBottom(), 300);
										setTimeout(() => scrollEditorToBottom(), 500);
										setTimeout(() => scrollEditorToBottom(), 700);
									} else if (e.key === 'Enter') {
										// Enter key in non-rich text mode (simpler, less delays needed)
										setTimeout(() => scrollEditorToBottom(), 0);
										setTimeout(() => scrollEditorToBottom(), 50);
									} else {
										setTimeout(() => scrollEditorToBottom(), 0);
									}
								}}
							>
								<Toolbar>
									{(externalProps) => (
										<div className="textarea__toolbar__buttonWrapper">
											<BoldButton {...externalProps} />
											<ItalicButton {...externalProps} />
											<UnorderedListButton
												{...externalProps}
											/>
										</div>
									)}
								</Toolbar>
								<PluginsEditor
									editorState={editorState}
									onChange={handleEditorChange}
									readOnly={!draftLoaded || !!attachmentSelected || !!uploadProgress}
									handleKeyCommand={enhancedHandleEditorKeyCommand}
									keyBindingFn={keyBindingFn}
									placeholder={attachmentSelected ? '' : placeholder}
									stripPastedStyles={true}
									spellCheck={true}
									handleBeforeInput={() =>
										handleEditorBeforeInput(editorState)
									}
									handlePastedText={(
										text: string,
										html?: string
									): DraftHandleValue => {
										const newEditorState =
											handleEditorPastedText(
												editorState,
												text,
												html
											);
										if (newEditorState) {
											setEditorState(newEditorState);
										}
										return 'handled';
									}}
									plugins={[
										linkifyPlugin,
										staticToolbarPlugin,
										emojiPlugin
									]}
									tabIndex={0}
								/>
							</div>
							{hasUploadFunctionality &&
								(!attachmentSelected ? (
									<span className="textarea__attachmentSelect">
										{isVoiceMessageEnabledForCurrentChat && isVoiceRecording ? (
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
														stopVoiceRecording({ discard: true })
													}
												>
													{translate('app.cancel', 'Cancel')}
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
										) : isVoiceMessageEnabledForCurrentChat ? (
											<>
												<button
													type="button"
													className={clsx(
														'textarea__voiceRecordButton'
													)}
													onClick={toggleVoiceRecording}
													title={translate(
														'voice.recording.toggle',
														'Record voice message'
													)}
													aria-label={translate(
														'voice.recording.toggle',
														'Record voice message'
													)}
												>
													<AudioOnIcon />
												</button>
												<ClipIcon
													aria-label={translate(
														'enquiry.write.input.attachement'
													)}
													title={translate(
														'enquiry.write.input.attachement'
													)}
													onClick={handleAttachmentSelect}
												/>
											</>
										) : (
											<ClipIcon
												aria-label={translate(
													'enquiry.write.input.attachement'
												)}
												title={translate(
													'enquiry.write.input.attachement'
												)}
												onClick={handleAttachmentSelect}
											/>
										)}
									</span>
								) : (
									<div className="textarea__attachmentWrapper">
										{isVoiceAttachmentSelected ? (
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
														onClick={handleAttachmentRemoval}
														title={translate('app.remove')}
														aria-label={translate('app.remove')}
													/>
												</span>
											</div>
										) : (
											<span className="textarea__attachmentSelected">
												<span className="textarea__attachmentSelected__progress"></span>
												<span className="textarea__attachmentSelected__labelWrapper">
													{getAttachmentIcon(
														attachmentSelected.type
													)}
													<p className="textarea__attachmentSelected__label">
														{attachmentSelected.name}
													</p>
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
												</span>
											</span>
										)}
									</div>
								))}
						</span>
						<div className="textarea__buttons">
							<SendMessageButton
								handleSendButton={handleButtonClick}
								clicked={isRequestInProgress}
								deactivated={
									!attachmentSelected && 
									(!getTypedMarkdownMessage() || getTypedMarkdownMessage().trim().length === 0)
								}
								isEmpty={
									!attachmentSelected && 
									(!getTypedMarkdownMessage() || getTypedMarkdownMessage().trim().length === 0)
								}
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





