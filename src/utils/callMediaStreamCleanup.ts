/**
 * Helpers for releasing temporary call-related MediaStreams held on `window`.
 *
 * Session UI warm-up uses getUserMedia inside the click handler (mobile Safari
 * user-gesture). Outgoing calls then go through Element Call in an iframe,
 * which acquires its own media — the warm-up stream must be stopped or the
 * device stays captured and later joins fail with NotReadableError.
 */

export type WindowMediaStreamKey =
	| '__preRequestedMediaStream'
	| '__activeMediaStream';

type WindowWithCallStreams = Window & {
	__preRequestedMediaStream?: MediaStream;
	__preRequestedMediaStreamTime?: number;
	__activeMediaStream?: MediaStream;
};

function getCallWindow(): WindowWithCallStreams | null {
	if (typeof window === 'undefined') {
		return null;
	}
	return window as WindowWithCallStreams;
}

/** Stop every track on a stream; ignore failures from already-ended tracks. */
export function stopMediaStreamTracks(
	stream: MediaStream | null | undefined
): void {
	if (!stream) {
		return;
	}
	try {
		stream.getTracks().forEach((track) => {
			try {
				track.stop();
			} catch {
				// ignore
			}
		});
	} catch {
		// ignore
	}
}

/**
 * Stop tracks for a window-held stream and remove the global reference.
 * Also clears `__preRequestedMediaStreamTime` when clearing the pre-request key.
 */
export function releaseWindowMediaStream(key: WindowMediaStreamKey): void {
	const win = getCallWindow();
	if (!win) {
		return;
	}
	stopMediaStreamTracks(win[key]);
	delete win[key];
	if (key === '__preRequestedMediaStream') {
		delete win.__preRequestedMediaStreamTime;
	}
}

/** Release both warm-up and active window streams used by call widgets. */
export function releaseAllCallWarmupStreams(): void {
	releaseWindowMediaStream('__preRequestedMediaStream');
	releaseWindowMediaStream('__activeMediaStream');
}
