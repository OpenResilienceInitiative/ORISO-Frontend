import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { SelectionVoiceRecorder } from './SelectionReplyLayer';

/** A recorded answer: what plays in the field and what gets uploaded. */
export interface SelectionVoiceTake {
	src: string;
	durationSec: number;
	file: File;
}

const MIME_CANDIDATES = [
	'audio/webm;codecs=opus',
	'audio/ogg;codecs=opus',
	'audio/webm'
];

const extensionFor = (mimeType: string) =>
	mimeType.includes('ogg')
		? 'ogg'
		: mimeType.includes('mp4')
			? 'm4a'
			: 'webm';

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
	const rejectStoppingRef = useRef<((reason: Error) => void) | null>(null);
	const stoppingRef = useRef<Promise<{
		src: string;
		durationSec: number;
	}> | null>(null);
	const takesRef = useRef(new Map<string, SelectionVoiceTake>());
	const activeRef = useRef<{
		recorder: MediaRecorder;
		stream: MediaStream;
		chunks: BlobPart[];
		startedAt: number;
		/** FE#2494: time spent paused does not count as recorded. */
		pausedMs: number;
		pausedAt: number | null;
	} | null>(null);

	const stopStream = (stream: MediaStream) =>
		stream.getTracks().forEach((track) => track.stop());

	const cancel = useCallback(() => {
		// A stop still waiting for the recorder's last event never gets it
		// now: settle it, so the next take stops on its own.
		const rejectStopping = rejectStoppingRef.current;
		rejectStoppingRef.current = null;
		stoppingRef.current = null;
		rejectStopping?.(new Error('Recording cancelled'));
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
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true
				});
				const mimeType = MIME_CANDIDATES.find((candidate) =>
					MediaRecorder.isTypeSupported(candidate)
				);
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
					startedAt: Date.now(),
					pausedMs: 0,
					pausedAt: null
				};
				mediaRecorder.start();
			},
			stop: () => {
				// Several callers may ask while the recorder still flushes
				// its last chunk: all get the same take.
				if (stoppingRef.current) {
					return stoppingRef.current;
				}
				const stopping = new Promise<{
					src: string;
					durationSec: number;
				}>((resolve, reject) => {
					rejectStoppingRef.current = reject;
					const active = activeRef.current;
					if (!active) {
						reject(new Error('Not recording'));
						return;
					}
					const finish = () => {
						activeRef.current = null;
						stopStream(active.stream);
						const type = active.recorder.mimeType || 'audio/webm';
						const blob = new Blob(active.chunks, { type });
						if (!blob.size) {
							reject(new Error('Empty recording'));
							return;
						}
						const pausedMs =
							active.pausedMs +
							(active.pausedAt
								? Date.now() - active.pausedAt
								: 0);
						const elapsedMs = Math.max(
							1000,
							Date.now() - active.startedAt - pausedMs
						);
						const durationSec = Math.max(
							1,
							Math.round(elapsedMs / 1000)
						);
						const file = new File(
							[blob],
							`voice-message-${Date.now()}-s${durationSec}-ms${elapsedMs}.${extensionFor(type)}`,
							{ type, lastModified: Date.now() }
						);
						const src = URL.createObjectURL(blob);
						takesRef.current.set(src, { src, durationSec, file });
						resolve({ src, durationSec });
					};
					// The browser may have ended the take by itself (the
					// microphone track ended, e.g. while paused); stop() on an
					// inactive recorder fires no second `stop` event, so
					// finish with the chunks it already delivered.
					if (active.recorder.state === 'inactive') {
						finish();
						return;
					}
					active.recorder.onstop = finish;
					active.recorder.stop();
				});
				stoppingRef.current = stopping;
				const clear = () => {
					if (stoppingRef.current === stopping) {
						stoppingRef.current = null;
						rejectStoppingRef.current = null;
					}
				};
				stopping.then(clear, clear);
				return stopping;
			},
			// FE#2494 (Frank, 24 Nov): Pause instead of Stop; stacking or
			// sending stops the take cleanly first.
			pause: () => {
				const active = activeRef.current;
				if (active && active.recorder.state === 'recording') {
					active.recorder.pause();
					active.pausedAt = Date.now();
				}
			},
			resume: () => {
				const active = activeRef.current;
				if (active && active.recorder.state === 'paused') {
					active.recorder.resume();
					if (active.pausedAt) {
						active.pausedMs += Date.now() - active.pausedAt;
					}
					active.pausedAt = null;
				}
			},
			cancel
		};
	}, [cancel]);

	const takeFor = useCallback((src: string) => takesRef.current.get(src), []);

	return { recorder, takeFor, release };
};
