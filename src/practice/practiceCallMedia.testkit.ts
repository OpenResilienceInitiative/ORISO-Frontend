import { vi } from 'vite-plus/test';

/*
 * jsdom has neither getUserMedia nor WebAudio. These stand-ins record what
 * the practice call does with them: which tracks were handed out and
 * stopped, which audio contexts were opened and closed.
 */

export interface FakeTrack {
	kind: 'audio' | 'video';
	enabled: boolean;
	readyState: 'live' | 'ended';
	stop: () => void;
}

const fakeTrack = (kind: 'audio' | 'video'): FakeTrack => {
	const track: FakeTrack = {
		kind,
		enabled: true,
		readyState: 'live',
		stop: () => {
			track.readyState = 'ended';
		}
	};
	return track;
};

const fakeParam = () => ({
	value: 0,
	setValueAtTime: vi.fn(),
	linearRampToValueAtTime: vi.fn(),
	cancelScheduledValues: vi.fn()
});

const fakeNode = () => ({
	connect: vi.fn(),
	disconnect: vi.fn()
});

export class FakeAudioContext {
	static instances: FakeAudioContext[] = [];
	state: 'running' | 'suspended' | 'closed' = 'running';
	currentTime = 0;
	sampleRate = 8000;
	destination = fakeNode();
	sources: Array<{ stop: ReturnType<typeof vi.fn> }> = [];
	constructor() {
		FakeAudioContext.instances.push(this);
	}
	resume = vi.fn(async () => undefined);
	close = vi.fn(async () => {
		this.state = 'closed';
	});
	createGain = () => ({ ...fakeNode(), gain: fakeParam() });
	createBiquadFilter = () => ({
		...fakeNode(),
		type: '',
		frequency: fakeParam(),
		Q: fakeParam()
	});
	createAnalyser = () => ({
		...fakeNode(),
		fftSize: 512,
		// A steady murmur while the context runs; a suspended one is silent,
		// like a browser that blocks audio without a gesture.
		getFloatTimeDomainData: (samples: Float32Array) =>
			samples.fill(this.state === 'running' ? 0.1 : 0)
	});
	createOscillator = () => {
		const source = {
			...fakeNode(),
			type: '',
			frequency: fakeParam(),
			start: vi.fn(),
			stop: vi.fn()
		};
		this.sources.push(source);
		return source;
	};
	createBuffer = (_channels: number, length: number) => {
		const data = new Float32Array(length);
		return { getChannelData: () => data };
	};
	createBufferSource = () => {
		const source = {
			...fakeNode(),
			buffer: null as unknown,
			loop: false,
			start: vi.fn(),
			stop: vi.fn()
		};
		this.sources.push(source);
		return source;
	};
}

export interface FakeMedia {
	getUserMedia: ReturnType<typeof vi.fn>;
	tracks: FakeTrack[];
	contexts: FakeAudioContext[];
	/** Every track handed out has ended. */
	allTracksEnded: () => boolean;
	/** Every audio context opened has been closed. */
	allAudioClosed: () => boolean;
}

/**
 * Installs the stand-ins on `navigator` and `window`. `granted: false`
 * refuses like a browser whose permission was denied.
 */
export const installFakeMedia = ({
	granted = true
}: { granted?: boolean } = {}): FakeMedia => {
	const tracks: FakeTrack[] = [];
	FakeAudioContext.instances = [];
	const getUserMedia = vi.fn(async () => {
		if (!granted) {
			throw Object.assign(new Error('Permission denied'), {
				name: 'NotAllowedError'
			});
		}
		const own = [fakeTrack('audio'), fakeTrack('video')];
		tracks.push(...own);
		return {
			getTracks: () => own,
			getAudioTracks: () => own.filter((t) => t.kind === 'audio'),
			getVideoTracks: () => own.filter((t) => t.kind === 'video')
		};
	});
	Object.defineProperty(navigator, 'mediaDevices', {
		configurable: true,
		value: { getUserMedia }
	});
	Object.defineProperty(window, 'AudioContext', {
		configurable: true,
		writable: true,
		value: FakeAudioContext
	});
	return {
		getUserMedia,
		tracks,
		contexts: FakeAudioContext.instances,
		allTracksEnded: () => tracks.every((t) => t.readyState === 'ended'),
		allAudioClosed: () =>
			FakeAudioContext.instances.every((c) => c.state === 'closed')
	};
};

export interface FakeVoice {
	name: string;
	lang: string;
	localService: boolean;
	default: boolean;
	voiceURI: string;
}

export const fakeVoice = (
	name: string,
	lang: string,
	localService: boolean,
	isDefault = false
): FakeVoice => ({
	name,
	lang,
	localService,
	default: isDefault,
	voiceURI: name
});

/** What a browser with a local German voice and Chrome's network voices lists. */
export const CHROME_LIKE_VOICES = [
	fakeVoice('Google Deutsch', 'de-DE', false, true),
	fakeVoice('Google US English', 'en-US', false),
	fakeVoice('Anna', 'de-DE', true),
	fakeVoice('Samantha', 'en-US', true)
];

export class FakeUtterance {
	text: string;
	voice: FakeVoice | null = null;
	lang = '';
	pitch = 1;
	rate = 1;
	onstart: (() => void) | null = null;
	onboundary: (() => void) | null = null;
	onend: (() => void) | null = null;
	onerror: ((event: { error: string }) => void) | null = null;
	constructor(text: string) {
		this.text = text;
	}
}

export interface FakeSpeech {
	speak: ReturnType<typeof vi.fn>;
	cancel: ReturnType<typeof vi.fn>;
	spoken: FakeUtterance[];
	/** Fires `voiceschanged` with this list (Chrome fills it late). */
	announceVoices: (voices: FakeVoice[]) => void;
}

/**
 * A speech synthesis that "speaks" each utterance for `speakMs`: start, a
 * word boundary, end. `cancel` ends the current one at once, like a browser.
 * `voices: 'late'` answers empty until `announceVoices`. `stalls`: the
 * engine accepts the text but never starts (a headless browser).
 */
export const installFakeSpeech = ({
	voices = CHROME_LIKE_VOICES,
	late = false,
	speakMs = 200,
	stalls = false
}: {
	voices?: FakeVoice[];
	late?: boolean;
	speakMs?: number;
	stalls?: boolean;
} = {}): FakeSpeech => {
	let listed: FakeVoice[] = late ? [] : voices;
	const listeners = new Set<() => void>();
	const spoken: FakeUtterance[] = [];
	let current: { utterance: FakeUtterance; timer: number } | null = null;
	const finish = () => {
		if (!current) return;
		const { utterance, timer } = current;
		window.clearTimeout(timer);
		current = null;
		utterance.onend?.();
	};
	const speak = vi.fn((utterance: FakeUtterance) => {
		spoken.push(utterance);
		finish();
		if (stalls) return;
		const timer = window.setTimeout(finish, speakMs);
		current = { utterance, timer };
		window.setTimeout(() => {
			utterance.onstart?.();
			utterance.onboundary?.();
		}, 0);
	});
	const cancel = vi.fn(() => finish());
	const synth = {
		speak,
		cancel,
		getVoices: () => listed,
		addEventListener: (_: string, listener: () => void) =>
			listeners.add(listener),
		removeEventListener: (_: string, listener: () => void) =>
			listeners.delete(listener)
	};
	Object.defineProperty(window, 'speechSynthesis', {
		configurable: true,
		value: synth
	});
	Object.defineProperty(window, 'SpeechSynthesisUtterance', {
		configurable: true,
		writable: true,
		value: FakeUtterance
	});
	return {
		speak,
		cancel,
		spoken,
		announceVoices: (next) => {
			listed = next;
			listeners.forEach((listener) => listener());
		}
	};
};

/** No speech synthesis at all (jsdom's default). */
export const removeSpeech = () => {
	Object.defineProperty(window, 'speechSynthesis', {
		configurable: true,
		value: undefined
	});
	Object.defineProperty(window, 'SpeechSynthesisUtterance', {
		configurable: true,
		writable: true,
		value: undefined
	});
};
