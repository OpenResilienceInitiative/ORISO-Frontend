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
	const clearVersionRef = useRef(0);
	const latestMessageRef = useRef<string>('');
	const skipNextCleanupSaveRef = useRef(false);
	/*
	 * Frank, 15.09.: the reader does not wait for the network. Between mount
	 * and the draft arriving — the fetch, and with E2EE the key on top, which
	 * can be minutes while the recovery key is still missing — they type. The
	 * arriving draft used to be written straight into the composer and their
	 * sentence was gone. Once they have written something, the stored draft
	 * has lost: it is older, and the autosave replaces it anyway.
	 */
	const typedBeforeLoadRef = useRef(false);
	/*
	 * Review (CodeRabbit): text typed before the draft arrived never reached
	 * `saveDraftMessage` — only the unmount cleanup would have saved it, and
	 * switching conversation first cleared the buffer. Flush it once loading
	 * finishes.
	 */
	const pendingPreLoadSaveRef = useRef(false);
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
		async (draftText?: string, scopeKey: string = remoteScopeKey) => {
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
				// #976: whether the index row exists at all. Without this an
				// untouched conversation would issue a DELETE on unmount for a
				// row that was never written.
				let hadIndexRow = false;
				try {
					const indexRes = await apiGetUserDraft(
						REMOTE_DRAFT_INDEX_SCOPE
					);
					if (indexRes?.text && typeof indexRes.text === 'string') {
						hadIndexRow = true;
						indexMap = JSON.parse(indexRes.text);
					}
				} catch (e: any) {
					if (e?.message !== FETCH_ERRORS.EMPTY) {
						indexMap = {};
					}
				}

				if (hasDraftContent(draftText)) {
					indexMap[scopeKey] = upsertPayload;
				} else {
					delete indexMap[scopeKey];
				}

				if (Object.keys(indexMap).length === 0) {
					/*
					 * #976: an empty map serialises to "{}", which is not blank,
					 * so the backend keeps the row forever - a contentless draft
					 * that no view can open and nothing can clear. Drop the row
					 * instead of storing an empty index - but only when there is
					 * a row to drop, so a merely visited conversation stays
					 * silent on the wire.
					 */
					if (hadIndexRow) {
						await apiDeleteUserDraft(REMOTE_DRAFT_INDEX_SCOPE);
					}
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

	type DraftPersistContext = {
		enabled: boolean;
		canUseRemoteApi: boolean;
		loaded: boolean;
		allowUnloaded: boolean;
		remoteScopeKey: string;
		scopeKeysToTry: string[];
		loadVersion: number;
		clearVersion: number;
		hasRemoteDraft: boolean;
		encrypted: boolean;
		isE2eeEnabled: boolean;
		key: CryptoKey | null | undefined;
		keyID: string | null | undefined;
		actionPath: string | null;
		title: string | null;
		sessionId: number | null;
		roomRef: string | null;
		threadRootId: string | null;
	};

	const persistDraftMessage = useCallback(
		async (draftMessage: string, ctx: DraftPersistContext) => {
			if (!ctx.enabled || !ctx.canUseRemoteApi) {
				return;
			}
			if (!ctx.loaded && !ctx.allowUnloaded) {
				return;
			}

			let message = draftMessage ?? '';
			const isEmptyDraft = !hasDraftContent(message);
			const capturedScope = ctx.remoteScopeKey;
			const capturedKeys = ctx.scopeKeysToTry;
			const capturedLoadVersion = ctx.loadVersion;
			const capturedClearVersion = ctx.clearVersion;
			const capturedHadRemote = ctx.hasRemoteDraft;

			if (ctx.isE2eeEnabled && ctx.encrypted && draftMessage) {
				try {
					message = await encryptText(
						draftMessage,
						ctx.keyID,
						ctx.key,
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

			/*
			 * Review (CodeRabbit): encryption can outlive a conversation
			 * switch. Write only to the captured scope, and only touch the
			 * shared hasRemoteDraftRef when this load is still current — a
			 * stale save must not mark the new conversation as having a
			 * draft (cleanup would then DELETE that scope's keys).
			 */
			const stillCurrent = capturedLoadVersion === loadVersionRef.current;
			/*
			 * Review (CodeRabbit): sending retires in-flight encrypts. A save
			 * that started before `clearDraftMessage` must not upsert the
			 * sent text back as a draft — that is independent of load
			 * version, which `allowUnloaded` still needs for pre-load leave.
			 */
			if (capturedClearVersion !== clearVersionRef.current) {
				return;
			}

			try {
				if (isEmptyDraft) {
					if (!capturedHadRemote) {
						return;
					}
					if (stillCurrent) {
						hasRemoteDraftRef.current = false;
					}
					await Promise.allSettled(
						capturedKeys.map((scopeKey) =>
							apiDeleteUserDraft(scopeKey)
						)
					);
				} else {
					if (stillCurrent) {
						hasRemoteDraftRef.current = true;
					}
					await apiUpsertUserDraft(capturedScope, {
						text: message,
						actionPath: ctx.actionPath,
						title: ctx.title,
						sourceSessionId: ctx.sessionId,
						roomRef: ctx.roomRef,
						threadRootId: ctx.threadRootId
					});
				}
				await updateRemoteDraftIndex(draftMessage, capturedScope);
			} catch {
				// Draft autosave must never break chat input.
			}
		},
		[updateRemoteDraftIndex]
	);

	const persistDraftMessageRef = useRef(persistDraftMessage);
	persistDraftMessageRef.current = persistDraftMessage;

	const persistContextRef = useRef<DraftPersistContext>({
		enabled,
		canUseRemoteApi,
		loaded,
		allowUnloaded: false,
		remoteScopeKey,
		scopeKeysToTry,
		loadVersion: loadVersionRef.current,
		clearVersion: clearVersionRef.current,
		hasRemoteDraft: false,
		encrypted,
		isE2eeEnabled,
		key,
		keyID,
		actionPath: options?.actionPath || null,
		title: options?.title || null,
		sessionId: options?.sessionId ?? activeSession?.item?.id ?? null,
		roomRef: options?.roomRef ?? activeSession?.rid ?? null,
		threadRootId: options?.threadRootId || null
	});

	useEffect(() => {
		persistContextRef.current = {
			enabled,
			canUseRemoteApi,
			loaded,
			allowUnloaded: false,
			remoteScopeKey,
			scopeKeysToTry,
			loadVersion: loadVersionRef.current,
			clearVersion: clearVersionRef.current,
			hasRemoteDraft: hasRemoteDraftRef.current,
			encrypted,
			isE2eeEnabled,
			key,
			keyID,
			actionPath: options?.actionPath || null,
			title: options?.title || null,
			sessionId: options?.sessionId ?? activeSession?.item?.id ?? null,
			roomRef: options?.roomRef ?? activeSession?.rid ?? null,
			threadRootId: options?.threadRootId || null
		};
	});

	const persistOutgoingDraftOnLeave = useCallback(() => {
		if (skipNextCleanupSaveRef.current) {
			skipNextCleanupSaveRef.current = false;
			return;
		}
		const text = latestMessageRef.current;
		const pending = pendingPreLoadSaveRef.current;
		if (!pending && !hasDraftContent(text) && !hasRemoteDraftRef.current) {
			return;
		}
		void persistDraftMessageRef.current(text, {
			...persistContextRef.current,
			hasRemoteDraft: hasRemoteDraftRef.current,
			clearVersion: clearVersionRef.current,
			allowUnloaded: pending
		});
	}, []);

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
		 *
		 * Review (shazia-k): persist the outgoing buffer first — typing while
		 * the previous draft was still loading used to die here, because
		 * saveDraftMessage refused to run until `loaded` and this reset ran
		 * before the unmount cleanup could see the text.
		 */
		latestMessageRef.current = '';
		typedBeforeLoadRef.current = false;
		pendingPreLoadSaveRef.current = false;
		if (!enabled || !canUseRemoteApi) {
			setLoaded(true);
			return () => {
				abortController?.abort();
				persistOutgoingDraftOnLeave();
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
			persistOutgoingDraftOnLeave();
		};
	}, [
		enabled,
		canUseRemoteApi,
		scopeKeysToTry,
		setEditorWithDraftString,
		persistOutgoingDraftOnLeave
	]);

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
				if (!typedBeforeLoadRef.current) {
					setEditorWithDraftString(messageRes.text);
					latestMessageRef.current = messageRes.text || '';
					setMessage(messageRes.text);
				}
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
				if (!typedBeforeLoadRef.current) {
					setEditorWithDraftString(msg);
					latestMessageRef.current = msg || '';
					setMessage(msg);
				}
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
			await persistDraftMessage(draftMessage ?? '', {
				...persistContextRef.current,
				enabled,
				canUseRemoteApi,
				loaded,
				allowUnloaded: false,
				remoteScopeKey,
				scopeKeysToTry,
				loadVersion: loadVersionRef.current,
				clearVersion: clearVersionRef.current,
				hasRemoteDraft: hasRemoteDraftRef.current,
				encrypted,
				isE2eeEnabled,
				key,
				keyID,
				actionPath: options?.actionPath || null,
				title: options?.title || null,
				sessionId:
					options?.sessionId ?? activeSession?.item?.id ?? null,
				roomRef: options?.roomRef ?? activeSession?.rid ?? null,
				threadRootId: options?.threadRootId || null
			});
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
			persistDraftMessage,
			remoteScopeKey,
			scopeKeysToTry
		]
	);

	const onChange = useCallback(
		(markdownMessage) => {
			if (!loaded) {
				// Ahead of the network: keep the text so the autosave has
				// something to save, and mark the composer as the reader's,
				// so an arriving draft cannot take it back. Review
				// (CodeRabbit): buffer EVERY pre-load value — keeping only
				// non-empty ones meant "type, then delete it all" saved the
				// deleted text again. Ownership is what `hasDraftContent`
				// decides; the buffer just follows the composer.
				latestMessageRef.current = markdownMessage || '';
				if (hasDraftContent(markdownMessage)) {
					typedBeforeLoadRef.current = true;
					pendingPreLoadSaveRef.current = true;
				}
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

	// Review (CodeRabbit): whatever was typed while the draft was still on
	// its way is saved as soon as saving is possible, so leaving for another
	// conversation does not drop it.
	useEffect(() => {
		if (!loaded || !pendingPreLoadSaveRef.current) {
			return;
		}
		pendingPreLoadSaveRef.current = false;
		void saveDraftMessage(latestMessageRef.current);
	}, [loaded, saveDraftMessage]);

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
		};
	}, []);

	const clearDraftMessage = useCallback(async () => {
		if (draftSaveTimeout.current) {
			clearTimeout(draftSaveTimeout.current);
			draftSaveTimeout.current = null;
		}
		latestMessageRef.current = '';
		typedBeforeLoadRef.current = false;
		pendingPreLoadSaveRef.current = false;
		skipNextCleanupSaveRef.current = true;
		hasRemoteDraftRef.current = false;
		/*
		 * Review (CodeRabbit): sending does not wait for the draft to load.
		 * A fetch or decryption still in flight would pass its version check
		 * afterwards and refill the composer the reader just emptied — retire
		 * that load and treat the scope as settled. A persist that is already
		 * inside encryptText keeps its captured load version; retire those
		 * writes with a separate clear generation.
		 */
		loadVersionRef.current += 1;
		clearVersionRef.current += 1;
		setMessageRes(null);
		setLoaded(true);
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
