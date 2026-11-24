import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { SelectionVoiceRecorder } from './SelectionReplyLayer';
import {
	createVoiceFile,
	pickVoiceMimeType
} from '../voicePlayer/voiceRecordingFile';

/** A recorded answer: what plays in the field and what gets uploaded. */
export interface SelectionVoiceTake {
	src: string;
	durationSec: number;
	file: File;
}

/** Whether this browser can record at all (microphone + MediaRecorder). */
export const canRecordVoice = () =>
	typeof window !== 'undefined' &&
	Boolean(navigator.mediaDevices?.getUserMedia) &&
	typeof MediaRecorder !== 'undefined';

/**
 * The microphone behind the selection reply's answer field, in the real
 * chat. Same recording format and file name as the composer's voice note
 * (`voice-message-<time>-s<sec>-ms<ms>.<ext>`), so the receiving side shows
 * the same length. `takeFor(src)` hands the recorded file to the send; the
 * takes' object URLs are released with `release` or on unmount.
 */
export const useSelectionVoiceRecorder = (): {
	recorder: SelectionVoiceRecorder | undefined;
	takeFor: (src: string) => SelectionVoiceTake | undefined;
	release: (src: string) => void;
} => {
	const takesRef = useRef(new Map<string, SelectionVoiceTake>());
	const activeRef = useRef<{
		recorder: MediaRecorder;
		stream: MediaStream;
		chunks: BlobPart[];
		startedAt: number;
	} | null>(null);
	// Bumped by every start and cancel: a microphone that opens after a
	// newer start, a cancel or unmount is closed again at once.
	const generationRef = useRef(0);

	const stopStream = (stream: MediaStream) =>
		stream.getTracks().forEach((track) => track.stop());

	const cancel = useCallback(() => {
		generationRef.current += 1;
		const active = activeRef.current;
		activeRef.current = null;
		if (!active) {
			return;
		}
		active.recorder.ondataavailable = null;
		active.recorder.onstop = null;
		if (active.recorder.state !== 'inactive') {
			active.recorder.stop();
		}
		stopStream(active.stream);
	}, []);

	const release = useCallback((src: string) => {
		if (takesRef.current.delete(src)) {
			URL.revokeObjectURL(src);
		}
	}, []);

	useEffect(() => {
		const takes = takesRef.current;
		return () => {
			cancel();
			takes.forEach((_, src) => URL.revokeObjectURL(src));
			takes.clear();
		};
	}, [cancel]);

	const recorder = useMemo<SelectionVoiceRecorder | undefined>(() => {
		if (!canRecordVoice()) {
			return undefined;
		}
		return {
			start: async () => {
				cancel();
				const generation = generationRef.current;
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true
				});
				if (generation !== generationRef.current) {
					// Cancelled (or unmounted) while the permission prompt
					// was open: do not keep the microphone on.
					stopStream(stream);
					throw new Error('Recording cancelled');
				}
				const mimeType = pickVoiceMimeType();
				const mediaRecorder = mimeType
					? new MediaRecorder(stream, { mimeType })
					: new MediaRecorder(stream);
				const chunks: BlobPart[] = [];
				mediaRecorder.ondataavailable = (event: BlobEvent) => {
					if (event.data?.size) {
						chunks.push(event.data);
					}
				};
				activeRef.current = {
					recorder: mediaRecorder,
					stream,
					chunks,
					startedAt: Date.now()
				};
				mediaRecorder.start();
				return stream;
			},
			stop: () =>
				new Promise((resolve, reject) => {
					const active = activeRef.current;
					if (!active) {
						reject(new Error('Not recording'));
						return;
					}
					active.recorder.onstop = () => {
						activeRef.current = null;
						stopStream(active.stream);
						const type = active.recorder.mimeType || 'audio/webm';
						const blob = new Blob(active.chunks, { type });
						if (!blob.size) {
							reject(new Error('Empty recording'));
							return;
						}
						const { file, durationSec } = createVoiceFile(
							blob,
							type,
							Date.now() - active.startedAt
						);
						const src = URL.createObjectURL(blob);
						takesRef.current.set(src, { src, durationSec, file });
						resolve({ src, durationSec });
					};
					active.recorder.stop();
				}),
			cancel
		};
	}, [cancel]);

	const takeFor = useCallback((src: string) => takesRef.current.get(src), []);

	return { recorder, takeFor, release };
};
