import { getPracticeSnapshot, subscribePractice } from './practiceMode';
import { emitPracticeEvent, PRACTICE_TOUR_EVENTS } from './practiceTourEvents';
import {
	createPracticeMurmur,
	murmurLine,
	type PracticeMurmur
} from './practiceCallMurmur';

/*
 * FE#2545 D3 (revised): the practice video call. While practising, the
 * waiting room's "Video-Call starten" and the circle's call button open this
 * stage instead of a call: the counsellor's own camera and microphone as a
 * local preview, and Mia, a made-up participant whose murmur is generated
 * in the page. Nothing reaches the call manager, Element Call, LiveKit or
 * Matrix. The stage belongs to one practice run: leaving it, a restart or
 * the end of practice stops every track and closes the audio.
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
	/** The line Mia is saying now, or null while she is quiet. */
	captionIndex: number | null;
}

const CLOSED: PracticeCallState = {
	status: 'closed',
	muted: false,
	cameraOff: false,
	media: 'idle',
	startedAt: 0,
	captionIndex: null
};

/** Mia waits a moment before she greets, and between her lines. */
const FIRST_LINE_DELAY_MS = 700;
const LINE_PAUSE_MS = 1400;
const ROUND_PAUSE_MS = 7000;

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

/** Mia's current output level, 0..1: what the speaking ring shows. */
export const getPracticeCallLevel = (): number => murmur?.level() ?? 0;

/** Mia's lines in the page language; the layer sets them. */
export const setPracticeCallLines = (next: string[]): void => {
	lines = next;
};

const later = (ms: number, run: () => void) => {
	const id = window.setTimeout(() => {
		timers = timers.filter((t) => t !== id);
		run();
	}, ms);
	timers.push(id);
};

const speakLine = (index: number) => {
	if (state.status === 'closed') return;
	if (lines.length === 0) {
		later(LINE_PAUSE_MS, () => speakLine(0));
		return;
	}
	const text = lines[index % lines.length];
	const seconds = murmur?.speak(text) ?? murmurLine(text).duration;
	set({ captionIndex: index % lines.length });
	later(Math.round(seconds * 1000) + 150, () => {
		set({ captionIndex: null });
		const next = (index + 1) % lines.length;
		later(next === 0 ? ROUND_PAUSE_MS : LINE_PAUSE_MS, () =>
			speakLine(next)
		);
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
	later(FIRST_LINE_DELAY_MS, () => speakLine(0));
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
	set({ muted });
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

/** Leave: every track stopped, the audio closed, back to the circle. */
export const leavePracticeCall = (): void => {
	if (state.status === 'closed' && !audio && !stream) return;
	teardown();
	set(CLOSED);
};
