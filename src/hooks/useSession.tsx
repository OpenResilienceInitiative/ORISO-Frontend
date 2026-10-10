import { useCallback, useEffect, useRef, useState } from 'react';
import {
	apiGetSessionRoomBySessionId,
	apiGetSessionRoomsByRoomIds
} from '../api/apiGetSessionRooms';
import { buildExtendedSession, ExtendedSessionInterface } from '../globalState';
import { FETCH_ERRORS } from '../api';
import { chatTransportService } from '../services/chatTransportService';
import { isRoomUnread } from '../utils/sessionUnread';
import { apiGetChatRoomById } from '../api/apiGetChatRoomById';
import { apiGetCaseHandoverCandidates } from '../api/apiCaseHandover';
import { getModality, Modality } from '../components/session/getModality';
import { useForegroundRefresh } from './useForegroundRefresh';
import { messageEventEmitter } from '../services/messageEventEmitter';

export const useSession = (
	rid: string | null,
	sessionId?: number,
	chatId?: number,
	reconcilePendingEnquiry = false
): {
	session: ExtendedSessionInterface;
	reload: () => void;
	read: () => void;
	ready: boolean;
} => {
	const [ready, setReady] = useState(false);
	const [session, setSession] = useState<ExtendedSessionInterface>(null);
	const repetitiveId = useRef(null);
	const abortController = useRef<AbortController>(null);
	const inFlight = useRef<{ controller: AbortController; pending: boolean }>(
		null
	);

	const loadCaseHandoverCandidateSession = useCallback(
		async (signal?: AbortSignal): Promise<boolean> => {
			if (sessionId === undefined || sessionId === null) {
				return false;
			}

			const { sessions } = await apiGetCaseHandoverCandidates({
				query: String(sessionId),
				count: 15,
				signal
			});
			const candidate = (sessions || []).find(
				(item) => item?.session?.id === sessionId
			);
			if (
				!candidate ||
				signal?.aborted ||
				abortController.current?.signal !== signal
			) {
				return false;
			}

			setSession(buildExtendedSession(candidate, rid));
			setReady(true);
			return true;
		},
		[rid, sessionId]
	);

	useEffect(() => {
		repetitiveId.current =
			getModality(session) === Modality.SELF_HELP
				? session.item.id
				: null;
	}, [session]);

	const loadSession = useCallback(
		(background = false): Promise<void> | undefined => {
			if (
				background &&
				inFlight.current?.controller === abortController.current &&
				!abortController.current?.signal.aborted &&
				inFlight.current
			) {
				inFlight.current.pending = true;
				return;
			}
			// console.log('🔍 useSession.loadSession CALLED:', { rid, sessionId, chatId });

			if (abortController.current) {
				// console.log('🔍 useSession: Aborting previous request');
				abortController.current.abort();
			}

			const controller = new AbortController();
			abortController.current = controller;
			const isCurrent = () =>
				!controller.signal.aborted &&
				abortController.current === controller;

			const request = { controller, pending: false };
			inFlight.current = request;
			let promise;

			if (
				!rid &&
				(sessionId === undefined || sessionId === null) &&
				(chatId === undefined || chatId === null)
			) {
				// console.log('⚠️ useSession: No rid, sessionId, or chatId provided - returning early');
				return;
			}

			if (chatId !== undefined && chatId !== null) {
				// console.log('🔍 useSession: Loading by chatId:', chatId);
				promise = apiGetChatRoomById(chatId, controller.signal);
			} else if (rid) {
				const signal = controller.signal;
				promise = apiGetSessionRoomsByRoomIds([rid], signal).catch(
					(error) => {
						// A colleague may retain session access after it leaves their room list.
						if (
							error.message === FETCH_ERRORS.EMPTY &&
							sessionId != null
						) {
							return apiGetSessionRoomBySessionId(
								sessionId,
								signal
							);
						}
						throw error;
					}
				);
			} else if (sessionId !== undefined && sessionId !== null) {
				// console.log('🔍 useSession: Loading by sessionId:', sessionId);
				promise = apiGetSessionRoomBySessionId(
					sessionId,
					controller.signal
				);
			}

			return promise
				.then(async ({ sessions: [activeSession] }) => {
					if (!isCurrent()) return;
					if (activeSession) {
						const extendedSession = buildExtendedSession(
							activeSession,
							rid
						);
						setSession(extendedSession);
					} else if (!background) {
						if (
							sessionId !== undefined &&
							sessionId !== null &&
							(await loadCaseHandoverCandidateSession(
								controller.signal
							).catch(() => false))
						) {
							return;
						}
					}
					if (isCurrent()) setReady(true);
				})
				.catch(async (e) => {
					if (!isCurrent() || e.message === FETCH_ERRORS.ABORT) {
						return;
					}

					if (background) {
						// A temporary outage must not erase the visible conversation.
						if (e.message === FETCH_ERRORS.FORBIDDEN) {
							setSession(null);
						}
						return;
					}

					if (repetitiveId.current) {
						return apiGetChatRoomById(repetitiveId.current).then(
							({ sessions: [session] }) => {
								if (!isCurrent()) return;
								// console.log('✅ useSession: Repetitive session loaded:', session);
								setSession(buildExtendedSession(session, rid));
								setReady(true);
							}
						);
					}
					if (
						sessionId !== undefined &&
						sessionId !== null &&
						(await loadCaseHandoverCandidateSession(
							controller.signal
						).catch(() => false))
					) {
						return;
					}
					if (!isCurrent()) return;
					// console.log('❌ useSession: Setting session to null');
					setSession(null);
					setReady(true);
				})
				.finally(() => {
					if (inFlight.current === request) inFlight.current = null;
					if (
						isCurrent() &&
						request.pending &&
						document.visibilityState !== 'hidden'
					) {
						void loadSession(true);
					}
				});
		},
		[rid, sessionId, chatId, loadCaseHandoverCandidateSession]
	);

	const reconcileEnquiry = Boolean(
		reconcilePendingEnquiry &&
			session?.isEnquiry &&
			getModality(session) === Modality.AGENCY_COUNSELLING
	);
	useForegroundRefresh(reconcileEnquiry, () => {
		void loadSession(true);
	});

	const roomId = session?.item?.matrixRoomId;
	const activeSessionId = session?.item?.id;
	useEffect(() => {
		if (!reconcileEnquiry) return;
		const reconcile = (
			event: Parameters<typeof messageEventEmitter.emit>[0]
		) => {
			if (document.visibilityState === 'hidden') return;
			if (
				(event.roomId &&
					(event.roomId === roomId || event.roomId === rid)) ||
				(event.sessionId != null &&
					event.sessionId === activeSessionId) ||
				(event.changedSessionId != null &&
					event.changedSessionId === activeSessionId) ||
				event.refreshSessionList ||
				event.refreshEnquiryList
			) {
				void loadSession(true);
			}
		};
		messageEventEmitter.on(reconcile);
		return () => messageEventEmitter.off(reconcile);
	}, [activeSessionId, loadSession, reconcileEnquiry, rid, roomId]);

	const readSession = useCallback(() => {
		if (!session) {
			return;
		}

		// Matrix read receipt on the latest room event. Read state is derived
		// from the Matrix client (#1147) — the DTO's `messagesRead` is a
		// hard-coded constant and must not gate the receipt. Sessions without
		// a Matrix room cannot publish a receipt and are a safe no-op.
		const { matrixRoomId } = chatTransportService.resolveSession(session);
		if (matrixRoomId && isRoomUnread(matrixRoomId)) {
			chatTransportService.markRoomAsRead(matrixRoomId).catch(() => {});
		}
	}, [session]);

	useEffect(() => {
		loadSession();

		return () => {
			setReady(false);
			setSession(null);
			if (abortController.current) {
				abortController.current.abort();
				abortController.current = null;
			}
		};
	}, [loadSession]);

	// Promise callbacks may supply a value; public reload always means an explicit reload.
	const reload = useCallback(() => {
		void loadSession();
	}, [loadSession]);
	return { session, ready, reload, read: readSession };
};
