/**
 * Matrix Group Call Service - Using Official Matrix GroupCall API
 * This properly handles multi-participant calls with everyone seeing everyone
 */

import { MatrixClient } from 'matrix-js-sdk';
import { GroupCall, GroupCallIntent, GroupCallType, GroupCallEvent } from 'matrix-js-sdk/lib/webrtc/groupCall';
import { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { assertMatrixRoomEncrypted } from '../utils/matrixRoomEncryption';

export interface GroupCallParticipant {
    userId: string;
    displayName: string;
    feed?: CallFeed;
    isLocal: boolean;
}

class MatrixGroupCallService {
    private client: MatrixClient | null = null;
    private activeGroupCall: GroupCall | null = null;
    private onParticipantsChanged?: (participants: GroupCallParticipant[]) => void;
    private onError?: (error: Error) => void;

    public initialize(client: MatrixClient): void {
        this.client = client;
        // console.log('✅ MatrixGroupCallService initialized');
    }

    /**
     * Start or join a group call
     */
    public async startOrJoinGroupCall(
        roomId: string,
        isVideo: boolean,
        onParticipantsChanged: (participants: GroupCallParticipant[]) => void,
        onError: (error: Error) => void
    ): Promise<void> {
        if (!this.client) {
            const error = new Error('Matrix client not initialized');
            // console.error('❌', error);
            throw error;
        }

        assertMatrixRoomEncrypted(this.client, roomId);

        this.onParticipantsChanged = onParticipantsChanged;
        this.onError = onError;

        try {
            // console.log('📞 Starting/joining group call in room:', roomId);
            // console.log('📞 Video enabled:', isVideo);

            // Wait for room to be ready
            // console.log('⏳ Waiting for room to be ready...');
            await this.client.waitUntilRoomReadyForGroupCalls(roomId);
            // console.log('✅ Room is ready');

            // Check if group call already exists
            let groupCall = this.client.getGroupCallForRoom(roomId);
            // console.log('🔍 Existing group call:', groupCall ? 'Found' : 'Not found');

            if (!groupCall) {
                // Create new group call
                // console.log('🆕 Creating new group call...');
                // console.log('   - Room ID:', roomId);
                // console.log('   - Type:', isVideo ? 'Video' : 'Voice');
                // console.log('   - Intent: Prompt');
                
                groupCall = await this.client.createGroupCall(
                    roomId,
                    isVideo ? GroupCallType.Video : GroupCallType.Voice,
                    false, // isPtt (push-to-talk)
                    GroupCallIntent.Prompt, // Intent
                    false, // dataChannelsEnabled
                    undefined // dataChannelOptions
                );
                // console.log('✅ Group call created:', groupCall);
            } else {
                // console.log('✅ Found existing group call:', groupCall.groupCallId);
            }

            this.activeGroupCall = groupCall;
            // console.log('📌 Active group call set');

            // Set up event listeners BEFORE entering
            // console.log('🎧 Setting up listeners...');
            this.setupGroupCallListeners();

            // Enter the call
            // console.log('🚪 Entering group call...');
            // console.log('   - Group call state before enter:', this.activeGroupCall.state);
            
            await this.activeGroupCall.enter();
            
            // console.log('✅ Successfully entered group call');
            // console.log('   - Group call state after enter:', this.activeGroupCall.state);
            // console.log('   - Local call feed:', this.activeGroupCall.localCallFeed);
            // console.log('   - User media feeds:', this.activeGroupCall.userMediaFeeds);

            // Set initial mute state
            if (isVideo) {
                // console.log('📹 Unmuting video...');
                await this.activeGroupCall.setLocalVideoMuted(false);
            }
            // console.log('🎤 Unmuting audio...');
            await this.activeGroupCall.setMicrophoneMuted(false);

            // console.log('✅ Group call fully initialized');

        } catch (error) {
            // console.error('❌ Failed to start/join group call:', error);
            // console.error('❌ Error details:', {
            // name: (error as Error).name,
            // message: (error as Error).message,
            // stack: (error as Error).stack
            // });
            if (this.onError) {
                this.onError(error as Error);
            }
            throw error;
        }
    }

    /**
     * Set up event listeners for the group call
     */
    private setupGroupCallListeners(): void {
        if (!this.activeGroupCall) return;

        // console.log('🎧 Setting up group call listeners...');

        // Listen for user media feeds (THIS IS THE KEY EVENT!)
        this.activeGroupCall.on(GroupCallEvent.UserMediaFeedsChanged, (feeds: CallFeed[]) => {
            // console.log('📡 UserMediaFeedsChanged:', feeds.length, 'feeds');
            feeds.forEach((feed, index) => {
                // console.log(`  Feed ${index}:`, {
                // userId: feed.userId,
                // isLocal: feed.isLocal(),
                // hasVideo: feed.stream?.getVideoTracks().length > 0,
                // hasAudio: feed.stream?.getAudioTracks().length > 0
                // });
            });
            this.updateParticipants(feeds);
        });

        // Listen for participants changes
        this.activeGroupCall.on(GroupCallEvent.ParticipantsChanged, (participants) => {
            // console.log('👥 ParticipantsChanged:', participants.size, 'participants');
        });

        // Listen for state changes
        this.activeGroupCall.on(GroupCallEvent.GroupCallStateChanged, (newState, oldState) => {
            // console.log('🔄 GroupCallStateChanged:', oldState, '→', newState);
        });

        // Listen for errors
        this.activeGroupCall.on(GroupCallEvent.Error, (error) => {
            // console.error('❌ Group call error:', error);
            if (this.onError) {
                this.onError(error);
            }
        });

        // console.log('✅ Group call listeners set up');
    }

    /**
     * Update participants from feeds
     */
    private updateParticipants(feeds: CallFeed[]): void {
        if (!this.client || !this.onParticipantsChanged) return;

        const participants: GroupCallParticipant[] = [];

        feeds.forEach(feed => {
            const userId = feed.userId;
            const isLocal = feed.isLocal();
            const member = this.client?.getUser(userId);
            const displayName = member?.displayName || userId;

            participants.push({
                userId,
                displayName,
                feed,
                isLocal
            });
        });

        // console.log('✅ Updated participants:', participants.map(p => ({
        // name: p.displayName,
        // isLocal: p.isLocal,
        // hasStream: !!p.feed?.stream
        // })));

        this.onParticipantsChanged(participants);
    }

    /**
     * Set microphone muted
     */
    public async setMicrophoneMuted(muted: boolean): Promise<void> {
        if (this.activeGroupCall) {
            await this.activeGroupCall.setMicrophoneMuted(muted);
        }
    }

    /**
     * Set video muted
     */
    public async setLocalVideoMuted(muted: boolean): Promise<void> {
        if (this.activeGroupCall) {
            await this.activeGroupCall.setLocalVideoMuted(muted);
        }
    }

    /**
     * End the group call
     */
    public async endGroupCall(): Promise<void> {
        if (this.activeGroupCall) {
            // console.log('📴 Ending group call...');
            try {
                await this.activeGroupCall.leave();
                this.activeGroupCall.removeAllListeners();
                this.activeGroupCall = null;
                // console.log('✅ Group call ended');
            } catch (error) {
                // console.error('❌ Error ending group call:', error);
            }
        }
    }

    /**
     * Check if there's an active group call
     */
    public hasActiveGroupCall(): boolean {
        return this.activeGroupCall !== null;
    }

    /**
     * Get active group call
     */
    public getActiveGroupCall(): GroupCall | null {
        return this.activeGroupCall;
    }
}

// Export singleton instance
export const matrixGroupCallService = new MatrixGroupCallService();
