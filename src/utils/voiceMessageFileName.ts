/**
 * ORISO's recorder sends a plain `m.audio` and writes the length into the file
 * name (`voice-message-<time>-s<sec>-ms<ms>.<ext>`), not into `info.duration`.
 */
const EXTENSION = '\\.(webm|ogg|mp3|wav)$';
const VOICE_FILE = new RegExp(`^voice-message-.*${EXTENSION}`, 'i');
const SECONDS = new RegExp(`-s(\\d+)-ms\\d+${EXTENSION}`, 'i');
const MILLISECONDS = new RegExp(`-ms(\\d+)${EXTENSION}`, 'i');
const LEGACY_SECONDS = new RegExp(`-d(\\d+)${EXTENSION}`, 'i');

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
