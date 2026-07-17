import { MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk';
import {
	MatrixLoginData,
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
import { encryptMatrixAttachment } from '../utils/matrixEncryptedAttachment';
import { buildMatrixRoomEncryptionInitialState } from '../utils/matrixRoomEncryption';

const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;

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

const buildMatrixFileMessageContent = (
	file: File,
	encryptedFile: Awaited<ReturnType<typeof encryptMatrixAttachment>>['file']
): Record<string, unknown> => ({
	body: file.name,
	filename: file.name,
	msgtype: getMatrixFileMessageType(file),
	file: encryptedFile,
	info: {
		mimetype: file.type || 'application/octet-stream',
		size: file.size
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

export class MatrixClientService {
	private client: MatrixClient | null = null;
	private loginData: MatrixLoginData | null = null;
	private refreshTimer: number | null = null;
	private refreshingToken: Promise<void> | null = null;
	private syncState: string | null = null;
	private initializedServicesClient: MatrixClient | null = null;
	private syncStateListeners = new Set<(state: string | null) => void>();
	private clientChangeListeners = new Set<
		(client: MatrixClient | null) => void
	>();

	// Initialize client with login data
	public async initializeClient(loginData: MatrixLoginData): Promise<void> {
		this.stopCurrentClient();
		this.loginData = loginData;
		this.client = createMatrixClient(loginData);
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
		// Best-effort — never breaks client startup.
		applyDeviceIsolationMode(
			client,
			appConfig?.releaseToggles?.enableInvisibleCrypto === true
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
		return this.syncState === 'PREPARED';
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
				persistMatrixLoginData(loginData);
				await this.initializeClient(loginData);
			})
			.finally(() => {
				this.refreshingToken = null;
			});

		return this.refreshingToken;
	}

	private refreshMatrixTokenSafely(): void {
		void this.refreshMatrixToken().catch(() => undefined);
	}

	public async ensureFreshToken(): Promise<void> {
		const expiresAt = this.getStoredTokenExpiresAt();
		if (!expiresAt || Date.now() + TOKEN_REFRESH_BUFFER_MS < expiresAt) {
			return;
		}

		await this.refreshMatrixToken();
	}

	// Send message to a room
	public async sendMessage(roomId: string, message: string): Promise<any> {
		await this.ensureFreshToken();

		const content = {
			msgtype: 'm.text',
			body: message
		} as any;
		const sendToRoom = async () => {
			const client = this.client;
			if (!client) {
				throw new Error('Matrix client not initialized');
			}
			if (!client.getRoom(roomId)) {
				await client.joinRoom(roomId);
			}
			return client.sendMessage(roomId, content);
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

	public async editMessage(
		roomId: string,
		eventId: string,
		message: string
	): Promise<any> {
		await this.ensureFreshToken();
		if (!this.client) throw new Error('Matrix client not initialized');
		const content = {
			'msgtype': 'm.text',
			'body': `* ${message}`,
			'm.new_content': { msgtype: 'm.text', body: message },
			'm.relates_to': { rel_type: 'm.replace', event_id: eventId }
		};
		return this.client.sendMessage(roomId, content as any);
	}

	public async sendFileMessage(
		roomId: string,
		file: File,
		options: MatrixFileMessageOptions = {}
	): Promise<any> {
		await this.ensureFreshToken();

		if (!this.client) {
			throw new Error('Matrix client not initialized');
		}

		try {
			const content = await this.uploadFileMessageContent(file, options);
			return await this.client.sendMessage(roomId, content as any);
		} catch (error) {
			if (!isMatrixExpiredTokenError(error)) {
				throw error;
			}

			await this.refreshMatrixToken();
			if (!this.client) {
				throw new Error('Matrix client not initialized');
			}

			const content = await this.uploadFileMessageContent(file, options);
			return this.client.sendMessage(roomId, content as any);
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
		this.notifySyncStateListeners();
	}

	public hasActiveClient(): boolean {
		return this.client !== null;
	}

	private async uploadFileMessageContent(
		file: File,
		options: MatrixFileMessageOptions
	): Promise<Record<string, unknown>> {
		if (!this.client) {
			throw new Error('Matrix client not initialized');
		}

		const encryptedAttachment = await encryptMatrixAttachment(file);
		const uploadResponse = await this.client.uploadContent(
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

		return buildMatrixFileMessageContent(file, {
			...encryptedAttachment.file,
			url: uploadResponse.content_uri
		});
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
