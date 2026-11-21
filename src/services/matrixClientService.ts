import { clearSecretStorageKeys } from './matrixKeyBackupService';
import {
	bindDraftCryptographyClient,
	handleDraftRecoveryAccountData,
	unbindDraftCryptographyClient
} from './draftCryptography';
import { ClientEvent, MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk';
import {
	MatrixLoginData,
	clearPersistedMatrixDeviceId,
	createMatrixClient,
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../components/sessionCookie/getMatrixAccessToken';
import { matrixCallService } from './matrixCallService';
import { buildMatrixCryptoStorePrefix } from './matrixCrypto';
import {
	canSubmitRustKeysQuery,
	submitRustKeysQuery
} from './matrixRustKeysQuery';
import { applyDeviceIsolationMode } from './matrixDeviceIsolation';
import { matrixDecryptionRetry } from './matrixDecryptionRetry';
import { appConfig } from '../utils/appConfig';
import { matrixLiveEventBridge } from './matrixLiveEventBridge';
import { startDeviceDehydration } from './matrixDeviceDehydration';
import { matrixRoomHistoryKeyTransfer } from './matrixRoomHistoryKeyTransfer';
import { encryptMatrixAttachment } from '../utils/matrixEncryptedAttachment';
import { buildMatrixRoomEncryptionInitialState } from '../utils/matrixRoomEncryption';
import {
	TextMessageContentOptions,
	type MessageRelationOptions,
	buildMessageRelationContent,
	buildTextMessageContent,
	buildEditContent,
	buildReactionContent
} from '../utils/messageRelations';

import { getImageDimensions } from '../utils/imageDimensions';
import { buildMentionsContent } from '../utils/messageMentions';
import {
	buildPassageBlurContent,
	PASSAGE_BLUR_EVENT_TYPE
} from '../components/selectionReply/passageBlurEvents';
import {
	buildPassageRepliesContent,
	type PassageRepliesFallbackLabels,
	type PassageReplyContentItem
} from '../components/selectionReply/passageReplyContent';

const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;
const isPreparedSyncState = (state: string | null): boolean =>
	state === 'PREPARED' || state === 'SYNCING';

type RustTrackedUser = {
	clone: () => unknown;
	toString: () => string;
};

type RefreshableRustCrypto = {
	olmMachine?: {
		queryKeysForUsers?: (users: unknown[]) => unknown;
		trackedUsers?: () => Promise<Set<RustTrackedUser>>;
	};
	outgoingRequestProcessor?: {
		makeOutgoingRequest?: (request: unknown) => Promise<unknown>;
	};
};

export interface MatrixFileContentOptions extends MessageRelationOptions {
	/**
	 * The text that goes with the file (MSC2530): `body` carries it and
	 * `filename` keeps the name. Clients without caption support show the
	 * text as the file's name, nothing is lost.
	 */
	caption?: string;
	/** Intentional mentions in the caption (m.mentions). */
	mentionedUserIds?: string[];
}

/**
 * One answered passage on its way out (ADR-022). A voice answer is the
 * recorded file; it is encrypted and uploaded before the message is sent.
 */
export type OutgoingPassageReply = Omit<PassageReplyContentItem, 'audio'> & {
	voice?: { file: File; durationMs: number } | null;
};

export interface MatrixFileMessageOptions extends MatrixFileContentOptions {
	abortController?: AbortController;
	uploadProgress?: (percentUpload: number) => void;
}

/**
 * The Matrix token could not be fetched or refreshed, so the upload never
 * started. `fetchData` hands over a bare "CATCH_ALL" for any status, so without
 * this name a token 503 reads like any other unexplained failure.
 */
export class MatrixTokenUnavailableError extends Error {
	public readonly cause: unknown;

	constructor(cause: unknown) {
		super('Matrix token unavailable');
		this.name = 'MatrixTokenUnavailableError';
		this.cause = cause;
	}
}

const getMatrixFileMessageType = (file: File): string => {
	const mimeType = file.type || '';
	if (mimeType.startsWith('image/')) {
		return 'm.image';
	}
	if (mimeType.startsWith('audio/')) {
		return 'm.audio';
	}
	if (mimeType.startsWith('video/')) {
		return 'm.video';
	}
	return 'm.file';
};

export const buildMatrixFileMessageContent = (
	file: File,
	encryptedFile: Awaited<ReturnType<typeof encryptMatrixAttachment>>['file'],
	dimensions?: { w: number; h: number } | null,
	options?: MatrixFileContentOptions
): Record<string, unknown> => ({
	...buildMessageRelationContent(options),
	...(options?.caption ? buildMentionsContent(options.mentionedUserIds) : {}),
	body: options?.caption || file.name,
	filename: file.name,
	msgtype: getMatrixFileMessageType(file),
	file: encryptedFile,
	info: {
		mimetype: file.type || 'application/octet-stream',
		size: file.size,
		// m.image only: intrinsic pixel size so receivers can reserve a
		// correctly-scaled thumbnail box before decrypting (WP-4).
		...(dimensions ? { w: dimensions.w, h: dimensions.h } : {})
	}
});

export const isMatrixForbiddenError = (error: unknown): boolean => {
	const matrixError = error as { errcode?: string; httpStatus?: number };
	return (
		matrixError?.errcode === 'M_FORBIDDEN' ||
		matrixError?.httpStatus === 403
	);
};

export const isMatrixExpiredTokenError = (error: unknown): boolean => {
	const syncError = error as { error?: unknown };
	const candidate =
		syncError?.error && typeof syncError.error === 'object'
			? syncError.error
			: error;
	const matrixError = candidate as {
		data?: { errcode?: string; error?: string };
		errcode?: string;
		error?: unknown;
		httpStatus?: number;
		message?: string;
		statusCode?: number;
	};
	const rawMessage =
		matrixError?.data?.error ||
		matrixError?.error ||
		matrixError?.message ||
		'';
	const message = typeof rawMessage === 'string' ? rawMessage : '';
	const httpStatus = matrixError?.httpStatus || matrixError?.statusCode;

	// Synapse rejects an invalidated token (hard TTL hit, or a newer login
	// re-used the same device_id) with M_UNKNOWN_TOKEN and "Invalid access
	// token passed." — recoverable by re-fetching a token from the backend.
	return (
		message.includes('Access token has expired') ||
		matrixError?.errcode === 'M_UNKNOWN_TOKEN' ||
		matrixError?.data?.errcode === 'M_UNKNOWN_TOKEN' ||
		(httpStatus === 401 &&
			(message.toLowerCase().includes('expired') ||
				matrixError?.errcode === 'M_UNKNOWN' ||
				matrixError?.data?.errcode === 'M_UNKNOWN'))
	);
};

export const isMatrixOneTimeKeyConflictLog = (messages: unknown[]): boolean => {
	const message = messages.map(String).join(' ').toLowerCase();
	return (
		message.includes('failed to process outgoing request') &&
		message.includes('m_unknown') &&
		message.includes('one time key') &&
		message.includes('already exists')
	);
};

export class MatrixClientService {
	private static runtimeOwner: MatrixClientService | null = null;
	private client: MatrixClient | null = null;
	private loginData: MatrixLoginData | null = null;
	private sessionLifetime = new AbortController();
	private runtimeAttached = false;
	private refreshTimer: number | null = null;
	private refreshingToken: Promise<void> | null = null;
	private staleDeviceRecovery: Promise<void> | null = null;
	private staleDeviceRecoveryVersion = 0;
	private syncState: string | null = null;
	private initializedServicesClient: MatrixClient | null = null;
	private readonly deviceListRefreshes = new WeakMap<
		MatrixClient,
		Map<string, Promise<boolean>>
	>();
	private syncStateListeners = new Set<(state: string | null) => void>();
	private clientChangeListeners = new Set<
		(client: MatrixClient | null) => void
	>();

	public async initializeClient(
		loginData: MatrixLoginData,
		isStartupActive?: () => boolean
	): Promise<void> {
		if (isStartupActive && !isStartupActive()) return;
		this.cancelSessionWork();
		this.sessionLifetime = new AbortController();
		await this.initializeSessionClient(loginData, isStartupActive);
	}

	private async initializeSessionClient(
		loginData: MatrixLoginData,
		isStartupActive?: () => boolean
	): Promise<void> {
		const lifetime = this.sessionLifetime.signal;
		const expiresAt = loginData.expiresInMs
			? Date.now() + loginData.expiresInMs
			: this.getStoredTokenExpiresAt();
		this.teardownClient();
		this.loginData = loginData;
		let client: MatrixClient;
		try {
			client = createMatrixClient(
				loginData,
				(...messages) => {
					if (!lifetime.aborted && this.loginData === loginData) {
						this.handleMatrixSdkError(loginData.deviceId, messages);
					}
				},
				isStartupActive
			);
		} catch (error) {
			unbindDraftCryptographyClient(this);
			throw error;
		}
		this.client = client;
		bindDraftCryptographyClient(this, client, loginData.userId);
		// Announce the replacement client before sync starts so consumers
		// (e.g. SessionStream room listeners) re-attach without missing events.
		this.notifyClientChangeListeners();

		const isCurrent = () => this.client === client && !lifetime.aborted;
		const discardCancelledStartup = (): boolean => {
			if (!isCurrent()) {
				// Rust crypto can finish attaching after the earlier stop.
				this.stopSdkClient(client);
				return true;
			}
			if (isStartupActive && !isStartupActive()) {
				this.stopAndCleanup();
				return true;
			}
			return false;
		};

		if (discardCancelledStartup()) return;
		try {
			await client.initRustCrypto({
				useIndexedDB: true,
				cryptoDatabasePrefix: buildMatrixCryptoStorePrefix(
					loginData.userId,
					loginData.deviceId
				)
			});
		} catch (error) {
			if (discardCancelledStartup()) return;
			// The failed client was already announced above, so tear down via
			// the notifying path to hand subscribers the resulting null.
			this.stopClientAndNotify();
			throw error;
		}
		if (discardCancelledStartup()) return;

		// #438 MSC4153 invisible crypto: once the rust crypto stack is up, share
		// Megolm keys only with cross-signed devices when the toggle is on.
		// Anonymous live-chat users are exempt: they can never cross-sign the
		// consultant's device, so verified-only isolation would leave the
		// consultant seeing only undecryptable noise. They always share to all
		// devices so the accepted consultant can read the conversation (#774).
		// Best-effort — never breaks client startup.
		applyDeviceIsolationMode(
			client,
			appConfig?.releaseToggles?.enableInvisibleCrypto === true &&
				loginData.isAnonymous !== true
		);
		// Before startClient: the first device-list query of the initial sync
		// must already re-decrypt what the SDK refused for an unknown sender.
		MatrixClientService.runtimeOwner = this;
		this.runtimeAttached = true;
		matrixDecryptionRetry.initialize(client);
		client.on(ClientEvent.AccountData, (event) =>
			handleDraftRecoveryAccountData(client, event)
		);

		(client as any).on(
			'sync',
			(state: string, _prevState: string | null, syncError?: unknown) => {
				if (!isCurrent()) return;
				this.syncState = state;
				this.notifySyncStateListeners();
				if (!isCurrent()) return;

				if (state === 'PREPARED') {
					// console.log('✅ Matrix client SYNCED and READY for real-time events!');
					this.initializeDependentServices(client);
				}

				if (state === 'ERROR' && isMatrixExpiredTokenError(syncError)) {
					this.refreshMatrixTokenSafely();
				}
			}
		);

		this.scheduleTokenRefresh(expiresAt, isCurrent);
		try {
			await client.startClient({
				initialSyncLimit: 20, // Load last 20 messages per room initially
				pollTimeout: 30000, // 30-second long-polling timeout
				lazyLoadMembers: true // Don't load all room members immediately
			});
		} catch (error) {
			if (discardCancelledStartup()) return;
			this.stopClientAndNotify();
			throw error;
		}
		discardCancelledStartup();
	}

	/** Authentication subject that established this exact Matrix client. */
	public getAuthenticatedSubject(): string | null {
		return this.loginData?.authenticatedSubject ?? null;
	}

	// Get current client
	public getClient(): MatrixClient | null {
		return this.client;
	}

	public isReady(): boolean {
		return isPreparedSyncState(this.syncState);
	}

	/** Monotonic signal incremented only after stale-device recovery completes. */
	public getStaleDeviceRecoveryVersion(): number {
		return this.staleDeviceRecoveryVersion;
	}

	/**
	 * Return the current Matrix client only after token/device recovery and the
	 * replacement sync are complete. Crypto settings must use this boundary:
	 * retaining the stale client while #551 rotates its device makes
	 * cross-signing/key-backup setup fail on the old outgoing-request queue.
	 */
	public async getReadyClient(): Promise<MatrixClient> {
		for (let attempt = 0; attempt < 2; attempt += 1) {
			await this.ensureFreshToken();
			const client = this.client;
			if (!client) {
				throw new Error('Matrix client not initialized');
			}

			try {
				await this.waitForClientPrepared(client);
				return client;
			} catch (error) {
				const recovery = this.staleDeviceRecovery;
				if (attempt === 0 && (recovery || this.client !== client)) {
					if (recovery) {
						await recovery;
					}
					continue;
				}
				throw error;
			}
		}

		throw new Error('Recovered Matrix client did not become ready');
	}

	public onSyncStateChange(
		callback: (state: string | null) => void
	): () => void {
		this.syncStateListeners.add(callback);
		callback(this.syncState);

		return () => {
			this.syncStateListeners.delete(callback);
		};
	}

	/**
	 * Subscribe to client instance swaps. A token refresh replaces the
	 * matrix-js-sdk client (the old one gets removeAllListeners()), so
	 * consumers holding room listeners must re-attach on every change.
	 */
	public onClientChange(
		listener: (client: MatrixClient | null) => void
	): () => void {
		this.clientChangeListeners.add(listener);

		return () => {
			this.clientChangeListeners.delete(listener);
		};
	}

	private readonly heldCryptoOperations = new Set<Promise<void>>();

	/**
	 * Runs a crypto operation that must finish on the client it started on (reset, setup,
	 * recovery). A token refresh replaces the client and rotates the Matrix password, so it waits.
	 * Stale-device recovery is not held: callers retry on the client it produces.
	 */
	public async holdTokenRefreshDuring<T>(
		operation: () => Promise<T>
	): Promise<T> {
		const lifetime = this.sessionLifetime.signal;
		// First let a due or in-flight refresh finish, so the operation starts on the current client.
		await this.ensureFreshToken().catch(() => undefined);
		while (!lifetime.aborted && this.refreshingToken) {
			await this.refreshingToken.catch(() => undefined);
		}
		if (lifetime.aborted) throw new Error('Matrix session ended');
		// Registered before the operation starts, with no await since the check above: its own first
		// token check already sees the hold, and no refresh can slip in.
		let release: () => void = () => undefined;
		const settled = new Promise<void>((resolve) => (release = resolve));
		this.heldCryptoOperations.add(settled);
		try {
			return await operation();
		} finally {
			this.heldCryptoOperations.delete(settled);
			release();
		}
	}

	/** The active session waits as long as a reset needs. Logout releases that wait. */
	private async heldCryptoOperationsSettled(
		lifetime: AbortSignal
	): Promise<void> {
		while (!lifetime.aborted && this.heldCryptoOperations.size > 0) {
			await new Promise<void>((resolve) => {
				const settle = () => {
					lifetime.removeEventListener('abort', settle);
					resolve();
				};
				lifetime.addEventListener('abort', settle, { once: true });
				void Promise.all([...this.heldCryptoOperations]).then(settle);
			});
		}
	}

	public async refreshMatrixToken(): Promise<void> {
		const lifetime = this.sessionLifetime.signal;
		if (lifetime.aborted) return;
		if (this.refreshingToken) {
			return this.refreshingToken;
		}

		const startingClient = this.client;
		const isCurrent = () =>
			!lifetime.aborted && this.client === startingClient;
		const refresh = this.heldCryptoOperationsSettled(lifetime)
			.then(() => {
				if (isCurrent())
					return getMatrixAccessToken({ forceRefresh: true });
			})
			.then(async (loginData) => {
				if (!loginData || !isCurrent()) return;
				// getMatrixAccessToken only returns transport fields. A session's
				// anonymity is stable across refreshes, so carry the existing flag
				// forward — otherwise invisible crypto would re-apply verified-only
				// isolation on the refreshed client and make an anonymous asker's
				// messages undecryptable for the consultant again (#774).
				const refreshedLoginData: MatrixLoginData = {
					...loginData,
					isAnonymous:
						loginData.isAnonymous ?? this.loginData?.isAnonymous
				};
				persistMatrixLoginData(refreshedLoginData);
				await this.initializeSessionClient(refreshedLoginData);
			})
			.finally(() => {
				if (this.refreshingToken === refresh)
					this.refreshingToken = null;
			});

		this.refreshingToken = refresh;
		return refresh;
	}

	private refreshMatrixTokenSafely(): void {
		void this.refreshMatrixToken().catch(() => undefined);
	}

	private handleMatrixSdkError(deviceId: string, messages: unknown[]): void {
		if (
			this.loginData?.deviceId !== deviceId ||
			!isMatrixOneTimeKeyConflictLog(messages)
		) {
			return;
		}

		void this.recoverFromStaleMatrixDevice().catch(() => undefined);
	}

	private recoverFromStaleMatrixDevice(): Promise<void> {
		if (this.staleDeviceRecovery) {
			return this.staleDeviceRecovery;
		}

		const staleLoginData = this.loginData;
		const lifetime = this.sessionLifetime.signal;
		if (!staleLoginData || lifetime.aborted) {
			return Promise.resolve();
		}

		clearPersistedMatrixDeviceId(staleLoginData.userId);
		const recovery = getMatrixAccessToken()
			.then(async (loginData) => {
				if (lifetime.aborted || this.loginData !== staleLoginData)
					return;
				const recoveredLoginData: MatrixLoginData = {
					...loginData,
					isAnonymous:
						loginData.isAnonymous ?? staleLoginData.isAnonymous
				};
				persistMatrixLoginData(recoveredLoginData);
				await this.initializeSessionClient(recoveredLoginData);
				if (lifetime.aborted) return;
				const recoveredClient = this.client;
				if (!recoveredClient) {
					throw new Error(
						'Recovered Matrix client was not initialized'
					);
				}
				await this.waitForClientPrepared(recoveredClient);
				if (!lifetime.aborted) this.staleDeviceRecoveryVersion += 1;
			})
			.finally(() => {
				if (this.staleDeviceRecovery === recovery) {
					this.staleDeviceRecovery = null;
				}
			});

		this.staleDeviceRecovery = recovery;
		return recovery;
	}

	/** Await initial sync without confusing a not-yet-hydrated room with exhaustion. */
	public waitUntilReady(): Promise<void> {
		if (!this.client)
			return Promise.reject(new Error('Matrix client is unavailable'));
		return this.waitForClientPrepared(this.client);
	}

	private waitForClientPrepared(
		expectedClient: MatrixClient,
		timeoutMs: number = 30_000
	): Promise<void> {
		if (
			this.client === expectedClient &&
			isPreparedSyncState(this.syncState)
		) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const listener = (state: string | null) => {
				if (this.client !== expectedClient) {
					window.clearTimeout(timeout);
					this.syncStateListeners.delete(listener);
					reject(
						new Error(
							'Recovered Matrix client was replaced before reaching PREPARED'
						)
					);
					return;
				}

				if (!isPreparedSyncState(state)) {
					return;
				}

				window.clearTimeout(timeout);
				this.syncStateListeners.delete(listener);
				resolve();
			};
			const timeout = window.setTimeout(() => {
				this.syncStateListeners.delete(listener);
				reject(
					new Error('Recovered Matrix client did not reach PREPARED')
				);
			}, timeoutMs);
			this.syncStateListeners.add(listener);
			listener(this.syncState);
		});
	}

	public async ensureFreshToken(): Promise<void> {
		if (this.staleDeviceRecovery) {
			await this.staleDeviceRecovery;
		}
		// A held crypto operation keeps its token: a refresh now would wait for that very operation.
		if (this.heldCryptoOperations.size > 0) {
			return;
		}

		const expiresAt = this.getStoredTokenExpiresAt();
		if (!expiresAt || Date.now() + TOKEN_REFRESH_BUFFER_MS < expiresAt) {
			return;
		}

		await this.refreshMatrixToken();
	}

	/**
	 * Refresh already-tracked room members before the first send in a client
	 * generation. A full sync does not replay historical device-list changes,
	 * so a room created before the recipient recovered/cross-signed a device can
	 * otherwise keep an indefinitely stale cache and omit that device from
	 * Megolm key sharing (#551).
	 *
	 * matrix-js-sdk exposes forced downloads only for untracked users. The Rust
	 * backend already owns the supported query and response processing path, but
	 * currently narrows it out of CryptoApi. Runtime guards make this best-effort
	 * and upgrade-safe; a missing internal never blocks normal SDK encryption.
	 */
	private async refreshTrackedRoomMemberDevices(
		client: MatrixClient,
		roomId: string
	): Promise<boolean> {
		let roomRefreshes = this.deviceListRefreshes.get(client);
		if (!roomRefreshes) {
			roomRefreshes = new Map<string, Promise<boolean>>();
			this.deviceListRefreshes.set(client, roomRefreshes);
		}

		const existing = roomRefreshes.get(roomId);
		if (existing) {
			return existing;
		}

		const refresh = (async () => {
			const room = client.getRoom(roomId);
			const crypto = client.getCrypto?.() as
				| RefreshableRustCrypto
				| undefined;
			const olmMachine = crypto?.olmMachine;
			if (
				!room ||
				typeof room.getEncryptionTargetMembers !== 'function' ||
				typeof olmMachine?.trackedUsers !== 'function' ||
				!canSubmitRustKeysQuery(crypto)
			) {
				return false;
			}

			const ownUserId = client.getUserId?.();
			const members = await room.getEncryptionTargetMembers();
			const targetUserIds = new Set(
				members
					.map((member) => member.userId)
					.filter((userId) => userId && userId !== ownUserId)
			);
			if (targetUserIds.size === 0) {
				return true;
			}

			const trackedUsers = await olmMachine.trackedUsers();
			const queryUsers = Array.from(trackedUsers)
				.filter((user) => targetUserIds.has(user.toString()))
				.map((user) => user.clone());
			if (queryUsers.length === 0) {
				return false;
			}

			return submitRustKeysQuery(crypto, queryUsers);
		})();

		roomRefreshes.set(roomId, refresh);
		try {
			const refreshed = await refresh;
			if (!refreshed) {
				roomRefreshes.delete(roomId);
			}
			return refreshed;
		} catch {
			roomRefreshes.delete(roomId);
			return false;
		}
	}

	// Send message to a room
	public async sendMessage(
		roomId: string,
		message: string,
		options?: TextMessageContentOptions,
		transactionId?: string
	): Promise<any> {
		await this.ensureFreshToken();

		// Relations foundation (#435): a reply/thread is the spec relation on the
		// content (m.relates_to / m.in_reply_to / m.thread), built by the pure helper.
		const content = buildTextMessageContent(message, options) as any;
		const sendToRoom = async () => {
			const client = this.client;
			if (!client) {
				throw new Error('Matrix client not initialized');
			}
			if (!client.getRoom(roomId)) {
				await client.joinRoom(roomId);
			}
			await this.refreshTrackedRoomMemberDevices(client, roomId);
			// Every real matrix-js-sdk client provides makeTxnId(). The guard also
			// keeps deliberately minimal test doubles and adapters compatible.
			const txnId = transactionId || client.makeTxnId?.();
			try {
				return await (txnId
					? client.sendMessage(roomId, content, txnId)
					: client.sendMessage(roomId, content));
			} catch (error) {
				this.dropFailedLocalEcho(client, roomId, txnId, error);
				throw error;
			}
		};

		try {
			return await sendToRoom();
		} catch (error) {
			if (!isMatrixExpiredTokenError(error)) {
				throw error;
			}

			await this.refreshMatrixToken();
			return sendToRoom();
		}
	}

	// Edit a previously sent message (m.replace)
	public async editMessage(
		roomId: string,
		targetEventId: string,
		message: string
	): Promise<any> {
		await this.ensureFreshToken();

		if (!this.client) {
			throw new Error('Matrix client not initialized');
		}

		const content = buildEditContent(message, targetEventId) as any;

		try {
			return await this.client.sendMessage(roomId, content);
		} catch (error) {
			if (!isMatrixExpiredTokenError(error)) {
				throw error;
			}

			await this.refreshMatrixToken();
			if (!this.client) {
				throw new Error('Matrix client not initialized');
			}

			return this.client.sendMessage(roomId, content);
		}
	}

	// React to a message (m.annotation)
	public async sendReaction(
		roomId: string,
		targetEventId: string,
		key: string
	): Promise<any> {
		await this.ensureFreshToken();

		if (!this.client) {
			throw new Error('Matrix client not initialized');
		}

		const content = buildReactionContent(targetEventId, key) as any;

		try {
			return await this.client.sendEvent(
				roomId,
				'm.reaction' as any,
				content
			);
		} catch (error) {
			if (!isMatrixExpiredTokenError(error)) {
				throw error;
			}

			await this.refreshMatrixToken();
			if (!this.client) {
				throw new Error('Matrix client not initialized');
			}

			return this.client.sendEvent(roomId, 'm.reaction' as any, content);
		}
	}

	/**
	 * Blur a passage of a message (#2229): a room event that points at the
	 * message and holds only the position. Lifting the blur redacts it.
	 */
	public async sendPassageBlur(
		roomId: string,
		targetEventId: string,
		blur: { start: number; length: number }
	): Promise<any> {
		await this.ensureFreshToken();

		const content = buildPassageBlurContent(targetEventId, blur) as any;
		const send = () => {
			if (!this.client) {
				throw new Error('Matrix client not initialized');
			}
			return this.client.sendEvent(
				roomId,
				PASSAGE_BLUR_EVENT_TYPE as any,
				content
			);
		};

		try {
			return await send();
		} catch (error) {
			if (!isMatrixExpiredTokenError(error)) {
				throw error;
			}

			await this.refreshMatrixToken();
			return send();
		}
	}

	// Redact an event (reactions un-react, and message delete #827)
	public async redactEvent(roomId: string, eventId: string): Promise<any> {
		await this.ensureFreshToken();

		if (!this.client) {
			throw new Error('Matrix client not initialized');
		}

		return this.client.redactEvent(roomId, eventId);
	}

	public async sendFileMessage(
		roomId: string,
		file: File,
		options: MatrixFileMessageOptions = {}
	): Promise<any> {
		const withTokenFailureNamed = (refresh: Promise<void>) =>
			refresh.catch((error: unknown) => {
				throw new MatrixTokenUnavailableError(error);
			});
		// A cancel has to stop the send at every step that is still ours: once
		// the event is on its way it cannot be taken back.
		const stopIfCancelled = () =>
			options.abortController?.signal.throwIfAborted();

		await withTokenFailureNamed(this.ensureFreshToken());
		stopIfCancelled();

		// Token or stale-device recovery can replace this.client between awaits.
		// Each attempt pins one client so the device-key refresh, the upload and
		// the send never span two client generations.
		const sendWithCurrentClient = async () => {
			const client = this.client;
			if (!client) {
				throw new Error('Matrix client not initialized');
			}
			await this.refreshTrackedRoomMemberDevices(client, roomId);
			const content = await this.uploadFileMessageContent(
				client,
				file,
				options
			);
			stopIfCancelled();
			// Every real matrix-js-sdk client provides makeTxnId(). The guard
			// keeps minimal test doubles compatible.
			const txnId = client.makeTxnId?.();
			try {
				return await (txnId
					? client.sendMessage(roomId, content as any, txnId)
					: client.sendMessage(roomId, content as any));
			} catch (error) {
				// Same as text: the composer offers the retry, so the SDK's
				// NOT_SENT echo would show a second copy after it succeeds.
				this.dropFailedLocalEcho(client, roomId, txnId, error);
				throw error;
			}
		};

		try {
			return await sendWithCurrentClient();
		} catch (error) {
			if (!isMatrixExpiredTokenError(error)) {
				throw error;
			}

			await withTokenFailureNamed(this.refreshMatrixToken());
			stopIfCancelled();
			return sendWithCurrentClient();
		}
	}

	/**
	 * Several answered passages as ONE message (ADR-022). Every clip is
	 * encrypted and uploaded first; a failed upload sends nothing, so the
	 * caller can keep the collection and offer the send again.
	 */
	public async sendPassageReplies(
		roomId: string,
		replies: OutgoingPassageReply[],
		typedText: string,
		labels: PassageRepliesFallbackLabels
	): Promise<any> {
		await this.ensureFreshToken();

		const sendWithCurrentClient = async () => {
			const client = this.client;
			if (!client) {
				throw new Error('Matrix client not initialized');
			}
			if (!client.getRoom(roomId)) {
				await client.joinRoom(roomId);
			}
			await this.refreshTrackedRoomMemberDevices(client, roomId);
			const items: PassageReplyContentItem[] = [];
			for (const { voice, ...reply } of replies) {
				if (!voice) {
					items.push(reply);
					continue;
				}
				const encryptedAttachment = await encryptMatrixAttachment(
					voice.file
				);
				const upload = await client.uploadContent(
					encryptedAttachment.encryptedBlob,
					{ includeFilename: false, type: 'application/octet-stream' }
				);
				items.push({
					...reply,
					audio: {
						file: {
							...encryptedAttachment.file,
							url: upload.content_uri
						},
						mimetype: voice.file.type || 'audio/webm',
						durationMs: voice.durationMs,
						size: voice.file.size
					}
				});
			}
			const content = buildPassageRepliesContent(
				items,
				typedText,
				labels
			);
			const txnId = client.makeTxnId?.();
			try {
				return await (txnId
					? client.sendMessage(roomId, content as any, txnId)
					: client.sendMessage(roomId, content as any));
			} catch (error) {
				this.dropFailedLocalEcho(client, roomId, txnId, error);
				throw error;
			}
		};

		try {
			return await sendWithCurrentClient();
		} catch (error) {
			if (!isMatrixExpiredTokenError(error)) {
				throw error;
			}

			await this.refreshMatrixToken();
			return sendWithCurrentClient();
		}
	}

	// Create a direct message room with another user
	public async createDirectMessageRoom(userId: string): Promise<string> {
		await this.ensureFreshToken();

		if (!this.client) {
			throw new Error('Matrix client not initialized');
		}

		const response = await this.client.createRoom({
			preset: 'private_chat' as any,
			invite: [userId],
			is_direct: true,
			initial_state: [buildMatrixRoomEncryptionInitialState()]
		});

		return response.room_id;
	}

	// Get user rooms
	public getRooms(): Room[] {
		if (!this.client) {
			return [];
		}
		return this.client.getRooms();
	}

	// Get room by ID
	public getRoom(roomId: string): Room | null {
		if (!this.client) {
			return null;
		}
		return this.client.getRoom(roomId);
	}

	// Listen for new messages
	public onRoomMessage(
		callback: (event: MatrixEvent, room: Room) => void
	): void {
		if (!this.client) {
			return;
		}

		this.client.on(
			'Room.timeline' as any,
			(event: MatrixEvent, room: Room) => {
				if (event.getType() === 'm.room.message') {
					callback(event, room);
				}
			}
		);
	}

	// Send typing indicator (best-effort; room permission failures are non-fatal)
	public async sendTyping(roomId: string, typing: boolean): Promise<void> {
		await this.ensureFreshToken();

		if (!this.client) {
			return;
		}

		try {
			await this.client.sendTyping(roomId, typing, 30000);
		} catch (error) {
			if (isMatrixForbiddenError(error)) {
				return;
			}
			throw error;
		}
	}

	// Get room messages
	public getRoomMessages(roomId: string, limit: number = 50): MatrixEvent[] {
		if (!this.client) {
			return [];
		}

		const room = this.client.getRoom(roomId);
		if (!room) {
			return [];
		}

		return room.timeline.slice(-limit);
	}

	// Logout
	public async logout(): Promise<void> {
		const client = this.client;
		this.stopAndCleanup();

		if (!client) {
			return;
		}

		try {
			await client.logout();
		} catch {
			// Local session is already torn down; ignore remote logout failures.
		}
	}

	private initializeDependentServices(client: MatrixClient): void {
		if (this.initializedServicesClient === client) {
			return;
		}

		matrixCallService.initialize(client);
		matrixLiveEventBridge.initialize(client);
		matrixRoomHistoryKeyTransfer.initialize(client);
		this.initializedServicesClient = client;

		// #439 MSC3814: rehydrate the parked device (reads Megolm keys sent
		// during the login gap) and re-park a fresh one. Fire-and-forget and
		// best-effort — no-ops unless the toggle is on, the server supports
		// MSC3814, and secret storage (#437) is set up. Never blocks startup.
		void startDeviceDehydration(
			client,
			appConfig?.releaseToggles?.enableDeviceDehydration === true
		);
	}

	private scheduleTokenRefresh(
		expiresAt: number | null,
		isCurrent: () => boolean
	): void {
		this.clearRefreshTimer();

		if (!expiresAt) {
			return;
		}

		const refreshInMs = Math.max(
			expiresAt - Date.now() - TOKEN_REFRESH_BUFFER_MS,
			0
		);

		this.refreshTimer = window.setTimeout(() => {
			if (isCurrent()) this.refreshMatrixTokenSafely();
		}, refreshInMs);
	}

	private clearRefreshTimer(): void {
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	private cancelSessionWork(): void {
		this.sessionLifetime.abort();
		this.refreshingToken = null;
		this.staleDeviceRecovery = null;
		this.heldCryptoOperations.clear();
	}

	/** Stops sync, removes listeners, and tears down bridge/call services (no Matrix logout API). */
	public stopAndCleanup(): void {
		this.cancelSessionWork();
		this.stopClientAndNotify();
		// A client refresh detaches the old SDK but retains the session's
		// handlers. End the owning session even during that replacement gap.
		if (MatrixClientService.runtimeOwner === this) {
			MatrixClientService.runtimeOwner = null;
			matrixLiveEventBridge.destroy();
			matrixCallService.destroy();
		}
	}

	private stopClientAndNotify(): void {
		const hadClient = this.client !== null;
		unbindDraftCryptographyClient(this);
		this.teardownClient();
		if (hadClient) {
			this.notifyClientChangeListeners();
		}
	}

	private stopSdkClient(client: MatrixClient): void {
		clearSecretStorageKeys(client);
		client.stopClient();
		client.removeAllListeners();
	}

	private teardownClient(): void {
		const client = this.client;
		this.client = null;
		this.loginData = null;
		this.syncState = null;
		this.initializedServicesClient = null;
		this.clearRefreshTimer();
		if (client) {
			// Call ownership changes on PREPARED, after the shared runtime owner.
			matrixCallService.detach(client);
			this.stopSdkClient(client);
		}
		if (this.runtimeAttached && MatrixClientService.runtimeOwner === this) {
			matrixLiveEventBridge.detach();
			matrixRoomHistoryKeyTransfer.detach();
			matrixDecryptionRetry.detach();
		}
		this.runtimeAttached = false;
		this.notifySyncStateListeners();
	}

	public hasActiveClient(): boolean {
		return this.client !== null;
	}

	/**
	 * matrix-js-sdk keeps a rejected send as a NOT_SENT local echo. The ORISO
	 * timeline owns failed-message presentation and retry, so retaining the SDK
	 * echo as well would reveal two copies after the user successfully retries
	 * with a fresh transaction.
	 */
	private dropFailedLocalEcho(
		client: MatrixClient,
		roomId: string,
		txnId: string | undefined,
		error: unknown
	): void {
		const room = client.getRoom(roomId);
		const errorEvent = (error as { event?: MatrixEvent })?.event;
		const failedLocalEcho = txnId
			? errorEvent?.getTxnId?.() === txnId
				? errorEvent
				: room?.timeline?.find((event) => event.getTxnId?.() === txnId)
			: undefined;
		if (failedLocalEcho) {
			try {
				client.cancelPendingEvent(failedLocalEcho);
			} catch {
				// Preserve the original transport error. A status race must not
				// turn failed-send recovery into a second exception.
			}
		}
	}

	private async uploadFileMessageContent(
		client: MatrixClient,
		file: File,
		options: MatrixFileMessageOptions
	): Promise<Record<string, unknown>> {
		const dimensions = await getImageDimensions(file);
		const encryptedAttachment = await encryptMatrixAttachment(file);
		const uploadResponse = await client.uploadContent(
			encryptedAttachment.encryptedBlob,
			{
				includeFilename: false,
				type: 'application/octet-stream',
				abortController: options.abortController,
				progressHandler: ({ loaded, total }) => {
					if (!options.uploadProgress || !total) {
						return;
					}
					options.uploadProgress(
						Math.min(Math.ceil((100 * loaded) / total), 100)
					);
				}
			}
		);

		options.uploadProgress?.(100);

		return buildMatrixFileMessageContent(
			file,
			{
				...encryptedAttachment.file,
				url: uploadResponse.content_uri
			},
			dimensions,
			options
		);
	}

	private getStoredTokenExpiresAt(): number | null {
		const rawExpiresAt = localStorage.getItem('matrix_token_expires_at');
		const expiresAt = rawExpiresAt ? Number(rawExpiresAt) : NaN;

		return Number.isFinite(expiresAt) ? expiresAt : null;
	}

	private notifySyncStateListeners(): void {
		this.syncStateListeners.forEach((listener) => {
			listener(this.syncState);
		});
	}

	private notifyClientChangeListeners(): void {
		this.clientChangeListeners.forEach((listener) => {
			listener(this.client);
		});
	}
}
