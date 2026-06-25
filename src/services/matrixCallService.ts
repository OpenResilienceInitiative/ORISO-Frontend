/**
 * Matrix Call Service
 * Handles Matrix native VoIP/WebRTC voice and video calls
 */

import { MatrixClient } from 'matrix-js-sdk';
import {
	MatrixCall,
	CallEvent,
	CallState
} from 'matrix-js-sdk/lib/webrtc/call';
import { CallFeedEvent } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { assertMatrixRoomEncrypted } from '../utils/matrixRoomEncryption';

export interface MatrixCallOptions {
	roomId: string;
	isVideoCall: boolean;
	localVideoElement?: HTMLVideoElement;
	remoteVideoElement?: HTMLVideoElement;
}

export interface MatrixCallEventHandlers {
	onCallStateChanged?: (state: CallState) => void;
	onCallEnded?: () => void;
	onCallError?: (error: Error) => void;
	onIncomingCall?: (call: MatrixCall) => void;
}

class MatrixCallService {
	private client: MatrixClient | null = null;
	private activeCall: MatrixCall | null = null;
	private activeMediaOptions: MatrixCallOptions | null = null;
	private eventHandlers: MatrixCallEventHandlers = {};
	private detachFeedListeners: Array<() => void> = [];

	/**
	 * Initialize call service with Matrix client
	 */
	public initialize(
		client: MatrixClient,
		handlers: MatrixCallEventHandlers = {}
	): void {
		if (this.client && this.client !== client) {
			this.client.removeAllListeners('Call.incoming' as any);
		}

		this.client = client;
		this.eventHandlers = handlers;

		// Listen for incoming calls
		this.client.on('Call.incoming' as any, (call: MatrixCall) => {
			// console.log('📞 Incoming Matrix WebRTC call from:', call.getOpponentMember()?.name);
			// Note: LiveKit group calls are handled separately in matrixLiveEventBridge
			// and won't trigger this event
			if (this.eventHandlers.onIncomingCall) {
				this.eventHandlers.onIncomingCall(call);
			}
		});

		// console.log('✅ Matrix Call Service initialized');
	}

	/**
	 * Start a voice or video call
	 */
	public async startCall(options: MatrixCallOptions): Promise<MatrixCall> {
		if (!this.client) {
			throw new Error('Matrix client not initialized');
		}

		if (this.activeCall) {
			// console.warn('⚠️  Active call exists, force clearing it...');
			try {
				// Just stop the tracks, don't hangup (which triggers events)
				const localFeed = this.activeCall.localUsermediaFeed;
				if (localFeed) {
					localFeed.stream
						?.getTracks()
						.forEach((track) => track.stop());
				}
			} catch (err) {
				// console.error('❌ Error stopping old tracks:', err);
			}
			// Force clear the activeCall reference
			this.activeCall = null;
			// console.log('✅ Old call reference cleared');
		}

		try {
			// console.log(`📞 Starting ${options.isVideoCall ? 'video' : 'voice'} call in room:`, options.roomId);

			// Wait for Matrix client to sync and find the room
			// console.log('🔍 Looking for room:', options.roomId);
			let room = this.client.getRoom(options.roomId);

			if (!room) {
				// console.log('⏳ Room not found yet, waiting for sync...');

				// Wait up to 10 seconds for room to appear
				for (let i = 0; i < 20; i++) {
					await new Promise((resolve) => setTimeout(resolve, 500));
					room = this.client.getRoom(options.roomId);
					if (room) {
						// console.log('✅ Room found after waiting!');
						break;
					}
				}

				if (!room) {
					// console.error('❌ Room still not found after 10 seconds');
					// console.error('❌ Available rooms:', this.client.getRooms().map((r: any) => r.roomId));
					throw new Error(
						'Room not found. The Matrix client may not have finished syncing, or you may not be a member of this room.'
					);
				}
			} else {
				// console.log('✅ Room found immediately!');
			}

			assertMatrixRoomEncrypted(this.client, options.roomId);

			const call = this.client.createCall(options.roomId) as MatrixCall;

			if (!call) {
				throw new Error('Failed to create call');
			}

			this.activeCall = call;
			this.setupCallEventListeners(call, options);

			// Place the call (matrix-js-sdk will request media permissions internally)
			await call.placeCall(
				true, // audio
				options.isVideoCall // video
			);

			// console.log('✅ Call placed successfully');

			return call;
		} catch (error) {
			// console.error('❌ Failed to start call:', error);
			if (this.eventHandlers.onCallError) {
				this.eventHandlers.onCallError(error as Error);
			}
			throw error;
		}
	}

	/**
	 * Answer an incoming call
	 */
	public async answerCall(
		call: MatrixCall,
		isVideoCall: boolean,
		localVideoElement?: HTMLVideoElement,
		remoteVideoElement?: HTMLVideoElement
	): Promise<void> {
		try {
			// console.log('📞 Answering call...');

			assertMatrixRoomEncrypted(this.client, call.roomId);

			this.activeCall = call;
			this.setupCallEventListeners(call, {
				roomId: call.roomId,
				isVideoCall,
				localVideoElement,
				remoteVideoElement
			});

			// Answer the call (matrix-js-sdk will request media permissions internally)
			await call.answer(
				true, // audio
				isVideoCall // video
			);

			// console.log('✅ Call answered successfully');
		} catch (error) {
			// console.error('❌ Failed to answer call:', error);
			if (this.eventHandlers.onCallError) {
				this.eventHandlers.onCallError(error as Error);
			}
			throw error;
		}
	}

	/**
	 * Bind or refresh DOM elements used to render local/remote media.
	 * Required for audio-only calls where `<video>` elements are hidden but
	 * must still exist so remote audio can play.
	 */
	public attachMediaElements(
		localVideoElement?: HTMLVideoElement | null,
		remoteVideoElement?: HTMLVideoElement | null
	): void {
		if (!this.activeCall || !this.activeMediaOptions) {
			return;
		}

		if (localVideoElement) {
			this.activeMediaOptions.localVideoElement = localVideoElement;
		}
		if (remoteVideoElement) {
			this.activeMediaOptions.remoteVideoElement = remoteVideoElement;
		}

		this.handleFeedsChanged(this.activeCall, this.activeMediaOptions);
	}

	/**
	 * Hangup the active call
	 */
	public hangupCall(): void {
		if (this.activeCall) {
			// console.log('📞 Hanging up call...');
			try {
				this.activeCall.hangup('user_hangup' as any, false);
				this.cleanup();
				// console.log('✅ Call ended');
			} catch (error) {
				// console.error('❌ Error hanging up call:', error);
			}
		}
	}

	/**
	 * Reject an incoming call
	 */
	public rejectCall(call: MatrixCall): void {
		// console.log('📞 Rejecting call...');
		try {
			call.reject();
			// console.log('✅ Call rejected');
		} catch (error) {
			// console.error('❌ Error rejecting call:', error);
		}
	}

	/**
	 * Toggle microphone mute
	 */
	public toggleMicrophone(): boolean {
		if (this.activeCall) {
			const isMuted = this.activeCall.isMicrophoneMuted();
			this.activeCall.setMicrophoneMuted(!isMuted);
			// console.log(`🎤 Microphone ${!isMuted ? 'muted' : 'unmuted'}`);
			return !isMuted;
		}
		return false;
	}

	/**
	 * Toggle video on/off
	 */
	public toggleVideo(): boolean {
		if (this.activeCall) {
			const isVideoMuted = this.activeCall.isLocalVideoMuted();
			this.activeCall.setLocalVideoMuted(!isVideoMuted);
			// console.log(`📹 Video ${!isVideoMuted ? 'disabled' : 'enabled'}`);
			return !isVideoMuted;
		}
		return false;
	}

	/**
	 * Get active call
	 */
	public getActiveCall(): MatrixCall | null {
		return this.activeCall;
	}

	/**
	 * Check if call is in progress
	 */
	public isCallActive(): boolean {
		return this.activeCall !== null;
	}

	/**
	 * Setup event listeners for a call
	 */
	private setupCallEventListeners(
		call: MatrixCall,
		options: MatrixCallOptions
	): void {
		this.activeMediaOptions = options;

		// Call state changed
		call.on(CallEvent.State as any, (state: CallState) => {
			// console.log('📞 Call state changed:', state);

			if (this.eventHandlers.onCallStateChanged) {
				this.eventHandlers.onCallStateChanged(state);
			}

			// Handle call end states
			if (state === CallState.Ended) {
				// console.log('📞 Call ended');
				if (this.eventHandlers.onCallEnded) {
					this.eventHandlers.onCallEnded();
				}
				this.cleanup();
			}
		});

		// Feeds changed (local/remote streams)
		call.on(CallEvent.FeedsChanged as any, () => {
			// console.log('📞 Feeds changed');
			this.bindFeedStreamListeners(call, options);
			this.handleFeedsChanged(call, options);
		});

		call.on(CallEvent.PeerConnectionCreated as any, () => {
			this.bindPeerConnectionListeners(call, options);
		});

		this.bindFeedStreamListeners(call, options);
		this.bindPeerConnectionListeners(call, options);

		// Call error
		call.on(CallEvent.Error as any, (error: Error) => {
			// console.error('📞 Call error:', error);
			if (this.eventHandlers.onCallError) {
				this.eventHandlers.onCallError(error);
			}
		});

		// Call hangup
		call.on(CallEvent.Hangup as any, () => {
			// console.log('📞 Call hangup event');
			if (this.eventHandlers.onCallEnded) {
				this.eventHandlers.onCallEnded();
			}
			this.cleanup();
		});
	}

	/**
	 * Handle feeds changed (attach streams to video elements)
	 */
	private handleFeedsChanged(
		call: MatrixCall,
		options: MatrixCallOptions
	): void {
		try {
			const attachStream = (
				element: HTMLVideoElement | undefined,
				stream: MediaStream | undefined,
				label: string
			) => {
				if (!element || !stream) {
					return;
				}
				if (element.srcObject !== stream) {
					element.srcObject = stream;
				}
				element.play().catch(() => {
					// Autoplay may require a prior user gesture; ignore.
				});
			};

			// Local preview (optional for audio-only)
			const localFeed = this.getUsermediaFeed(call, true);
			if (localFeed?.stream) {
				attachStream(
					options.localVideoElement,
					localFeed.stream,
					'local'
				);
			}

			// Remote playback — critical for hearing the other person on audio calls
			const remoteFeed = this.getUsermediaFeed(call, false);
			if (remoteFeed?.stream) {
				attachStream(
					options.remoteVideoElement,
					remoteFeed.stream,
					'remote'
				);
			}
		} catch (error) {
			// console.error('❌ Error handling feeds:', error);
		}
	}

	private getUsermediaFeed(call: MatrixCall, isLocal: boolean): any {
		const feeds =
			typeof (call as any).getFeeds === 'function'
				? (call as any).getFeeds()
				: [
						(call as any).localUsermediaFeed,
						(call as any).remoteUsermediaFeed
					].filter(Boolean);

		return feeds.find((feed: any) => {
			const feedIsLocal =
				typeof feed.isLocal === 'function'
					? feed.isLocal()
					: feed === (call as any).localUsermediaFeed;
			const hasTracks = feed.stream?.getTracks?.().length > 0;
			const isUsermedia =
				!feed.purpose ||
				String(feed.purpose).toLowerCase().includes('usermedia');

			return feedIsLocal === isLocal && hasTracks && isUsermedia;
		});
	}

	private bindFeedStreamListeners(
		call: MatrixCall,
		options: MatrixCallOptions
	): void {
		this.detachFeedListeners.forEach((detach) => detach());
		this.detachFeedListeners = [];

		const feeds =
			typeof (call as any).getFeeds === 'function'
				? (call as any).getFeeds()
				: [
						(call as any).localUsermediaFeed,
						(call as any).remoteUsermediaFeed
					].filter(Boolean);

		feeds.forEach((feed: any) => {
			const onNewStream = () => this.handleFeedsChanged(call, options);
			const onConnectedChanged = () =>
				this.handleFeedsChanged(call, options);

			feed.on?.(CallFeedEvent.NewStream as any, onNewStream);
			feed.on?.(
				CallFeedEvent.ConnectedChanged as any,
				onConnectedChanged
			);

			this.detachFeedListeners.push(() => {
				feed.off?.(CallFeedEvent.NewStream as any, onNewStream);
				feed.off?.(
					CallFeedEvent.ConnectedChanged as any,
					onConnectedChanged
				);
			});
		});
	}

	private bindPeerConnectionListeners(
		call: MatrixCall,
		options: MatrixCallOptions
	): void {
		const peerConnection = (call as any).peerConn as
			| RTCPeerConnection
			| undefined;
		if (!peerConnection) {
			return;
		}

		const attachRemoteStream = (stream: MediaStream) => {
			if (!options.remoteVideoElement || !stream) {
				return;
			}
			if (options.remoteVideoElement.srcObject !== stream) {
				options.remoteVideoElement.srcObject = stream;
			}
			options.remoteVideoElement.play().catch(() => {
				// Autoplay may require a prior user gesture; ignore.
			});
		};

		peerConnection.ontrack = (event) => {
			const stream = event.streams?.[0];
			if (stream) {
				attachRemoteStream(stream);
			}
		};
	}

	/**
	 * Cleanup call resources
	 */
	private cleanup(): void {
		this.detachFeedListeners.forEach((detach) => detach());
		this.detachFeedListeners = [];

		if (this.activeCall) {
			// Stop all media tracks
			try {
				const localFeed = this.activeCall.localUsermediaFeed;
				if (localFeed) {
					localFeed.stream
						?.getTracks()
						.forEach((track) => track.stop());
				}
			} catch (error) {
				// console.error('Error stopping media tracks:', error);
			}

			this.activeCall = null;
		}
		this.activeMediaOptions = null;
	}

	public detach(): void {
		if (this.client) {
			this.client.removeAllListeners('Call.incoming' as any);
		}
		this.hangupCall();
		this.client = null;
	}

	/**
	 * Destroy service and cleanup
	 */
	public destroy(): void {
		this.detach();
		this.eventHandlers = {};
		// console.log('✅ Matrix Call Service destroyed');
	}
}

// Export singleton instance
export const matrixCallService = new MatrixCallService();
