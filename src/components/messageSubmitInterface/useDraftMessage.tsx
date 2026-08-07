import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
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
import { EditorState } from 'draft-js';
import { EVENT_PRE_LOGOUT } from '../logout/logout';
import {
	addEventListener,
	removeEventListener
} from '../../utils/eventHandler';
import {
	hasDraftContent,
	REMOTE_DRAFT_INDEX_SCOPE
} from '../../services/draftStore';

const SAVE_DRAFT_TIMEOUT = 1500;

export const useDraftMessage = (
	enabled: boolean,
	loadFunction: (state: EditorState, rawDraft?: string) => void,
	options?: {
		threadRootId?: string | null;
		actionPath?: string | null;
		sessionId?: number | null;
		roomRef?: string | null;
		title?: string | null;
		forcedScopeKey?: string | null;
	}
) => {
	const { activeSession } = useContext(ActiveSessionContext);
	const { isE2eeEnabled } = useContext(E2EEContext);

	const draftSaveTimeout = useRef(null);
	const loadVersionRef = useRef(0);
	const latestMessageRef = useRef<string>('');
	const skipNextCleanupSaveRef = useRef(false);
	// #976: whether a remote draft row is known to exist for this scope. An
	// emptied composer only has to issue a DELETE when there is something to
	// delete — merely opening and leaving a conversation must stay silent.
	const hasRemoteDraftRef = useRef(false);

	const { keyID, key, encrypted, ready } = useE2EE(activeSession.rid);

	const [loaded, setLoaded] = useState(false);
	const [messageRes, setMessageRes] = useState<IUserDraftItem>(null);
	const [, setMessage] = useState(null);
	const threadKey = options?.threadRootId || 'main';
	const roomScopeKey = activeSession?.rid
		? `scope:${String(activeSession.rid)}|thread:${threadKey}`
		: null;
	const sessionScopeKey = activeSession?.item?.id
		? `scope:${String(activeSession.item.id)}|thread:${threadKey}`
		: null;
	const forcedScopeKey = options?.forcedScopeKey?.trim() || null;
	const scopeKeysToTry = useMemo(
		() =>
			Array.from(
				new Set(
					[forcedScopeKey, roomScopeKey, sessionScopeKey].filter(
						Boolean
					)
				)
			),
		[forcedScopeKey, roomScopeKey, sessionScopeKey]
	);
	const remoteScopeKey =
		forcedScopeKey ||
		roomScopeKey ||
		sessionScopeKey ||
		`scope:unknown|thread:${threadKey}`;
	const canUseRemoteApi = scopeKeysToTry.length > 0;

	const setEditorWithDraftString = useCallback(
		(draftString: string) => {
			try {
				// TipTapComposer reads rawDraft directly (HTML/plain text).
				loadFunction(EditorState.createEmpty(), draftString || '');
			} catch {
				loadFunction(EditorState.createEmpty(), '');
			}
		},
		[loadFunction]
	);

	const updateRemoteDraftIndex = useCallback(
		async (draftText?: string) => {
			if (!canUseRemoteApi) {
				return;
			}
			try {
				const upsertPayload = {
					actionPath: options?.actionPath || null,
					title: options?.title || null,
					sessionId:
						options?.sessionId ?? activeSession?.item?.id ?? null,
					roomRef: options?.roomRef ?? activeSession?.rid ?? null,
					threadRootId: options?.threadRootId || null,
					updatedAt: Date.now()
				};
				let indexMap: Record<string, any> = {};
				try {
					const indexRes = await apiGetUserDraft(
						REMOTE_DRAFT_INDEX_SCOPE
					);
					indexMap =
						indexRes?.text && typeof indexRes.text === 'string'
							? JSON.parse(indexRes.text)
							: {};
				} catch (e: any) {
					if (e?.message !== FETCH_ERRORS.EMPTY) {
						indexMap = {};
					}
				}

				if (hasDraftContent(draftText)) {
					indexMap[remoteScopeKey] = upsertPayload;
				} else {
					delete indexMap[remoteScopeKey];
				}

				if (Object.keys(indexMap).length === 0) {
					/*
					 * #976: an empty map serialises to "{}", which is not blank,
					 * so the backend keeps the row forever - a contentless draft
					 * that no view can open and nothing can clear. Drop the row
					 * instead of storing an empty index.
					 */
					await apiDeleteUserDraft(REMOTE_DRAFT_INDEX_SCOPE);
					return;
				}

				await apiUpsertUserDraft(REMOTE_DRAFT_INDEX_SCOPE, {
					text: JSON.stringify(indexMap)
				});
			} catch {
				// Draft index is non-critical; ignore failures.
			}
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
		const currentLoadVersion = ++loadVersionRef.current;
		setLoaded(false);
		setMessageRes(null);
		hasRemoteDraftRef.current = false;
		/*
		 * #976: the scope changed, so whatever is still buffered belongs to the
		 * previous conversation or thread. The unmount cleanup writes this ref
		 * under the *current* scope key, so carrying it over files text into a
		 * conversation nobody typed in. Loading a draft for the new scope sets
		 * it again below; finding none must leave it empty.
		 */
		latestMessageRef.current = '';
		if (!enabled || !canUseRemoteApi) {
			setLoaded(true);
			return () => {
				abortController?.abort();
			};
		}

		const loadDraft = async () => {
			for (const scopeKey of scopeKeysToTry) {
				try {
					const remoteDraft = await apiGetUserDraft(
						scopeKey,
						abortController.signal
					);
					if (
						currentLoadVersion === loadVersionRef.current &&
						remoteDraft?.text
					) {
						hasRemoteDraftRef.current = true;
						setMessageRes(remoteDraft);
						return;
					}
				} catch (e: any) {
					if (e?.message !== FETCH_ERRORS.EMPTY) {
						// Ignore and continue to next fallback scope key.
					}
				}
			}
			if (currentLoadVersion === loadVersionRef.current) {
				setLoaded(true);
			}
		};

		void loadDraft();

		return () => {
			abortController?.abort();
		};
	}, [enabled, canUseRemoteApi, scopeKeysToTry, setEditorWithDraftString]);

	// If everything is ready for decryption, decrypt the draft message
	useEffect(() => {
		if (!messageRes) {
			return;
		}
		const decryptLoadVersion = loadVersionRef.current;

		if (!messageRes.text) {
			if (decryptLoadVersion === loadVersionRef.current) {
				setLoaded(true);
			}
			return;
		}

		// Plain drafts must never wait for key readiness, otherwise the input can stay locked.
		if (!isE2eeEnabled || !encrypted) {
			if (decryptLoadVersion === loadVersionRef.current) {
				setEditorWithDraftString(messageRes.text);
				latestMessageRef.current = messageRes.text || '';
				setMessage(messageRes.text);
				setLoaded(true);
			}
			return;
		}

		if (!ready) {
			return;
		}

		decryptText(messageRes.text, keyID, key, encrypted, false, 'enc.')
			.catch(() => messageRes.text)
			.then((msg) => {
				if (decryptLoadVersion !== loadVersionRef.current) {
					return;
				}
				setEditorWithDraftString(msg);
				latestMessageRef.current = msg || '';
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
		setEditorWithDraftString
	]);

	const saveDraftMessage = useCallback(
		async (draftMessage) => {
			if (!enabled || !loaded) {
				return;
			}
			let message = draftMessage ?? '';
			// #976: the plaintext decides — an encrypted payload is opaque.
			const isEmptyDraft = !hasDraftContent(message);

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
				try {
					if (isEmptyDraft) {
						// #976: an emptied composer must delete the draft, not
						// store an empty one. Autosave also runs on unmount, so
						// upserting empty text turned every merely visited
						// conversation into a permanent drafts-badge entry that
						// no view could open.
						if (hasRemoteDraftRef.current) {
							hasRemoteDraftRef.current = false;
							await Promise.allSettled(
								scopeKeysToTry.map((scopeKey) =>
									apiDeleteUserDraft(scopeKey)
								)
							);
						}
					} else {
						hasRemoteDraftRef.current = true;
						await apiUpsertUserDraft(remoteScopeKey, {
							text: message,
							actionPath: options?.actionPath || null,
							title: options?.title || null,
							sourceSessionId:
								options?.sessionId ??
								activeSession?.item?.id ??
								null,
							roomRef:
								options?.roomRef ?? activeSession?.rid ?? null,
							threadRootId: options?.threadRootId || null
						});
					}
					await updateRemoteDraftIndex(draftMessage);
				} catch {
					// Draft autosave must never break chat input.
				}
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
			key,
			keyID,
			options?.actionPath,
			options?.roomRef,
			options?.sessionId,
			options?.threadRootId,
			options?.title,
			remoteScopeKey,
			scopeKeysToTry,
			updateRemoteDraftIndex
		]
	);

	const onChange = useCallback(
		(markdownMessage) => {
			if (!loaded) {
				return;
			}

			skipNextCleanupSaveRef.current = false;
			latestMessageRef.current = markdownMessage || '';
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

	const saveDraftMessageRef = useRef(saveDraftMessage);

	useEffect(() => {
		saveDraftMessageRef.current = saveDraftMessage;
	}, [saveDraftMessage]);

	const onLogout = useCallback(
		async (args) => {
			if (draftSaveTimeout.current) {
				clearTimeout(draftSaveTimeout.current);
				draftSaveTimeout.current = null;
			}
			if (skipNextCleanupSaveRef.current) {
				skipNextCleanupSaveRef.current = false;
				return args;
			}
			await saveDraftMessage(latestMessageRef.current);
			return args;
		},
		[saveDraftMessage]
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
			if (skipNextCleanupSaveRef.current) {
				skipNextCleanupSaveRef.current = false;
				return;
			}
			saveDraftMessageRef.current(latestMessageRef.current).then();
		};
	}, []);

	const clearDraftMessage = useCallback(async () => {
		if (draftSaveTimeout.current) {
			clearTimeout(draftSaveTimeout.current);
			draftSaveTimeout.current = null;
		}
		latestMessageRef.current = '';
		skipNextCleanupSaveRef.current = true;
		hasRemoteDraftRef.current = false;
		if (canUseRemoteApi) {
			await Promise.allSettled([
				...scopeKeysToTry.map((scopeKey) =>
					apiDeleteUserDraft(scopeKey)
				),
				updateRemoteDraftIndex('')
			]);
		}
		setMessage('');
	}, [canUseRemoteApi, scopeKeysToTry, updateRemoteDraftIndex]);

	return {
		onChange,
		loaded,
		clearDraftMessage
	};
};
