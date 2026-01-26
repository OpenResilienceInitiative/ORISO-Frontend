import { useCallback, useEffect, useRef, useState } from 'react';
import {
	apiGetSessionRoomBySessionId,
	apiGetSessionRoomsByGroupIds
} from '../api/apiGetSessionRooms';
import { buildExtendedSession, ExtendedSessionInterface } from '../globalState';
import { apiSetSessionRead, FETCH_ERRORS } from '../api';
import { apiGetChatRoomById } from '../api/apiGetChatRoomById';

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

	useEffect(() => {
		repetitiveId.current = session?.item?.repetitive
			? session.item.id
			: null;
	}, [session]);

	const loadSession = useCallback(() => {
		console.log('🔍 useSession.loadSession CALLED:', { rid, sessionId, chatId });
		
		if (abortController.current) {
			console.log('🔍 useSession: Aborting previous request');
			abortController.current.abort();
		}

		abortController.current = new AbortController();

		let promise;

		if (!rid && !sessionId && !chatId) {
			console.log('⚠️ useSession: No rid, sessionId, or chatId provided - returning early');
			return;
		}

		if (chatId) {
			console.log('🔍 useSession: Loading by chatId:', chatId);
			promise = apiGetChatRoomById(
				chatId,
				abortController.current.signal
			);
		} else if (sessionId) {
			console.log('🔍 useSession: Loading by sessionId:', sessionId);
			promise = apiGetSessionRoomBySessionId(
				sessionId,
				abortController.current.signal
			);
		} else {
			console.log('🔍 useSession: Loading by rid (groupId):', rid);
			promise = apiGetSessionRoomsByGroupIds(
				[rid],
				abortController.current.signal
			);
		}

		return promise
			.then(({ sessions: [activeSession] }) => {
				console.log('✅ useSession: API response received:', { 
					hasSession: !!activeSession,
					sessionData: activeSession 
				});
				
				if (activeSession) {
					const extendedSession = buildExtendedSession(activeSession, rid);
					console.log('✅ useSession: Extended session built:', extendedSession);
					setSession(extendedSession);
				} else {
					console.log('⚠️ useSession: No session in response');
				}
				setReady(true);
			})
			.catch((e) => {
				console.log('❌ useSession: Error loading session:', {
					error: e,
					message: e.message,
					isAbort: e.message === FETCH_ERRORS.ABORT,
					repetitiveId: repetitiveId.current
				});
				
				if (e.message === FETCH_ERRORS.ABORT) {
					return;
				}

				if (repetitiveId.current) {
					console.log('🔄 useSession: Retrying with repetitiveId:', repetitiveId.current);
					return apiGetChatRoomById(repetitiveId.current).then(
						({ sessions: [session] }) => {
							console.log('✅ useSession: Repetitive session loaded:', session);
							setSession(buildExtendedSession(session, rid));
							setReady(true);
						}
					);
				}
				console.log('❌ useSession: Setting session to null');
				setSession(null);
				setReady(true);
			});
	}, [rid, sessionId, chatId]);

	const readSession = useCallback(() => {
		if (!session) {
			return;
		}

		if (!session.item.messagesRead) {
			apiSetSessionRead(session.rid).then();
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
