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
	ActiveSessionContext
} from '../../globalState';
import {
	apiGetAgencyConsultantList,
	apiGetCaseHandoverStatus,
	CaseHandoverStatus,
	FETCH_ERRORS
} from '../../api';
import { prepareMessages } from './sessionHelpers';
import { isMatrixRoom } from '../../utils/matrixRoomUtils';
import './session.styles';
import useUpdatingRef from '../../hooks/useUpdatingRef';
import { useTranslation } from 'react-i18next';
import { prepareConsultantDataForSelect } from '../sessionAssign/sessionAssignHelper';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import { chatTransportService } from '../../services/chatTransportService';
import { formatMatrixTimelineEvent } from '../../utils/matrixTimelineEventFormatter';
import { CaseHandoverGate } from './CaseHandoverGate';
import { isCaseHandoverAccessControlled } from './caseHandoverHelpers';

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

	const { type } = useContext(SessionTypeContext);
	const { userData } = useContext(UserDataContext);
	const { matrixClientService } = useMatrixClient();

	// MATRIX MIGRATION: Track component mount/unmount
	useEffect(() => {
		// console.log('🔥 SessionStream MOUNTED');
		return () => {
			// console.log('🔥 SessionStream UNMOUNTED - Component is being destroyed!');
		};
	}, []);

	const subscribed = useRef(false);
	const [messagesItem, setMessagesItem] = useState(null);
	const [loading, setLoading] = useState(true);

	const { activeSession, readActiveSession } =
		useContext(ActiveSessionContext);
	const [caseHandoverStatus, setCaseHandoverStatus] =
		useState<CaseHandoverStatus | null>(null);
	const [caseHandoverStatusLoading, setCaseHandoverStatusLoading] =
		useState(false);

	const { setConsultantList } = useContext(ConsultantListContext);

	const abortController = useRef<AbortController>(null);
	const hasUserInitiatedStopOrLeaveRequest = useRef<boolean>(false);

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
			chatTransportService.sendTyping(matrixRoomId, typing).catch(() => {});
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

	const fetchSessionMessages = useCallback(
		(forceCaseHandoverAccess = false): Promise<boolean> => {
			if (abortController.current) {
				abortController.current.abort();
			}

			abortController.current = new AbortController();

			if (
				caseHandoverGateNeeded &&
				!forceCaseHandoverAccess &&
				!caseHandoverStatus?.canViewContent
			) {
				setMessagesItem({ messages: [] });
				setLoading(false);
				return Promise.resolve(false);
			}

			// Matrix-backed sessions must hydrate from the local Matrix SDK timeline.
			// Pulling message history through ORISO REST would move decrypted/plaintext
			// bodies outside the room encryption boundary.
			if (resolvedChatSession.isMatrixSession) {
				const resolvedMatrixRoomId = resolvedChatSession.matrixRoomId;
				const matrixRoom = resolvedMatrixRoomId
					? chatTransportService.getMatrixRoom(resolvedMatrixRoomId)
					: null;
				const matrixEvents = resolvedMatrixRoomId
					? chatTransportService.getMatrixRoomMessages(
							resolvedMatrixRoomId,
							100
						)
					: [];
				const encryptedFallbackText = translate(
					'e2ee.message.encryption.text'
				);
				const formattedMessages = matrixEvents
					.map((event: any) =>
						formatMatrixTimelineEvent(
							event,
							matrixRoom,
							encryptedFallbackText
						)
					)
					.filter(Boolean);

				setMessagesItem({
					messages: prepareMessages(formattedMessages)
				});
				setLoading(false);
				return Promise.resolve(true);
			}

			// Sessions without a Matrix room (stale pre-migration data) render
			// an empty history instead of pulling legacy Rocket.Chat messages.
			setMessagesItem({ messages: [] });
			setLoading(false);
			return Promise.resolve(true);
		},
		[
			caseHandoverGateNeeded,
			caseHandoverStatus?.canViewContent,
			resolvedChatSession,
			translate
		]
	);
	const fetchSessionMessagesRef = useUpdatingRef(fetchSessionMessages);

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

		if (!caseHandoverGateNeeded || !sessionId) {
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
		caseHandoverGateNeeded,
		loadAfterCaseHandoverGranted
	]);

	// Real-time message sync via the Matrix timeline listener.
	useEffect(() => {
		// Only for Matrix sessions.
		if (!resolvedChatSession.isMatrixSession) {
			return;
		}
		const matrixRoomId = resolvedChatSession.matrixRoomId;

		if (!matrixRoomId) {
			return;
		}

		let retryTimer: number | null = null;
		let detachTimelineListener: (() => void) | null = null;
		let lastRefreshAt = 0;

		const attachTimelineListener = () => {
			const handleMatrixTimeline = (
				event: any,
				room: any,
				toStartOfTimeline: boolean
			) => {
				if (toStartOfTimeline || room?.roomId !== matrixRoomId) {
					return;
				}

				const eventType = event?.getType?.();
				if (
					eventType !== 'm.room.message' &&
					eventType !== 'm.room.encrypted'
				) {
					return;
				}

				// Coalesce bursts (decrypt + relation updates) into one fetch.
				const now = Date.now();
				if (now - lastRefreshAt < 120) {
					return;
				}
				lastRefreshAt = now;

				fetchSessionMessages().catch(() => {
					// keep UI stable if a timeline event races with navigation
				});
			};

			detachTimelineListener = chatTransportService.onMatrixTimeline(
				matrixRoomId,
				handleMatrixTimeline
			);
			return Boolean(detachTimelineListener);
		};

		// Try immediately, then retry until Matrix client is ready.
		if (!attachTimelineListener()) {
			retryTimer = window.setInterval(() => {
				if (attachTimelineListener() && retryTimer) {
					window.clearInterval(retryTimer);
					retryTimer = null;
				}
			}, 500);
		}

		return () => {
			if (retryTimer) {
				window.clearInterval(retryTimer);
			}
			detachTimelineListener?.();
		};
	}, [resolvedChatSession, fetchSessionMessages]);

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
		matrixTypingActivityRef.current.clear();

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
			matrixTypingActivityRef.current.clear();
			setMatrixTypingUsers([]);
		};
	}, [
		isMatrixSession,
		matrixRoomId,
		MATRIX_TYPING_STALE_MS,
		matrixClientService
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

			if (subscribed.current && activeSession) {
				subscribed.current = false;
			}
		};
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

	if (caseHandoverGateNeeded && caseHandoverStatusLoading) {
		return <Loading />;
	}

	if (loading) {
		// console.log('🔥 SessionStream: Showing loading spinner');
		return <Loading />;
	}

	// console.log('🔥 SessionStream: Rendering session content');

	const handleCaseHandoverStatusChange = (nextStatus: CaseHandoverStatus) => {
		setCaseHandoverStatus(nextStatus);
		if (nextStatus.canViewContent) {
			loadAfterCaseHandoverGranted();
		}
	};

	if (caseHandoverGateNeeded && !caseHandoverStatus?.canViewContent) {
		return (
			<div className="session__wrapper">
				<CaseHandoverGate
					sessionId={activeSession.item.id}
					status={caseHandoverStatus}
					onStatusChange={handleCaseHandoverStatusChange}
				/>
			</div>
		);
	}

	return (
		<div className="session__wrapper">
			<SessionItemComponent
				hasUserInitiatedStopOrLeaveRequest={
					hasUserInitiatedStopOrLeaveRequest
				}
				isTyping={handleSessionTyping}
				typingUsers={matrixTypingUsers}
				messages={messagesItem?.messages}
				bannedUsers={bannedUsers}
				refreshMessages={fetchSessionMessages}
			/>
		</div>
	);
};
