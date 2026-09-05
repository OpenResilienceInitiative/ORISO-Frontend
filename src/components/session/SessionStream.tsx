import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { Loading } from '../app/Loading';
import { SessionItemComponent } from './SessionItemComponent';
import {
	AUTHORITIES,
	ConsultantListContext,
	hasUserAuthority,
	SessionTypeContext,
	UserDataContext,
	ActiveSessionContext,
	useTopic
} from '../../globalState';
import {
	apiGetAgencyConsultantList,
	apiGetCaseHandoverStatus,
	apiDecideCaseHandoverClientConsent,
	apiGetSessionSupervisors,
	CaseHandoverStatus,
	FETCH_ERRORS
} from '../../api';
import { apiPostError, ERROR_LEVEL_WARN } from '../../api/apiPostError';
import {
	prepareMessages,
	SESSION_LIST_TAB,
	SESSION_LIST_TYPES
} from './sessionHelpers';
import { MessageItem } from '../message/MessageItemComponent';
import { isMatrixRoom } from '../../utils/matrixRoomUtils';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { BUTTON_TYPES } from '../button/Button';
import { logout } from '../logout/logout';
import { ReactComponent as CheckIcon } from '../../resources/img/illustrations/check.svg';
import './session.styles';
import useUpdatingRef from '../../hooks/useUpdatingRef';
import { useSearchParam } from '../../hooks/useSearchParams';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { prepareConsultantDataForSelect } from '../sessionAssign/sessionAssignHelper';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import { getModality, Modality } from './getModality';
import { TeamDiscussionPanel } from '../teamDiscussion/TeamDiscussionPanel';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import {
	chatTransportService,
	MatrixRoomLifecycleChange
} from '../../services/chatTransportService';
import {
	formatMatrixTimelineEvent,
	extractReactionEvents
} from '../../utils/matrixTimelineEventFormatter';
import { applyMessageEdits } from '../../utils/messageRelations';
import { CaseHandoverCurtain } from './CaseHandoverCurtain';
import { isCaseHandoverAccessControlled } from './caseHandoverHelpers';
import {
	MATRIX_HISTORY_KEYS_IMPORTED_EVENT,
	isUndecryptedRoomEvent,
	matrixRoomHistoryKeyTransfer
} from '../../services/matrixRoomHistoryKeyTransfer';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { CaseHandoverConsentCard } from '../caseHandover/CaseHandoverClientCards';
import { formatToHHMM } from '../../utils/dateHelpers';

const caseHandoverRequestIdFromPath = (actionPath?: string): number | null => {
	if (!actionPath?.includes('?')) {
		return null;
	}
	const value = new URLSearchParams(actionPath.split('?')[1]).get(
		'caseHandoverRequestId'
	);
	if (!value || !/^\d+$/.test(value)) {
		return null;
	}
	const requestId = Number(value);
	return Number.isSafeInteger(requestId) ? requestId : null;
};

interface SessionStreamProps {
	readonly: boolean;
	checkMutedUserForThisSession: () => void;
	bannedUsers: string[];
}

export const SessionStream = ({
	readonly,
	checkMutedUserForThisSession,
	bannedUsers
}: SessionStreamProps) => {
	const MATRIX_TYPING_TIMEOUT_MS = 3200;
	const MATRIX_TYPING_TRIGGER_MS = 1000;
	const MATRIX_TYPING_STALE_MS = 3600;
	const { t: translate } = useTranslation();
	const navigate = useNavigate();

	const { type, path: listPath } = useContext(SessionTypeContext);
	const { userData } = useContext(UserDataContext);
	const { matrixClientService } = useMatrixClient();
	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');
	// FE#514 follow-up: `team.discussion.new` notifications deep-link with
	// ?teamDiscussion=1 — the panel then opens expanded instead of collapsed.
	const teamDiscussionParam = useSearchParam<string>('teamDiscussion');

	// MATRIX MIGRATION: Track component mount/unmount
	useEffect(() => {
		// console.log('🔥 SessionStream MOUNTED');
		return () => {
			// console.log('🔥 SessionStream UNMOUNTED - Component is being destroyed!');
		};
	}, []);

	const subscribed = useRef(false);
	// Bumped whenever a token refresh swaps the matrix-js-sdk client: the old
	// instance got removeAllListeners(), so every effect holding room
	// listeners depends on this generation to re-attach to the new client.
	const [matrixClientGeneration, setMatrixClientGeneration] = useState(0);
	const initialTimelineHydrationKeyRef = useRef('');
	const [messagesItem, setMessagesItem] = useState(null);
	// WP-B2 (ADR-008): the supervision side room is its own timeline. It is
	// never merged into `messagesItem` — the client-facing list must not
	// contain side-room events — and renders in the SupervisionPanel instead.
	const [supervisionMessages, setSupervisionMessages] = useState<
		MessageItem[]
	>([]);
	const [overlayItem, setOverlayItem] = useState<OverlayItem>(null);
	const [isOverlayActive, setIsOverlayActive] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!matrixClientService?.onClientChange) {
			return;
		}

		return matrixClientService.onClientChange(() => {
			setMatrixClientGeneration((generation) => generation + 1);
		});
	}, [matrixClientService]);

	const { activeSession, readActiveSession } =
		useContext(ActiveSessionContext);
	const notificationsContext = useContext(NotificationsContext);
	const [caseHandoverStatus, setCaseHandoverStatus] =
		useState<CaseHandoverStatus | null>(null);
	const [caseHandoverStatusLoading, setCaseHandoverStatusLoading] =
		useState(false);
	const [caseHandoverConsentSubmitting, setCaseHandoverConsentSubmitting] =
		useState(false);
	const [caseHandoverConsentError, setCaseHandoverConsentError] =
		useState('');
	const [
		resolvedCaseHandoverNotificationId,
		setResolvedCaseHandoverNotificationId
	] = useState<string | null>(null);
	const pendingCaseHandoverConsent = useMemo(() => {
		if (
			!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) ||
			activeSession.isGroup
		) {
			return null;
		}
		const sessionId = activeSession.item?.id;
		return (
			notificationsContext?.notificationFeed.find((item) => {
				if (
					item.id === resolvedCaseHandoverNotificationId ||
					item.eventType !== 'case.handover.consent.requested' ||
					// already answered elsewhere — a read notification must
					// not resurface the consent card on remount
					!!item.readAt
				) {
					return false;
				}
				return String(item.sourceSessionId) === String(sessionId);
			}) || null
		);
	}, [
		activeSession.isGroup,
		activeSession.item?.id,
		notificationsContext?.notificationFeed,
		resolvedCaseHandoverNotificationId,
		userData
	]);
	const pendingCaseHandoverRequestId = useMemo(
		() =>
			caseHandoverRequestIdFromPath(
				pendingCaseHandoverConsent?.actionPath
			),
		[pendingCaseHandoverConsent?.actionPath]
	);

	const { setConsultantList } = useContext(ConsultantListContext);

	const abortController = useRef<AbortController>(null);
	const hasUserInitiatedStopOrLeaveRequest = useRef<boolean>(false);

	// ADR-008: per-session supervision side room id, resolved for authorized
	// supervisors/consultants. When present we also load its messages into a
	// separate side-room timeline (WP-B2) — the client is never a member of
	// this room and never sees these events in the main stream.
	const [supervisionRoomId, setSupervisionRoomId] = useState<
		string | undefined
	>(undefined);
	const [hasSupervisionAccess, setHasSupervisionAccess] = useState(false);
	const [matrixTypingUsers, setMatrixTypingUsers] = useState<string[]>([]);
	const matrixTypingTimeoutRef = useRef<number | null>(null);
	const matrixTypingLastTriggerRef = useRef(0);
	const matrixTypingActivityRef = useRef<Map<string, number>>(new Map());
	const resolvedChatSession = useMemo(
		() => chatTransportService.resolveSession(activeSession),
		[activeSession]
	);
	const isMatrixSession = resolvedChatSession.isMatrixSession;
	const matrixRoomId = resolvedChatSession.matrixRoomId || '';
	const clearMatrixTypingTimeout = useCallback(() => {
		if (matrixTypingTimeoutRef.current) {
			window.clearTimeout(matrixTypingTimeoutRef.current);
			matrixTypingTimeoutRef.current = null;
		}
	}, []);
	const sendMatrixTyping = useCallback(
		(typing: boolean) => {
			if (!isMatrixSession || !matrixRoomId) {
				return;
			}
			chatTransportService
				.sendTyping(matrixRoomId, typing)
				.catch(() => {});
		},
		[isMatrixSession, matrixRoomId]
	);
	const handleSessionTyping = useCallback(
		(isCleared) => {
			if (!isMatrixSession || !matrixRoomId) {
				return;
			}
			clearMatrixTypingTimeout();

			const cancelTyping = () => {
				sendMatrixTyping(false);
				matrixTypingTimeoutRef.current = null;
				matrixTypingLastTriggerRef.current = 0;
			};

			const now = Date.now();
			if (!isCleared) {
				if (
					matrixTypingLastTriggerRef.current +
						MATRIX_TYPING_TRIGGER_MS <
					now
				) {
					sendMatrixTyping(true);
					matrixTypingLastTriggerRef.current = now;
				}
				matrixTypingTimeoutRef.current = window.setTimeout(
					cancelTyping,
					MATRIX_TYPING_TIMEOUT_MS
				);
			} else {
				matrixTypingTimeoutRef.current = window.setTimeout(
					cancelTyping,
					250
				);
			}
		},
		[
			clearMatrixTypingTimeout,
			isMatrixSession,
			matrixRoomId,
			sendMatrixTyping,
			MATRIX_TYPING_TIMEOUT_MS,
			MATRIX_TYPING_TRIGGER_MS
		]
	);

	const caseHandoverGateNeeded = useMemo(
		() =>
			isCaseHandoverAccessControlled({
				activeSession,
				userData,
				type
			}),
		[activeSession, type, userData]
	);
	const caseHandoverCurtainNeeded =
		caseHandoverGateNeeded && !hasSupervisionAccess;
	const mayRequestHistoryKeys =
		!caseHandoverCurtainNeeded ||
		caseHandoverStatus?.canViewContent === true;

	// ADR-008: resolve the per-session supervision side room id for members.
	// The backend only returns supervisor entries (with the side room id) to
	// authorized callers, so non-members never receive one and asides stay
	// invisible to them. The security boundary is Matrix room membership.
	useEffect(() => {
		let cancelled = false;
		const sessionId = activeSession.item?.id;

		setSupervisionRoomId(undefined);
		setHasSupervisionAccess(false);

		if (
			!hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) ||
			!sessionId
		) {
			return () => {
				cancelled = true;
			};
		}

		apiGetSessionSupervisors(sessionId)
			.then((supervisors) => {
				if (cancelled) {
					return;
				}
				const sideRoomId = supervisors.find(
					(s) => s.matrixRoomId
				)?.matrixRoomId;
				setHasSupervisionAccess(
					supervisors.some(
						(supervisor) =>
							String(supervisor.supervisorConsultantId) ===
							String(userData.userId)
					)
				);
				setSupervisionRoomId(sideRoomId || undefined);
			})
			.catch(() => {
				if (!cancelled) {
					setHasSupervisionAccess(false);
					setSupervisionRoomId(undefined);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [activeSession.item?.id, userData]);

	const fetchSessionMessages = useCallback(
		(forceCaseHandoverAccess = false): Promise<boolean> => {
			if (abortController.current) {
				abortController.current.abort();
			}

			abortController.current = new AbortController();

			if (
				caseHandoverCurtainNeeded &&
				!forceCaseHandoverAccess &&
				!caseHandoverStatus?.canViewContent
			) {
				setMessagesItem({ messages: [] });
				setSupervisionMessages([]);
				setLoading(false);
				return Promise.resolve(false);
			}

			// Matrix-backed sessions must hydrate from the local Matrix SDK timeline.
			// Pulling message history through ORISO REST would move decrypted/plaintext
			// bodies outside the room encryption boundary.
			if (resolvedChatSession.isMatrixSession) {
				const resolvedMatrixRoomId = resolvedChatSession.matrixRoomId;
				const encryptedFallbackText = translate(
					'e2ee.message.encryption.text'
				);

				const loadRoomEvents = (roomId?: string | null) => {
					if (!roomId) {
						return [];
					}
					return chatTransportService.getMatrixRoomMessages(
						roomId,
						100
					);
				};

				const formatRoomMessages = (
					events: any[],
					roomId?: string | null,
					stampRoomId = false
				) => {
					const matrixRoom = roomId
						? chatTransportService.getMatrixRoom(roomId)
						: null;
					return (
						events
							.map((event: any) =>
								formatMatrixTimelineEvent(
									event,
									matrixRoom,
									encryptedFallbackText
								)
							)
							.filter(Boolean)
							// WP-B2: side-room items carry their room id so the
							// client timeline can reject them as a safety net
							// (`excludeSideRoomMessages`).
							.map((item: any) =>
								stampRoomId && roomId
									? { ...item, rid: roomId }
									: item
							)
					);
				};

				const clientEvents = loadRoomEvents(resolvedMatrixRoomId);
				// ADR-008 / WP-B2: the supervision side room is loaded for
				// members but kept as its own timeline (SupervisionPanel).
				// The client is never a member of the side room, so it never
				// loads these.
				const supervisionEvents = supervisionRoomId
					? loadRoomEvents(supervisionRoomId)
					: [];
				if (mayRequestHistoryKeys) {
					[
						[resolvedMatrixRoomId, clientEvents],
						[supervisionRoomId, supervisionEvents]
					].forEach(([roomId, events]) => {
						if (
							roomId &&
							(events as any[]).some(isUndecryptedRoomEvent)
						) {
							void matrixRoomHistoryKeyTransfer.requestKeys(
								roomId as string
							);
						}
					});
				}
				const formattedMessages = formatRoomMessages(
					clientEvents,
					resolvedMatrixRoomId
				);
				// Reactions (m.annotation, #435): a distinct event type,
				// collected separately from the formatted message list.
				// Side-room reactions stay out of the client timeline; the
				// panel renders its bubbles without reactions.
				const reactionEvents = [...extractReactionEvents(clientEvents)];

				setMessagesItem({
					messages: prepareMessages(
						applyMessageEdits(formattedMessages)
					),
					reactionEvents
				});
				setSupervisionMessages(
					supervisionRoomId
						? prepareMessages(
								applyMessageEdits(
									formatRoomMessages(
										supervisionEvents,
										supervisionRoomId,
										true
									)
								)
							)
						: []
				);
				setLoading(false);
				return Promise.resolve(true);
			}

			// Sessions without a Matrix room (stale pre-migration data) render
			// an empty history instead of pulling messages from a removed backend.
			setMessagesItem({ messages: [] });
			setSupervisionMessages([]);
			setLoading(false);
			return Promise.resolve(true);
		},
		[
			caseHandoverCurtainNeeded,
			caseHandoverStatus?.canViewContent,
			mayRequestHistoryKeys,
			resolvedChatSession,
			supervisionRoomId,
			translate
		]
	);
	const fetchSessionMessagesRef = useUpdatingRef(fetchSessionMessages);

	useEffect(() => {
		const onHistoryKeysImported = (rawEvent: Event) => {
			const importedRoomId = (rawEvent as CustomEvent)?.detail?.roomId;
			if (
				[resolvedChatSession.matrixRoomId, supervisionRoomId].includes(
					importedRoomId
				)
			) {
				void fetchSessionMessagesRef.current(true);
			}
		};
		window.addEventListener(
			MATRIX_HISTORY_KEYS_IMPORTED_EVENT,
			onHistoryKeysImported
		);
		return () =>
			window.removeEventListener(
				MATRIX_HISTORY_KEYS_IMPORTED_EVENT,
				onHistoryKeysImported
			);
	}, [
		fetchSessionMessagesRef,
		resolvedChatSession.matrixRoomId,
		supervisionRoomId
	]);

	const setSessionRead = useCallback(() => {
		if (readonly) {
			return;
		}

		readActiveSession();
	}, [readActiveSession, readonly]);

	const loadAfterCaseHandoverGranted = useCallback(() => {
		setLoading(true);
		return fetchSessionMessagesRef
			.current(true)
			.then(() => setSessionRead())
			.catch(() => setMessagesItem({ messages: [] }))
			.finally(() => setLoading(false));
	}, [fetchSessionMessagesRef, setSessionRead]);

	useEffect(() => {
		let cancelled = false;
		const sessionId = activeSession.item?.id;

		setCaseHandoverStatus(null);
		setMessagesItem({ messages: [] });

		if (!caseHandoverCurtainNeeded || !sessionId) {
			if (caseHandoverGateNeeded && hasSupervisionAccess && sessionId) {
				setCaseHandoverStatus({
					sessionId,
					status: 'AUTHORIZED_SUPERVISOR',
					canViewContent: true,
					clientConsentRequired: false,
					auditOutcome: 'AUTHORIZED_SUPERVISOR'
				});
				void loadAfterCaseHandoverGranted();
			}
			setCaseHandoverStatusLoading(false);
			return () => {
				cancelled = true;
			};
		}

		setCaseHandoverStatusLoading(true);

		apiGetCaseHandoverStatus(sessionId)
			.then((nextStatus) => {
				if (cancelled) {
					return;
				}
				setCaseHandoverStatus(nextStatus);
				if (nextStatus.canViewContent) {
					loadAfterCaseHandoverGranted();
				} else {
					setLoading(false);
				}
			})
			.catch(() => {
				if (cancelled) {
					return;
				}
				setCaseHandoverStatus({
					sessionId,
					status: 'DENIED',
					canViewContent: false,
					clientConsentRequired: false,
					auditOutcome: 'ACCESS_DENIED'
				});
				setLoading(false);
			})
			.finally(() => {
				if (!cancelled) {
					setCaseHandoverStatusLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [
		activeSession.item?.id,
		caseHandoverCurtainNeeded,
		caseHandoverGateNeeded,
		hasSupervisionAccess,
		loadAfterCaseHandoverGranted
	]);

	// Real-time message sync via the Matrix timeline listener.
	useEffect(() => {
		// Only for Matrix sessions.
		if (!resolvedChatSession.isMatrixSession) {
			return;
		}
		const clientRoomId = resolvedChatSession.matrixRoomId;

		if (!clientRoomId) {
			return;
		}
		if (!mayRequestHistoryKeys) {
			return;
		}

		// ADR-008: listen on the client room AND (for members) the supervision
		// side room, so newly-sent asides appear live for authorized viewers.
		const watchedRoomIds = supervisionRoomId
			? [clientRoomId, supervisionRoomId]
			: [clientRoomId];
		const initialHydrationKey = `${matrixClientGeneration}:${watchedRoomIds.join('|')}`;

		let retryTimer: number | null = null;
		let detachTimelineListeners: Array<() => void> = [];
		let lastRefreshAt = 0;
		const refreshMessages = () => {
			lastRefreshAt = Date.now();
			fetchSessionMessages().catch(() => {
				// keep UI stable if a timeline event races with navigation
			});
		};

		const attachTimelineListeners = () => {
			const handleMatrixTimeline = (
				event: any,
				room: any,
				toStartOfTimeline: boolean
			) => {
				if (
					toStartOfTimeline ||
					!watchedRoomIds.includes(room?.roomId)
				) {
					return;
				}

				const eventType = event?.getType?.();
				if (
					eventType !== 'm.room.message' &&
					eventType !== 'm.room.encrypted' &&
					// Reactions (m.annotation, #435): a reaction add/remove is
					// not a message, but still needs a live refresh so
					// aggregateReactions() picks it up for other members.
					eventType !== 'm.reaction' &&
					eventType !== 'm.room.redaction'
				) {
					return;
				}

				// Coalesce encrypted/metadata bursts, but never drop a clear message:
				// delayed Matrix decryption mutates the event after its fallback rendered.
				const now = Date.now();
				const elapsed = now - lastRefreshAt;
				if (eventType !== 'm.room.message' && elapsed < 120) {
					return;
				}
				refreshMessages();
			};

			const detachers = watchedRoomIds
				.map((roomId) =>
					chatTransportService.onMatrixTimeline(
						roomId,
						handleMatrixTimeline
					)
				)
				.filter(Boolean) as Array<() => void>;

			// Only consider attach successful once every watched room is bound.
			if (detachers.length !== watchedRoomIds.length) {
				detachers.forEach((detach) => detach());
				return false;
			}

			detachTimelineListeners = detachers;
			// Initial-sync events arrive with toStartOfTimeline=true and are
			// intentionally ignored by the live handler. Hydrate once after every
			// successful attachment so late-join decryption failures can trigger
			// their room-key request after the Matrix room actually exists.
			if (
				initialTimelineHydrationKeyRef.current !== initialHydrationKey
			) {
				initialTimelineHydrationKeyRef.current = initialHydrationKey;
				// The initial timeline can be empty or already SDK-normalised by the
				// time React sees it. Request this room's existing keys once per
				// client generation instead of depending on a particular failure
				// event shape.
				watchedRoomIds.forEach(
					(roomId) =>
						void matrixRoomHistoryKeyTransfer.requestKeys(roomId)
				);
				refreshMessages();
			}
			return true;
		};

		// Try immediately, then retry until the Matrix client is ready.
		// Cap the retries so a client that never initializes stops spinning
		// silently (20 attempts * 500ms = 10s) and surfaces a diagnostic.
		const MAX_ATTACH_ATTEMPTS = 20;
		let attachAttempts = 0;
		if (!attachTimelineListeners()) {
			retryTimer = window.setInterval(() => {
				attachAttempts += 1;
				if (attachTimelineListeners()) {
					if (retryTimer) {
						window.clearInterval(retryTimer);
						retryTimer = null;
					}
					return;
				}
				if (attachAttempts >= MAX_ATTACH_ATTEMPTS) {
					if (retryTimer) {
						window.clearInterval(retryTimer);
						retryTimer = null;
					}
					const attachError = new Error(
						`SessionStream: gave up attaching Matrix timeline listener for room ${matrixRoomId} after ${MAX_ATTACH_ATTEMPTS} attempts (Matrix client never became ready)`
					) as Error & { level?: typeof ERROR_LEVEL_WARN };
					attachError.level = ERROR_LEVEL_WARN;
					apiPostError(attachError).catch(() => undefined);
				}
			}, 500);
		}

		return () => {
			if (retryTimer) {
				window.clearInterval(retryTimer);
			}
			detachTimelineListeners.forEach((detach) => detach());
		};
		// matrixRoomId is derived from resolvedChatSession (already a dep).
		// matrixClientGeneration re-attaches after a token-refresh client swap.
	}, [
		resolvedChatSession,
		supervisionRoomId,
		fetchSessionMessages,
		matrixRoomId,
		matrixClientGeneration,
		mayRequestHistoryKeys
	]);

	const groupChatStoppedOverlay: OverlayItem = useMemo(
		() => ({
			svg: CheckIcon,
			headline: translate('groupChat.stopped.overlay.headline'),
			buttonSet: [
				{
					label: translate('groupChat.stopped.overlay.button1Label'),
					function: OVERLAY_FUNCTIONS.REDIRECT,
					type: BUTTON_TYPES.PRIMARY
				},
				{
					label: translate('groupChat.stopped.overlay.button2Label'),
					function: OVERLAY_FUNCTIONS.LOGOUT,
					type: BUTTON_TYPES.SECONDARY
				}
			]
		}),
		[translate]
	);

	// Restores the "subscription removed" UX on
	// Matrix signals (own membership -> leave/ban after a kick, ban or admin
	// room purge; m.room.tombstone when a room is shut down/replaced):
	// - group chat ended: "group chat stopped" overlay, unless this user
	//   initiated the stop/leave (SessionMenu already shows its own overlay);
	// - 1:1 participant removed (e.g. session reassignment): redirect back
	//   to the session list.
	const handleMatrixRoomLifecycle = useUpdatingRef(
		useCallback(
			(_change: MatrixRoomLifecycleChange) => {
				if (activeSession.isGroup) {
					if (hasUserInitiatedStopOrLeaveRequest.current) {
						hasUserInitiatedStopOrLeaveRequest.current = false;
					} else {
						setOverlayItem(groupChatStoppedOverlay);
						setIsOverlayActive(true);
					}
				} else if (type === SESSION_LIST_TYPES.MY_SESSION) {
					navigate(listPath);
				}
			},
			[
				activeSession.isGroup,
				groupChatStoppedOverlay,
				listPath,
				navigate,
				type
			]
		)
	);

	useEffect(() => {
		if (!isMatrixSession || !matrixRoomId) {
			return;
		}

		let retryTimer: number | null = null;
		let detachLifecycleListener: (() => void) | null = null;

		const attachLifecycleListener = () => {
			detachLifecycleListener =
				chatTransportService.onMatrixRoomLifecycle(
					matrixRoomId,
					(change) => handleMatrixRoomLifecycle.current(change)
				);
			return Boolean(detachLifecycleListener);
		};

		// Try immediately, then retry until Matrix client is ready — but cap the
		// attempts so a client that never initializes can't spin this interval
		// forever silently (same hazard as the timeline-attach retry above).
		const MAX_ATTACH_ATTEMPTS = 20;
		let attachAttempts = 0;
		if (!attachLifecycleListener()) {
			retryTimer = window.setInterval(() => {
				attachAttempts += 1;
				if (attachLifecycleListener() && retryTimer) {
					window.clearInterval(retryTimer);
					retryTimer = null;
					return;
				}
				if (attachAttempts >= MAX_ATTACH_ATTEMPTS) {
					if (retryTimer) {
						window.clearInterval(retryTimer);
						retryTimer = null;
					}
					const attachError = new Error(
						`SessionStream: gave up attaching Matrix room lifecycle listener for room ${matrixRoomId} after ${MAX_ATTACH_ATTEMPTS} attempts (Matrix client never became ready)`
					);
					(attachError as any).level = ERROR_LEVEL_WARN;
					apiPostError(attachError).catch(() => undefined);
				}
			}, 500);
		}

		return () => {
			if (retryTimer) {
				window.clearInterval(retryTimer);
			}
			detachLifecycleListener?.();
		};
		// matrixClientGeneration re-attaches after a token-refresh client swap.
	}, [
		isMatrixSession,
		matrixRoomId,
		handleMatrixRoomLifecycle,
		matrixClientGeneration
	]);

	useEffect(() => {
		if (!isMatrixSession || !matrixRoomId) {
			setMatrixTypingUsers([]);
			return;
		}

		const matrixClient = matrixClientService?.getClient?.();
		if (!matrixClient) {
			setMatrixTypingUsers([]);
			return;
		}
		// Snapshot the ref content for the cleanup below (the Map instance is
		// stable for the lifetime of the component).
		const matrixTypingActivity = matrixTypingActivityRef.current;
		matrixTypingActivity.clear();

		const updateMatrixTypingUsers = () => {
			const room = matrixClient.getRoom?.(matrixRoomId);
			if (!room) {
				setMatrixTypingUsers([]);
				return;
			}

			const now = Date.now();
			const currentUserId = matrixClient.getUserId?.();
			const roomMembers = room.getMembers?.() || [];
			const nextTypingUsers = roomMembers
				.filter((member: any) => member?.userId !== currentUserId)
				.filter((member: any) => Boolean(member?.typing))
				.filter((member: any) => {
					const userId = `${member?.userId || ''}`;
					if (!userId) {
						return false;
					}
					const lastActivity =
						matrixTypingActivityRef.current.get(userId);
					return (
						Boolean(lastActivity) &&
						now - (lastActivity as number) < MATRIX_TYPING_STALE_MS
					);
				})
				.map((member: any) => {
					const matrixUserId = `${member?.userId || ''}`;
					const matrixUserName = matrixUserId
						.split(':')[0]
						.replace(/^@/, '');
					return (
						member?.name ||
						member?.rawDisplayName ||
						matrixUserName ||
						matrixUserId
					);
				})
				.map((name: string) => name.trim())
				.filter(Boolean)
				.filter(
					(name: string, index: number, source: string[]) =>
						source.indexOf(name) === index
				);

			setMatrixTypingUsers(nextTypingUsers);
		};

		const handleRoomMemberTyping = (_event: any, member: any) => {
			if (member?.roomId && member.roomId !== matrixRoomId) {
				return;
			}
			const memberUserId = `${member?.userId || ''}`;
			if (member?.typing) {
				matrixTypingActivityRef.current.set(memberUserId, Date.now());
			} else {
				matrixTypingActivityRef.current.delete(memberUserId);
			}
			updateMatrixTypingUsers();
		};

		(matrixClient as any).on('RoomMember.typing', handleRoomMemberTyping);
		updateMatrixTypingUsers();
		const refreshInterval = window.setInterval(
			updateMatrixTypingUsers,
			1000
		);

		return () => {
			(matrixClient as any).off(
				'RoomMember.typing',
				handleRoomMemberTyping
			);
			window.clearInterval(refreshInterval);
			matrixTypingActivity.clear();
			setMatrixTypingUsers([]);
		};
		// matrixClientGeneration re-attaches after a token-refresh client swap.
	}, [
		isMatrixSession,
		matrixRoomId,
		MATRIX_TYPING_STALE_MS,
		matrixClientService,
		matrixClientGeneration
	]);

	useEffect(() => {
		const handleLiveMessageEvent = ({
			roomId,
			sessionId
		}: {
			roomId?: string;
			sessionId?: number;
		}) => {
			const activeMatrixRoomId = isMatrixRoom(activeSession.rid)
				? activeSession.rid
				: activeSession.item?.matrixRoomId || '';
			const activeRid = activeSession.rid || '';
			const activeSessionId = activeSession.item?.id;

			const belongsToActiveSession =
				(roomId &&
					(roomId === activeMatrixRoomId || roomId === activeRid)) ||
				(sessionId &&
					activeSessionId &&
					Number(sessionId) === Number(activeSessionId)) ||
				(!roomId && !sessionId);

			if (!belongsToActiveSession) {
				return;
			}

			fetchSessionMessages().catch(() => {
				// keep UI stable when a live refresh races with route/session changes
			});
		};

		messageEventEmitter.on(handleLiveMessageEvent);
		return () => {
			messageEventEmitter.off(handleLiveMessageEvent);
		};
	}, [
		activeSession.rid,
		activeSession.item?.id,
		activeSession.item?.matrixRoomId,
		fetchSessionMessages
	]);

	// Hard fallback: keep Matrix sessions in sync even if a live event is missed.
	// 60s is safe because Room.timeline and messageEventEmitter cover real-time updates.
	const MESSAGE_FALLBACK_INTERVAL_MS = 60_000;
	useEffect(() => {
		if (!isMatrixSession || !activeSession.item?.id) {
			return;
		}

		const intervalId = window.setInterval(() => {
			if (typeof document !== 'undefined' && document.hidden) {
				return;
			}
			// Skip when Matrix is actively syncing — real-time events are flowing.
			const matrixSyncState = matrixClientService
				?.getClient?.()
				?.getSyncState();
			if (matrixSyncState === 'SYNCING') {
				return;
			}
			fetchSessionMessages().catch(() => {
				// keep UI stable on intermittent network/session race conditions
			});
		}, MESSAGE_FALLBACK_INTERVAL_MS);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [
		isMatrixSession,
		activeSession.item?.id,
		fetchSessionMessages,
		matrixClientService
	]);

	useEffect(
		() => () => {
			clearMatrixTypingTimeout();
			sendMatrixTyping(false);
		},
		[clearMatrixTypingTimeout, sendMatrixTyping]
	);

	useEffect(() => {
		if (subscribed.current) {
			setLoading(false);
		} else {
			subscribed.current = true;

			fetchSessionMessages()
				.then((loaded) => {
					if (loaded) {
						setSessionRead();
					}
					setLoading(false);
				})
				.catch((e) => {
					if (e.message !== FETCH_ERRORS.ABORT) {
						// console.error('error fetchSessionMessages', e);
					}
					// Still show UI even if messages fail to load
					setLoading(false);
					setMessagesItem({ messages: [] });
				});
		}

		return () => {
			if (abortController.current) {
				abortController.current.abort();
				abortController.current = null;
			}

			setMessagesItem(null);
			setSupervisionMessages([]);

			if (subscribed.current && activeSession) {
				subscribed.current = false;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		activeSession,
		// Function dependencies intentionally omitted to prevent re-subscribe
		// loops; fetchSessionMessages/setSessionRead are stable per session.
		type,
		userData
	]);

	useEffect(() => {
		if (hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)) {
			return;
		}
		const rawAgencyId =
			activeSession.item?.agencyId || activeSession.agency?.id;
		if (!rawAgencyId) {
			return;
		}
		const agencyId = rawAgencyId.toString();
		apiGetAgencyConsultantList(agencyId)
			.then((response) => {
				const consultants = prepareConsultantDataForSelect(response);
				setConsultantList(consultants);
			})
			.catch((error) => {
				// console.log(error);
			});
	}, [
		activeSession.item?.agencyId,
		activeSession.agency?.id,
		setConsultantList,
		userData
	]);

	// console.log('🔥 SessionStream RENDER:', {
	// loading,
	// hasMessages: !!messagesItem,
	// messageCount: messagesItem?.messages?.length,
	// activeSessionId: activeSession?.item?.id
	// });

	const caseHandoverTopicId =
		(activeSession?.item?.topic as { id?: number })?.id ?? null;
	const caseHandoverTopic = useTopic(caseHandoverTopicId);
	const caseHandoverTopicLabel = caseHandoverTopic?.name;

	if (caseHandoverCurtainNeeded && caseHandoverStatusLoading) {
		return <Loading />;
	}

	if (loading) {
		// console.log('🔥 SessionStream: Showing loading spinner');
		return <Loading />;
	}

	// console.log('🔥 SessionStream: Rendering session content');

	const handleOverlayAction = (buttonFunction: string) => {
		if (buttonFunction === OVERLAY_FUNCTIONS.REDIRECT) {
			navigate(
				listPath +
					(sessionListTab ? `?sessionListTab=${sessionListTab}` : '')
			);
		} else if (buttonFunction === OVERLAY_FUNCTIONS.LOGOUT) {
			logout();
		}
	};

	const handleCaseHandoverStatusChange = (nextStatus: CaseHandoverStatus) => {
		setCaseHandoverStatus(nextStatus);
		if (nextStatus.canViewContent) {
			loadAfterCaseHandoverGranted();
		}
	};

	const handleCaseHandoverConsentDecision = (approved: boolean) => {
		if (
			!pendingCaseHandoverConsent ||
			pendingCaseHandoverRequestId === null
		) {
			setCaseHandoverConsentError(translate('caseHandover.error.failed'));
			return;
		}
		setCaseHandoverConsentSubmitting(true);
		setCaseHandoverConsentError('');
		apiDecideCaseHandoverClientConsent(
			activeSession.item.id,
			pendingCaseHandoverRequestId,
			approved
		)
			.then(() => {
				notificationsContext?.markNotificationAsRead(
					pendingCaseHandoverConsent.id
				);
				setResolvedCaseHandoverNotificationId(
					pendingCaseHandoverConsent.id
				);
				notificationsContext?.refreshNotificationFeed();
			})
			.catch(() => {
				setCaseHandoverConsentError(
					translate('caseHandover.error.failed')
				);
			})
			.finally(() => setCaseHandoverConsentSubmitting(false));
	};

	if (caseHandoverCurtainNeeded && !caseHandoverStatus?.canViewContent) {
		return (
			<div className="session__wrapper">
				<CaseHandoverCurtain
					sessionId={activeSession.item.id}
					status={caseHandoverStatus}
					onStatusChange={handleCaseHandoverStatusChange}
					topicLabel={caseHandoverTopicLabel}
				/>
			</div>
		);
	}

	// FE#514 / ADR-016: the Team-Besprechung exists for consultants on
	// Agency-Counselling enquiries only (Live Chat + groups excluded). The
	// panel itself keeps working read-only when an archived discussion exists.
	const { featureTeamDiscussionEnabled = true } = getTenantSettings();
	const showTeamDiscussion =
		featureTeamDiscussionEnabled &&
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
		!activeSession.isGroup &&
		getModality(activeSession) === Modality.AGENCY_COUNSELLING &&
		!!activeSession.item?.id;

	return (
		<div className="session__wrapper">
			{pendingCaseHandoverConsent &&
				pendingCaseHandoverRequestId !== null && (
					<CaseHandoverConsentCard
						mode={
							pendingCaseHandoverConsent.params?.clientConsent ===
							'OPT_OUT'
								? 'OPT_OUT'
								: 'OPT_IN'
						}
						isSubmitting={caseHandoverConsentSubmitting}
						error={caseHandoverConsentError}
						timestamp={formatToHHMM(
							String(
								new Date(
									pendingCaseHandoverConsent.createdAt
								).getTime()
							)
						)}
						onApprove={() =>
							handleCaseHandoverConsentDecision(true)
						}
						onDecline={() =>
							handleCaseHandoverConsentDecision(false)
						}
					/>
				)}
			{showTeamDiscussion && (
				<TeamDiscussionPanel
					key={activeSession.item.id}
					sessionId={activeSession.item.id}
					allowCreate={activeSession.isEnquiry}
					initiallyOpen={teamDiscussionParam === '1'}
				/>
			)}
			<SessionItemComponent
				hasUserInitiatedStopOrLeaveRequest={
					hasUserInitiatedStopOrLeaveRequest
				}
				isTyping={handleSessionTyping}
				typingUsers={matrixTypingUsers}
				messages={messagesItem?.messages}
				reactionEvents={messagesItem?.reactionEvents || []}
				supervisionMessages={supervisionMessages}
				bannedUsers={bannedUsers}
				refreshMessages={fetchSessionMessages}
			/>
			{isOverlayActive && (
				<Overlay
					item={overlayItem}
					handleOverlay={handleOverlayAction}
				/>
			)}
		</div>
	);
};
