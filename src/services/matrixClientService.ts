import { MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk';
import {
	MatrixLoginData,
	createMatrixClient
} from '../components/sessionCookie/getMatrixAccessToken';
import { matrixCallService } from './matrixCallService';
import { matrixLiveEventBridge } from './matrixLiveEventBridge';

export class MatrixClientService {
	private client: MatrixClient | null = null;
	private loginData: MatrixLoginData | null = null;

	// Initialize client with login data
	public initializeClient(loginData: MatrixLoginData): void {
		this.loginData = loginData;
		this.client = createMatrixClient(loginData);

		// CRITICAL: Start client with sync configuration (EXACTLY like Element does!)
		// NOTE: TURN/STUN servers are fetched automatically from Matrix homeserver
		console.log(
			'🔧 Matrix client will fetch TURN/STUN servers from homeserver'
		);

		this.client.startClient({
			initialSyncLimit: 20, // Load last 20 messages per room initially
			pollTimeout: 30000, // 30-second long-polling timeout
			lazyLoadMembers: true // Don't load all room members immediately
		});

		// Wait for initial sync to complete before initializing other services
		(this.client as any).once('sync', (state: string) => {
			console.log('🔷 Matrix sync state:', state);

			if (state === 'PREPARED') {
				console.log(
					'✅ Matrix client SYNCED and READY for real-time events!'
				);

				// Ensure client is available before initializing services
				if (this.client) {
					// Initialize call service with this client
					matrixCallService.initialize(this.client);

					// Initialize live event bridge for real-time notifications
					matrixLiveEventBridge.initialize(this.client);
				} else {
					console.error(
						'❌ Matrix client is null when reaching PREPARED state'
					);
				}
			}
		});

		// Log sync state changes
		(this.client as any).on(
			'sync',
			(state: string, prevState: string | null) => {
				console.log(`🔄 Matrix sync: ${prevState} → ${state}`);
			}
		);

		console.log('✅ Matrix client starting with real-time sync...');
	}

	// Get current client
	public getClient(): MatrixClient | null {
		return this.client;
	}

	// Wait for sync state to reach a specific state
	public async waitForSyncState(targetState: string): Promise<void> {
		if (!this.client) {
			throw new Error('Matrix client not initialized');
		}

		// If already in the target state, resolve immediately
		if ((this.client as any).syncState === targetState) {
			return Promise.resolve();
		}

		// Otherwise, wait for the sync event
		return new Promise<void>((resolve) => {
			const handler = (state: string) => {
				if (state === targetState) {
					// Remove the listener after resolving
					(this.client as any).removeListener?.('sync', handler);
					(this.client as any).off?.('sync', handler);
					resolve();
				}
			};

			// Use once for one-time check, but also set up ongoing listener
			(this.client as any).once('sync', handler);
			(this.client as any).on('sync', handler);
		});
	}

	// Send message to a room
	public async sendMessage(roomId: string, message: string): Promise<void> {
		if (!this.client) {
			throw new Error('Matrix client not initialized');
		}

		const content = {
			msgtype: 'm.text',
			body: message
		} as any;

		await this.client.sendMessage(roomId, content);
	}

	// Create a direct message room with another user
	public async createDirectMessageRoom(userId: string): Promise<string> {
		if (!this.client) {
			throw new Error('Matrix client not initialized');
		}

		const response = await this.client.createRoom({
			preset: 'private_chat' as any,
			invite: [userId],
			is_direct: true
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
	): () => void {
		if (!this.client) {
			return () => {}; // Return no-op unsubscribe function
		}

		// Capture handler function separately so we can remove it later
		const handler = (event: MatrixEvent, room: Room) => {
			if (event.getType() === 'm.room.message') {
				callback(event, room);
			}
		};

		this.client.on('Room.timeline' as any, handler);

		// Return unsubscribe function
		return () => {
			if (this.client) {
				(this.client as any).removeListener?.(
					'Room.timeline' as any,
					handler
				) ||
					(this.client as any).off?.('Room.timeline' as any, handler);
			}
		};
	}

	// Send typing indicator
	public async sendTyping(roomId: string, typing: boolean): Promise<void> {
		if (!this.client) {
			return;
		}
		await this.client.sendTyping(roomId, typing, 30000);
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
		if (!this.client) {
			return;
		}

		await this.client.logout();
		this.client = null;
		this.loginData = null;
	}
}

// Singleton instance
export const matrixClientService = new MatrixClientService();
