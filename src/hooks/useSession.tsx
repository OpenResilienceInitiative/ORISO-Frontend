import { useCallback, useEffect, useRef, useState } from 'react';
import {
	apiGetSessionRoomBySessionId,
	apiGetSessionRoomsByRoomIds
} from '../api/apiGetSessionRooms';
import { buildExtendedSession, ExtendedSessionInterface } from '../globalState';
import { FETCH_ERRORS } from '../api';
import { chatTransportService } from '../services/chatTransportService';
import { apiGetChatRoomById } from '../api/apiGetChatRoomById';
import { apiGetCaseHandoverCandidates } from '../api/apiCaseHandover';
import { getModality, Modality } from '../components/session/getModality';

export const useSession = (
	rid: string | null,
	sessionId?: number,
	chatId?: number
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
			if (!candidate) {
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

	const loadSession = useCallback(() => {
		// console.log('🔍 useSession.loadSession CALLED:', { rid, sessionId, chatId });

		if (abortController.current) {
			// console.log('🔍 useSession: Aborting previous request');
			abortController.current.abort();
		}

		abortController.current = new AbortController();

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
			promise = apiGetChatRoomById(
				chatId,
				abortController.current.signal
			);
		} else if (rid) {
			promise = apiGetSessionRoomsByRoomIds(
				[rid],
				abortController.current.signal
			);
		} else if (sessionId !== undefined && sessionId !== null) {
			// console.log('🔍 useSession: Loading by sessionId:', sessionId);
			promise = apiGetSessionRoomBySessionId(
				sessionId,
				abortController.current.signal
			);
		}

		return promise
			.then(async ({ sessions: [activeSession] }) => {
				if (activeSession) {
					const extendedSession = buildExtendedSession(
						activeSession,
						rid
					);
					setSession(extendedSession);
				} else {
					if (
						sessionId !== undefined &&
						sessionId !== null &&
						(await loadCaseHandoverCandidateSession(
							abortController.current?.signal
						).catch(() => false))
					) {
						return;
					}
				}
				setReady(true);
			})
			.catch(async (e) => {
				if (e.message === FETCH_ERRORS.ABORT) {
					return;
				}

				if (repetitiveId.current) {
					return apiGetChatRoomById(repetitiveId.current).then(
						({ sessions: [session] }) => {
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
						abortController.current?.signal
					).catch(() => false))
				) {
					return;
				}
				// console.log('❌ useSession: Setting session to null');
				setSession(null);
				setReady(true);
			});
	}, [rid, sessionId, chatId, loadCaseHandoverCandidateSession]);

	const readSession = useCallback(() => {
		if (!session) {
			return;
		}

		if (!session.item.messagesRead) {
			// Matrix read receipt on the latest room event. Sessions without
			// a Matrix room are a safe no-op (no legacy read call).
			const { matrixRoomId } =
				chatTransportService.resolveSession(session);
			if (matrixRoomId) {
				chatTransportService
					.markRoomAsRead(matrixRoomId)
					.catch(() => {});
			}
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

	return { session, ready, reload: loadSession, read: readSession };
};
