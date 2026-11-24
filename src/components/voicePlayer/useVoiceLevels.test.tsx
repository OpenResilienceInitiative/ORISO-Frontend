// @vitest-environment oriso-jsdom
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import * as React from 'react';
import {
	act,
	cleanup,
	render,
	renderHook,
	screen
} from '@testing-library/react';

import { levelFromSamples, pushLevel, useVoiceLevels } from './useVoiceLevels';
import { VoiceLevelDots } from './VoiceLevelDots';
import { VoiceRecordingBar } from './VoiceRecordingBar';

const frame = (amplitude: number) =>
	Uint8Array.from({ length: 512 }, (_, index) =>
		Math.round(128 + amplitude * 127 * Math.sin(index / 4))
	);

describe('levelFromSamples', () => {
	it('reads silence as 0 and a loud voice as 1', () => {
		expect(levelFromSamples(frame(0))).toBe(0);
		expect(levelFromSamples(new Uint8Array(0))).toBe(0);
		expect(levelFromSamples(frame(1))).toBe(1);
	});

	it('puts normal speech in the middle of the range', () => {
		const level = levelFromSamples(frame(0.05));
		expect(level).toBeGreaterThan(0.2);
		expect(level).toBeLessThan(0.9);
	});

	it('shifts the newest level in from the right', () => {
		expect(pushLevel([0.1, 0.2, 0.3], 0.9)).toEqual([0.2, 0.3, 0.9]);
	});
});

class FakeAudioContext {
	static instances: FakeAudioContext[] = [];
	static amplitude = 0;
	static initialState: 'running' | 'suspended' = 'running';
	state: 'running' | 'suspended' | 'closed' = FakeAudioContext.initialState;
	resume = vi.fn(() => {
		this.state = 'running';
		return Promise.resolve();
	});
	source = { connect: vi.fn(), disconnect: vi.fn() };
	close = vi.fn(() => {
		this.state = 'closed';
		return Promise.resolve();
	});
	constructor() {
		FakeAudioContext.instances.push(this);
	}
	createMediaStreamSource() {
		return this.source;
	}
	createAnalyser() {
		return {
			fftSize: 0,
			getByteTimeDomainData: (target: Uint8Array) =>
				target.set(frame(FakeAudioContext.amplitude))
		};
	}
}

const fakeStream = () => ({}) as MediaStream;

beforeEach(() => {
	vi.useFakeTimers();
	FakeAudioContext.instances = [];
	FakeAudioContext.amplitude = 0;
	FakeAudioContext.initialState = 'running';
	vi.stubGlobal('AudioContext', FakeAudioContext);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('useVoiceLevels', () => {
	it('follows the microphone and closes its audio context on unmount', () => {
		const stream = fakeStream();
		const { result, unmount } = renderHook(() => useVoiceLevels(stream, 4));
		expect(result.current).toEqual([0, 0, 0, 0]);

		FakeAudioContext.amplitude = 1;
		act(() => {
			vi.advanceTimersByTime(80);
		});
		expect(result.current).toEqual([0, 0, 0, 1]);

		const [context] = FakeAudioContext.instances;
		unmount();
		expect(context.source.disconnect).toHaveBeenCalled();
		expect(context.close).toHaveBeenCalledTimes(1);
	});

	it('resumes an audio context the browser started suspended', () => {
		FakeAudioContext.initialState = 'suspended';
		const stream = fakeStream();
		renderHook(() => useVoiceLevels(stream, 4));
		const [context] = FakeAudioContext.instances;
		expect(context.resume).toHaveBeenCalledTimes(1);
		expect(context.state).toBe('running');
	});

	it('does not resume a context that already runs', () => {
		const stream = fakeStream();
		renderHook(() => useVoiceLevels(stream, 4));
		expect(FakeAudioContext.instances[0].resume).not.toHaveBeenCalled();
	});

	it('uses one audio context per stream and never leaves the old one open', () => {
		const first = fakeStream();
		const { rerender } = renderHook(
			({ stream }) => useVoiceLevels(stream, 4),
			{ initialProps: { stream: first } }
		);
		rerender({ stream: fakeStream() });
		expect(FakeAudioContext.instances).toHaveLength(2);
		expect(FakeAudioContext.instances[0].close).toHaveBeenCalledTimes(1);
		expect(FakeAudioContext.instances[1].close).not.toHaveBeenCalled();
	});

	it('opens no audio context when disabled and rests without Web Audio', () => {
		const stream = fakeStream();
		renderHook(() => useVoiceLevels(stream, 4, false));
		expect(FakeAudioContext.instances).toHaveLength(0);

		vi.stubGlobal('AudioContext', undefined);
		const { result } = renderHook(() => useVoiceLevels(stream, 3));
		act(() => {
			vi.advanceTimersByTime(500);
		});
		expect(result.current).toEqual([0, 0, 0]);
	});
});

describe('VoiceLevelDots', () => {
	it('keeps a full resting row of dots while recording in silence', () => {
		render(<VoiceLevelDots stream={fakeStream()} state="recording" />);
		act(() => {
			vi.advanceTimersByTime(800);
		});
		const row = screen.getByTestId('voice-level-dots');
		const dots = row.querySelectorAll('.voiceLevelDots__dot');
		expect(row.getAttribute('data-state')).toBe('recording');
		expect(dots).toHaveLength(20);
		dots.forEach((dot) =>
			expect(dot.getAttribute('data-level')).toBe('0.00')
		);
	});

	it('grows the newest dot with the voice', () => {
		render(<VoiceLevelDots stream={fakeStream()} state="recording" />);
		FakeAudioContext.amplitude = 1;
		act(() => {
			vi.advanceTimersByTime(80);
		});
		const dots = screen
			.getByTestId('voice-level-dots')
			.querySelectorAll('.voiceLevelDots__dot');
		expect(dots[dots.length - 1].getAttribute('data-level')).toBe('1.00');
		expect(dots[0].getAttribute('data-level')).toBe('0.00');
	});

	it('does not read the microphone while paused or stopped', () => {
		const { rerender } = render(
			<VoiceLevelDots stream={fakeStream()} state="paused" />
		);
		rerender(<VoiceLevelDots stream={fakeStream()} state="stopped" />);
		expect(FakeAudioContext.instances).toHaveLength(0);
		expect(
			screen
				.getByTestId('voice-level-dots')
				.querySelectorAll('.voiceLevelDots__dot')
		).toHaveLength(20);
	});
});

describe('VoiceRecordingBar', () => {
	it('shows the level dots in the middle and closes the audio when it ends', () => {
		const { unmount } = render(
			<VoiceRecordingBar
				durationSec={3}
				onStop={() => undefined}
				stream={fakeStream()}
			/>
		);
		expect(screen.getByTestId('voice-level-dots')).toBeTruthy();
		expect(screen.getByText('0:03')).toBeTruthy();
		unmount();
		expect(FakeAudioContext.instances[0].close).toHaveBeenCalledTimes(1);
	});
});
