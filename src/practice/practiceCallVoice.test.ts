// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	loadVoices,
	pickLocalVoice,
	ROBOT_PITCH,
	ROBOT_RATE,
	speakLocally,
	speechPulse,
	voiceLanguageOf
} from './practiceCallVoice';
import {
	CHROME_LIKE_VOICES,
	fakeVoice,
	installFakeSpeech,
	type FakeUtterance
} from './practiceCallMedia.testkit';

const asVoices = (voices: unknown) => voices as SpeechSynthesisVoice[];
const events = () => ({
	onStart: vi.fn(),
	onBoundary: vi.fn(),
	onEnd: vi.fn()
});

afterEach(() => {
	vi.useRealTimers();
});

describe("Carimat's voice: local only (FE#2545 D3)", () => {
	it('maps app locales to a language, du-form included', () => {
		expect(voiceLanguageOf('de@informal')).toBe('de');
		expect(voiceLanguageOf('en')).toBe('en');
		expect(voiceLanguageOf('pt_BR')).toBe('pt');
		expect(voiceLanguageOf('')).toBe('');
	});

	it('picks a local voice of the page language, never the network default', () => {
		const voices = asVoices(CHROME_LIKE_VOICES);
		expect(pickLocalVoice(voices, 'de')?.name).toBe('Anna');
		expect(pickLocalVoice(voices, 'de@informal')?.name).toBe('Anna');
		expect(pickLocalVoice(voices, 'en')?.name).toBe('Samantha');
	});

	it('never chooses a network voice, even the only one for the language', () => {
		const voices = asVoices([
			fakeVoice('Google русский', 'ru-RU', false, true),
			fakeVoice('Microsoft Online Tigrinya', 'ti-ER', false),
			fakeVoice('Yelda', 'tr-TR', true)
		]);
		expect(pickLocalVoice(voices, 'ru')).toBeNull();
		expect(pickLocalVoice(voices, 'ti')).toBeNull();
		expect(pickLocalVoice(voices, 'fr')).toBeNull();
		expect(pickLocalVoice(voices, 'tr')?.name).toBe('Yelda');
		// Whatever the list, a chosen voice is local.
		['de', 'en', 'fr', 'ru', 'ti', 'tr'].forEach((locale) => {
			const chosen = pickLocalVoice(asVoices(CHROME_LIKE_VOICES), locale);
			if (chosen) expect(chosen.localService).toBe(true);
		});
	});

	it('prefers the local default among several', () => {
		const voices = asVoices([
			fakeVoice('Markus', 'de-DE', true),
			fakeVoice('Petra', 'de-AT', true, true)
		]);
		expect(pickLocalVoice(voices, 'de')?.name).toBe('Petra');
	});

	it('speaks robotically with a local voice and refuses a network one', () => {
		const speech = installFakeSpeech();
		const synth = window.speechSynthesis;
		const network = asVoices(CHROME_LIKE_VOICES)[0];
		expect(speakLocally(synth, network, 'Hallo', events())).toBe(false);
		expect(speakLocally(synth, null, 'Hallo', events())).toBe(false);
		expect(speech.speak).not.toHaveBeenCalled();

		const local = asVoices(CHROME_LIKE_VOICES)[2];
		expect(speakLocally(synth, local, 'Hallo', events())).toBe(true);
		const utterance = speech.spoken[0] as FakeUtterance;
		expect(utterance.voice?.localService).toBe(true);
		expect(utterance.lang).toBe('de-DE');
		expect([utterance.pitch, utterance.rate]).toEqual([
			ROBOT_PITCH,
			ROBOT_RATE
		]);
	});

	it('waits for voiceschanged when the list starts empty', async () => {
		const speech = installFakeSpeech({ late: true });
		const loading = loadVoices(window.speechSynthesis, 5000);
		speech.announceVoices(CHROME_LIKE_VOICES);
		expect((await loading).map((v) => v.name)).toContain('Anna');
	});

	it('gives up after the timeout with what is there (nothing)', async () => {
		vi.useFakeTimers();
		installFakeSpeech({ late: true });
		const loading = loadVoices(window.speechSynthesis, 1500);
		vi.advanceTimersByTime(1500);
		expect(await loading).toEqual([]);
	});

	it('pulses while speaking, kicked by a word boundary', () => {
		const now = 10_000;
		const quiet = speechPulse(now, 0);
		expect(quiet).toBeGreaterThan(0);
		expect(quiet).toBeLessThanOrEqual(0.6);
		expect(speechPulse(now, now)).toBeGreaterThan(quiet);
	});
});
