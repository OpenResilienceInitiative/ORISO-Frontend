// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { playTestTone } from './SpeakerTest';

/* Just enough Web Audio to record the order of calls. */
const fakeContext = (calls: string[], withSink: boolean) =>
	class {
		currentTime = 0;
		destination = {};
		setSinkId = withSink
			? (id: string) => {
					calls.push(`sink:${id}`);
					return Promise.resolve();
				}
			: undefined;
		createGain() {
			calls.push('gain');
			const param = {
				setValueAtTime: () => undefined,
				exponentialRampToValueAtTime: () => undefined
			};
			return { connect: () => undefined, gain: param };
		}
		createOscillator() {
			return {
				frequency: { value: 0 },
				connect: () => undefined,
				start: () => undefined,
				stop: () => undefined
			};
		}
		close() {
			return Promise.resolve();
		}
	};

describe('playTestTone', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('routes the tone to the chosen speaker before it plays', async () => {
		vi.useFakeTimers();
		const calls: string[] = [];
		vi.stubGlobal('AudioContext', fakeContext(calls, true));
		const done = playTestTone('usb-headset');
		await vi.runAllTimersAsync();
		await done;
		expect(calls).toEqual(['sink:usb-headset', 'gain']);
	});

	it('plays through the default output where the browser cannot choose', async () => {
		vi.useFakeTimers();
		const calls: string[] = [];
		vi.stubGlobal('AudioContext', fakeContext(calls, false));
		const done = playTestTone('usb-headset');
		await vi.runAllTimersAsync();
		await done;
		expect(calls).toEqual(['gain']);
	});
});
