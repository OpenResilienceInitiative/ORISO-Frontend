import { useEffect, useMemo } from 'react';

/**
 * Storybook needs audio that really plays and really seeks, so each story
 * builds a silent 8 kHz WAV of the requested length in memory. Nothing is
 * fetched and nothing ships — this helper lives in the story file only.
 */
export const createSilentWavUrl = (seconds: number): string => {
	const sampleRate = 8000;
	const sampleCount = Math.max(1, Math.round(seconds * sampleRate));
	const buffer = new ArrayBuffer(44 + sampleCount);
	const view = new DataView(buffer);
	const writeAscii = (offset: number, text: string) => {
		for (let i = 0; i < text.length; i++) {
			view.setUint8(offset + i, text.charCodeAt(i));
		}
	};

	writeAscii(0, 'RIFF');
	view.setUint32(4, 36 + sampleCount, true);
	writeAscii(8, 'WAVE');
	writeAscii(12, 'fmt ');
	view.setUint32(16, 16, true); // PCM chunk size
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, 1, true); // mono
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate, true); // byte rate
	view.setUint16(32, 1, true); // block align
	view.setUint16(34, 8, true); // bits per sample
	writeAscii(36, 'data');
	view.setUint32(40, sampleCount, true);
	// 128 is silence for unsigned 8-bit PCM.
	new Uint8Array(buffer, 44).fill(128);

	return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
};

export const useSilentAudio = (seconds: number) => {
	const url = useMemo(() => createSilentWavUrl(seconds), [seconds]);
	useEffect(() => () => URL.revokeObjectURL(url), [url]);
	return url;
};
