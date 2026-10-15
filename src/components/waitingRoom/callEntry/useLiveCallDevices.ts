import { useEffect, useState } from 'react';
import {
	CallDevice,
	CallDevices,
	CallEntryBlocker,
	CallModality
} from './callEntryTypes';

export interface LiveCallDevices {
	devices: CallDevices;
	stream: MediaStream | null;
	micLevel: number;
	blocker?: CallEntryBlocker;
}

const EMPTY: CallDevices = { camera: [], microphone: [], speaker: [] };

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

/**
 * The real devices for the call entry prototype: one `getUserMedia`, the
 * device list it unlocks, and the microphone level from an analyser. Only
 * the live Storybook story uses it so far (#1386).
 */
export const useLiveCallDevices = (modality: CallModality): LiveCallDevices => {
	const [state, setState] = useState<LiveCallDevices>({
		devices: EMPTY,
		stream: null,
		micLevel: 0
	});

	useEffect(() => {
		let stream: MediaStream | null = null;
		let context: AudioContext | null = null;
		let frame = 0;
		let cancelled = false;

		const start = async () => {
			if (!navigator.mediaDevices?.getUserMedia) {
				setState((s) => ({ ...s, blocker: 'noDevice' }));
				return;
			}
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
					video: modality === 'video'
				});
			} catch (error) {
				const name = (error as DOMException)?.name;
				setState((s) => ({
					...s,
					blocker:
						name === 'NotFoundError' ||
						name === 'OverconstrainedError'
							? 'noDevice'
							: 'permissionDenied'
				}));
				return;
			}
			if (cancelled) {
				stream.getTracks().forEach((track) => track.stop());
				return;
			}
			const devices = toDevices(
				await navigator.mediaDevices.enumerateDevices()
			);
			context = new AudioContext();
			const analyser = context.createAnalyser();
			analyser.fftSize = 512;
			context.createMediaStreamSource(stream).connect(analyser);
			const samples = new Uint8Array(analyser.fftSize);
			const tick = () => {
				analyser.getByteTimeDomainData(samples);
				let peak = 0;
				for (const sample of samples) {
					peak = Math.max(peak, Math.abs(sample - 128) / 128);
				}
				// Speech peaks sit around 0.1–0.4; stretch so a voice fills the meter.
				const micLevel = Math.min(1, peak * 2.5);
				setState({ devices, stream, micLevel });
				frame = requestAnimationFrame(tick);
			};
			tick();
		};
		void start();

		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
			stream?.getTracks().forEach((track) => track.stop());
			void context?.close();
		};
	}, [modality]);

	return state;
};
