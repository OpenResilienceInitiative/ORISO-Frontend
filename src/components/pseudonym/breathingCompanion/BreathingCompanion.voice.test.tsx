// @vitest-environment oriso-jsdom
/**
 * Privacy: the spoken breathing cues must only use an on-device voice. A
 * network voice (such as Chrome's "Google Deutsch") would send the cue text
 * to a speech service, so with no local voice the companion stays silent.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import BreathingCompanion from './BreathingCompanion';

const voice = (name: string, lang: string, localService: boolean) =>
	({
		name,
		lang,
		localService,
		default: false,
		voiceURI: name
	}) as SpeechSynthesisVoice;

class FakeUtterance {
	lang = '';
	voice: SpeechSynthesisVoice | null = null;
	rate = 1;
	pitch = 1;
	volume = 1;
	onend: (() => void) | null = null;
	onerror: ((e: { error: string }) => void) | null = null;
	constructor(public text: string) {}
}

let voices: SpeechSynthesisVoice[] = [];
const speak = vi.fn();

beforeEach(() => {
	speak.mockReset();
	vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
	// The breathing animation is not under test: keep its frame loop idle.
	vi.stubGlobal('requestAnimationFrame', () => 1);
	vi.stubGlobal('cancelAnimationFrame', () => {});
	// jsdom lays nothing out; the scene draws its wave from its measured
	// size, so give it a real one.
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
		x: 0,
		y: 0,
		top: 0,
		left: 0,
		right: 480,
		bottom: 520,
		width: 480,
		height: 520,
		toJSON: () => ({})
	} as DOMRect);
	// The wind sound is not under test either: its audio context never
	// finishes resuming, so the sound stays "preparing" and is never rendered.
	vi.stubGlobal(
		'AudioContext',
		class {
			currentTime = 0;
			state = 'suspended';
			destination = {};
			createGain() {
				return {
					gain: { setTargetAtTime() {}, cancelScheduledValues() {} },
					connect() {},
					disconnect() {}
				};
			}
			resume() {
				return new Promise(() => {});
			}
			close() {
				return Promise.resolve();
			}
		}
	);
	vi.stubGlobal('speechSynthesis', {
		getVoices: () => voices,
		speak,
		cancel: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	});
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const startWithVoice = () => {
	render(
		<div lang="de-DE">
			<BreathingCompanion onClose={() => {}} reducedMotion />
		</div>
	);
	fireEvent.click(screen.getByRole('button', { name: 'Klang und Ansage' }));
	fireEvent.click(
		screen.getByRole('checkbox', { name: 'Atemphasen ansagen' })
	);
	fireEvent.click(screen.getByRole('button', { name: /Beginnen/ }));
};

describe('BreathingCompanion voice (cues stay on the device)', () => {
	it('speaks with the local voice, never the network one listed first', () => {
		voices = [
			voice('Google Deutsch', 'de-DE', false),
			voice('Anna', 'de-DE', true)
		];
		startWithVoice();
		expect(speak).toHaveBeenCalled();
		for (const [utterance] of speak.mock.calls)
			expect((utterance as FakeUtterance).voice?.name).toBe('Anna');
	});

	it('with only a network voice it never speaks and says no voice is available', () => {
		voices = [voice('Google Deutsch', 'de-DE', false)];
		startWithVoice();
		expect(speak).not.toHaveBeenCalled();
		expect(
			screen.getAllByText('Auf diesem Gerät ist keine Ansage verfügbar.')
				.length
		).toBeGreaterThan(0);
	});
});
