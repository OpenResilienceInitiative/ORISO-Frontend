/**
 * The one place an outgoing call is started from a chat surface.
 *
 * This is `SessionMenu.handleStartVideoCall` lifted out of that component,
 * unchanged, with the room it calls into as an argument instead of a closure
 * over `activeSession`. Frank, 09.09.2026: "auch braucht die supervision die
 * möglichkeit das man einen call haben kann entweder video oder audio" — the
 * supervision side room is a Matrix room of its own (`supervisionRoomId`), so
 * its call must go against THAT room, not against the client's room.
 *
 * `CallManager.startCall(roomId, …)` is fully room-parameterised: it creates
 * the dedicated Element Call room from `roomId` (with a `restricted` join
 * rule that admits exactly that room's members) and sends the invite back
 * into `roomId`. `FloatingCallWidget` then reads the room off the
 * CallManager, never off the active session. Nothing here is specific to the
 * conversation on screen.
 *
 * The order of the steps matters and is the reason this is shared rather
 * than re-typed: `getUserMedia` has to run inside the click handler so mobile
 * Safari keeps the user gesture alive, and the stream is released again right
 * away because Element Call acquires its own.
 */
import { stopMediaStreamTracks } from '../../utils/callMediaStreamCleanup';

export interface StartRoomCallOptions {
	/** Matrix room the call belongs to (client room, group room or side room). */
	roomId: string | null | undefined;
	isVideo: boolean;
	/**
	 * `true` forces the MatrixRTC group path, `false` forces 1:1,
	 * `undefined` lets the CallManager count the room's members.
	 */
	isGroup?: boolean;
	/** Injected so tests and stories never touch `window.alert`. */
	notify?: (message: string) => void;
	confirm?: (message: string) => boolean;
	/**
	 * The seam that makes "which room does this call go to" testable without
	 * loading matrix-js-sdk's webrtc stack. Production keeps the original
	 * lazy `require`.
	 */
	getCallManager?: () => {
		startCall: (
			roomId: string,
			isVideo: boolean,
			isGroup?: boolean
		) => void;
	};
}

// Loaded on demand, as in the original handler: the CallManager pulls in
// matrix-js-sdk's webrtc stack, which nothing else on a chat screen needs
// until somebody actually places a call.
const lazyCallManager = () =>
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	require('../../services/CallManager').callManager;

const mediaErrorMessage = (error: any): string => {
	let message = 'Cannot access camera/microphone. ';
	if (error?.name === 'NotAllowedError') {
		message += 'Please grant permissions in your browser settings.';
	} else if (error?.name === 'NotFoundError') {
		message += 'No camera/microphone found on this device.';
	} else if (error?.name === 'NotSupportedError') {
		message +=
			'Your browser does not support this feature. Please use HTTPS.';
	} else {
		message += error?.message || 'Unknown error.';
	}
	return message;
};

export const startRoomCall = async ({
	roomId,
	isVideo,
	isGroup,
	notify = (message: string) => window.alert(message),
	confirm = (message: string) => window.confirm(message),
	getCallManager = lazyCallManager
}: StartRoomCallOptions): Promise<void> => {
	try {
		if (!roomId) {
			notify('Cannot start call: No Matrix room found for this session');
			return;
		}

		// 🍎 Safari iOS needs HTTPS for getUserMedia.
		if (window.location.protocol !== 'https:') {
			const httpsUrl = window.location.href.replace(
				'http://',
				'https://'
			);
			if (
				confirm(
					'Camera/microphone access requires HTTPS. Redirect to secure connection?'
				)
			) {
				window.location.href = httpsUrl;
			}
			return;
		}

		// Request the permissions synchronously with the click so mobile
		// browsers keep the user gesture, then release the device again:
		// the outgoing call runs through Element Call, which opens its own.
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: isVideo,
				audio: true
			});
			stopMediaStreamTracks(stream);
		} catch (mediaError: any) {
			notify(mediaErrorMessage(mediaError));
			return;
		}

		getCallManager().startCall(roomId, isVideo, isGroup);
	} catch (error) {
		notify(
			`Call failed: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
};
