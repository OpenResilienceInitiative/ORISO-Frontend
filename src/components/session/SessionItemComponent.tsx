import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	lazy,
	Suspense
} from 'react';
import { ResizeObserver } from '@juggle/resize-observer';
import clsx from 'clsx';
import { scrollToEnd, isMyMessage, SESSION_LIST_TYPES } from './sessionHelpers';
import { formatToHHMM } from '../../utils/dateHelpers';
import {
	MessageItem,
	MessageItemComponent
} from '../message/MessageItemComponent';
import { SessionHeaderComponent } from '../sessionHeader/SessionHeaderComponent';
import { Button, BUTTON_TYPES, ButtonItem } from '../button/Button';
import {
	AUTHORITIES,
	getContact,
	hasUserAuthority,
	NotificationsContext,
	NOTIFICATION_TYPE_INFO,
	UserDataContext,
	SessionTypeContext,
	useTenant,
	ActiveSessionContext
} from '../../globalState';
import {
	STATUS_EMPTY,
	STATUS_ENQUIRY
} from '../../globalState/interfaces/SessionsDataInterface';
import { useHistory, useLocation } from 'react-router-dom';
import * as Tone from 'tone';
import { RocketChatUsersOfRoomProvider } from '../../globalState/provider/RocketChatUsersOfRoomProvider';
import './session.styles';
import { useDebouncedCallback } from 'use-debounce';
import { ReactComponent as ArrowDoubleDownIcon } from '../../resources/img/icons/arrow-double-down.svg';
import { ReactComponent as PersonCircleIcon } from '../../resources/img/icons/person-circle.svg';
import { ReactComponent as NotificationBellIcon } from '../../resources/img/icons/notification_bell.svg';
import { ReactComponent as WelcomeIllustration } from '../../resources/img/illustrations/welcome.svg';
import breathLevelEmojiSprite from '../../resources/img/icons/breath-level-emojis.svg';
import smoothScroll from './smoothScrollHelper';
import { DragAndDropArea } from '../dragAndDropArea/DragAndDropArea';
import useMeasure from 'react-use-measure';
import { AcceptAssign } from './AcceptAssign';
import { WaitingRoomContent } from '../videoConference/WaitingRoomContent';
import { useTranslation } from 'react-i18next';
import useDebounceCallback from '../../hooks/useDebounceCallback';
import { apiPostError, TError } from '../../api/apiPostError';
import { useE2EE } from '../../hooks/useE2EE';
import { MessageSubmitInterfaceSkeleton } from '../messageSubmitInterface/messageSubmitInterfaceSkeleton';
import { MessageSubmitErrorBoundary } from '../messageSubmitInterface/MessageSubmitErrorBoundary';
import { Text } from '../text/Text';
import { EncryptionBanner } from './EncryptionBanner';
import { apiGetSessionSupervisors } from '../../api/apiGetSessionSupervisors';
import { apiPatchNotificationActiveView } from '../../api/apiPatchNotificationActiveView';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { apiGetUserData } from '../../api/apiGetUserData';
import { apiGetAnonymousEnquiryDetails } from '../../api/apiGetAnonymousEnquiryDetails';
import { parseMessagePrefixes } from '../message/messageConstants';
import { decodeUsername } from '../../utils/encryptionHelpers';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import { PseudonymCard } from '../pseudonym/PseudonymCard';
import { PseudonymActionBar } from '../pseudonym/PseudonymActionBar';
import { PrivacyMessageCard } from '../pseudonym/PrivacyMessageCard';
import { WaitingQueueActionBar } from '../pseudonym/WaitingQueueActionBar';
import { ConsultantAcceptedActionBar } from '../pseudonym/ConsultantAcceptedActionBar';
import { AnonymousConsentGate } from '../pseudonym/AnonymousConsentGate';
import {
	BreathingTutorialCard,
	BreathingTutorialPhase
} from '../pseudonym/BreathingTutorialCard';
import {
	generatePseudonym,
	regeneratePseudonym,
	type Pseudonym
} from '../../utils/pseudonymGenerator';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import LegalLinks from '../legalLinks/LegalLinks';
import { renderToString } from 'react-dom/server';
import { mobileListView } from '../app/navigationHandler';
import { UserAvatar } from '../message/UserAvatar';
import {
	Dialog,
	Box as MuiBox,
	Typography as MuiTypography,
	Button as MuiButton
} from '@mui/material';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { LIVE_CHAT_OPENING_HOURS } from '../anonymousChat/liveChatOpeningHours';
import liveChatClosedIllustration from '../../resources/img/illustrations/live-chat-closed.svg';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';

const MessageSubmitInterfaceComponent = lazy(() =>
	import('../messageSubmitInterface/messageSubmitInterfaceComponent').then(
		(m) => ({ default: m.MessageSubmitInterfaceComponent })
	)
);

interface SessionItemProps {
	isTyping?: Function;
	messages?: MessageItem[];
	typingUsers: string[];
	hasUserInitiatedStopOrLeaveRequest: React.MutableRefObject<boolean>;
	bannedUsers: string[];
	refreshMessages?: () => void;
}

let initMessageCount: number;

type BreathPhase = 'inhale' | 'hold' | 'exhale';
type WaitingGameStage =
	| 'onboarding'
	| 'tutorial'
	| 'setup'
	| 'practice'
	| 'practiceResult'
	| 'bellyPractice'
	| 'selfTimer'
	| 'game'
	| 'completion'
	| 'prize'
	| 'serenity';
type BriefingScreen = {
	title: string;
	text: string;
	interaction: 'auto' | 'choice' | 'start';
	autoAdvanceMs?: number;
};
type BreathTiming = {
	inhale: number;
	hold: number;
	exhale: number;
};
type BreathPresetId = 'starter334' | 'standard446' | 'deep556';
const DEFAULT_BREATH_PHASE_SECONDS = 4;
const BREATHING_PRESETS: Array<{
	id: BreathPresetId;
	label: string;
	inhale: number;
	hold: number;
	exhale: number;
}> = [
	{ id: 'starter334', label: 'first time', inhale: 3, hold: 3, exhale: 4 },
	{
		id: 'standard446',
		label: 'mild experience (recommended)',
		inhale: 4,
		hold: 4,
		exhale: 6
	},
	{ id: 'deep556', label: 'long (experts)', inhale: 5, hold: 5, exhale: 6 }
];

const BREATH_LEVELS = [
	{ level: 1, title: 'Chaos Tamer', emoji: '😤', success: 'Good start.' },
	{
		level: 2,
		title: 'Breath Finder',
		emoji: '😤',
		success: 'You found a rhythm.'
	},
	{
		level: 3,
		title: 'Breath Director',
		emoji: '😌',
		success: 'Great control.'
	},
	{
		level: 4,
		title: 'Calm Builder',
		emoji: '😌',
		success: 'Flow is improving.'
	},
	{
		level: 5,
		title: 'Inner Balance',
		emoji: '🙂',
		success: 'Breathing stays smooth.'
	},
	{ level: 6, title: 'Rhythm Keeper', emoji: '🙂', success: 'Strong focus.' },
	{
		level: 7,
		title: 'Peace Crafter',
		emoji: '😇',
		success: 'You stay centered.'
	},
	{
		level: 8,
		title: 'Silent Navigator',
		emoji: '😇',
		success: 'Calm under pressure.'
	},
	{
		level: 9,
		title: 'Stillness Master',
		emoji: '🤍',
		success: 'Almost complete.'
	},
	{
		level: 10,
		title: 'True Wisdom',
		emoji: '🤍',
		success: 'You mastered this round.'
	}
];

const BRIEFING_SCREENS: BriefingScreen[] = [
	{
		title: '',
		text: 'So sorry you must wait at the moment, all counsellors are busy at the moment.',
		interaction: 'auto',
		autoAdvanceMs: 3200
	},
	{
		title: '',
		text: 'Waiting with all those problems can be quite daunting. So if you want we created a small waiting room bridge.',
		interaction: 'choice'
	},
	{
		title: '',
		text: 'Okay you need to do three things in the game.',
		interaction: 'auto',
		autoAdvanceMs: 2200
	}
];

const BRIEFING_NEGATIVE_SCREEN = {
	title: '',
	text: 'Okay please hold on once a counsellor is free we let you in.',
	interaction: 'negative' as const
};
const LEVEL_EMOJI_VIEWBOX_OFFSETS = [
	0, 240, 459, 678, 878, 1075, 1299, 1520, 1739, 1983
];
const TYPEWRITER_TIMING = {
	charForwardMs: 56,
	charForwardSlowMs: 68,
	charBackwardMs: 32,
	initialDelayMs: 140,
	initialDelaySlowMs: 180,
	fullLineGapMs: 1200,
	doneGapMs: 480,
	onboardingStartMs: 200,
	punctuationPauseMs: 120,
	prizeToSerenityMs: 1000
} as const;
const ROBOT_MESSAGE_REVEAL_GAP_MS = 3500;
const STANDARD_PRACTICE_TIMING: BreathTiming = {
	inhale: 4,
	hold: 4,
	exhale: 6
};

const LevelEmojiIcon = ({
	level,
	className
}: {
	level: number;
	className?: string;
}) => {
	const yOffset =
		LEVEL_EMOJI_VIEWBOX_OFFSETS[Math.max(0, Math.min(9, level - 1))];
	return (
		<svg
			className={className}
			viewBox={`0 ${yOffset} 121 120`}
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<image
				href={breathLevelEmojiSprite}
				x="0"
				y="0"
				width="121"
				height="2348"
			/>
		</svg>
	);
};

const INHALE_PHASE_ICON = (
	<svg
		className="session__waitingPhaseIcon session__waitingPhaseIcon--inhale"
		viewBox="0 0 82 107"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M9.44189 106.999H7.86611C6.12735 106.999 4.71881 105.591 4.71881 103.852C4.71881 102.113 6.12735 100.705 7.86611 100.705H9.44189C16.2757 100.705 21.9812 95.8603 23.3102 89.4193C22.1524 89.9334 20.7522 89.716 19.8035 88.7672C18.5747 87.5384 18.5747 85.5489 19.8035 84.3158L24.5224 79.5969C25.7512 78.3681 27.7449 78.3681 28.9738 79.5969L33.6969 84.3158C34.9257 85.5488 34.9257 87.5383 33.6969 88.7672C32.6185 89.8456 30.9508 89.9793 29.7304 89.1643C28.4431 99.2248 19.8494 106.999 9.44189 106.999ZM72.3793 100.705H73.9551C75.6938 100.705 77.1024 102.113 77.1024 103.852C77.1024 105.591 75.6938 106.999 73.9551 106.999H72.3793C61.9718 106.999 53.3782 99.2249 52.091 89.1644C50.8706 89.9794 49.2029 89.8457 48.1245 88.7673C46.8957 87.5385 46.8957 85.549 48.1245 84.3159L52.8476 79.597C54.0764 78.3682 56.0701 78.3682 57.299 79.597L62.018 84.3159C63.2467 85.5489 63.2467 87.5384 62.018 88.7673C61.0692 89.7161 59.669 89.9334 58.5112 89.4193C59.8404 95.8602 65.5454 100.705 72.3793 100.705ZM61.3658 59.7942C63.1045 59.7942 64.5131 61.2027 64.5131 62.9415C64.5131 64.6802 63.1045 66.0888 61.3658 66.0888H61.0022C58.649 66.0888 56.4213 67.142 54.9249 68.9602C51.3513 73.3029 46.599 75.5307 40.91 75.5307C35.221 75.5307 30.4692 73.3029 26.8952 68.9602C25.3989 67.1421 23.171 66.0888 20.8179 66.0888H20.4542C18.7155 66.0888 17.3069 64.6802 17.3069 62.9415C17.3069 61.2027 18.7155 59.7942 20.4542 59.7942H20.8179C25.0519 59.7942 29.0644 61.6875 31.7565 64.9602C34.1263 67.8442 37.0981 69.2361 40.91 69.2361C44.7219 69.2361 47.6936 67.8442 50.0635 64.9602C52.7552 61.6875 56.7677 59.7942 61.0022 59.7942H61.3658ZM15.7239 68.0741C17.2328 68.9393 17.7552 70.862 16.8942 72.3708C16.029 73.8798 14.1063 74.4021 12.5975 73.5412L7.05109 70.3689C2.69169 67.8778 0 63.2425 0 58.219C0 53.2911 2.21105 48.6267 6.02292 45.5042L10.7961 41.6004C15.1095 38.0727 17.9225 33.0446 18.6748 27.5278L22.0562 2.72089C22.2903 0.998835 23.8785 -0.204915 25.6006 0.0292007C27.3227 0.263263 28.5306 1.85152 28.2923 3.57358L24.9109 28.3762C23.9454 35.4733 20.3257 41.9395 14.7835 46.4699L10.0104 50.3778C7.65724 52.3005 6.2946 55.1803 6.2946 58.2189C6.2946 60.9816 7.77419 63.5355 10.1733 64.9064L15.7239 68.0741ZM53.5291 3.57347C53.2909 1.85141 54.4988 0.263103 56.2208 0.0290937C57.9429 -0.204969 59.5312 0.998781 59.7652 2.72079L63.1466 27.5277C63.8989 33.0448 66.7118 38.0731 71.0253 41.6003L75.7985 45.5041C79.6104 48.6264 81.8214 53.2908 81.8214 58.2189C81.8214 63.2429 79.1297 67.8781 74.7703 70.3688L69.2239 73.5411C67.715 74.4021 65.7924 73.8797 64.9272 72.3707C64.0662 70.8618 64.5886 68.9392 66.0975 68.074L71.6482 64.9059C74.0473 63.535 75.5269 60.9811 75.5269 58.2184C75.5269 55.1798 74.1644 52.3 71.8111 50.3773L67.038 46.4693C61.4957 41.9385 57.8761 35.473 56.9106 28.3756L53.5291 3.57347Z"
			fill="#111111"
		/>
	</svg>
);

const HOLD_PHASE_ICON = (
	<svg
		className="session__waitingPhaseIcon session__waitingPhaseIcon--hold"
		viewBox="0 0 68 80"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M14.9128 0C23.0784 0 29.7064 6.74688 29.7064 14.9128V65.2096C29.7064 73.3752 23.0782 80.0032 14.9128 80.0032C6.74736 80.0032 0 73.375 0 65.2096V14.9128C0 6.6288 6.62816 0 14.9128 0ZM14.9128 3.55C8.64096 3.55 3.5504 8.63752 3.5504 14.9124V65.2092C3.5504 71.3623 8.63792 76.4532 14.9128 76.4532C21.0659 76.4532 26.1568 71.3657 26.1568 65.2092V14.9124C26.1568 8.64056 21.0693 3.55 14.9128 3.55Z"
			fill="#111111"
		/>
		<path
			d="M52.5436 0C60.8276 0 67.4564 6.74688 67.4564 14.9128V65.2096C67.4564 73.3752 60.7095 80.0032 52.5436 80.0032C44.3777 80.0032 37.75 73.375 37.75 65.2096V14.9128C37.75 6.6288 44.3782 0 52.5436 0ZM52.5436 3.55C46.3905 3.55 41.2996 8.63752 41.2996 14.9124V65.2092C41.2996 71.3623 46.3871 76.4532 52.5436 76.4532C58.8154 76.4532 63.906 71.3657 63.906 65.2092V14.9124C63.906 8.64056 58.8185 3.55 52.5436 3.55Z"
			fill="#111111"
		/>
	</svg>
);

const EXHALE_PHASE_ICON = (
	<svg
		className="session__waitingPhaseIcon session__waitingPhaseIcon--exhale"
		viewBox="0 0 32 32"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			fill="#212121"
			d="M6.23462 6.77759C4.10595 9.08911 3 12.3286 3 15.9989C3 19.6691 4.10595 22.9087 6.23462 25.2202C7.2388 26.3106 8.49087 27.2167 10.0029 27.868C10.001 27.9118 10 27.9558 10 28C10 28.9767 10.4667 29.8443 11.1893 30.3921C8.55638 29.6775 6.40454 28.3571 4.76342 26.575C2.22626 23.8199 1 20.06 1 15.9989C1 11.9378 2.22626 8.17785 4.76342 5.42276C7.313 2.65419 11.0952 1 15.9989 1C20.9026 1 24.6848 2.65419 27.2343 5.42276C29.7715 8.17785 30.9978 11.9378 30.9978 15.9989C30.9978 20.06 29.7715 23.8199 27.2343 26.575C25.5939 28.3563 23.4433 29.6763 20.812 30.3912C21.5338 29.8433 22 28.9761 22 28C22 27.9554 21.999 27.9111 21.9971 27.867C23.5081 27.2159 24.7595 26.3101 25.7631 25.2202C27.8918 22.9087 28.9978 19.6691 28.9978 15.9989C28.9978 12.3286 27.8918 9.08911 25.7631 6.77759C23.6469 4.47956 20.4296 3 15.9989 3C11.5681 3 8.35088 4.47956 6.23462 6.77759Z"
		/>
		<path
			fill="#212121"
			d="M13 30C11.981 30 11.1399 29.2379 11.0158 28.2525C11.0054 28.1698 11 28.0855 11 28C11 26.8954 11.8954 26 13 26C14.4872 25.2831 15.195 23.6065 15.4472 22.851L15.4527 22.8342C15.4708 22.7798 15.4864 22.7303 15.4996 22.6867C15.5412 22.5499 15.56 22.47 15.56 22.47C15.77 22.19 16.18 22.19 16.39 22.47C16.39 22.47 16.4088 22.5472 16.4505 22.68C16.4643 22.7239 16.4806 22.7739 16.4996 22.8292L16.5059 22.8474C16.7622 23.5875 17.4793 25.2245 19 26C20.1046 26 21 26.8954 21 28C21 28.0853 20.9947 28.1693 20.9843 28.2517C20.8605 29.2375 20.0193 30 19 30C18.9433 30 18.8872 29.9976 18.8318 29.993C18.7203 30.3109 18.5568 30.6043 18.3516 30.863C17.802 31.5557 16.9529 32 16 32C15.0472 32 14.1982 31.5559 13.6487 30.8633C13.4433 30.6045 13.2798 30.311 13.1682 29.993C13.1128 29.9976 13.0567 30 13 30Z"
		/>
		<path
			fill="#212121"
			d="M17.3802 22.3 17.3889 22.3295C17.7481 21.968 17.97 21.4699 17.97 20.92 17.97 19.8155 17.0745 18.92 15.97 18.92 14.8654 18.92 13.97 19.8155 13.97 20.92 13.97 21.4744 14.1955 21.9761 14.5599 22.3384L14.5675 22.3117C14.5756 22.2831 14.5811 22.2621 14.5843 22.25L14.5872 22.2384 14.6346 22.0373 14.76 21.87C15.37 21.0567 16.58 21.0567 17.19 21.87L17.3132 22.0343 17.3609 22.2306 17.3638 22.2414C17.3668 22.2528 17.3722 22.2726 17.3802 22.3ZM6.97423 9.65811C7.11769 9.22774 7.47625 8.55049 8.06915 7.98761 8.65355 7.4328 9.45199 7 10.4999 7 10.776 7 10.9999 6.77614 10.9999 6.5 10.9999 6.22386 10.776 6 10.4999 6 9.1478 6 8.1129 6.5672 7.38064 7.26239 6.65687 7.94951 6.21542 8.77226 6.02555 9.34189 5.93823 9.60386 6.07981 9.88702 6.34178 9.97434 6.60375 10.0617 6.88691 9.92009 6.97423 9.65811ZM25.0255 9.65811C24.8821 9.22774 24.5235 8.55049 23.9306 7.98761 23.3462 7.4328 22.5478 7 21.4999 7 21.2237 7 20.9999 6.77614 20.9999 6.5 20.9999 6.22386 21.2237 6 21.4999 6 22.852 6 23.8869 6.5672 24.6191 7.26239 25.3429 7.94951 25.7844 8.77226 25.9742 9.34189 26.0616 9.60386 25.92 9.88702 25.658 9.97434 25.396 10.0617 25.1129 9.92009 25.0255 9.65811ZM7.61972 13.2152C7.18626 12.8729 6.55743 12.9469 6.21519 13.3804 5.87295 13.8138 5.9469 14.4427 6.38036 14.7849 7.39624 15.587 8.45824 16 10 16 11.534 16 12.6389 15.5851 13.6321 14.7749 14.0601 14.4258 14.124 13.7959 13.7749 13.368 13.4258 12.94 12.7959 12.8761 12.368 13.2251 11.7506 13.7287 11.0984 14 10 14 8.90948 14 8.28378 13.7395 7.61972 13.2152ZM19.6197 13.2152C19.1863 12.8729 18.5574 12.9469 18.2152 13.3804 17.8729 13.8138 17.9469 14.4427 18.3804 14.7849 19.3962 15.587 20.4582 16 22 16 23.534 16 24.6389 15.5851 25.6321 14.7749 26.0601 14.4258 26.124 13.7959 25.7749 13.368 25.4258 12.94 24.7959 12.8761 24.368 13.2251 23.7506 13.7287 23.0984 14 22 14 20.9095 14 20.2838 13.7395 19.6197 13.2152Z"
		/>
	</svg>
);

const SPEAKER_HINT_ICON = (
	<svg
		className="session__waitingVolumeHintIcon"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path d="M4 10.5V13.5H7.2L11 17V7L7.2 10.5H4Z" fill="currentColor" />
		<path
			d="M14.2 9.2C14.9 9.9 15.3 10.9 15.3 12C15.3 13.1 14.9 14.1 14.2 14.8"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
		/>
		<path
			d="M16.8 6.8C18.1 8.1 18.9 9.95 18.9 12C18.9 14.05 18.1 15.9 16.8 17.2"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
		/>
	</svg>
);

const COMPLETION_HEART_ICON = (
	<svg
		width="226"
		height="238"
		viewBox="0 0 226 238"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M223.957 49.6392C223.143 49.3518 222.328 49.1602 221.482 49.0484C220.939 48.9526 220.381 48.9526 219.662 48.8887C219.742 47.7072 219.806 46.6533 219.885 45.6154C220.556 38.7333 220.189 31.7873 218.816 25.0168C216.741 12.7377 207.111 3.12502 194.832 1.08115C187.758 -0.339994 180.494 -0.355937 173.403 1.00131C160.98 3.28468 149.165 8.15484 138.737 15.2925C127.129 23.2125 116.861 32.9368 108.335 44.0983C107.568 45.2 106.467 46.0463 105.205 46.5253C104.407 46.8927 103.64 47.3078 102.906 47.8028L104.295 49.3516C102.586 52.0183 100.894 54.6212 99.2491 57.3036C97.6204 60.002 96.2153 62.7165 94.7302 65.3833C94.5385 65.3833 94.4268 65.3833 94.4108 65.3194C94.0435 64.6328 93.6603 63.9623 93.309 63.2596C89.9239 56.1858 85.3252 49.7509 79.7366 44.2582C72.4873 36.7377 62.7307 32.139 52.3361 31.3242C39.8652 29.999 27.4904 34.4698 18.7721 43.4758C15.4188 46.9727 12.6245 50.9486 10.485 55.2918C2.35736 71.2757 -0.66062 89.3668 1.83044 107.108C2.24559 108.625 1.91028 110.254 0.920269 111.467C-0.612631 113.176 -0.213419 114.373 1.99011 115.108C2.94819 115.379 3.63477 116.194 3.77849 117.168C4.89624 120.984 5.98202 124.832 7.38718 128.553C12.1298 140.784 18.6922 152.233 26.8676 162.501C39.3226 178.341 53.5017 192.727 69.1676 205.405C73.5586 209.013 78.2051 212.319 82.7878 215.624C84.9595 217.238 87.4345 218.419 90.069 219.106C92.2086 219.696 94.46 219.696 96.5999 219.106C97.5899 218.802 98.5958 218.323 98.564 217.141C98.5321 215.959 97.3983 215.705 96.5361 215.64H96.5202C95.2427 215.48 94.0451 214.906 93.119 214.028L88.6 210.435C88.2008 210.116 87.8176 209.78 87.3705 209.397L87.3546 209.413C89.0471 209.684 90.7556 209.796 92.4642 209.764C94.2366 209.508 95.9611 209.029 97.5739 208.295C103.258 205.661 108.735 202.595 113.941 199.129C114.244 198.874 114.516 198.587 114.739 198.283C114.372 198.012 113.973 197.772 113.558 197.596C112.312 197.277 110.971 197.485 109.853 198.139C106.548 199.928 103.195 201.668 99.8573 203.426C99.2346 203.76 98.5639 203.984 97.9251 204.272C112.232 191.337 127.801 179.888 144.406 170.085C144.055 170.835 143.608 171.553 143.081 172.192C129.349 189.916 114.707 206.922 99.2037 223.113C96.1061 226.339 93.1996 229.771 90.3255 233.204C88.8885 234.913 89.3196 235.935 91.4273 236.605V236.621C91.7627 236.718 92.1139 236.797 92.4652 236.862C95.1639 237.341 97.9583 236.654 100.13 234.962C105.399 230.953 110.333 226.514 114.852 221.676C136.552 198.81 156.527 174.365 174.618 148.542C184.488 134.858 193.348 120.471 201.141 105.511C208.646 91.2834 214.187 76.0984 217.62 60.3699C217.827 57.6715 219.52 55.324 222.011 54.2703C222.905 53.8231 223.736 53.2484 224.47 52.5618C225.875 51.444 225.698 50.4057 223.957 49.6392ZM124.973 39.3401C135.048 27.1727 147.727 17.4323 162.066 10.8058C167.432 8.31477 173.115 6.59048 178.959 5.6642C182.121 5.13725 185.363 5.13725 188.524 5.6642C194.352 6.74999 199.382 10.4546 202.144 15.7077C204.125 19.2685 205.466 23.1487 206.088 27.1727C202.975 28.5298 200.037 29.983 196.987 31.1166C171.853 40.4897 147.153 50.9328 122.962 62.5411H122.978C121.684 63.1958 120.311 63.6908 118.906 64.042C119.193 63.7227 119.513 63.4193 119.832 63.1319C141.628 45.9348 164.749 30.4778 188.973 16.9037C189.962 16.3448 191.017 15.8817 191.99 15.291H191.974C192.581 14.9077 193.14 14.4607 193.682 13.9816C193.443 13.0555 192.66 12.3689 191.703 12.2252C189.5 11.5865 187.12 11.826 185.076 12.8958C180.685 15.0833 176.325 17.3506 171.902 19.4746C158.282 26.0374 144.598 32.5998 130.498 38.2046C128.725 38.9072 126.905 39.5458 125.101 40.2006C125.005 40.2485 124.845 40.1526 124.606 40.0887C124.701 39.8333 124.829 39.5796 124.973 39.3401ZM114.753 53.2479C116.318 50.7888 117.995 48.3938 119.719 46.0465V46.0624C120.246 45.328 120.981 44.7691 121.827 44.4338C128.374 42.0546 134.936 39.7712 141.515 37.4719C141.85 37.3282 142.218 37.2803 142.585 37.3122C131.615 44.9767 120.757 52.7852 110.522 61.3914L110.09 61.0721C111.591 58.4854 113.076 55.8349 114.705 53.28L114.753 53.2479ZM104.758 72.6487C105.045 72.5528 105.189 72.457 105.317 72.4729C109.213 73.0318 113.189 72.4731 116.797 70.8603C123.839 67.9861 130.817 65.0002 137.811 62.014C141.595 60.3853 145.332 58.6129 149.084 56.9522C149.771 56.6169 150.521 56.3933 151.304 56.2975L100.46 87.1632V87.1791C101.386 82.197 102.825 77.3271 104.758 72.6487ZM87.4805 89.7341C87.3846 90.5006 87.3846 91.299 87.4805 92.0654C87.8319 93.3109 88.247 94.5244 88.726 95.7061C87.9755 96.3128 87.1611 96.8557 86.3149 97.3029C70.7782 104.345 55.7207 112.392 40.5813 120.233C38.8408 121.143 37.0524 121.941 35.28 122.787L34.9926 122.452V122.436C35.4716 121.781 35.9666 121.127 36.5095 120.52C40.2619 116.64 43.9343 112.664 47.8463 108.944C58.8959 98.1653 70.7283 88.2015 83.2147 79.1316L85.6098 77.4231L85.6258 77.4391C86.7915 81.431 87.4166 85.5668 87.4805 89.7341ZM73.2372 52.4176C73.1254 52.6572 73.0776 52.8328 72.9977 52.8648C66.8023 55.2121 60.8142 58.0222 55.0501 61.2798C43.4418 67.635 31.9291 74.1337 20.3681 80.5849C19.2024 81.2395 18.0049 81.8464 16.5838 82.6128H16.5998C31.5936 68.4013 47.593 55.2921 64.4712 43.3799C67.7287 46.0466 70.6664 49.0805 73.2372 52.4176ZM21.3888 57.8307C24.0075 51.8908 27.9676 46.6532 32.9493 42.5017C36.9571 39.1484 41.9072 37.1046 47.1124 36.6415C51.2639 36.4338 55.3676 37.4717 58.9126 39.6434C59.0882 39.7711 59.2478 39.8989 59.3756 40.0585C59.4235 40.1064 59.4235 40.2023 59.5193 40.4738C46.7451 46.19 34.4661 53.0243 21.3725 58.6609C21.3885 58.1819 21.3249 57.9743 21.3888 57.8307ZM15.9918 72.7284C17.0617 69.3273 18.1793 65.9901 19.2652 62.6047H19.2492C19.5686 61.5668 20.3191 60.7365 21.309 60.3373C33.3486 54.7486 45.3882 49.1278 57.4119 43.4913C58.1304 43.124 58.9129 42.9165 59.7272 42.8526C59.4079 43.2039 59.0565 43.5232 58.6893 43.8266C55.5437 46.0302 52.4138 48.2495 49.2524 50.4054C37.8513 58.0381 26.9137 66.3411 16.5026 75.267C16.1992 75.5225 15.864 75.7142 15.2092 76.1772C15.5127 74.756 15.6724 73.7184 15.9918 72.7284ZM13.4849 98.5163V89.0156C13.4849 88.6003 14.0277 88.0414 14.4589 87.8019C28.3666 79.9139 42.2746 72.0257 56.1824 64.1699C57.1405 63.6111 58.1784 63.18 59.2321 62.8766C43.4241 73.9421 28.2708 85.9178 13.8379 98.724L13.4849 98.5163ZM14.9539 105.957L15.401 105.51V105.494C28.7978 92.5282 42.9454 80.3451 57.7623 69.0237C63.6224 64.6487 69.6902 60.513 75.9174 56.1538L75.9014 56.138C79.4942 61.3914 82.3205 67.1238 84.2846 73.1756C71.2072 78.4128 58.5127 84.6086 46.3291 91.682C36.7483 96.7916 27.0883 101.854 17.4755 106.931C16.6611 107.362 15.767 107.682 14.9207 108.097C14.2341 107.251 14.266 106.612 14.9366 105.941L14.9539 105.957ZM15.4329 112.456C29.6922 106.037 43.1208 98.1806 57.0911 91.171C56.6918 91.5701 56.3245 92.0172 55.9094 92.3526C49.6981 98.0052 43.3907 103.546 37.307 109.326C33.7621 112.727 30.4886 116.416 27.2475 120.072V120.056C26.1776 121.302 25.2835 122.675 24.5648 124.144C23.6068 126.028 24.1497 127.258 26.1138 128.04V128.056C28.6526 129.062 31.479 129.11 34.0497 128.168C36.876 127.226 39.6225 126.076 42.3049 124.767C49.7458 121.03 57.0911 117.102 64.5159 113.35C69.7695 110.683 75.0865 108.096 80.3879 105.494H80.3719C80.9945 105.158 81.6813 104.967 82.3838 104.935C73.3621 111.561 64.2764 118.124 55.3503 124.878C46.1371 131.505 37.5463 138.962 29.7064 147.169C23.0161 136.471 18.1937 124.734 15.4312 112.439L15.4329 112.456ZM33.8915 153.718C34.6579 152.457 35.5202 151.258 36.4463 150.11C38.8415 147.49 41.3802 144.984 44.0471 142.636C52.3341 135.706 60.6854 128.824 69.1482 122.118C75.9984 116.673 83.056 111.499 90.0022 106.182C90.9283 105.528 91.9662 105.065 93.0521 104.793C96.2136 103.979 99.3275 102.941 102.345 101.711C113.794 96.6974 125.131 91.3804 136.612 86.3823C151.413 79.9952 166.343 73.8477 181.225 67.5882C182.136 67.173 183.109 66.9015 184.115 66.8058C183.493 67.141 182.886 67.5084 182.263 67.8278C162.143 78.1427 142.073 88.5697 122.48 99.8428C108.125 108.114 93.8818 116.561 79.6243 125.024C76.3987 126.956 73.381 129.223 70.2511 131.379C69.6283 131.842 69.0535 132.369 68.5585 132.976C67.5845 134.19 67.84 135.307 69.309 135.818C70.3309 136.09 71.3848 136.233 72.4387 136.249C73.1092 136.281 73.7798 136.281 74.4506 136.249C74.3228 136.377 74.1791 136.505 74.0195 136.601C63.337 141.774 52.7346 147.107 41.6527 151.403C39.7207 152.138 37.7567 152.743 35.7926 153.383C35.1699 153.526 34.5303 153.637 33.8915 153.718ZM66.0664 190.076C55.1285 180.223 45.2927 169.238 36.7018 157.279C37.117 157.151 37.4842 157.038 37.8515 156.944C44.9731 154.947 51.9031 152.297 58.5615 149.056C77.8025 140.161 96.9479 131.06 116.219 122.261C130.702 115.651 145.376 109.407 159.97 103.02C160.816 102.653 161.678 102.35 162.525 102.03L162.716 102.382L159.603 104.218C127.284 122.836 96.0018 143.227 65.9366 165.293C63.3817 167.177 60.8269 169.189 58.3517 171.184C57.6331 171.776 56.9785 172.431 56.4037 173.165C55.6212 174.203 55.7489 175.049 56.9306 175.623V175.607C58.0164 176.118 59.182 176.454 60.3797 176.598C62.3756 176.805 64.3876 176.454 66.1921 175.576C69.5931 174.059 72.9302 172.526 76.2515 170.898C103.045 157.836 130.222 145.636 157.781 134.284C158.611 133.9 159.507 133.677 160.416 133.629C159.507 134.172 158.611 134.731 157.702 135.242C141.446 144.503 125.143 153.685 108.951 163.058C96.177 170.482 83.4029 178.02 71.2194 186.418C69.4789 187.616 67.7703 188.877 66.0619 190.074L66.0664 190.076ZM121.316 176.455C111.193 183.178 101.564 190.636 92.5264 198.778C90.8178 200.376 89.2211 202.1 87.7518 203.937C86.5064 205.118 86.0913 206.922 86.6981 208.519L86.2031 208.614L72.9977 197.166C90.6419 190.188 107.153 181.661 124.286 174.459L121.316 176.455ZM168.754 136.888C164.89 142.429 161.011 147.953 157.162 153.495V153.478C156.556 154.373 155.694 155.044 154.688 155.411C131.901 164.32 109.755 174.652 87.5909 184.983C86.7447 185.382 85.8505 185.765 84.9723 186.164L84.7807 185.749C112.149 167.626 140.877 151.786 169.727 135.098C169.265 135.992 169.057 136.471 168.754 136.902V136.888ZM202.75 66.869V66.853C200.115 76.7531 196.619 86.4137 192.322 95.7067C188.027 105 183.205 114.054 177.855 122.788C177.328 123.714 176.355 124.289 175.3 124.273C172.89 124.544 170.526 125.039 168.212 125.726C156.347 129.494 144.691 133.901 133.306 138.931C118.823 145.223 104.42 151.706 89.9838 158.06C89.2493 158.427 88.4829 158.684 87.6685 158.796C88.0836 158.445 88.5148 158.06 88.9139 157.741C115.612 138.931 142.647 120.649 171.086 104.507C176.594 101.377 181.976 98.0561 187.388 94.7826L187.405 94.7986C188.57 94.096 189.656 93.2817 190.647 92.3714C191.892 91.1899 191.636 90.1839 190.008 89.4494C188.155 88.6191 186.095 88.4594 184.147 88.9544C182.071 89.4654 180.043 90.1042 178.048 90.8866C144.228 104.363 110.808 118.814 78.0247 134.654C76.9229 135.197 75.7893 135.628 74.6555 136.107H74.6715C75.5178 135.197 76.4599 134.367 77.4818 133.648C86.8232 128.187 96.1799 122.774 105.585 117.409C136.993 99.5406 168.753 82.3277 200.85 65.7519C201.472 65.4325 202.111 65.1291 203.18 64.6182C203.005 65.6083 202.942 66.2629 202.75 66.8857V66.869ZM206.023 51.4125L206.007 51.3965C205.943 52.7538 204.97 53.9034 203.644 54.1749C182.055 61.5999 160.641 69.5039 139.663 78.4937C130.992 82.2301 122.385 86.1581 113.763 90.0223L111.448 91.0602C111.671 90.1661 112.055 89.3037 112.55 88.5053C113.284 87.8506 114.114 87.2759 114.993 86.8128C143.415 68.6575 172.189 51.1089 201.856 35.0457C203.358 34.1994 204.875 33.4809 206.743 32.4909C206.823 33.5767 206.903 34.2473 206.934 34.9499V34.934C207.078 40.443 206.775 45.9676 206.009 51.4287L206.023 51.4125Z"
			fill="black"
		/>
	</svg>
);

export const SessionItemComponent = (props: SessionItemProps) => {
	const { t: translate } = useTranslation();
	const tenantData = useTenant();

	const { activeSession } = useContext(ActiveSessionContext);
	const { userData, setUserData } = useContext(UserDataContext);
	const { addEventNotification } = useContext(NotificationsContext);
	const { type } = useContext(SessionTypeContext);
	const legalLinks = useContext(LegalLinksContext);
	const location = useLocation();
	const history = useHistory();
	const isEmbeddedNotificationsView =
		new URLSearchParams(location.search).get('embeddedNotifications') ===
		'1';
	const [isSupervisor, setIsSupervisor] = useState(false);
	const [showWaitingMiniGame, setShowWaitingMiniGame] = useState(false);
	const [breathPhase, setBreathPhase] = useState<BreathPhase>('inhale');
	const [phaseTotalMs, setPhaseTotalMs] = useState(0);
	const [phaseMsLeft, setPhaseMsLeft] = useState(0);
	const [breathCycles, setBreathCycles] = useState(0);
	const [breathProgress, setBreathProgress] = useState(0.2);
	const [selectedPresetId, setSelectedPresetId] =
		useState<BreathPresetId>('standard446');
	const [customTiming, setCustomTiming] = useState<BreathTiming>({
		inhale: 4,
		hold: 4,
		exhale: 6
	});
	const [waitingGameStage, setWaitingGameStage] =
		useState<WaitingGameStage>('tutorial');
	const [currentLevel, setCurrentLevel] = useState(1);
	const [briefingScreenIndex, setBriefingScreenIndex] = useState(0);
	const [showBriefingNegativeScreen, setShowBriefingNegativeScreen] =
		useState(false);
	/**
	 * Index into the three vertical Carimat breathing-tutorial cards
	 * (0=inhale, 1=hold, 2=exhale). Replaces the old horizontal phase strip
	 * that used to be shown inline at the end of the briefing text.
	 */
	const [tutorialCardIndex, setTutorialCardIndex] = useState<0 | 1 | 2>(0);
	const tutorialPhases: BreathingTutorialPhase[] = [
		'inhale',
		'hold',
		'exhale'
	];

	/**
	 * Belly-breathing practice cards shown right after the first practice
	 * round completes — three more Carimat messages with "Auto pilot" /
	 * "Time it" buttons walking the asker through a deeper belly breath.
	 */
	const [bellyCardIndex, setBellyCardIndex] = useState<0 | 1 | 2>(0);
	/**
	 * Belly-stage interaction mode.
	 *   'autoPilot' — phases advance automatically when the timer expires.
	 *   'timeIt'    — the asker clicks the active (red) button to step forward.
	 * Either button is clickable at any time: clicking the inactive mode
	 * switches modes without advancing; clicking the active timeIt advances.
	 */
	const [bellyMode, setBellyMode] = useState<'autoPilot' | 'timeIt'>(
		'autoPilot'
	);
	const [gameMode, setGameMode] = useState<'autoPilot' | 'timeIt'>(
		'autoPilot'
	);
	const [stageMessage, setStageMessage] = useState(
		'Let us get you grounded with one easy round.'
	);
	const [typedText, setTypedText] = useState('');
	const [typewriterBusy, setTypewriterBusy] = useState(false);
	const [bubbleTypedLen, setBubbleTypedLen] = useState(0);
	const [briefingTypedText, setBriefingTypedText] = useState('');
	const [briefingTypewriterBusy, setBriefingTypewriterBusy] = useState(false);
	const [gameStatusTypedText, setGameStatusTypedText] = useState('');
	const [gameStatusTypewriterBusy, setGameStatusTypewriterBusy] =
		useState(false);
	const [levelBadgeTypedText, setLevelBadgeTypedText] = useState('');
	const [levelBadgeTypewriterBusy, setLevelBadgeTypewriterBusy] =
		useState(false);
	const [centerStageTypedText, setCenterStageTypedText] = useState('');
	const [centerStageTypewriterBusy, setCenterStageTypewriterBusy] =
		useState(false);
	const [joinPromptEscalated, setJoinPromptEscalated] = useState(false);
	/**
	 * Initial values for the consent/pseudonym gates are read synchronously
	 * from sessionStorage on mount. Without this, the first render always
	 * starts at `false` and the typing animation replays on every reload even
	 * when the user already confirmed earlier in the session.
	 */
	const [
		anonymousInquiryConsentAccepted,
		setAnonymousInquiryConsentAccepted
	] = useState(() => {
		try {
			return (
				sessionStorage.getItem(
					`anonymous-inquiry-consent-${activeSession.item.id}`
				) === '1'
			);
		} catch {
			return false;
		}
	});
	const [pseudonymConfirmed, setPseudonymConfirmed] = useState(() => {
		try {
			return (
				sessionStorage.getItem(
					`anonymous-pseudonym-${activeSession.item.id}`
				) === '1'
			);
		} catch {
			return false;
		}
	});
	const [pseudonymSaving, setPseudonymSaving] = useState(false);
	const [queuePeopleAhead, setQueuePeopleAhead] = useState<number | null>(
		null
	);
	const [consultantAccepted, setConsultantAccepted] = useState(false);
	/**
	 * Live count of consultants currently available for this anonymous
	 * enquiry, fed by the `apiGetAnonymousEnquiryDetails` poll. `null` while
	 * unknown. When this drops to 0 the "Live-Chat ist zurzeit leider
	 * geschlossen" modal is shown; it auto-closes once a consultant becomes
	 * available again.
	 */
	const [numAvailableConsultants, setNumAvailableConsultants] = useState<
		number | null
	>(null);
	/**
	 * Set when the asker manually dismisses the no-availability modal while
	 * the count is still 0, so the poll doesn't immediately reopen it. Reset
	 * automatically as soon as a consultant becomes available again.
	 */
	const [liveChatClosedDismissed, setLiveChatClosedDismissed] =
		useState(false);
	const [liveChatClosedHintOpen, setLiveChatClosedHintOpen] = useState(false);
	/**
	 * Persist the "Jetzt Chat starten" dismissal in sessionStorage so a
	 * reload after the asker has already unlocked the composer doesn't
	 * throw them back to the waiting-queue screen. Keyed per session so
	 * switching sessions keeps its own state.
	 */
	const [waitingGateDismissed, setWaitingGateDismissedState] = useState(
		() => {
			try {
				return (
					sessionStorage.getItem(
						`anonymous-waiting-dismissed-${activeSession.item.id}`
					) === '1'
				);
			} catch {
				return false;
			}
		}
	);
	const setWaitingGateDismissed = useCallback(
		(value: boolean) => {
			setWaitingGateDismissedState(value);
			try {
				const key = `anonymous-waiting-dismissed-${activeSession.item.id}`;
				if (value) {
					sessionStorage.setItem(key, '1');
				} else {
					sessionStorage.removeItem(key);
				}
			} catch {
				/* storage errors are non-fatal — state still lives in memory */
			}
		},
		[activeSession.item.id]
	);
	const [currentPseudonym, setCurrentPseudonym] = useState<Pseudonym>(() =>
		generatePseudonym()
	);
	const handleRegeneratePseudonym = useCallback(() => {
		setCurrentPseudonym((prev) => regeneratePseudonym(prev));
	}, []);
	const [robotSequenceVisibleCount, setRobotSequenceVisibleCount] =
		useState(0);
	const timerRef = useRef<number | null>(null);
	const phaseTransitionLockRef = useRef(false);
	const typewriterRef = useRef<number | null>(null);
	const briefingTypewriterRef = useRef<number | null>(null);
	const gameStatusTypewriterRef = useRef<number | null>(null);
	const levelBadgeTypewriterRef = useRef<number | null>(null);
	const centerStageTypewriterRef = useRef<number | null>(null);
	const cueMasterGainRef = useRef<Tone.Gain | null>(null);
	const cuePianoSynthRef = useRef<Tone.PolySynth | null>(null);
	const cuePianoReverbRef = useRef<Tone.Reverb | null>(null);
	const cueAirNoiseRef = useRef<Tone.Noise | null>(null);
	const cueAirFilterRef = useRef<Tone.Filter | null>(null);
	const cueAirGainRef = useRef<Tone.Gain | null>(null);

	// Threads feature toggle (tenant-level). Master switch disables for all chat types.
	// When enabled, per-chat-type switches decide if threads are available in 1-on-1 vs group chats.
	const {
		featureSupervisionEnabled = true,
		featureSupervisionAnonymousChatsEnabled = true,
		featureSupervisionOneOnOneChatsEnabled = true,
		featureThreadsEnabled = true,
		featureThreadsAnonymousChatsEnabled = true,
		featureThreadsGroupChatsEnabled = true,
		featureThreadsOneOnOneEnabled = true,
		featureThreadsSupervisionChatsEnabled = true
	} = getTenantSettings();
	const contact = getContact(activeSession);
	const isAnonymousChat =
		activeSession.item.postcode === 0 ||
		activeSession.item.postcode?.toString() === '00000' ||
		(activeSession.item as any).registrationType === 'ANONYMOUS' ||
		contact?.username?.startsWith('Anonymous-') ||
		activeSession.user?.username?.startsWith('Anonymous-');
	const chatType: 'anonymous' | 'oneOnOne' | 'group' | 'supervision' =
		isSupervisor
			? 'supervision'
			: activeSession.isGroup
				? 'group'
				: isAnonymousChat
					? 'anonymous'
					: 'oneOnOne';
	const isConsultantUser =
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) ||
		(userData?.userRoles || []).includes('CONSULTANT');
	const isAskerUser =
		hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) ||
		(userData?.userRoles || []).includes('USER');
	const isAnonymousAskerExperience =
		isAnonymousChat && isAskerUser && !isConsultantUser;
	const isAnonymousBreathingGameAvailable = isAnonymousAskerExperience;
	const sessionStatusNum = Number(activeSession.item?.status);
	const privacyAcceptanceRecorded = Boolean(
		userData?.dataPrivacyConfirmation &&
			String(userData.dataPrivacyConfirmation).trim() !== ''
	);
	const isAnonymousEnquiryPhaseSession =
		sessionStatusNum === STATUS_EMPTY ||
		sessionStatusNum === STATUS_ENQUIRY;
	const requiresAnonymousInquiryConsent =
		isAnonymousAskerExperience &&
		isAnonymousEnquiryPhaseSession &&
		!privacyAcceptanceRecorded;
	const anonymousInquiryConsentStorageKey = useMemo(
		() => `anonymous-inquiry-consent-${activeSession.item.id}`,
		[activeSession.item.id]
	);
	const robotSequenceStorageKey = useMemo(
		() => `anonymous-robot-sequence-${activeSession.item.id}`,
		[activeSession.item.id]
	);
	const pseudonymStorageKey = useMemo(
		() => `anonymous-pseudonym-${activeSession.item.id}`,
		[activeSession.item.id]
	);
	const requiresPseudonymConfirmation =
		isAnonymousAskerExperience && !pseudonymConfirmed;
	/**
	 * Once the user picks a pseudonym we stay in the "waiting queue" phase
	 * for the rest of this session — the pseudonym card stays visible, the
	 * privacy/encryption message joins it, and the composer is replaced by
	 * the WaitingQueueActionBar. The phase naturally ends when the session
	 * is no longer an anonymous-asker experience (component remounts for a
	 * different session), so it shows for the entire anonymous enquiry no
	 * matter what session status the backend reports.
	 */
	const isInAnonymousWaitingQueuePhase =
		isAnonymousAskerExperience &&
		pseudonymConfirmed &&
		!waitingGateDismissed;
	/**
	 * Show the "Live-Chat ist zurzeit leider geschlossen" modal while the
	 * anonymous asker is waiting and no consultant is currently available.
	 * Auto-opens when the live count is 0, auto-closes when it rises above 0,
	 * and stays closed if the asker dismissed it manually (until availability
	 * recovers, which resets the dismissal above).
	 */
	const liveChatClosedModalOpen =
		isInAnonymousWaitingQueuePhase &&
		!consultantAccepted &&
		numAvailableConsultants === 0 &&
		!liveChatClosedDismissed;
	const isJoinRoomAvailable = Boolean(activeSession.consultant?.id);
	const selectedPreset = useMemo(
		() =>
			BREATHING_PRESETS.find(
				(preset) => preset.id === selectedPresetId
			) || BREATHING_PRESETS[0],
		[selectedPresetId]
	);
	const phaseSecondsLeft = Math.max(0, Math.ceil(phaseMsLeft / 1000));
	const isBreathTimerRunning =
		waitingGameStage === 'practice' ||
		waitingGameStage === 'game' ||
		waitingGameStage === 'bellyPractice';
	const currentPhaseLabel =
		breathPhase === 'inhale'
			? translate('session.waitingMiniGame.phase.inhale', 'Inhale')
			: breathPhase === 'hold'
				? translate('session.waitingMiniGame.phase.hold', 'Hold')
				: translate('session.waitingMiniGame.phase.exhale', 'Exhale');
	const currentPhaseIcon =
		breathPhase === 'inhale'
			? INHALE_PHASE_ICON
			: breathPhase === 'hold'
				? HOLD_PHASE_ICON
				: EXHALE_PHASE_ICON;
	const briefingPhaseSteps = [
		{
			key: 'inhale',
			label: translate('session.waitingMiniGame.phase.inhale', 'Inhale'),
			icon: INHALE_PHASE_ICON
		},
		{
			key: 'hold',
			label: translate('session.waitingMiniGame.phase.hold', 'Hold'),
			icon: HOLD_PHASE_ICON
		},
		{
			key: 'exhale',
			label: translate('session.waitingMiniGame.phase.exhale', 'Exhale'),
			icon: EXHALE_PHASE_ICON
		}
	] as const;
	const circleScale = (0.78 + breathProgress * 0.32).toFixed(3);
	const circleCenterScale = (1 / Math.max(0.01, Number(circleScale))).toFixed(
		3
	);
	const localizedBriefingScreens = useMemo(
		() =>
			BRIEFING_SCREENS.map((screen, index) => ({
				...screen,
				text: translate(
					`session.waitingMiniGame.briefing.${index}`,
					screen.text
				)
			})),
		[translate]
	);
	const robotIncomingUsername = useMemo(() => {
		const resolvedCandidates = [
			contact?.displayName,
			contact?.username,
			userData?.displayName,
			userData?.userName,
			activeSession.user?.username,
			activeSession.item.askerRcId
		]
			.map((value) => decodeUsername((value || '').toString()).trim())
			.filter((value) => value.length > 0);
		const resolved =
			resolvedCandidates.find(
				(value) => !value.toLowerCase().startsWith('anonymous-')
			) || resolvedCandidates[0];
		if (!resolved || resolved.toLowerCase() === 'system') {
			return translate(
				'session.waitingMiniGame.robotUsernameFallback',
				'Ratsuchende_r 9'
			);
		}
		return resolved;
	}, [
		activeSession.item.askerRcId,
		activeSession.item.id,
		activeSession.user?.username,
		contact?.displayName,
		contact?.username,
		userData?.displayName,
		userData?.userName,
		translate
	]);
	const robotSystemCards = useMemo<
		Array<{
			_id: string;
			title: string;
			description: string;
			cta?: string;
			playLabel?: string;
		}>
	>(
		() => [
			{
				_id: 'robot-system-1',
				title: translate(
					'session.waitingMiniGame.robotCard1Title',
					'Bitte haben Sie etwas Geduld'
				),
				description: translate(
					'session.waitingMiniGame.robotCard1Body',
					'Derzeit sind alle Berater_innen im Gespräch. Wir sind schnellstmöglich für Sie da.'
				)
			},
			{
				_id: 'robot-system-2',
				title: `${translate(
					'session.waitingMiniGame.robotCard2TitlePrefix',
					'Ihr Benutzername lautet:'
				)} ${robotIncomingUsername}`,
				description: translate(
					'session.waitingMiniGame.robotCard2Body',
					'Um Ihre Anonymität zu schützen, löschen wir Ihre Nachrichten spätestens 48 Stunden nachdem der Chat beendet wurde.'
				)
			},
			{
				_id: 'robot-system-3',
				title: translate(
					'session.waitingMiniGame.robotCard3Title',
					'Sie benötigen nicht sofort eine Antwort? Und wollen nicht auf einen freien Chat warten?'
				),
				description: translate(
					'session.waitingMiniGame.robotCard3Body',
					'Registrieren Sie sich und hinterlassen Sie uns eine Nachricht. Wir melden uns innerhalb von 2 Werktagen bei Ihnen.'
				),
				cta: translate(
					'session.waitingMiniGame.robotCard3Cta',
					'Gehen Sie zur Registrierung'
				)
			},
			{
				_id: 'robot-system-4',
				title: translate(
					'session.waitingMiniGame.robotCard4Title',
					'Wollen Sie die Wartezeit sinnvoll nutzen?'
				),
				description: translate(
					'session.waitingMiniGame.robotCard4Body',
					'Dann spielen Sie in der Zwischenzeit unser kurzes Inhale-Exhale-Spiel.'
				),
				playLabel: translate(
					'session.waitingMiniGame.robotCard4Play',
					'Spiel starten'
				)
			}
		],
		[robotIncomingUsername, translate]
	);
	const currentBriefingScreen = showBriefingNegativeScreen
		? {
				...BRIEFING_NEGATIVE_SCREEN,
				text: translate(
					'session.waitingMiniGame.briefing.negative',
					BRIEFING_NEGATIVE_SCREEN.text
				)
			}
		: localizedBriefingScreens[briefingScreenIndex];
	const currentBriefingInteraction = showBriefingNegativeScreen
		? 'negative'
		: currentBriefingScreen.interaction;
	const isBriefingOnlyScreen = waitingGameStage === 'tutorial';
	const isInitialSetupScreen = waitingGameStage === 'setup';
	const isPreGameSetupScreen =
		isInitialSetupScreen || waitingGameStage === 'practiceResult';
	const isBreathingArenaVisible =
		waitingGameStage === 'practice' ||
		waitingGameStage === 'game' ||
		waitingGameStage === 'bellyPractice';
	const isTextOnlyStage =
		waitingGameStage === 'tutorial' ||
		waitingGameStage === 'completion' ||
		waitingGameStage === 'prize' ||
		waitingGameStage === 'serenity';
	const isNegativeBriefingScreen =
		waitingGameStage === 'tutorial' &&
		currentBriefingInteraction === 'negative';
	const shouldLockScroll =
		waitingGameStage === 'practice' || waitingGameStage === 'game';
	const shouldFadeSessionChrome =
		showWaitingMiniGame &&
		(waitingGameStage === 'practice' || waitingGameStage === 'game');
	const shouldShowConsentGate =
		requiresAnonymousInquiryConsent && !anonymousInquiryConsentAccepted;
	const shouldShowPseudonymGate =
		!shouldShowConsentGate &&
		(requiresPseudonymConfirmation || isInAnonymousWaitingQueuePhase);
	const shouldBlockAnonymousInquiryChat =
		shouldShowConsentGate || shouldShowPseudonymGate;
	/**
	 * The four system-notification "robot" cards
	 * ("Bitte haben Sie etwas Geduld", "Ihr Benutzername lautet…",
	 *  "Sie benötigen nicht sofort eine Antwort?", "Wollen Sie die Wartezeit…")
	 * were the pre-Carimat onboarding for anonymous askers. The new
	 * pseudonym + privacy + waiting-queue flow replaces them end-to-end, so
	 * once the asker has confirmed their pseudonym they should never see
	 * the old cards again — not before they start typing, not after the
	 * green "Jetzt Chat starten" closes the gate.
	 */
	const shouldShowRobotMessages =
		isAnonymousBreathingGameAvailable &&
		!shouldBlockAnonymousInquiryChat &&
		!(isAnonymousAskerExperience && pseudonymConfirmed);
	const anonymousInquiryConsentLabel = useMemo(
		() =>
			translate('videoConference.waitingroom.dataProtection.label.text', {
				interpolation: { escapeValue: false },
				legal_links: renderToString(
					<LegalLinks
						legalLinks={legalLinks}
						filter={(legalLink) => legalLink.registration}
					/>
				)
			}),
		[legalLinks, translate]
	);
	const areRobotMessagesComplete =
		!shouldShowRobotMessages ||
		robotSequenceVisibleCount >= robotSystemCards.length;
	const shouldShowRobotTypingIndicator =
		shouldShowRobotMessages && !areRobotMessagesComplete;
	const otherTypingUsers = useMemo(
		() =>
			(props.typingUsers || [])
				.map((entry) => `${entry || ''}`.trim())
				.filter(Boolean)
				.filter(
					(entry, index, source) => source.indexOf(entry) === index
				),
		[props.typingUsers]
	);
	const shouldShowInlineTypingIndicator = otherTypingUsers.length > 0;
	const typingIndicatorLabel = useMemo(() => {
		if (otherTypingUsers.length === 1) {
			return `${otherTypingUsers[0]} ${translate(
				'typingIndicator.singleUser.typing'
			)}`;
		}
		if (otherTypingUsers.length === 2) {
			return `${otherTypingUsers[0]} & ${otherTypingUsers[1]} ${translate(
				'typingIndicator.twoUsers.typing'
			)}`;
		}
		return `${otherTypingUsers.length} ${translate(
			'typingIndicator.multipleUsers.typing'
		)}`;
	}, [otherTypingUsers, translate]);
	const primaryTypingUser = otherTypingUsers[0] || '';
	const visibleRobotCards = useMemo(
		() => robotSystemCards.slice(0, Math.max(0, robotSequenceVisibleCount)),
		[robotSequenceVisibleCount, robotSystemCards]
	);

	const getAchievementMessage = useCallback(
		(level: number) => {
			const levelSafe = Math.max(
				1,
				Math.min(BREATH_LEVELS.length, level)
			);
			const meta = BREATH_LEVELS[levelSafe - 1];
			return translate('session.waitingMiniGame.achievementUnlocked', {
				defaultValue:
					'Achievement unlocked: Level {{level}} {{emoji}} {{title}}.',
				level: levelSafe,
				emoji: meta.emoji,
				title: meta.title
			});
		},
		[translate]
	);

	const clearBreathTimer = useCallback(() => {
		if (timerRef.current) {
			window.clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const clearTypewriterTimer = useCallback(() => {
		if (typewriterRef.current) {
			window.clearTimeout(typewriterRef.current);
			typewriterRef.current = null;
		}
	}, []);

	const clearBriefingTypewriterTimer = useCallback(() => {
		if (briefingTypewriterRef.current) {
			window.clearTimeout(briefingTypewriterRef.current);
			briefingTypewriterRef.current = null;
		}
	}, []);

	const clearGameStatusTypewriterTimer = useCallback(() => {
		if (gameStatusTypewriterRef.current) {
			window.clearTimeout(gameStatusTypewriterRef.current);
			gameStatusTypewriterRef.current = null;
		}
	}, []);

	const clearLevelBadgeTypewriterTimer = useCallback(() => {
		if (levelBadgeTypewriterRef.current) {
			window.clearTimeout(levelBadgeTypewriterRef.current);
			levelBadgeTypewriterRef.current = null;
		}
	}, []);

	const clearCenterStageTypewriterTimer = useCallback(() => {
		if (centerStageTypewriterRef.current) {
			window.clearTimeout(centerStageTypewriterRef.current);
			centerStageTypewriterRef.current = null;
		}
	}, []);

	const getPunctuationPauseMs = useCallback((typedChar: string) => {
		if (!typedChar) {
			return 0;
		}
		return /[.,]/.test(typedChar)
			? TYPEWRITER_TIMING.punctuationPauseMs
			: 0;
	}, []);

	const stopBreathSound = useCallback(() => {
		cuePianoSynthRef.current?.dispose();
		cuePianoSynthRef.current = null;
		cuePianoReverbRef.current?.dispose();
		cuePianoReverbRef.current = null;
		cueAirNoiseRef.current?.dispose();
		cueAirNoiseRef.current = null;
		cueAirFilterRef.current?.dispose();
		cueAirFilterRef.current = null;
		cueAirGainRef.current?.dispose();
		cueAirGainRef.current = null;
	}, []);

	const idleBreathSound = useCallback(() => {
		try {
			const now = Tone.now();
			cuePianoSynthRef.current?.releaseAll(now);
			if (cueAirGainRef.current) {
				cueAirGainRef.current.gain.cancelAndHoldAtTime(now);
				cueAirGainRef.current.gain.exponentialRampToValueAtTime(
					0.0001,
					now + 0.18
				);
			}
		} catch {
			// Ignore idle audio errors.
		}
	}, []);

	const playBreathCue = useCallback(
		(phase: BreathPhase, durationMs: number) => {
			if (typeof window === 'undefined') {
				return;
			}
			void (async () => {
				try {
					await Tone.start();
					const cueConfig: Record<
						BreathPhase,
						{
							notes: [string, string];
							velocity: number;
							airGain: number;
							airCutoff: number;
						}
					> = {
						// Requested pattern: piano-like paired notes + continuous soft air bed.
						inhale: {
							notes: ['F4', 'D4'],
							velocity: 0.53,
							airGain: 0.02,
							airCutoff: 1300
						},
						hold: {
							notes: ['C4', 'D4'],
							velocity: 0.49,
							airGain: 0.016,
							airCutoff: 980
						},
						exhale: {
							notes: ['D4', 'C4'],
							velocity: 0.56,
							airGain: 0.024,
							airCutoff: 760
						}
					};
					const now = Tone.now();
					const config = cueConfig[phase];
					const reverb =
						cuePianoReverbRef.current ||
						new Tone.Reverb({
							decay: 2.8,
							preDelay: 0.02,
							wet: 0.28
						}).toDestination();
					if (!cuePianoReverbRef.current) {
						await reverb.generate();
						cuePianoReverbRef.current = reverb;
					}
					const master =
						cueMasterGainRef.current ||
						new Tone.Gain(0.82).connect(reverb);
					cueMasterGainRef.current = master;
					const synth =
						cuePianoSynthRef.current ||
						new Tone.PolySynth(Tone.Synth, {
							oscillator: { type: 'triangle8' },
							envelope: {
								attack: 0.0015,
								decay: 0.18,
								sustain: 0.06,
								release: 1.05
							}
						}).connect(master);
					cuePianoSynthRef.current = synth;

					const phaseSeconds = Math.max(0.65, durationMs / 1000);
					const chordLen = Math.max(0.56, phaseSeconds * 0.92);

					synth.set({ volume: phase === 'hold' ? -14 : -11 });
					// Single phase-start key event (two-note voicing) with long reverb tail.
					synth.triggerAttackRelease(
						config.notes,
						chordLen,
						now,
						config.velocity
					);

					const airGain =
						cueAirGainRef.current ||
						new Tone.Gain(0.0001).connect(master);
					cueAirGainRef.current = airGain;
					const airFilter =
						cueAirFilterRef.current ||
						new Tone.Filter({
							type: 'lowpass',
							frequency: 1200,
							rolloff: -24,
							Q: 0.7
						}).connect(airGain);
					cueAirFilterRef.current = airFilter;
					const airNoise =
						cueAirNoiseRef.current ||
						new Tone.Noise('pink').connect(airFilter);
					if (!cueAirNoiseRef.current) {
						airNoise.start(now);
						cueAirNoiseRef.current = airNoise;
					}
					airGain.gain.cancelAndHoldAtTime(now);
					airFilter.frequency.cancelAndHoldAtTime(now);
					airGain.gain.exponentialRampToValueAtTime(
						Math.max(0.0003, config.airGain),
						now + 0.16
					);
					airFilter.frequency.exponentialRampToValueAtTime(
						Math.max(300, config.airCutoff),
						now + 0.24
					);
				} catch {
					// Ignore audio failures so the game works muted.
				}
			})();
		},
		[]
	);

	const startPhase = useCallback(
		(phase: BreathPhase, timingOverride?: BreathTiming) => {
			const timingSource =
				timingOverride ||
				(waitingGameStage === 'practice'
					? STANDARD_PRACTICE_TIMING
					: customTiming);
			phaseTransitionLockRef.current = false;
			const durationMs =
				(phase === 'inhale'
					? timingSource.inhale
					: phase === 'hold'
						? timingSource.hold
						: timingSource.exhale) * 1000;
			setBreathPhase(phase);
			setPhaseTotalMs(durationMs);
			setPhaseMsLeft(durationMs);
			setBreathProgress(phase === 'exhale' ? 1 : 0.2);
			playBreathCue(phase, durationMs);
		},
		[customTiming, playBreathCue, waitingGameStage]
	);

	const updateTiming = useCallback(
		(phase: keyof BreathTiming, delta: number) => {
			setCustomTiming((prev) => ({
				...prev,
				[phase]: Math.min(10, Math.max(2, prev[phase] + delta))
			}));
		},
		[]
	);

	const getTimingRowStyle = useCallback((seconds: number) => {
		const normalized = (Math.min(10, Math.max(2, seconds)) - 2) / 8;
		const fillPercent = 12 + normalized * 88;
		const driftDurationSeconds = Math.max(4.8, 10.8 - seconds * 0.62);
		const sheenDurationSeconds = Math.max(3.1, 8.4 - seconds * 0.44);
		return {
			'--water-fill': `${fillPercent.toFixed(1)}%`,
			'--water-drift-duration': `${driftDurationSeconds.toFixed(2)}s`,
			'--water-sheen-duration': `${sheenDurationSeconds.toFixed(2)}s`
		} as React.CSSProperties;
	}, []);

	const resetToTutorialState = useCallback(() => {
		clearBreathTimer();
		setBriefingScreenIndex(0);
		setShowBriefingNegativeScreen(false);
		setBreathPhase('inhale');
		setPhaseTotalMs(0);
		setPhaseMsLeft(0);
		setBreathProgress(0.2);
		setWaitingGameStage('tutorial');
		setStageMessage(
			translate(
				'session.waitingMiniGame.choosePace',
				'Choose your pace, then begin your first try.'
			)
		);
	}, [clearBreathTimer, translate]);

	const startPracticeRound = useCallback(() => {
		/* Do NOT clearBreathTimer() here. isBreathTimerRunning stays true
		   across practice → bellyPractice → game (and stays true when we
		   restart practice from itself), so the setup effect does not
		   re-run. Clearing the interval then would kill ticks permanently.
		   startPhase() simply resets phaseMsLeft for the new countdown. */
		phaseTransitionLockRef.current = false;
		setStageMessage(
			translate(
				'session.waitingMiniGame.tutorialCard.inhale.instruction',
				'Inhale slowly for 3 seconds, then press the button.'
			)
		);
		setWaitingGameStage('practice');
		startPhase('inhale', STANDARD_PRACTICE_TIMING);
	}, [startPhase, translate]);

	/**
	 * Restart the active practice round from the inhale phase — bound to
	 * the grey "redo" pill in the new practice-card bottom strip.
	 */
	const handlePracticeRestart = useCallback(() => {
		startPracticeRound();
	}, [startPracticeRound]);

	/**
	 * "Press at the right time" — user-driven phase advance. Directly
	 * starts the next phase instead of relying on the timer-expiry
	 * auto-advance effect (which only fires when phaseMsLeft changes and
	 * can't be retriggered once it's already at 0).
	 */
	const handlePracticeAdvance = useCallback(() => {
		phaseTransitionLockRef.current = false;
		if (breathPhase === 'inhale') {
			startPhase('hold');
			return;
		}
		if (breathPhase === 'hold') {
			startPhase('exhale');
			return;
		}
		/* Exhale → one full cycle complete. Mirror the end-of-round
		   handling the timer-driven effect used to do. We do NOT
		   clearBreathTimer() here — `isBreathTimerRunning` stays true
		   through practice → bellyPractice → game, so the tick interval
		   keeps running and `startPhase()` simply resets the countdown
		   for the next phase. Calling clear() here would kill the
		   interval without re-arming it, freezing the pulse. */
		setBreathCycles((prev) => {
			const next = prev + 1;
			setJoinPromptEscalated((current) => current || next >= 2);
			return next;
		});
		if (waitingGameStage === 'practice') {
			/*
			 * Practice round complete — advance into the belly-breathing
			 * tutorial (three more Carimat cards) instead of the old
			 * practice-result setup screen. Start the inhale animation
			 * so the pulse demo plays while the asker reads the first
			 * belly card.
			 */
			setBellyCardIndex(0);
			setWaitingGameStage('bellyPractice');
			startPhase('inhale');
			return;
		}
		/* Game stage: one full inhale→hold→exhale cycle = one level.
		   Advance to next level, or hop to the completion stage on the
		   last level. */
		if (currentLevel >= BREATH_LEVELS.length) {
			setWaitingGameStage('completion');
			return;
		}
		const nextLevel = currentLevel + 1;
		setCurrentLevel(nextLevel);
		setStageMessage(BREATH_LEVELS[nextLevel - 1].success);
		startPhase('inhale');
	}, [breathPhase, currentLevel, startPhase, translate, waitingGameStage]);

	/**
	 * Keep the Carimat bubble text in sync with the current breath phase
	 * while the user is in the practice or game stage. Uses the pasted
	 * Figma copy keyed per phase.
	 */
	useEffect(() => {
		if (waitingGameStage !== 'practice' && waitingGameStage !== 'game') {
			return;
		}
		const secondsByPhase =
			waitingGameStage === 'practice'
				? STANDARD_PRACTICE_TIMING
				: customTiming;
		const seconds =
			breathPhase === 'inhale'
				? secondsByPhase.inhale
				: breathPhase === 'hold'
					? secondsByPhase.hold
					: secondsByPhase.exhale;

		if (breathPhase === 'inhale') {
			setStageMessage(
				translate(
					'session.waitingMiniGame.tutorialCard.inhale.instruction',
					'Inhale slowly for <strong>{{count}} seconds</strong>, then press the button.',
					{
						count: seconds,
						interpolation: { escapeValue: false }
					}
				)
			);
		} else if (breathPhase === 'hold') {
			setStageMessage(
				translate(
					'session.waitingMiniGame.tutorialCard.hold.instruction',
					'Hold your breath now for <strong>{{count}} seconds</strong>, then press the button.',
					{
						count: seconds,
						interpolation: { escapeValue: false }
					}
				)
			);
		} else {
			setStageMessage(
				translate(
					'session.waitingMiniGame.tutorialCard.exhale.instruction',
					'Exhale slowly for <strong>{{count}} seconds</strong>, then press the button.',
					{
						count: seconds,
						interpolation: { escapeValue: false }
					}
				)
			);
		}
	}, [breathPhase, waitingGameStage, customTiming, translate]);

	/**
	 * Belly-breathing stage — pick the bubble text from the current card
	 * index and let dangerouslySetInnerHTML render the inline <strong> so
	 * only the seconds count is bold.
	 */
	useEffect(() => {
		if (waitingGameStage !== 'bellyPractice') return;
		const keys = [
			'session.waitingMiniGame.tutorialCard.belly.inhale',
			'session.waitingMiniGame.tutorialCard.belly.hold',
			'session.waitingMiniGame.tutorialCard.belly.exhale'
		];
		const fallbacks = [
			'Great lets inhale <strong>3 seconds</strong> again, but this time by expanding your belly.',
			'Now hold for <strong>3 seconds</strong> your breath.',
			'Now breath out for <strong>4 seconds</strong> and relax your entire body.'
		];
		setStageMessage(
			translate(keys[bellyCardIndex], fallbacks[bellyCardIndex], {
				interpolation: { escapeValue: false }
			})
		);
	}, [bellyCardIndex, waitingGameStage, translate]);

	/**
	 * Typewriter reveal for the Carimat bubble. Whenever the stage
	 * message changes, reset the visible-length counter to 0 and tick
	 * forward one character at a time until the full message is shown.
	 * We reveal the plain-text length; inline <strong> tags kick in once
	 * typing completes and the HTML version swaps in.
	 */
	const bubblePlainText = useMemo(
		() => stageMessage.replace(/<[^>]*>/g, ''),
		[stageMessage]
	);
	/* Terminal-style typewriter: random 70-170ms per character and a "_"
	   cursor that toggles on odd indices (empty on even), matching the
	   classic Typewriter.js feel asked for in design. setTimeout chain
	   instead of a fixed setInterval so each tick gets its own jitter. */
	useEffect(() => {
		setBubbleTypedLen(0);
		if (!bubblePlainText.length) return;
		let cancelled = false;
		let timeoutId: number | null = null;
		let index = 0;
		const scheduleNext = () => {
			if (cancelled) return;
			timeoutId = window.setTimeout(
				() => {
					if (cancelled) return;
					index += 1;
					setBubbleTypedLen(index);
					if (index < bubblePlainText.length) {
						scheduleNext();
					}
				},
				45 + 55 * Math.random()
			);
		};
		scheduleNext();
		return () => {
			cancelled = true;
			if (timeoutId != null) window.clearTimeout(timeoutId);
		};
	}, [bubblePlainText]);
	const isBubbleTyping = bubbleTypedLen < bubblePlainText.length;
	const bubbleCursorChar = bubbleTypedLen & 1 ? '_' : ' ';

	/**
	 * Self-timer stage — user paces their own intervals after the belly
	 * cards. We surface the prompt in the Carimat bubble; the pulse
	 * continues ticking from the last phase so the visual stays alive.
	 */
	useEffect(() => {
		if (waitingGameStage !== 'selfTimer') return;
		setStageMessage(
			translate(
				'session.waitingMiniGame.tutorialCard.selfTimer.instruction',
				'Set this time your own time intervals while breathing.'
			)
		);
	}, [waitingGameStage, translate]);

	/**
	 * Completion + serenity — message in the Carimat bubble. Completion
	 * celebrates finishing the game; serenity surfaces the prayer "gift".
	 */
	useEffect(() => {
		if (waitingGameStage === 'completion') {
			setStageMessage(
				translate(
					'session.waitingMiniGame.tutorialCard.completion.instruction',
					'Congratulation you have made it.'
				)
			);
		} else if (waitingGameStage === 'serenity') {
			setStageMessage(
				translate(
					'session.waitingMiniGame.tutorialCard.serenity.instruction',
					"The gift is a little mantra that's helped tons of people get through tough times. It's called the serenity prayer: \u201CGod, grant me the serenity to accept the things I cannot change, the courage to change the things I can, and the wisdom to know the difference.\u201D"
				)
			);
		}
	}, [waitingGameStage, translate]);

	/**
	 * Advance through the three belly-breathing cards.
	 *
	 * Two drivers feed this: the user's explicit "Time it" click and the
	 * auto-pilot timer. They diverge only on the final card:
	 *   - Manual Time-it: finishes the demo and closes the popup.
	 *   - Auto-pilot: loops back to card 0 so the user can keep watching
	 *     the full inhale→hold→exhale cycle until they interrupt.
	 */
	const advanceBellyCard = useCallback(
		(source: 'manual' | 'auto' = 'manual') => {
			if (bellyCardIndex === 0) {
				setBellyCardIndex(1);
				startPhase('hold');
				return;
			}
			if (bellyCardIndex === 1) {
				setBellyCardIndex(2);
				startPhase('exhale');
				return;
			}
			if (source === 'auto') {
				/* Auto-pilot loops: card 2 exhale → card 0 inhale, keep cycling. */
				setBellyCardIndex(0);
				startPhase('inhale');
				return;
			}
			/* Manual Time-it on the last card — hand off to the self-timed
			   breathing screen where the user paces their own intervals. */
			clearBreathTimer();
			setBellyCardIndex(0);
			setWaitingGameStage('selfTimer');
		},
		[bellyCardIndex, clearBreathTimer, startPhase]
	);

	/**
	 * Mode button clicked.
	 *   - Clicking the inactive mode switches modes (no advance).
	 *   - Clicking the active "Time it" advances the phase/card.
	 *   - Clicking the active "Auto pilot" is a no-op (the pilot is
	 *     already driving the cycle).
	 */
	const handleBellyModeButton = useCallback(
		(mode: 'autoPilot' | 'timeIt') => {
			if (mode !== bellyMode) {
				setBellyMode(mode);
				return;
			}
			if (mode === 'timeIt') {
				advanceBellyCard('manual');
			}
		},
		[advanceBellyCard, bellyMode]
	);

	/**
	 * Game-stage mode toggle. Same contract as the belly one:
	 * inactive click = switch mode (no advance), active "Time it" click =
	 * advance the current phase, active "Auto pilot" click = no-op.
	 */
	const handleGameModeButton = useCallback(
		(mode: 'autoPilot' | 'timeIt') => {
			if (mode !== gameMode) {
				setGameMode(mode);
				return;
			}
			if (mode === 'timeIt') {
				handlePracticeAdvance();
			}
		},
		[gameMode, handlePracticeAdvance]
	);

	/**
	 * Auto-pilot advance for the game stage — when gameMode is autoPilot
	 * and the current phase's countdown hits 0, step to the next phase
	 * automatically. Mirrors the belly auto-pilot effect.
	 */
	useEffect(() => {
		if (
			waitingGameStage !== 'game' ||
			gameMode !== 'autoPilot' ||
			phaseMsLeft > 0 ||
			phaseTotalMs <= 0
		) {
			return;
		}
		handlePracticeAdvance();
	}, [
		gameMode,
		handlePracticeAdvance,
		phaseMsLeft,
		phaseTotalMs,
		waitingGameStage
	]);

	/**
	 * Auto-pilot advance: when in bellyPractice + autoPilot and a phase's
	 * timer hits 0, step forward to the next card/phase automatically.
	 * Fires one tick per phase-expiry because phaseMsLeft bounces back up
	 * when startPhase runs, resetting the effect's listener.
	 */
	useEffect(() => {
		if (
			waitingGameStage !== 'bellyPractice' ||
			bellyMode !== 'autoPilot' ||
			phaseMsLeft > 0 ||
			phaseTotalMs <= 0
		) {
			return;
		}
		advanceBellyCard('auto');
	}, [
		advanceBellyCard,
		bellyMode,
		phaseMsLeft,
		phaseTotalMs,
		waitingGameStage
	]);

	const startAchieverGame = useCallback(() => {
		/* Don't clearBreathTimer here — when we come from completion /
		   selfTimer (isBreathTimerRunning was false), the setup effect
		   re-mounts automatically on the stage change and starts a fresh
		   interval. When we come from game itself (restart), the existing
		   interval keeps ticking and startPhase just resets phaseMsLeft. */
		phaseTransitionLockRef.current = false;
		setCurrentLevel(1);
		setBreathCycles(0);
		setJoinPromptEscalated(false);
		setStageMessage(BREATH_LEVELS[0].success);
		setWaitingGameStage('game');
		setGameMode('autoPilot');
		startPhase('inhale');
	}, [startPhase]);

	const isThreadsEnabled =
		featureThreadsEnabled !== false &&
		(chatType === 'group'
			? featureThreadsGroupChatsEnabled !== false
			: chatType === 'anonymous'
				? featureThreadsAnonymousChatsEnabled !== false
				: chatType === 'supervision'
					? featureThreadsSupervisionChatsEnabled !== false
					: featureThreadsOneOnOneEnabled !== false);
	const isSupervisionEnabledForCurrentChat =
		featureSupervisionEnabled !== false &&
		(isAnonymousChat
			? featureSupervisionAnonymousChatsEnabled !== false
			: featureSupervisionOneOnOneChatsEnabled !== false);

	const messages = useMemo(() => props.messages, [props && props.messages]); // eslint-disable-line react-hooks/exhaustive-deps
	const [initialScrollCompleted, setInitialScrollCompleted] = useState(false);
	const scrollContainerRef = React.useRef<HTMLDivElement>(null);
	const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
	const [draggedFile, setDraggedFile] = useState<File | null>(null);
	const [isDragOverDropArea, setDragOverDropArea] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const dragCancelRef = useRef<NodeJS.Timeout | null>(null);
	const [newMessages, setNewMessages] = useState(0);
	const [canWriteMessage, setCanWriteMessage] = useState(false);
	const [composerRemountKey, setComposerRemountKey] = useState(0);
	const [supervisionReason, setSupervisionReason] = useState<string | null>(
		null
	);
	const [activeThreadRootId, setActiveThreadRootId] = useState<string | null>(
		null
	);
	const [activeThreadRootMessage, setActiveThreadRootMessage] =
		useState<MessageItem | null>(null);
	const knownMessageIdsRef = useRef<Set<string>>(new Set());
	const threadSummaries = useMemo(() => {
		const map = new Map<
			string,
			{ replyCount: number; lastReplyText: string }
		>();
		if (!messages) {
			return map;
		}
		messages.forEach((message) => {
			const parsed = parseMessagePrefixes(message.message);
			if (parsed.isThreadMessage && parsed.threadRootId) {
				const existing = map.get(parsed.threadRootId) || {
					replyCount: 0,
					lastReplyText: ''
				};
				existing.replyCount += 1;
				existing.lastReplyText =
					'Last reply at ' + formatToHHMM(message.messageTime);
				map.set(parsed.threadRootId, existing);
			}
		});
		return map;
	}, [messages]);
	const [headerRef, headerBounds] = useMeasure({ polyfill: ResizeObserver });
	const { ready, key, keyID, encrypted, subscriptionKeyLost } = useE2EE(
		activeSession.rid
	);

	// MATRIX MIGRATION: Create Matrix-aware isMyMessage function
	const isMyMessageMatrix = useCallback(
		(messageUserId: string) => {
			const normalizeMatrixId = (value?: string | null) => {
				const raw = `${value || ''}`.trim().toLowerCase();
				if (!raw) {
					return { full: '', atUser: '', user: '' };
				}
				const withAt = raw.startsWith('@') ? raw : `@${raw}`;
				const withoutAt = withAt.substring(1);
				const usernameOnly = withoutAt.split(':')[0];
				return {
					full: withAt,
					atUser: `@${usernameOnly}`,
					user: usernameOnly
				};
			};

			const isMatrixSession = Boolean(
				activeSession.rid?.startsWith('!') ||
					activeSession.item?.matrixRoomId ||
					messageUserId?.includes('@')
			);

			if (isMatrixSession) {
				const matrixClientUserId = (window as any).matrixClientService
					?.getClient?.()
					?.getUserId?.();
				const myMatrixUserId =
					matrixClientUserId ||
					localStorage.getItem('matrix_user_id') ||
					(typeof document !== 'undefined' &&
						document.cookie
							.split('; ')
							.find((row) => row.startsWith('rc_uid='))
							?.split('=')[1]) ||
					userData?.userName;

				const mine = normalizeMatrixId(myMatrixUserId);
				const sender = normalizeMatrixId(messageUserId);

				return Boolean(
					mine.full &&
						(sender.full === mine.full ||
							sender.full === mine.atUser ||
							sender.atUser === mine.atUser ||
							sender.user === mine.user)
				);
			}
			// For RocketChat sessions, use the standard check
			return isMyMessage(messageUserId);
		},
		[
			activeSession.rid,
			activeSession.item?.matrixRoomId,
			userData?.userName
		]
	);

	// Check if current user is a supervisor
	useEffect(() => {
		if (!isSupervisionEnabledForCurrentChat) {
			setIsSupervisor(false);
			setSupervisionReason(null);
			return;
		}
		if (
			hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
			activeSession.item.id
		) {
			apiGetSessionSupervisors(activeSession.item.id)
				.then((supervisors) => {
					const isCurrentUserSupervisor = supervisors.some(
						(s) => s.supervisorConsultantId === userData.userId
					);
					setIsSupervisor(isCurrentUserSupervisor);
					const currentSupervisor = supervisors.find(
						(s) => s.supervisorConsultantId === userData.userId
					);
					setSupervisionReason(currentSupervisor?.notes || null);
				})
				.catch((error) => {
					// console.error('Failed to check supervisor status:', error);
					setIsSupervisor(false);
					setSupervisionReason(null);
				});
		} else {
			setIsSupervisor(false);
			setSupervisionReason(null);
		}
	}, [activeSession.item.id, userData, isSupervisionEnabledForCurrentChat]);

	useEffect(() => {
		const canWrite =
			type !== SESSION_LIST_TYPES.ENQUIRY ||
			(isAnonymousAskerExperience && waitingGateDismissed);
		setCanWriteMessage(canWrite);
	}, [
		type,
		isAnonymousAskerExperience,
		waitingGateDismissed,
		userData,
		activeSession,
		activeSession.isGroup,
		isSupervisor
	]);

	useEffect(() => {
		if (!isAnonymousBreathingGameAvailable) {
			setShowWaitingMiniGame(false);
			clearBreathTimer();
		}
	}, [clearBreathTimer, isAnonymousBreathingGameAvailable]);

	useEffect(() => {
		if (!requiresAnonymousInquiryConsent) {
			setAnonymousInquiryConsentAccepted(true);
			try {
				if (privacyAcceptanceRecorded) {
					sessionStorage.setItem(
						anonymousInquiryConsentStorageKey,
						'1'
					);
				}
			} catch {
				/* ignore */
			}
			return;
		}
		try {
			setAnonymousInquiryConsentAccepted(
				sessionStorage.getItem(anonymousInquiryConsentStorageKey) ===
					'1'
			);
		} catch {
			setAnonymousInquiryConsentAccepted(false);
		}
	}, [
		anonymousInquiryConsentStorageKey,
		requiresAnonymousInquiryConsent,
		privacyAcceptanceRecorded
	]);

	useEffect(() => {
		setShowWaitingMiniGame(false);
	}, [activeSession.item.id]);

	const handleAnonymousInquiryConsentAccept = useCallback(() => {
		apiPatchUserData({
			dataPrivacyConfirmation: true,
			termsAndConditionsConfirmation: true
		})
			.then(() => {
				setAnonymousInquiryConsentAccepted(true);
				try {
					sessionStorage.setItem(
						anonymousInquiryConsentStorageKey,
						'1'
					);
				} catch {
					// Ignore storage errors and still unblock current session view.
				}
				return apiGetUserData().then((fresh) => setUserData(fresh));
			})
			.catch(() => {
				/* keep gate visible on failure */
			});
	}, [anonymousInquiryConsentStorageKey, setUserData]);

	/**
	 * Load the cached pseudonym-confirmed flag when entering the session.
	 * If the user is not an anonymous asker, treat the gate as already passed
	 * so the regular waiting room renders for everyone else unchanged.
	 */
	useEffect(() => {
		if (!isAnonymousAskerExperience) {
			setPseudonymConfirmed(true);
			return;
		}
		try {
			setPseudonymConfirmed(
				sessionStorage.getItem(pseudonymStorageKey) === '1'
			);
		} catch {
			setPseudonymConfirmed(false);
		}
	}, [isAnonymousAskerExperience, pseudonymStorageKey]);

	/**
	 * Confirm the chosen pseudonym. Updates ONLY the display name
	 * via apiPatchUserData — the Matrix username stays "Anonymous-<ts>"
	 * so the room membership and key chain stay intact.
	 */
	const handleConfirmPseudonym = useCallback(() => {
		if (pseudonymSaving) return;
		setPseudonymSaving(true);
		apiPatchUserData({ displayName: currentPseudonym.displayName })
			.then(() => apiGetUserData().then((fresh) => setUserData(fresh)))
			.then(() => {
				setPseudonymConfirmed(true);
				try {
					sessionStorage.setItem(pseudonymStorageKey, '1');
				} catch {
					/* ignore storage errors */
				}
			})
			.catch(() => {
				/* keep card visible on failure so user can retry */
			})
			.finally(() => setPseudonymSaving(false));
	}, [currentPseudonym, pseudonymSaving, pseudonymStorageKey, setUserData]);

	/**
	 * Poll the live anonymous-enquiry details while the asker is in the
	 * waiting-queue phase. Feeds `queuePeopleAhead` into WaitingQueueActionBar
	 * so "N Personen vor Ihnen" reflects the actual number of anonymous
	 * enquiries queued ahead for the same consulting type.
	 */
	useEffect(() => {
		if (!isInAnonymousWaitingQueuePhase || !activeSession.item?.id) {
			return;
		}

		let cancelled = false;
		const sessionId = activeSession.item.id;

		const refresh = () => {
			apiGetAnonymousEnquiryDetails(sessionId)
				.then((details) => {
					if (cancelled) return;
					if (typeof details?.peopleAhead === 'number') {
						setQueuePeopleAhead(details.peopleAhead);
					}
					setNumAvailableConsultants(
						typeof details?.numAvailableConsultants === 'number'
							? details.numAvailableConsultants
							: null
					);
					/* Anything other than INITIAL/NEW means a consultant has
					   started handling this enquiry — flip the action bar to
					   the "Start chat now" prompt. */
					if (
						details?.status &&
						details.status !== 'INITIAL' &&
						details.status !== 'NEW'
					) {
						setConsultantAccepted(true);
					}
				})
				.catch(() => {
					/* swallow — UI falls back to "Wird verbunden …" */
				});
		};

		refresh();
		/* Poll every 4s so acceptance feels real-time without reload. */
		const poll = window.setInterval(refresh, 4000);

		return () => {
			cancelled = true;
			window.clearInterval(poll);
		};
	}, [isInAnonymousWaitingQueuePhase, activeSession.item?.id]);

	/**
	 * As soon as at least one consultant is available again, clear any manual
	 * dismissal so the no-availability modal can auto-reopen if the count
	 * later drops back to 0.
	 */
	useEffect(() => {
		if (
			typeof numAvailableConsultants === 'number' &&
			numAvailableConsultants > 0
		) {
			setLiveChatClosedDismissed(false);
		}
	}, [numAvailableConsultants]);

	/* Once the backend session status moves past enquiry phase we also treat
	   that as "consultant accepted" — belt-and-braces signal in case the
	   anonymous-enquiry poll hasn't fired yet. */
	useEffect(() => {
		if (
			isAnonymousAskerExperience &&
			pseudonymConfirmed &&
			!isAnonymousEnquiryPhaseSession
		) {
			setConsultantAccepted(true);
		}
	}, [
		isAnonymousAskerExperience,
		pseudonymConfirmed,
		isAnonymousEnquiryPhaseSession
	]);

	const preloadMessageComposer = useCallback(() => {
		void import(
			'../messageSubmitInterface/messageSubmitInterfaceComponent'
		);
	}, []);

	useEffect(() => {
		if (
			shouldShowPseudonymGate &&
			pseudonymConfirmed &&
			consultantAccepted
		) {
			preloadMessageComposer();
		}
	}, [
		consultantAccepted,
		preloadMessageComposer,
		pseudonymConfirmed,
		shouldShowPseudonymGate
	]);

	const handleOpenCalmCompanion = useCallback(() => {
		setShowBriefingNegativeScreen(false);
		setBriefingScreenIndex(0);
		setWaitingGameStage('tutorial');
		setShowWaitingMiniGame(true);
	}, []);

	const handleDismissConsultantAccepted = useCallback(() => {
		setConsultantAccepted(false);
	}, []);

	const handleStartAcceptedChat = useCallback(() => {
		void import('../messageSubmitInterface/messageSubmitInterfaceComponent')
			.then(() => setWaitingGateDismissed(true))
			.catch(() => setWaitingGateDismissed(true));
	}, []);

	useEffect(() => {
		if (!shouldShowRobotMessages) {
			setRobotSequenceVisibleCount(robotSystemCards.length);
			return;
		}
		try {
			const stored = sessionStorage.getItem(robotSequenceStorageKey);
			const parsed = stored ? Number(stored) : 1;
			setRobotSequenceVisibleCount(
				Number.isFinite(parsed)
					? Math.max(0, Math.min(robotSystemCards.length, parsed))
					: 1
			);
		} catch {
			setRobotSequenceVisibleCount(1);
		}
	}, [
		robotSequenceStorageKey,
		robotSystemCards.length,
		shouldShowRobotMessages
	]);

	useEffect(() => {
		if (!shouldShowRobotMessages) {
			return;
		}
		try {
			sessionStorage.setItem(
				robotSequenceStorageKey,
				String(
					Math.max(
						0,
						Math.min(
							robotSystemCards.length,
							robotSequenceVisibleCount
						)
					)
				)
			);
		} catch {
			// Ignore storage errors.
		}
	}, [
		robotSequenceStorageKey,
		robotSequenceVisibleCount,
		robotSystemCards.length,
		shouldShowRobotMessages
	]);

	useEffect(() => {
		if (
			!shouldShowRobotMessages ||
			robotSequenceVisibleCount >= robotSystemCards.length
		) {
			return;
		}
		const timer = window.setTimeout(() => {
			setRobotSequenceVisibleCount((prev) =>
				Math.min(robotSystemCards.length, prev + 1)
			);
		}, ROBOT_MESSAGE_REVEAL_GAP_MS);
		return () => window.clearTimeout(timer);
	}, [
		robotSequenceVisibleCount,
		robotSystemCards.length,
		shouldShowRobotMessages
	]);

	useEffect(() => {
		if (!showWaitingMiniGame) {
			clearBreathTimer();
			stopBreathSound();
			return;
		}
		if (!isBreathTimerRunning) {
			clearBreathTimer();
			idleBreathSound();
			return;
		}
		timerRef.current = window.setInterval(() => {
			setPhaseMsLeft((prev) => Math.max(0, prev - 16));
		}, 16);
		return () => clearBreathTimer();
	}, [
		clearBreathTimer,
		idleBreathSound,
		isBreathTimerRunning,
		showWaitingMiniGame,
		stopBreathSound
	]);

	useEffect(() => {
		setCustomTiming({
			inhale: selectedPreset.inhale,
			hold: selectedPreset.hold,
			exhale: selectedPreset.exhale
		});
	}, [selectedPreset]);

	useEffect(() => {
		if (!isBreathTimerRunning || phaseTotalMs <= 0) {
			return;
		}
		if (phaseMsLeft > 0) {
			phaseTransitionLockRef.current = false;
		}
		const ratio = Math.max(0, Math.min(1, phaseMsLeft / phaseTotalMs));
		if (breathPhase === 'inhale') {
			setBreathProgress(0.2 + (1 - ratio) * 0.8);
		} else if (breathPhase === 'hold') {
			setBreathProgress(1);
		} else {
			setBreathProgress(0.2 + ratio * 0.8);
		}
		if (phaseMsLeft > 0) {
			return;
		}
		/*
		 * Practice, game, and belly-practice stages are user-driven: once
		 * the countdown reaches 0 the card sits on the current phase until
		 * the user clicks the advance button (red "Press at the right time"
		 * for practice/game, "Auto pilot"/"Time it" for belly). We never
		 * auto-advance here for those stages.
		 */
		if (
			waitingGameStage === 'practice' ||
			waitingGameStage === 'game' ||
			waitingGameStage === 'bellyPractice'
		) {
			return;
		}
		if (phaseTransitionLockRef.current) {
			return;
		}
		phaseTransitionLockRef.current = true;
		if (breathPhase === 'inhale') {
			startPhase('hold');
			return;
		}
		if (breathPhase === 'hold') {
			startPhase('exhale');
			return;
		}

		setBreathCycles((prev) => {
			const next = prev + 1;
			setJoinPromptEscalated((current) => current || next >= 2);
			return next;
		});
		if (waitingGameStage === 'practice') {
			clearBreathTimer();
			setStageMessage(
				translate(
					'session.waitingMiniGame.practiceSuccessPrompt',
					'Great job, want to start now?'
				)
			);
			setWaitingGameStage('practiceResult');
			return;
		}

		if (currentLevel >= BREATH_LEVELS.length) {
			clearBreathTimer();
			setWaitingGameStage('completion');
			setStageMessage(
				`Congratulations, you made it. ${getAchievementMessage(BREATH_LEVELS.length)}`
			);
			return;
		}

		const nextLevel = currentLevel + 1;
		setCurrentLevel(nextLevel);
		setStageMessage(BREATH_LEVELS[nextLevel - 1].success);
		window.setTimeout(() => startPhase('inhale'), 0);
	}, [
		breathPhase,
		clearBreathTimer,
		currentLevel,
		getAchievementMessage,
		isBreathTimerRunning,
		phaseMsLeft,
		phaseTotalMs,
		startPhase,
		waitingGameStage
	]);

	useEffect(() => {
		clearTypewriterTimer();
		if (!showWaitingMiniGame || waitingGameStage !== 'onboarding') {
			setTypewriterBusy(false);
			return;
		}
		const lines = [
			translate(
				'session.waitingMiniGame.onboardingLine1',
				'Just arrive. We breathe together.'
			),
			translate(
				'session.waitingMiniGame.onboardingLine3',
				'When you are ready, start your first try.'
			)
		];

		let lineIndex = 0;
		let charIndex = 0;
		let deleting = false;
		setTypedText('');
		setTypewriterBusy(true);

		const tick = () => {
			const line = lines[lineIndex];
			if (!deleting) {
				charIndex += 1;
				setTypedText(line.slice(0, charIndex));
				if (charIndex >= line.length) {
					deleting = true;
					typewriterRef.current = window.setTimeout(
						tick,
						TYPEWRITER_TIMING.fullLineGapMs
					);
					return;
				}
				typewriterRef.current = window.setTimeout(
					tick,
					45 + 55 * Math.random()
				);
				return;
			}

			charIndex -= 1;
			setTypedText(line.slice(0, Math.max(0, charIndex)));
			if (charIndex <= 0) {
				deleting = false;
				lineIndex += 1;
				if (lineIndex >= lines.length) {
					setTypewriterBusy(false);
					resetToTutorialState();
					return;
				}
				typewriterRef.current = window.setTimeout(
					tick,
					TYPEWRITER_TIMING.doneGapMs
				);
				return;
			}
			typewriterRef.current = window.setTimeout(
				tick,
				18 + 20 * Math.random()
			);
		};

		typewriterRef.current = window.setTimeout(
			tick,
			TYPEWRITER_TIMING.onboardingStartMs
		);
		return () => clearTypewriterTimer();
	}, [
		clearTypewriterTimer,
		getPunctuationPauseMs,
		resetToTutorialState,
		showWaitingMiniGame,
		translate,
		waitingGameStage
	]);

	useEffect(() => {
		clearBriefingTypewriterTimer();
		if (!showWaitingMiniGame || waitingGameStage !== 'tutorial') {
			setBriefingTypewriterBusy(false);
			setBriefingTypedText('');
			return;
		}
		const fullText = currentBriefingScreen.text;
		let index = 0;
		/* Terminal-style jitter: 70 + random(0,100) ms per char. Matches
		   the Typewriter.js feel used across the game bubbles. Initial
		   delay kept so the screen settles before typing starts. */
		const initialDelay =
			briefingScreenIndex <= 1
				? TYPEWRITER_TIMING.initialDelaySlowMs
				: TYPEWRITER_TIMING.initialDelayMs;
		setBriefingTypewriterBusy(true);
		setBriefingTypedText('');

		const tick = () => {
			index += 1;
			setBriefingTypedText(fullText.slice(0, index));
			if (index >= fullText.length) {
				setBriefingTypewriterBusy(false);
				return;
			}
			briefingTypewriterRef.current = window.setTimeout(
				tick,
				45 + 55 * Math.random()
			);
		};

		briefingTypewriterRef.current = window.setTimeout(tick, initialDelay);
		return () => clearBriefingTypewriterTimer();
	}, [
		clearBriefingTypewriterTimer,
		currentBriefingScreen.text,
		briefingScreenIndex,
		getPunctuationPauseMs,
		showWaitingMiniGame,
		waitingGameStage
	]);

	useEffect(() => {
		if (
			!showWaitingMiniGame ||
			waitingGameStage !== 'tutorial' ||
			showBriefingNegativeScreen ||
			currentBriefingInteraction !== 'auto' ||
			briefingTypewriterBusy ||
			/* The positive-path third briefing screen is now replaced by the
			   user-driven vertical BreathingTutorialCard sequence, so the
			   2.2s auto-advance (which used to jump straight into the
			   practice round) must NOT fire — the user clicks through the
			   Inhale → Hold → Exhale cards manually via the green button. */
			(briefingScreenIndex === 2 && !showBriefingNegativeScreen)
		) {
			return;
		}
		const timeout = window.setTimeout(
			() => {
				if (
					briefingScreenIndex >=
					localizedBriefingScreens.length - 1
				) {
					setSelectedPresetId('standard446');
					setCustomTiming({
						inhale: 4,
						hold: 4,
						exhale: 6
					});
					startPracticeRound();
					return;
				}
				setBriefingScreenIndex((index) => index + 1);
			},
			'autoAdvanceMs' in localizedBriefingScreens[briefingScreenIndex]
				? localizedBriefingScreens[briefingScreenIndex].autoAdvanceMs +
						180
				: 1600
		);
		return () => window.clearTimeout(timeout);
	}, [
		briefingTypewriterBusy,
		briefingScreenIndex,
		currentBriefingInteraction,
		localizedBriefingScreens,
		showWaitingMiniGame,
		showBriefingNegativeScreen,
		startPracticeRound,
		waitingGameStage
	]);

	useEffect(() => {
		clearGameStatusTypewriterTimer();
		if (
			!showWaitingMiniGame ||
			waitingGameStage !== 'game' ||
			!stageMessage
		) {
			setGameStatusTypewriterBusy(false);
			setGameStatusTypedText('');
			return;
		}
		let index = 0;
		setGameStatusTypewriterBusy(true);
		setGameStatusTypedText('');
		const tick = () => {
			index += 1;
			setGameStatusTypedText(stageMessage.slice(0, index));
			const typedChar = stageMessage.charAt(index - 1);
			if (index >= stageMessage.length) {
				setGameStatusTypewriterBusy(false);
				return;
			}
			gameStatusTypewriterRef.current = window.setTimeout(
				tick,
				TYPEWRITER_TIMING.charForwardMs +
					getPunctuationPauseMs(typedChar)
			);
		};
		gameStatusTypewriterRef.current = window.setTimeout(
			tick,
			TYPEWRITER_TIMING.initialDelayMs
		);
		return () => clearGameStatusTypewriterTimer();
	}, [
		clearGameStatusTypewriterTimer,
		getPunctuationPauseMs,
		showWaitingMiniGame,
		stageMessage,
		waitingGameStage
	]);

	useEffect(() => {
		clearLevelBadgeTypewriterTimer();
		if (!showWaitingMiniGame || waitingGameStage !== 'game') {
			setLevelBadgeTypewriterBusy(false);
			setLevelBadgeTypedText('');
			return;
		}
		const fullText = translate('session.waitingMiniGame.levelBadge', {
			defaultValue: 'Level {{level}}: {{title}}',
			level: currentLevel,
			title: BREATH_LEVELS[currentLevel - 1]?.title
		});
		setLevelBadgeTypewriterBusy(false);
		setLevelBadgeTypedText(fullText);
		return () => clearLevelBadgeTypewriterTimer();
	}, [
		clearLevelBadgeTypewriterTimer,
		currentLevel,
		showWaitingMiniGame,
		translate,
		waitingGameStage
	]);

	useEffect(() => {
		clearCenterStageTypewriterTimer();
		if (
			waitingGameStage !== 'completion' &&
			waitingGameStage !== 'prize' &&
			waitingGameStage !== 'serenity'
		) {
			setCenterStageTypewriterBusy(false);
			setCenterStageTypedText('');
			return;
		}
		const completionTitle = translate(
			'session.waitingMiniGame.completionTitle',
			'Congratulation you have made it.'
		);
		const completionTitleWithPunctuation = /[.!?…]\s*$/.test(
			completionTitle
		)
			? completionTitle
			: `${completionTitle}.`;
		const fullText =
			waitingGameStage === 'completion'
				? completionTitleWithPunctuation
				: waitingGameStage === 'prize'
					? `${translate(
							'session.waitingMiniGame.prizeLine1',
							'Your main prize is true wisdom.'
						)}\n\n${translate(
							'session.waitingMiniGame.prizeLine2',
							'Because you overcame your inner noise, beat the boredom, got some distance, and found a little inner peace.'
						)}`
					: translate(
							'session.waitingMiniGame.serenityPrayer',
							'God, grant me the serenity to accept the things I cannot change, courage to change the things I can, and wisdom to know the difference.'
						);
		let index = 0;
		setCenterStageTypewriterBusy(true);
		setCenterStageTypedText('');
		const tick = () => {
			index += 1;
			setCenterStageTypedText(fullText.slice(0, index));
			if (index >= fullText.length) {
				setCenterStageTypewriterBusy(false);
				if (waitingGameStage === 'prize') {
					window.setTimeout(
						() => setWaitingGameStage('serenity'),
						TYPEWRITER_TIMING.prizeToSerenityMs
					);
				}
				return;
			}
			centerStageTypewriterRef.current = window.setTimeout(
				tick,
				45 + 55 * Math.random()
			);
		};
		centerStageTypewriterRef.current = window.setTimeout(
			tick,
			TYPEWRITER_TIMING.initialDelayMs
		);
		return () => clearCenterStageTypewriterTimer();
	}, [
		clearCenterStageTypewriterTimer,
		getPunctuationPauseMs,
		translate,
		waitingGameStage
	]);

	useEffect(
		() => () => {
			clearBreathTimer();
			clearTypewriterTimer();
			clearBriefingTypewriterTimer();
			clearGameStatusTypewriterTimer();
			clearLevelBadgeTypewriterTimer();
			clearCenterStageTypewriterTimer();
			stopBreathSound();
			if (cueMasterGainRef.current) {
				cueMasterGainRef.current.dispose();
				cueMasterGainRef.current = null;
			}
		},
		[
			clearBreathTimer,
			clearTypewriterTimer,
			clearBriefingTypewriterTimer,
			clearGameStatusTypewriterTimer,
			clearLevelBadgeTypewriterTimer,
			clearCenterStageTypewriterTimer,
			stopBreathSound
		]
	);

	useEffect(() => {
		if (messages && messages.length > 0 && !initialScrollCompleted) {
			enableInitialScroll();
		}
	}, [messages, initialScrollCompleted]);

	useEffect(() => {
		knownMessageIdsRef.current = new Set(
			(messages || []).map((m) => m._id)
		);
	}, [activeSession.item.id]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!messages || messages.length === 0 || !isThreadsEnabled) {
			return;
		}

		if (knownMessageIdsRef.current.size === 0) {
			knownMessageIdsRef.current = new Set(messages.map((m) => m._id));
			return;
		}

		const contactName =
			getContact(activeSession)?.username ||
			translate('sessionList.user.consultantUnknown');
		const newThreadReplies = messages.filter((message) => {
			if (knownMessageIdsRef.current.has(message._id)) {
				return false;
			}
			const parsed = parseMessagePrefixes(message.message);
			if (!parsed.isThreadMessage || !parsed.threadRootId) {
				return false;
			}
			if (activeThreadRootId === parsed.threadRootId) {
				return false;
			}
			if (isMyMessageMatrix(message.userId)) {
				return false;
			}
			return true;
		});

		newThreadReplies.forEach((message) => {
			const parsed = parseMessagePrefixes(message.message);
			const params = new URLSearchParams(location.search);
			if (parsed.threadRootId) {
				params.set('threadRootId', parsed.threadRootId);
			}
			params.set('threadMessageId', message._id);
			const actionPath = `${location.pathname}?${params.toString()}`;
			const snippet = (parsed.cleanedMessage || '')
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 120);
			addEventNotification({
				type: NOTIFICATION_TYPE_INFO,
				eventType: 'thread.reply.new',
				title: translate(
					'notifications.threadReply.title',
					'New thread reply'
				),
				text: `${contactName}: ${snippet || 'New reply in thread'}`,
				actionPath,
				actionLabel: translate(
					'notifications.center.open',
					'Open chat'
				),
				sourceSessionId: activeSession.item.id,
				category: 'message'
			});
		});

		messages.forEach((message) =>
			knownMessageIdsRef.current.add(message._id)
		);
	}, [
		messages,
		isThreadsEnabled,
		activeThreadRootId,
		location.pathname,
		location.search,
		addEventNotification,
		activeSession,
		isMyMessageMatrix,
		translate
	]);

	useEffect(() => {
		if (!isThreadsEnabled || !messages || messages.length === 0) {
			return;
		}
		const params = new URLSearchParams(location.search);
		const threadRootId = params.get('threadRootId');
		if (!threadRootId) {
			return;
		}
		const rootMessage = messages.find(
			(message) => message._id === threadRootId
		);
		if (rootMessage) {
			setActiveThreadRootId(rootMessage._id);
			setActiveThreadRootMessage(rootMessage);
		}
	}, [location.search, isThreadsEnabled, messages]);

	const resetUnreadCount = () => {
		setNewMessages(0);
		initMessageCount = messages?.length;
		scrollContainerRef.current
			.querySelectorAll('.messageItem__divider--lastRead')
			.forEach((e) => e.remove());
	};

	useEffect(() => {
		const enableDraggingOnWindow = () => {
			window.ondragover = (ev: any) => {
				setIsDragging(true);
				cancelDraggingOnOutsideWindow();

				const isOutsideDropZone =
					!ev.target.classList.contains('dragAndDropArea');
				if (isOutsideDropZone) {
					ev.preventDefault();
					ev.dataTransfer.dropEffect = 'none';
					ev.dataTransfer.effectAllowed = 'none';
				}
			};
			window.ondragleave = () => onDragLeave();
			window.ondragend = window.ondrop = () => setIsDragging(false);
		};

		if (!canWriteMessage) {
			return;
		}

		enableDraggingOnWindow();
		return () => disableDraggingOnWindow();
	}, [canWriteMessage]);

	useEffect(() => {
		if (scrollContainerRef.current) {
			resetUnreadCount();
		}
	}, [scrollContainerRef]); // eslint-disable-line

	useEffect(() => {
		if (!messages) {
			return;
		}

		if (
			initialScrollCompleted &&
			isMyMessageMatrix(messages[messages.length - 1]?.userId)
		) {
			resetUnreadCount();
			scrollToEnd(0, true);
		} else {
			// if first unread message -> prepend element
			if (newMessages === 0 && !isScrolledToBottom) {
				const scrollContainer = scrollContainerRef.current;
				if (scrollContainer) {
					const firstUnreadItem = Array.from(
						scrollContainer.querySelectorAll('.messageItem')
					).pop() as HTMLElement | undefined;
					if (firstUnreadItem) {
						const lastReadDivider = document.createElement('div');
						lastReadDivider.innerHTML = translate(
							'session.divider.lastRead'
						);
						lastReadDivider.className =
							'messageItem__divider messageItem__divider--lastRead';
						firstUnreadItem.prepend(lastReadDivider);
					}
				}
			}

			if (isScrolledToBottom && initialScrollCompleted) {
				resetUnreadCount();
				scrollToEnd(0, true);
			}

			setNewMessages(messages.length - initMessageCount);
		}
	}, [messages?.length]); // eslint-disable-line

	useEffect(() => {
		if (isScrolledToBottom) {
			resetUnreadCount();
		}
	}, [isScrolledToBottom]); // eslint-disable-line

	const getPlaceholder = () => {
		if (activeSession.isGroup) {
			return translate('enquiry.write.input.placeholder.groupChat');
		} else if (hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)) {
			return translate('enquiry.write.input.placeholder.asker');
		} else if (hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)) {
			return translate('enquiry.write.input.placeholder.consultant');
		}
		return translate('enquiry.write.input.placeholder.asker');
	};

	/* eslint-disable */
	const handleScroll = useDebouncedCallback((e) => {
		const scrollPosition = Math.round(
			e.target.scrollHeight - e.target.scrollTop
		);
		const containerHeight = e.target.clientHeight;
		const isBottom =
			scrollPosition >= containerHeight - 1 &&
			scrollPosition <= containerHeight + 1;

		setIsScrolledToBottom(isBottom);
	}, 100);
	/* eslint-enable */

	const handleScrollToBottomButtonClick = () => {
		const scrollContainer = scrollContainerRef.current;
		if (newMessages > 0 && scrollContainer) {
			const sessionHeader =
				scrollContainer.parentElement?.getElementsByClassName(
					'sessionInfo'
				)[0] as HTMLElement | undefined;
			const messageItems = scrollContainer.querySelectorAll(
				'.messageItem:not(.messageItem--right)'
			);
			const firstUnreadItem = messageItems[
				messageItems.length - newMessages
			] as HTMLElement | undefined;

			if (firstUnreadItem && sessionHeader) {
				const firstUnreadItemOffet =
					firstUnreadItem.offsetTop - sessionHeader.offsetHeight;

				if (scrollContainer.scrollTop < firstUnreadItemOffet) {
					smoothScroll({
						duration: 1000,
						element: scrollContainer,
						to: firstUnreadItemOffet
					});
				} else {
					scrollToEnd(0, true);
				}
			} else {
				scrollToEnd(0, true);
			}
		} else {
			scrollToEnd(0, true);
		}
	};
	const handleMobileNavigateBackClick = () => {
		mobileListView();
	};
	const handleMobileNavigateStepDownClick = () => {
		const scrollContainer = scrollContainerRef.current;
		if (!scrollContainer) {
			return;
		}
		smoothScroll({
			duration: 500,
			element: scrollContainer,
			to: Math.min(
				scrollContainer.scrollHeight,
				scrollContainer.scrollTop +
					Math.round(scrollContainer.clientHeight * 0.6)
			)
		});
	};

	const enableInitialScroll = () => {
		if (!initialScrollCompleted) {
			setInitialScrollCompleted(true);
			// Initial open should snap only the message container, without animated jumps.
			scrollToEnd(0, false);
		}
	};

	const isOnlyEnquiry = type === SESSION_LIST_TYPES.ENQUIRY;

	const scrollBottomButtonItem: ButtonItem = {
		icon: <ArrowDoubleDownIcon />,
		type: BUTTON_TYPES.SMALL_ICON,
		smallIconBackgroundColor: 'alternate',
		title: translate('app.scrollDown')
	};

	// cancels dragging automatically if user drags outside the
	// browser window (there is no build-in mechanic for that)
	const cancelDraggingOnOutsideWindow = () => {
		if (dragCancelRef.current) {
			clearTimeout(dragCancelRef.current);
		}

		dragCancelRef.current = setTimeout(() => {
			setIsDragging(false);
		}, 300);
	};

	const disableDraggingOnWindow = () => {
		setIsDragging(false);
		window.ondrag = undefined;
	};

	const onDragEnter = () => setDragOverDropArea(true);
	const onDragLeave = () => setDragOverDropArea(false);

	const onFileDragged = (file: File) => {
		setDraggedFile(file);
		onDragLeave();
	};

	const handleMessageSendSuccess = () => {
		setDraggedFile(null);

		if (props.refreshMessages) {
			setTimeout(() => {
				props.refreshMessages();
			}, 500);
		}
	};

	const handleOpenThread = useCallback((message: MessageItem) => {
		setActiveThreadRootId(message._id);
		setActiveThreadRootMessage(message);
	}, []);

	const handleCloseThread = useCallback(() => {
		setActiveThreadRootId(null);
		setActiveThreadRootMessage(null);
	}, []);

	// If threads become disabled while a thread panel is open, close it immediately.
	useEffect(() => {
		if (!isThreadsEnabled && activeThreadRootId) {
			handleCloseThread();
		}
	}, [isThreadsEnabled, activeThreadRootId, handleCloseThread]);

	useEffect(() => {
		if (isAskerUser && !isConsultantUser) {
			return;
		}
		const roomId =
			(activeSession.rid && activeSession.rid.startsWith('!')
				? activeSession.rid
				: activeSession.item?.matrixRoomId ||
					activeSession.rid ||
					null) || null;
		if (!roomId) {
			return;
		}

		apiPatchNotificationActiveView({
			roomId,
			threadRootId: activeThreadRootId,
			active: true
		}).catch(() => undefined);

		const heartbeat = window.setInterval(() => {
			apiPatchNotificationActiveView({
				roomId,
				threadRootId: activeThreadRootId,
				active: true
			}).catch(() => undefined);
		}, 10000);

		return () => {
			window.clearInterval(heartbeat);
			apiPatchNotificationActiveView({
				roomId,
				threadRootId: null,
				active: false
			}).catch(() => undefined);
		};
	}, [
		activeSession.rid,
		activeSession.item?.matrixRoomId,
		activeThreadRootId,
		isAskerUser,
		isConsultantUser
	]);

	// Track the decryption success because we have a short timing issue when
	// message is send before the room encryption
	const decryptionSuccess = useRef([]);
	const handleDecryptionSuccess = useCallback((id: string) => {
		if (decryptionSuccess.current.includes(id)) {
			return;
		}

		decryptionSuccess.current.push(id);
	}, []);
	const lastDecryptionError = useRef(0);
	const handleDecryptionErrors = useDebounceCallback(
		useCallback((collectedErrors: [[string, number, TError]]) => {
			Promise.all(
				collectedErrors
					// Filter already tracked error messages
					.filter(([, ts]) => ts > lastDecryptionError.current)
					.filter(([id]) => !decryptionSuccess.current.includes(id))
					// Keep only last error of one type
					.reduce((acc, [, timestamp, collectedError], i) => {
						const trackedErrorIndex = acc.findIndex(
							([, accError]) =>
								accError.message === collectedError.message
						);
						if (
							trackedErrorIndex >= 0 &&
							acc[trackedErrorIndex][1].message ===
								collectedError.message
						) {
							if (timestamp > acc[trackedErrorIndex][0]) {
								acc.splice(
									trackedErrorIndex,
									1,
									collectedErrors[i]
								);
							}
						} else {
							acc.push(collectedErrors[i]);
						}
						return acc;
					}, [])
					.map(([, timestamp, collectedError]) => {
						lastDecryptionError.current =
							timestamp > lastDecryptionError.current
								? timestamp
								: lastDecryptionError.current;

						return apiPostError(collectedError);
					})
			).then((a) => {
				if (a.length > 0) {
					// console.log(`${a.length} error(s) reported.`);
				}
			});
		}, []),
		1000,
		true
	);

	return (
		<div
			className={clsx(
				'session',
				shouldFadeSessionChrome && 'session--gameFocus'
			)}
		>
			<div
				ref={headerRef}
				style={
					isEmbeddedNotificationsView
						? { display: 'none' }
						: undefined
				}
			>
				{!isEmbeddedNotificationsView && (
					<SessionHeaderComponent
						consultantAbsent={
							activeSession.consultant &&
							activeSession.consultant.absent
								? activeSession.consultant
								: null
						}
						hasUserInitiatedStopOrLeaveRequest={
							props.hasUserInitiatedStopOrLeaveRequest
						}
						bannedUsers={props.bannedUsers}
					/>
				)}
			</div>

			<div
				id="session-scroll-container"
				className={clsx(
					'session__content',
					isDragging && 'drag-in-progress',
					activeThreadRootId && 'session__content--withThread',
					shouldLockScroll && 'session__content--gameLockScroll',
					shouldFadeSessionChrome && 'session__content--gameFocus',
					shouldShowConsentGate && 'session__content--consentGate',
					shouldShowPseudonymGate && 'session__content--pseudonymGate'
				)}
				ref={scrollContainerRef}
				onScroll={(e) => handleScroll(e)}
				onDragEnter={onDragEnter}
			>
				{isSupervisor && supervisionReason && (
					<div className="session__supervisionReason">
						<div className="session__supervisionReasonTitle">
							{translate(
								'session.supervisor.reason.title',
								'Supervisionsgrund'
							)}
						</div>
						<div className="session__supervisionReasonText">
							{supervisionReason}
						</div>
					</div>
				)}
				{isSupervisor && (!messages || messages.length === 0) && (
					<div className="session__supervisionReason">
						<div className="session__supervisionReasonTitle">
							{translate(
								'session.supervisor.startChat.title',
								'Chat starten'
							)}
						</div>
						<div className="session__supervisionReasonText">
							{translate(
								'session.supervisor.startChat.hint',
								'Use the message field at the bottom to send the first supervision message.'
							)}
						</div>
					</div>
				)}
				{shouldShowConsentGate && (
					<AnonymousConsentGate
						consentLabelHtml={anonymousInquiryConsentLabel}
						onAccept={handleAnonymousInquiryConsentAccept}
					/>
				)}
				{shouldShowPseudonymGate && (
					<div className="session__pseudonymGate">
						<PseudonymCard
							pseudonym={currentPseudonym}
							skipTyping={pseudonymConfirmed}
						/>
						{pseudonymConfirmed && <PrivacyMessageCard />}
					</div>
				)}
				{!shouldBlockAnonymousInquiryChat && (
					<div className="session__gameChromeFadeTarget">
						<EncryptionBanner />
					</div>
				)}
				{(!shouldBlockAnonymousInquiryChat ||
					isInAnonymousWaitingQueuePhase) &&
					isAnonymousBreathingGameAvailable &&
					showWaitingMiniGame && (
						<div
							className="session__waitingPopupBackdrop"
							role="dialog"
							aria-modal="true"
						>
							{waitingGameStage === 'game' && (
								<div className="session__waitingGameLevelBadgeFloat">
									<span
										className="session__waitingGameLevelBadgeFloat__icon"
										aria-hidden="true"
									>
										<LevelEmojiIcon
											level={currentLevel}
											className="session__waitingGameLevelBadgeFloat__emoji"
										/>
									</span>
									<span className="session__waitingGameLevelBadgeFloat__text">
										Level {currentLevel}:{' '}
										{BREATH_LEVELS[currentLevel - 1]?.title}
									</span>
								</div>
							)}
							<div
								className={clsx(
									'session__waitingModule',
									'session__waitingModule--popup',
									(isBriefingOnlyScreen ||
										isPreGameSetupScreen ||
										isTextOnlyStage) &&
										'session__waitingModule--briefing',
									(waitingGameStage === 'tutorial' ||
										waitingGameStage === 'practice' ||
										waitingGameStage === 'game' ||
										waitingGameStage === 'bellyPractice' ||
										waitingGameStage === 'selfTimer' ||
										waitingGameStage === 'completion' ||
										waitingGameStage === 'serenity') &&
										'session__waitingModule--tutorialCard'
								)}
								role="region"
								aria-label={`${translate(
									'session.waitingMiniGame.inhaleExhale',
									'Inhale exhale breathing guide'
								)} ${translate('session.waitingMiniGame.timeLeft', 'Time left')}: ${phaseSecondsLeft}s`}
							>
								<button
									type="button"
									className="session__waitingPopupClose"
									aria-label={translate('app.close', 'Close')}
									onClick={() =>
										setShowWaitingMiniGame(false)
									}
								>
									×
								</button>
								{(waitingGameStage === 'practice' ||
									waitingGameStage === 'game' ||
									waitingGameStage === 'bellyPractice' ||
									waitingGameStage === 'selfTimer' ||
									waitingGameStage === 'completion' ||
									waitingGameStage === 'serenity') && (
									<div className="session__waitingMiniGameCarimatHeader">
										<div className="pseudonymCard__avatarCol">
											<div className="pseudonymCard__avatarFrame">
												<div className="pseudonymCard__avatarIcon">
													<svg
														width="32"
														height="36"
														viewBox="0 0 32 36"
														fill="none"
														aria-hidden="true"
													>
														<path
															d="M0 36V26C0 24.9 0.391667 23.9583 1.175 23.175C1.95833 22.3917 2.9 22 4 22H28C29.1 22 30.0417 22.3917 30.825 23.175C31.6083 23.9583 32 24.9 32 26V36H0ZM10 20C7.23333 20 4.875 19.025 2.925 17.075C0.975 15.125 0 12.7667 0 10C0 7.23333 0.975 4.875 2.925 2.925C4.875 0.975 7.23333 0 10 0H22C24.7667 0 27.125 0.975 29.075 2.925C31.025 4.875 32 7.23333 32 10C32 12.7667 31.025 15.125 29.075 17.075C27.125 19.025 24.7667 20 22 20H10ZM4 32H28V26H4V32ZM10 16H22C23.6667 16 25.0833 15.4167 26.25 14.25C27.4167 13.0833 28 11.6667 28 10C28 8.33333 27.4167 6.91667 26.25 5.75C25.0833 4.58333 23.6667 4 22 4H10C8.33333 4 6.91667 4.58333 5.75 5.75C4.58333 6.91667 4 8.33333 4 10C4 11.6667 4.58333 13.0833 5.75 14.25C6.91667 15.4167 8.33333 16 10 16ZM11.425 11.425C11.8083 11.0417 12 10.5667 12 10C12 9.43333 11.8083 8.95833 11.425 8.575C11.0417 8.19167 10.5667 8 10 8C9.43333 8 8.95833 8.19167 8.575 8.575C8.19167 8.95833 8 9.43333 8 10C8 10.5667 8.19167 11.0417 8.575 11.425C8.95833 11.8083 9.43333 12 10 12C10.5667 12 11.0417 11.8083 11.425 11.425ZM23.425 11.425C23.8083 11.0417 24 10.5667 24 10C24 9.43333 23.8083 8.95833 23.425 8.575C23.0417 8.19167 22.5667 8 22 8C21.4333 8 20.9583 8.19167 20.575 8.575C20.1917 8.95833 20 9.43333 20 10C20 10.5667 20.1917 11.0417 20.575 11.425C20.9583 11.8083 21.4333 12 22 12C22.5667 12 23.0417 11.8083 23.425 11.425Z"
															fill="currentColor"
														/>
													</svg>
												</div>
											</div>
											<div className="pseudonymCard__menuIcon">
												<svg
													width="24"
													height="24"
													viewBox="0 0 32 32"
													fill="none"
													aria-hidden="true"
												>
													<path
														d="M16.0007 26.6673C15.2673 26.6673 14.6395 26.4062 14.1173 25.884C13.5951 25.3618 13.334 24.734 13.334 24.0007C13.334 23.2673 13.5951 22.6395 14.1173 22.1173C14.6395 21.5951 15.2673 21.334 16.0007 21.334C16.734 21.334 17.3618 21.5951 17.884 22.1173C18.4062 22.6395 18.6673 23.2673 18.6673 24.0007C18.6673 24.734 18.4062 25.3618 17.884 25.884C17.3618 26.4062 16.734 26.6673 16.0007 26.6673ZM16.0007 18.6673C15.2673 18.6673 14.6395 18.4062 14.1173 17.884C13.5951 17.3618 13.334 16.734 13.334 16.0007C13.334 15.2673 13.5951 14.6395 14.1173 14.1173C14.6395 13.5951 15.2673 13.334 16.0007 13.334C16.734 13.334 17.3618 13.5951 17.884 14.1173C18.4062 14.6395 18.6673 15.2673 18.6673 16.0007C18.6673 16.734 18.4062 17.3618 17.884 17.884C17.3618 18.4062 16.734 18.6673 16.0007 18.6673ZM16.0007 10.6673C15.2673 10.6673 14.6395 10.4062 14.1173 9.88398C13.5951 9.36176 13.334 8.73398 13.334 8.00065C13.334 7.26732 13.5951 6.63954 14.1173 6.11732C14.6395 5.5951 15.2673 5.33398 16.0007 5.33398C16.734 5.33398 17.3618 5.5951 17.884 6.11732C18.4062 6.63954 18.6673 7.26732 18.6673 8.00065C18.6673 8.73398 18.4062 9.36176 17.884 9.88398C17.3618 10.4062 16.734 10.6673 16.0007 10.6673Z"
														fill="#1D1B20"
													/>
												</svg>
											</div>
										</div>
										<div className="pseudonymCard__contentCol breathingTutorialCard__contentCol">
											<div className="pseudonymCard__header">
												<span className="pseudonymCard__headerName">
													Carimat
												</span>
												<span className="pseudonymCard__headerSubtitle">
													{translate(
														'session.waitingMiniGame.tutorialCard.carimatSubtitle',
														'Lets bridge your waiting time'
													)}
												</span>
											</div>
											<div className="breathingTutorialCard__bubble breathingTutorialCard__bubble--practice">
												{isBubbleTyping ? (
													<p className="breathingTutorialCard__bubbleText breathingTutorialCard__bubbleText--practice">
														{bubblePlainText.slice(
															0,
															bubbleTypedLen
														)}
														{bubbleCursorChar}
													</p>
												) : (
													<p
														className="breathingTutorialCard__bubbleText breathingTutorialCard__bubbleText--practice"
														dangerouslySetInnerHTML={{
															__html: stageMessage
														}}
													/>
												)}
											</div>
										</div>
									</div>
								)}
								{waitingGameStage === 'tutorial' &&
									briefingScreenIndex === 2 &&
									!showBriefingNegativeScreen && (
										<BreathingTutorialCard
											phase={
												tutorialPhases[
													tutorialCardIndex
												]
											}
											onCancel={() => {
												setShowWaitingMiniGame(false);
												setTutorialCardIndex(0);
											}}
											onConfirm={() => {
												if (tutorialCardIndex < 2) {
													setTutorialCardIndex(
														(i) =>
															Math.min(
																2,
																i + 1
															) as 0 | 1 | 2
													);
													return;
												}
												/* Finished all three phase
												   cards — drop straight
												   into the beginner 3-3-4
												   starter preset. */
												setTutorialCardIndex(0);
												setShowBriefingNegativeScreen(
													false
												);
												setSelectedPresetId(
													'starter334'
												);
												setCustomTiming({
													inhale: 3,
													hold: 3,
													exhale: 4
												});
												startPracticeRound();
											}}
										/>
									)}
								{isBreathingArenaVisible && (
									<div className="session__waitingVolumeHint">
										{SPEAKER_HINT_ICON}
										<span>
											{translate(
												'session.waitingMiniGame.volumeHint',
												'For better experience, turn on your volume.'
											)}
										</span>
									</div>
								)}
								{isBreathingArenaVisible && (
									<div className="session__waitingMiniGameArena session__waitingMiniGameArena--breathing">
										<div className="session__waitingMiniGameSingle">
											{/* Big "Ns" timer removed from the
											    portrait card layout — the phase
											    duration is already surfaced in
											    the Carimat bubble at the top. */}
											<div
												className={clsx(
													'session__waitingMiniGamePulse',
													breathPhase === 'hold' &&
														'session__waitingMiniGamePulse--holding'
												)}
												style={
													{
														'filter': `drop-shadow(0 0 ${12 + currentLevel * 1.2}px rgba(204,30,28,0.45))`,
														'--breath-scale':
															circleScale,
														'--breath-center-scale':
															circleCenterScale
													} as React.CSSProperties
												}
											>
												<span className="session__waitingMiniGamePulseCircle session__waitingMiniGamePulseCircle--1" />
												<span className="session__waitingMiniGamePulseCircle session__waitingMiniGamePulseCircle--2" />
												<span className="session__waitingMiniGamePulseCircle session__waitingMiniGamePulseCircle--3" />
												<span className="session__waitingMiniGamePulseCircle session__waitingMiniGamePulseCircle--4" />
												<div className="session__waitingMiniGameCenter">
													<span className="session__waitingMiniGameCircleIcon">
														{currentPhaseIcon}
													</span>
													<div className="session__waitingMiniGameCenterText">
														{currentPhaseLabel}
													</div>
												</div>
											</div>
										</div>
									</div>
								)}
								{waitingGameStage === 'practice' && (
									<div className="session__waitingMiniGamePracticeHint">
										{stageMessage}
									</div>
								)}
								{waitingGameStage === 'selfTimer' && (
									<div className="session__selfTimerSliders">
										{(
											[
												'inhale',
												'hold',
												'exhale'
											] as const
										).map((phase, rowIdx) => {
											/* Each row is independent, 1-7s. The center
											   of the track is always 4s — if value < 4
											   the red block grows to the left from
											   center; if value > 4 it grows to the right.
											   The "4s" reference chip is fixed above the
											   top (inhale) row only. */
											const min = 1;
											const max = 7;
											const center = 4;
											const value = Math.min(
												max,
												Math.max(
													min,
													customTiming[phase]
												)
											);
											const valuePct =
												((value - min) / (max - min)) *
												100;
											const centerPct = 50;
											const redLeftPct = Math.min(
												centerPct,
												valuePct
											);
											const redRightPct = Math.max(
												centerPct,
												valuePct
											);
											const label = translate(
												`session.waitingMiniGame.phase.${phase}`,
												phase.charAt(0).toUpperCase() +
													phase.slice(1)
											);
											return (
												<div
													className="session__selfTimerRow"
													key={phase}
												>
													<div className="session__selfTimerTrack">
														{rowIdx === 0 && (
															<div
																className="session__selfTimerValueBubble"
																style={{
																	left: `${centerPct}%`
																}}
															>
																4s
															</div>
														)}
														<div
															className="session__selfTimerSegment session__selfTimerSegment--grey session__selfTimerSegment--start"
															style={{
																left: '0%',
																width: `${redLeftPct}%`
															}}
														>
															<span className="session__selfTimerDot session__selfTimerDot--left" />
														</div>
														<div
															className="session__selfTimerSegment session__selfTimerSegment--red"
															style={{
																left: `${redLeftPct}%`,
																width: `${redRightPct - redLeftPct}%`
															}}
														/>
														<div
															className="session__selfTimerHandle"
															style={{
																left: `${valuePct}%`
															}}
														/>
														<div
															className="session__selfTimerSegment session__selfTimerSegment--grey session__selfTimerSegment--end"
															style={{
																left: `${redRightPct}%`,
																width: `${100 - redRightPct}%`
															}}
														>
															<span className="session__selfTimerDot session__selfTimerDot--right" />
														</div>
														<input
															type="range"
															min={min}
															max={max}
															step={1}
															value={value}
															onChange={(e) =>
																setCustomTiming(
																	(prev) => ({
																		...prev,
																		[phase]:
																			Number(
																				e
																					.target
																					.value
																			)
																	})
																)
															}
															className="session__selfTimerInput"
															aria-label={`${label} seconds`}
														/>
													</div>
													<span className="session__selfTimerLabel">
														{label}
													</span>
												</div>
											);
										})}
									</div>
								)}
								{isPreGameSetupScreen && (
									<div className="session__waitingPreGameSetup">
										{!isInitialSetupScreen && (
											<div className="session__waitingPreGameTitle">
												{translate(
													'session.waitingMiniGame.practiceSuccessPrompt',
													'Great job, want to start now?'
												)}
											</div>
										)}
										<div className="session__waitingPreGameTitle session__waitingPreGameTitle--small">
											{translate(
												'session.waitingMiniGame.timingInfo',
												'Set your breathing timing before you start.'
											)}
										</div>
										<div className="session__waitingPreGameLevels">
											{BREATHING_PRESETS.map((preset) => (
												<button
													key={preset.id}
													type="button"
													className={clsx(
														'session__waitingPreGameLevelChip',
														selectedPresetId ===
															preset.id &&
															'session__waitingPreGameLevelChip--active'
													)}
													onClick={() =>
														setSelectedPresetId(
															preset.id
														)
													}
												>
													{translate(
														`session.waitingMiniGame.presets.${preset.id}`,
														preset.label
													)}
												</button>
											))}
										</div>
										<div className="session__waitingPreGameTiming">
											<div
												className="session__waitingPreGameTimingRow session__waitingPreGameTimingRow--inhale"
												style={getTimingRowStyle(
													customTiming.inhale
												)}
											>
												<span>
													{translate(
														'session.waitingMiniGame.phase.inhale',
														'Inhale'
													)}
												</span>
												<span className="session__waitingPreGameTimingValue">
													<button
														type="button"
														className="session__waitingPreGameTimingArrow"
														onClick={() =>
															updateTiming(
																'inhale',
																-1
															)
														}
														aria-label={translate(
															'session.waitingMiniGame.decreaseInhale',
															'Decrease inhale seconds'
														)}
													>
														◀
													</button>
													<span>
														{customTiming.inhale}s
													</span>
													<button
														type="button"
														className="session__waitingPreGameTimingArrow"
														onClick={() =>
															updateTiming(
																'inhale',
																1
															)
														}
														aria-label={translate(
															'session.waitingMiniGame.increaseInhale',
															'Increase inhale seconds'
														)}
													>
														▶
													</button>
												</span>
											</div>
											<div
												className="session__waitingPreGameTimingRow session__waitingPreGameTimingRow--hold"
												style={getTimingRowStyle(
													customTiming.hold
												)}
											>
												<span>
													{translate(
														'session.waitingMiniGame.phase.hold',
														'Hold'
													)}
												</span>
												<span className="session__waitingPreGameTimingValue">
													<button
														type="button"
														className="session__waitingPreGameTimingArrow"
														onClick={() =>
															updateTiming(
																'hold',
																-1
															)
														}
														aria-label={translate(
															'session.waitingMiniGame.decreaseHold',
															'Decrease hold seconds'
														)}
													>
														◀
													</button>
													<span>
														{customTiming.hold}s
													</span>
													<button
														type="button"
														className="session__waitingPreGameTimingArrow"
														onClick={() =>
															updateTiming(
																'hold',
																1
															)
														}
														aria-label={translate(
															'session.waitingMiniGame.increaseHold',
															'Increase hold seconds'
														)}
													>
														▶
													</button>
												</span>
											</div>
											<div
												className="session__waitingPreGameTimingRow session__waitingPreGameTimingRow--exhale"
												style={getTimingRowStyle(
													customTiming.exhale
												)}
											>
												<span>
													{translate(
														'session.waitingMiniGame.phase.exhale',
														'Exhale'
													)}
												</span>
												<span className="session__waitingPreGameTimingValue">
													<button
														type="button"
														className="session__waitingPreGameTimingArrow"
														onClick={() =>
															updateTiming(
																'exhale',
																-1
															)
														}
														aria-label={translate(
															'session.waitingMiniGame.decreaseExhale',
															'Decrease exhale seconds'
														)}
													>
														◀
													</button>
													<span>
														{customTiming.exhale}s
													</span>
													<button
														type="button"
														className="session__waitingPreGameTimingArrow"
														onClick={() =>
															updateTiming(
																'exhale',
																1
															)
														}
														aria-label={translate(
															'session.waitingMiniGame.increaseExhale',
															'Increase exhale seconds'
														)}
													>
														▶
													</button>
												</span>
											</div>
										</div>
										<div
											className={clsx(
												'session__waitingPreGameActions',
												isInitialSetupScreen &&
													'session__waitingPreGameActions--single'
											)}
										>
											{isInitialSetupScreen ? (
												<button
													type="button"
													className="session__waitingPreGameActionButton session__waitingPreGameActionButton--primary"
													onClick={startPracticeRound}
												>
													{translate(
														'session.waitingMiniGame.startFirstTry',
														'Lets start the first try'
													)}
												</button>
											) : (
												<>
													<button
														type="button"
														className="session__waitingPreGameActionButton session__waitingPreGameActionButton--ghost"
														onClick={
															startPracticeRound
														}
													>
														{translate(
															'session.waitingMiniGame.repeatTrainingRound',
															'Repeat training round'
														)}
													</button>
													<button
														type="button"
														className="session__waitingPreGameActionButton session__waitingPreGameActionButton--primary"
														onClick={
															startAchieverGame
														}
													>
														{translate(
															'session.waitingMiniGame.startRealGame',
															'Lets start the real game'
														)}
													</button>
												</>
											)}
										</div>
									</div>
								)}
								<div
									className={clsx(
										'session__waitingModuleTypewriter',
										((waitingGameStage === 'tutorial' &&
											briefingScreenIndex === 2 &&
											!showBriefingNegativeScreen) ||
											waitingGameStage === 'practice' ||
											waitingGameStage === 'game' ||
											waitingGameStage ===
												'bellyPractice' ||
											waitingGameStage === 'selfTimer' ||
											waitingGameStage === 'completion' ||
											waitingGameStage === 'serenity') &&
											'session__waitingModuleTypewriter--hidden',
										(waitingGameStage === 'completion' ||
											waitingGameStage === 'prize' ||
											waitingGameStage === 'serenity') &&
											'session__waitingModuleTypewriter--centerStage',
										(isPreGameSetupScreen ||
											isBreathingArenaVisible) &&
											'session__waitingModuleTypewriter--hidden'
									)}
								>
									{waitingGameStage === 'tutorial' &&
									!(
										briefingScreenIndex === 2 &&
										!showBriefingNegativeScreen
									) ? (
										<div
											className={clsx(
												'session__waitingBriefingScreen',
												isNegativeBriefingScreen &&
													'session__waitingBriefingScreen--negative'
											)}
											key={`${briefingScreenIndex}-${showBriefingNegativeScreen ? 'neg' : 'pos'}`}
										>
											<div
												className={clsx(
													'session__waitingBriefingText',
													'session__waitingTypewriterText'
												)}
											>
												{briefingTypewriterBusy ? (
													<>
														{briefingTypedText}
														{briefingTypedText.length &
														1
															? '_'
															: ''}
													</>
												) : (
													currentBriefingScreen.text
												)}
											</div>
											{briefingScreenIndex === 2 &&
												!showBriefingNegativeScreen && (
													<div
														className="session__waitingBriefingStepsAnimated"
														aria-hidden="true"
													>
														{briefingPhaseSteps.map(
															(step, index) => (
																<React.Fragment
																	key={
																		step.key
																	}
																>
																	<div
																		className="session__waitingBriefingStep"
																		style={
																			{
																				'--step-delay': `${180 + index * 1120}ms`
																			} as React.CSSProperties
																		}
																	>
																		<div className="session__waitingBriefingStepCircle">
																			<span className="session__waitingBriefingStepIcon">
																				{
																					step.icon
																				}
																			</span>
																		</div>
																		<div className="session__waitingBriefingStepLabel">
																			{
																				step.label
																			}
																		</div>
																	</div>
																	{index <
																		briefingPhaseSteps.length -
																			1 && (
																		<div
																			className="session__waitingBriefingStepConnector"
																			style={
																				{
																					'--connector-delay': `${760 + index * 1150}ms`
																				} as React.CSSProperties
																			}
																		>
																			<span />
																			<span />
																			<span />
																			<span />
																			<span />
																		</div>
																	)}
																</React.Fragment>
															)
														)}
													</div>
												)}
										</div>
									) : waitingGameStage === 'completion' ||
									  waitingGameStage === 'prize' ||
									  waitingGameStage ===
											'serenity' ? null : typewriterBusy ? (
										<>
											{typedText}
											{typedText.length & 1 ? '_' : ''}
										</>
									) : isPreGameSetupScreen ? null : (
										stageMessage
									)}
								</div>
								<div
									className={clsx(
										'session__waitingModuleActions',
										isNegativeBriefingScreen &&
											'session__waitingModuleActions--negative'
									)}
								>
									{waitingGameStage === 'tutorial' &&
										!(
											briefingScreenIndex === 2 &&
											!showBriefingNegativeScreen
										) && (
											<>
												{briefingTypewriterBusy ? null : currentBriefingInteraction ===
												  'negative' ? (
													<button
														type="button"
														className="session__waitingModuleActionButton session__waitingModuleActionButton--ghost session__waitingModuleActionButton--tiny"
														onClick={() => {
															setShowBriefingNegativeScreen(
																false
															);
															setBriefingScreenIndex(
																2
															);
														}}
													>
														{translate(
															'session.waitingMiniGame.changeMind',
															'I change my mind let me try out your waiting game'
														)}
													</button>
												) : currentBriefingInteraction ===
												  'choice' ? (
													<>
														<button
															type="button"
															className="session__waitingModuleActionButton session__waitingModuleActionButton--ghost"
															onClick={() =>
																setShowBriefingNegativeScreen(
																	true
																)
															}
														>
															{translate(
																'session.waitingMiniGame.iJustWait',
																'I just wait'
															)}
														</button>
														<button
															type="button"
															className="session__waitingModuleActionButton session__waitingModuleActionButton--primary"
															onClick={() =>
																setBriefingScreenIndex(
																	(index) =>
																		Math.min(
																			localizedBriefingScreens.length -
																				1,
																			index +
																				1
																		)
																)
															}
														>
															{translate(
																'session.waitingMiniGame.startGame',
																'Start the game'
															)}
														</button>
													</>
												) : currentBriefingInteraction ===
												  'start' ? (
													<button
														type="button"
														className="session__waitingModuleActionButton session__waitingModuleActionButton--primary"
														onClick={() => {
															setShowBriefingNegativeScreen(
																false
															);
															setSelectedPresetId(
																'standard446'
															);
															setCustomTiming({
																inhale: 4,
																hold: 4,
																exhale: 6
															});
															startPracticeRound();
														}}
													>
														{translate(
															'app.next',
															'Continue'
														)}
													</button>
												) : null}
											</>
										)}
									{isJoinRoomAvailable &&
										waitingGameStage !== 'practice' &&
										waitingGameStage !== 'game' && (
											<button
												type="button"
												className={clsx(
													'session__breathingJoinButton',
													joinPromptEscalated &&
														'session__breathingJoinButton--urgent'
												)}
												onClick={() =>
													setShowWaitingMiniGame(
														false
													)
												}
											>
												{translate(
													'session.waitingMiniGame.joinRoom',
													'Join the room'
												)}
											</button>
										)}
								</div>
								{waitingGameStage === 'bellyPractice' && (
									<div className="session__waitingMiniGamePracticeActions session__waitingMiniGamePracticeActions--belly">
										<button
											type="button"
											className={clsx(
												'session__waitingMiniGameBellyModeBtn',
												bellyMode === 'autoPilot'
													? 'session__waitingMiniGameBellyModeBtn--active'
													: 'session__waitingMiniGameBellyModeBtn--inactive'
											)}
											aria-pressed={
												bellyMode === 'autoPilot'
											}
											onClick={() =>
												handleBellyModeButton(
													'autoPilot'
												)
											}
										>
											<svg
												width="24"
												height="24"
												viewBox="0 0 24 24"
												fill="none"
												aria-hidden="true"
											>
												<path
													d="M21.25 15.7V5.9875C21.25 4.19636 19.8036 2.75 18.0125 2.75H5.9875C4.19636 2.75 2.75 4.19636 2.75 5.9875V18.0125C2.75 19.8036 4.19636 21.25 5.9875 21.25H15.7L21.25 15.7ZM5.9875 19.4C5.22227 19.4 4.6 18.7777 4.6 18.0125V5.9875C4.6 5.22227 5.22227 4.6 5.9875 4.6H18.0125C18.7777 4.6 19.4 5.22227 19.4 5.9875V14.775H18.0125C16.2214 14.775 14.775 16.2214 14.775 18.0125V19.4H5.9875ZM9.93136 9.94818C9.6875 9.09045 8.79614 8.58591 7.93841 8.82977C7.08068 9.07364 6.57614 9.965 6.82 10.8311C6.88727 11.0666 7.005 11.2768 7.15636 11.4534L9.965 10.663C10.007 10.4275 9.99864 10.1836 9.93136 9.94818ZM15.7168 8.31682C15.4814 7.45909 14.5816 6.95455 13.7239 7.19841C12.8661 7.44227 12.3616 8.33364 12.6055 9.19977C12.6727 9.43523 12.7905 9.64545 12.9418 9.82205L15.7505 9.03159C15.7925 8.79614 15.7841 8.55227 15.7168 8.31682ZM16.5409 11.2095L7.62727 13.7239C8.82977 15.3132 10.9152 16.0868 12.9418 15.515C14.9684 14.9432 16.3391 13.1857 16.5409 11.2095Z"
													fill="currentColor"
												/>
											</svg>
											<span className="session__waitingMiniGameBellyModeBtnLabel">
												{translate(
													'session.waitingMiniGame.tutorialCard.belly.autoPilot',
													'Auto pilot'
												)}
											</span>
										</button>
										<button
											type="button"
											className={clsx(
												'session__waitingMiniGameBellyModeBtn',
												bellyMode === 'timeIt'
													? 'session__waitingMiniGameBellyModeBtn--active'
													: 'session__waitingMiniGameBellyModeBtn--inactive'
											)}
											aria-pressed={
												bellyMode === 'timeIt'
											}
											onClick={() =>
												handleBellyModeButton('timeIt')
											}
										>
											<svg
												width="24"
												height="24"
												viewBox="0 0 24 24"
												fill="none"
												aria-hidden="true"
											>
												<path
													d="M11.9996 21.9996C10.7496 21.9996 9.57878 21.7621 8.48711 21.2871C7.39544 20.8121 6.44544 20.1704 5.63711 19.3621C4.82878 18.5538 4.18711 17.6038 3.71211 16.5121C3.23711 15.4204 2.99961 14.2496 2.99961 12.9996C2.99961 11.7496 3.23711 10.5788 3.71211 9.48711C4.18711 8.39544 4.82878 7.44544 5.63711 6.63711C6.44544 5.82878 7.39544 5.18711 8.48711 4.71211C9.57878 4.23711 10.7496 3.99961 11.9996 3.99961C13.2496 3.99961 14.4204 4.23711 15.5121 4.71211C16.6038 5.18711 17.5538 5.82878 18.3621 6.63711C19.1704 7.44544 19.8121 8.39544 20.2871 9.48711C20.7621 10.5788 20.9996 11.7496 20.9996 12.9996C20.9996 14.2496 20.7621 15.4204 20.2871 16.5121C19.8121 17.6038 19.1704 18.5538 18.3621 19.3621C17.5538 20.1704 16.6038 20.8121 15.5121 21.2871C14.4204 21.7621 13.2496 21.9996 11.9996 21.9996ZM14.7996 17.1996L16.1996 15.7996L12.9996 12.5996V7.99961H10.9996V13.3996L14.7996 17.1996ZM5.59961 2.34961L6.99961 3.74961L2.74961 7.99961L1.34961 6.59961L5.59961 2.34961ZM18.3996 2.34961L22.6496 6.59961L21.2496 7.99961L16.9996 3.74961L18.3996 2.34961Z"
													fill="currentColor"
												/>
											</svg>
											<span className="session__waitingMiniGameBellyModeBtnLabel">
												{translate(
													'session.waitingMiniGame.tutorialCard.belly.timeIt',
													'Time it'
												)}
											</span>
										</button>
									</div>
								)}
								{waitingGameStage === 'game' && (
									<div className="session__waitingMiniGamePracticeActions session__waitingMiniGamePracticeActions--belly">
										<button
											type="button"
											className={clsx(
												'session__waitingMiniGameBellyModeBtn',
												gameMode === 'autoPilot'
													? 'session__waitingMiniGameBellyModeBtn--active'
													: 'session__waitingMiniGameBellyModeBtn--inactive'
											)}
											aria-pressed={
												gameMode === 'autoPilot'
											}
											onClick={() =>
												handleGameModeButton(
													'autoPilot'
												)
											}
										>
											<svg
												width="24"
												height="24"
												viewBox="0 0 24 24"
												fill="none"
												aria-hidden="true"
											>
												<path
													d="M21.25 15.7V5.9875C21.25 4.19636 19.8036 2.75 18.0125 2.75H5.9875C4.19636 2.75 2.75 4.19636 2.75 5.9875V18.0125C2.75 19.8036 4.19636 21.25 5.9875 21.25H15.7L21.25 15.7ZM5.9875 19.4C5.22227 19.4 4.6 18.7777 4.6 18.0125V5.9875C4.6 5.22227 5.22227 4.6 5.9875 4.6H18.0125C18.7777 4.6 19.4 5.22227 19.4 5.9875V14.775H18.0125C16.2214 14.775 14.775 16.2214 14.775 18.0125V19.4H5.9875ZM9.93136 9.94818C9.6875 9.09045 8.79614 8.58591 7.93841 8.82977C7.08068 9.07364 6.57614 9.965 6.82 10.8311C6.88727 11.0666 7.005 11.2768 7.15636 11.4534L9.965 10.663C10.007 10.4275 9.99864 10.1836 9.93136 9.94818ZM15.7168 8.31682C15.4814 7.45909 14.5816 6.95455 13.7239 7.19841C12.8661 7.44227 12.3616 8.33364 12.6055 9.19977C12.6727 9.43523 12.7905 9.64545 12.9418 9.82205L15.7505 9.03159C15.7925 8.79614 15.7841 8.55227 15.7168 8.31682ZM16.5409 11.2095L7.62727 13.7239C8.82977 15.3132 10.9152 16.0868 12.9418 15.515C14.9684 14.9432 16.3391 13.1857 16.5409 11.2095Z"
													fill="currentColor"
												/>
											</svg>
											<span className="session__waitingMiniGameBellyModeBtnLabel">
												{translate(
													'session.waitingMiniGame.tutorialCard.belly.autoPilot',
													'Auto pilot'
												)}
											</span>
										</button>
										<button
											type="button"
											className={clsx(
												'session__waitingMiniGameBellyModeBtn',
												gameMode === 'timeIt'
													? 'session__waitingMiniGameBellyModeBtn--active'
													: 'session__waitingMiniGameBellyModeBtn--inactive'
											)}
											aria-pressed={gameMode === 'timeIt'}
											onClick={() =>
												handleGameModeButton('timeIt')
											}
										>
											<svg
												width="24"
												height="24"
												viewBox="0 0 24 24"
												fill="none"
												aria-hidden="true"
											>
												<path
													d="M11.9996 21.9996C10.7496 21.9996 9.57878 21.7621 8.48711 21.2871C7.39544 20.8121 6.44544 20.1704 5.63711 19.3621C4.82878 18.5538 4.18711 17.6038 3.71211 16.5121C3.23711 15.4204 2.99961 14.2496 2.99961 12.9996C2.99961 11.7496 3.23711 10.5788 3.71211 9.48711C4.18711 8.39544 4.82878 7.44544 5.63711 6.63711C6.44544 5.82878 7.39544 5.18711 8.48711 4.71211C9.57878 4.23711 10.7496 3.99961 11.9996 3.99961C13.2496 3.99961 14.4204 4.23711 15.5121 4.71211C16.6038 5.18711 17.5538 5.82878 18.3621 6.63711C19.1704 7.44544 19.8121 8.39544 20.2871 9.48711C20.7621 10.5788 20.9996 11.7496 20.9996 12.9996C20.9996 14.2496 20.7621 15.4204 20.2871 16.5121C19.8121 17.6038 19.1704 18.5538 18.3621 19.3621C17.5538 20.1704 16.6038 20.8121 15.5121 21.2871C14.4204 21.7621 13.2496 21.9996 11.9996 21.9996ZM14.7996 17.1996L16.1996 15.7996L12.9996 12.5996V7.99961H10.9996V13.3996L14.7996 17.1996ZM5.59961 2.34961L6.99961 3.74961L2.74961 7.99961L1.34961 6.59961L5.59961 2.34961ZM18.3996 2.34961L22.6496 6.59961L21.2496 7.99961L16.9996 3.74961L18.3996 2.34961Z"
													fill="currentColor"
												/>
											</svg>
											<span className="session__waitingMiniGameBellyModeBtnLabel">
												{translate(
													'session.waitingMiniGame.tutorialCard.belly.timeIt',
													'Time it'
												)}
											</span>
										</button>
									</div>
								)}
								{waitingGameStage === 'practice' && (
									<div className="session__waitingMiniGamePracticeActions">
										<button
											type="button"
											className="session__waitingMiniGamePracticeRestart"
											onClick={handlePracticeRestart}
											aria-label={translate(
												'session.waitingMiniGame.tutorialCard.restart',
												'Restart'
											)}
										>
											<svg
												width="24"
												height="24"
												viewBox="0 0 24 24"
												fill="none"
												aria-hidden="true"
											>
												<path
													d="M9.9 19C8.28333 19 6.89583 18.475 5.7375 17.425C4.57917 16.375 4 15.0667 4 13.5C4 11.9333 4.57917 10.625 5.7375 9.575C6.89583 8.525 8.28333 8 9.9 8H16.2L13.6 5.4L15 4L20 9L15 14L13.6 12.6L16.2 10H9.9C8.85 10 7.9375 10.3333 7.1625 11C6.3875 11.6667 6 12.5 6 13.5C6 14.5 6.3875 15.3333 7.1625 16C7.9375 16.6667 8.85 17 9.9 17H17V19H9.9Z"
													fill="#E7EFFC"
												/>
											</svg>
										</button>
										<button
											type="button"
											className="session__waitingMiniGamePracticeAdvance"
											onClick={handlePracticeAdvance}
										>
											<svg
												width="24"
												height="24"
												viewBox="0 0 24 24"
												fill="none"
												aria-hidden="true"
											>
												<path
													d="M11.9996 21.9996C10.7496 21.9996 9.57878 21.7621 8.48711 21.2871C7.39544 20.8121 6.44544 20.1704 5.63711 19.3621C4.82878 18.5538 4.18711 17.6038 3.71211 16.5121C3.23711 15.4204 2.99961 14.2496 2.99961 12.9996C2.99961 11.7496 3.23711 10.5788 3.71211 9.48711C4.18711 8.39544 4.82878 7.44544 5.63711 6.63711C6.44544 5.82878 7.39544 5.18711 8.48711 4.71211C9.57878 4.23711 10.7496 3.99961 11.9996 3.99961C13.2496 3.99961 14.4204 4.23711 15.5121 4.71211C16.6038 5.18711 17.5538 5.82878 18.3621 6.63711C19.1704 7.44544 19.8121 8.39544 20.2871 9.48711C20.7621 10.5788 20.9996 11.7496 20.9996 12.9996C20.9996 14.2496 20.7621 15.4204 20.2871 16.5121C19.8121 17.6038 19.1704 18.5538 18.3621 19.3621C17.5538 20.1704 16.6038 20.8121 15.5121 21.2871C14.4204 21.7621 13.2496 21.9996 11.9996 21.9996ZM14.7996 17.1996L16.1996 15.7996L12.9996 12.5996V7.99961H10.9996V13.3996L14.7996 17.1996ZM5.59961 2.34961L6.99961 3.74961L2.74961 7.99961L1.34961 6.59961L5.59961 2.34961ZM18.3996 2.34961L22.6496 6.59961L21.2496 7.99961L16.9996 3.74961L18.3996 2.34961Z"
													fill="white"
												/>
											</svg>
											<span>
												{translate(
													'session.waitingMiniGame.tutorialCard.pressAtRightTime',
													'Press at the right time'
												)}
											</span>
										</button>
									</div>
								)}
								{waitingGameStage === 'completion' && (
									<div
										className="session__waitingCompletionHeart"
										aria-hidden="true"
									>
										{COMPLETION_HEART_ICON}
									</div>
								)}
								{waitingGameStage === 'completion' && (
									<div className="session__waitingMiniGameSelfTimerActions">
										<button
											type="button"
											className="session__waitingMiniGameSelfTimerBtn session__waitingMiniGameSelfTimerBtn--primary"
											onClick={() =>
												setWaitingGameStage('selfTimer')
											}
										>
											{translate(
												'session.waitingMiniGame.tutorialCard.selfTimer.repeatGame',
												'Repeat game'
											)}
										</button>
										<button
											type="button"
											className="session__waitingMiniGameSelfTimerBtn session__waitingMiniGameSelfTimerBtn--secondary"
											onClick={() =>
												setWaitingGameStage('serenity')
											}
										>
											{translate(
												'session.waitingMiniGame.tutorialCard.completion.receiveGift',
												'Receive little gift'
											)}
										</button>
									</div>
								)}
								{waitingGameStage === 'serenity' && (
									<div className="session__waitingMiniGameSelfTimerActions">
										<button
											type="button"
											className="session__waitingMiniGameSelfTimerBtn session__waitingMiniGameSelfTimerBtn--primary"
											onClick={() =>
												setWaitingGameStage('selfTimer')
											}
										>
											{translate(
												'session.waitingMiniGame.tutorialCard.selfTimer.repeatGame',
												'Repeat game'
											)}
										</button>
										<button
											type="button"
											className="session__waitingMiniGameSelfTimerBtn session__waitingMiniGameSelfTimerBtn--secondary"
											onClick={() => {
												clearBreathTimer();
												setWaitingGameStage('tutorial');
												setBriefingScreenIndex(0);
												setShowBriefingNegativeScreen(
													false
												);
												setShowWaitingMiniGame(false);
											}}
										>
											{translate(
												'session.waitingMiniGame.tutorialCard.selfTimer.backToWaiting',
												'Back to waiting'
											)}
										</button>
									</div>
								)}
								{waitingGameStage === 'selfTimer' && (
									<div className="session__waitingMiniGameSelfTimerActions">
										<button
											type="button"
											className="session__waitingMiniGameSelfTimerBtn session__waitingMiniGameSelfTimerBtn--primary"
											onClick={startAchieverGame}
										>
											{translate(
												'session.waitingMiniGame.tutorialCard.selfTimer.repeatGame',
												'Repeat game'
											)}
										</button>
										<button
											type="button"
											className="session__waitingMiniGameSelfTimerBtn session__waitingMiniGameSelfTimerBtn--secondary"
											onClick={() => {
												clearBreathTimer();
												setWaitingGameStage('tutorial');
												setBriefingScreenIndex(0);
												setShowBriefingNegativeScreen(
													false
												);
												setShowWaitingMiniGame(false);
											}}
										>
											{translate(
												'session.waitingMiniGame.tutorialCard.selfTimer.backToWaiting',
												'Back to waiting'
											)}
										</button>
									</div>
								)}
							</div>
						</div>
					)}
				{!shouldBlockAnonymousInquiryChat && (
					<div className={'message-holder'}>
						{shouldShowRobotMessages &&
							visibleRobotCards.map((card, index) => (
								<div className="messageItem" key={card._id}>
									<div className="messageItem__messageWrap">
										{index === 0 && (
											<div
												className="messageItem__systemAvatar"
												aria-hidden="true"
											>
												<NotificationBellIcon className="messageItem__systemAvatarIcon" />
											</div>
										)}
										{index !== 0 && (
											<div
												className="session__robotIncomingAvatarSpacer"
												aria-hidden="true"
											/>
										)}
										<div className="messageItem__content">
											{index === 0 && (
												<div className="messageItem__header">
													<div className="messageItem__username messageItem__username--system">
														{translate(
															'message.systemNotification',
															'System Notification'
														)}
													</div>
													<span className="messageItem__headerTime">
														5:00
													</span>
												</div>
											)}
											<div className="messageItem__message messageItem__message--systemNotification">
												{index === 0 && (
													<div className="messageItem__systemNotificationTag">
														{translate(
															'message.systemNotification',
															'System Notification'
														)}
													</div>
												)}
												<div className="messageItem__systemNotificationTitle">
													{card.title}
												</div>
												{card.playLabel ? (
													<div className="session__robotSystemActionRow">
														<div className="messageItem__systemNotificationDescription">
															{card.description}
														</div>
														<button
															type="button"
															className="session__robotSystemInlinePlayButton"
															onClick={(
																event
															) => {
																event.preventDefault();
																event.stopPropagation();
																setShowBriefingNegativeScreen(
																	false
																);
																setBriefingScreenIndex(
																	0
																);
																setWaitingGameStage(
																	'tutorial'
																);
																setShowWaitingMiniGame(
																	true
																);
															}}
														>
															{card.playLabel}
														</button>
													</div>
												) : (
													<div className="messageItem__systemNotificationDescription">
														{card.description}
													</div>
												)}
												{card.cta && (
													<button
														type="button"
														className="session__robotSystemRegistrationLink"
														onClick={(event) => {
															event.preventDefault();
															event.stopPropagation();
															history.push(
																'/registration'
															);
														}}
													>
														{card.cta}
													</button>
												)}
											</div>
										</div>
									</div>
								</div>
							))}
						{shouldShowRobotTypingIndicator && (
							<div className="messageItem session__robotTypingIndicator">
								<div className="messageItem__messageWrap">
									<div
										className="session__robotIncomingAvatarSpacer"
										aria-hidden="true"
									/>
									<div className="messageItem__content">
										<div
											className="session__robotTypingDots"
											aria-hidden="true"
										>
											<span />
											<span />
											<span />
										</div>
									</div>
								</div>
							</div>
						)}
						{/* MATRIX MIGRATION: For Matrix sessions (no rid), skip E2EE ready check */}
						{messages &&
							(ready || !activeSession.rid) &&
							messages.map((message: MessageItem, index) => (
								<React.Fragment key={`${message._id}-${index}`}>
									<MessageItemComponent
										clientName={
											getContact(activeSession)
												?.username ||
											translate(
												'sessionList.user.consultantUnknown'
											)
										}
										askerRcId={
											!activeSession.rid &&
											message.userId &&
											!message.userId.includes(
												activeSession.consultant
													?.username || ''
											)
												? message.userId
												: activeSession.item.askerRcId
										}
										isOnlyEnquiry={isOnlyEnquiry}
										isMyMessage={isMyMessageMatrix(
											message.userId
										)}
										isUserBanned={props.bannedUsers.includes(
											message.username
										)}
										handleDecryptionErrors={
											handleDecryptionErrors
										}
										handleDecryptionSuccess={
											handleDecryptionSuccess
										}
										e2eeParams={{
											key,
											keyID,
											encrypted,
											subscriptionKeyLost
										}}
										renderMode="main"
										threadsEnabled={isThreadsEnabled}
										threadSummary={threadSummaries.get(
											message._id
										)}
										onOpenThread={
											isThreadsEnabled
												? () =>
														handleOpenThread(
															message
														)
												: undefined
										}
										{...message}
									/>
								</React.Fragment>
							))}
						{shouldShowInlineTypingIndicator && (
							<div className="messageItem session__inlineTypingIndicator">
								<div className="messageItem__messageWrap">
									<div className="messageItem__avatar">
										<UserAvatar
											username={primaryTypingUser}
											displayName={primaryTypingUser}
											firstName={primaryTypingUser}
											lastName=""
											userId={`typing-${primaryTypingUser}`}
											ring={false}
										/>
									</div>
									<div className="messageItem__content">
										<div className="session__inlineTypingLabel">
											{typingIndicatorLabel}
										</div>
										<div
											className="session__inlineTypingBubble"
											aria-hidden="true"
										>
											<div className="session__inlineTypingDots">
												<span />
												<span />
												<span />
											</div>
										</div>
									</div>
								</div>
							</div>
						)}
						<div
							className={`session__scrollToBottom ${
								isScrolledToBottom
									? 'session__scrollToBottom--disabled'
									: ''
							}`}
						>
							{newMessages > 0 && (
								<span className="session__unreadCount">
									{newMessages > 99
										? translate(
												'session.unreadCount.maxValue'
											)
										: newMessages}
								</span>
							)}
							<Button
								item={scrollBottomButtonItem}
								isLink={false}
								buttonHandle={handleScrollToBottomButtonClick}
							/>
						</div>
					</div>
				)}
			</div>

			{isThreadsEnabled && activeThreadRootId && (
				<div className="session__threadPanel">
					<div className="session__threadHeader">
						<div className="session__threadTitle">
							{translate('message.thread.title', 'Thread')}
						</div>
						<button
							type="button"
							className="session__threadClose"
							onClick={handleCloseThread}
						>
							×
						</button>
					</div>
					<div className="session__threadBody">
						{activeThreadRootMessage && (
							<MessageItemComponent
								clientName={
									getContact(activeSession)?.username ||
									translate(
										'sessionList.user.consultantUnknown'
									)
								}
								askerRcId={
									!activeSession.rid &&
									activeThreadRootMessage.userId &&
									!activeThreadRootMessage.userId.includes(
										activeSession.consultant?.username || ''
									)
										? activeThreadRootMessage.userId
										: activeSession.item.askerRcId
								}
								isOnlyEnquiry={isOnlyEnquiry}
								isMyMessage={isMyMessageMatrix(
									activeThreadRootMessage.userId
								)}
								isUserBanned={props.bannedUsers.includes(
									activeThreadRootMessage.username
								)}
								handleDecryptionErrors={handleDecryptionErrors}
								handleDecryptionSuccess={
									handleDecryptionSuccess
								}
								e2eeParams={{
									key,
									keyID,
									encrypted,
									subscriptionKeyLost
								}}
								renderMode="thread"
								threadsEnabled={true}
								forceShow={true}
								{...activeThreadRootMessage}
							/>
						)}
						{messages &&
							(ready || !activeSession.rid) &&
							messages.map((message: MessageItem, index) => (
								<React.Fragment
									key={`thread-${message._id}-${index}`}
								>
									<MessageItemComponent
										clientName={
											getContact(activeSession)
												?.username ||
											translate(
												'sessionList.user.consultantUnknown'
											)
										}
										askerRcId={
											!activeSession.rid &&
											message.userId &&
											!message.userId.includes(
												activeSession.consultant
													?.username || ''
											)
												? message.userId
												: activeSession.item.askerRcId
										}
										isOnlyEnquiry={isOnlyEnquiry}
										isMyMessage={isMyMessageMatrix(
											message.userId
										)}
										isUserBanned={props.bannedUsers.includes(
											message.username
										)}
										handleDecryptionErrors={
											handleDecryptionErrors
										}
										handleDecryptionSuccess={
											handleDecryptionSuccess
										}
										e2eeParams={{
											key,
											keyID,
											encrypted,
											subscriptionKeyLost
										}}
										renderMode="thread"
										threadsEnabled={true}
										threadRootId={activeThreadRootId}
										{...message}
									/>
								</React.Fragment>
							))}
					</div>
					<div className="session__threadInput">
						<MessageSubmitInterfaceComponent
							isTyping={props.isTyping}
							className="session__submit-interface"
							placeholder={translate(
								'message.thread.placeholder',
								'Reply in thread'
							)}
							typingUsers={props.typingUsers}
							handleMessageSendSuccess={handleMessageSendSuccess}
							isSupervisor={isSupervisor}
							threadRootId={activeThreadRootId}
							threadParentPreview={
								activeThreadRootMessage
									? parseMessagePrefixes(
											activeThreadRootMessage.message
										).cleanedMessage
									: null
							}
							mobileUnreadCount={newMessages}
							mobileIsScrolledToBottom={isScrolledToBottom}
							onMobileNavigateBack={handleMobileNavigateBackClick}
							onMobileNavigateDown={
								handleMobileNavigateStepDownClick
							}
							onMobileNavigateBottom={
								handleScrollToBottomButtonClick
							}
						/>
					</div>
				</div>
			)}

			{type === SESSION_LIST_TYPES.ENQUIRY &&
				!shouldBlockAnonymousInquiryChat &&
				!isAnonymousAskerExperience && (
					<AcceptAssign btnLabel={'enquiry.acceptButton.known'} />
				)}

			{shouldShowPseudonymGate && !pseudonymConfirmed && (
				<div className="session__pseudonymActionBarSlot">
					<PseudonymActionBar
						onRegenerate={handleRegeneratePseudonym}
						onConfirm={handleConfirmPseudonym}
						disabled={pseudonymSaving}
					/>
				</div>
			)}

			{shouldShowPseudonymGate &&
				pseudonymConfirmed &&
				!consultantAccepted && (
					<div className="session__pseudonymActionBarSlot">
						<WaitingQueueActionBar
							queuePosition={queuePeopleAhead}
							onOpenCalmCompanion={handleOpenCalmCompanion}
						/>
					</div>
				)}

			{shouldShowPseudonymGate &&
				pseudonymConfirmed &&
				consultantAccepted && (
					<div className="session__pseudonymActionBarSlot">
						<ConsultantAcceptedActionBar
							onDismiss={handleDismissConsultantAccepted}
							onStartChat={handleStartAcceptedChat}
						/>
					</div>
				)}

			{canWriteMessage && !shouldBlockAnonymousInquiryChat && (
				<div
					className={clsx(
						'session__gameInputFadeTarget',
						areRobotMessagesComplete &&
							'session__gameInputFadeTarget--reveal',
						!areRobotMessagesComplete &&
							'session__gameInputFadeTarget--hidden'
					)}
				>
					{isSupervisor && (
						<div
							className="session__supervisorInputNote"
							style={{
								textAlign: 'center'
							}}
						>
							{translate(
								'session.supervisor.input.note',
								'Messages you send here are visible only to consultants.'
							)}
						</div>
					)}
					{areRobotMessagesComplete && (
						<Suspense
							fallback={
								<MessageSubmitInterfaceSkeleton
									placeholder={getPlaceholder()}
									className={clsx(
										'session__submit-interface'
									)}
								/>
							}
						>
							<MessageSubmitErrorBoundary
								onRetry={() =>
									setComposerRemountKey((key) => key + 1)
								}
							>
								<MessageSubmitInterfaceComponent
									key={composerRemountKey}
									isAnonymousLiveChat={
										isAnonymousAskerExperience &&
										waitingGateDismissed
									}
									isTyping={props.isTyping}
									className={clsx(
										'session__submit-interface',
										!isScrolledToBottom &&
											'session__submit-interface--scrolled-up',
										activeThreadRootId &&
											'session__submit-interface--withThread'
									)}
									placeholder={getPlaceholder()}
									typingUsers={props.typingUsers}
									preselectedFile={draggedFile}
									handleMessageSendSuccess={
										handleMessageSendSuccess
									}
									isSupervisor={isSupervisor}
									mobileUnreadCount={newMessages}
									mobileIsScrolledToBottom={
										isScrolledToBottom
									}
									onMobileNavigateBack={
										handleMobileNavigateBackClick
									}
									onMobileNavigateDown={
										handleMobileNavigateStepDownClick
									}
									onMobileNavigateBottom={
										handleScrollToBottomButtonClick
									}
								/>
							</MessageSubmitErrorBoundary>
						</Suspense>
					)}
					{areRobotMessagesComplete &&
						!tenantData?.settings
							?.featureAttachmentUploadDisabled && (
							<DragAndDropArea
								onFileDragged={onFileDragged}
								isDragging={isDragging}
								canDrop={isDragOverDropArea}
								onDragLeave={onDragLeave}
								styleOverride={{
									top: headerBounds.height + 'px'
								}}
							/>
						)}
				</div>
			)}

			<Dialog
				open={liveChatClosedModalOpen}
				onClose={() => setLiveChatClosedDismissed(true)}
				fullWidth
				maxWidth={false}
				PaperProps={{
					sx: {
						width: '100%',
						maxWidth: '600px',
						m: { xs: '16px', sm: '32px' },
						borderRadius: '24px'
					}
				}}
			>
				<MuiBox
					sx={{
						p: { xs: '20px', md: '24px' },
						borderRadius: '24px'
					}}
				>
					<MuiBox
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
							mb: '16px'
						}}
					>
						<MuiBox
							component="img"
							src={liveChatClosedIllustration}
							alt=""
							sx={{
								width: 72,
								height: 72,
								flexShrink: 0,
								display: 'block'
							}}
						/>
						<MuiTypography
							variant="h4"
							sx={{ fontWeight: 700, lineHeight: 1.2 }}
						>
							{translate(
								'anonymousChat.noAvailability.title',
								'Live-Chat ist zurzeit leider geschlossen'
							)}
						</MuiTypography>
					</MuiBox>

					<MuiTypography variant="body1" sx={{ mb: '16px' }}>
						{translate(
							'anonymousChat.noAvailability.subtitle',
							'Wenn Sie ohne Registrierung beraten werden möchten, kommen Sie bitte zu den Öffnungszeiten wieder.'
						)}
					</MuiTypography>

					<MuiBox
						sx={{
							border: '1px solid #DAE3F0',
							borderRadius: '12px',
							p: '8px',
							mb: '16px'
						}}
					>
						<MuiBox
							onClick={() =>
								setLiveChatClosedHintOpen((prev) => !prev)
							}
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								p: '6px',
								cursor: 'pointer'
							}}
						>
							<MuiBox
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: '4px'
								}}
							>
								<AccessTimeOutlinedIcon
									sx={{ fontSize: 16, color: '#4C555F' }}
								/>
								<MuiTypography
									sx={{
										color: '#4C555F',
										fontSize: '12px',
										lineHeight: '14px'
									}}
								>
									{translate(
										'anonymousChat.noAvailability.openingHours',
										'Reguläre Öffnungszeiten anzeigen'
									)}
								</MuiTypography>
							</MuiBox>
							<KeyboardArrowDownIcon
								sx={{
									color: '#4C555F',
									fontSize: 16,
									transform: liveChatClosedHintOpen
										? 'rotate(180deg)'
										: 'none',
									transition: 'transform 0.2s'
								}}
							/>
						</MuiBox>

						{liveChatClosedHintOpen &&
							LIVE_CHAT_OPENING_HOURS.map((entry, index) => (
								<MuiBox
									key={`live-chat-opening-hours-${index}`}
									sx={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										px: '16px',
										py: '8px'
									}}
								>
									<MuiTypography
										sx={{
											color: '#4C555F',
											fontSize: '12px',
											lineHeight: '14px'
										}}
									>
										{translate(
											`anonymousChat.noAvailability.weekdays.${entry.dayKey}`,
											entry.day
										)}
									</MuiTypography>
									<MuiTypography
										sx={{
											color: '#4C555F',
											fontSize: '12px',
											lineHeight: '14px'
										}}
									>
										{entry.time}
									</MuiTypography>
								</MuiBox>
							))}
					</MuiBox>

					<MuiTypography variant="body1" sx={{ mb: '8px' }}>
						{translate(
							'anonymousChat.noAvailability.mailHint',
							'Oder starten Sie jederzeit die anonyme Mail-Beratung: Mit Ihrer Postleitzahl finden Sie eine Beratungsstelle in Ihrer Nähe und schreiben Ihre Anfrage. Für die Antwort brauchen Sie nur eine E-Mail-Adresse - keinen echten Namen.'
						)}
					</MuiTypography>

					<MuiTypography
						variant="body2"
						sx={{ fontWeight: 700, mb: '16px' }}
					>
						{translate(
							'anonymousChat.noAvailability.tip',
							'Tipp: Nutzen Sie eine E-Mail-Adresse, auf die nur Sie Zugriff haben.'
						)}
					</MuiTypography>

					<MuiButton
						fullWidth
						variant="contained"
						onClick={() => history.push('/registration')}
						sx={{
							mb: '8px',
							borderRadius: '999px',
							py: '14px',
							backgroundColor: '#A5000A'
						}}
						startIcon={<NorthEastIcon />}
					>
						{translate(
							'anonymousChat.noAvailability.startMailCounseling',
							'anonyme Mail-Beratung starten'
						)}
					</MuiButton>

					<MuiTypography
						variant="body2"
						sx={{
							textAlign: 'center',
							color: '#4C555F',
							fontWeight: 600,
							mb: '16px'
						}}
					>
						{translate(
							'anonymousChat.noAvailability.responseTime',
							'Antwort innerhalb von 2 Werktagen'
						)}
					</MuiTypography>

					<MuiBox sx={{ display: 'flex', gap: '10px' }}>
						<MuiButton
							fullWidth
							variant="outlined"
							onClick={() => history.goBack()}
							startIcon={<ArrowBackIcon />}
							sx={{
								borderRadius: '24px',
								borderColor: 'transparent',
								backgroundColor: '#F0EDEE',
								color: '#4C555F'
							}}
						>
							{translate(
								'anonymousChat.noAvailability.back',
								'Zurück zur vorherigen Seite'
							)}
						</MuiButton>
						<MuiButton
							fullWidth
							variant="outlined"
							onClick={() => setLiveChatClosedDismissed(true)}
							startIcon={<CloseIcon />}
							sx={{
								borderRadius: '8px',
								borderColor: '#FFE2DE',
								backgroundColor: '#FFE2DE',
								color: '#A5000A'
							}}
						>
							{translate(
								'anonymousChat.noAvailability.later',
								'Später wiederkommen'
							)}
						</MuiButton>
					</MuiBox>
				</MuiBox>
			</Dialog>
		</div>
	);
};
