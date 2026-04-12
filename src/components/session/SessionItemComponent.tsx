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
import { Text } from '../text/Text';
import { EncryptionBanner } from './EncryptionBanner';
import { apiGetSessionSupervisors } from '../../api/apiGetSessionSupervisors';
import { apiPatchNotificationActiveView } from '../../api/apiPatchNotificationActiveView';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { apiGetUserData } from '../../api/apiGetUserData';
import { parseMessagePrefixes } from '../message/messageConstants';
import { decodeUsername } from '../../utils/encryptionHelpers';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import LegalLinks from '../legalLinks/LegalLinks';
import { renderToString } from 'react-dom/server';
import { mobileListView } from '../app/navigationHandler';

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
		width="157"
		height="165"
		viewBox="0 0 157 165"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M155.597 34.4881C155.031 34.2884 154.465 34.1553 153.877 34.0776C153.5 34.0111 153.112 34.0111 152.613 33.9667C152.668 33.1458 152.713 32.4136 152.768 31.6925C153.234 26.9111 152.979 22.0853 152.025 17.3814C150.583 8.85037 143.893 2.17182 135.362 0.751818C130.447 -0.235536 125.4 -0.246613 120.474 0.69635C111.843 2.28275 103.634 5.66635 96.3894 10.6253C88.3244 16.1278 81.1908 22.8839 75.2669 30.6385C74.7344 31.4039 73.9689 31.9919 73.0925 32.3247C72.5379 32.5799 72.0054 32.8683 71.495 33.2122L72.4602 34.2883C71.2731 36.141 70.0972 37.9494 68.9545 39.813C67.8229 41.6878 66.8467 43.5737 65.8149 45.4265C65.6817 45.4265 65.6041 45.4265 65.593 45.3821C65.3378 44.9051 65.0716 44.4392 64.8275 43.951C62.4757 39.0364 59.2807 34.5657 55.3979 30.7496C50.3614 25.5246 43.5829 22.3296 36.3611 21.7635C27.6968 20.8428 19.0993 23.949 13.0421 30.206C10.7124 32.6355 8.77103 35.3978 7.28457 38.4153C1.6378 49.5203 -0.458974 62.0893 1.27172 74.4152C1.56015 75.4691 1.32719 76.6006 0.639367 77.4437C-0.425633 78.6308 -0.148276 79.4628 1.38265 79.9731C2.04829 80.1617 2.5253 80.7275 2.62515 81.4042C3.40172 84.0556 4.15608 86.7292 5.13233 89.3142C8.4273 97.812 12.9866 105.766 18.6666 112.9C27.3198 123.905 37.1709 133.9 48.055 142.708C51.1057 145.215 54.3339 147.512 57.5178 149.808C59.0266 150.929 60.7461 151.75 62.5765 152.227C64.063 152.637 65.6272 152.637 67.1139 152.227C67.8017 152.016 68.5006 151.683 68.4785 150.862C68.4563 150.041 67.6686 149.864 67.0696 149.819H67.0585C66.171 149.708 65.3389 149.309 64.6955 148.699L61.5559 146.203C61.2785 145.981 61.0123 145.748 60.7017 145.482L60.6906 145.493C61.8665 145.681 63.0535 145.759 64.2406 145.737C65.472 145.559 66.6701 145.226 67.7906 144.716C71.7399 142.886 75.5452 140.756 79.1617 138.348C79.3724 138.171 79.561 137.971 79.7163 137.76C79.4612 137.572 79.1838 137.405 78.8954 137.283C78.0301 137.061 77.0982 137.206 76.3216 137.66C74.0253 138.903 71.6956 140.112 69.377 141.333C68.9444 141.565 68.4784 141.721 68.0346 141.921C77.9746 132.934 88.7911 124.98 100.328 118.169C100.084 118.69 99.7736 119.189 99.4075 119.633C89.8668 131.947 79.6939 143.762 68.9229 155.011C66.7708 157.252 64.7515 159.637 62.7547 162.022C61.7563 163.209 62.0558 163.919 63.5202 164.385V164.396C63.7532 164.463 63.9972 164.518 64.2413 164.563C66.1162 164.896 68.0577 164.419 69.5663 163.243C73.2273 160.458 76.6552 157.374 79.7949 154.013C94.8713 138.126 108.749 121.143 121.318 103.202C128.175 93.6948 134.331 83.6994 139.745 73.3055C144.959 63.4209 148.809 52.8709 151.194 41.9434C151.338 40.0686 152.514 38.4377 154.245 37.7056C154.866 37.3949 155.443 36.9956 155.953 36.5186C156.929 35.742 156.806 35.0206 155.597 34.4881ZM86.8263 27.3327C93.8263 18.8792 102.635 12.112 112.597 7.5081C116.325 5.77746 120.274 4.57949 124.334 3.93595C126.531 3.56984 128.783 3.56984 130.979 3.93595C135.028 4.69031 138.523 7.26414 140.442 10.9138C141.818 13.3877 142.75 16.0835 143.182 18.8792C141.019 19.8221 138.978 20.8317 136.859 21.6193C119.397 28.1314 102.236 35.3868 85.4291 43.4518H85.4402C84.5416 43.9067 83.5876 44.2506 82.6113 44.4946C82.811 44.2728 83.0329 44.062 83.2548 43.8623C98.3976 31.9144 114.461 21.1755 131.291 11.7447C131.978 11.3564 132.711 11.0347 133.387 10.6243H133.376C133.798 10.358 134.186 10.0474 134.563 9.71458C134.397 9.07115 133.853 8.59412 133.188 8.49426C131.657 8.05052 130.004 8.21692 128.584 8.96019C125.533 10.48 122.504 12.0552 119.431 13.5309C109.968 18.0905 100.461 22.6498 90.6648 26.5438C89.4334 27.0319 88.1687 27.4756 86.9151 27.9305C86.8486 27.9638 86.7376 27.8972 86.5712 27.8528C86.6378 27.6753 86.7265 27.4991 86.8263 27.3327ZM79.7263 36.9953C80.8135 35.2868 81.9783 33.6228 83.1763 31.992V32.0031C83.5424 31.4928 84.0527 31.1045 84.6407 30.8716C89.1892 29.2186 93.7486 27.6322 98.3193 26.0347C98.5522 25.9349 98.8074 25.9016 99.0625 25.9238C91.4411 31.2488 83.8975 36.6738 76.7862 42.6531L76.4866 42.4312C77.5294 40.6341 78.5612 38.7926 79.6927 37.0176L79.7263 36.9953ZM72.7816 50.4742C72.9813 50.4076 73.0812 50.341 73.1699 50.3521C75.8768 50.7404 78.6392 50.3522 81.1463 49.2317C86.0388 47.2348 90.8867 45.1603 95.7457 43.0856C98.3749 41.9541 100.971 40.7227 103.578 39.5689C104.055 39.3359 104.576 39.1806 105.12 39.114L69.7959 60.5583V60.5694C70.4394 57.108 71.4392 53.7246 72.7816 50.4742ZM60.7781 62.3445C60.7115 62.877 60.7115 63.4317 60.7781 63.9642C61.0222 64.8295 61.3106 65.6726 61.6434 66.4936C61.122 66.9151 60.5562 67.2923 59.9683 67.603C49.174 72.4954 38.7126 78.0865 28.1943 83.5337C26.9851 84.166 25.7426 84.7207 24.5112 85.3086L24.3115 85.0757V85.0646C24.6443 84.6097 24.9882 84.1549 25.3654 83.7334C27.9724 81.0376 30.5239 78.2752 33.2418 75.6905C40.9186 68.2022 49.1393 61.2797 57.8144 54.9783L59.4784 53.7913L59.4895 53.8024C60.2994 56.5758 60.7337 59.4492 60.7781 62.3445ZM50.8824 36.4184C50.8047 36.5849 50.7715 36.7069 50.716 36.7291C46.4117 38.3599 42.2514 40.3123 38.2467 42.5755C30.1817 46.9909 22.1831 51.5059 14.151 55.988C13.3411 56.4428 12.5091 56.8644 11.5218 57.3969H11.5329C21.95 47.5233 33.0658 38.4155 44.7921 30.1394C47.0553 31.9921 49.0963 34.0999 50.8824 36.4184ZM14.8601 40.1792C16.6795 36.0524 19.4308 32.4135 22.8919 29.5292C25.6764 27.1995 29.1155 25.7795 32.7319 25.4578C35.6162 25.3135 38.4673 26.0346 40.9302 27.5434C41.0522 27.6321 41.1631 27.7209 41.2519 27.8318C41.2852 27.8651 41.2852 27.9317 41.3517 28.1203C32.4767 32.0917 23.9457 36.8399 14.8488 40.756C14.8599 40.4232 14.8157 40.279 14.8601 40.1792ZM11.1105 50.5296C11.8538 48.1666 12.6303 45.8481 13.3847 43.496H13.3736C13.5955 42.7749 14.1169 42.1981 14.8047 41.9207C23.1693 38.0379 31.534 34.1328 39.8876 30.2168C40.3868 29.9616 40.9304 29.8174 41.4962 29.773C41.2743 30.0171 41.0302 30.2389 40.7751 30.4497C38.5896 31.9807 36.4151 33.5226 34.2187 35.0204C26.2976 40.3233 18.6986 46.0919 11.4654 52.2933C11.2546 52.4708 11.0217 52.604 10.5668 52.9257C10.7776 51.9383 10.8886 51.2174 11.1105 50.5296ZM9.36876 68.446V61.8453C9.36876 61.5568 9.74594 61.1685 10.0455 61.0021C19.708 55.5218 29.3708 50.0414 39.0334 44.5835C39.699 44.1952 40.4201 43.8957 41.1522 43.6849C30.1694 51.3728 19.6415 59.6931 9.61404 68.5903L9.36876 68.446ZM10.3894 73.6156L10.7 73.305V73.2939C20.0076 64.2857 29.8368 55.8214 40.131 47.9557C44.2024 44.9161 48.4181 42.0428 52.7445 39.0142L52.7334 39.0032C55.2295 42.6531 57.1931 46.6357 58.5577 50.8403C49.472 54.4789 40.6524 58.7835 32.1877 63.6978C25.5313 67.2478 18.8199 70.7646 12.1413 74.2924C11.5755 74.592 10.9543 74.8138 10.3663 75.1023C9.88928 74.5143 9.91146 74.0706 10.3774 73.6046L10.3894 73.6156ZM10.7222 78.1307C20.629 73.671 29.9587 68.2128 39.6647 63.3428C39.3873 63.6201 39.1321 63.9307 38.8437 64.1637C34.5283 68.0909 30.1462 71.9405 25.9195 75.9563C23.4566 78.3192 21.1823 80.8819 18.9305 83.4223V83.4112C18.1872 84.2766 17.566 85.2306 17.0667 86.2512C16.4011 87.5603 16.7783 88.4145 18.1429 88.9581V88.9692C19.9067 89.6681 21.8704 89.7014 23.6564 89.0468C25.62 88.3923 27.5282 87.5936 29.3918 86.6839C34.5615 84.0879 39.6647 81.3589 44.8232 78.7518C48.4732 76.8991 52.1672 75.1018 55.8504 73.2936H55.8393C56.2719 73.0606 56.749 72.9275 57.2371 72.9053C50.9692 77.5092 44.6568 82.0688 38.4553 86.7614C32.0543 91.3653 26.0857 96.546 20.6389 102.248C15.9907 94.8153 12.6403 86.6614 10.721 78.1192L10.7222 78.1307ZM23.5465 106.798C24.079 105.922 24.6781 105.089 25.3215 104.291C26.9856 102.471 28.7494 100.73 30.6022 99.0989C36.3597 94.2843 42.1619 89.5028 48.0415 84.8435C52.8008 81.0607 57.7041 77.4661 62.5301 73.7721C63.1735 73.3172 63.8946 72.9955 64.649 72.8069C66.8455 72.2411 69.0089 71.5201 71.1054 70.6658C79.0597 67.1823 86.9361 63.4883 94.9126 60.0158C105.196 55.5783 115.569 51.3072 125.908 46.9584C126.541 46.6699 127.217 46.4813 127.916 46.4148C127.484 46.6477 127.062 46.9029 126.629 47.1248C112.651 54.2912 98.7066 61.5355 85.0944 69.3676C75.1212 75.1141 65.2255 80.9827 55.3199 86.8626C53.0789 88.205 50.9823 89.7801 48.8078 91.2779C48.3751 91.5997 47.9757 91.9658 47.6318 92.3873C46.9551 93.2305 47.1326 94.007 48.1532 94.362C48.8632 94.5506 49.5954 94.6504 50.3276 94.6615C50.7935 94.6837 51.2594 94.6837 51.7254 94.6615C51.6366 94.7503 51.5368 94.839 51.4259 94.9056C44.0041 98.4999 36.638 102.205 28.9387 105.19C27.5964 105.7 26.2319 106.121 24.8673 106.565C24.4347 106.665 23.9903 106.742 23.5465 106.798ZM45.9004 132.058C38.3012 125.213 31.4676 117.581 25.499 109.272C25.7875 109.183 26.0426 109.105 26.2978 109.039C31.2456 107.652 36.0603 105.811 40.6863 103.559C54.0542 97.3792 67.3557 91.056 80.7445 84.9432C90.8067 80.3503 101.002 76.0128 111.141 71.5753C111.729 71.3201 112.328 71.1094 112.916 70.8875L113.049 71.1315L110.886 72.4073C88.4323 85.3427 66.6984 99.5094 45.8102 114.84C44.0352 116.149 42.2602 117.547 40.5405 118.933C40.0413 119.344 39.5865 119.799 39.1871 120.309C38.6435 121.03 38.7322 121.618 39.5532 122.017V122.006C40.3076 122.361 41.1174 122.594 41.9495 122.694C43.3362 122.838 44.734 122.594 45.9877 121.984C48.3506 120.93 50.6691 119.865 52.9766 118.734C71.592 109.659 90.4731 101.183 109.62 93.2959C110.197 93.0296 110.819 92.8743 111.451 92.841C110.819 93.2182 110.197 93.6065 109.565 93.9615C98.2714 100.396 86.9449 106.775 75.6951 113.287C66.8201 118.445 57.9451 123.682 49.4805 129.517C48.2713 130.349 47.0842 131.225 45.8973 132.057L45.9004 132.058ZM84.2859 122.595C77.2523 127.266 70.563 132.447 64.2838 138.104C63.0967 139.214 61.9874 140.412 60.9666 141.688C60.1013 142.509 59.8129 143.762 60.2345 144.872L59.8906 144.938L50.716 136.984C62.9745 132.136 74.4456 126.212 86.3494 121.208L84.2859 122.595ZM117.244 95.1051C114.559 98.9547 111.864 102.793 109.19 106.643V106.631C108.769 107.253 108.17 107.719 107.471 107.974C91.6399 114.164 76.2533 121.342 60.8548 128.52C60.2669 128.797 59.6456 129.063 59.0355 129.34L58.9024 129.052C77.917 116.461 97.8757 105.456 117.92 93.8616C117.599 94.4828 117.454 94.8157 117.244 95.1152L117.244 95.1051ZM140.863 46.4587V46.4476C139.032 53.3258 136.603 60.0376 133.618 66.494C130.634 72.9505 127.284 79.2408 123.567 85.309C123.201 85.9525 122.525 86.3519 121.792 86.3408C120.117 86.5293 118.475 86.8733 116.867 87.3503C108.624 89.9684 100.526 93.0303 92.6156 96.5249C82.5535 100.896 72.547 105.4 62.5173 109.815C62.007 110.07 61.4745 110.248 60.9087 110.326C61.1971 110.082 61.4967 109.815 61.774 109.593C80.3226 96.5248 99.1058 83.8227 118.864 72.6081C122.691 70.4337 126.43 68.1263 130.19 65.852L130.202 65.8631C131.011 65.375 131.766 64.8092 132.454 64.1768C133.319 63.3559 133.141 62.657 132.01 62.1467C130.723 61.5698 129.292 61.4589 127.938 61.8028C126.496 62.1578 125.087 62.6016 123.701 63.1452C100.204 72.5084 76.9854 82.548 54.2086 93.553C53.4431 93.9302 52.6555 94.2298 51.8678 94.5626H51.8789C52.4669 93.9302 53.1214 93.3534 53.8314 92.8541C60.3214 89.0602 66.8221 85.2992 73.3564 81.5717C95.1778 69.1577 117.243 57.1988 139.543 45.6826C139.975 45.4607 140.419 45.2499 141.162 44.8949C141.04 45.5828 140.996 46.0376 140.863 46.4703L140.863 46.4587ZM143.137 35.7201L143.126 35.709C143.081 36.652 142.405 37.4507 141.484 37.6393C126.485 42.7979 111.607 48.2893 97.0322 54.5351C91.0083 57.131 85.0287 59.86 79.0383 62.5447L77.4297 63.2658C77.585 62.6446 77.8513 62.0455 78.1952 61.4908C78.7055 61.0359 79.2823 60.6366 79.8925 60.3149C99.6393 47.7013 119.63 35.5092 140.242 24.3491C141.285 23.7611 142.339 23.2619 143.637 22.5741C143.693 23.3285 143.748 23.7944 143.77 24.2825V24.2715C143.87 28.0989 143.659 31.9372 143.127 35.7314L143.137 35.7201Z"
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
	const [stageMessage, setStageMessage] = useState(
		'Let us get you grounded with one easy round.'
	);
	const [typedText, setTypedText] = useState('');
	const [typewriterBusy, setTypewriterBusy] = useState(false);
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
	const [
		anonymousInquiryConsentAccepted,
		setAnonymousInquiryConsentAccepted
	] = useState(false);
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
		waitingGameStage === 'practice' || waitingGameStage === 'game';
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
		waitingGameStage === 'practice' || waitingGameStage === 'game';
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
	const shouldBlockAnonymousInquiryChat =
		requiresAnonymousInquiryConsent && !anonymousInquiryConsentAccepted;
	const shouldShowRobotMessages =
		isAnonymousBreathingGameAvailable && !shouldBlockAnonymousInquiryChat;
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
		setStageMessage(
			translate(
				'session.waitingMiniGame.firstTryInstruction',
				'First try: follow inhale, hold, and exhale.'
			)
		);
		setWaitingGameStage('practice');
		startPhase('inhale', STANDARD_PRACTICE_TIMING);
	}, [startPhase, translate]);

	const startAchieverGame = useCallback(() => {
		setCurrentLevel(1);
		setBreathCycles(0);
		setJoinPromptEscalated(false);
		setStageMessage(BREATH_LEVELS[0].success);
		setWaitingGameStage('game');
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
			// For Matrix sessions, check if sender matches current user's Matrix user ID
			// Matrix room IDs start with '!' and Matrix user IDs start with '@'
			const isMatrixSession =
				activeSession.rid?.startsWith('!') ||
				messageUserId?.includes('@');

			if (isMatrixSession && messageUserId?.includes('@')) {
				// Get current user's Matrix user ID from localStorage or cookie (rc_uid stores Matrix ID for Matrix sessions)
				const myMatrixUserId =
					localStorage.getItem('matrix_user_id') ||
					(typeof document !== 'undefined' &&
						document.cookie
							.split('; ')
							.find((row) => row.startsWith('rc_uid='))
							?.split('=')[1]);

				// Compare full Matrix user IDs (e.g., @username:domain)
				// This works for both normal and anonymous users
				if (myMatrixUserId && messageUserId) {
					return myMatrixUserId === messageUserId;
				}
			}
			// For RocketChat sessions, use the standard check
			return isMyMessage(messageUserId);
		},
		[activeSession.rid]
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
		const canWrite = type !== SESSION_LIST_TYPES.ENQUIRY;
		// console.log('🔥 SessionItemComponent: canWriteMessage =', canWrite, '(type:', type, ', isGroup:', activeSession.isGroup, ', isSupervisor:', isSupervisor, ')');
		setCanWriteMessage(canWrite);
	}, [type, userData, activeSession, activeSession.isGroup, isSupervisor]);

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
				const typedChar = line.charAt(charIndex - 1);
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
					Math.max(
						TYPEWRITER_TIMING.charForwardMs +
							getPunctuationPauseMs(typedChar),
						18
					)
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
				TYPEWRITER_TIMING.charBackwardMs
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
		const typingDelay =
			briefingScreenIndex <= 1
				? TYPEWRITER_TIMING.charForwardSlowMs
				: TYPEWRITER_TIMING.charForwardMs;
		const initialDelay =
			briefingScreenIndex <= 1
				? TYPEWRITER_TIMING.initialDelaySlowMs
				: TYPEWRITER_TIMING.initialDelayMs;
		setBriefingTypewriterBusy(true);
		setBriefingTypedText('');

		const tick = () => {
			index += 1;
			setBriefingTypedText(fullText.slice(0, index));
			const typedChar = fullText.charAt(index - 1);
			if (index >= fullText.length) {
				setBriefingTypewriterBusy(false);
				return;
			}
			briefingTypewriterRef.current = window.setTimeout(
				tick,
				typingDelay + getPunctuationPauseMs(typedChar)
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
			briefingTypewriterBusy
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
			const typedChar = fullText.charAt(index - 1);
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
				TYPEWRITER_TIMING.charForwardMs +
					getPunctuationPauseMs(typedChar)
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
				const firstUnreadItem = Array.from(
					scrollContainer.querySelectorAll('.messageItem')
				).pop();
				const lastReadDivider = document.createElement('div');
				lastReadDivider.innerHTML = translate(
					'session.divider.lastRead'
				);
				lastReadDivider.className =
					'messageItem__divider messageItem__divider--lastRead';
				firstUnreadItem.prepend(lastReadDivider);
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
		if (newMessages > 0) {
			const scrollContainer = scrollContainerRef.current;
			const sessionHeader =
				scrollContainer.parentElement.getElementsByClassName(
					'sessionInfo'
				)[0] as HTMLElement;
			const messageItems = scrollContainer.querySelectorAll(
				'.messageItem:not(.messageItem--right)'
			);
			const firstUnreadItem = messageItems[
				messageItems.length - newMessages
			] as HTMLElement;
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

		// MATRIX MIGRATION: Refresh messages after sending for Matrix sessions
		if (!activeSession.rid && props.refreshMessages) {
			// console.log('🔄 MATRIX: Refreshing messages after send...');
			setTimeout(() => {
				props.refreshMessages();
			}, 500); // Small delay to ensure message is processed
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
					shouldBlockAnonymousInquiryChat &&
						'session__content--consentGate'
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
				{shouldBlockAnonymousInquiryChat && (
					<div className="session__anonymousInquiryConsent waitingRoom">
						<WaitingRoomContent
							headlineKey="videoConference.waitingroom.dataProtection.headline"
							sublineKey="videoConference.waitingroom.dataProtection.subline"
							textKey="videoConference.waitingroom.dataProtection.description"
							Illustration={<WelcomeIllustration />}
						>
							<Text
								type="standard"
								text={anonymousInquiryConsentLabel}
							/>
							<Button
								className="waitingRoom__button"
								buttonHandle={
									handleAnonymousInquiryConsentAccept
								}
								item={{
									label: translate(
										'videoConference.waitingroom.dataProtection.button',
										'Bestätigen'
									),
									type: BUTTON_TYPES.PRIMARY
								}}
							/>
						</WaitingRoomContent>
					</div>
				)}
				{!shouldBlockAnonymousInquiryChat && (
					<div className="session__gameChromeFadeTarget">
						<EncryptionBanner />
					</div>
				)}
				{!shouldBlockAnonymousInquiryChat &&
					isAnonymousBreathingGameAvailable &&
					showWaitingMiniGame && (
						<div
							className="session__waitingPopupBackdrop"
							role="dialog"
							aria-modal="true"
						>
							<div
								className={clsx(
									'session__waitingModule',
									'session__waitingModule--popup',
									(isBriefingOnlyScreen ||
										isPreGameSetupScreen ||
										isTextOnlyStage) &&
										'session__waitingModule--briefing'
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
								{waitingGameStage === 'game' && (
									<div className="session__waitingGameStatus">
										<span
											className="session__waitingGameStatusIcon"
											aria-hidden="true"
										>
											<PersonCircleIcon />
										</span>
										<span
											className={clsx(
												'session__waitingTypewriterText',
												gameStatusTypewriterBusy &&
													'session__waitingTypewriterText--busy'
											)}
										>
											{gameStatusTypewriterBusy
												? gameStatusTypedText
												: stageMessage}
										</span>
									</div>
								)}
								{isBreathingArenaVisible && (
									<div className="session__waitingMiniGameArena session__waitingMiniGameArena--breathing">
										<div className="session__waitingMiniGameSingle">
											<div className="session__waitingMiniGamePhaseSeconds">
												{phaseSecondsLeft}s
											</div>
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
								{waitingGameStage === 'game' && (
									<div className="session__waitingGameLevelBadge">
										<span
											className="session__waitingGameLevelBadgeIcon"
											aria-hidden="true"
										>
											<LevelEmojiIcon
												level={currentLevel}
												className="session__waitingGameLevelBadgeEmoji"
											/>
										</span>
										<span className="session__waitingGameLevelBadgeText">
											{levelBadgeTypedText}
										</span>
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
										(waitingGameStage === 'completion' ||
											waitingGameStage === 'prize' ||
											waitingGameStage === 'serenity') &&
											'session__waitingModuleTypewriter--centerStage',
										(isPreGameSetupScreen ||
											isBreathingArenaVisible) &&
											'session__waitingModuleTypewriter--hidden'
									)}
								>
									{waitingGameStage === 'tutorial' ? (
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
													'session__waitingTypewriterText',
													briefingTypewriterBusy &&
														'session__waitingTypewriterText--busy'
												)}
											>
												{briefingTypewriterBusy
													? briefingTypedText
													: currentBriefingScreen.text}
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
									  waitingGameStage === 'serenity' ? (
										<div
											className={clsx(
												'session__waitingCenterStageText',
												'session__waitingTypewriterText',
												centerStageTypewriterBusy &&
													'session__waitingTypewriterText--busy'
											)}
										>
											{centerStageTypedText}
										</div>
									) : typewriterBusy ? (
										typedText
									) : isPreGameSetupScreen ? null : (
										stageMessage
									)}
								</div>
								{waitingGameStage === 'completion' &&
									!centerStageTypewriterBusy && (
										<div
											className="session__waitingCompletionHeart"
											aria-hidden="true"
										>
											{COMPLETION_HEART_ICON}
										</div>
									)}
								<div
									className={clsx(
										'session__waitingModuleActions',
										isNegativeBriefingScreen &&
											'session__waitingModuleActions--negative'
									)}
								>
									{waitingGameStage === 'tutorial' && (
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
									{waitingGameStage === 'completion' &&
										!centerStageTypewriterBusy && (
											<>
												<button
													type="button"
													className="session__waitingModuleActionButton session__waitingModuleActionButton--ghost"
													onClick={startAchieverGame}
												>
													{translate(
														'session.waitingMiniGame.repeatGame',
														'Repeat game'
													)}
												</button>
												<button
													type="button"
													className="session__waitingModuleActionButton session__waitingModuleActionButton--primary"
													onClick={() =>
														setWaitingGameStage(
															'prize'
														)
													}
												>
													{translate(
														'session.waitingMiniGame.receivePrize',
														'Receive your price'
													)}
												</button>
											</>
										)}
									{waitingGameStage === 'serenity' &&
										!centerStageTypewriterBusy && (
											<button
												type="button"
												className="session__waitingModuleActionButton session__waitingModuleActionButton--ghost"
												onClick={() => {
													setWaitingGameStage(
														'practiceResult'
													);
													setCurrentLevel(1);
													setBreathCycles(0);
													setStageMessage(
														translate(
															'session.waitingMiniGame.practiceSuccessPrompt',
															'Great job, want to start now?'
														)
													);
												}}
											>
												{translate(
													'session.waitingMiniGame.playAgain',
													'Play again'
												)}
											</button>
										)}
									{isJoinRoomAvailable && (
										<button
											type="button"
											className={clsx(
												'session__breathingJoinButton',
												joinPromptEscalated &&
													'session__breathingJoinButton--urgent'
											)}
											onClick={() =>
												setShowWaitingMiniGame(false)
											}
										>
											{translate(
												'session.waitingMiniGame.joinRoom',
												'Join the room'
											)}
										</button>
									)}
								</div>
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
				!shouldBlockAnonymousInquiryChat && (
					<AcceptAssign btnLabel={'enquiry.acceptButton.known'} />
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
							<MessageSubmitInterfaceComponent
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
								mobileIsScrolledToBottom={isScrolledToBottom}
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
		</div>
	);
};
