import { MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk';
import {
	MatrixLoginData,
	clearPersistedMatrixDeviceId,
	createMatrixClient,
	getMatrixAccessToken,
	persistMatrixLoginData
} from '../components/sessionCookie/getMatrixAccessToken';
import { matrixCallService } from './matrixCallService';
import { buildMatrixCryptoStorePrefix } from './matrixCrypto';
import { applyDeviceIsolationMode } from './matrixDeviceIsolation';
import { appConfig } from '../utils/appConfig';
import { matrixLiveEventBridge } from './matrixLiveEventBridge';
import { startDeviceDehydration } from './matrixDeviceDehydration';
import { matrixRoomHistoryKeyTransfer } from './matrixRoomHistoryKeyTransfer';
import { encryptMatrixAttachment } from '../utils/matrixEncryptedAttachment';
import { buildMatrixRoomEncryptionInitialState } from '../utils/matrixRoomEncryption';
import {
	TextMessageContentOptions,
	buildTextMessageContent,
	buildEditContent,
	buildReactionContent
} from '../utils/messageRelations';

import { getImageDimensions } from '../utils/imageDimensions';

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

export interface MatrixFileMessageOptions {
	abortController?: AbortController;
	uploadProgress?: (percentUpload: number) => void;
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
	dimensions?: { w: number; h: number } | null
): Record<string, unknown> => ({
	body: file.name,
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
	private client: MatrixClient | null = null;
	private loginData: MatrixLoginData | null = null;
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

	// Initialize client with login data
	public async initializeClient(loginData: MatrixLoginData): Promise<void> {
		this.stopCurrentClient();
		this.loginData = loginData;
		this.client = createMatrixClient(loginData, (...messages) => {
			this.handleMatrixSdkError(loginData.deviceId, messages);
		});
		this.syncState = null;
		this.initializedServicesClient = null;
		this.notifySyncStateListeners();
		this.scheduleTokenRefresh(loginData);
		// Announce the replacement client before sync starts so consumers
		// (e.g. SessionStream room listeners) re-attach without missing events.
		this.notifyClientChangeListeners();

		// CRITICAL: Start client with sync configuration (EXACTLY like Element does!)
		// NOTE: TURN/STUN servers are fetched automatically from Matrix homeserver
		// console.log('🔧 Matrix client will fetch TURN/STUN servers from homeserver');

		const client = this.client;
		try {
			await client.initRustCrypto({
				useIndexedDB: true,
				cryptoDatabasePrefix: buildMatrixCryptoStorePrefix(
					loginData.userId,
					loginData.deviceId
				)
			});
		} catch (error) {
			// The failed client was already announced above, so tear down via
			// the notifying path to hand subscribers the resulting null.
			this.stopAndCleanup();
			throw error;
		}

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

		(client as any).on(
			'sync',
			(state: string, _prevState: string | null, syncError?: unknown) => {
				this.syncState = state;
				this.notifySyncStateListeners();

				if (state === 'PREPARED') {
					// console.log('✅ Matrix client SYNCED and READY for real-time events!');
					this.initializeDependentServices(client);
				}

				if (state === 'ERROR' && isMatrixExpiredTokenError(syncError)) {
					this.refreshMatrixTokenSafely();
				}
			}
		);

		client.startClient({
			initialSyncLimit: 20, // Load last 20 messages per room initially
			pollTimeout: 30000, // 30-second long-polling timeout
			lazyLoadMembers: true // Don't load all room members immediately
		});

		// console.log("✅ Matrix client starting with real-time sync...");
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

	public async refreshMatrixToken(): Promise<void> {
		if (this.refreshingToken) {
			return this.refreshingToken;
		}

		this.refreshingToken = getMatrixAccessToken()
			.then(async (loginData) => {
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
				await this.initializeClient(refreshedLoginData);
			})
			.finally(() => {
				this.refreshingToken = null;
			});

		return this.refreshingToken;
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
		if (!staleLoginData) {
			return Promise.resolve();
		}

		clearPersistedMatrixDeviceId(staleLoginData.userId);
		this.staleDeviceRecovery = getMatrixAccessToken()
			.then(async (loginData) => {
				const recoveredLoginData: MatrixLoginData = {
					...loginData,
					isAnonymous:
						loginData.isAnonymous ?? staleLoginData.isAnonymous
				};
				persistMatrixLoginData(recoveredLoginData);
				await this.initializeClient(recoveredLoginData);
				const recoveredClient = this.client;
				if (!recoveredClient) {
					throw new Error(
						'Recovered Matrix client was not initialized'
					);
				}
				await this.waitForClientPrepared(recoveredClient);
				this.staleDeviceRecoveryVersion += 1;
			})
			.finally(() => {
				this.staleDeviceRecovery = null;
			});

		return this.staleDeviceRecovery;
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
			const makeOutgoingRequest =
				crypto?.outgoingRequestProcessor?.makeOutgoingRequest;
			if (
				!room ||
				typeof room.getEncryptionTargetMembers !== 'function' ||
				typeof olmMachine?.trackedUsers !== 'function' ||
				typeof olmMachine.queryKeysForUsers !== 'function' ||
				typeof makeOutgoingRequest !== 'function'
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

			const request = olmMachine.queryKeysForUsers(queryUsers);
			await makeOutgoingRequest.call(
				crypto.outgoingRequestProcessor,
				request
			);
			return true;
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
				// matrix-js-sdk keeps a rejected send as a NOT_SENT local echo.
				// The ORISO timeline owns failed-message presentation and retry,
				// so retaining the SDK echo as well would reveal two copies after
				// the user successfully retries with a fresh transaction.
				const room = client.getRoom(roomId);
				const errorEvent = (error as { event?: MatrixEvent })?.event;
				const failedLocalEcho = txnId
					? errorEvent?.getTxnId?.() === txnId
						? errorEvent
						: room?.timeline?.find(
								(event) => event.getTxnId?.() === txnId
							)
					: undefined;
				if (failedLocalEcho) {
					try {
						client.cancelPendingEvent(failedLocalEcho);
					} catch {
						// Preserve the original transport error. A status race must not
						// turn failed-send recovery into a second exception.
					}
				}
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
		await this.ensureFreshToken();

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
			return client.sendMessage(roomId, content as any);
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
		matrixLiveEventBridge.destroy();
		matrixCallService.destroy();

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

	private scheduleTokenRefresh(loginData: MatrixLoginData): void {
		this.clearRefreshTimer();

		const expiresAt = loginData.expiresInMs
			? Date.now() + loginData.expiresInMs
			: this.getStoredTokenExpiresAt();

		if (!expiresAt) {
			return;
		}

		const refreshInMs = Math.max(
			expiresAt - Date.now() - TOKEN_REFRESH_BUFFER_MS,
			0
		);

		this.refreshTimer = window.setTimeout(() => {
			this.refreshMatrixTokenSafely();
		}, refreshInMs);
	}

	private clearRefreshTimer(): void {
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	// Teardown on the re-initialization path: the replacement client is
	// announced by initializeClient itself, so skip the null notification.
	private stopCurrentClient(): void {
		this.teardownClient();
	}

	/** Stops sync, removes listeners, and tears down bridge/call services (no Matrix logout API). */
	public stopAndCleanup(): void {
		const hadClient = this.client !== null;
		this.teardownClient();
		if (hadClient) {
			this.notifyClientChangeListeners();
		}
	}

	private teardownClient(): void {
		this.clearRefreshTimer();

		if (this.client) {
			this.client.stopClient();
			this.client.removeAllListeners();
		}

		this.client = null;
		this.loginData = null;
		this.syncState = null;
		this.initializedServicesClient = null;
		matrixLiveEventBridge.detach();
		matrixCallService.detach();
		matrixRoomHistoryKeyTransfer.detach();
		this.notifySyncStateListeners();
	}

	public hasActiveClient(): boolean {
		return this.client !== null;
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
			dimensions
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
