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
	/** No webcam: the check runs with the microphone, the camera stays off. */
	cameraMissing: boolean;
	/** Ask the browser again ("Erneut prüfen"). */
	retry: () => void;
}

type LiveState = Omit<LiveCallDevices, 'retry'>;

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
		const release = () => {
			stream?.getTracks().forEach((track) => track.stop());
		};

		const acquire = async () => {
			const audio = constraintFor(microphoneId);
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
						video: constraintFor(cameraId)
					}),
					cameraMissing: false
				};
			} catch (error) {
				// No webcam must not stop a person who can be heard.
				if (!isMissing(error)) throw error;
				return {
					stream: await mediaDevices!.getUserMedia({
						audio,
						video: false
					}),
					cameraMissing: true
				};
			}
		};

		const start = async () => {
			if (!mediaDevices?.getUserMedia) {
				setState((s) => ({ ...s, blocker: 'noDevice' }));
				return;
			}
			let cameraMissing: boolean;
			try {
				({ stream, cameraMissing } = await acquire());
			} catch (error) {
				if (cancelled) return;
				setState((s) => ({
					...s,
					blocker: isMissing(error) ? 'noDevice' : 'permissionDenied'
				}));
				return;
			}
			if (cancelled) {
				release();
				return;
			}
			const devices = toDevices(await mediaDevices.enumerateDevices());
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
			const tick = () => {
				analyser.getByteTimeDomainData(samples);
				let peak = 0;
				for (const sample of samples) {
					peak = Math.max(peak, Math.abs(sample - 128) / 128);
				}
				// Speech peaks sit around 0.1–0.4; stretch so a voice fills the meter.
				const micLevel = Math.min(1, peak * 2.5);
				setState({ devices, stream: live, micLevel, cameraMissing });
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
