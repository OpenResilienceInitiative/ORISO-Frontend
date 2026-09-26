/**
 * ORISO's recorder sends a plain `m.audio` and writes the length into the file
 * name (`voice-message-<time>-s<sec>-ms<ms>.<ext>`), not into `info.duration`.
 */
// Recorder names only: timestamp, then a length (current -s-ms, legacy -ms, -s or -d).
const VOICE_FILE =
	/^voice-message-\d+-(?:s\d+-ms\d+|ms\d+|s\d+|d\d+)\.(?:webm|ogg|mp3|wav)$/i;
const SECONDS = /-s(\d+)-ms\d+\.(?:webm|ogg|mp3|wav)$/i;
const MILLISECONDS = /-ms(\d+)\.(?:webm|ogg|mp3|wav)$/i;
const LEGACY_SECONDS = /-d(\d+)\.(?:webm|ogg|mp3|wav)$/i;

export const isVoiceMessageFileName = (name: string): boolean =>
	VOICE_FILE.test(name);

/** Whole seconds first, so sender and receiver show the same length. */
export const voiceDurationMsFromFileName = (name: string): number | null => {
	const seconds = Number(name.match(SECONDS)?.[1]);
	if (seconds > 0) return seconds * 1000;
	const milliseconds = Number(name.match(MILLISECONDS)?.[1]);
	if (milliseconds > 0) return milliseconds;
	const legacy = name.match(LEGACY_SECONDS)?.[1];
	return legacy === undefined ? null : Number(legacy) * 1000;
};
