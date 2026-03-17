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
	const [breathPhase, setBreathPhase] = useState<'inhale' | 'exhale'>('inhale');
	const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(4);
	const [breathCycles, setBreathCycles] = useState(0);
	const [breathIntensity, setBreathIntensity] = useState(0);
	const [breathProgress, setBreathProgress] = useState(0.2);
	const [lastInhaleScore, setLastInhaleScore] = useState(0);
	const [lastExhaleScore, setLastExhaleScore] = useState(0);
	const [displayBreathLabel, setDisplayBreathLabel] = useState<'inhale' | 'exhale'>('inhale');
	const [micState, setMicState] = useState<
		'idle' | 'requesting' | 'active' | 'denied' | 'error'
	>('idle');
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const lastFrameTsRef = useRef(0);
	const breathPhaseRef = useRef<'inhale' | 'exhale'>('inhale');
	const [detectedBreath, setDetectedBreath] = useState<'inhale' | 'exhale' | 'idle'>('idle');
	const [manualBreathAssist, setManualBreathAssist] = useState<'auto' | 'inhale' | 'exhale'>(
		'auto'
	);
	const [launcherPosition, setLauncherPosition] = useState({ x: 0, y: 0 });
	const [launcherPositionInitialized, setLauncherPositionInitialized] = useState(false);
	const sessionRootRef = useRef<HTMLDivElement | null>(null);
	const launcherDragStateRef = useRef({
		active: false,
		offsetX: 0,
		offsetY: 0,
		moved: false
	});
	const breathLevelRef = useRef(0);
	const noiseFloorRef = useRef(0.01);
	const lastEffortRef = useRef(0);
	const phasePeakEffortRef = useRef(0);
	const phaseStartedAtRef = useRef<number | null>(null);
	const manualAssistRef = useRef<'auto' | 'inhale' | 'exhale'>('auto');
	const manualAssistTimeoutRef = useRef<number | null>(null);

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
	const isAnonymousWaitingPhase =
		isAnonymousChat &&
		hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
		!activeSession.consultant?.id;

	const stopBreathingMicSession = useCallback(() => {
		if (animationFrameRef.current) {
			window.cancelAnimationFrame(animationFrameRef.current);
			animationFrameRef.current = null;
		}
		if (mediaSourceRef.current) {
			mediaSourceRef.current.disconnect();
			mediaSourceRef.current = null;
		}
		if (analyserRef.current) {
			analyserRef.current.disconnect();
			analyserRef.current = null;
		}
		if (audioContextRef.current) {
			audioContextRef.current.close().catch(() => undefined);
			audioContextRef.current = null;
		}
		if (mediaStreamRef.current) {
			mediaStreamRef.current.getTracks().forEach((track) => track.stop());
			mediaStreamRef.current = null;
		}
		setBreathIntensity(0);
		setDetectedBreath('idle');
		setManualBreathAssist('auto');
		setDisplayBreathLabel('inhale');
		manualAssistRef.current = 'auto';
		if (manualAssistTimeoutRef.current) {
			window.clearTimeout(manualAssistTimeoutRef.current);
			manualAssistTimeoutRef.current = null;
		}
		breathLevelRef.current = 0;
		lastEffortRef.current = 0;
		phasePeakEffortRef.current = 0;
		phaseStartedAtRef.current = null;
	}, []);

	const setManualAssist = useCallback((next: 'auto' | 'inhale' | 'exhale') => {
		manualAssistRef.current = next;
		setManualBreathAssist(next);
	}, []);

	const scheduleAssistReset = useCallback(() => {
		if (manualAssistTimeoutRef.current) {
			window.clearTimeout(manualAssistTimeoutRef.current);
		}
		manualAssistTimeoutRef.current = window.setTimeout(() => {
			setManualAssist('auto');
			manualAssistTimeoutRef.current = null;
		}, 1400);
	}, [setManualAssist]);

	const startBreathingMicSession = useCallback(async () => {
		if (
			typeof window === 'undefined' ||
			!navigator.mediaDevices?.getUserMedia ||
			mediaStreamRef.current
		) {
			return;
		}

		try {
			setMicState('requesting');
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true
				}
			});
			mediaStreamRef.current = stream;

			const context = new AudioContext();
			const analyser = context.createAnalyser();
			analyser.fftSize = 512;
			analyser.smoothingTimeConstant = 0.7;
			const source = context.createMediaStreamSource(stream);
			source.connect(analyser);

			audioContextRef.current = context;
			analyserRef.current = analyser;
			mediaSourceRef.current = source;
			setMicState('active');

			const sampleData = new Uint8Array(analyser.frequencyBinCount);
			const frequencyData = new Uint8Array(analyser.frequencyBinCount);
			let smoothedRms = 0;
			let lastDetected: 'inhale' | 'exhale' | 'idle' = 'idle';
			const getBandEnergy = (
				data: Uint8Array,
				startHz: number,
				endHz: number
			): number => {
				if (!audioContextRef.current) {
					return 0;
				}
				const nyquist = audioContextRef.current.sampleRate / 2;
				const startBin = Math.max(
					0,
					Math.floor((startHz / nyquist) * data.length)
				);
				const endBin = Math.min(
					data.length - 1,
					Math.ceil((endHz / nyquist) * data.length)
				);
				if (endBin <= startBin) {
					return 0;
				}
				let sum = 0;
				for (let i = startBin; i <= endBin; i += 1) {
					sum += data[i];
				}
				return sum / (endBin - startBin + 1);
			};

			const loop = (timestamp: number) => {
				if (!analyserRef.current) {
					return;
				}
				analyserRef.current.getByteTimeDomainData(sampleData);
				let sumSquares = 0;
				for (let i = 0; i < sampleData.length; i += 1) {
					const normalized = (sampleData[i] - 128) / 128;
					sumSquares += normalized * normalized;
				}
				const rms = Math.sqrt(sumSquares / sampleData.length);
				smoothedRms = smoothedRms * 0.82 + rms * 0.18;
				const normalizedLevel = Math.min(1, Math.max(0, smoothedRms * 10));
				setBreathIntensity(normalizedLevel);
				analyserRef.current.getByteFrequencyData(frequencyData);

				const lowEnergy = getBandEnergy(frequencyData, 80, 500);
				const highEnergy = getBandEnergy(frequencyData, 1200, 4000);
				const highLowRatio = (highEnergy + 1) / (lowEnergy + 1);
				const totalEnergy = getBandEnergy(frequencyData, 80, 4000);
				const centroidLike =
					(highEnergy * 0.75 + getBandEnergy(frequencyData, 600, 1400) * 0.25) /
					Math.max(1, totalEnergy);

				let nextDetected: 'inhale' | 'exhale' | 'idle' = 'idle';
				noiseFloorRef.current =
					noiseFloorRef.current * 0.985 + Math.min(rms, 0.06) * 0.015;
				const effort = Math.max(0, rms - noiseFloorRef.current);
				const effortNorm = Math.min(1, effort * 26);
				const effortDelta = effort - lastEffortRef.current;
				lastEffortRef.current = effort;

				// Hysteresis reduces flapping and one-way lock-in.
				const inhaleHigh = 1.18;
				const inhaleLow = 1.1;
				const exhaleLow = 1.0;
				const exhaleHigh = 1.08;

				if (effortNorm > 0.08) {
					if (
						(highLowRatio > inhaleHigh || centroidLike > 0.35) &&
						effortDelta >= -0.003
					) {
						nextDetected = 'inhale';
					} else if (
						(highLowRatio < exhaleLow || centroidLike < 0.305) &&
						effortDelta <= 0.003
					) {
						nextDetected = 'exhale';
					}
				}
				if (nextDetected === 'idle' && effortNorm > 0.11) {
					if (
						lastDetected === 'inhale' &&
						highLowRatio > inhaleLow &&
						centroidLike > 0.315
					) {
						nextDetected = 'inhale';
					} else if (
						lastDetected === 'exhale' &&
						highLowRatio < exhaleHigh &&
						centroidLike < 0.34
					) {
						nextDetected = 'exhale';
					}
				}
				if (nextDetected === 'idle' && effortNorm > 0.16) {
					nextDetected =
						lastDetected === 'idle' ? breathPhaseRef.current : lastDetected;
				}
				if (manualAssistRef.current !== 'auto') {
					nextDetected = manualAssistRef.current;
				}
				lastDetected = nextDetected;
				setDetectedBreath(nextDetected);

				const lastTs = lastFrameTsRef.current || timestamp;
				const deltaSec = Math.max(0, (timestamp - lastTs) / 1000);
				lastFrameTsRef.current = timestamp;

				const effectiveEffortNorm =
					manualAssistRef.current === 'auto'
						? effortNorm
						: Math.max(0.35, effortNorm);
				phasePeakEffortRef.current = Math.max(
					phasePeakEffortRef.current,
					effectiveEffortNorm
				);
				if (!phaseStartedAtRef.current) {
					phaseStartedAtRef.current = timestamp;
				}

				const baseDrift = 0.055;
				if (breathPhaseRef.current === 'inhale') {
					const guidedMultiplier = nextDetected === 'inhale' ? 1 : 0.42;
					breathLevelRef.current +=
						deltaSec * (baseDrift + effectiveEffortNorm * 0.9 * guidedMultiplier);
					if (nextDetected === 'exhale') {
						breathLevelRef.current -= deltaSec * effectiveEffortNorm * 0.26;
					}
				} else {
					const guidedMultiplier = nextDetected === 'exhale' ? 1 : 0.42;
					breathLevelRef.current -=
						deltaSec * (baseDrift + effectiveEffortNorm * 0.9 * guidedMultiplier);
					if (nextDetected === 'inhale') {
						breathLevelRef.current += deltaSec * effectiveEffortNorm * 0.26;
					}
				}
				breathLevelRef.current = Math.min(1, Math.max(0, breathLevelRef.current));
				setBreathProgress(breathLevelRef.current);

				if (breathPhaseRef.current === 'inhale') {
					const remaining = Math.max(
						1,
						Math.min(4, Math.ceil((1 - breathLevelRef.current) * 4))
					);
					setPhaseSecondsLeft(remaining);
					if (breathLevelRef.current >= 0.92 && effortNorm > 0.12) {
						const phaseDurationSec = phaseStartedAtRef.current
							? Math.max(0.5, (timestamp - phaseStartedAtRef.current) / 1000)
							: 4;
						const qualityFromTarget = Math.max(
							0,
							1 - Math.abs(phaseDurationSec - 4) / 4
						);
						const inhaleScore = Math.round(
							Math.min(1, phasePeakEffortRef.current * 0.65 + qualityFromTarget * 0.35) * 100
						);
						setLastInhaleScore(inhaleScore);
						phasePeakEffortRef.current = 0;
						phaseStartedAtRef.current = timestamp;
						setBreathPhase('exhale');
						setPhaseSecondsLeft(6);
					}
				} else {
					const remaining = Math.max(
						1,
						Math.min(6, Math.ceil(breathLevelRef.current * 6))
					);
					setPhaseSecondsLeft(remaining);
					if (breathLevelRef.current <= 0.08 && effortNorm > 0.1) {
						const phaseDurationSec = phaseStartedAtRef.current
							? Math.max(0.5, (timestamp - phaseStartedAtRef.current) / 1000)
							: 6;
						const qualityFromTarget = Math.max(
							0,
							1 - Math.abs(phaseDurationSec - 6) / 6
						);
						const exhaleScore = Math.round(
							Math.min(1, phasePeakEffortRef.current * 0.65 + qualityFromTarget * 0.35) * 100
						);
						setLastExhaleScore(exhaleScore);
						phasePeakEffortRef.current = 0;
						phaseStartedAtRef.current = timestamp;
						setBreathPhase('inhale');
						setBreathCycles((cycles) => cycles + 1);
						setPhaseSecondsLeft(4);
					}
				}

				animationFrameRef.current = window.requestAnimationFrame(loop);
			};

			lastFrameTsRef.current = 0;
			animationFrameRef.current = window.requestAnimationFrame(loop);
		} catch (error: any) {
			if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
				setMicState('denied');
			} else {
				setMicState('error');
			}
			stopBreathingMicSession();
		}
	}, [stopBreathingMicSession]);

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
		breathPhaseRef.current = breathPhase;
	}, [breathPhase]);

	useEffect(() => {
		setDisplayBreathLabel(breathPhase);
	}, [breathPhase]);

	const getBreathRating = useCallback((score: number) => {
		if (score >= 80) {
			return 'Excellent';
		}
		if (score >= 60) {
			return 'Good';
		}
		if (score >= 40) {
			return 'Fair';
		}
		return 'Needs work';
	}, []);

	const overallBreathScore = Math.round((lastInhaleScore + lastExhaleScore) / 2);

	useEffect(() => {
		if (isAnonymousWaitingPhase) {
			setShowWaitingMiniGame(true);
			setBreathPhase('inhale');
			setDisplayBreathLabel('inhale');
			setPhaseSecondsLeft(4);
			setBreathCycles(0);
			setBreathProgress(0.2);
			setLastInhaleScore(0);
			setLastExhaleScore(0);
			breathLevelRef.current = 0.2;
			phasePeakEffortRef.current = 0;
			phaseStartedAtRef.current = null;
			return;
		}
		setShowWaitingMiniGame(false);
		stopBreathingMicSession();
	}, [isAnonymousWaitingPhase, stopBreathingMicSession]);

	useEffect(() => {
		if (isAnonymousWaitingPhase && showWaitingMiniGame) {
			startBreathingMicSession();
			return;
		}
		stopBreathingMicSession();
	}, [
		isAnonymousWaitingPhase,
		showWaitingMiniGame,
		startBreathingMicSession,
		stopBreathingMicSession
	]);

	useEffect(() => () => stopBreathingMicSession(), [stopBreathingMicSession]);

	useEffect(
		() => () => {
			if (manualAssistTimeoutRef.current) {
				window.clearTimeout(manualAssistTimeoutRef.current);
				manualAssistTimeoutRef.current = null;
			}
		},
		[]
	);

	useEffect(() => {
		const container = scrollContainerRef.current || sessionRootRef.current;
		if (!isAnonymousWaitingPhase || launcherPositionInitialized || !container) {
			return;
		}
		const rootRect = container.getBoundingClientRect();
		const launcherWidth = 92;
		const launcherHeight = 56;
		setLauncherPosition({
			x: Math.max(8, rootRect.width - launcherWidth - 12),
			y: Math.max(64, rootRect.height - launcherHeight - 16)
		});
		setLauncherPositionInitialized(true);
	}, [isAnonymousWaitingPhase, launcherPositionInitialized]);

	useEffect(() => {
		const clampLauncherInBounds = () => {
			const container = scrollContainerRef.current || sessionRootRef.current;
			if (!container || !launcherPositionInitialized) {
				return;
			}
			const rootRect = container.getBoundingClientRect();
			const launcherWidth = 92;
			const launcherHeight = 56;
			setLauncherPosition((prev) => ({
				x: Math.min(
					Math.max(8, prev.x),
					Math.max(8, rootRect.width - launcherWidth - 8)
				),
				y: Math.min(
					Math.max(8, prev.y),
					Math.max(8, rootRect.height - launcherHeight - 8)
				)
			}));
		};

		window.addEventListener('resize', clampLauncherInBounds);
		return () => window.removeEventListener('resize', clampLauncherInBounds);
	}, [launcherPositionInitialized]);

	useEffect(() => {
		const handlePointerMove = (event: PointerEvent) => {
			const container = scrollContainerRef.current || sessionRootRef.current;
			if (!launcherDragStateRef.current.active || !container) {
				return;
			}
			const rootRect = container.getBoundingClientRect();
			const launcherWidth = 92;
			const launcherHeight = 56;
			const nextX = event.clientX - rootRect.left - launcherDragStateRef.current.offsetX;
			const nextY = event.clientY - rootRect.top - launcherDragStateRef.current.offsetY;
			const clampedX = Math.min(
				Math.max(8, nextX),
				Math.max(8, rootRect.width - launcherWidth - 8)
			);
			const clampedY = Math.min(
				Math.max(8, nextY),
				Math.max(8, rootRect.height - launcherHeight - 8)
			);
			setLauncherPosition({ x: clampedX, y: clampedY });
			launcherDragStateRef.current.moved = true;
		};

		const handlePointerUp = () => {
			launcherDragStateRef.current.active = false;
		};

		window.addEventListener('pointermove', handlePointerMove);
		window.addEventListener('pointerup', handlePointerUp);
		return () => {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerUp);
		};
	}, []);

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
		<div className="session" ref={sessionRootRef}>
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
					activeThreadRootId && 'session__content--withThread'
				)}
				ref={scrollContainerRef}
				onScroll={(e) => handleScroll(e)}
				onDragEnter={onDragEnter}
			>
				{isAnonymousWaitingPhase && showWaitingMiniGame && (
					<div
						className="session__waitingOverlay"
						role="dialog"
						aria-modal="true"
						aria-label={`${translate(
							'session.waitingMiniGame.inhaleExhale',
							'Inhale exhale breathing guide'
						)} ${translate('session.waitingMiniGame.timeLeft', 'Time left')}: ${phaseSecondsLeft}s`}
						data-mic-state={micState}
						data-breath-cycles={breathCycles}
					>
						<button
							type="button"
							className="session__waitingOverlayClose"
							onClick={() => setShowWaitingMiniGame(false)}
							aria-label={translate('session.waitingMiniGame.close', 'Close')}
						>
							×
						</button>
						<div className="session__waitingMiniGameGuide">
							<button
								type="button"
								className={clsx(
									'session__waitingMiniGameGuideItem',
									manualBreathAssist === 'inhale' &&
										'session__waitingMiniGameGuideItem--active'
								)}
								onPointerDown={() => setManualAssist('inhale')}
								onPointerUp={() => setManualAssist('auto')}
								onPointerLeave={() => setManualAssist('auto')}
								onClick={() => {
									setManualAssist('inhale');
									scheduleAssistReset();
								}}
								aria-label={translate('session.waitingMiniGame.inhale', 'Inhale')}
							>
								<svg viewBox="0 0 28 28" className="session__waitingMiniGameGuideIcon">
									<path
										d="M11 4C9.3 4 8 5.3 8 7v6.2c0 1.4-1.2 2.6-2.6 2.6H4v2h1.4c2.5 0 4.6-2.1 4.6-4.6V7c0-.6.4-1 1-1h6c.6 0 1 .4 1 1v6.2c0 2.5 2.1 4.6 4.6 4.6H24v-2h-1.4c-1.4 0-2.6-1.2-2.6-2.6V7c0-1.7-1.3-3-3-3h-6z"
										fill="currentColor"
									/>
									<path d="M8 22l3-4H5l3 4zM20 22l3-4h-6l3 4z" fill="currentColor" />
								</svg>
								<span className="session__waitingMiniGameGuideValue">
									{lastInhaleScore}%
								</span>
								<span className="session__waitingMiniGameGuideTarget">4s</span>
							</button>
							<button
								type="button"
								className={clsx(
									'session__waitingMiniGameGuideItem',
									manualBreathAssist === 'exhale' &&
										'session__waitingMiniGameGuideItem--active'
								)}
								onPointerDown={() => setManualAssist('exhale')}
								onPointerUp={() => setManualAssist('auto')}
								onPointerLeave={() => setManualAssist('auto')}
								onClick={() => {
									setManualAssist('exhale');
									scheduleAssistReset();
								}}
								aria-label={translate('session.waitingMiniGame.exhale', 'Exhale')}
							>
								<svg viewBox="0 0 28 28" className="session__waitingMiniGameGuideIcon">
									<path
										d="M4 12c3.1-2.7 6.6-4 10-4s6.9 1.3 10 4c-3.1 2.7-6.6 4-10 4s-6.9-1.3-10-4z"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.8"
									/>
									<path
										d="M7 12c2 1.5 4.2 2.2 7 2.2s5-.7 7-2.2"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.5"
									/>
									<path d="M10 23l3-4H7l3 4zM18 23l3-4h-6l3 4z" fill="currentColor" />
								</svg>
								<span className="session__waitingMiniGameGuideValue">
									{lastExhaleScore}%
								</span>
								<span className="session__waitingMiniGameGuideTarget">6s</span>
							</button>
						</div>
						<div className="session__waitingMiniGameScoreboard">
							<div className="session__waitingMiniGameScoreRow">
								<span>Inhale</span>
								<span>{lastInhaleScore}%</span>
								<span>{getBreathRating(lastInhaleScore)}</span>
							</div>
							<div className="session__waitingMiniGameScoreRow">
								<span>Exhale</span>
								<span>{lastExhaleScore}%</span>
								<span>{getBreathRating(lastExhaleScore)}</span>
							</div>
							<div className="session__waitingMiniGameScoreRow session__waitingMiniGameScoreRow--overall">
								<span>Overall</span>
								<span>{overallBreathScore}%</span>
								<span>{getBreathRating(overallBreathScore)}</span>
							</div>
						</div>
						<div className="session__waitingMiniGameArena session__waitingMiniGameArena--breathing">
							<div
								className="session__waitingMiniGameCircleOuter"
								style={{
									transform: `scale(${0.72 + breathProgress * 0.34})`,
									filter: `drop-shadow(0 0 ${12 + Math.round(breathIntensity * 28)}px rgba(204,30,28,${
										0.18 + breathIntensity * 0.42
									}))`
								}}
							>
								<div className="session__waitingMiniGameCircleMid">
									<div className="session__waitingMiniGameCircleInner">
									{displayBreathLabel === 'inhale'
											? translate('session.waitingMiniGame.inhale', 'Inhale')
											: translate('session.waitingMiniGame.exhale', 'Exhale')}
									</div>
								</div>
							</div>
						</div>
						<div className="session__waitingMiniGameMicState">
							{translate('session.waitingMiniGame.mic', 'Mic')}:{' '}
							{manualBreathAssist !== 'auto'
								? `${translate('session.waitingMiniGame.assist', 'assist')}: ${manualBreathAssist}`
								: micState === 'active'
									? detectedBreath === 'idle'
										? translate('session.waitingMiniGame.micListening', 'listening')
										: detectedBreath
									: micState}
						</div>
					</div>
				)}
				{isAnonymousWaitingPhase && !showWaitingMiniGame && (
					<button
						type="button"
						className="session__waitingOverlayLauncher"
						style={{
							left: `${launcherPosition.x}px`,
							top: `${launcherPosition.y}px`
						}}
						onPointerDown={(event) => {
							const targetRect = (
								event.currentTarget as HTMLButtonElement
							).getBoundingClientRect();
							launcherDragStateRef.current.active = true;
							launcherDragStateRef.current.offsetX = event.clientX - targetRect.left;
							launcherDragStateRef.current.offsetY = event.clientY - targetRect.top;
							launcherDragStateRef.current.moved = false;
							(event.currentTarget as HTMLButtonElement).setPointerCapture?.(
								event.pointerId
							);
						}}
						onClick={() => {
							if (launcherDragStateRef.current.moved) {
								launcherDragStateRef.current.moved = false;
								return;
							}
							setShowWaitingMiniGame(true);
						}}
						aria-label={translate('session.waitingMiniGame.reopen', 'Open breathing guide')}
					>
						<span className="session__waitingOverlayLauncherDot" />
						<span className="session__waitingOverlayLauncherLabel">
							{translate('session.waitingMiniGame.reopenShort', 'Breath')}
						</span>
					</button>
				)}
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
