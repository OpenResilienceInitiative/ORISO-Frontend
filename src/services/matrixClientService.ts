import { MatrixClient, Room, MatrixEvent } from "matrix-js-sdk";
import { MatrixLoginData, createMatrixClient } from "../components/sessionCookie/getMatrixAccessToken";
import { matrixCallService } from "./matrixCallService";
import { matrixLiveEventBridge } from "./matrixLiveEventBridge";

export class MatrixClientService {
    private client: MatrixClient | null = null;
    private loginData: MatrixLoginData | null = null;

    constructor() {
        // Initialize service
    }

    // Initialize client with login data
    public initializeClient(loginData: MatrixLoginData): void {
        this.loginData = loginData;
        this.client = createMatrixClient(loginData);
        
        // CRITICAL: Start client with sync configuration (EXACTLY like Element does!)
        // NOTE: TURN/STUN servers are fetched automatically from Matrix homeserver
        console.log('🔧 Matrix client will fetch TURN/STUN servers from homeserver');
        
        this.client.startClient({
            initialSyncLimit: 20,  // Load last 20 messages per room initially
            pollTimeout: 30000,    // 30-second long-polling timeout
            lazyLoadMembers: true  // Don't load all room members immediately
        });
        
        // Wait for initial sync to complete before initializing other services
        (this.client as any).once('sync', (state: string) => {
            console.log('🔷 Matrix sync state:', state);
            
            if (state === 'PREPARED') {
                console.log('✅ Matrix client SYNCED and READY for real-time events!');
                
                // Initialize call service with this client
                matrixCallService.initialize(this.client!);
                
                // Initialize live event bridge for real-time notifications
                matrixLiveEventBridge.initialize(this.client!);
            }
        });
        
        // Log sync state changes
        (this.client as any).on('sync', (state: string, prevState: string | null) => {
            console.log(`🔄 Matrix sync: ${prevState} → ${state}`);
        });
        
        console.log("✅ Matrix client starting with real-time sync...");
    }

    // Get current client
    public getClient(): MatrixClient | null {
        return this.client;
    }

    // Send message to a room
    public async sendMessage(roomId: string, message: string): Promise<void> {
        if (!this.client) {
            throw new Error("Matrix client not initialized");
        }

        const content = {
            msgtype: "m.text",
            body: message,
        } as any;

        await this.client.sendMessage(roomId, content);
    }

    // Create a direct message room with another user
    public async createDirectMessageRoom(userId: string): Promise<string> {
        if (!this.client) {
            throw new Error("Matrix client not initialized");
        }

        const response = await this.client.createRoom({
            preset: "private_chat" as any,
            invite: [userId],
            is_direct: true,
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
    public onRoomMessage(callback: (event: MatrixEvent, room: Room) => void): void {
        if (!this.client) {
            return;
        }

        this.client.on("Room.timeline" as any, (event: MatrixEvent, room: Room) => {
            if (event.getType() === "m.room.message") {
                callback(event, room);
            }
        });
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
