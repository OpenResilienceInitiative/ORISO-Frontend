import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import sanitizeHtml from 'sanitize-html';
import { PrettyDate } from '../../utils/dateHelpers';
import {
	UserDataContext,
	hasUserAuthority,
	AUTHORITIES,
	E2EEContext,
	RocketChatGlobalSettingsContext,
	ActiveSessionContext
} from '../../globalState';
import { STATUS_ARCHIVED } from '../../globalState/interfaces';
import { isUserModerator } from '../session/sessionHelpers';
import { MessageDisplayName } from './MessageDisplayName';
import { formatToHHMM } from '../../utils/dateHelpers';
import { markdownToDraft } from 'markdown-draft-js';
import { stateToHTML } from 'draft-js-export-html';
import { convertFromRaw, ContentState } from 'draft-js';
import {
	markdownToDraftDefaultOptions,
	normalizeHighlightColor,
	sanitizeHtmlDefaultOptions,
	urlifyLinksInText
} from '../messageSubmitInterface/richtextHelpers';
import { VideoCallMessage } from './VideoCallMessage';
import { FurtherSteps } from './FurtherSteps';
import { MessageAttachment } from './MessageAttachment';
import { Text } from '../text/Text';
import './message.styles';
import { Appointment } from './Appointment';
import { decryptText, MissingKeyError } from '../../utils/encryptionHelpers';
import { e2eeParams } from '../../hooks/useE2EE';
import { E2EEActivatedMessage } from './E2EEActivatedMessage';
import {
	ReassignRequestAcceptedMessage,
	ReassignRequestDeclinedMessage,
	ReassignRequestMessage,
	ReassignRequestSentMessage
} from './ReassignMessage';
import {
	apiSendAliasMessage,
	ConsultantReassignment,
	ReassignStatus
} from '../../api/apiSendAliasMessage';
import { apiPatchMessage } from '../../api/apiPatchMessage';
import { apiSessionAssign } from '../../api';

import { MasterKeyLostMessage } from './MasterKeyLostMessage';
import { ALIAS_MESSAGE_TYPES } from '../../api/apiSendAliasMessage';
import { useTranslation } from 'react-i18next';
import { ERROR_LEVEL_WARN, TError } from '../../api/apiPostError';
import { ReactComponent as TrashIcon } from '../../resources/img/icons/trash.svg';
import { ReactComponent as DeletedIcon } from '../../resources/img/icons/deleted.svg';
import {
	IBooleanSetting,
	SETTING_MESSAGE_ALLOWDELETING
} from '../../api/apiRocketChatSettingsPublic';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { ReactComponent as XIllustration } from '../../resources/img/illustrations/x.svg';
import { BUTTON_TYPES } from '../button/Button';
import { apiDeleteMessage } from '../../api/apiDeleteMessage';
import { FlyoutMenu } from '../flyoutMenu/FlyoutMenu';
import { BanUser, BanUserOverlay } from '../banUser/BanUser';
import { getValueFromCookie } from '../sessionCookie/accessSessionCookie';
import { VideoChatDetails, VideoChatDetailsAlias } from './VideoChatDetails';
import { UserAvatar } from './UserAvatar';
import clsx from 'clsx';
import {
	parseMessagePrefixes,
	SYSTEM_NOTIFICATION_USER_LEFT_CHAT
} from './messageConstants';
import { createPortal } from 'react-dom';
import { ReactComponent as NotificationBellIcon } from '../../resources/img/icons/notification_bell.svg';
import { ReactComponent as StackVerticalIcon } from '../../resources/img/icons/stack-vertical.svg';
import { ReactComponent as EyeIcon } from '../../resources/img/icons/eye.svg';
import { ReactComponent as ArrowLeftIcon } from '../../resources/img/icons/arrow-left.svg';
import { ReactComponent as StackVerticalCircleIcon } from '../../resources/img/icons/stack-vertical-circle.svg';
import { ReactComponent as PenIcon } from '../../resources/img/icons/pen.svg';
import { ReactComponent as ArrowForwardIcon } from '../../resources/img/icons/arrow-forward.svg';
import { formatMessagePersonName } from './messageNameUtils';
import { RocketChatUsersOfRoomContext } from '../../globalState/provider/RocketChatUsersOfRoomProvider';
import { ConsultantListContext } from '../../globalState/provider/ConsultantListProvider';

const ActiveKebabIcon = () => (
	<svg width="28" height="32" viewBox="0 0 28 32" fill="none" aria-hidden>
		<g clipPath="url(#active-kebab-clip)">
			<rect width="28" height="32" rx="14" fill="#CC1E1C" />
			<rect width="28" height="32" fill="white" fillOpacity="0.08" />
			<path
				d="M28 12.4545V32H-6C-6 19.8497 4.43011 10 17.2963 10C21.1552 10 24.795 10.8861 28 12.4545Z"
				fill="white"
				fillOpacity="0.1"
			/>
			<path
				d="M13.9997 22.6666C13.5413 22.6666 13.149 22.5034 12.8226 22.177C12.4962 21.8506 12.333 21.4583 12.333 20.9999C12.333 20.5416 12.4962 20.1492 12.8226 19.8228C13.149 19.4964 13.5413 19.3333 13.9997 19.3333C14.458 19.3333 14.8504 19.4964 15.1768 19.8228C15.5031 20.1492 15.6663 20.5416 15.6663 20.9999C15.6663 21.4583 15.5031 21.8506 15.1768 22.177C14.8504 22.5034 14.458 22.6666 13.9997 22.6666ZM13.9997 17.6666C13.5413 17.6666 13.149 17.5034 12.8226 17.177C12.4962 16.8506 12.333 16.4583 12.333 15.9999C12.333 15.5416 12.4962 15.1492 12.8226 14.8228C13.149 14.4964 13.5413 14.3333 13.9997 14.3333C14.458 14.3333 14.8504 14.4964 15.1768 14.8228C15.5031 15.1492 15.6663 15.5416 15.6663 15.9999C15.6663 16.4583 15.5031 16.8506 15.1768 17.177C14.8504 17.5034 14.458 17.6666 13.9997 17.6666ZM13.9997 12.6666C13.5413 12.6666 13.149 12.5034 12.8226 12.177C12.4962 11.8506 12.333 11.4583 12.333 10.9999C12.333 10.5416 12.4962 10.1492 12.8226 9.82284C13.149 9.49645 13.5413 9.33325 13.9997 9.33325C14.458 9.33325 14.8504 9.49645 15.1768 9.82284C15.5031 10.1492 15.6663 10.5416 15.6663 10.9999C15.6663 11.4583 15.5031 11.8506 15.1768 12.177C14.8504 12.5034 14.458 12.6666 13.9997 12.6666Z"
				fill="white"
			/>
		</g>
		<defs>
			<clipPath id="active-kebab-clip">
				<rect width="28" height="32" rx="14" fill="white" />
			</clipPath>
		</defs>
	</svg>
);

const MenuReplyDirectIcon = () => (
	<svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden>
		<path
			d="M16 14V10C16 9.16667 15.7083 8.45833 15.125 7.875C14.5417 7.29167 13.8333 7 13 7H3.825L7.425 10.6L6 12L0 6L6 0L7.425 1.4L3.825 5H13C14.3833 5 15.5625 5.4875 16.5375 6.4625C17.5125 7.4375 18 8.61667 18 10V14H16Z"
			fill="#4B515A"
		/>
	</svg>
);
const MenuReplyThreadIcon = () => (
	<svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden>
		<path
			d="M13 18V15H9V5H7V8H0V0H7V3H13V0H20V8H13V5H11V13H13V10H20V18H13ZM15 6H18V2H15V6ZM15 16H18V12H15V16ZM2 6H5V2H2V6Z"
			fill="#4B515A"
		/>
	</svg>
);
const MenuMarkTextIcon = () => (
	<svg width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden>
		<path
			d="M2 22C0.895431 22 0 21.1046 0 20C0 18.8954 0.895431 18 2 18H18C19.1046 18 20 18.8954 20 20C20 21.1046 19.1046 22 18 22H2ZM4 14H5.4L13.2 6.225L11.775 4.8L4 12.6V14ZM2 16V11.75L13.2 0.575C13.3833 0.391667 13.5958 0.25 13.8375 0.15C14.0792 0.05 14.3333 0 14.6 0C14.8667 0 15.125 0.05 15.375 0.15C15.625 0.25 15.85 0.4 16.05 0.6L17.425 2C17.625 2.18333 17.7708 2.4 17.8625 2.65C17.9542 2.9 18 3.15833 18 3.425C18 3.675 17.9542 3.92083 17.8625 4.1625C17.7708 4.40417 17.625 4.625 17.425 4.825L6.25 16H2Z"
			fill="#4B515A"
		/>
	</svg>
);
const MenuForwardIcon = () => (
	<svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden>
		<path
			d="M14 12L12.575 10.6L17.175 6L12.575 1.4L14 0L20 6L14 12ZM0 14V10C0 8.61667 0.483333 7.44167 1.45 6.475C2.43333 5.49167 3.61667 5 5 5H11.175L7.575 1.4L9 0L15 6L9 12L7.575 10.6L11.175 7H5C4.16667 7 3.45833 7.29167 2.875 7.875C2.29167 8.45833 2 9.16667 2 10V14H0Z"
			fill="#4B515A"
		/>
	</svg>
);
const MenuDeleteIcon = () => (
	<svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden>
		<path
			d="M3 18C2.45 18 1.97917 17.8042 1.5875 17.4125C1.19583 17.0208 1 16.55 1 16V3H0V1H5V0H11V1H16V3H15V16C15 16.55 14.8042 17.0208 14.4125 17.4125C14.0208 17.8042 13.55 18 13 18H3ZM13 3H3V16H13V3ZM5 14H7V5H5V14ZM9 14H11V5H9V14Z"
			fill="#4B515A"
		/>
	</svg>
);

const VisibilityPeopleIcon = () => (
	<svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden>
		<path
			d="M0 16V13.2C0 12.6333 0.145833 12.1125 0.4375 11.6375C0.729167 11.1625 1.11667 10.8 1.6 10.55C2.63333 10.0333 3.68333 9.64583 4.75 9.3875C5.81667 9.12917 6.9 9 8 9C9.1 9 10.1833 9.12917 11.25 9.3875C12.3167 9.64583 13.3667 10.0333 14.4 10.55C14.8833 10.8 15.2708 11.1625 15.5625 11.6375C15.8542 12.1125 16 12.6333 16 13.2V16H0ZM18 16V13C18 12.2667 17.7958 11.5625 17.3875 10.8875C16.9792 10.2125 16.4 9.63333 15.65 9.15C16.5 9.25 17.3 9.42083 18.05 9.6625C18.8 9.90417 19.5 10.2 20.15 10.55C20.75 10.8833 21.2083 11.2542 21.525 11.6625C21.8417 12.0708 22 12.5167 22 13V16H18ZM8 8C6.9 8 5.95833 7.60833 5.175 6.825C4.39167 6.04167 4 5.1 4 4C4 2.9 4.39167 1.95833 5.175 1.175C5.95833 0.391667 6.9 0 8 0C9.1 0 10.0417 0.391667 10.825 1.175C11.6083 1.95833 12 2.9 12 4C12 5.1 11.6083 6.04167 10.825 6.825C10.0417 7.60833 9.1 8 8 8ZM18 4C18 5.1 17.6083 6.04167 16.825 6.825C16.0417 7.60833 15.1 8 14 8C13.8167 8 13.5833 7.97917 13.3 7.9375C13.0167 7.89583 12.7833 7.85 12.6 7.8C13.05 7.26667 13.3958 6.675 13.6375 6.025C13.8792 5.375 14 4.7 14 4C14 3.3 13.8792 2.625 13.6375 1.975C13.3958 1.325 13.05 0.733333 12.6 0.2C12.8333 0.116667 13.0667 0.0625 13.3 0.0375C13.5333 0.0125 13.7667 0 14 0C15.1 0 16.0417 0.391667 16.825 1.175C17.6083 1.95833 18 2.9 18 4Z"
			fill="#4B515A"
		/>
	</svg>
);

const VisibilityClientIcon = () => (
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

const VisibilityModeratorIcon = () => (
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

const ChevronIcon = ({ className }: { className?: string }) => (
	<svg
		width="10"
		height="6"
		viewBox="0 0 10 6"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		className={className}
	>
		<path
			d="M0.800781 4.80005L4.80078 0.800049L8.80078 4.80005"
			stroke="#4C555F"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

export interface VideoCallMessageDTO {
	eventType: 'IGNORED_CALL';
	initiatorRcUserId: string;
	initiatorUserName: string;
}

export interface MessageItem {
	_id: string;
	message: string;
	messageDate: PrettyDate;
	messageTime: string;
	displayName: string;
	username: string;
	askerRcId?: string;
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
	attachments?: MessageService.Schemas.AttachmentDTO[];
	file?: MessageService.Schemas.FileDTO;
	t: null | 'e2e' | 'rm' | 'room-removed-read-only' | 'room-set-read-only';
	rid: string;
	isVideoActive?: boolean;
}

interface MessageItemComponentProps extends MessageItem {
	isOnlyEnquiry?: boolean;
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
	onOpenThread?: () => void;
	handleDecryptionErrors: (
		id: string,
		messageTime: string,
		error: TError
	) => void;
	handleDecryptionSuccess: (id: string) => void;
	e2eeParams: e2eeParams & { subscriptionKeyLost: boolean };
}

export const MessageItemComponent = ({
	_id,
	alias,
	userId,
	message,
	messageDate,
	messageTime,
	isMyMessage,
	displayName,
	username,
	askerRcId,
	attachments,
	file,
	isNotRead,
	isUserBanned,
	t,
	rid,
	handleDecryptionErrors,
	handleDecryptionSuccess,
	e2eeParams,
	isVideoActive,
	renderMode = 'main',
	threadsEnabled = true,
	threadRootId,
	forceShow = false,
	threadSummary,
	onOpenThread
}: MessageItemComponentProps) => {
	const { t: translate } = useTranslation();
	const { activeSession, reloadActiveSession } =
		useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);
	const rcUsersContext = useContext(RocketChatUsersOfRoomContext);
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
		const merged = new Set<string>();
		[
			matrixUserIdFromStorage,
			matrixUserIdFromCookie,
			userData?.userName,
			userData?.displayName
		].forEach((value) => {
			getComparableRecipientIds(value).forEach((entry) =>
				merged.add(entry)
			);
		});
		return merged;
	}, [getComparableRecipientIds, userData?.displayName, userData?.userName]);

	const [renderedMessage, setRenderedMessage] = useState<string | null>(null);
	const [decryptedMessage, setDecryptedMessage] = useState<
		string | null | undefined
	>(null);

	const [isExpanded, setIsExpanded] = useState(false);
	const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
	const [actionMenuPosition, setActionMenuPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const actionMenuRef = React.useRef<HTMLDivElement | null>(null);
	const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false);
	const [visibilityMenuPosition, setVisibilityMenuPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const visibilityMenuRef = React.useRef<HTMLDivElement | null>(null);
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

	// Character limit for collapsing messages
	const MESSAGE_CHAR_LIMIT = 300;

	// Reset expanded state only when message ID changes (not when message content changes)
	useEffect(() => {
		setIsExpanded(false);
	}, [_id]);

	useEffect(() => {
		if (!isActionMenuOpen) {
			return;
		}
		const handleOutsideClick = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (!target) {
				return;
			}
			if (!actionMenuRef.current?.contains(target)) {
				setIsActionMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', handleOutsideClick);
		return () =>
			document.removeEventListener('mousedown', handleOutsideClick);
	}, [isActionMenuOpen]);

	useEffect(() => {
		if (!isVisibilityMenuOpen) {
			return;
		}
		const handleOutsideClick = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (!target) {
				return;
			}
			if (!visibilityMenuRef.current?.contains(target)) {
				setIsVisibilityMenuOpen(false);
				setVisibilityMenuPosition(null);
			}
		};
		document.addEventListener('mousedown', handleOutsideClick);
		return () =>
			document.removeEventListener('mousedown', handleOutsideClick);
	}, [isVisibilityMenuOpen]);

	useEffect((): void => {
		if (isE2eeEnabled && message) {
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
				.then(setDecryptedMessage)
				.then(() => handleDecryptionSuccess(_id));
		} else {
			setDecryptedMessage(message);
		}
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
	const roomUser = useMemo(() => {
		if (!rcUsersContext?.users?.length) {
			return null;
		}
		return (
			rcUsersContext.users.find((entry) => entry?._id === userId) ||
			rcUsersContext.users.find(
				(entry) => entry?.username === username
			) ||
			null
		);
	}, [rcUsersContext?.users, userId, username]);
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
				return translate('message.audience.all', 'All');
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
	const visibilityGroups = useMemo(() => {
		const selectedComparableLabels = new Set(
			visibleAudienceLabels.map((entry) =>
				makeComparableAudienceLabel(entry)
			)
		);
		const includesAllAudience = parsedMessage.visibleToUserIds.some(
			(entry) => `${entry || ''}`.trim().toLowerCase() === '__all__'
		);
		const assumeAllAudienceByDefault =
			parsedMessage.visibleToUserIds.length === 0 &&
			!!activeSession?.isGroup;
		const isAllAudienceSelected =
			includesAllAudience || assumeAllAudienceByDefault;
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
			const roomMatch = (rcUsersContext?.users || []).find(
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
		parsedMessage.visibleToUserIds,
		rcUsersContext?.users,
		activeSession?.isGroup,
		senderComparableLabels,
		visibleAudienceLabels
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
					? translate('message.audience.clients', 'Clients')
					: role === 'counsellors'
						? translate(
								'message.audience.counsellors',
								'Counsellors'
							)
						: translate(
								'message.audience.moderators',
								'Moderators'
							);
			summary.push(`${entries.length} ${roleLabel}`);
		});
		if (
			summary.length === 0 &&
			rawVisibleAudienceLabels.length === 0 &&
			activeSession?.isGroup
		) {
			summary.push(translate('message.audience.all', 'All'));
		}
		return summary;
	}, [
		activeSession?.isGroup,
		getAudienceRoleFromLabel,
		rawVisibleAudienceLabels,
		translate,
		visibleAudienceLabels
	]);

	useEffect((): void => {
		const renderImageMarkers = (content: string) =>
			content.replace(
				/\[image:\s*(https?:\/\/[^\]\s]+)\s*\]/gi,
				(_match, imageUrl: string) =>
					`<img class="messageItem__inlineImage" src="${imageUrl}" alt="Message image" loading="lazy" decoding="async" />`
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
			setRenderedMessage(
				sanitizeHtml(preparedMessage, sanitizeHtmlDefaultOptions)
			);
			return;
		}

		const rawMessageObject = markdownToDraft(
			preparedMessage,
			markdownToDraftDefaultOptions
		);
		const contentStateMessage: ContentState =
			convertFromRaw(rawMessageObject);

		setRenderedMessage(
			contentStateMessage.hasText()
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
				: ''
		);
	}, [decryptedMessage]);

	const isSupervisorFeedback = parsedMessage.isSupervisorFeedback;
	const isSystemNotification = parsedMessage.isSystemNotification;
	const isUserLeftChatEvent =
		parsedMessage.systemNotificationType ===
		SYSTEM_NOTIFICATION_USER_LEFT_CHAT;
	const userLeftChatDisplayName = (() => {
		const fromPayload = parsedMessage.systemNotificationUsername?.trim();
		if (
			fromPayload &&
			!fromPayload.startsWith('enc.') &&
			!fromPayload.startsWith('@')
		) {
			return fromPayload;
		}
		return '';
	})();
	const systemNotificationTitle =
		parsedMessage.systemNotificationTitle ||
		translate('message.systemNotificationTitle', 'System notification');
	const systemNotificationDescription =
		parsedMessage.systemNotificationDescription ||
		parsedMessage.cleanedMessage;
	const renderedMessageWithoutPrefix = renderedMessage;

	const hasRenderedMessage =
		renderedMessageWithoutPrefix && renderedMessageWithoutPrefix.length > 0;

	const getMessageDate = () => {
		if (messageDate.str || messageDate.date) {
			return (
				<div className="messageItem__divider">
					<Text
						text={translate(
							messageDate.str ? messageDate.str : messageDate.date
						)}
						type="divider"
					/>
				</div>
			);
		}
		return null;
	};

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

	const clickReassignRequestMessage = (accepted, toConsultantId) => {
		if (accepted) {
			apiSessionAssign(activeSession.item.id, toConsultantId)
				.then(() => {
					apiPatchMessage(
						toConsultantId,
						ReassignStatus.CONFIRMED,
						_id
					)
						.then(() => {
							// WORKAROUND for an issue with reassignment and old users breaking the lastMessage for this session
							apiSendAliasMessage({
								rcGroupId: activeSession.rid,
								type: ALIAS_MESSAGE_TYPES.REASSIGN_CONSULTANT_RESET_LAST_MESSAGE
							});
							reloadActiveSession();
						})
						.catch((error) => {
							/* console.log(error); */
						});
				})
				.catch((error) => {
					/* console.log(error); */
				});
		} else {
			apiPatchMessage(toConsultantId, ReassignStatus.REJECTED, _id).catch(
				(error) => {
					/* console.log(error); */
				}
			);
		}
	};

	const isUserMessage = () =>
		userId === askerRcId ||
		(activeSession.isGroup &&
			!activeSession.item.moderators?.includes(userId));

	const videoCallMessage: VideoCallMessageDTO = alias?.videoCallMessageDTO;
	const isFurtherStepsMessage =
		alias?.messageType === ALIAS_MESSAGE_TYPES.FURTHER_STEPS;
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
	const actionMenuItems = useMemo(
		() => [
			{
				key: 'reply-direct',
				label: translate('message.menu.replyDirect', 'Reply directly'),
				icon: <MenuReplyDirectIcon />
			},
			{
				key: 'reply-thread',
				label: translate('message.menu.replyThread', 'Reply in Thread'),
				icon: <MenuReplyThreadIcon />
			},
			{
				key: 'mark-text',
				label: translate('message.menu.markText', 'Mark Text'),
				icon: <MenuMarkTextIcon />
			},
			{
				key: 'forward',
				label: translate('message.menu.forward', 'Forward Message'),
				icon: <MenuForwardIcon />
			},
			{
				key: 'delete',
				label: translate('message.menu.delete', 'Delete Message'),
				icon: <MenuDeleteIcon />
			}
		],
		[translate]
	);

	const handleActionMenuItemClick = useCallback(
		(actionKey: string) => {
			setIsActionMenuOpen(false);
			if (actionKey === 'reply-thread' && onOpenThread) {
				onOpenThread();
			}
		},
		[onOpenThread]
	);

	const toggleActionMenu = useCallback(
		(
			event: React.MouseEvent<HTMLButtonElement>,
			side: 'left' | 'right'
		) => {
			event.preventDefault();
			event.stopPropagation();
			const triggerRect = event.currentTarget.getBoundingClientRect();
			const menuWidth = 210;
			const menuHeight = 300;
			const viewportPadding = 12;
			const gap = 10;
			const preferredLeft =
				side === 'left'
					? triggerRect.right + gap
					: triggerRect.left - menuWidth - gap;
			const computedLeft = Math.max(
				viewportPadding,
				Math.min(
					preferredLeft,
					window.innerWidth - menuWidth - viewportPadding
				)
			);
			const computedTop = Math.max(
				viewportPadding,
				Math.min(
					triggerRect.top - 12,
					window.innerHeight - menuHeight - viewportPadding
				)
			);
			if (isActionMenuOpen) {
				setIsActionMenuOpen(false);
				setActionMenuPosition(null);
				return;
			}
			setIsVisibilityMenuOpen(false);
			setVisibilityMenuPosition(null);
			setActionMenuPosition({
				top: computedTop,
				left: computedLeft
			});
			setIsActionMenuOpen(true);
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
			const triggerRect = event.currentTarget.getBoundingClientRect();
			const menuWidth = 336;
			const menuHeight = 460;
			const viewportPadding = 12;
			// Anchor menu so one corner sits behind the +N chip.
			const preferredLeft =
				side === 'left'
					? triggerRect.left - triggerRect.width * 0.35
					: triggerRect.right - menuWidth + triggerRect.width * 0.35;
			const computedLeft = Math.max(
				viewportPadding,
				Math.min(
					preferredLeft,
					window.innerWidth - menuWidth - viewportPadding
				)
			);
			const computedTop = Math.max(
				viewportPadding,
				Math.min(
					triggerRect.bottom - menuHeight + triggerRect.height * 0.45,
					window.innerHeight - menuHeight - viewportPadding
				)
			);
			if (isVisibilityMenuOpen) {
				setIsVisibilityMenuOpen(false);
				setVisibilityMenuPosition(null);
				return;
			}
			setIsActionMenuOpen(false);
			setActionMenuPosition(null);
			setVisibilityMenuPosition({
				top: computedTop,
				left: computedLeft
			});
			setIsVisibilityMenuOpen(true);
		},
		[isVisibilityMenuOpen]
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
		!isDeleteMessage &&
		!isSystemNotification &&
		!alias?.messageType;
	const resolvedIncomingDisplayName = !isMyMessage
		? consultantMatch?.consultantDisplayName ||
			roomUser?.displayName ||
			roomUser?.name ||
			displayName
		: displayName;
	const normalizedIncomingName = (resolvedIncomingDisplayName || '').trim();
	const incomingNameParts = normalizedIncomingName
		.split(/\s+/)
		.filter(Boolean);
	const resolvedIncomingNameParts =
		incomingNameParts.length >= 2
			? {
					firstName:
						consultantMatch?.firstName || incomingNameParts[0],
					lastName:
						consultantMatch?.lastName ||
						incomingNameParts.slice(1).join(' ')
				}
			: {
					firstName: consultantMatch?.firstName || undefined,
					lastName: consultantMatch?.lastName || undefined
				};
	const formattedName = formatMessagePersonName(
		resolvedIncomingDisplayName,
		username,
		isMyMessage ? userData?.firstName : resolvedIncomingNameParts.firstName,
		isMyMessage ? userData?.lastName : resolvedIncomingNameParts.lastName
	);
	const profileSubtitle = '';
	const isRejectedCallInGroupChat =
		alias?.messageType === ALIAS_MESSAGE_TYPES.VIDEOCALL &&
		videoCallMessage?.eventType === 'IGNORED_CALL' &&
		activeSession?.isGroup;

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
				if (message) {
					const isAsker = hasUserAuthority(
						AUTHORITIES.ASKER_DEFAULT,
						userData
					);

					const reassignmentParams: ConsultantReassignment =
						JSON.parse(message);
					switch (reassignmentParams.status) {
						case ReassignStatus.REQUESTED:
							return isAsker ? (
								<ReassignRequestMessage
									{...reassignmentParams}
									onClick={(accepted) =>
										clickReassignRequestMessage(
											accepted,
											reassignmentParams.toConsultantId
										)
									}
								/>
							) : (
								<ReassignRequestSentMessage
									{...reassignmentParams}
									isMySession={isMySession}
								/>
							);
						case ReassignStatus.CONFIRMED:
							return (
								<ReassignRequestAcceptedMessage
									isAsker={isAsker}
									isMySession={isMySession}
									{...reassignmentParams}
								/>
							);
						case ReassignStatus.REJECTED:
							return (
								<ReassignRequestDeclinedMessage
									isAsker={isAsker}
									isMySession={isMySession}
									{...reassignmentParams}
								/>
							);
					}
				}
				return;
			case isFurtherStepsMessage:
				return <FurtherSteps />;
			case isUpdateSessionDataMessage:
				return <FurtherSteps />;
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
						activeSessionAskerRcId={activeSession.item.askerRcId}
					/>
				);
			case isDeleteMessage:
				return (
					<div className="messageItem__message messageItem__message--deleted flex flex--ai-c">
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
				);
			default:
				return (
					<>
						{!isMyMessage && (
							<div className="messageItem__header">
								<MessageDisplayName
									isMyMessage={isMyMessage}
									isUser={isUserMessage()}
									type={getUsernameType()}
									userId={userId}
									username={username}
									displayName={resolvedIncomingDisplayName}
									firstName={
										resolvedIncomingNameParts.firstName
									}
									lastName={
										resolvedIncomingNameParts.lastName
									}
								/>
								{messageTime ? (
									<span className="messageItem__headerTime">
										{formatToHHMM(messageTime)}
									</span>
								) : null}
								{/* MATRIX MIGRATION: Temporarily hide message menu */}
								{false && (
									<MessageFlyoutMenu
										_id={_id}
										userId={userId}
										username={username}
										isUserBanned={isUserBanned}
										isMyMessage={isMyMessage}
										isArchived={
											activeSession.item.status ===
											STATUS_ARCHIVED
										}
									/>
								)}
							</div>
						)}

						{showVisibleAudience && isMyMessage && (
							<div className="messageItem__visibleOnly">
								<span className="messageItem__visibleOnlyLabel">
									{translate(
										'message.visibleOnlyTo',
										'visible only to:'
									)}
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
						<div
							className={`${
								isMyMessage
									? 'messageItem__message messageItem__message--myMessage'
									: 'messageItem__message'
							} ${isSystemNotification ? 'messageItem__message--systemNotification' : ''}`}
						>
							{isSystemNotification && (
								<>
									<div className="messageItem__systemNotificationTag">
										{translate(
											'message.systemNotification',
											'System Notification'
										)}
									</div>
									<div className="messageItem__systemNotificationTitle">
										{systemNotificationTitle}
									</div>
									{systemNotificationDescription && (
										<div className="messageItem__systemNotificationDescription">
											{systemNotificationDescription}
										</div>
									)}
								</>
							)}
							{isSupervisorFeedback && (
								<div className="messageItem__feedbackTag">
									{translate(
										'message.feedbackTag',
										'Feedback'
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
									/>
								))}
						</div>
						{showVisibleAudience && !isMyMessage && (
							<div className="messageItem__visibleOnly">
								<span className="messageItem__visibleOnlyLabel">
									{translate(
										'message.visibleOnlyTo',
										'visible only to:'
									)}
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

	if (!forceShow) {
		if (
			renderMode === 'main' &&
			threadsEnabled &&
			parsedMessage.isThreadMessage
		) {
			return null;
		}
		if (renderMode === 'thread') {
			if (!threadsEnabled) {
				return null;
			}
			if (!parsedMessage.isThreadMessage) {
				return null;
			}
			if (threadRootId && parsedMessage.threadRootId !== threadRootId) {
				return null;
			}
		}
	}

	if (isUserLeftChatEvent) {
		return (
			<div className="messageItem messageItem--chatEvent">
				{getMessageDate()}
				<div className="messageItem__chatEvent">
					{translate('message.userLeftChat', {
						name:
							userLeftChatDisplayName ||
							translate('message.anonymousUser', 'User')
					})}
				</div>
			</div>
		);
	}

	return (
		<div
			className={`messageItem ${
				isMyMessage ? 'messageItem--right' : ''
			} ${isFullWidthMessage ? 'messageItem--full' : ''} ${
				alias?.messageType &&
				`${alias?.messageType.toLowerCase()} systemMessage`
			} ${isSupervisorFeedback ? 'messageItem--feedback' : ''}`}
		>
			{getMessageDate()}
			<div
				className={`
					messageItem__messageWrap
					${isMyMessage ? 'messageItem__messageWrap--right' : ''}
					${isFurtherStepsMessage ? 'messageItem__messageWrap--furtherSteps' : ''}
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
						<div className="messageItem__sideColumn">
							<div className="messageItem__avatar">
								<UserAvatar
									username={username}
									displayName={resolvedIncomingDisplayName}
									firstName={
										resolvedIncomingNameParts.firstName
									}
									lastName={
										resolvedIncomingNameParts.lastName
									}
									userId={userId}
									size="32px"
									ring={false}
								/>
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
										'message.visibility.open',
										'Open visibility details'
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
							<button
								type="button"
								className="messageItem__kebabButton messageItem__kebabButton--left"
								aria-label="More"
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
						</div>
					)}
				{!alias?.messageType &&
					!isMyMessage &&
					isSystemNotification && (
						<div
							className="messageItem__systemAvatar"
							aria-hidden="true"
						>
							<NotificationBellIcon className="messageItem__systemAvatarIcon" />
						</div>
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
										'message.visibility.open',
										'Open visibility details'
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
							<button
								type="button"
								className="messageItem__kebabButton messageItem__kebabButton--right"
								aria-label="More"
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
							<div className="messageItem__avatar">
								<UserAvatar
									username={username}
									displayName={displayName}
									firstName={userData?.firstName}
									lastName={userData?.lastName}
									userId={userId}
									size="32px"
									ring={false}
								/>
							</div>
						</div>
					)}

				<div className="messageItem__content">
					{messageContent()}
					{isMyMessage && formattedName && !alias?.messageType && (
						<div className="messageItem__senderInfo">
							<div className="messageItem__senderInfoPrimary">
								{messageTime ? (
									<span className="messageItem__headerTime">
										{formatToHHMM(messageTime)}
									</span>
								) : null}
								<div className="messageItem__senderInfoName">
									{formattedName}
								</div>
							</div>
							{profileSubtitle ? (
								<div className="messageItem__senderInfoSubtitle">
									<span>{profileSubtitle}</span>
									<EyeIcon className="messageItem__senderInfoMetaIcon" />
								</div>
							) : null}
						</div>
					)}

					{onOpenThread &&
						renderMode === 'main' &&
						!alias?.messageType && (
							<button
								type="button"
								className={clsx(
									'messageItem__threadButton',
									isMyMessage &&
										'messageItem__threadButton--right',
									threadSummary?.replyCount
										? 'messageItem__threadButton--hasReplies'
										: ''
								)}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onOpenThread();
								}}
							>
								<span className="messageItem__threadButtonMain">
									{threadSummary?.replyCount
										? translate(
												'message.thread.replies',
												'{{count}} replies',
												{
													count: threadSummary.replyCount
												}
											)
										: translate(
												'message.thread.reply',
												'Reply'
											)}
								</span>
								{threadSummary?.replyCount ? (
									<span className="messageItem__threadButtonMeta">
										{threadSummary.lastReplyText}
									</span>
								) : (
									<span className="messageItem__threadButtonMeta">
										&nbsp;
									</span>
								)}
								<span className="messageItem__threadButtonHover">
									{translate(
										'message.thread.view',
										'View thread'
									)}
								</span>
							</button>
						)}
				</div>
			</div>
			{isActionMenuOpen && actionMenuPosition
				? createPortal(
						<div
							className="messageItem__actionMenu"
							ref={actionMenuRef}
							role="menu"
							style={{
								position: 'fixed',
								top: `${actionMenuPosition.top}px`,
								left: `${actionMenuPosition.left}px`,
								zIndex: 99999
							}}
						>
							{actionMenuItems.map((item) => (
								<button
									key={item.key}
									type="button"
									role="menuitem"
									className="messageItem__actionMenuItem"
									onClick={() =>
										handleActionMenuItemClick(item.key)
									}
								>
									<span className="messageItem__actionMenuItemIcon">
										{item.icon}
									</span>
									<span className="messageItem__actionMenuItemLabel">
										{item.label}
									</span>
								</button>
							))}
						</div>,
						document.body
					)
				: null}
			{isVisibilityMenuOpen && visibilityMenuPosition
				? createPortal(
						<div
							className="messageItem__visibilityMenu"
							ref={visibilityMenuRef}
							role="menu"
							style={{
								position: 'fixed',
								top: `${visibilityMenuPosition.top}px`,
								left: `${visibilityMenuPosition.left}px`,
								zIndex: 9000
							}}
						>
							<div className="messageItem__visibilityMenuSubheading">
								{translate(
									'message.visibility.people',
									'People that see this message'
								)}
							</div>
							<div className="messageItem__visibilityMenuHeading">
								{translate(
									'message.visibility.title',
									'Message Visible to...'
								)}
							</div>
							<div className="messageItem__visibilityMenuDivider" />
							<div className="messageItem__visibilityMenuSections">
								{(
									[
										{
											key: 'clients',
											title: translate(
												'message.audience.clients',
												'Clients'
											),
											items: visibilityGroups.clients,
											role: 'clients' as const
										},
										{
											key: 'counsellors',
											title: translate(
												'message.audience.counsellors',
												'Counsellors'
											),
											items: visibilityGroups.counsellors,
											role: 'counsellors' as const
										},
										{
											key: 'moderators',
											title: translate(
												'message.audience.moderators',
												'Moderators'
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
																	'message.audience.clientsEmpty',
																	'No clients are in this room'
																)
															: section.key ===
																  'counsellors'
																? translate(
																		'message.audience.counsellorsEmpty',
																		'No counsellors are in this room'
																	)
																: translate(
																		'message.audience.moderatorsEmpty',
																		'No moderators are in this room'
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
		</div>
	);
};

const MessageFlyoutMenu = ({
	_id,
	userId,
	isUserBanned,
	isMyMessage,
	isArchived,
	username
}: {
	_id: string;
	userId: string;
	username: string;
	isUserBanned: boolean;
	isMyMessage: boolean;
	isArchived: boolean;
}) => {
	const { activeSession } = useContext(ActiveSessionContext);
	const { getSetting } = useContext(RocketChatGlobalSettingsContext);
	const [isUserBanOverlayOpen, setIsUserBanOverlayOpen] =
		useState<boolean>(false);

	const currentUserIsModerator = isUserModerator({
		chatItem: activeSession.item,
		rcUserId: getValueFromCookie('rc_uid')
	});

	const subscriberIsModerator = isUserModerator({
		chatItem: activeSession.item,
		rcUserId: userId
	});

	return (
		<>
			<FlyoutMenu position={isMyMessage ? 'left-top' : 'right-top'}>
				{currentUserIsModerator &&
					!subscriberIsModerator &&
					!isUserBanned && (
						<BanUser
							userName={username}
							rcUserId={userId}
							chatId={activeSession.item.id}
							handleUserBan={() => {
								setIsUserBanOverlayOpen(true);
							}}
						/>
					)}

				{isMyMessage &&
					!isArchived &&
					getSetting<IBooleanSetting>(
						SETTING_MESSAGE_ALLOWDELETING
					) && (
						<DeleteMessage
							messageId={_id}
							className="flyoutMenu__item--delete"
						/>
					)}
			</FlyoutMenu>
			<BanUserOverlay
				overlayActive={isUserBanOverlayOpen}
				userName={username}
				handleOverlay={() => {
					setIsUserBanOverlayOpen(false);
				}}
			></BanUserOverlay>
		</>
	);
};

const DeleteMessage = ({
	messageId,
	className
}: {
	messageId: string;
	className?: string;
}) => {
	const { t: translate } = useTranslation();
	const [deleteOverlay, setDeleteOverlay] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);

	const deleteMessage = useCallback(() => {
		setIsRequestInProgress(true);
		apiDeleteMessage(messageId)
			.then(() => setDeleteOverlay(false))
			.then(() => setIsRequestInProgress(false));
	}, [messageId]);

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
					disabled: isRequestInProgress
				},
				{
					label: translate('message.delete.overlay.confirm'),
					function: 'CONFIRM',
					type: BUTTON_TYPES.PRIMARY,
					disabled: isRequestInProgress
				}
			],
			handleOverlay: (functionName) => {
				if (functionName === 'CONFIRM') {
					deleteMessage();
					return;
				}
				setDeleteOverlay(false);
			}
		}),
		[deleteMessage, isRequestInProgress, translate]
	);

	return (
		<>
			<button
				onClick={() => setDeleteOverlay(true)}
				className={`flex ${className}`}
			>
				<div className="mr--1">
					<TrashIcon
						width={24}
						height={24}
						style={{ display: 'block', padding: '2px 0' }}
						aria-hidden="true"
						focusable="false"
					/>
				</div>
				<div>{translate('message.delete.delete')}</div>
			</button>
			{deleteOverlay && (
				<Overlay
					item={deleteOverlayItem}
					handleOverlayClose={() => {
						setDeleteOverlay(false);
					}}
				/>
			)}
		</>
	);
};
