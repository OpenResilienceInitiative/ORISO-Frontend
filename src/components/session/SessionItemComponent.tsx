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
import { useLocation } from 'react-router-dom';
import { RocketChatUsersOfRoomProvider } from '../../globalState/provider/RocketChatUsersOfRoomProvider';
import './session.styles';
import { useDebouncedCallback } from 'use-debounce';
import { ReactComponent as ArrowDoubleDownIcon } from '../../resources/img/icons/arrow-double-down.svg';
import { ReactComponent as PersonCircleIcon } from '../../resources/img/icons/person-circle.svg';
import breathLevelEmojiSprite from '../../resources/img/icons/breath-level-emojis.svg';
import smoothScroll from './smoothScrollHelper';
import { DragAndDropArea } from '../dragAndDropArea/DragAndDropArea';
import useMeasure from 'react-use-measure';
import { AcceptAssign } from './AcceptAssign';
import { useTranslation } from 'react-i18next';
import useDebounceCallback from '../../hooks/useDebounceCallback';
import { apiPostError, TError } from '../../api/apiPostError';
import { useE2EE } from '../../hooks/useE2EE';
import { MessageSubmitInterfaceSkeleton } from '../messageSubmitInterface/messageSubmitInterfaceSkeleton';
import { EncryptionBanner } from './EncryptionBanner';
import { apiGetSessionSupervisors } from '../../api/apiGetSessionSupervisors';
import { apiPatchNotificationActiveView } from '../../api/apiPatchNotificationActiveView';
import { parseMessagePrefixes } from '../message/messageConstants';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';

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
	{ level: 2, title: 'Breath Finder', emoji: '😤', success: 'You found a rhythm.' },
	{ level: 3, title: 'Breath Director', emoji: '😌', success: 'Great control.' },
	{ level: 4, title: 'Calm Builder', emoji: '😌', success: 'Flow is improving.' },
	{ level: 5, title: 'Inner Balance', emoji: '🙂', success: 'Breathing stays smooth.' },
	{ level: 6, title: 'Rhythm Keeper', emoji: '🙂', success: 'Strong focus.' },
	{ level: 7, title: 'Peace Crafter', emoji: '😇', success: 'You stay centered.' },
	{ level: 8, title: 'Silent Navigator', emoji: '😇', success: 'Calm under pressure.' },
	{ level: 9, title: 'Stillness Master', emoji: '🤍', success: 'Almost complete.' },
	{ level: 10, title: 'True Wisdom', emoji: '🤍', success: 'You mastered this round.' }
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
		autoAdvanceMs: 2600
	},
	{
		title: '',
		text: '1. Breath in through the nose\n\n2. Hold your breath\n\n3. Breath out through your mouth',
		interaction: 'auto',
		autoAdvanceMs: 3000
	}
];

const BRIEFING_NEGATIVE_SCREEN = {
	title: '',
	text: 'Okay please hold on once a counsellor is free we let you in.',
	interaction: 'negative' as const
};
const LEVEL_EMOJI_VIEWBOX_OFFSETS = [0, 240, 459, 678, 878, 1075, 1299, 1520, 1739, 1983];

const LevelEmojiIcon = ({
	level,
	className
}: {
	level: number;
	className?: string;
}) => {
	const yOffset = LEVEL_EMOJI_VIEWBOX_OFFSETS[Math.max(0, Math.min(9, level - 1))];
	return (
		<svg
			className={className}
			viewBox={`0 ${yOffset} 121 120`}
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<image href={breathLevelEmojiSprite} x="0" y="0" width="121" height="2348" />
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

export const SessionItemComponent = (props: SessionItemProps) => {
	const { t: translate } = useTranslation();
	const tenantData = useTenant();

	const { activeSession } = useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);
	const { addEventNotification } = useContext(NotificationsContext);
	const { type } = useContext(SessionTypeContext);
	const location = useLocation();
	const isEmbeddedNotificationsView =
		new URLSearchParams(location.search).get('embeddedNotifications') ===
		'1';
	const [isSupervisor, setIsSupervisor] = useState(false);
	const [showWaitingMiniGame, setShowWaitingMiniGame] = useState(true);
	const [breathPhase, setBreathPhase] = useState<BreathPhase>('inhale');
	const [phaseTotalMs, setPhaseTotalMs] = useState(0);
	const [phaseMsLeft, setPhaseMsLeft] = useState(0);
	const [breathCycles, setBreathCycles] = useState(0);
	const [breathProgress, setBreathProgress] = useState(0.2);
	const [selectedPresetId, setSelectedPresetId] = useState<BreathPresetId>('starter334');
	const [customTiming, setCustomTiming] = useState<BreathTiming>({
		inhale: DEFAULT_BREATH_PHASE_SECONDS,
		hold: DEFAULT_BREATH_PHASE_SECONDS,
		exhale: DEFAULT_BREATH_PHASE_SECONDS
	});
	const [waitingGameStage, setWaitingGameStage] = useState<WaitingGameStage>('tutorial');
	const [currentLevel, setCurrentLevel] = useState(1);
	const [briefingScreenIndex, setBriefingScreenIndex] = useState(0);
	const [showBriefingNegativeScreen, setShowBriefingNegativeScreen] = useState(false);
	const [stageMessage, setStageMessage] = useState(
		'Let us get you grounded with one easy round.'
	);
	const [typedText, setTypedText] = useState('');
	const [typewriterBusy, setTypewriterBusy] = useState(false);
	const [briefingTypedText, setBriefingTypedText] = useState('');
	const [briefingTypewriterBusy, setBriefingTypewriterBusy] = useState(false);
	const [gameStatusTypedText, setGameStatusTypedText] = useState('');
	const [gameStatusTypewriterBusy, setGameStatusTypewriterBusy] = useState(false);
	const [levelBadgeTypedText, setLevelBadgeTypedText] = useState('');
	const [levelBadgeTypewriterBusy, setLevelBadgeTypewriterBusy] = useState(false);
	const [centerStageTypedText, setCenterStageTypedText] = useState('');
	const [centerStageTypewriterBusy, setCenterStageTypewriterBusy] = useState(false);
	const [joinPromptEscalated, setJoinPromptEscalated] = useState(false);
	const timerRef = useRef<number | null>(null);
	const phaseTransitionLockRef = useRef(false);
	const typewriterRef = useRef<number | null>(null);
	const briefingTypewriterRef = useRef<number | null>(null);
	const gameStatusTypewriterRef = useRef<number | null>(null);
	const levelBadgeTypewriterRef = useRef<number | null>(null);
	const centerStageTypewriterRef = useRef<number | null>(null);
	const cueAudioContextRef = useRef<AudioContext | null>(null);

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
	const chatType: 'anonymous' | 'oneOnOne' | 'group' | 'supervision' = isSupervisor
		? 'supervision'
		: activeSession.isGroup
			? 'group'
			: isAnonymousChat
				? 'anonymous'
				: 'oneOnOne';
	const isAnonymousBreathingGameAvailable =
		isAnonymousChat && hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData);
	const isJoinRoomAvailable = Boolean(activeSession.consultant?.id);
	const selectedPreset = useMemo(
		() =>
			BREATHING_PRESETS.find((preset) => preset.id === selectedPresetId) ||
			BREATHING_PRESETS[0],
		[selectedPresetId]
	);
	const phaseSecondsLeft = Math.max(0, Math.ceil(phaseMsLeft / 1000));
	const isBreathTimerRunning = waitingGameStage === 'practice' || waitingGameStage === 'game';
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
	const circleFillProgressPercent = `${Math.round(Math.max(20, breathProgress * 100))}%`;
	const circleMidScale = (0.72 + breathProgress * 0.32).toFixed(3);
	const circleInnerScale = (0.78 + breathProgress * 0.22).toFixed(3);
	const localizedBriefingScreens = useMemo(
		() =>
			BRIEFING_SCREENS.map((screen, index) => ({
				...screen,
				text: translate(`session.waitingMiniGame.briefing.${index}`, screen.text)
			})),
		[translate]
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
	const currentBriefingInteraction =
		showBriefingNegativeScreen ? 'negative' : currentBriefingScreen.interaction;
	const isBriefingOnlyScreen = waitingGameStage === 'tutorial';
	const isInitialSetupScreen = waitingGameStage === 'setup';
	const isPreGameSetupScreen = isInitialSetupScreen || waitingGameStage === 'practiceResult';
	const isBreathingArenaVisible =
		waitingGameStage === 'practice' ||
		waitingGameStage === 'game';
	const isTextOnlyStage =
		waitingGameStage === 'tutorial' ||
		waitingGameStage === 'completion' ||
		waitingGameStage === 'prize' ||
		waitingGameStage === 'serenity';
	const isNegativeBriefingScreen =
		waitingGameStage === 'tutorial' && currentBriefingInteraction === 'negative';
	const shouldLockScroll = waitingGameStage === 'practice' || waitingGameStage === 'game';

	const getAchievementMessage = useCallback((level: number) => {
		const levelSafe = Math.max(1, Math.min(BREATH_LEVELS.length, level));
		const meta = BREATH_LEVELS[levelSafe - 1];
		return translate('session.waitingMiniGame.achievementUnlocked', {
			defaultValue: 'Achievement unlocked: Level {{level}} {{emoji}} {{title}}.',
			level: levelSafe,
			emoji: meta.emoji,
			title: meta.title
		});
	}, [translate]);

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

	const playBreathCue = useCallback((phase: BreathPhase) => {
		if (typeof window === 'undefined') {
			return;
		}
		try {
			const context =
				cueAudioContextRef.current ||
				new (window.AudioContext ||
					(window as any).webkitAudioContext)();
			cueAudioContextRef.current = context;
			const oscillator = context.createOscillator();
			const gain = context.createGain();
			const frequencies: Record<BreathPhase, number> = {
				inhale: 352,
				hold: 293,
				exhale: 220
			};
			oscillator.type = 'sine';
			oscillator.frequency.value = frequencies[phase];
			gain.gain.value = 0.0001;
			oscillator.connect(gain);
			gain.connect(context.destination);
			const now = context.currentTime;
			gain.gain.exponentialRampToValueAtTime(0.04, now + 0.015);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
			oscillator.start(now);
			oscillator.stop(now + 0.3);
		} catch (error) {
			// Ignore audio failures so the game works muted.
		}
	}, []);

	const startPhase = useCallback(
		(phase: BreathPhase) => {
			phaseTransitionLockRef.current = false;
			const durationMs =
				(phase === 'inhale'
					? customTiming.inhale
					: phase === 'hold'
						? customTiming.hold
						: customTiming.exhale) * 1000;
			setBreathPhase(phase);
			setPhaseTotalMs(durationMs);
			setPhaseMsLeft(durationMs);
			setBreathProgress(phase === 'exhale' ? 1 : 0.2);
			playBreathCue(phase);
		},
		[customTiming, playBreathCue]
	);

	const updateTiming = useCallback((phase: keyof BreathTiming, delta: number) => {
		setCustomTiming((prev) => ({
			...prev,
			[phase]: Math.min(10, Math.max(2, prev[phase] + delta))
		}));
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
		startPhase('inhale');
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
	const [supervisionReason, setSupervisionReason] = useState<string | null>(null);
	const [activeThreadRootId, setActiveThreadRootId] = useState<string | null>(null);
	const [activeThreadRootMessage, setActiveThreadRootMessage] = useState<MessageItem | null>(null);
	const knownMessageIdsRef = useRef<Set<string>>(new Set());
	const threadSummaries = useMemo(() => {
		const map = new Map<string, { replyCount: number; lastReplyText: string }>();
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
				existing.lastReplyText = 'Last reply at ' + formatToHHMM(message.messageTime);
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
	const isMyMessageMatrix = useCallback((messageUserId: string) => {
		// For Matrix sessions, check if sender matches current user's Matrix user ID
		// Matrix room IDs start with '!' and Matrix user IDs start with '@'
		const isMatrixSession = activeSession.rid?.startsWith('!') || messageUserId?.includes('@');
		
		if (isMatrixSession && messageUserId?.includes('@')) {
			// Get current user's Matrix user ID from localStorage or cookie (rc_uid stores Matrix ID for Matrix sessions)
			const myMatrixUserId = localStorage.getItem('matrix_user_id') || 
				(typeof document !== 'undefined' && document.cookie
					.split('; ')
					.find(row => row.startsWith('rc_uid='))
					?.split('=')[1]);
			
			// Compare full Matrix user IDs (e.g., @username:domain)
			// This works for both normal and anonymous users
			if (myMatrixUserId && messageUserId) {
				return myMatrixUserId === messageUserId;
			}
		}
		// For RocketChat sessions, use the standard check
		return isMyMessage(messageUserId);
	}, [activeSession.rid]);

	// Check if current user is a supervisor
	useEffect(() => {
		if (!isSupervisionEnabledForCurrentChat) {
			setIsSupervisor(false);
			setSupervisionReason(null);
			return;
		}
		if (hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) && activeSession.item.id) {
			apiGetSessionSupervisors(activeSession.item.id)
				.then((supervisors) => {
					const isCurrentUserSupervisor = supervisors.some(
						s => s.supervisorConsultantId === userData.userId
					);
					setIsSupervisor(isCurrentUserSupervisor);
					const currentSupervisor = supervisors.find(
						s => s.supervisorConsultantId === userData.userId
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
		if (isAnonymousBreathingGameAvailable) {
			setShowWaitingMiniGame(true);
			return;
		}
		setShowWaitingMiniGame(false);
		clearBreathTimer();
	}, [
		clearBreathTimer,
		isAnonymousBreathingGameAvailable,
		waitingGameStage
	]);

	useEffect(() => {
		if (!showWaitingMiniGame || !isBreathTimerRunning) {
			clearBreathTimer();
			return;
		}
		timerRef.current = window.setInterval(() => {
			setPhaseMsLeft((prev) => Math.max(0, prev - 16));
		}, 16);
		return () => clearBreathTimer();
	}, [clearBreathTimer, isBreathTimerRunning, showWaitingMiniGame]);

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
				translate('session.waitingMiniGame.practiceSuccessPrompt', 'Great job, want to start now?')
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
		if (waitingGameStage !== 'onboarding') {
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
					typewriterRef.current = window.setTimeout(tick, 1100);
					return;
				}
				typewriterRef.current = window.setTimeout(tick, 26);
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
			}
			typewriterRef.current = window.setTimeout(tick, 18);
		};

		typewriterRef.current = window.setTimeout(tick, 300);
		return () => clearTypewriterTimer();
	}, [clearTypewriterTimer, resetToTutorialState, translate, waitingGameStage]);

	useEffect(() => {
		clearBriefingTypewriterTimer();
		if (waitingGameStage !== 'tutorial') {
			setBriefingTypewriterBusy(false);
			setBriefingTypedText('');
			return;
		}
		const fullText = currentBriefingScreen.text;
		let index = 0;
		const typingDelay = briefingScreenIndex <= 1 ? 52 : 44;
		const initialDelay = briefingScreenIndex <= 1 ? 220 : 160;
		setBriefingTypewriterBusy(true);
		setBriefingTypedText('');

		const tick = () => {
			index += 1;
			setBriefingTypedText(fullText.slice(0, index));
			if (index >= fullText.length) {
				setBriefingTypewriterBusy(false);
				return;
			}
			briefingTypewriterRef.current = window.setTimeout(tick, typingDelay);
		};

		briefingTypewriterRef.current = window.setTimeout(tick, initialDelay);
		return () => clearBriefingTypewriterTimer();
	}, [
		clearBriefingTypewriterTimer,
		currentBriefingScreen.text,
		briefingScreenIndex,
		waitingGameStage
	]);

	useEffect(() => {
		if (
			waitingGameStage !== 'tutorial' ||
			showBriefingNegativeScreen ||
			currentBriefingInteraction !== 'auto' ||
			briefingTypewriterBusy
		) {
			return;
		}
		const timeout = window.setTimeout(() => {
			if (briefingScreenIndex >= localizedBriefingScreens.length - 1) {
				setWaitingGameStage('setup');
				return;
			}
			setBriefingScreenIndex((index) => index + 1);
		}, 'autoAdvanceMs' in localizedBriefingScreens[briefingScreenIndex]
			? localizedBriefingScreens[briefingScreenIndex].autoAdvanceMs + 700
			: 2400);
		return () => window.clearTimeout(timeout);
	}, [
		briefingTypewriterBusy,
		briefingScreenIndex,
		currentBriefingInteraction,
		localizedBriefingScreens,
		showBriefingNegativeScreen,
		waitingGameStage
	]);

	useEffect(() => {
		clearGameStatusTypewriterTimer();
		if (waitingGameStage !== 'game' || !stageMessage) {
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
			if (index >= stageMessage.length) {
				setGameStatusTypewriterBusy(false);
				return;
			}
			gameStatusTypewriterRef.current = window.setTimeout(tick, 44);
		};
		gameStatusTypewriterRef.current = window.setTimeout(tick, 160);
		return () => clearGameStatusTypewriterTimer();
	}, [clearGameStatusTypewriterTimer, stageMessage, waitingGameStage]);

	useEffect(() => {
		clearLevelBadgeTypewriterTimer();
		if (waitingGameStage !== 'game') {
			setLevelBadgeTypewriterBusy(false);
			setLevelBadgeTypedText('');
			return;
		}
		const fullText = translate('session.waitingMiniGame.levelBadge', {
			defaultValue: 'Level {{level}}: {{title}}',
			level: currentLevel,
			title: BREATH_LEVELS[currentLevel - 1]?.title
		});
		let index = 0;
		setLevelBadgeTypewriterBusy(true);
		setLevelBadgeTypedText('');
		const tick = () => {
			index += 1;
			setLevelBadgeTypedText(fullText.slice(0, index));
			if (index >= fullText.length) {
				setLevelBadgeTypewriterBusy(false);
				return;
			}
			levelBadgeTypewriterRef.current = window.setTimeout(tick, 44);
		};
		levelBadgeTypewriterRef.current = window.setTimeout(tick, 160);
		return () => clearLevelBadgeTypewriterTimer();
	}, [clearLevelBadgeTypewriterTimer, currentLevel, translate, waitingGameStage]);

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
		const fullText =
			waitingGameStage === 'completion'
				? translate(
						'session.waitingMiniGame.completionTitle',
						'Congratulation you have made it'
					)
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
					window.setTimeout(() => setWaitingGameStage('serenity'), 900);
				}
				return;
			}
			centerStageTypewriterRef.current = window.setTimeout(tick, 42);
		};
		centerStageTypewriterRef.current = window.setTimeout(tick, 180);
		return () => clearCenterStageTypewriterTimer();
	}, [clearCenterStageTypewriterTimer, translate, waitingGameStage]);

	useEffect(
		() => () => {
			clearBreathTimer();
			clearTypewriterTimer();
			clearBriefingTypewriterTimer();
			clearGameStatusTypewriterTimer();
			clearLevelBadgeTypewriterTimer();
			clearCenterStageTypewriterTimer();
			if (cueAudioContextRef.current) {
				cueAudioContextRef.current.close().catch(() => undefined);
				cueAudioContextRef.current = null;
			}
		},
		[
			clearBreathTimer,
			clearTypewriterTimer,
			clearBriefingTypewriterTimer,
			clearGameStatusTypewriterTimer,
			clearLevelBadgeTypewriterTimer,
			clearCenterStageTypewriterTimer
		]
	);

	useEffect(() => {
		if (messages && messages.length > 0 && !initialScrollCompleted) {
			enableInitialScroll();
		}
	}, [messages, initialScrollCompleted]);

	useEffect(() => {
		knownMessageIdsRef.current = new Set((messages || []).map((m) => m._id));
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

		messages.forEach((message) => knownMessageIdsRef.current.add(message._id));
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
		const rootMessage = messages.find((message) => message._id === threadRootId);
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

	const enableInitialScroll = () => {
		if (!initialScrollCompleted) {
			setInitialScrollCompleted(true);
			scrollToEnd(500, true);
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
		const roomId =
			(activeSession.rid && activeSession.rid.startsWith('!')
				? activeSession.rid
				: activeSession.item?.matrixRoomId || activeSession.rid || null) ||
			null;
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
	}, [activeSession.rid, activeSession.item?.matrixRoomId, activeThreadRootId]);

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
		<div className="session">
			<div
				ref={headerRef}
				style={isEmbeddedNotificationsView ? { display: 'none' } : undefined}
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
					shouldLockScroll && 'session__content--gameLockScroll'
				)}
				ref={scrollContainerRef}
				onScroll={(e) => handleScroll(e)}
				onDragEnter={onDragEnter}
			>
				{isSupervisor && supervisionReason && (
					<div className="session__supervisionReason">
						<div className="session__supervisionReasonTitle">
							{translate('session.supervisor.reason.title', 'Supervisionsgrund')}
						</div>
						<div className="session__supervisionReasonText">
							{supervisionReason}
						</div>
					</div>
				)}
				<EncryptionBanner />
				{isAnonymousBreathingGameAvailable && showWaitingMiniGame && (
					<div
						className={clsx(
							'session__waitingModule',
							(isBriefingOnlyScreen || isPreGameSetupScreen || isTextOnlyStage) &&
								'session__waitingModule--briefing'
						)}
						role="region"
						aria-label={`${translate(
							'session.waitingMiniGame.inhaleExhale',
							'Inhale exhale breathing guide'
						)} ${translate('session.waitingMiniGame.timeLeft', 'Time left')}: ${phaseSecondsLeft}s`}
					>
						{waitingGameStage === 'game' && (
							<div className="session__waitingGameStatus">
								<span className="session__waitingGameStatusIcon" aria-hidden="true">
									<PersonCircleIcon />
								</span>
								<span>{gameStatusTypewriterBusy ? gameStatusTypedText : stageMessage}</span>
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
											'session__waitingMiniGameCircleOuter',
											breathPhase === 'hold' && 'session__waitingMiniGameCircleOuter--holding'
										)}
										style={
											{
												filter: `drop-shadow(0 0 ${12 + currentLevel * 1.2}px rgba(204,30,28,0.45))`,
												'--breath-progress': circleFillProgressPercent,
												'--breath-mid-scale': circleMidScale,
												'--breath-inner-scale': circleInnerScale
											} as React.CSSProperties
										}
									>
										<div className="session__waitingMiniGameCircleMid">
											<div className="session__waitingMiniGameCircleInner">
												<span className="session__waitingMiniGameCircleIcon">
													{currentPhaseIcon}
												</span>
												<div className="session__waitingMiniGameCenterText">
													{currentPhaseLabel}
												</div>
											</div>
										</div>
									</div>
									<div className="session__waitingMiniGamePhaseLabel">
										{currentPhaseLabel}
									</div>
								</div>
							</div>
						)}
						{waitingGameStage === 'game' && (
							<div className="session__waitingGameLevelBadge">
								{levelBadgeTypewriterBusy ? levelBadgeTypedText : levelBadgeTypedText}
								<span className="session__waitingGameLevelBadgeIcon" aria-hidden="true">
									<LevelEmojiIcon
										level={currentLevel}
										className="session__waitingGameLevelBadgeEmoji"
									/>
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
												selectedPresetId === preset.id &&
													'session__waitingPreGameLevelChip--active'
											)}
											onClick={() => setSelectedPresetId(preset.id)}
										>
											{translate(`session.waitingMiniGame.presets.${preset.id}`, preset.label)}
										</button>
									))}
								</div>
								<div className="session__waitingPreGameTiming">
									<div className="session__waitingPreGameTimingRow">
										<span>{translate('session.waitingMiniGame.phase.inhale', 'Inhale')}</span>
										<span className="session__waitingPreGameTimingValue">
											<button
												type="button"
												className="session__waitingPreGameTimingArrow"
												onClick={() => updateTiming('inhale', -1)}
												aria-label={translate(
													'session.waitingMiniGame.decreaseInhale',
													'Decrease inhale seconds'
												)}
											>
												◀
											</button>
											<span>{customTiming.inhale}s</span>
											<button
												type="button"
												className="session__waitingPreGameTimingArrow"
												onClick={() => updateTiming('inhale', 1)}
												aria-label={translate(
													'session.waitingMiniGame.increaseInhale',
													'Increase inhale seconds'
												)}
											>
												▶
											</button>
										</span>
									</div>
									<div className="session__waitingPreGameTimingRow">
										<span>{translate('session.waitingMiniGame.phase.hold', 'Hold')}</span>
										<span className="session__waitingPreGameTimingValue">
											<button
												type="button"
												className="session__waitingPreGameTimingArrow"
												onClick={() => updateTiming('hold', -1)}
												aria-label={translate(
													'session.waitingMiniGame.decreaseHold',
													'Decrease hold seconds'
												)}
											>
												◀
											</button>
											<span>{customTiming.hold}s</span>
											<button
												type="button"
												className="session__waitingPreGameTimingArrow"
												onClick={() => updateTiming('hold', 1)}
												aria-label={translate(
													'session.waitingMiniGame.increaseHold',
													'Increase hold seconds'
												)}
											>
												▶
											</button>
										</span>
									</div>
									<div className="session__waitingPreGameTimingRow">
										<span>{translate('session.waitingMiniGame.phase.exhale', 'Exhale')}</span>
										<span className="session__waitingPreGameTimingValue">
											<button
												type="button"
												className="session__waitingPreGameTimingArrow"
												onClick={() => updateTiming('exhale', -1)}
												aria-label={translate(
													'session.waitingMiniGame.decreaseExhale',
													'Decrease exhale seconds'
												)}
											>
												◀
											</button>
											<span>{customTiming.exhale}s</span>
											<button
												type="button"
												className="session__waitingPreGameTimingArrow"
												onClick={() => updateTiming('exhale', 1)}
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
												onClick={startPracticeRound}
											>
												{translate(
													'session.waitingMiniGame.repeatTrainingRound',
													'Repeat training round'
												)}
											</button>
											<button
												type="button"
												className="session__waitingPreGameActionButton session__waitingPreGameActionButton--primary"
												onClick={startAchieverGame}
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
								(isPreGameSetupScreen || waitingGameStage === 'game') &&
									'session__waitingModuleTypewriter--hidden'
							)}
						>
							{waitingGameStage === 'tutorial'
								? (
										<div
											className={clsx(
												'session__waitingBriefingScreen',
												isNegativeBriefingScreen &&
													'session__waitingBriefingScreen--negative'
											)}
											key={`${briefingScreenIndex}-${showBriefingNegativeScreen ? 'neg' : 'pos'}`}
										>
											<div className="session__waitingBriefingText">
												{briefingTypewriterBusy
													? briefingTypedText
													: currentBriefingScreen.text}
											</div>
										</div>
									)
								: waitingGameStage === 'completion' ||
									  waitingGameStage === 'prize' ||
									  waitingGameStage === 'serenity'
									? (
											<div className="session__waitingCenterStageText">
												{centerStageTypewriterBusy
													? centerStageTypedText
													: centerStageTypedText}
											</div>
										)
									: typewriterBusy
										? typedText
										: isPreGameSetupScreen
											? null
											: stageMessage}
						</div>
						<div
							className={clsx(
								'session__waitingModuleActions',
								isNegativeBriefingScreen && 'session__waitingModuleActions--negative'
							)}
						>
							{waitingGameStage === 'tutorial' && (
								<>
									{briefingTypewriterBusy ? null : currentBriefingInteraction === 'negative' ? (
										<button
											type="button"
											className="session__waitingModuleActionButton session__waitingModuleActionButton--ghost session__waitingModuleActionButton--tiny"
											onClick={() => {
												setShowBriefingNegativeScreen(false);
												setBriefingScreenIndex(2);
											}}
										>
											{translate(
												'session.waitingMiniGame.changeMind',
												'I change my mind let me try out your waiting game'
											)}
										</button>
									) : currentBriefingInteraction === 'choice' ? (
										<>
											<button
												type="button"
												className="session__waitingModuleActionButton session__waitingModuleActionButton--ghost"
												onClick={() => setShowBriefingNegativeScreen(true)}
											>
												{translate('session.waitingMiniGame.iJustWait', 'I just wait')}
											</button>
											<button
												type="button"
												className="session__waitingModuleActionButton session__waitingModuleActionButton--primary"
												onClick={() =>
													setBriefingScreenIndex((index) =>
														Math.min(localizedBriefingScreens.length - 1, index + 1)
													)
												}
											>
												{translate('session.waitingMiniGame.startGame', 'Start the game')}
											</button>
										</>
									) : currentBriefingInteraction === 'start' ? (
										<button
											type="button"
											className="session__waitingModuleActionButton session__waitingModuleActionButton--primary"
											onClick={() => {
												setShowBriefingNegativeScreen(false);
												setWaitingGameStage('setup');
											}}
										>
											{translate('app.next', 'Continue')}
										</button>
									) : null}
								</>
							)}
							{waitingGameStage === 'completion' && (
								<>
									<button
										type="button"
										className="session__waitingModuleActionButton session__waitingModuleActionButton--ghost"
										onClick={() => {
												setWaitingGameStage('practiceResult');
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
										{translate('session.waitingMiniGame.repeatGame', 'Repeat game')}
									</button>
									<button
										type="button"
										className="session__waitingModuleActionButton session__waitingModuleActionButton--primary"
										onClick={() => setWaitingGameStage('prize')}
									>
										{translate('session.waitingMiniGame.receivePrize', 'Receive your price')}
									</button>
								</>
							)}
							{waitingGameStage === 'serenity' && (
								<button
									type="button"
									className="session__waitingModuleActionButton session__waitingModuleActionButton--ghost"
									onClick={() => {
										setWaitingGameStage('practiceResult');
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
									{translate('session.waitingMiniGame.playAgain', 'Play again')}
								</button>
							)}
							{isJoinRoomAvailable && (
								<button
									type="button"
									className={clsx(
										'session__breathingJoinButton',
										joinPromptEscalated && 'session__breathingJoinButton--urgent'
									)}
									onClick={() => setShowWaitingMiniGame(false)}
								>
									{translate('session.waitingMiniGame.joinRoom', 'Join the room')}
								</button>
							)}
						</div>
					</div>
				)}
				<div className={'message-holder'}>
					{/* MATRIX MIGRATION: For Matrix sessions (no rid), skip E2EE ready check */}
					{messages &&
						(ready || !activeSession.rid) &&
						messages.map((message: MessageItem, index) => (
							<React.Fragment key={`${message._id}-${index}`}>
								<MessageItemComponent
									clientName={
										getContact(activeSession)?.username ||
										translate(
											'sessionList.user.consultantUnknown'
										)
									}
									askerRcId={
										!activeSession.rid &&
										message.userId &&
										!message.userId.includes(
											activeSession.consultant?.username || ''
										)
											? message.userId
											: activeSession.item.askerRcId
									}
									isOnlyEnquiry={isOnlyEnquiry}
									isMyMessage={isMyMessageMatrix(message.userId)}
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
									threadSummary={threadSummaries.get(message._id)}
									onOpenThread={
										isThreadsEnabled ? () => handleOpenThread(message) : undefined
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
									? translate('session.unreadCount.maxValue')
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
									translate('sessionList.user.consultantUnknown')
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
								isMyMessage={isMyMessageMatrix(activeThreadRootMessage.userId)}
								isUserBanned={props.bannedUsers.includes(
									activeThreadRootMessage.username
								)}
								handleDecryptionErrors={handleDecryptionErrors}
								handleDecryptionSuccess={handleDecryptionSuccess}
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
								<React.Fragment key={`thread-${message._id}-${index}`}>
									<MessageItemComponent
										clientName={
											getContact(activeSession)?.username ||
											translate('sessionList.user.consultantUnknown')
										}
										askerRcId={
											!activeSession.rid &&
											message.userId &&
											!message.userId.includes(
												activeSession.consultant?.username || ''
											)
												? message.userId
												: activeSession.item.askerRcId
										}
										isOnlyEnquiry={isOnlyEnquiry}
										isMyMessage={isMyMessageMatrix(message.userId)}
										isUserBanned={props.bannedUsers.includes(
											message.username
										)}
										handleDecryptionErrors={handleDecryptionErrors}
										handleDecryptionSuccess={handleDecryptionSuccess}
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
									? parseMessagePrefixes(activeThreadRootMessage.message)
											.cleanedMessage
									: null
							}
						/>
					</div>
				</div>
			)}

			{type === SESSION_LIST_TYPES.ENQUIRY && (
				<AcceptAssign btnLabel={'enquiry.acceptButton.known'} />
			)}

			{canWriteMessage && (
				<>
					{isSupervisor && (
						<div className="session__supervisorInputNote" style={{
							textAlign: 'center'
						}}>
							{translate(
								'session.supervisor.input.note',
								'Messages you send here are visible only to consultants.'
							)}
						</div>
					)}
					<Suspense
						fallback={
							<MessageSubmitInterfaceSkeleton
								placeholder={getPlaceholder()}
								className={clsx('session__submit-interface')}
							/>
						}
					>
						<MessageSubmitInterfaceComponent
							isTyping={props.isTyping}
							className={clsx(
								'session__submit-interface',
								!isScrolledToBottom &&
									'session__submit-interface--scrolled-up',
								activeThreadRootId && 'session__submit-interface--withThread'
							)}
							placeholder={getPlaceholder()}
							typingUsers={props.typingUsers}
							preselectedFile={draggedFile}
							handleMessageSendSuccess={handleMessageSendSuccess}
							isSupervisor={isSupervisor}
						/>
					</Suspense>
					{!tenantData?.settings?.featureAttachmentUploadDisabled && (
						<DragAndDropArea
							onFileDragged={onFileDragged}
							isDragging={isDragging}
							canDrop={isDragOverDropArea}
							onDragLeave={onDragLeave}
							styleOverride={{ top: headerBounds.height + 'px' }}
						/>
					)}
				</>
			)}
		</div>
	);
};
