import { describe, expect, it } from 'vite-plus/test';
import { breathingVoiceFor } from './breathingSpeech';

const voice = (name: string, lang: string, localService: boolean) =>
	({
		name,
		lang,
		localService,
		default: false,
		voiceURI: name
	}) as SpeechSynthesisVoice;

describe('breathingVoiceFor (the spoken breathing cues stay on the device)', () => {
	it('takes a local voice of the page language', () => {
		expect(
			breathingVoiceFor(
				[
					voice('Google Deutsch', 'de-DE', false),
					voice('Anna', 'de-DE', true)
				],
				'de-DE'
			)?.name
		).toBe('Anna');
	});

	it('never falls back to a network voice: without a local voice it gives null', () => {
		expect(
			breathingVoiceFor(
				[voice('Google Deutsch', 'de-DE', false)],
				'de-DE'
			)
		).toBeNull();
		expect(breathingVoiceFor([], 'de-DE')).toBeNull();
	});

	it('does not take a local voice of another language', () => {
		expect(
			breathingVoiceFor([voice('Samantha', 'en-US', true)], 'de-DE')
		).toBeNull();
	});
});
