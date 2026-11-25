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
		// A steady murmur: the ring has a level to show.
		getFloatTimeDomainData: (samples: Float32Array) => samples.fill(0.1)
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
