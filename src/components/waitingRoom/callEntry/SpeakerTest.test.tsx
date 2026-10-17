// @vitest-environment jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { playTestTone, SpeakerTest, SpeakerTestState } from './SpeakerTest';

/* Just enough Web Audio to record the order of calls. */
const fakeContext = (calls: string[], sink: 'ok' | 'fails' | 'none') =>
	class {
		currentTime = 0;
		destination = {};
		setSinkId =
			sink === 'none'
				? undefined
				: (id: string) => {
						calls.push(`sink:${id}`);
						return sink === 'ok'
							? Promise.resolve()
							: Promise.reject(new Error('NotFoundError'));
					};
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
			calls.push('close');
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
		vi.stubGlobal('AudioContext', fakeContext(calls, 'ok'));
		const done = playTestTone('usb-headset');
		await vi.runAllTimersAsync();
		await done;
		expect(calls).toEqual(['sink:usb-headset', 'gain', 'close']);
	});

	it('plays through the default output where the browser cannot choose', async () => {
		vi.useFakeTimers();
		const calls: string[] = [];
		vi.stubGlobal('AudioContext', fakeContext(calls, 'none'));
		const done = playTestTone('usb-headset');
		await vi.runAllTimersAsync();
		await done;
		expect(calls).toEqual(['gain', 'close']);
	});

	it('plays nothing elsewhere when the chosen speaker cannot be reached', async () => {
		const calls: string[] = [];
		vi.stubGlobal('AudioContext', fakeContext(calls, 'fails'));
		await expect(playTestTone('unplugged')).rejects.toThrow();
		expect(calls).toEqual(['sink:unplugged', 'close']);
	});
});

/* The room owns the state; this stands in for it. */
const Room = ({
	sinkId,
	playTone
}: {
	sinkId?: string;
	playTone: (sinkId?: string) => Promise<void>;
}) => {
	const [state, setState] = React.useState<SpeakerTestState>('idle');
	// Like CallEntryRoom: another speaker starts the test over.
	React.useEffect(() => setState('idle'), [sinkId]);
	return (
		<SpeakerTest
			state={state}
			onChange={setState}
			sinkId={sinkId}
			playTone={playTone}
		/>
	);
};

const row = () => screen.getByTestId('speaker-test-row');

describe('SpeakerTest', () => {
	afterEach(cleanup);

	it('moves the keyboard to "Ja" once the tone has played', async () => {
		render(<Room playTone={() => Promise.resolve()} />);
		await act(async () => {
			fireEvent.click(screen.getByTestId('speaker-test'));
		});
		expect(row().getAttribute('data-state')).toBe('asking');
		expect(document.activeElement?.textContent).toBe('Ja');
	});

	it('moves the keyboard to "Testton abspielen" after "Nein"', async () => {
		render(<Room playTone={() => Promise.resolve()} />);
		await act(async () => {
			fireEvent.click(screen.getByTestId('speaker-test'));
		});
		fireEvent.click(screen.getByRole('button', { name: 'Nein' }));
		expect(row().getAttribute('data-state')).toBe('notHeard');
		expect(document.activeElement).toBe(screen.getByTestId('speaker-test'));
	});

	it('tells the person when the chosen speaker cannot play the tone', async () => {
		render(
			<Room
				sinkId="unplugged"
				playTone={() => Promise.reject(new Error('NotFoundError'))}
			/>
		);
		await act(async () => {
			fireEvent.click(screen.getByTestId('speaker-test'));
		});
		expect(row().getAttribute('data-state')).toBe('notHeard');
	});

	it('ignores the end of a tone played through a speaker no longer chosen', async () => {
		let end: () => void = () => undefined;
		const playTone = vi.fn(
			() => new Promise<void>((resolve) => (end = resolve))
		);
		const { rerender } = render(<Room sinkId="a" playTone={playTone} />);
		fireEvent.click(screen.getByTestId('speaker-test'));
		expect(row().getAttribute('data-state')).toBe('playing');
		rerender(<Room sinkId="b" playTone={playTone} />);
		expect(row().getAttribute('data-state')).toBe('idle');
		await act(async () => end());
		// No question about a tone that came out of the old speaker.
		expect(row().getAttribute('data-state')).toBe('idle');
	});
});
