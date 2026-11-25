/**
 * The one recording format and file name for every voice note ORISO records
 * (composer, selection reply). The receiving side reads the length from the
 * name (`voice-message-<time>-s<sec>-ms<ms>.<ext>`, see
 * `utils/voiceMessageFileName`), so all recorders must name takes alike.
 */

export const VOICE_MIME_CANDIDATES = [
	'audio/webm;codecs=opus',
	'audio/ogg;codecs=opus',
	'audio/webm'
] as const;

/** The first format this browser's MediaRecorder supports, if any. */
export const pickVoiceMimeType = (): string | undefined =>
	typeof MediaRecorder === 'undefined'
		? undefined
		: VOICE_MIME_CANDIDATES.find((candidate) =>
				MediaRecorder.isTypeSupported(candidate)
			);

/** iOS Safari records audio/mp4; name it to match. */
export const voiceFileExtension = (mimeType: string): string =>
	mimeType.includes('ogg')
		? 'ogg'
		: mimeType.includes('mp4')
			? 'm4a'
			: 'webm';

/**
 * Wraps a finished take in the file that gets uploaded. Anything shorter than
 * a second counts as one second, so sender and receiver show the same length.
 */
export const createVoiceFile = (
	blob: Blob,
	mimeType: string,
	elapsedMs: number,
	now: number = Date.now()
): { file: File; durationSec: number } => {
	const ms = Math.max(1000, Math.round(elapsedMs));
	const durationSec = Math.max(1, Math.round(ms / 1000));
	const file = new File(
		[blob],
		`voice-message-${now}-s${durationSec}-ms${ms}.${voiceFileExtension(mimeType)}`,
		{ type: mimeType, lastModified: now }
	);
	return { file, durationSec };
};
