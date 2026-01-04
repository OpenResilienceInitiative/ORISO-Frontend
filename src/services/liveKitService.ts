/**
 * LiveKit Service - Handles group video calls with LiveKit
 */

import { Room, RoomEvent, Track, RemoteParticipant, RemoteTrackPublication, LocalParticipant } from 'livekit-client';

export interface LiveKitParticipant {
    userId: string;
    displayName: string;
    videoTrack?: MediaStreamTrack;
    audioTrack?: MediaStreamTrack;
    isLocal: boolean;
}

class LiveKitService {
    private room: Room | null = null;
    private onParticipantsChanged?: (participants: LiveKitParticipant[]) => void;
    private onError?: (error: Error) => void;
    private subscribers: Set<(participants: LiveKitParticipant[]) => void> = new Set();
    private currentParticipants: LiveKitParticipant[] = [];
    private updateTimeout: any = null;

    /**
     * Subscribe to participant updates
     */
    public subscribe(callback: (participants: LiveKitParticipant[]) => void): () => void {
        this.subscribers.add(callback);
        // Immediately call with current participants
        callback(this.currentParticipants);
        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * Notify all subscribers of participant changes
     */
    private notifySubscribers(participants: LiveKitParticipant[]): void {
        this.currentParticipants = participants;
        this.subscribers.forEach(callback => callback(participants));
    }

    /**
     * Connect to LiveKit room
     */
    public async connect(
        roomName: string,
        userName: string,
        onParticipantsChanged: (participants: LiveKitParticipant[]) => void,
        onError: (error: Error) => void
    ): Promise<void> {
        this.onParticipantsChanged = onParticipantsChanged;
        this.onError = onError;

        try {
            console.log('📞 Connecting to LiveKit room:', roomName);

            // Create room
            this.room = new Room({
                adaptiveStream: true,
                dynacast: true,
                videoCaptureDefaults: {
                    resolution: {
                        width: 1280,
                        height: 720,
                        frameRate: 30
                    }
                }
            });

            // Set up event listeners
            this.setupRoomListeners();

            // Get access token from backend
            const token = await this.getAccessToken(roomName, userName);

            // Connect to LiveKit server
            const wsUrl = 'wss://livekit.oriso.site';
            console.log('🔌 Connecting to:', wsUrl);
            
            await this.room.connect(wsUrl, token);

            console.log('✅ Connected to LiveKit room');

            // Enable camera and microphone
            await this.room.localParticipant.setCameraEnabled(true);
            await this.room.localParticipant.setMicrophoneEnabled(true);

            // Update participants after a short delay to let tracks publish
            setTimeout(() => this.updateParticipants(), 500);

        } catch (error) {
            console.error('❌ Failed to connect to LiveKit:', error);
            if (this.onError) {
                this.onError(error as Error);
            }
            throw error;
        }
    }

    /**
     * Get access token from backend
     */
    private async getAccessToken(roomName: string, userName: string): Promise<string> {
        try {
            console.log('🔑 Requesting LiveKit token for:', { roomName, userName });
            
            const url = `/api/livekit/token?roomName=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(userName)}&_t=${Date.now()}`;
            console.log('📡 Fetching from URL:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                cache: 'no-store'
            });
            
            console.log('📥 Response status:', response.status, response.statusText);
            
            const responseText = await response.text();
            
            if (!response.ok) {
                throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
            }
            
            const data = JSON.parse(responseText);
            
            if (!data.token) {
                throw new Error('No token received from server');
            }
            
            console.log('✅ Received LiveKit token');
            return data.token;
            
        } catch (error) {
            console.error('❌ Failed to get LiveKit token:', error);
            throw new Error(`Could not establish signal connection: ${(error as Error).message}`);
        }
    }

    /**
     * Set up room event listeners
     */
    private setupRoomListeners(): void {
        if (!this.room) return;

        console.log('🎧 Setting up LiveKit listeners...');

        // Participant joined - wait for tracks before updating
        this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
            console.log('👤 Participant connected:', participant.identity);
            this.scheduleUpdate();
        });

        // Participant left
        this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
            console.log('👋 Participant disconnected:', participant.identity);
            this.scheduleUpdate();
        });

        // Track subscribed - CRITICAL for remote video
        this.room.on(RoomEvent.TrackSubscribed, (track: any, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            console.log('📡 Track subscribed:', track.kind, 'from', participant.identity);
            this.scheduleUpdate();
        });

        // Track unsubscribed
        this.room.on(RoomEvent.TrackUnsubscribed, (track: any, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            console.log('📴 Track unsubscribed:', track.kind, 'from', participant.identity);
            this.scheduleUpdate();
        });

        // Local track published
        this.room.on(RoomEvent.LocalTrackPublished, (publication: any) => {
            console.log('📤 Local track published:', publication.kind);
            this.scheduleUpdate();
        });

        // Connection state changed
        this.room.on(RoomEvent.ConnectionStateChanged, (state: any) => {
            console.log('🔄 Connection state:', state);
        });

        // Disconnected
        this.room.on(RoomEvent.Disconnected, () => {
            console.log('📴 Disconnected from room');
        });

        console.log('✅ LiveKit listeners set up');
    }

    /**
     * Schedule update with debouncing to prevent rapid re-renders
     */
    private scheduleUpdate(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        this.updateTimeout = setTimeout(() => {
            this.updateParticipants();
        }, 200); // 200ms debounce
    }

    /**
     * Update participants list
     */
    private updateParticipants(): void {
        if (!this.room) return;

        const participants: LiveKitParticipant[] = [];

        // Add local participant
        const localParticipant = this.room.localParticipant;
        const localVideoPublication = Array.from(localParticipant.videoTrackPublications.values())[0];
        const localAudioPublication = Array.from(localParticipant.audioTrackPublications.values())[0];
        
        participants.push({
            userId: localParticipant.identity,
            displayName: localParticipant.name || localParticipant.identity,
            videoTrack: localVideoPublication?.track?.mediaStreamTrack,
            audioTrack: localAudioPublication?.track?.mediaStreamTrack,
            isLocal: true
        });

        // Add remote participants - use subscribed tracks
        this.room.remoteParticipants.forEach((participant: RemoteParticipant) => {
            const videoPublication = Array.from(participant.videoTrackPublications.values())[0];
            const audioPublication = Array.from(participant.audioTrackPublications.values())[0];
            
            const videoTrack = videoPublication?.track?.mediaStreamTrack;
            const audioTrack = audioPublication?.track?.mediaStreamTrack;

            participants.push({
                userId: participant.identity,
                displayName: participant.name || participant.identity,
                videoTrack,
                audioTrack,
                isLocal: false
            });
        });

        console.log('👥 Participants updated:', participants.length, participants.map(p => `${p.displayName} (video: ${!!p.videoTrack})`));
        
        // Notify subscribers
        this.notifySubscribers(participants);
        
        // Also call legacy callback if set
        if (this.onParticipantsChanged) {
            this.onParticipantsChanged(participants);
        }
    }

    /**
     * Toggle microphone
     */
    public async setMicrophoneEnabled(enabled: boolean): Promise<void> {
        if (this.room) {
            await this.room.localParticipant.setMicrophoneEnabled(enabled);
        }
    }

    /**
     * Toggle camera
     */
    public async setCameraEnabled(enabled: boolean): Promise<void> {
        if (this.room) {
            await this.room.localParticipant.setCameraEnabled(enabled);
        }
    }

    /**
     * Disconnect from room
     */
    public async disconnect(): Promise<void> {
        if (this.room) {
            console.log('📴 Disconnecting from LiveKit...');
            if (this.updateTimeout) {
                clearTimeout(this.updateTimeout);
            }
            await this.room.disconnect();
            this.room = null;
            console.log('✅ Disconnected');
        }
    }

    /**
     * Check if connected
     */
    public isConnected(): boolean {
        return this.room !== null && this.room.state === 'connected';
    }
}

// Export singleton instance
export const liveKitService = new LiveKitService();
