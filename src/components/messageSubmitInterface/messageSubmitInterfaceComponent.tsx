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
	ContentState,
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
	normalizeHighlightColor,
	toolbarCustomClasses
} from './richtextHelpers';
import { ReactComponent as EmojiIcon } from '../../resources/img/icons/smiley-positive.svg';
import { ReactComponent as ClipIcon } from '../../resources/img/icons/clip.svg';
import { ReactComponent as AudioOnIcon } from '../../resources/img/icons/audio-on.svg';
import { ReactComponent as RichtextToggleIcon } from '../../resources/img/icons/richtext-toggle.svg';
import { ReactComponent as RemoveIcon } from '../../resources/img/icons/x.svg';
import { ReactComponent as CalendarMonthIcon } from '../../resources/img/icons/calendar-month-navigation.svg';
import { ReactComponent as PersonCircleIcon } from '../../resources/img/icons/person-circle.svg';
import { ReactComponent as ArrowDownIcon } from '../../resources/img/icons/arrow-down.svg';
import './emojiPicker.styles';
import './messageSubmitInterface.styles';
import clsx from 'clsx';
import { mobileListView } from '../app/navigationHandler';
import { Button, ButtonItem, BUTTON_TYPES } from '../button/Button';
import { Headline } from '../headline/Headline';
import { useTranslation } from 'react-i18next';
import {
	SUPERVISOR_FEEDBACK_PREFIX,
	buildVisibleToPrefix,
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
import {
	TipTapComposer,
	TipTapComposerRef
} from './TipTapComposer';
import { HIGHLIGHT_SNIPPET_SELECTED_EVENT } from './highlightSnippetEvents';

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
	const ToolbarUndoIcon = () => (
		<svg width="16" height="15" viewBox="0 0 16 15" fill="none" aria-hidden="true">
			<path
				d="M3 15V13H10.1C11.15 13 12.0625 12.6667 12.8375 12C13.6125 11.3333 14 10.5 14 9.5C14 8.5 13.6125 7.66667 12.8375 7C12.0625 6.33333 11.15 6 10.1 6H3.8L6.4 8.6L5 10L0 5L5 0L6.4 1.4L3.8 4H10.1C11.7167 4 13.1042 4.525 14.2625 5.575C15.4208 6.625 16 7.93333 16 9.5C16 11.0667 15.4208 12.375 14.2625 13.425C13.1042 14.475 11.7167 15 10.1 15H3Z"
				fill="currentColor"
			/>
		</svg>
	);

	const ToolbarRedoIcon = () => (
		<svg width="16" height="15" viewBox="0 0 16 15" fill="none" aria-hidden="true">
			<path
				d="M5.9 15C4.28333 15 2.89583 14.475 1.7375 13.425C0.579167 12.375 0 11.0667 0 9.5C0 7.93333 0.579167 6.625 1.7375 5.575C2.89583 4.525 4.28333 4 5.9 4H12.2L9.6 1.4L11 0L16 5L11 10L9.6 8.6L12.2 6H5.9C4.85 6 3.9375 6.33333 3.1625 7C2.3875 7.66667 2 8.5 2 9.5C2 10.5 2.3875 11.3333 3.1625 12C3.9375 12.6667 4.85 13 5.9 13H13V15H5.9Z"
				fill="currentColor"
			/>
		</svg>
	);

	const ToolbarFilterIcon = () => (
		<span className="textarea__figmaToolbarIcon textarea__figmaToolbarIcon--filter" aria-hidden="true">
			<svg width="14" height="2" viewBox="0 0 14 2" fill="none">
				<path
					d="M13.44 0.96C13.44 0.705 13.3388 0.461256 13.1587 0.281256C12.9787 0.101256 12.735 0 12.48 0H0.96C0.429384 0 0 0.429384 0 0.96C0 1.49062 0.429384 1.92 0.96 1.92H12.48C12.735 1.92 12.9787 1.81875 13.1587 1.63874C13.3387 1.45874 13.44 1.215 13.44 0.96Z"
					fill="currentColor"
				/>
			</svg>
			<svg width="16" height="7" viewBox="0 0 16 7" fill="none">
				<path
					d="M3.24 6.48H12.12C13.9097 6.48 15.36 5.02968 15.36 3.24C15.36 1.45032 13.9097 0 12.12 0H3.24C1.45032 0 0 1.45032 0 3.24C0 5.02968 1.45032 6.48 3.24 6.48ZM3.24 1.92H12.12C12.8494 1.92 13.44 2.51062 13.44 3.24C13.44 3.96938 12.8494 4.56 12.12 4.56H3.24C2.51062 4.56 1.92 3.96938 1.92 3.24C1.92 2.51062 2.51062 1.92 3.24 1.92Z"
					fill="currentColor"
				/>
			</svg>
			<svg width="9" height="2" viewBox="0 0 9 2" fill="none">
				<path
					d="M0.96 0C0.429384 0 0 0.429384 0 0.96C0 1.49062 0.429384 1.92 0.96 1.92H7.68C8.21062 1.92 8.64 1.49062 8.64 0.96C8.64 0.429384 8.21062 0 7.68 0H0.96Z"
					fill="currentColor"
				/>
			</svg>
		</span>
	);

	const ToolbarBoldIcon = () => (
		<svg width="11" height="14" viewBox="0 0 11 14" fill="none" aria-hidden="true">
			<path
				d="M0 14V0H5.525C6.60833 0 7.60833 0.333333 8.525 1C9.44167 1.66667 9.9 2.59167 9.9 3.775C9.9 4.625 9.70833 5.27917 9.325 5.7375C8.94167 6.19583 8.58333 6.525 8.25 6.725C8.66667 6.90833 9.12917 7.25 9.6375 7.75C10.1458 8.25 10.4 9 10.4 10C10.4 11.4833 9.85833 12.5208 8.775 13.1125C7.69167 13.7042 6.675 14 5.725 14H0ZM3.025 11.2H5.625C6.425 11.2 6.9125 10.9958 7.0875 10.5875C7.2625 10.1792 7.35 9.88333 7.35 9.7C7.35 9.51667 7.2625 9.22083 7.0875 8.8125C6.9125 8.40417 6.4 8.2 5.55 8.2H3.025V11.2ZM3.025 5.5H5.35C5.9 5.5 6.3 5.35833 6.55 5.075C6.8 4.79167 6.925 4.475 6.925 4.125C6.925 3.725 6.78333 3.4 6.5 3.15C6.21667 2.9 5.85 2.775 5.4 2.775H3.025V5.5Z"
				fill="currentColor"
			/>
		</svg>
	);

	const ToolbarListPlusIcon = () => (
		<svg width="20" height="19" viewBox="0 0 20 19" fill="none" aria-hidden="true">
			<path
				d="M14.5 17H15.5V14.5H18V13.5H15.5V11H14.5V13.5H12V14.5H14.5V17ZM15 19C13.6167 19 12.4375 18.5125 11.4625 17.5375C10.4875 16.5625 10 15.3833 10 14C10 12.6167 10.4875 11.4375 11.4625 10.4625C12.4375 9.4875 13.6167 9 15 9C16.3833 9 17.5625 9.4875 18.5375 10.4625C19.5125 11.4375 20 12.6167 20 14C20 15.3833 19.5125 16.5625 18.5375 17.5375C17.5625 18.5125 16.3833 19 15 19ZM6 3V1H18V3H6ZM2 16C1.45 16 0.979167 15.8042 0.5875 15.4125C0.195833 15.0208 0 14.55 0 14C0 13.45 0.195833 12.9792 0.5875 12.5875C0.979167 12.1958 1.45 12 2 12C2.55 12 3.02083 12.1958 3.4125 12.5875C3.80417 12.9792 4 13.45 4 14C4 14.55 3.80417 15.0208 3.4125 15.4125C3.02083 15.8042 2.55 16 2 16ZM2 10C1.45 10 0.979167 9.80417 0.5875 9.4125C0.195833 9.02083 0 8.55 0 8C0 7.45 0.195833 6.97917 0.5875 6.5875C0.979167 6.19583 1.45 6 2 6C2.55 6 3.02083 6.19583 3.4125 6.5875C3.80417 6.97917 4 7.45 4 8C4 8.55 3.80417 9.02083 3.4125 9.4125C3.02083 9.80417 2.55 10 2 10ZM0.5875 3.4125C0.195833 3.02083 0 2.55 0 2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0C2.55 0 3.02083 0.195833 3.4125 0.5875C3.80417 0.979167 4 1.45 4 2C4 2.55 3.80417 3.02083 3.4125 3.4125C3.02083 3.80417 2.55 4 2 4C1.45 4 0.979167 3.80417 0.5875 3.4125ZM6 15V13H8.075C8.025 13.3333 8 13.6667 8 14C8 14.3333 8.025 14.6667 8.075 15H6ZM6 9V7H15C14.05 7 13.1583 7.17917 12.325 7.5375C11.4917 7.89583 10.7583 8.38333 10.125 9H6Z"
				fill="currentColor"
			/>
		</svg>
	);

	const ToolbarItalicIcon = () => (
		<svg width="13" height="14" viewBox="0 0 13 14" fill="none" aria-hidden="true">
			<path d="M0 14V11.5H4L7 2.5H3V0H13V2.5H9.5L6.5 11.5H10V14H0Z" fill="currentColor" />
		</svg>
	);

	const ToolbarListTextIcon = () => (
		<svg width="18" height="20" viewBox="0 0 18 20" fill="none" aria-hidden="true">
			<path
				d="M0 20V18.5H2.5V17.75H1V16.25H2.5V15.5H0V14H3C3.28333 14 3.52083 14.0958 3.7125 14.2875C3.90417 14.4792 4 14.7167 4 15V16C4 16.2833 3.90417 16.5208 3.7125 16.7125C3.52083 16.9042 3.28333 17 3 17C3.28333 17 3.52083 17.0958 3.7125 17.2875C3.90417 17.4792 4 17.7167 4 18V19C4 19.2833 3.90417 19.5208 3.7125 19.7125C3.52083 19.9042 3.28333 20 3 20H0ZM0 13V10.25C0 9.96667 0.0958333 9.72917 0.2875 9.5375C0.479167 9.34583 0.716667 9.25 1 9.25H2.5V8.5H0V7H3C3.28333 7 3.52083 7.09583 3.7125 7.2875C3.90417 7.47917 4 7.71667 4 8V9.75C4 10.0333 3.90417 10.2708 3.7125 10.4625C3.52083 10.6542 3.28333 10.75 3 10.75H1.5V11.5H4V13H0ZM1.5 6V1.5H0V0H3V6H1.5ZM6 17V15H18V17H6ZM6 11V9H18V11H6ZM6 5V3H18V5H6Z"
				fill="currentColor"
			/>
		</svg>
	);

	const ToolbarPenIcon = () => (
		<svg width="21" height="22" viewBox="0 0 21 22" fill="none" aria-hidden="true">
			<path
				d="M0 22V18H20V22H0ZM12.6 10L10 7.4L6 11.4L8.575 14L12.6 10ZM11.425 6L14 8.575L18 4.6L15.4 2L11.425 6ZM9.325 5.275L14.725 10.675L10 15.425C9.6 15.825 9.12917 16.025 8.5875 16.025C8.04583 16.025 7.575 15.825 7.175 15.425L6.5 16H1.5L4.65 12.875C4.25 12.475 4.04167 11.9958 4.025 11.4375C4.00833 10.8792 4.2 10.4 4.6 10L9.325 5.275ZM9.325 5.275L14 0.6C14.4 0.2 14.8708 0 15.4125 0C15.9542 0 16.425 0.2 16.825 0.6L19.425 3.175C19.825 3.575 20.025 4.04583 20.025 4.5875C20.025 5.12917 19.825 5.6 19.425 6L14.725 10.675L9.325 5.275Z"
				fill="currentColor"
			/>
		</svg>
	);

	const ToolbarFacePlusIcon = () => (
		<svg width="22" height="21" viewBox="0 0 22 21" fill="none" aria-hidden="true">
			<path
				d="M10 21C8.61667 21 7.31667 20.7375 6.1 20.2125C4.88333 19.6875 3.825 18.975 2.925 18.075C2.025 17.175 1.3125 16.1167 0.7875 14.9C0.2625 13.6833 0 12.3833 0 11C0 9.61667 0.2625 8.31667 0.7875 7.1C1.3125 5.88333 2.025 4.825 2.925 3.925C3.825 3.025 4.88333 2.3125 6.1 1.7875C7.31667 1.2625 8.61667 1 10 1C10.7167 1 11.4083 1.07083 12.075 1.2125C12.7417 1.35417 13.3833 1.55833 14 1.825V4.075C13.4167 3.74167 12.7875 3.47917 12.1125 3.2875C11.4375 3.09583 10.7333 3 10 3C7.78333 3 5.89583 3.77917 4.3375 5.3375C2.77917 6.89583 2 8.78333 2 11C2 13.2167 2.77917 15.1042 4.3375 16.6625C5.89583 18.2208 7.78333 19 10 19C12.2167 19 14.1042 18.2208 15.6625 16.6625C17.2208 15.1042 18 13.2167 18 11C18 10.4667 17.9458 9.95 17.8375 9.45C17.7292 8.95 17.5833 8.46667 17.4 8H19.55C19.7 8.48333 19.8125 8.97083 19.8875 9.4625C19.9625 9.95417 20 10.4667 20 11C20 12.3833 19.7375 13.6833 19.2125 14.9C18.6875 16.1167 17.975 17.175 17.075 18.075C16.175 18.975 15.1167 19.6875 13.9 20.2125C12.6833 20.7375 11.3833 21 10 21ZM18 6V4H16V2H18V0H20V2H22V4H20V6H18ZM13.5 10C13.9167 10 14.2708 9.85417 14.5625 9.5625C14.8542 9.27083 15 8.91667 15 8.5C15 8.08333 14.8542 7.72917 14.5625 7.4375C14.2708 7.14583 13.9167 7 13.5 7C13.0833 7 12.7292 7.14583 12.4375 7.4375C12.1458 7.72917 12 8.08333 12 8.5C12 8.91667 12.1458 9.27083 12.4375 9.5625C12.7292 9.85417 13.0833 10 13.5 10ZM6.5 10C6.91667 10 7.27083 9.85417 7.5625 9.5625C7.85417 9.27083 8 8.91667 8 8.5C8 8.08333 7.85417 7.72917 7.5625 7.4375C7.27083 7.14583 6.91667 7 6.5 7C6.08333 7 5.72917 7.14583 5.4375 7.4375C5.14583 7.72917 5 8.08333 5 8.5C5 8.91667 5.14583 9.27083 5.4375 9.5625C5.72917 9.85417 6.08333 10 6.5 10ZM13.0875 15.5375C14.0125 14.8958 14.6833 14.05 15.1 13H4.9C5.31667 14.05 5.9875 14.8958 6.9125 15.5375C7.8375 16.1792 8.86667 16.5 10 16.5C11.1333 16.5 12.1625 16.1792 13.0875 15.5375Z"
				fill="currentColor"
			/>
		</svg>
	);

	const ToolbarImageAddIcon = () => (
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
			<path
				d="M2 18C1.45 18 0.979167 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H10V2H2V16H16V8H18V16C18 16.55 17.8042 17.0208 17.4125 17.4125C17.0208 17.8042 16.55 18 16 18H2ZM3 14H15L11.25 9L8.25 13L6 10L3 14ZM14 6V4H12V2H14V0H16V2H18V4H16V6H14Z"
				fill="currentColor"
			/>
		</svg>
	);

	const ToolbarSearchCalendarIcon = () => (
		<span className="textarea__figmaToolbarIcon textarea__figmaToolbarIcon--search-calendar" aria-hidden="true">
			<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M7.44562 6.03187C7.79813 5.43655 7.99968 4.74187 7.99968 4.00032C7.99968 1.79158 6.20906 0 3.99936 0C1.79062 0 0 1.79155 0 4.00032C0 6.20909 1.79062 8.00064 3.99936 8.00064C4.74187 8.00064 5.43655 7.79814 6.03187 7.44658L8.29219 9.70783C8.68313 10.0978 9.31594 10.0978 9.70687 9.70783C10.0969 9.3169 10.0969 8.68409 9.70687 8.29315L7.44562 6.03187ZM3.99946 6C5.10478 6 6.00007 5.10468 6.00007 4.00032C6.00007 2.89596 5.10475 2.00064 3.99946 2.00064C2.89507 2.00064 1.99978 2.89596 1.99978 4.00032C1.99978 5.10468 2.8951 6 3.99946 6Z"
					fill="currentColor"
				/>
			</svg>
			<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M11.0007 1.00032C11.0007 0.448128 10.5525 0 10.0003 0C9.44815 0 9.00002 0.448128 9.00002 1.00032H6.00002C6.00002 0.448128 5.55283 0 5.00064 0C4.44845 0 4.00032 0.448128 4.00032 1.00032C1.79158 1.00032 0 2.79094 0 5.00064V16.0003C0 18.2091 1.79155 20.0006 4.00032 20.0006H16.0003C18.2091 20.0006 20.0006 18.2091 20.0006 16.0003V5.00064C20.0006 2.79096 18.2091 1.00032 16.0003 1.00032C16.0003 0.448128 15.5522 0 15 0C14.4478 0 14.0006 0.448128 14.0006 1.00032H11.0007ZM4.00034 3C2.89596 3 2.00066 3.89532 2.00066 5.00062V16.0003C2.00066 17.1047 2.89598 18 4.00034 18H16.0003C17.1047 18 18 17.1047 18 16.0003V5.00062C18 3.8953 17.1047 3 16.0003 3C16.0003 3.55219 15.5522 4.00032 15 4.00032C14.4478 4.00032 14.0006 3.55219 14.0006 3H11.0006C11.0006 3.55219 10.5525 4.00032 10.0003 4.00032C9.44813 4.00032 9 3.55219 9 3H6C6 3.55219 5.55281 4.00032 5.00062 4.00032C4.44842 4.00032 4.00034 3.55219 4.00034 3Z"
					fill="currentColor"
				/>
			</svg>
		</span>
	);

	const ToolbarToggleIcon = () => (
		<svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden="true">
			<path d="M7 14C5.05 14 3.39583 13.3208 2.0375 11.9625C0.679167 10.6042 0 8.95 0 7C0 5.05 0.679167 3.39583 2.0375 2.0375C3.39583 0.679167 5.05 0 7 0H15C16.95 0 18.6042 0.679167 19.9625 2.0375C21.3208 3.39583 22 5.05 22 7C22 8.95 21.3208 10.6042 19.9625 11.9625C18.6042 13.3208 16.95 14 15 14H7ZM7 12H15C16.3833 12 17.5625 11.5125 18.5375 10.5375C19.5125 9.5625 20 8.38333 20 7C20 5.61667 19.5125 4.4375 18.5375 3.4625C17.5625 2.4875 16.3833 2 15 2H7C5.61667 2 4.4375 2.4875 3.4625 3.4625C2.4875 4.4375 2 5.61667 2 7C2 8.38333 2.4875 9.5625 3.4625 10.5375C4.4375 11.5125 5.61667 12 7 12ZM7.25 10H8.75V7.75H11V6.25H8.75V4H7.25V6.25H5V7.75H7.25V10ZM14.5 10H16V4H13V5.5H14.5V10Z" fill="currentColor" />
		</svg>
	);

	const ToolbarFaceIcon = () => (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<mask
				id="toolbar-face-mask"
				style={{ maskType: 'alpha' }}
				maskUnits="userSpaceOnUse"
				x="0"
				y="0"
				width="24"
				height="24"
			>
				<rect width="24" height="24" fill="#D9D9D9" />
			</mask>
			<g mask="url(#toolbar-face-mask)">
				<path
					d="M7.8 18C6.95 18 6.1375 17.85 5.3625 17.55C4.5875 17.25 3.89167 16.8083 3.275 16.225C2.475 15.475 1.89583 14.5875 1.5375 13.5625C1.17917 12.5375 1 11.475 1 10.375C1 9.075 1.31667 8.02083 1.95 7.2125C2.58333 6.40417 3.50833 6 4.725 6C4.95833 6 5.17917 6.02083 5.3875 6.0625C5.59583 6.10417 5.80833 6.16667 6.025 6.25L12 8.475L17.975 6.25C18.1917 6.16667 18.4042 6.10417 18.6125 6.0625C18.8208 6.02083 19.0417 6 19.275 6C20.4917 6 21.4167 6.40417 22.05 7.2125C22.6833 8.02083 23 9.075 23 10.375C23 11.475 22.8208 12.5375 22.4625 13.5625C22.1042 14.5875 21.525 15.475 20.725 16.225C20.1083 16.8083 19.4125 17.25 18.6375 17.55C17.8625 17.85 17.05 18 16.2 18C15.1 18 14.1667 17.75 13.4 17.25L12.25 16.5H11.75L10.6 17.25C9.83333 17.75 8.9 18 7.8 18ZM7.8 16C8.41667 16 8.99167 15.8542 9.525 15.5625C10.0583 15.2708 10.55 14.9167 11 14.5H13C13.45 14.9167 13.9417 15.2708 14.475 15.5625C15.0083 15.8542 15.5833 16 16.2 16C16.8 16 17.3792 15.8958 17.9375 15.6875C18.4958 15.4792 18.9917 15.1583 19.425 14.725C19.9917 14.1583 20.3958 13.4917 20.6375 12.725C20.8792 11.9583 21 11.175 21 10.375C21 9.69167 20.8583 9.12083 20.575 8.6625C20.2917 8.20417 19.8417 7.98333 19.225 8C19.175 8 18.9917 8.03333 18.675 8.1L12 10.6L5.325 8.1C5.24167 8.06667 5.15417 8.04167 5.0625 8.025C4.97083 8.00833 4.875 8 4.775 8C4.15833 8 3.70833 8.225 3.425 8.675C3.14167 9.125 3 9.69167 3 10.375C3 11.1917 3.12083 11.9833 3.3625 12.75C3.60417 13.5167 4.01667 14.1833 4.6 14.75C5.03333 15.1667 5.525 15.4792 6.075 15.6875C6.625 15.8958 7.2 16 7.8 16ZM9.025 14.5C9.64167 14.5 10.125 14.3625 10.475 14.0875C10.825 13.8125 11 13.4333 11 12.95C11 12.1333 10.4625 11.3542 9.3875 10.6125C8.3125 9.87083 7.175 9.5 5.975 9.5C5.35833 9.5 4.875 9.6375 4.525 9.9125C4.175 10.1875 4 10.5667 4 11.05C4 11.8667 4.5375 12.6458 5.6125 13.3875C6.6875 14.1292 7.825 14.5 9.025 14.5ZM8.875 13C8.24167 13 7.55417 12.7917 6.8125 12.375C6.07083 11.9583 5.63333 11.5333 5.5 11.1C5.58333 11.0667 5.67917 11.0375 5.7875 11.0125C5.89583 10.9875 6.00833 10.975 6.125 10.975C6.75833 10.975 7.44583 11.1875 8.1875 11.6125C8.92917 12.0375 9.36667 12.4667 9.5 12.9C9.41667 12.9333 9.32083 12.9583 9.2125 12.975C9.10417 12.9917 8.99167 13 8.875 13ZM14.975 14.525C16.175 14.525 17.3125 14.15 18.3875 13.4C19.4625 12.65 20 11.8667 20 11.05C20 10.5667 19.8292 10.1833 19.4875 9.9C19.1458 9.61667 18.6583 9.475 18.025 9.475C16.825 9.475 15.6875 9.85 14.6125 10.6C13.5375 11.35 13 12.1333 13 12.95C13 13.4333 13.175 13.8167 13.525 14.1C13.875 14.3833 14.3583 14.525 14.975 14.525ZM15.125 13C15.0083 13 14.9 12.9917 14.8 12.975C14.7 12.9583 14.6083 12.9333 14.525 12.9C14.6583 12.4667 15.0958 12.0417 15.8375 11.625C16.5792 11.2083 17.2667 11 17.9 11C18.0167 11 18.125 11.0083 18.225 11.025C18.325 11.0417 18.4167 11.0667 18.5 11.1C18.3667 11.5333 17.9292 11.9583 17.1875 12.375C16.4458 12.7917 15.7583 13 15.125 13Z"
					fill="currentColor"
				/>
			</g>
		</svg>
	);

	const ToolbarChevronRightIcon = () => (
		<svg width="8" height="12" viewBox="0 0 8 12" fill="none" aria-hidden="true">
			<path d="M4.6 6L0 1.4L1.4 0L7.4 6L1.4 12L0 10.6L4.6 6Z" fill="currentColor" />
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
	const history = useHistory();
	const location = useLocation();
	const { getDevToolbarOption } = useDevToolbar();

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

	const [activeInfo, setActiveInfo] = useState(null);
	const [attachmentSelected, setAttachmentSelected] = useState<File | null>(
		null
	);
	const [uploadProgress, setUploadProgress] = useState(null);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const [attachmentUpload, setAttachmentUpload] =
		useState<XMLHttpRequest | null>(null);
	const [editorState, setEditorState] = useState(EditorState.createEmpty());
	const [composerText, setComposerText] = useState('');
	const [highlightedSnippet, setHighlightedSnippet] = useState<string | null>(
		null
	);
	const composerRef = useRef<TipTapComposerRef | null>(null);
	const [isRichtextActive, setIsRichtextActive] = useState(true);
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
	const [isEmojiStripOpen, setIsEmojiStripOpen] = useState(false);
	const [isHighlightStripOpen, setIsHighlightStripOpen] = useState(false);
	const [isAudienceMenuOpen, setIsAudienceMenuOpen] = useState(false);
	const [audienceOptions, setAudienceOptions] = useState<
		Array<{ value: string; label: string }>
	>([{ value: '__all__', label: 'ALL' }]);
	const [selectedAudienceValue, setSelectedAudienceValue] =
		useState<string>('__all__');

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

	const loadDraftIntoComposer = useCallback(
		(loadedState: EditorState, rawDraft?: string) => {
			setEditorState(loadedState);
			const draftValue = (rawDraft || '').trim();
			if (draftValue) {
				// TipTap drafts are saved as HTML now; load raw draft directly to preserve formatting.
				setComposerText(rawDraft || '');
				composerRef.current?.setText(rawDraft || '');
				return;
			}
			// Backward fallback for any legacy empty/raw conversion edge-cases.
			const contentState = loadedState.getCurrentContent();
			const rawObject = convertToRaw(escapeMarkdownChars(contentState));
			const markdownString = draftToMarkdown(rawObject, {
				escapeMarkdownCharacters: false
			});
			setComposerText(markdownString);
			composerRef.current?.setText(markdownString);
		},
		[]
	);

	const {
		onChange: onDraftMessageChange,
		loaded: draftLoaded,
		clearDraftMessage
	} = useDraftMessage(!isRequestInProgress, loadDraftIntoComposer, {
		threadRootId: threadRootId || null,
		actionPath: draftActionPath,
		sessionId: activeSession?.item?.id ?? null,
		roomRef: activeSession?.rid ?? null,
		title: draftTitle,
		forcedScopeKey: forcedDraftScopeKey
	});

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
		window.addEventListener(HIGHLIGHT_SNIPPET_SELECTED_EVENT, handleSnippet);
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

	const getTypedMarkdownMessage = useCallback(
		() => {
			const liveEditorHtml = composerRef.current?.getHTML();
			// Use latest editor snapshot first to avoid stale last-action/last-char issues.
			return (liveEditorHtml ?? composerText).trim();
		},
		[composerText]
	);

	const encodeHighlightColorsForTransport = useCallback((rawMessage: string) => {
		if (!rawMessage) {
			return rawMessage;
		}
		return rawMessage.replace(
			/<mark([^>]*)>([\s\S]*?)<\/mark>/gi,
			(_full, attrs: string, inner: string) => {
				const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
				const dataColorMatch = attrs.match(/data-color\s*=\s*["']([^"']+)["']/i);
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
			onDraftMessageChange(getTypedMarkdownMessage());
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
		const richtextHeight = 38;
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
				editorContainer.setAttribute('style', `height: ${defaultMinHeight}px !important; max-height: ${defaultMinHeight}px !important;`);
			}
			const editorContentDiv = textInput.querySelector('.ProseMirror p');
			if (editorContentDiv) {
				editorContentDiv.setAttribute('style', `height: auto !important; max-height: none !important;`);
			}
			return;
		}

		// If editor has text, allow it to grow normally
		const textHeight = document.querySelector(
			'.ProseMirror'
		)?.scrollHeight;
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
				.then(() => {
					setEditorState(EditorState.createEmpty());
					setComposerText('');
					composerRef.current?.clear();
				})
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
		setComposerText('');
		composerRef.current?.clear();
		setSelectedAudienceValue(
			audienceOptions.some((option) => option.value === '__all__')
				? '__all__'
				: audienceOptions[0]?.value || '__all__'
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
	}, [audienceOptions, clearDraftMessage, onMessageSendSuccess, resizeTextarea]);

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

		let message = encodeHighlightColorsForTransport(
			getTypedMarkdownMessage()
		).trim();
		const prefixParts: string[] = [];
		if (threadRootId) {
			prefixParts.push(buildThreadPrefix(threadRootId));
		}
		if (selectedAudienceValue !== '__all__') {
			prefixParts.push(buildVisibleToPrefix([selectedAudienceValue]));
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
		encodeHighlightColorsForTransport,
		getTypedMarkdownMessage,
		isE2eeEnabled,
		key,
		keyID,
		preselectedFile,
		sendEnquiry,
		sendMessage,
		selectedAudienceValue,
		isSupervisor,
		threadRootId,
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

	const getMatrixRoomId = useCallback(() => {
		if (activeSession?.rid?.startsWith('!')) {
			return activeSession.rid;
		}
		return activeSession?.item?.matrixRoomId || null;
	}, [activeSession?.item?.matrixRoomId, activeSession?.rid]);

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

	const getComparableAudienceIds = useCallback((rawValue?: string | null) => {
		const compact = (rawValue || '').trim().toLowerCase();
		if (!compact) {
			return new Set<string>();
		}
		const ids = new Set<string>([compact]);
		if (compact.startsWith('@')) {
			const username = compact.slice(1).split(':')[0];
			if (username) {
				ids.add(username);
				ids.add(`@${username}`);
			}
		} else {
			ids.add(`@${compact}`);
		}
		return ids;
	}, []);

	useEffect(() => {
		const defaultOption = { value: '__all__', label: 'Send to all' };
		const collected = new Map<string, string>();
		const selfIdentifiers = new Set<string>();
		const matrixUserIdFromStorage =
			typeof window !== 'undefined'
				? window.localStorage?.getItem('matrix_user_id')
				: '';
		const matrixUserIdFromCookie =
			typeof document !== 'undefined'
				? document.cookie
						.split('; ')
						.find((entry) => entry.startsWith('rc_uid='))
						?.split('=')[1] || ''
				: '';
		[
			matrixUserIdFromStorage,
			matrixUserIdFromCookie,
			userData?.userName,
			userData?.displayName
		].forEach((rawValue) => {
			getComparableAudienceIds(rawValue).forEach((id) =>
				selfIdentifiers.add(id)
			);
		});
		const roomId = getMatrixRoomId();
		const matrixClient = (window as any).matrixClientService?.getClient?.();
		const room = roomId && matrixClient ? matrixClient.getRoom(roomId) : null;
		const joinedMembers = room?.getJoinedMembers?.() || [];

		joinedMembers.forEach((member: any) => {
			const memberId = `${member?.userId || ''}`.trim();
			if (!memberId) {
				return;
			}
			if (memberId.includes('@system') || memberId.includes('@caritas.local')) {
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
			collected.set(memberId, memberName || deriveLabelFromUserId(memberId));
		});

		if (collected.size === 0) {
			const askerId = `${activeSession?.item?.askerRcId || ''}`.trim();
			if (
				askerId &&
				!Array.from(getComparableAudienceIds(askerId)).some((id) =>
					selfIdentifiers.has(id)
				)
			) {
				collected.set(askerId, deriveLabelFromUserId(askerId));
			}
			const consultantUsername = `${activeSession?.consultant?.username || ''}`.trim();
			if (
				consultantUsername &&
				!Array.from(getComparableAudienceIds(consultantUsername)).some((id) =>
					selfIdentifiers.has(id)
				)
			) {
				collected.set(consultantUsername, consultantUsername);
			}
		}

		const mapped = Array.from(collected.entries())
			.map(([value, label]) => ({ value, label }))
			.sort((a, b) => a.label.localeCompare(b.label));
		const includeAllOption = mapped.length > 1;
		const nextOptions = includeAllOption ? [defaultOption, ...mapped] : mapped;
		setAudienceOptions(nextOptions);
		setSelectedAudienceValue((currentValue) =>
			nextOptions.some((option) => option.value === currentValue)
				? currentValue
				: includeAllOption
					? '__all__'
					: nextOptions[0]?.value || '__all__'
		);
	}, [
		activeSession?.consultant?.username,
		activeSession?.consultant?.id,
		activeSession?.item?.askerRcId,
		activeSession?.item?.id,
		deriveLabelFromUserId,
		getComparableAudienceIds,
		getMatrixRoomId,
		userData?.displayName,
		userData?.userName
	]);

	useEffect(() => {
		setIsAudienceMenuOpen(false);
		setSelectedAudienceValue((currentValue) => {
			const hasSendToAll = audienceOptions.some(
				(option) => option.value === '__all__'
			);
			if (hasSendToAll) {
				return '__all__';
			}
			return audienceOptions[0]?.value || currentValue;
		});
	}, [activeSession?.item?.id, threadRootId, audienceOptions]);

	useEffect(() => {
		if (!isAudienceMenuOpen) {
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
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	}, [isAudienceMenuOpen]);

	const selectedAudienceLabel = useMemo(
		() =>
			audienceOptions.find((option) => option.value === selectedAudienceValue)?.label ||
			'Send to all',
		[audienceOptions, selectedAudienceValue]
	);
	const selectedAudienceChipLabel = useMemo(() => {
		if (selectedAudienceLabel === 'Send to all') {
			return selectedAudienceLabel;
		}
		let normalizedLabel = selectedAudienceLabel.trim();
		if (!/\s/.test(normalizedLabel)) {
			const roleSplitMatch = normalizedLabel.match(
				/^(.*?)(consultant|user|supervisor|moderator)(\d*)$/i
			);
			if (roleSplitMatch?.[1] && roleSplitMatch?.[2]) {
				normalizedLabel = `${roleSplitMatch[1]} ${roleSplitMatch[2]}${
					roleSplitMatch[3] || ''
				}`;
			}
		}
		const parts = normalizedLabel.split(/\s+/).filter(Boolean);
		if (parts.length < 2) {
			return selectedAudienceLabel;
		}
		const firstInitial = parts[0].charAt(0).toUpperCase();
		return `${firstInitial}. ${parts.slice(1).join(' ')}`;
	}, [selectedAudienceLabel]);

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
	const typedMessage = getTypedMarkdownMessage();
	const canSendMessage =
		!!attachmentSelected ||
		(typedMessage ? typedMessage.trim().length > 0 : false);

	const handleToolbarAction = useCallback((action: string) => {
		composerRef.current?.runAction(action);
	}, []);

	const emojiOptions = useMemo(
		() => ['😀', '😂', '😍', '🔥', '👍', '🎉', '🙏', '❤️'],
		[]
	);

	const openEmojiStrip = useCallback(() => {
		setIsEmojiStripOpen(true);
		setIsHighlightStripOpen(false);
	}, []);

	const closeEmojiStrip = useCallback(() => {
		setIsEmojiStripOpen(false);
	}, []);

	const openHighlightStrip = useCallback(() => {
		setIsHighlightStripOpen(true);
		setIsEmojiStripOpen(false);
	}, []);

	const closeHighlightStrip = useCallback(() => {
		setIsHighlightStripOpen(false);
	}, []);

	const highlightOptions = useMemo(
		() => [
			{ action: 'highlightYellow', color: '#fff59d', label: 'Yellow' },
			{ action: 'highlightOrange', color: '#ffcc80', label: 'Orange' },
			{ action: 'highlightRose', color: '#ffcdd2', label: 'Rose' },
			{ action: 'highlightMint', color: '#b2f2bb', label: 'Mint' },
			{ action: 'highlightBlue', color: '#b3e5fc', label: 'Blue' }
		],
		[]
	);

	const handleHighlightPick = useCallback((action: string) => {
		if (!action) {
			return;
		}
		composerRef.current?.runAction(action);
		setIsHighlightStripOpen(false);
	}, []);

	const handleEmojiPick = useCallback((emoji: string) => {
		if (!emoji) {
			return;
		}
		composerRef.current?.insertText(`${emoji} `);
		setIsEmojiStripOpen(false);
	}, []);

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
			{highlightedSnippet && (
				<div className="textarea__snippetInfo">
					{translate('chat.highlightSnippet.ready', {
						defaultValue: 'Text snippet added to your reply'
					})}
				</div>
			)}

			<form className="textarea">
				<div className={'textarea__wrapper'}>
					<div className="textarea__wrapper-send-message">
						<span className={`textarea__featureWrapper ${isInputFocused ? 'textarea__featureWrapper--focused' : ''}`}>
							<span className="textarea__brandBadge" style={{ paddingLeft: '8px' }}>
								<RichtextToggleIcon width="20" height="20" />
							</span>
							<div className="textarea__assigneeChip" ref={audienceMenuRef}>
								<button
									type="button"
									className="textarea__assigneeButton"
									onClick={() =>
										setIsAudienceMenuOpen((previousState) => !previousState)
									}
									aria-haspopup="listbox"
									aria-expanded={isAudienceMenuOpen}
								>
									<PersonCircleIcon className="textarea__assigneeIcon" />
									<span className="textarea__assigneeName">
										{selectedAudienceChipLabel}
									</span>
									<ArrowDownIcon
										className={clsx(
											'textarea__assigneeArrow',
											isAudienceMenuOpen && 'textarea__assigneeArrow--open'
										)}
									/>
								</button>
								{isAudienceMenuOpen && (
									<div className="textarea__assigneeMenu" role="listbox">
										{audienceOptions.map((option) => (
											<button
												type="button"
												key={option.value}
												role="option"
												aria-selected={selectedAudienceValue === option.value}
												className={clsx(
													'textarea__assigneeMenuItem',
													selectedAudienceValue === option.value &&
														'textarea__assigneeMenuItem--selected'
												)}
												onClick={() => {
													setSelectedAudienceValue(option.value);
													setIsAudienceMenuOpen(false);
												}}
											>
												{option.label}
											</button>
										))}
									</div>
								)}
							</div>
						</span>
						<span
							className="textarea__inputWrapper"
							ref={inputWrapperRef}
						>
							<div
								className={clsx(
									'textarea__input',
									attachmentSelected && 'textarea__input--attachmentMode'
								)}
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
								{attachmentSelected ? (
									<div className="textarea__attachmentMode">
										<div className="textarea__attachmentModeCard">
											<span className="textarea__attachmentModeIcon">
												{getAttachmentIcon(attachmentSelected.type)}
											</span>
											<div className="textarea__attachmentModeInfo">
												<p className="textarea__attachmentModeName">
													{attachmentSelected.name}
												</p>
												<span className="textarea__attachmentModeMeta">
													{Math.max(
														1,
														Math.round(attachmentSelected.size / 1024)
													)}{' '}
													KB
												</span>
											</div>
											<button
												type="button"
												className="textarea__attachmentModeRemove"
												onClick={handleAttachmentRemoval}
												aria-label={translate('app.remove')}
											>
												<RemoveIcon />
											</button>
										</div>
									</div>
								) : (
									<>
										<div
											className={`textarea__figmaToolbar ${
												isEmojiStripOpen || isHighlightStripOpen
													? 'textarea__figmaToolbar--emoji'
													: ''
											}`}
											onMouseDown={handleToolbarMouseDown}
										>
											<div
												className={`textarea__figmaToolbarPanel textarea__figmaToolbarPanel--default ${
													isEmojiStripOpen || isHighlightStripOpen
														? 'textarea__figmaToolbarPanel--hidden'
														: 'textarea__figmaToolbarPanel--active'
												}`}
											>
										<button type="button" aria-label="Undo" onClick={() => handleToolbarAction('undo')}>
											<ToolbarUndoIcon />
										</button>
										<button type="button" aria-label="Redo" onClick={() => handleToolbarAction('redo')}>
											<ToolbarRedoIcon />
										</button>
										<button
											type="button"
											aria-label="Filter"
											onClick={openHighlightStrip}
										>
											<ToolbarFilterIcon />
										</button>
										<button type="button" aria-label="Bold" onClick={() => handleToolbarAction('bold')}>
											<ToolbarBoldIcon />
										</button>
										<button
											type="button"
											aria-label="Italic"
											onClick={() => handleToolbarAction('italic')}
										>
											<ToolbarItalicIcon />
										</button>
										<button
											type="button"
											aria-label="List Add"
											onClick={() => handleToolbarAction('bulletList')}
										>
											<ToolbarListPlusIcon />
										</button>
										<button
											type="button"
											aria-label="List Text"
											onClick={() => handleToolbarAction('orderedList')}
										>
											<ToolbarListTextIcon />
										</button>
										<button
											type="button"
											aria-label="Pen"
											onClick={() => handleToolbarAction('underline')}
										>
											<ToolbarPenIcon />
										</button>
										<button type="button" aria-label="Emoji panel" onClick={openEmojiStrip}>
											<ToolbarFacePlusIcon />
										</button>
										<button
											type="button"
											aria-label="Image Add"
											onClick={() => handleToolbarAction('insertImageMarker')}
										>
											<ToolbarImageAddIcon />
										</button>
										<button
											type="button"
											aria-label="Search Calendar"
											onClick={() => handleToolbarAction('insertDateTime')}
										>
											<ToolbarSearchCalendarIcon />
										</button>
										<button
											type="button"
											aria-label="Toggle"
											onClick={() => handleToolbarAction('blockquote')}
										>
											<ToolbarToggleIcon />
										</button>
										<button
											type="button"
											aria-label="Face"
											onClick={() => handleToolbarAction('clearFormatting')}
										>
											<ToolbarFaceIcon />
										</button>
										<button
											type="button"
											aria-label="Next"
											onClick={() => handleToolbarAction('focusEnd')}
										>
											<ToolbarChevronRightIcon />
										</button>
									</div>
									<div
										className={`textarea__figmaToolbarPanel textarea__figmaToolbarPanel--highlight ${
											isHighlightStripOpen
												? 'textarea__figmaToolbarPanel--active'
												: 'textarea__figmaToolbarPanel--hidden'
										}`}
									>
										{highlightOptions.map((option) => (
											<button
												type="button"
												key={option.action}
												className="textarea__highlightColorButton"
												aria-label={`Highlight ${option.label}`}
												onClick={() => handleHighlightPick(option.action)}
											>
												<span
													className="textarea__highlightColorSwatch"
													style={{ backgroundColor: option.color }}
												/>
											</button>
										))}
										<button
											type="button"
											className="textarea__emojiCloseButton"
											aria-label="Close highlight strip"
											onClick={closeHighlightStrip}
										>
											Close
										</button>
									</div>
									<div
										className={`textarea__figmaToolbarPanel textarea__figmaToolbarPanel--emoji ${
											isEmojiStripOpen
												? 'textarea__figmaToolbarPanel--active'
												: 'textarea__figmaToolbarPanel--hidden'
										}`}
									>
										{emojiOptions.map((emoji) => (
											<button
												type="button"
												key={emoji}
												className="textarea__emojiButton"
												aria-label={`Insert ${emoji}`}
												onClick={() => handleEmojiPick(emoji)}
											>
												{emoji}
											</button>
										))}
										<button
											type="button"
											className="textarea__emojiCloseButton"
											aria-label="Close emoji strip"
											onClick={closeEmojiStrip}
										>
											Close
										</button>
									</div>
										</div>
										<TipTapComposer
											ref={composerRef}
											value={composerText}
											onChange={handleComposerChange}
											placeholder={placeholder}
											showToolbar={false}
											readOnly={!!uploadProgress}
											onSubmitShortcut={() => {
												if (!uploadProgress && !isRequestInProgress) {
													handleButtonClick();
												}
											}}
										/>
									</>
								)}
							</div>
							{hasUploadFunctionality &&
								(!attachmentSelected ? (
									<span
										className={clsx(
											'textarea__attachmentSelect',
											isVoiceRecording && 'textarea__attachmentSelect--recording'
										)}
									>
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
													className="textarea__clipButton"
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
												className="textarea__clipButton"
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
								) : isVoiceAttachmentSelected ? (
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
													onClick={handleAttachmentRemoval}
													title={translate('app.remove')}
													aria-label={translate('app.remove')}
												/>
											</span>
										</div>
									</div>
								) : null)}
						</span>
						<div className="textarea__buttons">
							<SendMessageButton
								handleSendButton={handleButtonClick}
								clicked={isRequestInProgress}
								deactivated={!canSendMessage || !!uploadProgress || isVoiceRecording}
								isEmpty={!canSendMessage}
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





