import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
	apiDeleteUserDraft,
	apiGetUserDraft,
	apiUpsertUserDraft,
	FETCH_ERRORS,
	IUserDraftItem
} from '../../api';
import { decryptText, encryptText } from '../../utils/encryptionHelpers';
import { apiPostError, ERROR_LEVEL_WARN } from '../../api/apiPostError';
import { useE2EE } from '../../hooks/useE2EE';
import { E2EEContext, ActiveSessionContext } from '../../globalState';
import { convertFromRaw, EditorState } from 'draft-js';
import { markdownToDraft } from 'markdown-draft-js';
import { EVENT_PRE_LOGOUT } from '../logout/logout';
import {
	addEventListener,
	removeEventListener
} from '../../utils/eventHandler';
import {
	REMOTE_DRAFT_INDEX_SCOPE
} from '../../services/draftStore';

const SAVE_DRAFT_TIMEOUT = 1500;

export const useDraftMessage = (
	enabled: boolean,
	loadFunction: (state: EditorState) => void,
	options?: {
		threadRootId?: string | null;
		actionPath?: string | null;
		sessionId?: number | null;
		roomRef?: string | null;
		title?: string | null;
	}
) => {
	const { activeSession } = useContext(ActiveSessionContext);
	const { isE2eeEnabled } = useContext(E2EEContext);

	const draftSaveTimeout = useRef(null);

	const { keyID, key, encrypted, ready } = useE2EE(activeSession.rid);

	const [loaded, setLoaded] = useState(false);
	const [messageRes, setMessageRes] = useState<IUserDraftItem>(null);
	const [message, setMessage] = useState(null);
	const isEmbeddedNotificationsView =
		new URLSearchParams(window.location.search).get(
			'embeddedNotifications'
		) === '1';
	const scopeId = activeSession?.rid || activeSession?.item?.id;
	const remoteScopeKey = `scope:${String(scopeId || 'unknown')}|thread:${
		options?.threadRootId || 'main'
	}`;
	const canUseRemoteApi = !!scopeId;

	const setEditorWithMarkdownString = useCallback(
		(markdownString: string) => {
			const rawObject = markdownToDraft(markdownString);
			const draftContent = convertFromRaw(rawObject);
			const editorStateWithText = EditorState.createWithContent(draftContent);
			loadFunction(EditorState.moveFocusToEnd(editorStateWithText));
		},
		[loadFunction]
	);

	const updateRemoteDraftIndex = useCallback(
		async (draftText?: string) => {
			if (!canUseRemoteApi) {
				return;
			}
			const upsertPayload = {
				actionPath: options?.actionPath || null,
				title: options?.title || null,
				sessionId: options?.sessionId ?? activeSession?.item?.id ?? null,
				roomRef: options?.roomRef ?? activeSession?.rid ?? null,
				threadRootId: options?.threadRootId || null,
				updatedAt: Date.now()
			};
			let indexMap: Record<string, any> = {};
			try {
				const indexRes = await apiGetUserDraft(REMOTE_DRAFT_INDEX_SCOPE);
				indexMap = indexRes?.text ? JSON.parse(indexRes.text) : {};
			} catch (e: any) {
				if (e?.message !== FETCH_ERRORS.EMPTY) {
					indexMap = {};
				}
			}

			if (draftText && draftText.trim().length > 0) {
				indexMap[remoteScopeKey] = upsertPayload;
			} else {
				delete indexMap[remoteScopeKey];
			}

			await apiUpsertUserDraft(REMOTE_DRAFT_INDEX_SCOPE, {
				text: JSON.stringify(indexMap)
			}).catch();
		},
		[
			activeSession?.item?.id,
			activeSession?.rid,
			canUseRemoteApi,
			options?.actionPath,
			options?.roomRef,
			options?.sessionId,
			options?.threadRootId,
			options?.title,
			remoteScopeKey
		]
	);

	// Load the draft message from the api but do not show it because its encrypted
	useEffect(() => {
		const abortController = new AbortController();
		setLoaded(false);
		setMessageRes(null);
		if (!canUseRemoteApi) {
			setLoaded(true);
			return () => {
				abortController?.abort();
			};
		}

		apiGetUserDraft(remoteScopeKey, abortController.signal)
			.then((remoteDraft) => {
				if (!remoteDraft?.text) {
					setLoaded(true);
					return;
				}
				setMessageRes(remoteDraft);
			})
			.catch((e) => {
				if (e.message === FETCH_ERRORS.EMPTY) {
					setLoaded(true);
					return;
				}
				setLoaded(true);
			});

		return () => {
			abortController?.abort();
		};
	}, [
		canUseRemoteApi,
		remoteScopeKey,
		setEditorWithMarkdownString
	]);

	// If everything is ready for decryption, decrypt the draft message
	useEffect(() => {
		if (!messageRes) {
			return;
		}

		if (!messageRes.text) {
			setLoaded(true);
			return;
		}

		// Plain drafts must never wait for key readiness, otherwise the input can stay locked.
		if (!isE2eeEnabled || !encrypted) {
			setEditorWithMarkdownString(messageRes.text);
			setMessage(messageRes.text);
			setLoaded(true);
			return;
		}

		if (!ready) {
			return;
		}

		decryptText(
			messageRes.text,
			keyID,
			key,
			encrypted,
			false,
			'enc.'
		)
			.catch(() => messageRes.text)
			.then((msg) => {
				setEditorWithMarkdownString(msg);
				setMessage(msg);
				setLoaded(true);
			});
	}, [
		messageRes,
		encrypted,
		isE2eeEnabled,
		key,
		keyID,
		ready,
		setEditorWithMarkdownString
	]);

	const saveDraftMessage = useCallback(
		async (draftMessage) => {
			// Embedded preview iframes must not persist drafts on unmount/switch.
			if (!enabled || !loaded || isEmbeddedNotificationsView) {
				return;
			}
			let message = draftMessage ?? '';

			if (isE2eeEnabled && encrypted && draftMessage) {
				try {
					message = await encryptText(
						draftMessage,
						keyID,
						key,
						'enc.'
					);
				} catch (e: any) {
					await apiPostError({
						name: e.name,
						message: e.message,
						stack: e.stack,
						level: ERROR_LEVEL_WARN
					});
				}
			}

			if (canUseRemoteApi) {
				await apiUpsertUserDraft(remoteScopeKey, {
					text: message,
					actionPath: options?.actionPath || null,
					title: options?.title || null,
					sourceSessionId: options?.sessionId ?? activeSession?.item?.id ?? null,
					roomRef: options?.roomRef ?? activeSession?.rid ?? null,
					threadRootId: options?.threadRootId || null
				}).catch();
				await updateRemoteDraftIndex(draftMessage);
			}
		},
		[
			activeSession?.item?.id,
			activeSession?.rid,
			canUseRemoteApi,
			loaded,
			encrypted,
			isE2eeEnabled,
			enabled,
			isEmbeddedNotificationsView,
			key,
			keyID,
			options?.actionPath,
			options?.roomRef,
			options?.sessionId,
			options?.threadRootId,
			options?.title,
			remoteScopeKey,
			updateRemoteDraftIndex
		]
	);

	const onChange = useCallback(
		(markdownMessage) => {
			if (!loaded) {
				return;
			}

			setMessage(markdownMessage);

			if (draftSaveTimeout.current) {
				clearTimeout(draftSaveTimeout.current);
			}

			draftSaveTimeout.current = setTimeout(() => {
				saveDraftMessage(markdownMessage).then();
			}, SAVE_DRAFT_TIMEOUT);
		},
		[loaded, saveDraftMessage]
	);

	const onLogout = useCallback(
		async (args) => {
			if (draftSaveTimeout.current) {
				clearTimeout(draftSaveTimeout.current);
				draftSaveTimeout.current = null;
			}
			await saveDraftMessage(message);
			return args;
		},
		[message, saveDraftMessage]
	);

	useEffect(() => {
		addEventListener(EVENT_PRE_LOGOUT, onLogout);

		return () => {
			removeEventListener(EVENT_PRE_LOGOUT, onLogout);
		};
	}, [onLogout]);

	useEffect(() => {
		return () => {
			if (draftSaveTimeout.current) {
				clearTimeout(draftSaveTimeout.current);
				draftSaveTimeout.current = null;
			}
			saveDraftMessage(message).then();
		};
	}, [message, saveDraftMessage]);

	const clearDraftMessage = useCallback(() => {
		if (isEmbeddedNotificationsView) {
			setMessage('');
			return;
		}
		if (canUseRemoteApi) {
			apiDeleteUserDraft(remoteScopeKey).catch();
			updateRemoteDraftIndex('').catch();
		}
		setMessage('');
	}, [
		canUseRemoteApi,
		isEmbeddedNotificationsView,
		remoteScopeKey,
		updateRemoteDraftIndex
	]);

	return {
		onChange,
		loaded,
		clearDraftMessage
	};
};
