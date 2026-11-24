import { useEffect, useState } from 'react';

/** Below this the microphone counts as silent (dBFS). */
const FLOOR_DB = -55;
/** At or above this a dot is fully grown (dBFS). */
const CEILING_DB = -12;

/**
 * Loudness of one analyser frame (unsigned 8-bit time-domain samples) as 0…1
 * on a decibel scale, so normal speech fills the range instead of only
 * shouting.
 */
export const levelFromSamples = (samples: ArrayLike<number>): number => {
	if (!samples.length) {
		return 0;
	}
	let sum = 0;
	for (let index = 0; index < samples.length; index += 1) {
		const value = (samples[index] - 128) / 128;
		sum += value * value;
	}
	const rms = Math.sqrt(sum / samples.length);
	if (rms <= 0) {
		return 0;
	}
	const db = 20 * Math.log10(rms);
	return Math.min(1, Math.max(0, (db - FLOOR_DB) / (CEILING_DB - FLOOR_DB)));
};

/** Newest level enters on the right; the oldest drops off the left. */
export const pushLevel = (
	levels: readonly number[],
	level: number
): number[] => [...levels.slice(1), level];

const restingRow = (count: number) => Array<number>(count).fill(0);

type AudioContextConstructor = new () => AudioContext;

const audioContextConstructor = (): AudioContextConstructor | undefined =>
	typeof window === 'undefined'
		? undefined
		: window.AudioContext ||
			(
				window as unknown as {
					webkitAudioContext?: AudioContextConstructor;
				}
			).webkitAudioContext;

const prefersReducedMotion = () =>
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The last `count` loudness levels of a live microphone stream, 0…1 each.
 *
 * Owns the whole audio graph: one AudioContext per stream, closed again when
 * the stream changes, `enabled` turns false or the caller unmounts, so a
 * recorder never leaves an audio context (or the microphone indicator)
 * behind. Without a stream or Web Audio the row stays at rest (all 0).
 */
export const useVoiceLevels = (
	stream: MediaStream | null | undefined,
	count: number,
	enabled = true
): number[] => {
	const [levels, setLevels] = useState(() => restingRow(count));

	useEffect(() => {
		setLevels((current) =>
			current.length === count && current.every((level) => level === 0)
				? current
				: restingRow(count)
		);
		const Context = audioContextConstructor();
		if (!enabled || !stream || !Context) {
			return undefined;
		}

		let context: AudioContext;
		let source: MediaStreamAudioSourceNode;
		let analyser: AnalyserNode;
		try {
			context = new Context();
			source = context.createMediaStreamSource(stream);
			analyser = context.createAnalyser();
			analyser.fftSize = 512;
			source.connect(analyser);
			// Opened after the permission prompt, i.e. outside the click:
			// Safari/iOS and Chrome's autoplay policy start it suspended,
			// and a suspended analyser only ever reads silence.
			if (context.state === 'suspended') {
				context.resume().catch(() => undefined);
			}
		} catch {
			return undefined;
		}

		const samples = new Uint8Array(analyser.fftSize);
		// Fewer, calmer updates when the person asked for less motion.
		const intervalMs = prefersReducedMotion() ? 250 : 80;
		const timer = window.setInterval(() => {
			analyser.getByteTimeDomainData(samples);
			const level = levelFromSamples(samples);
			setLevels((current) => pushLevel(current, level));
		}, intervalMs);

		return () => {
			window.clearInterval(timer);
			try {
				source.disconnect();
			} catch {
				// Already disconnected.
			}
			if (context.state !== 'closed') {
				context.close().catch(() => undefined);
			}
		};
	}, [stream, count, enabled]);

	return levels;
};
