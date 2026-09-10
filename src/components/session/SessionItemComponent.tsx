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
import {
	requiresAnonymousInquiryConsent as requiresAnonymousInquiryConsentFor,
	shouldBlockAnonymousInquiryChat as shouldBlockAnonymousInquiryChatFor
} from './anonymousConsentInvariant';
import clsx from 'clsx';
import {
	buildSupervisionTimeline,
	scrollToEnd,
	isMyMessage,
	SESSION_LIST_TYPES
} from './sessionHelpers';
import { getModality, Modality } from './getModality';
import { hasMediaUploadFeature } from '../../utils/mediaUploadHelpers';
import {
	isMatrixRoom,
	isMatrixRoomIdHeuristic
} from '../../utils/matrixRoomUtils';
import { getCurrentMatrixUserId } from '../../utils/matrixSession';
import { MessageItem } from '../message/MessageItemComponent';
import { MessageTimeline } from './MessageTimeline';
import { useMatrixDecryptionFailures } from '../../hooks/useMatrixDecryptionFailures';
import {
	FailedSend,
	FailedSendTimelineEntry
} from '../message/FailedSendTimelineEntry';
import { failedSendBelongsTo } from '../message/failedSendTarget';
import { useReportChatStagePanel } from '../chatStage/ChatStagePanelContext';
import {
	ReactionEvent,
	AggregatedReaction,
	aggregateReactions
} from '../../utils/messageRelations';
import { chatTransportService } from '../../services/chatTransportService';
import {
	SupervisionPanelContext,
	SupervisionPanelContextValue
} from '../supervisionPanel/SupervisionPanelContext';
import {
	countUnreadSideRoomMessages,
	excludeSideRoomMessages,
	findUnseenMessages
} from '../supervisionPanel/supervisionPanelState';
// B2: the stage composition (chatStage/) wired 1:1 — same DOM, same classes.
import { SidePanel, InfoBanner } from '../chatStage/SidePanel';
import { teamCopy } from '../chatStage/teamChannelCopy';
import { PanelHeader } from '../chatStage/PanelHeader';
import { ChannelSwitcherFab } from '../chatStage/ChannelSwitcherFab';
import {
	resolveChannelLabel,
	type SecondaryChannel
} from '../chatStage/channelSwitcherState';
import {
	clampPanelWidth,
	readPanelWidth,
	STAGE_LAYOUT,
	writePanelWidth
} from '../chatStage/stageLayout';
import { useDockedComposerOffset } from '../chatStage/useDockedComposerOffset';
import { useComposerFocus } from '../chatStage/useComposerFocus';
import { ResizableHandle } from '../sessionsList/ResizableHandle';
import { useResponsive } from '../../hooks/useResponsive';
import {
	buildSessionChannelPath,
	channelFromId,
	channelId,
	normalizeLegacyChannelSearch,
	parseChannel,
	decideAutoOpen,
	readLastChannel,
	stripAtParam,
	safeChannelStorage,
	stripChannelParams,
	withChannel,
	writeLastChannel,
	type SessionChannel
} from '../../utils/channelRoute';
import {
	seedLastActivity,
	toStackParticipants
} from '../sessionHeader/headerParticipants';
import type { StackParticipant } from '../message/participantStack';
import {
	buildVisibleParticipantRules,
	filterVisibleParticipants
} from '../message/visibleParticipants';
import { isSystemMatrixUser } from '../../utils/systemMatrixUsers';
import '../chatStage/chatStage.styles.scss';
import { getSupervisorDisplayNames } from '../sessionsListItem/supervisionListState';
import {
	pickDisplayOrUsername,
	pickSupervisionCounterpartName,
	CounterpartNameSource
} from '../supervisionPanel/supervisionCounterpart';
import { apiGetConsultant } from '../../api/apiGetConsultant';
import {
	computeThreadSummaries,
	formatThreadEntryPreview
} from '../../utils/threadSummaries';
import { toMessagePreviewText } from '../../utils/messagePreviewText';
import {
	getThreadLastReadTs,
	markThreadRead,
	isThreadUnread
} from '../../utils/threadUnread';
import { ThreadListPanel } from './ThreadListPanel';
import { SessionHeaderComponent } from '../sessionHeader/SessionHeaderComponent';
import { PanelCallActions } from '../chatStage/PanelCallActions';
import { resolveSupervisionCallFeatureGates } from '../call/callFeatureGates';
import { startRoomCall } from '../call/startRoomCall';
import {
	AUTHORITIES,
	getContact,
	hasUserAuthority,
	NotificationsContext,
	NOTIFICATION_TYPE_INFO,
	UserDataContext,
	SessionTypeContext,
	useTenant,
	ActiveSessionContext,
	LocaleContext
} from '../../globalState';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import {
	STATUS_EMPTY,
	STATUS_ENQUIRY
} from '../../globalState/interfaces/SessionsDataInterface';
import { useNavigate, useLocation } from 'react-router-dom';
import './session.styles';
import { focusSessionChromeOnPointerDown } from './focusSessionChrome';
import { useDebouncedCallback } from 'use-debounce';
import { ReactComponent as NotificationBellIcon } from '../../resources/img/icons/notification_bell.svg';
import smoothScroll from './smoothScrollHelper';
import { DragAndDropArea } from '../dragAndDropArea/DragAndDropArea';
import useMeasure from 'react-use-measure';
import { AcceptAssign } from './AcceptAssign';
import { useTranslation } from 'react-i18next';
import useDebounceCallback from '../../hooks/useDebounceCallback';
import { apiPostError, TError } from '../../api/apiPostError';
import { useE2EE } from '../../hooks/useE2EE';
import { MessageSubmitInterfaceSkeleton } from '../messageSubmitInterface/messageSubmitInterfaceSkeleton';
import { MessageSubmitErrorBoundary } from '../messageSubmitInterface/MessageSubmitErrorBoundary';
import {
	buildEditContext,
	buildReplyQuoteContext,
	buildReplyQuotePreview
} from './replyQuote';
import { EncryptionBanner } from './EncryptionBanner';
import {
	apiGetSessionSupervisors,
	type SessionSupervisor
} from '../../api/apiGetSessionSupervisors';
import {
	roomIdForActiveSession,
	type SupervisionRoomLookup
} from './supervisionRoomLookup';
import { apiPatchNotificationActiveView } from '../../api/apiPatchNotificationActiveView';
import { isNotificationActiveViewRoute } from './notificationActiveView';
import { apiRegisterMatrixRoomForSync } from '../../api/apiMatrixSyncRegister';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { apiPutSessionData } from '../../api/apiPutSessionData';
import { apiGetUserData } from '../../api/apiGetUserData';
import { apiGetAnonymousEnquiryDetails } from '../../api/apiGetAnonymousEnquiryDetails';
import {
	ensureAnonymousChatPreLogoutCleanup,
	registerAnonymousChatSessionForCleanup
} from '../../utils/anonymousChatSessionCleanup';
import { parseMessagePrefixes } from '../message/messageConstants';
import { decodeUsername } from '../../utils/encryptionHelpers';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import { PseudonymCard } from '../pseudonym/PseudonymCard';
import { PseudonymActionBar } from '../pseudonym/PseudonymActionBar';
import { PrivacyMessageCard } from '../pseudonym/PrivacyMessageCard';
import { WaitingQueueActionBar } from '../pseudonym/WaitingQueueActionBar';
import { LeaveQueueDialog } from '../pseudonym/LeaveQueueDialog';
import { performLeaveQueueDelete } from '../pseudonym/leaveQueueDelete';
import { ConsultantAcceptedActionBar } from '../pseudonym/ConsultantAcceptedActionBar';
import { BreathingCompanionHost } from '../pseudonym/breathingCompanion/BreathingCompanionHost';
import { AnonymousConsentGate } from '../pseudonym/AnonymousConsentGate';
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
	/** Reactions (m.annotation, #435): raw reaction events for the loaded window. */
	reactionEvents?: ReactionEvent[];
	/**
	 * WP-B2 (ADR-008): the supervision side room's own timeline. Never part
	 * of `messages`; rendered in the SupervisionPanel next to the chat.
	 */
	supervisionMessages?: MessageItem[];
	/**
	 * Teamberatung (Frank, 09.09.; FE#514 / ADR-016): the team side room's
	 * own timeline — the third channel, built one-to-one like supervision.
	 * Never part of `messages`; the advice seeker is never a member.
	 */
	teamMessages?: MessageItem[];
	/** Matrix room id of that team room (`apiGetTeamDiscussion`). */
	teamRoomId?: string;
	typingUsers: string[];
	hasUserInitiatedStopOrLeaveRequest: React.MutableRefObject<boolean>;
	bannedUsers: string[];
	refreshMessages?: () => void;
}

let initMessageCount: number;

const ROBOT_MESSAGE_REVEAL_GAP_MS = 3500;

export const SessionItemComponent = (props: SessionItemProps) => {
	const { t: translate } = useTranslation();
	const tenantData = useTenant();

	const { activeSession, reloadActiveSession } =
		useContext(ActiveSessionContext);
	const { userData, setUserData } = useContext(UserDataContext);
	const { addEventNotification } = useContext(NotificationsContext);
	const { type, path: listPath } = useContext(SessionTypeContext);
	const { locale } = useContext(LocaleContext);
	const legalLinks = useContext(LegalLinksContext);
	const { matrixClientService } = useMatrixClient();
	const location = useLocation();
	const navigate = useNavigate();
	const isEmbeddedNotificationsView =
		new URLSearchParams(location.search).get('embeddedNotifications') ===
		'1';
	const [isSupervisor, setIsSupervisor] = useState(false);
	// ADR-008: per-session supervision side room id (shared by all supervisor
	// entries). Aside sends are routed here so the client never receives them.
	const [supervisionRoomLookup, setSupervisionRoomLookup] =
		useState<SupervisionRoomLookup | null>(null);
	const supervisionRoomId = roomIdForActiveSession(
		supervisionRoomLookup,
		activeSession.item.id
	);
	// WP-B2: the supervisor rows from the same call — identities for the
	// participant stacks (`buildVisibleParticipantRules`) and, as usernames,
	// the counterpart name for the consultant when the list DTO has no
	// display names.
	const [sessionSupervisors, setSessionSupervisors] = useState<
		SessionSupervisor[]
	>([]);
	const supervisorUsernames = useMemo(
		() =>
			sessionSupervisors.map((s) => s.supervisorUsername).filter(Boolean),
		[sessionSupervisors]
	);
	// WP-B2 (#996): the supervisor's counterpart is the responsible
	// consultant, but the consultant session-list DTO carries only
	// `{ id, firstName, lastName }` — no display name, no username. Resolved
	// by id via the public consultant endpoint; keyed so a stale response
	// for a previous session can never name the current one.
	const [resolvedCounterpartConsultant, setResolvedCounterpartConsultant] =
		useState<{ id: string; name: CounterpartNameSource } | null>(null);
	const [showWaitingMiniGame, setShowWaitingMiniGame] = useState(false);
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
	const [isLeaveQueueDialogOpen, setIsLeaveQueueDialogOpen] = useState(false);
	const [isLeavingQueue, setIsLeavingQueue] = useState(false);
	const [leaveQueueFailed, setLeaveQueueFailed] = useState(false);
	/**
	 * The anonymous enquiry was finished server-side (asker logout, backend
	 * expiry workflow, admin cleanup) while this tab was still on the
	 * waiting screen. Waiting longer is pointless — no consultant can see
	 * a finished enquiry — so the queue UI switches to a closed notice.
	 */
	const [enquiryClosed, setEnquiryClosed] = useState(false);
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
		generatePseudonym(locale)
	);
	const handleRegeneratePseudonym = useCallback(() => {
		setCurrentPseudonym((prev) => regeneratePseudonym(prev, locale));
	}, [locale]);
	const [robotSequenceVisibleCount, setRobotSequenceVisibleCount] =
		useState(0);

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
	const isAnonymousChat = getModality(activeSession) === Modality.LIVE_CHAT;
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
	/* ORISO-UserService#927: the Eingabesperre lives in one pure predicate now,
	   pinned by `anonymousConsentInvariant.test.ts`. It used to be assembled
	   inline here, which meant the consent guarantee for §11 KDG special-category
	   data was emergent from three booleans and asserted nowhere. */
	const requiresAnonymousInquiryConsent = requiresAnonymousInquiryConsentFor({
		isAnonymousAskerExperience,
		sessionStatus: activeSession.item?.status,
		dataPrivacyConfirmation: userData?.dataPrivacyConfirmation
	});
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
		!enquiryClosed &&
		numAvailableConsultants === 0 &&
		!liveChatClosedDismissed;
	const robotIncomingUsername = useMemo(() => {
		const resolvedCandidates = [
			contact?.displayName,
			contact?.username,
			userData?.displayName,
			userData?.userName,
			activeSession.user?.username,
			activeSession.item.askerMatrixUserId
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
		activeSession.item.askerMatrixUserId,
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
	/* The retired waiting mini-game took the whole session column over for its
	   practice and game rounds; that takeover is what dimmed the session chrome
	   and locked the scroll. The breathing companion renders inline in the
	   content column instead and never takes over, so both flags stay wired to
	   their classNames but are not engaged by anything today. */
	const shouldLockScroll = false;
	const shouldFadeSessionChrome = false;
	const shouldShowConsentGate =
		requiresAnonymousInquiryConsent && !anonymousInquiryConsentAccepted;
	const shouldShowPseudonymGate =
		!shouldShowConsentGate &&
		(requiresPseudonymConfirmation || isInAnonymousWaitingQueuePhase);
	/* The runtime lock goes through the same predicate the invariant test pins.
	   Recomposing it locally left `anonymousConsentInvariant.test.ts` asserting a
	   copy of the rule while the composer obeyed a different one — the test would
	   have stayed green through exactly the regression it exists to catch. */
	const shouldBlockAnonymousInquiryChat = shouldBlockAnonymousInquiryChatFor({
		isAnonymousAskerExperience,
		sessionStatus: activeSession.item?.status,
		dataPrivacyConfirmation: userData?.dataPrivacyConfirmation,
		consentAcceptedInSession: anonymousInquiryConsentAccepted,
		requiresPseudonymConfirmation,
		isInAnonymousWaitingQueuePhase
	});
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
			translate('anonymousConsent.label.text', {
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

	// WP-B2 safety net: the client-facing timeline never carries side-room
	// items, whatever SessionStream handed over.
	const messages = useMemo(
		() =>
			props.messages
				? excludeSideRoomMessages(props.messages, [
						supervisionRoomId,
						props.teamRoomId
					])
				: props.messages,
		[props.messages, supervisionRoomId, props.teamRoomId]
	);
	const resolvedMatrixRoomId = isMatrixRoom(activeSession.rid)
		? activeSession.rid
		: activeSession.item?.matrixRoomId || activeSession.rid;
	// "Encryption broke" delivery status: event ids in this room whose Megolm
	// decryption permanently failed, so the affected message can show the red
	// cross (Figma 7086-57415). Keyed by event id === message._id.
	const decryptionFailures =
		useMatrixDecryptionFailures(resolvedMatrixRoomId);
	// Reactions (m.annotation, #435).
	const reactionEvents = useMemo(
		() => props.reactionEvents || [],
		[props.reactionEvents]
	);
	const ownMatrixUserId = matrixClientService?.getClient?.()?.getUserId?.();
	const getReactionsFor = useCallback(
		(messageId: string): AggregatedReaction[] =>
			aggregateReactions(
				reactionEvents,
				messageId,
				ownMatrixUserId || ''
			),
		[reactionEvents, ownMatrixUserId]
	);
	const handleReact = useCallback(
		(messageId: string, key: string) => {
			if (!resolvedMatrixRoomId) {
				return;
			}
			chatTransportService
				.sendReaction({
					matrixRoomId: resolvedMatrixRoomId,
					targetEventId: messageId,
					key
				})
				.catch(() => undefined);
		},
		[resolvedMatrixRoomId]
	);
	const handleUnreact = useCallback(
		(reactionEventId: string) => {
			if (!resolvedMatrixRoomId) {
				return;
			}
			chatTransportService
				.removeReaction({
					matrixRoomId: resolvedMatrixRoomId,
					reactionEventId
				})
				.catch(() => undefined);
		},
		[resolvedMatrixRoomId]
	);
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
	// B2 / T24: the open side channel is DERIVED from the URL
	// (`?channel=thread:<root>` / `?channel=supervision`, `channelRoute.ts`),
	// never a `useState` beside it. Reload, timeline, e-mail and the panel
	// header's menu all use the same parameter.
	const { channel: routeChannel, at: routeAt } = useMemo(
		() => parseChannel(location.search),
		[location.search]
	);
	const activeThreadRootId =
		isThreadsEnabled && routeChannel?.kind === 'thread'
			? routeChannel.rootId
			: null;
	const activeThreadRootMessage = useMemo<MessageItem | null>(
		() =>
			activeThreadRootId
				? (messages || []).find(
						(message) => message._id === activeThreadRootId
					) || null
				: null,
		[messages, activeThreadRootId]
	);
	const knownMessageIdsRef = useRef<Set<string>>(new Set());
	// Thread-panel-UX (#435): pure summary computation (unit-tested).
	const threadSummariesRaw = useMemo(
		() => computeThreadSummaries(messages || []),
		[messages]
	);
	const threadSummaries = useMemo(() => {
		const map = new Map<
			string,
			{ replyCount: number; lastReplyText: string }
		>();
		threadSummariesRaw.forEach((summary, rootId) => {
			map.set(rootId, {
				replyCount: summary.replyCount,
				// T21: "Autor: letzte Nachricht" on the thread entry.
				lastReplyText: formatThreadEntryPreview(summary)
			});
		});
		return map;
	}, [threadSummariesRaw]);
	// Per-thread unread (#435): device-local approximation, bumped whenever
	// a thread is opened (markThreadRead) so the derived map recomputes.
	const [threadReadVersion, setThreadReadVersion] = useState(0);
	const threadUnreadByRoot = useMemo(() => {
		const map = new Map<string, boolean>();
		if (!resolvedMatrixRoomId) {
			return map;
		}
		threadSummariesRaw.forEach((summary, rootId) => {
			const lastReadTs = getThreadLastReadTs(
				resolvedMatrixRoomId,
				rootId
			);
			map.set(rootId, isThreadUnread(summary.lastReplyTs, lastReadTs));
		});
		return map;
		// threadReadVersion is a change signal only (localStorage isn't reactive).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [threadSummariesRaw, resolvedMatrixRoomId, threadReadVersion]);
	const [isThreadListOpen, setIsThreadListOpen] = useState(false);
	const unreadThreadCount = useMemo(
		() => Array.from(threadUnreadByRoot.values()).filter(Boolean).length,
		[threadUnreadByRoot]
	);
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
				isMatrixRoom(activeSession.rid) ||
					activeSession.item?.matrixRoomId ||
					messageUserId?.includes('@')
			);

			if (isMatrixSession) {
				const matrixClientUserId = matrixClientService
					?.getClient?.()
					?.getUserId?.();
				const myMatrixUserId =
					matrixClientUserId ||
					getCurrentMatrixUserId() ||
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
			// Standard check for sessions that have a group id
			return isMyMessage(messageUserId);
		},
		[
			activeSession.rid,
			activeSession.item?.matrixRoomId,
			userData?.userName,
			matrixClientService
		]
	);

	// Check if current user is a supervisor. The response stays tied to the
	// session that requested it: a late lookup must never expose the previous
	// case's side room to the new session.
	useEffect(() => {
		let cancelled = false;
		const lookupSessionId = activeSession.item.id;
		if (!isSupervisionEnabledForCurrentChat) {
			setIsSupervisor(false);
			setSupervisionReason(null);
			setSupervisionRoomLookup(null);
			setSessionSupervisors([]);
			return () => {
				cancelled = true;
			};
		}
		if (isConsultantUser && lookupSessionId) {
			apiGetSessionSupervisors(lookupSessionId)
				.then((supervisors) => {
					if (cancelled) {
						return;
					}
					const isCurrentUserSupervisor = supervisors.some(
						(s) => s.supervisorConsultantId === userData.userId
					);
					setIsSupervisor(isCurrentUserSupervisor);
					const currentSupervisor = supervisors.find(
						(s) => s.supervisorConsultantId === userData.userId
					);
					setSupervisionReason(currentSupervisor?.notes || null);
					// ADR-008: all supervisor entries share the one per-session
					// supervision side room id — take it from any entry.
					const sideRoomId = supervisors.find(
						(s) => s.matrixRoomId
					)?.matrixRoomId;
					setSupervisionRoomLookup({
						sessionId: lookupSessionId,
						roomId: sideRoomId || undefined
					});
					setSessionSupervisors(supervisors);
				})
				.catch((error) => {
					if (cancelled) {
						return;
					}
					// console.error('Failed to check supervisor status:', error);
					setIsSupervisor(false);
					setSupervisionReason(null);
					setSupervisionRoomLookup({
						sessionId: lookupSessionId,
						roomId: undefined
					});
					setSessionSupervisors([]);
				});
		} else {
			setIsSupervisor(false);
			setSupervisionReason(null);
			setSupervisionRoomLookup(null);
			setSessionSupervisors([]);
		}
		return () => {
			cancelled = true;
		};
	}, [
		activeSession.item.id,
		isConsultantUser,
		isSupervisionEnabledForCurrentChat,
		userData.userId
	]);

	// WP-B2 (#996): resolve the responsible consultant's display name for the
	// supervisor view. First choice is the marker's `counsellorDisplayName`
	// (backend-resolved, never a real name); the by-id lookup stays as the
	// fallback for backends that do not send it yet.
	const counterpartConsultantId = activeSession.consultant?.id;
	const markerCounsellorDisplayName = (
		activeSession.item?.supervision?.counsellorDisplayName ?? ''
	).trim();
	const listDtoHasCounterpartName = Boolean(
		markerCounsellorDisplayName ||
			pickDisplayOrUsername(activeSession.consultant)
	);
	useEffect(() => {
		if (
			!isSupervisor ||
			!counterpartConsultantId ||
			listDtoHasCounterpartName
		) {
			return;
		}
		let cancelled = false;
		apiGetConsultant(counterpartConsultantId, false, true)
			.then((consultant) => {
				if (cancelled || !consultant) {
					return;
				}
				setResolvedCounterpartConsultant({
					id: counterpartConsultantId,
					name: {
						displayName: consultant.displayName,
						username: (consultant as CounterpartNameSource)
							.username,
						userName: consultant.userName
					}
				});
			})
			.catch(() => {
				// Fallback label stays; the panel is still usable.
			});
		return () => {
			cancelled = true;
		};
	}, [isSupervisor, counterpartConsultantId, listDtoHasCounterpartName]);

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
		}
	}, [isAnonymousBreathingGameAvailable]);

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
	 * Confirm the chosen display-name pseudonym for this live-chat session.
	 * The login User-ID is left unchanged so room membership and keys stay intact.
	 */
	const handleConfirmPseudonym = useCallback(() => {
		if (pseudonymSaving) return;
		setPseudonymSaving(true);
		apiPutSessionData(activeSession.item.id, {
			displayName: currentPseudonym.displayName
		})
			.then(() =>
				apiPatchUserData({ displayName: currentPseudonym.displayName })
			)
			.then(() => apiGetUserData().then((fresh) => setUserData(fresh)))
			.then(() => {
				setPseudonymConfirmed(true);
				try {
					sessionStorage.setItem(pseudonymStorageKey, '1');
					sessionStorage.setItem(
						`anonymous-pseudonym-name-${activeSession.item.id}`,
						currentPseudonym.displayName
					);
				} catch {
					/* ignore storage errors */
				}
			})
			.catch(() => {
				/* keep card visible on failure so user can retry */
			})
			.finally(() => setPseudonymSaving(false));
	}, [
		activeSession.item.id,
		currentPseudonym,
		pseudonymSaving,
		pseudonymStorageKey,
		setUserData
	]);

	/**
	 * Poll the live anonymous-enquiry details while the asker is in the
	 * waiting-queue phase. Feeds `queuePeopleAhead` into WaitingQueueActionBar
	 * so "N Personen vor Ihnen" reflects the actual number of anonymous
	 * enquiries queued ahead for the same consulting type.
	 */
	useEffect(() => {
		if (
			!isInAnonymousWaitingQueuePhase ||
			!activeSession.item?.id ||
			enquiryClosed
		) {
			return;
		}

		let cancelled = false;
		const sessionId = activeSession.item.id;
		const hasMatrixRoom = Boolean(activeSession.item?.matrixRoomId);

		const refresh = () => {
			apiGetAnonymousEnquiryDetails(sessionId)
				.then((details) => {
					if (cancelled) return;
					/* DONE/IN_ARCHIVE: the enquiry was finished server-side.
					   Consultants can never see or accept it — stop polling
					   and show the closed notice instead of queue position
					   and availability, which would suggest it is still
					   waiting. */
					if (
						details?.status === 'DONE' ||
						details?.status === 'IN_ARCHIVE'
					) {
						setEnquiryClosed(true);
						return;
					}
					if (typeof details?.peopleAhead === 'number') {
						setQueuePeopleAhead(details.peopleAhead);
					}
					setNumAvailableConsultants(
						typeof details?.numAvailableConsultants === 'number'
							? details.numAvailableConsultants
							: null
					);
					/* Only IN_PROGRESS means a consultant is handling this
					   enquiry. DONE/IN_ARCHIVE must NOT flip the bar — a
					   finished session would otherwise show "Start chat
					   now" over a chat that can never connect. */
					if (details?.status === 'IN_PROGRESS') {
						setConsultantAccepted(true);
						/* Accepting provisions the Matrix room server-side,
						   but the session in memory was loaded before that
						   and still has no matrixRoomId — without it the
						   chat never connects. Reload the session on every
						   poll tick until the room id arrives (acceptance
						   can race the room creation by a moment). */
						if (!hasMatrixRoom) {
							reloadActiveSession?.();
						}
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
	}, [
		isInAnonymousWaitingQueuePhase,
		activeSession.item?.id,
		activeSession.item?.matrixRoomId,
		reloadActiveSession,
		enquiryClosed
	]);

	/**
	 * When an anonymous asker logs out, finish the session so the waiting
	 * queue count drops for everyone else.
	 *
	 * Deliberately NOT bound to pagehide/unload: pagehide also fires on a
	 * plain page refresh or navigation, and finishing there sets the session
	 * to DONE and deactivates the anonymous Keycloak user — permanently
	 * removing the enquiry from the consultant queue while the asker is
	 * still waiting. Abandoned sessions are expired server-side by the
	 * anonymous deactivate workflow instead.
	 */
	useEffect(() => {
		ensureAnonymousChatPreLogoutCleanup();

		if (!isAnonymousAskerExperience || !activeSession.item?.id) {
			registerAnonymousChatSessionForCleanup(null);
			return;
		}

		registerAnonymousChatSessionForCleanup(
			activeSession.item.id,
			activeSession.item.status,
			isMatrixRoomIdHeuristic(activeSession.rid)
				? activeSession.rid
				: activeSession.item?.matrixRoomId,
			userData?.userName
		);
	}, [
		isAnonymousAskerExperience,
		activeSession.item?.id,
		activeSession.item?.status,
		activeSession.item?.matrixRoomId,
		activeSession.rid,
		userData?.userName
	]);

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

	/* Closing the companion unmounts whatever had focus, and focus would fall
	   back to the document — a keyboard user lost their place in the room. So
	   the control that opened it gets it back (the action bar outlives the
	   companion; a robot card's button does not, hence the `isConnected`
	   check). */
	const companionOpenerRef = useRef<HTMLElement | null>(null);

	const handleOpenCalmCompanion = useCallback(() => {
		companionOpenerRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		setShowWaitingMiniGame(true);
	}, []);

	const handleCloseCalmCompanion = useCallback(() => {
		setShowWaitingMiniGame(false);
		const opener = companionOpenerRef.current;
		companionOpenerRef.current = null;
		window.requestAnimationFrame(() => {
			if (opener?.isConnected) {
				opener.focus();
				return;
			}
			const fallback = document.querySelector<HTMLElement>(
				'.waitingQueueActionBar__smiley'
			);
			fallback?.focus();
		});
	}, []);

	const handleDismissConsultantAccepted = useCallback(() => {
		setConsultantAccepted(false);
	}, []);

	/**
	 * Leaving the waiting queue (#893). See `performLeaveQueueDelete` for why
	 * this goes through `finishConversation` and why signing out only happens
	 * once the conversation was really finished.
	 */
	const handleLeaveQueueDelete = useCallback(() => {
		if (isLeavingQueue) {
			return;
		}
		setIsLeavingQueue(true);
		void performLeaveQueueDelete(activeSession.item?.id, {
			onFailure: () => {
				setIsLeavingQueue(false);
				setLeaveQueueFailed(true);
			}
		});
	}, [activeSession.item?.id, isLeavingQueue]);

	const handleStartAcceptedChat = useCallback(() => {
		/* Safety net: if the accepted session still lacks its Matrix room
		   id (reload raced the room provisioning), fetch it again now so
		   the unlocked composer can actually send. */
		if (!activeSession.item?.matrixRoomId) {
			reloadActiveSession?.();
		}
		void import('../messageSubmitInterface/messageSubmitInterfaceComponent')
			.then(() => setWaitingGateDismissed(true))
			.catch(() => setWaitingGateDismissed(true));
	}, [
		activeSession.item?.matrixRoomId,
		reloadActiveSession,
		setWaitingGateDismissed
	]);

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
		if (messages && messages.length > 0 && !initialScrollCompleted) {
			enableInitialScroll();
		}
		// enableInitialScroll is a plain function re-created every render;
		// including it would run this effect on each render instead of on
		// message/scroll-state changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
			// ADR-017 hard cut: thread identity is the m.thread relation only.
			const rootId = message.threadRootEventId;
			if (!rootId) {
				return false;
			}
			if (activeThreadRootId === rootId) {
				return false;
			}
			if (isMyMessageMatrix(message.userId)) {
				return false;
			}
			return true;
		});

		newThreadReplies.forEach((message) => {
			const parsed = parseMessagePrefixes(message.message);
			const rootId = message.threadRootEventId;
			const actionPath = buildSessionChannelPath(
				`${location.pathname}${stripChannelParams(location.search)}`,
				rootId ? { kind: 'thread', rootId } : null,
				message._id
			);
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

	// Hard cut for the legacy `threadRootId` / `threadMessageId` pair
	// (Frank, 05.09.): mapped ONCE to `channel=` / `at=` on entry, never
	// written again.
	useEffect(() => {
		const normalized = normalizeLegacyChannelSearch(location.search);
		if (normalized !== null) {
			navigate(
				{ pathname: location.pathname, search: normalized },
				{ replace: true }
			);
		}
	}, [location.pathname, location.search, navigate]);

	const resetUnreadCount = () => {
		setNewMessages(0);
		initMessageCount = messages?.length;
		// The card is unmounted while the phone shows a side panel full-screen.
		scrollContainerRef.current
			?.querySelectorAll('.messageItem__divider--lastRead')
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

	// "Sending message failed" notifications (Figma 7086-57415): a send that
	// never reached the server surfaces a card at the bottom of the timeline.
	// They are cleared once a later send succeeds. A user-triggered retry is
	// routed through the same composer send pipeline and never loops by itself.
	const [failedSends, setFailedSends] = useState<FailedSend[]>([]);
	const failedSendSequenceRef = useRef(0);
	const activeSessionIdentity = `${activeSession?.rid || 'no-room'}:${
		activeSession?.item?.id || 'no-session'
	}`;
	const activeSessionIdentityRef = useRef(activeSessionIdentity);
	activeSessionIdentityRef.current = activeSessionIdentity;
	const [retryRequest, setRetryRequest] = useState<{
		requestId: string;
		failedSendId: string;
		message: string;
		threadRootId?: string | null;
		sessionIdentity: string;
		transportMessage: string;
		isAside: boolean;
		replyToEventId?: string | null;
		mentionedUserIds: string[];
		targetRoomId?: string | null;
	} | null>(null);
	// Read the live retry request inside the (non-memoised) success handler,
	// which the composer may invoke from a closure captured a render earlier.
	const retryRequestRef = useRef(retryRequest);
	retryRequestRef.current = retryRequest;
	const handleSendError = useCallback(
		(
			message: string,
			ts: number,
			retryOfId?: string,
			threadRootId?: string | null,
			sessionIdentity?: string,
			transportMessage = message,
			isAside = false,
			replyToEventId?: string | null,
			mentionedUserIds: string[] = [],
			targetRoomId: string | null = null
		) => {
			if (
				sessionIdentity &&
				sessionIdentity !== activeSessionIdentityRef.current
			) {
				return;
			}
			failedSendSequenceRef.current += 1;
			const nextFailureId = `send-failed-${ts}-${failedSendSequenceRef.current}`;
			setFailedSends((previous) => {
				if (retryOfId) {
					const retryTargetExists = previous.some(
						(failed) => failed.id === retryOfId
					);
					if (retryTargetExists) {
						return previous.map((failed) =>
							failed.id === retryOfId
								? {
										...failed,
										message,
										ts,
										transportMessage,
										isAside,
										replyToEventId,
										mentionedUserIds,
										targetRoomId
									}
								: failed
						);
					}
				}
				return [
					...previous,
					{
						id: nextFailureId,
						message,
						ts,
						threadRootId: threadRootId || null,
						transportMessage,
						isAside,
						replyToEventId: replyToEventId || null,
						mentionedUserIds,
						targetRoomId: targetRoomId || null
					}
				];
			});
		},
		[]
	);
	const handleRetryFailedSend = useCallback(
		(failedSendId: string) => {
			setRetryRequest((current) => {
				if (current) {
					return current;
				}
				const failed = failedSends.find(
					(entry) => entry.id === failedSendId
				);
				return failed
					? {
							requestId: `retry-${failedSendId}-${Date.now()}`,
							failedSendId,
							message: failed.message,
							threadRootId: failed.threadRootId || null,
							sessionIdentity: activeSessionIdentityRef.current,
							transportMessage: failed.transportMessage,
							isAside: failed.isAside,
							replyToEventId: failed.replyToEventId || null,
							mentionedUserIds: failed.mentionedUserIds,
							targetRoomId: failed.targetRoomId || null
						}
					: null;
			});
		},
		[failedSends]
	);
	const handleRetrySettled = useCallback(
		(requestId: string, sessionIdentity: string) => {
			if (sessionIdentity !== activeSessionIdentityRef.current) {
				return;
			}
			setRetryRequest((current) =>
				current?.requestId === requestId ? null : current
			);
		},
		[]
	);
	const handleComposerSendError = useCallback(
		(
			message: string,
			ts: number,
			retryOfId?: string,
			threadRootId?: string | null,
			transportMessage?: string,
			isAside?: boolean,
			replyToEventId?: string | null,
			mentionedUserIds?: string[],
			targetRoomId?: string | null
		) =>
			handleSendError(
				message,
				ts,
				retryOfId,
				threadRootId,
				activeSessionIdentity,
				transportMessage,
				isAside,
				replyToEventId,
				mentionedUserIds,
				targetRoomId ?? null
			),
		[activeSessionIdentity, handleSendError]
	);
	const handleComposerRetrySettled = useCallback(
		(requestId: string) =>
			handleRetrySettled(requestId, activeSessionIdentity),
		[activeSessionIdentity, handleRetrySettled]
	);

	// Drop stale failure cards when the conversation changes.
	useEffect(() => {
		setFailedSends([]);
		setRetryRequest(null);
	}, [activeSessionIdentity]);

	const handleMessageSendSuccess = (
		sessionIdentity = activeSessionIdentity
	) => {
		if (sessionIdentity !== activeSessionIdentityRef.current) {
			return;
		}
		setDraggedFile(null);
		// A retry that succeeded resolves only its own card; a fresh successful
		// send must leave any other preserved failure cards intact — each holds
		// the sole copy of an un-sent message the user may still want to retry.
		const resolvedRetry = retryRequestRef.current;
		if (resolvedRetry) {
			setFailedSends((previous) =>
				previous.filter(
					(failed) => failed.id !== resolvedRetry.failedSendId
				)
			);
		}
		setRetryRequest(null);

		if (props.refreshMessages) {
			setTimeout(() => {
				props.refreshMessages();
			}, 500);
		}
	};

	// Route writer (B2 / T24): opening a channel PUSHES a history entry
	// (browser Back closes the panel), switching REPLACES it, closing
	// removes the param. The last open channel is remembered per session.
	const locationRef = useRef(location);
	locationRef.current = location;
	const sessionIdForChannelMemory = activeSession.item?.id;
	const setChannelRoute = useCallback(
		(channel: SessionChannel | null, mode: 'push' | 'replace') => {
			const current = locationRef.current;
			const search = withChannel(current.search, channel);
			writeLastChannel(
				safeChannelStorage(),
				sessionIdForChannelMemory,
				channel
			);
			if (search === (current.search || '')) {
				return;
			}
			navigate(
				{ pathname: current.pathname, search },
				{ replace: mode === 'replace' }
			);
		},
		[navigate, sessionIdForChannelMemory]
	);
	// Review v6: a pick from the FAB hands focus to the panel header's
	// channel button (the FAB unmounts with the pick).
	const [focusPanelHeader, setFocusPanelHeader] = useState(false);
	const openChannel = useCallback(
		(channel: SessionChannel, source: 'fab' | 'header' = 'header') => {
			setFocusPanelHeader(source === 'fab');
			setChannelRoute(channel, routeChannel ? 'replace' : 'push');
		},
		[setChannelRoute, routeChannel]
	);
	const closeChannel = useCallback(() => {
		setFocusPanelHeader(false);
		setChannelRoute(null, 'replace');
	}, [setChannelRoute]);
	const selectChannelFromHeader = useCallback(
		(id: string) => openChannel(channelFromId(id), 'header'),
		[openChannel]
	);
	const selectChannelFromFab = useCallback(
		(id: string) => openChannel(channelFromId(id), 'fab'),
		[openChannel]
	);

	const handleOpenThread = useCallback(
		(message: MessageItem) => {
			openChannel({ kind: 'thread', rootId: message._id }, 'header');
			setIsThreadListOpen(false);
			// Per-thread unread (#435): opening a thread marks it read up to
			// its current last reply.
			const summary = threadSummariesRaw.get(message._id);
			if (resolvedMatrixRoomId && summary) {
				markThreadRead(
					resolvedMatrixRoomId,
					message._id,
					summary.lastReplyTs
				);
				setThreadReadVersion((version) => version + 1);
			}
		},
		[threadSummariesRaw, resolvedMatrixRoomId, openChannel]
	);

	const handleCloseThread = useCallback(() => {
		closeChannel();
	}, [closeChannel]);

	// ------------------------------------------------------------------
	// B2: side channels (supervision side room + native threads) — the
	// stage composition (`chatStage/__storybook__/ConsultantSessionStage`)
	// wired to real data. One `SidePanel` for both, one URL param as truth.
	// ------------------------------------------------------------------
	const supervisionMessages = props.supervisionMessages;
	// Consultants and supervisors only — an asker is never a member of the
	// side room and never gets the supervision channel, whatever the props
	// say (checklist 9: wiring rule, no component guard).
	const isSupervisionPanelViewer =
		isConsultantUser &&
		!isAskerUser &&
		!activeSession.isGroup &&
		!isEmbeddedNotificationsView;
	const hasSupervisionSideRoom =
		isSupervisionPanelViewer && !!supervisionRoomId;
	// Teamberatung: the SAME viewer rule as supervision — consultants, never
	// an asker, never a group, never the embedded notifications view — plus a
	// resolved room id. `SessionStream` only resolves that id for consultants
	// of the enquiry's agency, so this is a second lock on the same door.
	const teamRoomId = props.teamRoomId;
	const teamMessages = props.teamMessages;
	const hasTeamSideRoom = isSupervisionPanelViewer && !!teamRoomId;

	// ONE breakpoint source for the phone layout (checklist 5): the app's
	// `fromL` (900 px) = `STAGE_LAYOUT.DESKTOP_MIN_WIDTH`.
	const { fromL } = useResponsive();
	const isPhoneLayout = !fromL;

	// The panel the URL asks for, resolved against what exists. A thread
	// whose root is not in the loaded history keeps the main chat open
	// (analysis F3 — fetching the root is a follow-up).
	const openPanel: 'supervision' | 'team' | 'thread' | null =
		routeChannel?.kind === 'supervision'
			? hasSupervisionSideRoom
				? 'supervision'
				: null
			: routeChannel?.kind === 'team'
				? hasTeamSideRoom
					? 'team'
					: null
				: activeThreadRootId && activeThreadRootMessage
					? 'thread'
					: null;
	const shownChannelId =
		openPanel === 'supervision'
			? channelId({ kind: 'supervision' })
			: openPanel === 'team'
				? channelId({ kind: 'team' })
				: openPanel === 'thread' && activeThreadRootId
					? activeThreadRootId
					: undefined;
	// The list column snaps to the rail for the pane that is REALLY open
	// (review D-4) — report the resolved pane, clear it on unmount.
	const reportChatStagePanel = useReportChatStagePanel();
	useEffect(() => {
		reportChatStagePanel(openPanel);
		return () => reportChatStagePanel(null);
	}, [openPanel, reportChatStagePanel]);

	// `?at=<eventId>` (review D-6): once the bubble is in the DOM — main
	// chat or the open pane — scroll it into view and consume the param
	// (`replace`, the channel stays). Best effort: an event that is not in
	// the loaded history is simply left alone, no error; a later timeline
	// change retries until the param is gone.
	const consumedAtRef = useRef<string | null>(null);
	useEffect(() => {
		if (!routeAt || consumedAtRef.current === routeAt) {
			return;
		}
		const card =
			scrollContainerRef.current?.closest<HTMLElement>('.session') ??
			null;
		const scope: ParentNode = card ?? document;
		const target = Array.from(
			scope.querySelectorAll<HTMLElement>('[data-message-id]')
		).find((element) => element.dataset.messageId === routeAt);
		if (!target) {
			return;
		}
		consumedAtRef.current = routeAt;
		target.scrollIntoView?.({ block: 'center' });
		const current = locationRef.current;
		navigate(
			{
				pathname: current.pathname,
				search: stripAtParam(current.search)
			},
			{ replace: true }
		);
		// messages / supervisionMessages / openPanel are the retry triggers:
		// they change when the bubble may have appeared.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [routeAt, messages, supervisionMessages, openPanel, navigate]);

	// No param on entry: reopen the last channel of this session; a
	// remembered close stays closed; nothing remembered → the side room
	// auto-opens once (today's behaviour), never for askers. Entering WITH
	// a param (deep link) settles the session at once, so browser Back
	// lands on the closed main chat instead of re-opening (review D-3).
	// The decision itself is pure: `decideAutoOpen` (channelRoute.ts).
	const autoOpenedForSessionRef = useRef<string | number | null>(null);
	useEffect(() => {
		const sessionId = activeSession.item?.id;
		if (!sessionId || !isSupervisionPanelViewer) {
			return;
		}
		const decision = decideAutoOpen({
			routeChannel,
			alreadySettled: autoOpenedForSessionRef.current === sessionId,
			remembered: readLastChannel(safeChannelStorage(), sessionId),
			loadedRootIds: messages
				? messages.map((message) => message._id)
				: null,
			hasSupervisionSideRoom,
			hasTeamSideRoom
		});
		if (decision.settle) {
			autoOpenedForSessionRef.current = sessionId;
		}
		if (decision.open) {
			setChannelRoute(decision.open, 'replace');
		}
	}, [
		activeSession.item?.id,
		routeChannel,
		isSupervisionPanelViewer,
		hasSupervisionSideRoom,
		hasTeamSideRoom,
		messages,
		setChannelRoute
	]);

	// Unread side-room messages: foreign items newer than the last time the
	// supervision channel was on screen; 0 while it is.
	const [supervisionSeenAt, setSupervisionSeenAt] = useState(0);
	useEffect(() => {
		if (hasSupervisionSideRoom) {
			setSupervisionSeenAt(Date.now());
		}
	}, [hasSupervisionSideRoom, activeSession.item?.id]);
	useEffect(() => {
		if (openPanel === 'supervision') {
			setSupervisionSeenAt(Date.now());
		}
	}, [openPanel, supervisionMessages]);
	const supervisionUnreadCount = useMemo(
		() =>
			countUnreadSideRoomMessages(
				supervisionMessages,
				{
					status:
						openPanel === 'supervision' ? 'expanded' : 'collapsed',
					lastExpandedAt: supervisionSeenAt
				},
				isMyMessageMatrix
			),
		[supervisionMessages, openPanel, supervisionSeenAt, isMyMessageMatrix]
	);

	// The same three steps for the team room — one counter each, so an
	// unread badge on one channel never silences the other.
	const [teamSeenAt, setTeamSeenAt] = useState(0);
	useEffect(() => {
		if (hasTeamSideRoom) {
			setTeamSeenAt(Date.now());
		}
	}, [hasTeamSideRoom, activeSession.item?.id]);
	useEffect(() => {
		if (openPanel === 'team') {
			setTeamSeenAt(Date.now());
		}
	}, [openPanel, teamMessages]);
	const teamUnreadCount = useMemo(
		() =>
			countUnreadSideRoomMessages(
				teamMessages,
				{
					status: openPanel === 'team' ? 'expanded' : 'collapsed',
					lastExpandedAt: teamSeenAt
				},
				isMyMessageMatrix
			),
		[teamMessages, openPanel, teamSeenAt, isMyMessageMatrix]
	);

	// New side-room message from someone else while no panel is open:
	// desktop re-opens the supervision channel (auto re-open); the phone
	// only lets the FAB show the unread badge. History arriving on
	// hydration is not "new" — the first list seeds the known ids.
	const knownSideRoomIdsRef = useRef<Set<string> | null>(null);
	useEffect(() => {
		if (!hasSupervisionSideRoom) {
			knownSideRoomIdsRef.current = null;
			return;
		}
		const list = supervisionMessages || [];
		if (knownSideRoomIdsRef.current === null) {
			knownSideRoomIdsRef.current = new Set(list.map((m) => m._id));
			return;
		}
		const unseen = findUnseenMessages(list, knownSideRoomIdsRef.current);
		if (unseen.length === 0) {
			return;
		}
		unseen.forEach((m) => knownSideRoomIdsRef.current?.add(m._id));
		const fresh = unseen.filter(
			(m) =>
				Number(m.messageTime) > supervisionSeenAt &&
				!isMyMessageMatrix(m.userId)
		);
		if (fresh.length === 0 || openPanel !== null || isPhoneLayout) {
			return;
		}
		setChannelRoute({ kind: 'supervision' }, 'replace');
		// supervisionSeenAt / openPanel are read, not reacted to: a change of
		// them must not re-run the new-message detection.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		supervisionMessages,
		hasSupervisionSideRoom,
		isMyMessageMatrix,
		isPhoneLayout,
		setChannelRoute
	]);

	// Counterpart: the supervisor for the consultant (list DTO display name,
	// else the username from the supervisors call); the responsible
	// consultant for the supervisor (marker counsellorDisplayName, else the
	// list DTO name, else the by-id lookup).
	const supervisionCounterpartName = useMemo(() => {
		if (isSupervisor) {
			const resolved =
				resolvedCounterpartConsultant?.id === counterpartConsultantId
					? resolvedCounterpartConsultant.name
					: null;
			return pickSupervisionCounterpartName({
				role: 'supervisor',
				counsellorDisplayName: markerCounsellorDisplayName,
				consultant: pickDisplayOrUsername(activeSession.consultant)
					? activeSession.consultant
					: resolved,
				fallback: translate('sessionList.user.consultantUnknown')
			});
		}
		return pickSupervisionCounterpartName({
			role: 'consultant',
			supervisorDisplayNames: getSupervisorDisplayNames(activeSession),
			supervisorUsernames,
			fallback: translate('supervision.panel.title')
		});
	}, [
		activeSession,
		isSupervisor,
		supervisorUsernames,
		resolvedCounterpartConsultant,
		counterpartConsultantId,
		markerCounsellorDisplayName,
		translate
	]);

	const clientDisplayName =
		getContact(activeSession)?.username ||
		translate('sessionList.user.consultantUnknown');

	// Teamberatung words (Frank, 09.09.). The i18n catalogue is on a drift
	// budget of 0, so the German originals travel with the call through the
	// copy map and `translate(key, fallback)` — no locale file is touched.
	const teamText = teamCopy(translate);
	const teamChannelTitle = teamText('chatStage.panel.team.title');

	// T20: the newest message of a channel — orders the menu, feeds the
	// "Author: text…" preview.
	const lastMessageOf = useCallback((list: MessageItem[] | undefined) => {
		const last = list?.[list.length - 1];
		if (!last) {
			return undefined;
		}
		return {
			author: last.displayName || last.username || '',
			text: toMessagePreviewText(last.message),
			ts: Number(last.messageTime)
		};
	}, []);

	// Secondary channels of this session — the supervision side room (for
	// consultants and supervisors only) and every native thread
	// (`computeThreadSummaries`: root creation ts, last reply author/text).
	const secondaryChannels = useMemo<SecondaryChannel[]>(() => {
		const threads: SecondaryChannel[] = isThreadsEnabled
			? Array.from(threadSummariesRaw.values()).map((summary) => {
					const root = (messages || []).find(
						(message) => message._id === summary.rootId
					);
					const topic = summary.rootPreview
						? `${summary.rootPreview.slice(0, 28)}…`
						: translate('chatStage.panel.thread.title');
					return {
						id: summary.rootId,
						kind: 'thread' as const,
						label: resolveChannelLabel(
							{
								kind: 'thread',
								topic,
								person: root?.displayName || root?.username
							},
							'person'
						),
						unread:
							threadUnreadByRoot.get(summary.rootId) === true
								? 1
								: 0,
						createdTs: root ? Number(root.messageTime) : undefined,
						lastMessage: summary.lastReplyTs
							? {
									author: summary.lastReplyAuthor,
									text: summary.lastReplyPreview,
									ts: summary.lastReplyTs
								}
							: undefined
					};
				})
			: [];
		const sideRooms: SecondaryChannel[] = [];
		if (hasSupervisionSideRoom) {
			sideRooms.push({
				id: channelId({ kind: 'supervision' }),
				kind: 'supervision' as const,
				label: resolveChannelLabel(
					{
						kind: 'supervision',
						topic: translate('supervision.panel.title'),
						person: supervisionCounterpartName
					},
					'person'
				),
				unread: supervisionUnreadCount,
				lastMessage: lastMessageOf(supervisionMessages)
			});
		}
		if (hasTeamSideRoom) {
			// The team room has no single counterpart — it is the team. So
			// the label is the topic word, not a person (the same
			// `resolveChannelLabel` seam, the other mode).
			sideRooms.push({
				id: channelId({ kind: 'team' }),
				kind: 'team' as const,
				label: resolveChannelLabel(
					{ kind: 'team', topic: teamChannelTitle },
					'topic'
				),
				unread: teamUnreadCount,
				lastMessage: lastMessageOf(teamMessages)
			});
		}
		return [...threads, ...sideRooms];
	}, [
		isThreadsEnabled,
		threadSummariesRaw,
		messages,
		threadUnreadByRoot,
		hasSupervisionSideRoom,
		supervisionCounterpartName,
		supervisionUnreadCount,
		supervisionMessages,
		hasTeamSideRoom,
		teamChannelTitle,
		teamUnreadCount,
		teamMessages,
		lastMessageOf,
		translate
	]);
	// Channels not on screen — the desktop FAB (while no panel is open)
	// offers these; the panel header's menu lists all of them (T15).
	const otherChannels = useMemo(
		() =>
			secondaryChannels.filter(
				(channel) => channel.id !== shownChannelId
			),
		[secondaryChannels, shownChannelId]
	);

	// Room participants for the panel headers (the same avatar stack the
	// session header renders, `headerParticipants.ts`).
	// ADR-002 silent membership: the rooms list every counsellor of the
	// agency; the panels show only the asker, the assigned consultant and
	// the active supervisors (thread = main room) or the counterpart and me
	// (supervision room). Silent members never appear, "+N" counts only
	// visible people (`visibleParticipants.ts`).
	const supervisionMarker = activeSession.item?.supervision;
	const stackParticipantsOf = useCallback(
		(
			roomId: string | null | undefined,
			mode: 'session' | 'supervision' | 'team'
		): StackParticipant[] => {
			const client = matrixClientService?.getClient?.();
			const room = roomId ? client?.getRoom?.(roomId) : null;
			if (!room) {
				return [];
			}
			const lastActivity = seedLastActivity(
				room.getLiveTimeline?.()?.getEvents?.() ?? []
			);
			const members = toStackParticipants(
				room.getJoinedMembers?.() ?? [],
				lastActivity,
				{
					askerMatrixUserId: activeSession.item?.askerMatrixUserId,
					askerDisplayName: clientDisplayName,
					isSystemUser: isSystemMatrixUser
				}
			);
			return filterVisibleParticipants(
				members,
				buildVisibleParticipantRules({
					mode,
					isGroup: activeSession.isGroup,
					marker: supervisionMarker,
					supervisors: sessionSupervisors,
					selfIsSupervisor: isSupervisor,
					askerIds: [
						activeSession.item?.askerMatrixUserId,
						activeSession.user?.username
					],
					consultant: activeSession.consultant,
					consultantMatrixUserId:
						activeSession.item?.consultantMatrixUserId,
					self: {
						ids: [
							userData?.userName,
							userData?.userId,
							client?.getUserId?.(),
							getCurrentMatrixUserId()
						],
						displayName: userData?.displayName || undefined
					}
				})
			);
		},
		[
			matrixClientService,
			activeSession.item?.askerMatrixUserId,
			activeSession.item?.consultantMatrixUserId,
			activeSession.user?.username,
			activeSession.consultant,
			activeSession.isGroup,
			supervisionMarker,
			sessionSupervisors,
			isSupervisor,
			userData,
			clientDisplayName
		]
	);
	const threadParticipants = useMemo(
		() => stackParticipantsOf(resolvedMatrixRoomId, 'session'),
		// messages: re-read the room members whenever the timeline changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[stackParticipantsOf, resolvedMatrixRoomId, messages]
	);
	const supervisionParticipants = useMemo(
		() => stackParticipantsOf(supervisionRoomId, 'supervision'),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[stackParticipantsOf, supervisionRoomId, supervisionMessages]
	);
	// Teamberatung: the room's own members ARE the team — the `team` rule
	// shows them all and drops only the advice seeker, who is never invited
	// (`visibleParticipants.ts`).
	const teamParticipants = useMemo(
		() => stackParticipantsOf(teamRoomId, 'team'),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[stackParticipantsOf, teamRoomId, teamMessages]
	);

	// Frank, 09.09.2026: "auch braucht die supervision die möglichkeit das man
	// einen call haben kann entweder video oder audio". Same trigger as the
	// main chat (`call/startRoomCall.ts`), same tenant gate
	// (`call/callFeatureGates.ts`) — only the room differs: the call goes to
	// the SIDE room, so its Element Call room is created from
	// `supervisionRoomId` and admits exactly that room's members.
	const supervisionCallGates =
		resolveSupervisionCallFeatureGates(getTenantSettings());
	// Role/session eligibility is separate from the feature-policy helper.
	// Supervision intentionally does not inherit the client-facing consulting-
	// type gate; it is an internal room with dedicated tenant flags.
	const mayCallInSideRoom =
		isConsultantUser && !isOnlyEnquiry && !activeSession.isEnquiry;
	const startSupervisionCall = useCallback(
		(isVideo: boolean) => {
			startRoomCall({
				roomId: supervisionRoomId,
				isVideo,
				// Consultant + supervisor is a 1:1 call; a second supervisor
				// makes it a group one. Never `undefined`: the CallManager's
				// auto-detection filters power-level-10 members — the
				// supervisors — out of its own head count.
				isGroup: supervisionParticipants.length > 2
			});
		},
		[supervisionRoomId, supervisionParticipants.length]
	);

	// T7: the side room opens with the system notice "Supervision durch
	// {name} ist aktiv …" as its first item (frontend-rendered, exactly as
	// on the stage; never counted as unread).
	const supervisionTimelineMessages = useMemo<MessageItem[]>(() => {
		if (!hasSupervisionSideRoom) {
			return [];
		}
		const supervisorName = isSupervisor
			? userData?.displayName || userData?.userName || ''
			: supervisionCounterpartName;
		return buildSupervisionTimeline(supervisionMessages, {
			roomId: supervisionRoomId || '',
			title: translate('supervision.panel.title'),
			description: translate('supervision.panel.systemNotice', {
				name: supervisorName
			}),
			askerMatrixUserId: activeSession.item?.askerMatrixUserId
		});
	}, [
		hasSupervisionSideRoom,
		supervisionMessages,
		supervisionRoomId,
		isSupervisor,
		userData?.displayName,
		userData?.userName,
		supervisionCounterpartName,
		activeSession.item?.askerMatrixUserId,
		translate
	]);

	// T7, for the team room: the same builder, the same system-notice
	// organism — only the words differ. Nothing new was invented for it.
	const teamTimelineMessages = useMemo<MessageItem[]>(() => {
		if (!hasTeamSideRoom) {
			return [];
		}
		return buildSupervisionTimeline(teamMessages, {
			roomId: teamRoomId || '',
			title: teamChannelTitle,
			description: teamText('chatStage.panel.team.systemNotice'),
			askerMatrixUserId: activeSession.item?.askerMatrixUserId
		});
		// teamText is rebuilt each render from `translate` (stable per locale).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		hasTeamSideRoom,
		teamMessages,
		teamRoomId,
		teamChannelTitle,
		activeSession.item?.askerMatrixUserId,
		translate
	]);

	// T2: the side panel's width — dragged, clamped to both panes' floor,
	// persisted (`chatStage_panelWidth`, like the list's `sessionsList_width`).
	const [cardRef, cardBounds] = useMeasure({ polyfill: ResizeObserver });
	const cardWidth = Math.round(cardBounds.width);
	const [panelWidthRaw, setPanelWidthRaw] = useState(() =>
		readPanelWidth(STAGE_LAYOUT.MIN_PANE_WIDTH)
	);
	const panelWidth =
		cardWidth > 0
			? clampPanelWidth(panelWidthRaw, cardWidth)
			: panelWidthRaw;
	const handlePanelResize = useCallback(
		(requested: number) => {
			const next =
				cardWidth > 0
					? clampPanelWidth(requested, cardWidth)
					: requested;
			setPanelWidthRaw(next);
			writePanelWidth(next);
		},
		[cardWidth]
	);

	// Main pane: the FAB clears the docked composer; on the phone it steps
	// back while the composer has focus (T10).
	const mainPaneRef = useRef<HTMLDivElement | null>(null);
	const fabOffset = useDockedComposerOffset(mainPaneRef);
	const composing = useComposerFocus(mainPaneRef);

	// D7 (phone): the composer's back arrow does what the header's Link
	// did — list route AND `mobileListView()`.
	const sessionListTabParam = new URLSearchParams(location.search).get(
		'sessionListTab'
	);
	const handleMobileNavigateToList = useCallback(() => {
		navigate(
			listPath +
				(sessionListTabParam
					? `?sessionListTab=${sessionListTabParam}`
					: '')
		);
		mobileListView();
	}, [navigate, listPath, sessionListTabParam]);

	const supervisionPanelContextValue = useMemo<SupervisionPanelContextValue>(
		() => ({
			visible: isSupervisionPanelViewer,
			available: hasSupervisionSideRoom,
			isExpanded: openPanel === 'supervision',
			unreadCount: supervisionUnreadCount,
			expand: () => openChannel({ kind: 'supervision' }, 'header')
		}),
		[
			isSupervisionPanelViewer,
			hasSupervisionSideRoom,
			openPanel,
			supervisionUnreadCount,
			openChannel
		]
	);

	const getMessageById = useCallback(
		(id: string): MessageItem | null =>
			(messages || []).find((candidate) => candidate._id === id) || null,
		[messages]
	);

	// Relations foundation (#435): direct-reply context for the composer.
	const [replyTo, setReplyTo] = useState<{
		eventId: string;
		author: string;
		text: string;
	} | null>(null);

	const handleReplyDirect = useCallback((message: MessageItem) => {
		setReplyTo(buildReplyQuoteContext(message));
	}, []);

	const handleCancelReply = useCallback(() => setReplyTo(null), []);

	// Editing (m.replace, #435): edit-in-progress context for the composer.
	const [editingMessage, setEditingMessage] = useState<{
		eventId: string;
		text: string;
	} | null>(null);

	const handleEditDirect = useCallback((message: MessageItem) => {
		setEditingMessage(buildEditContext(message));
	}, []);

	const handleDeleteDirect = useCallback(
		(message: MessageItem) => {
			if (!resolvedMatrixRoomId || !message?._id) {
				return;
			}
			chatTransportService
				.redactMessage({
					matrixRoomId: resolvedMatrixRoomId,
					targetEventId: message._id
				})
				.catch(() => undefined);
		},
		[resolvedMatrixRoomId]
	);

	const handleCancelEdit = useCallback(() => setEditingMessage(null), []);

	// A reply or edit context never survives a conversation switch.
	useEffect(() => {
		setReplyTo(null);
		setEditingMessage(null);
	}, [activeSession?.rid]);

	// Resolve the quote of a replied-to message from the loaded timeline; a
	// reply whose target is outside the loaded window degrades to a generic
	// quote label inside the item.
	const resolveReplyQuote = useCallback(
		(replyToEventId?: string | null) => {
			if (!replyToEventId) {
				return null;
			}
			const target = (messages || []).find(
				(candidate: MessageItem) => candidate._id === replyToEventId
			);
			if (!target) {
				return null;
			}
			return buildReplyQuotePreview(target);
		},
		[messages]
	);

	// If threads become disabled while a thread panel is open, close it immediately.
	useEffect(() => {
		if (!isThreadsEnabled && activeThreadRootId) {
			handleCloseThread();
		}
	}, [isThreadsEnabled, activeThreadRootId, handleCloseThread]);

	// Register the session's Matrix room with the backend event listener
	// (fire-and-forget, deduped per app lifetime). The listener syncs as its
	// technical admin and only sees rooms it has joined — the backend heals
	// that membership on registration, which is what makes message
	// notifications work for this session at all.
	useEffect(() => {
		const sessionId = activeSession.item?.id;
		if (!sessionId || activeSession.isGroup) {
			return;
		}
		apiRegisterMatrixRoomForSync(sessionId);
	}, [activeSession.item?.id, activeSession.isGroup]);

	useEffect(() => {
		if (isAskerUser && !isConsultantUser) {
			return;
		}
		if (
			!isNotificationActiveViewRoute(location.pathname, location.search)
		) {
			return;
		}
		const roomId =
			(isMatrixRoom(activeSession.rid)
				? activeSession.rid
				: activeSession.item?.matrixRoomId ||
					activeSession.rid ||
					null) || null;
		if (!roomId) {
			return;
		}

		let disposed = false;
		const markActive = () => {
			// clearInterval cannot cancel a callback that is already queued. The
			// guard prevents that stale heartbeat from racing after cleanup and
			// re-enabling suppression while the user is on Notifications.
			if (disposed) {
				return;
			}
			apiPatchNotificationActiveView({
				roomId,
				threadRootId: activeThreadRootId,
				active: true
			}).catch(() => undefined);
		};

		markActive();

		const heartbeat = window.setInterval(() => {
			markActive();
		}, 10000);

		return () => {
			disposed = true;
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
		isConsultantUser,
		location.pathname,
		location.search
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

	const desktopPanelOpen = !isPhoneLayout && openPanel !== null;
	// B2: the stage's main pane — header · timeline · composer · FAB — its
	// own positioning context, so the composer docks to the pane. The card
	// (`.session.chatStage__card`) wraps it together with the side panel
	// below (`cardWithPanel`).
	const sessionCard = (
		<>
			<div
				className="chatStage__mainPane"
				ref={mainPaneRef}
				data-cy="stage-main"
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
							hideBackButton={isPhoneLayout}
							callsInMenu={isPhoneLayout}
						/>
					)}
				</div>

				{/* Thread-panel-UX (#435): per-room list of all threads. */}
				{!isEmbeddedNotificationsView &&
					isThreadsEnabled &&
					threadSummariesRaw.size > 0 && (
						<div className="session__threadListBar">
							<button
								type="button"
								className={clsx(
									'session__threadListToggle',
									isThreadListOpen &&
										'session__threadListToggle--active'
								)}
								onClick={() =>
									setIsThreadListOpen((open) => !open)
								}
							>
								{translate(
									'message.thread.listToggle',
									'Threads'
								)}
								{' ('}
								{threadSummariesRaw.size}
								{')'}
								{unreadThreadCount > 0 && (
									<span className="session__threadListUnreadBadge">
										{unreadThreadCount}
									</span>
								)}
							</button>
							{isThreadListOpen && (
								<ThreadListPanel
									summaries={Array.from(
										threadSummariesRaw.values()
									).sort(
										(a, b) => b.lastReplyTs - a.lastReplyTs
									)}
									unreadRootIds={
										new Set(
											Array.from(
												threadUnreadByRoot.entries()
											)
												.filter(([, unread]) => unread)
												.map(([rootId]) => rootId)
										)
									}
									unknownRootLabel={translate(
										'message.thread.unknownRoot',
										'Frühere Nachricht'
									)}
									repliesLabel={(count) =>
										translate(
											'message.thread.replies',
											'{{count}} replies',
											{ count }
										)
									}
									onSelectRoot={(rootId) => {
										const rootMessage =
											getMessageById(rootId);
										if (rootMessage) {
											handleOpenThread(rootMessage);
										}
									}}
								/>
							)}
						</div>
					)}

				<div
					id="session-scroll-container"
					className={clsx(
						'session__content',
						isDragging && 'drag-in-progress',
						shouldLockScroll && 'session__content--gameLockScroll',
						shouldFadeSessionChrome &&
							'session__content--gameFocus',
						shouldShowConsentGate &&
							'session__content--consentGate',
						shouldShowPseudonymGate &&
							'session__content--pseudonymGate'
					)}
					ref={scrollContainerRef}
					onScroll={(e) => handleScroll(e)}
					onDragEnter={onDragEnter}
				>
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
						!consultantAccepted &&
						showWaitingMiniGame && (
							<div
								className="session__waitingCompanionInline"
								role="region"
								aria-label={translate(
									'liveChat.breathing.title',
									'Ihre Atempause'
								)}
							>
								{/* The breathing companion (single-file handoff, 2026-09-06)
								    replaced the level-and-briefing mini game that used to live
								    here; the mini game's state, effects and copy are gone.
								    `isAnonymousBreathingGameAvailable` is derived from modality
								    and roles alone, so it stays true after a counsellor accepts —
								    `!consultantAccepted` is what honours the companion's host
								    contract ("When counselling starts, UNMOUNT the component"),
								    releasing its audio and animation frames. Same condition the
								    live chat entry room uses: `companion && !accepted`.
								    It renders inline in the white session content column (no
								    backdrop, no modal) and takes the place of the robot cards. */}
								<BreathingCompanionHost
									onClose={handleCloseCalmCompanion}
								/>
							</div>
						)}
					{!shouldBlockAnonymousInquiryChat && (
						<div className={'message-holder'}>
							{shouldShowRobotMessages &&
								!showWaitingMiniGame &&
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
																{
																	card.description
																}
															</div>
															<button
																type="button"
																className="session__robotSystemInlinePlayButton"
																onClick={(
																	event
																) => {
																	event.preventDefault();
																	event.stopPropagation();
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
															onClick={(
																event
															) => {
																event.preventDefault();
																event.stopPropagation();
																navigate(
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
							{messages && (ready || !activeSession.rid) && (
								<MessageTimeline
									messages={messages}
									renderMode="main"
									clientName={
										getContact(activeSession)?.username ||
										translate(
											'sessionList.user.consultantUnknown'
										)
									}
									askerMatrixUserIdFor={(message) =>
										!activeSession.rid &&
										message.userId &&
										!message.userId.includes(
											activeSession.consultant
												?.username || ''
										)
											? message.userId
											: activeSession.item
													.askerMatrixUserId
									}
									isOnlyEnquiry={isOnlyEnquiry}
									isMyMessage={isMyMessageMatrix}
									isUserBanned={(username) =>
										props.bannedUsers.includes(username)
									}
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
									decryptionFailures={decryptionFailures}
									showDecryptionCardFor={(message) =>
										!isThreadsEnabled ||
										!message.threadRootEventId
									}
									threadsEnabled={isThreadsEnabled}
									threadSummaryFor={(id) =>
										threadSummaries.get(id)
									}
									onOpenThread={
										isThreadsEnabled
											? handleOpenThread
											: undefined
									}
									resolveReplyQuote={resolveReplyQuote}
									onReplyDirect={handleReplyDirect}
									onEditDirect={handleEditDirect}
									onDeleteDirect={handleDeleteDirect}
									reactionsFor={getReactionsFor}
									onReact={handleReact}
									onUnreact={handleUnreact}
								/>
							)}
							{/* "Sending message failed" cards for sends that never
						    reached the server (Figma 7086-57415). */}
							{failedSends
								.filter((failed) =>
									failedSendBelongsTo(failed, {
										kind: 'main'
									})
								)
								.map((failed) => (
									<FailedSendTimelineEntry
										key={failed.id}
										failed={failed}
										messageProps={{
											clientName:
												getContact(activeSession)
													?.username ||
												translate(
													'sessionList.user.consultantUnknown'
												),
											isMyMessage: true,
											isUserBanned: false,
											handleDecryptionErrors,
											handleDecryptionSuccess,
											e2eeParams: {
												key,
												keyID,
												encrypted,
												subscriptionKeyLost
											},
											renderMode: 'main',
											threadsEnabled: false,
											forceShow: true,
											displayName:
												userData?.displayName ||
												userData?.userName ||
												'',
											username: userData?.userName || '',
											userId:
												userData?.userId ||
												userData?.userName ||
												'local-user',
											isNotRead: false,
											t: null,
											rid: resolvedMatrixRoomId || ''
										}}
										onRetry={handleRetryFailedSend}
										retryPending={
											retryRequest?.failedSendId ===
											failed.id
										}
										retryDisabled={Boolean(
											retryRequest &&
												retryRequest.failedSendId !==
													failed.id
										)}
									/>
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
						</div>
					)}
				</div>

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
					enquiryClosed && (
						<div className="session__pseudonymActionBarSlot">
							<div
								className="session__anonymousEnquiryClosedNote"
								role="status"
							>
								{translate(
									'anonymousChat.enquiryClosed',
									'Dieser Live-Chat wurde beendet. Um einen neuen Chat zu starten, öffnen Sie bitte Ihren Einladungslink erneut.'
								)}
							</div>
						</div>
					)}

				{shouldShowPseudonymGate &&
					pseudonymConfirmed &&
					!enquiryClosed &&
					!consultantAccepted && (
						<div className="session__pseudonymActionBarSlot">
							<WaitingQueueActionBar
								queuePosition={queuePeopleAhead}
								onOpenCalmCompanion={handleOpenCalmCompanion}
								onLeaveQueue={() => {
									setLeaveQueueFailed(false);
									setIsLeaveQueueDialogOpen(true);
								}}
							/>
						</div>
					)}

				{/*
				 * The exit from the waiting queue (#893). Mounted for the whole
				 * queue phase rather than inside the action bar, so it survives the
				 * bar swapping to `ConsultantAcceptedActionBar` the moment somebody
				 * accepts — an overlay that unmounts under the user is exactly the
				 * trap that bit us before.
				 */}
				{shouldShowPseudonymGate &&
					pseudonymConfirmed &&
					!enquiryClosed && (
						<LeaveQueueDialog
							open={isLeaveQueueDialogOpen}
							canStartChat={consultantAccepted}
							busy={isLeavingQueue}
							onStay={() => setIsLeaveQueueDialogOpen(false)}
							onStartChat={() => {
								setIsLeaveQueueDialogOpen(false);
								handleStartAcceptedChat();
							}}
							onDeleteAccess={handleLeaveQueueDelete}
							errorMessage={
								leaveQueueFailed
									? translate(
											'anonymousChat.leaveQueue.error',
											'Der Chat konnte gerade nicht beendet werden. Bitte versuchen Sie es noch einmal.'
										)
									: undefined
							}
						/>
					)}

				{shouldShowPseudonymGate &&
					pseudonymConfirmed &&
					!enquiryClosed &&
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
												'session__submit-interface--scrolled-up'
										)}
										placeholder={getPlaceholder()}
										typingUsers={props.typingUsers}
										preselectedFile={draggedFile}
										handleMessageSendSuccess={
											handleMessageSendSuccess
										}
										onSendError={handleComposerSendError}
										retryRequest={
											retryRequest &&
											failedSendBelongsTo(retryRequest, {
												kind: 'main'
											})
												? retryRequest
												: null
										}
										onRetrySettled={
											handleComposerRetrySettled
										}
										isSupervisor={isSupervisor}
										supervisionRoomId={supervisionRoomId}
										hideSupervisorAudience={
											hasSupervisionSideRoom
										}
										replyTo={replyTo}
										onCancelReply={handleCancelReply}
										editingMessage={editingMessage}
										onCancelEdit={handleCancelEdit}
										mobileUnreadCount={newMessages}
										mobileIsScrolledToBottom={
											isScrolledToBottom
										}
										flushCorner={
											desktopPanelOpen
												? 'bottom-left'
												: undefined
										}
										onMobileNavigateBack={
											handleMobileNavigateToList
										}
										onMobileNavigateDown={
											handleMobileNavigateStepDownClick
										}
										onMobileNavigateBottom={
											handleScrollToBottomButtonClick
										}
										messages={messages}
										onCloseThread={handleCloseThread}
										isOwnMessage={isMyMessageMatrix}
									/>
								</MessageSubmitErrorBoundary>
							</Suspense>
						)}
						{areRobotMessagesComplete &&
							hasMediaUploadFeature(
								tenantData?.settings,
								chatType
							) && (
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

				{/* T1/T15: the channel switcher FAB — every secondary channel not
			    on screen; hidden while a panel is open (its header offers the
			    channels) and, on the phone, while the composer has focus. */}
				{otherChannels.length > 0 && (
					<ChannelSwitcherFab
						channels={secondaryChannels}
						activeChannelId={shownChannelId}
						onSelect={selectChannelFromFab}
						bottomOffset={fabOffset}
						fabHidden={
							openPanel !== null || (isPhoneLayout && composing)
						}
					/>
				)}
			</div>

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
						onClick={() => navigate('/registration')}
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
							onClick={() => navigate(-1)}
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
		</>
	);

	// B2: the side panel — ONE `SidePanel` for the supervision side room
	// and for a native thread (stage `SupervisionRoom` / `ThreadRoom`).
	const panelVariant = isPhoneLayout ? 'fullscreen' : 'inside';
	const panelHeaderNav = {
		channels: secondaryChannels,
		activeChannelId: shownChannelId,
		onSelectChannel: selectChannelFromHeader,
		autoFocusChannelButton: focusPanelHeader,
		onBack: isPhoneLayout ? closeChannel : undefined,
		hideBackButton: isPhoneLayout,
		onClose: isPhoneLayout ? undefined : closeChannel
	};
	// Phone, inside a side room: the FAB switches back (and offers the rest).
	const phoneBackFab = isPhoneLayout ? (
		<ChannelSwitcherFab
			channels={secondaryChannels}
			activeChannelId={shownChannelId}
			onSelect={selectChannelFromFab}
			onBack={closeChannel}
		/>
	) : undefined;
	const askerMatrixUserIdFor = (message: MessageItem) =>
		!activeSession.rid &&
		message.userId &&
		!message.userId.includes(activeSession.consultant?.username || '')
			? message.userId
			: activeSession.item.askerMatrixUserId;
	const e2eeParams = { key, keyID, encrypted, subscriptionKeyLost };
	const panelComposerFlush = desktopPanelOpen ? 'bottom-right' : undefined;

	const threadPanel =
		openPanel === 'thread' &&
		activeThreadRootId &&
		activeThreadRootMessage ? (
			<SidePanel
				variant={panelVariant}
				className={`chatStage__panel--${panelVariant}`}
				label={translate('chatStage.panel.region', {
					title: translate('chatStage.panel.thread.title')
				})}
				data-cy="stage-panel"
				header={
					<PanelHeader
						kind="thread"
						title={translate('chatStage.panel.thread.title')}
						name={clientDisplayName}
						participants={threadParticipants}
						{...panelHeaderNav}
					/>
				}
				timeline={
					<>
						<MessageTimeline
							keyPrefix="thread-"
							messages={[
								activeThreadRootMessage,
								...(messages || []).filter(
									(message) =>
										message.threadRootEventId ===
										activeThreadRootId
								)
							]}
							renderMode="thread"
							threadsEnabled
							threadRootId={activeThreadRootId}
							forceShow
							clientName={clientDisplayName}
							askerMatrixUserIdFor={askerMatrixUserIdFor}
							isOnlyEnquiry={isOnlyEnquiry}
							isMyMessage={isMyMessageMatrix}
							isUserBanned={(username) =>
								props.bannedUsers.includes(username)
							}
							handleDecryptionErrors={handleDecryptionErrors}
							handleDecryptionSuccess={handleDecryptionSuccess}
							e2eeParams={e2eeParams}
							decryptionFailures={decryptionFailures}
							reactionsFor={getReactionsFor}
							onReact={handleReact}
							onUnreact={handleUnreact}
						/>
						{failedSends
							.filter((failed) =>
								failedSendBelongsTo(failed, {
									kind: 'thread',
									rootId: activeThreadRootId
								})
							)
							.map((failed) => (
								<FailedSendTimelineEntry
									key={failed.id}
									failed={failed}
									messageProps={{
										clientName: clientDisplayName,
										isMyMessage: true,
										isUserBanned: false,
										handleDecryptionErrors,
										handleDecryptionSuccess,
										e2eeParams,
										renderMode: 'thread',
										threadsEnabled: false,
										threadRootId: activeThreadRootId,
										forceShow: true,
										displayName:
											userData?.displayName ||
											userData?.userName ||
											'',
										username: userData?.userName || '',
										userId:
											userData?.userId ||
											userData?.userName ||
											'local-user',
										isNotRead: false,
										t: null,
										rid: resolvedMatrixRoomId || ''
									}}
									onRetry={handleRetryFailedSend}
									retryPending={
										retryRequest?.failedSendId === failed.id
									}
									retryDisabled={Boolean(
										retryRequest &&
											retryRequest.failedSendId !==
												failed.id
									)}
								/>
							))}
					</>
				}
				composer={
					<MessageSubmitInterfaceComponent
						isTyping={props.isTyping}
						placeholder={translate(
							'message.thread.placeholder',
							'Reply in thread'
						)}
						typingUsers={props.typingUsers}
						handleMessageSendSuccess={handleMessageSendSuccess}
						onSendError={handleComposerSendError}
						retryRequest={
							retryRequest &&
							failedSendBelongsTo(retryRequest, {
								kind: 'thread',
								rootId: activeThreadRootId
							})
								? retryRequest
								: null
						}
						onRetrySettled={handleComposerRetrySettled}
						isSupervisor={isSupervisor}
						supervisionRoomId={supervisionRoomId}
						hideSupervisorAudience={hasSupervisionSideRoom}
						threadRootId={activeThreadRootId}
						threadParentPreview={toMessagePreviewText(
							activeThreadRootMessage.message
						)}
						autoFocusEditor={!focusPanelHeader}
						flushCorner={panelComposerFlush}
						onMobileNavigateBack={
							isPhoneLayout ? closeChannel : undefined
						}
						messages={messages}
						onCloseThread={handleCloseThread}
						isOwnMessage={isMyMessageMatrix}
					/>
				}
				switcher={phoneBackFab}
			/>
		) : null;

	const supervisionPanel =
		openPanel === 'supervision' ? (
			<SidePanel
				variant={panelVariant}
				className={`chatStage__panel--${panelVariant}`}
				label={translate('chatStage.panel.region', {
					title: translate('supervision.panel.title')
				})}
				data-cy="stage-panel"
				header={
					<PanelHeader
						kind="supervision"
						title={translate('supervision.panel.title')}
						name={supervisionCounterpartName}
						participants={supervisionParticipants}
						unreadCount={supervisionUnreadCount}
						actions={
							mayCallInSideRoom ? (
								<PanelCallActions
									onStartCall={startSupervisionCall}
									audioEnabled={supervisionCallGates.audio}
									videoEnabled={supervisionCallGates.video}
									participantCount={
										supervisionParticipants.length
									}
									// The panel fills the screen on the phone;
									// on the desktop it is as wide as the drag
									// left it.
									width={isPhoneLayout ? null : panelWidth}
									phone={isPhoneLayout}
									copy={{
										video: translate(
											'videoCall.button.startVideoCall'
										),
										audio: translate(
											'videoCall.button.startCall'
										),
										menu: translate('app.menu'),
										participants: translate(
											'chatStage.panel.participantCount',
											{
												count: supervisionParticipants.length
											}
										)
									}}
								/>
							) : undefined
						}
						{...panelHeaderNav}
					/>
				}
				banner={
					isSupervisor && supervisionReason ? (
						<InfoBanner
							title={translate(
								'session.supervisor.reason.title',
								'Supervisionsgrund'
							)}
							text={supervisionReason}
						/>
					) : isSupervisor &&
					  (!supervisionMessages ||
							supervisionMessages.length === 0) ? (
						<InfoBanner
							title={translate(
								'session.supervisor.startChat.title',
								'Chat starten'
							)}
							text={translate(
								'session.supervisor.startChat.hint',
								'Use the message field at the bottom to send the first supervision message.'
							)}
						/>
					) : undefined
				}
				timeline={
					<>
						<MessageTimeline
							keyPrefix="supervision-"
							messages={supervisionTimelineMessages}
							renderMode="main"
							threadsEnabled={false}
							clientName={supervisionCounterpartName}
							askerMatrixUserIdFor={() =>
								activeSession.item?.askerMatrixUserId
							}
							isOnlyEnquiry={isOnlyEnquiry}
							isMyMessage={isMyMessageMatrix}
							handleDecryptionErrors={handleDecryptionErrors}
							handleDecryptionSuccess={handleDecryptionSuccess}
							e2eeParams={e2eeParams}
							decryptionFailures={decryptionFailures}
						/>
						{/* Side-room sends that never reached the server: same
						    card + retry as the client chat (review B2 D-2). */}
						{failedSends
							.filter((failed) =>
								failedSendBelongsTo(failed, {
									kind: 'room',
									roomId: supervisionRoomId
								})
							)
							.map((failed) => (
								<FailedSendTimelineEntry
									key={failed.id}
									failed={failed}
									messageProps={{
										clientName: supervisionCounterpartName,
										isMyMessage: true,
										isUserBanned: false,
										handleDecryptionErrors,
										handleDecryptionSuccess,
										e2eeParams,
										renderMode: 'main',
										threadsEnabled: false,
										forceShow: true,
										displayName:
											userData?.displayName ||
											userData?.userName ||
											'',
										username: userData?.userName || '',
										userId:
											userData?.userId ||
											userData?.userName ||
											'local-user',
										isNotRead: false,
										t: null,
										rid: supervisionRoomId
									}}
									onRetry={handleRetryFailedSend}
									retryPending={
										retryRequest?.failedSendId === failed.id
									}
									retryDisabled={Boolean(
										retryRequest &&
											retryRequest.failedSendId !==
												failed.id
									)}
								/>
							))}
					</>
				}
				composer={
					<MessageSubmitInterfaceComponent
						isTyping={props.isTyping}
						placeholder={translate(
							'supervision.panel.composer.placeholder',
							{ name: supervisionCounterpartName }
						)}
						handleMessageSendSuccess={handleMessageSendSuccess}
						onSendError={handleComposerSendError}
						retryRequest={
							retryRequest &&
							failedSendBelongsTo(retryRequest, {
								kind: 'room',
								roomId: supervisionRoomId
							})
								? retryRequest
								: null
						}
						onRetrySettled={handleComposerRetrySettled}
						targetRoomId={supervisionRoomId}
						isSupervisor={isSupervisor}
						supervisionRoomId={supervisionRoomId}
						hideSupervisorAudience
						autoFocusEditor={!focusPanelHeader}
						flushCorner={panelComposerFlush}
						accent="supervision"
						onMobileNavigateBack={
							isPhoneLayout ? closeChannel : undefined
						}
						messages={supervisionMessages}
						isOwnMessage={isMyMessageMatrix}
					/>
				}
				switcher={phoneBackFab}
			/>
		) : null;

	// Teamberatung (Frank, 09.09.): "eins zu eins diese Gruppen genau wie bei
	// der Supervision … nur steht dann einfach Teamberatung". Same organism,
	// same header nav, same composer — its own room, words and members.
	const teamPanel =
		openPanel === 'team' ? (
			<SidePanel
				variant={panelVariant}
				className={`chatStage__panel--${panelVariant}`}
				label={translate('chatStage.panel.region', {
					title: teamChannelTitle
				})}
				data-cy="stage-panel"
				header={
					<PanelHeader
						kind="team"
						title={teamChannelTitle}
						// The case this room is about — the same pseudonym
						// the chat beside it carries, so it is obvious WHICH
						// enquiry the team is discussing. It is not a leak:
						// everyone in this room may already see the enquiry.
						name={clientDisplayName}
						// … but the name alone would read as "you are writing
						// to her". ADR-016 §6 asks for a permanent marker;
						// this is it.
						chip={teamText('chatStage.panel.team.onlyMarker')}
						participants={teamParticipants}
						unreadCount={teamUnreadCount}
						{...panelHeaderNav}
					/>
				}
				banner={
					!teamMessages || teamMessages.length === 0 ? (
						<InfoBanner
							title={teamText(
								'chatStage.panel.team.empty.title'
							)}
							text={teamText('chatStage.panel.team.empty.text')}
						/>
					) : undefined
				}
				timeline={
					<>
						<MessageTimeline
							keyPrefix="team-"
							messages={teamTimelineMessages}
							renderMode="main"
							threadsEnabled={false}
							clientName={clientDisplayName}
							askerMatrixUserIdFor={() =>
								activeSession.item?.askerMatrixUserId
							}
							isOnlyEnquiry={isOnlyEnquiry}
							isMyMessage={isMyMessageMatrix}
							handleDecryptionErrors={handleDecryptionErrors}
							handleDecryptionSuccess={handleDecryptionSuccess}
							e2eeParams={e2eeParams}
							decryptionFailures={decryptionFailures}
						/>
						{failedSends
							.filter((failed) =>
								failedSendBelongsTo(failed, {
									kind: 'room',
									roomId: teamRoomId
								})
							)
							.map((failed) => (
								<FailedSendTimelineEntry
									key={failed.id}
									failed={failed}
									messageProps={{
										clientName: clientDisplayName,
										isMyMessage: true,
										isUserBanned: false,
										handleDecryptionErrors,
										handleDecryptionSuccess,
										e2eeParams,
										renderMode: 'main',
										threadsEnabled: false,
										forceShow: true,
										displayName:
											userData?.displayName ||
											userData?.userName ||
											'',
										username: userData?.userName || '',
										userId:
											userData?.userId ||
											userData?.userName ||
											'local-user',
										isNotRead: false,
										t: null,
										rid: teamRoomId
									}}
									onRetry={handleRetryFailedSend}
									retryPending={
										retryRequest?.failedSendId === failed.id
									}
									retryDisabled={Boolean(
										retryRequest &&
											retryRequest.failedSendId !==
												failed.id
									)}
								/>
							))}
					</>
				}
				composer={
					<MessageSubmitInterfaceComponent
						isTyping={props.isTyping}
						placeholder={teamText(
							'chatStage.panel.team.composer.placeholder'
						)}
						handleMessageSendSuccess={handleMessageSendSuccess}
						onSendError={handleComposerSendError}
						retryRequest={
							retryRequest &&
							failedSendBelongsTo(retryRequest, {
								kind: 'room',
								roomId: teamRoomId
							})
								? retryRequest
								: null
						}
						onRetrySettled={handleComposerRetrySettled}
						targetRoomId={teamRoomId}
						isSupervisor={isSupervisor}
						supervisionRoomId={supervisionRoomId}
						hideSupervisorAudience
						flushCorner={panelComposerFlush}
						accent="team"
						onMobileNavigateBack={
							isPhoneLayout ? closeChannel : undefined
						}
						messages={teamMessages}
						isOwnMessage={isMyMessageMatrix}
					/>
				}
				switcher={phoneBackFab}
			/>
		) : null;

	const sidePanel = threadPanel ?? supervisionPanel ?? teamPanel;

	// Desktop: the panel joins the card (`.chatStage__card--split`) behind
	// the real `ResizableHandle` (T2). Phone: the panel fills the screen
	// instead of the card (stage `single` mode).
	const cardWithPanel = (
		<div
			ref={cardRef}
			className={clsx(
				'session',
				'chatStage__card',
				desktopPanelOpen && 'chatStage__card--split',
				shouldFadeSessionChrome && 'session--gameFocus'
			)}
			tabIndex={-1}
			onMouseDown={focusSessionChromeOnPointerDown}
		>
			{sessionCard}
			{desktopPanelOpen && sidePanel && (
				<div
					className="chatStage__panel"
					style={{ width: panelWidth }}
					data-cy="stage-panel-slot"
				>
					<ResizableHandle
						anchor="start"
						snapping={false}
						currentWidth={panelWidth}
						onResize={handlePanelResize}
						minWidth={STAGE_LAYOUT.MIN_PANE_DRAG_WIDTH}
						maxWidth={Math.max(
							STAGE_LAYOUT.MIN_PANE_DRAG_WIDTH,
							cardWidth - STAGE_LAYOUT.MIN_PANE_DRAG_WIDTH
						)}
						ariaLabel={translate('supervision.panel.stage.divider')}
						className="chatStage__panelHandle"
						data-cy="stage-panel-handle"
					/>
					{sidePanel}
				</div>
			)}
		</div>
	);

	return (
		<SupervisionPanelContext.Provider value={supervisionPanelContextValue}>
			{isPhoneLayout && sidePanel ? sidePanel : cardWithPanel}
		</SupervisionPanelContext.Provider>
	);
};
