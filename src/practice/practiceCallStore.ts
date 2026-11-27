import { getPracticeSnapshot, subscribePractice } from './practiceMode';
import { emitPracticeEvent, PRACTICE_TOUR_EVENTS } from './practiceTourEvents';
import {
	createPracticeMurmur,
	murmurLine,
	type PracticeMurmur
} from './practiceCallMurmur';
import {
	loadVoices,
	pickLocalVoice,
	speakLocally,
	speechPulse,
	speechSynthesisOf
} from './practiceCallVoice';

/*
 * FE#2545 D3 (revised): the practice video call. While practising, the
 * waiting room's "Video-Call starten" and the circle's call button open this
 * stage instead of a call: the counsellor's own camera and microphone as a
 * local preview, and Carimat, the platform's robot, who greets her with the
 * browser's own speech synthesis, ONLY with a voice local to this device
 * (`practiceCallVoice.ts`), or else with a murmur generated in the page.
 * Nothing reaches the call manager, Element Call, LiveKit or Matrix. The
 * stage belongs to one practice run: leaving it, a restart or the end of
 * practice stops every track, cancels the speech and closes the audio.
 */

export type PracticeCallStatus = 'closed' | 'open' | 'minimised';
/** `denied` also covers "no camera or microphone": the initials stand in. */
export type PracticeCallMedia = 'idle' | 'pending' | 'granted' | 'denied';

export interface PracticeCallState {
	status: PracticeCallStatus;
	muted: boolean;
	cameraOff: boolean;
	media: PracticeCallMedia;
	/** When the stage opened, ms since the epoch. */
	startedAt: number;
	/** The line Carimat is saying now (the caption), or null. */
	captionIndex: number | null;
	/** Carimat is audibly speaking: drives the ring and the dock. */
	speaking: boolean;
	/** How Carimat speaks: a local voice, or the generated murmur. */
	voice: PracticeCallVoiceMode;
}

/** `pending` until the voice list answered. */
export type PracticeCallVoiceMode = 'pending' | 'speech' | 'murmur';

const CLOSED: PracticeCallState = {
	status: 'closed',
	muted: false,
	cameraOff: false,
	media: 'idle',
	startedAt: 0,
	captionIndex: null,
	speaking: false,
	voice: 'pending'
};

/** Carimat waits a moment before she greets, and between her lines. */
const FIRST_LINE_DELAY_MS = 700;
const LINE_PAUSE_MS = 1400;
const ROUND_PAUSE_MS = 7000;
/** A voice that has not started by then counts as failed. */
const SPEECH_START_TIMEOUT_MS = 2500;

let state: PracticeCallState = CLOSED;
let runId: number | null = null;
let audio: AudioContext | null = null;
let murmur: PracticeMurmur | null = null;
let stream: MediaStream | null = null;
/** Bumped on every teardown: a late getUserMedia answer is stopped at once. */
let generation = 0;
let timers: number[] = [];
let offPractice: (() => void) | null = null;
let lines: string[] = [];
let locale = 'de';
let synth: SpeechSynthesis | null = null;
let voice: SpeechSynthesisVoice | null = null;
let lastBoundary = 0;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const set = (next: Partial<PracticeCallState>) => {
	state = { ...state, ...next };
	notify();
};

const currentRunId = (): number | null => {
	const snapshot = getPracticeSnapshot();
	return snapshot.status === 'active' ? snapshot.session.runId : null;
};

export const subscribePracticeCall = (listener: () => void): (() => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export const getPracticeCallState = (): PracticeCallState => state;

/** The local preview, for the own tile; null without permission. */
export const getPracticeCallStream = (): MediaStream | null => stream;

/**
 * Carimat's current level, 0..1, for the speaking ring: the murmur's
 * analyser, or a pulse while the speech voice speaks (it has no analyser).
 * A context the browser keeps suspended (autoplay policy without a real
 * gesture) has a silent analyser: the pulse stands in, the caption stays.
 */
export const getPracticeCallLevel = (): number => {
	const pulse = () =>
		state.speaking ? speechPulse(Date.now(), lastBoundary) : 0;
	if (state.voice === 'speech') return pulse();
	if (murmur && audio?.state === 'running') return murmur.level();
	return pulse();
};

/** Carimat's lines and the page language; the layer sets them. */
export const setPracticeCallLines = (
	next: string[],
	language: string = locale
): void => {
	lines = next;
	locale = language;
};

/** Cancels whatever the speech synthesis is saying. */
const hush = () => {
	synth?.cancel();
	murmur?.silence();
};

const later = (ms: number, run: () => void) => {
	const id = window.setTimeout(() => {
		timers = timers.filter((t) => t !== id);
		run();
	}, ms);
	timers.push(id);
};

/** After a line: quiet, then the next one (a longer pause after the last). */
const afterLine = (index: number, asked: number) => {
	if (asked !== generation) return;
	set({ captionIndex: null, speaking: false });
	const next = (index + 1) % lines.length;
	later(next === 0 ? ROUND_PAUSE_MS : LINE_PAUSE_MS, () => speakLine(next));
};

const speakLine = (index: number) => {
	if (state.status === 'closed') return;
	if (lines.length === 0) {
		later(LINE_PAUSE_MS, () => speakLine(0));
		return;
	}
	const at = index % lines.length;
	const text = lines[at];
	const asked = generation;
	set({ captionIndex: at });
	if (!state.muted && state.voice === 'speech' && synth) {
		let started = false;
		let settled = false;
		// The voice failed or never started (e.g. a headless browser): the
		// murmur takes over for this line and the rest of the call.
		const fallBack = () => {
			if (settled || asked !== generation) return;
			settled = true;
			synth?.cancel();
			set({ voice: 'murmur', speaking: false });
			speakLine(at);
		};
		const spoken = speakLocally(synth, voice, text, {
			onStart: () => {
				started = true;
				if (asked === generation) set({ speaking: true });
			},
			onBoundary: () => {
				lastBoundary = Date.now();
			},
			onEnd: () => {
				if (settled) return;
				settled = true;
				afterLine(at, asked);
			},
			onError: fallBack
		});
		if (spoken) {
			later(SPEECH_START_TIMEOUT_MS, () => {
				if (!started) fallBack();
			});
			return;
		}
	}
	// The murmur, or a silent caption while muted: timed by the syllables.
	const seconds =
		(!state.muted && murmur?.speak(text)) || murmurLine(text).duration;
	set({ speaking: !state.muted });
	later(Math.round(seconds * 1000) + 150, () => afterLine(at, asked));
};

/** Picks the voice once the list is there; the first line waits for it. */
const chooseVoice = (asked: number): Promise<void> => {
	const available = speechSynthesisOf();
	if (!available) {
		set({ voice: 'murmur' });
		return Promise.resolve();
	}
	synth = available;
	return loadVoices(available).then((voices) => {
		if (asked !== generation) return;
		voice = pickLocalVoice(voices, locale);
		set({ voice: voice ? 'speech' : 'murmur' });
	});
};

const AudioContextClass = (): typeof AudioContext | undefined =>
	typeof window === 'undefined'
		? undefined
		: (window.AudioContext ??
			(window as unknown as { webkitAudioContext?: typeof AudioContext })
				.webkitAudioContext);

/** Every track stopped, the audio closed, all timers gone. */
const teardown = () => {
	generation += 1;
	synth?.cancel();
	synth = null;
	voice = null;
	timers.forEach((id) => window.clearTimeout(id));
	timers = [];
	stream?.getTracks().forEach((track) => track.stop());
	stream = null;
	murmur?.stop();
	murmur = null;
	if (audio && audio.state !== 'closed') void audio.close().catch(() => {});
	audio = null;
	offPractice?.();
	offPractice = null;
	runId = null;
};

/**
 * Opens the stage, or brings it back from the dock. Call it inside the
 * click: the AudioContext must start from a user gesture. Does nothing
 * outside practice.
 */
export const openPracticeCallStage = (): void => {
	const run = currentRunId();
	if (run === null) return;
	if (state.status !== 'closed' && runId === run) {
		if (state.status === 'minimised') set({ status: 'open' });
		return;
	}
	teardown();
	runId = run;
	offPractice = subscribePractice(() => {
		if (currentRunId() !== runId) leavePracticeCall();
	});
	const Context = AudioContextClass();
	if (Context) {
		try {
			audio = new Context();
			void audio.resume?.().catch(() => {});
			murmur = createPracticeMurmur(audio);
		} catch {
			audio = null;
			murmur = null;
		}
	}
	set({ ...CLOSED, status: 'open', startedAt: Date.now() });
	const asked = generation;
	const firstLine = new Promise<void>((resolve) =>
		later(FIRST_LINE_DELAY_MS, resolve)
	);
	void Promise.all([chooseVoice(asked), firstLine]).then(() => {
		if (asked === generation) speakLine(0);
	});
	// A macrotask later, like a click advance: the stage is on screen first.
	window.setTimeout(() => {
		if (currentRunId() === run) {
			emitPracticeEvent(PRACTICE_TOUR_EVENTS.circleCallStarted);
		}
	}, 0);
};

/**
 * Asks for camera and microphone once per stage; the stage calls it when it
 * appears. A refusal or a missing device leaves the initials tile.
 */
export const requestPracticeCallMedia = (): void => {
	if (state.status === 'closed' || state.media !== 'idle') return;
	const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(
		navigator.mediaDevices
	);
	if (!getUserMedia) {
		set({ media: 'denied' });
		return;
	}
	const asked = generation;
	set({ media: 'pending' });
	getUserMedia({ audio: true, video: true }).then(
		(granted) => {
			if (asked !== generation) {
				granted.getTracks().forEach((track) => track.stop());
				return;
			}
			stream = granted;
			granted.getAudioTracks().forEach((t) => (t.enabled = !state.muted));
			granted
				.getVideoTracks()
				.forEach((t) => (t.enabled = !state.cameraOff));
			set({ media: 'granted' });
		},
		() => {
			if (asked === generation) set({ media: 'denied' });
		}
	);
};

export const togglePracticeCallMute = (): void => {
	if (state.status === 'closed') return;
	const muted = !state.muted;
	stream?.getAudioTracks().forEach((track) => (track.enabled = !muted));
	// Muted, the practice call is silent: Carimat's line stops at once and
	// the next ones show as captions only.
	if (muted) hush();
	set({ muted, speaking: muted ? false : state.speaking });
};

export const togglePracticeCallCamera = (): void => {
	if (state.status === 'closed') return;
	const cameraOff = !state.cameraOff;
	stream?.getVideoTracks().forEach((track) => (track.enabled = !cameraOff));
	set({ cameraOff });
};

export const minimisePracticeCall = (): void => {
	if (state.status === 'open') set({ status: 'minimised' });
};

export const expandPracticeCall = (): void => {
	if (state.status === 'minimised') set({ status: 'open' });
};

/** Leave: every track stopped, speech cancelled, audio closed. */
export const leavePracticeCall = (): void => {
	if (state.status === 'closed' && !audio && !stream && !synth) return;
	teardown();
	set(CLOSED);
};
