/*
 * FE#2545 D3: Carimat's voice in the practice call. The browser's own speech
 * synthesis, but ONLY with a voice that runs on this device
 * (`localService === true`). Network voices (Chrome's "Google …" voices and
 * the like) send the text to a server, so they are never chosen; without a
 * local voice for the page language the generated murmur speaks instead.
 */

/** A robot should sound like one: lower and a little slower. */
export const ROBOT_PITCH = 0.6;
export const ROBOT_RATE = 0.9;

/** How long to wait for the voice list before falling back to the murmur. */
export const VOICES_TIMEOUT_MS = 1500;

// The voice choice is shared (also used outside practice): only local,
// non-novelty voices of the app language.
export { pickLocalVoice, voiceLanguageOf } from '../utils/localSpeechVoice';

export const speechSynthesisOf = (): SpeechSynthesis | null =>
	typeof window !== 'undefined' &&
	Boolean(window.speechSynthesis) &&
	typeof window.SpeechSynthesisUtterance === 'function'
		? window.speechSynthesis
		: null;

/**
 * The voice list. Chrome fills it asynchronously: an empty first answer
 * waits for `voiceschanged`, at most `timeoutMs`, then takes what is there.
 */
export const loadVoices = (
	synth: SpeechSynthesis,
	timeoutMs = VOICES_TIMEOUT_MS
): Promise<SpeechSynthesisVoice[]> => {
	const now = synth.getVoices();
	if (now.length > 0) return Promise.resolve(now);
	return new Promise((resolve) => {
		const done = () => {
			window.clearTimeout(timer);
			synth.removeEventListener?.('voiceschanged', done);
			resolve(synth.getVoices());
		};
		const timer = window.setTimeout(done, timeoutMs);
		synth.addEventListener?.('voiceschanged', done);
	});
};

export interface SpokenLine {
	onStart: () => void;
	onBoundary: () => void;
	onEnd: () => void;
	/** The voice failed (not our own cancel): `error` as the browser names it. */
	onError: (error: string) => void;
}

/** Errors of our own making: cancel() on mute or leave. */
const OWN_ERRORS = ['interrupted', 'canceled'];

/**
 * The only place that calls `speechSynthesis.speak`. Refuses (returns false)
 * for anything but a local voice, so no code path can hand text to a
 * network voice.
 */
export const speakLocally = (
	synth: SpeechSynthesis,
	voice: SpeechSynthesisVoice | null,
	text: string,
	events: SpokenLine
): boolean => {
	if (!voice || voice.localService !== true) return false;
	const utterance = new window.SpeechSynthesisUtterance(text);
	utterance.voice = voice;
	utterance.lang = voice.lang;
	utterance.pitch = ROBOT_PITCH;
	utterance.rate = ROBOT_RATE;
	utterance.onstart = events.onStart;
	utterance.onboundary = events.onBoundary;
	utterance.onend = events.onEnd;
	utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
		const error = event?.error ?? 'unknown';
		if (OWN_ERRORS.includes(error)) events.onEnd();
		else events.onError(error);
	};
	synth.speak(utterance);
	return true;
};

/**
 * The ring's level while the voice speaks: speech synthesis has no analyser,
 * so a pulse, kicked up at every word boundary.
 */
export const speechPulse = (now: number, lastBoundary: number): number => {
	const wave = 0.35 + 0.25 * Math.abs(Math.sin(now / 110));
	const kick = Math.max(0, 0.4 - (now - lastBoundary) / 500);
	return Math.min(1, wave + kick);
};
