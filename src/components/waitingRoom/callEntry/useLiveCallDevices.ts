import { useCallback, useEffect, useState } from 'react';
import {
	CallDevice,
	CallDeviceControls,
	CallDevices,
	CallEntryBlocker,
	CallModality
} from './callEntryTypes';

/** What the person has chosen in the room; the hook applies it to the stream. */
export type LiveCallControls = CallDeviceControls;

export interface LiveCallDevices {
	devices: CallDevices;
	stream: MediaStream | null;
	micLevel: number;
	blocker?: CallEntryBlocker;
	/**
	 * No usable webcam (none, denied or busy): the check runs with the
	 * microphone, the camera stays off.
	 */
	cameraMissing: boolean;
	/** Ask the browser again ("Erneut prüfen"). */
	retry: () => void;
}

type LiveState = Omit<LiveCallDevices, 'retry'>;

/** The meter's resolution; smaller changes do not re-render. */
const LEVEL_STEP = 0.02;

const EMPTY: CallDevices = { camera: [], microphone: [], speaker: [] };

const DEFAULT_CONTROLS: LiveCallControls = {
	micOn: true,
	cameraOn: true,
	selection: {}
};

const toDevices = (list: MediaDeviceInfo[]): CallDevices => {
	const pick = (kind: MediaDeviceKind): CallDevice[] =>
		list
			.filter((device) => device.kind === kind)
			.map((device, index) => ({
				id: device.deviceId,
				label: device.label || `${index + 1}`
			}));
	return {
		camera: pick('videoinput'),
		microphone: pick('audioinput'),
		speaker: pick('audiooutput')
	};
};

/** The device is not there (or the chosen one is gone). */
const isMissing = (error: unknown) => {
	const name = (error as DOMException)?.name;
	return name === 'NotFoundError' || name === 'OverconstrainedError';
};

/** Another program holds the device, or the hardware failed to start. */
const isBusy = (error: unknown) => {
	const name = (error as DOMException)?.name;
	return (
		name === 'NotReadableError' ||
		name === 'AbortError' ||
		name === 'TrackStartError'
	);
};

const blockerFor = (error: unknown): CallEntryBlocker =>
	isMissing(error)
		? 'noDevice'
		: isBusy(error)
			? 'deviceBusy'
			: 'permissionDenied';

const constraintFor = (deviceId?: string): MediaTrackConstraints | true =>
	deviceId ? { deviceId: { exact: deviceId } } : true;

/**
 * The real devices for the call entry prototype: one `getUserMedia`, the
 * device list it unlocks, and the microphone level from an analyser. The
 * switches and the picker reach the stream through `controls`. Only the live
 * Storybook stories use it so far (#1386).
 */
export const useLiveCallDevices = (
	modality: CallModality,
	controls: LiveCallControls = DEFAULT_CONTROLS,
	mediaDevices: MediaDevices | undefined = navigator.mediaDevices
): LiveCallDevices => {
	const [state, setState] = useState<LiveState>({
		devices: EMPTY,
		stream: null,
		micLevel: 0,
		cameraMissing: false
	});
	const [attempt, setAttempt] = useState(0);
	const retry = useCallback(() => setAttempt((count) => count + 1), []);
	const { micOn, cameraOn, selection } = controls;
	const microphoneId = selection.microphone;
	const cameraId = selection.camera;

	useEffect(() => {
		let stream: MediaStream | null = null;
		let context: AudioContext | null = null;
		let frame = 0;
		let cancelled = false;
		// The old tracks stop now; until the new ones arrive there is no
		// stream, so nothing (the gate included) leans on a stopped one.
		setState((s) => (s.stream ? { ...s, stream: null, micLevel: 0 } : s));
		const release = () => {
			stream?.getTracks().forEach((track) => track.stop());
		};

		const acquire = async (
			micId?: string,
			camId?: string
		): Promise<{ stream: MediaStream; cameraMissing: boolean }> => {
			const audio = constraintFor(micId);
			if (modality === 'audio') {
				return {
					stream: await mediaDevices!.getUserMedia({
						audio,
						video: false
					}),
					cameraMissing: false
				};
			}
			try {
				return {
					stream: await mediaDevices!.getUserMedia({
						audio,
						video: constraintFor(camId)
					}),
					cameraMissing: false
				};
			} catch (error) {
				// The chosen camera may be unplugged: any camera first.
				if (camId && isMissing(error)) return acquire(micId, undefined);
				// The camera is optional: no webcam, a denied or busy camera
				// must not stop a person who can be heard. The microphone's
				// own answer decides the blocker.
				return {
					stream: await mediaDevices!.getUserMedia({
						audio,
						video: false
					}),
					cameraMissing: true
				};
			}
		};

		// The chosen microphone may be unplugged: any microphone rather than a
		// "no device" blocker that a retry would only repeat.
		const acquireAny = async () => {
			try {
				return await acquire(microphoneId, cameraId);
			} catch (error) {
				if (microphoneId && isMissing(error)) {
					return acquire(undefined, cameraId);
				}
				throw error;
			}
		};

		const start = async () => {
			if (!mediaDevices?.getUserMedia) {
				setState((s) => ({ ...s, blocker: 'noDevice' }));
				return;
			}
			let cameraMissing: boolean;
			try {
				({ stream, cameraMissing } = await acquireAny());
			} catch (error) {
				if (cancelled) return;
				setState((s) => ({
					...s,
					blocker: blockerFor(error)
				}));
				return;
			}
			if (cancelled) {
				release();
				return;
			}
			// The list only fills the pickers; the check runs without it.
			const devices = await mediaDevices
				.enumerateDevices()
				.then(toDevices, () => EMPTY);
			if (cancelled) {
				release();
				return;
			}
			context = new AudioContext();
			const analyser = context.createAnalyser();
			analyser.fftSize = 512;
			context.createMediaStreamSource(stream).connect(analyser);
			const samples = new Uint8Array(analyser.fftSize);
			const live = stream;
			// An unplugged microphone ends its track and the meter falls
			// silent. Ask again: another microphone or the blocker, never a
			// gate that stays open on a dead one.
			live.getAudioTracks().forEach((track) =>
				track.addEventListener('ended', () => {
					if (cancelled) return;
					cancelAnimationFrame(frame);
					setState((s) => ({ ...s, stream: null, micLevel: 0 }));
					setAttempt((count) => count + 1);
				})
			);
			// An unplugged or revoked webcam: the room shows the animal and
			// the camera as unavailable; the microphone keeps running, so the
			// person need not speak again. Choosing a camera asks anew.
			live.getVideoTracks().forEach((track) =>
				track.addEventListener('ended', () => {
					if (cancelled) return;
					cameraMissing = true;
					setState((s) => ({ ...s, cameraMissing: true }));
				})
			);
			const tick = () => {
				analyser.getByteTimeDomainData(samples);
				let peak = 0;
				for (const sample of samples) {
					peak = Math.max(peak, Math.abs(sample - 128) / 128);
				}
				// Speech peaks sit around 0.1–0.4; stretch so a voice fills the meter.
				const micLevel = Math.min(1, peak * 2.5);
				// A render per frame starves slow machines; only a visible
				// change of the meter is worth one.
				setState((s) =>
					s.stream === live &&
					s.devices === devices &&
					Math.abs(s.micLevel - micLevel) < LEVEL_STEP
						? s
						: { devices, stream: live, micLevel, cameraMissing }
				);
				frame = requestAnimationFrame(tick);
			};
			tick();
		};
		void start();

		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
			release();
			void context?.close();
		};
	}, [modality, microphoneId, cameraId, attempt, mediaDevices]);

	// No camera (never had one, or it was unplugged): a webcam plugged in
	// later is taken up, instead of a room stuck without video until reload.
	const { cameraMissing } = state;
	useEffect(() => {
		if (modality !== 'video' || !cameraMissing) return;
		if (!mediaDevices?.addEventListener) return;
		const onDeviceChange = () => {
			void mediaDevices.enumerateDevices().then(
				(list) => {
					if (list.some((device) => device.kind === 'videoinput')) {
						retry();
					}
				},
				() => undefined
			);
		};
		mediaDevices.addEventListener('devicechange', onDeviceChange);
		return () =>
			mediaDevices.removeEventListener('devicechange', onDeviceChange);
	}, [modality, cameraMissing, mediaDevices, retry]);

	// The switches mute the real tracks, not only the icon.
	useEffect(() => {
		state.stream?.getAudioTracks().forEach((track) => {
			track.enabled = micOn;
		});
		state.stream?.getVideoTracks().forEach((track) => {
			track.enabled = cameraOn;
		});
	}, [state.stream, micOn, cameraOn]);

	return { ...state, retry };
};
