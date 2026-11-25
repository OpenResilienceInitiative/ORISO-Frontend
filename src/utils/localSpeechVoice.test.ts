import { describe, expect, it } from 'vite-plus/test';
import {
	NOVELTY_VOICE_NAMES,
	pickLocalVoice,
	voiceLanguageOf
} from './localSpeechVoice';

const voice = (
	name: string,
	lang: string,
	localService = true,
	isDefault = false
) =>
	({
		name,
		lang,
		localService,
		default: isDefault,
		voiceURI: name
	}) as SpeechSynthesisVoice;

describe('pickLocalVoice', () => {
	it('reads the app language as its base: de@informal is de', () => {
		expect(voiceLanguageOf('de@informal')).toBe('de');
		expect(voiceLanguageOf('pt_BR')).toBe('pt');
	});

	it('never picks a network voice, even when it is the only match or the default', () => {
		expect(
			pickLocalVoice(
				[voice('Google Deutsch', 'de-DE', false, true)],
				'de'
			)
		).toBeNull();
		expect(
			pickLocalVoice(
				[
					voice('Google US English', 'en-US', false, true),
					voice('Samantha', 'en-US')
				],
				'en'
			)?.name
		).toBe('Samantha');
	});

	it('never picks a macOS novelty voice such as Albert, Zarvox or Bad News', () => {
		const novelties = NOVELTY_VOICE_NAMES.map((name) =>
			voice(name, 'en-US')
		);
		expect(pickLocalVoice(novelties, 'en')).toBeNull();
		expect(
			pickLocalVoice([...novelties, voice('Fred', 'en-US')], 'en')?.name
		).toBe('Fred');
		// Localised suffixes macOS adds, e.g. "Albert (English (US))".
		expect(
			pickLocalVoice(
				[
					voice('Albert (English (US))', 'en-US'),
					voice('Tom', 'en-US')
				],
				'en'
			)?.name
		).toBe('Tom');
	});

	it('prefers the listed voices of the language over the default and the list order', () => {
		expect(
			pickLocalVoice(
				[
					voice('Fred', 'en-US', true, true),
					voice('Karen', 'en-AU'),
					voice('Daniel', 'en-GB'),
					voice('Samantha', 'en-US')
				],
				'en'
			)?.name
		).toBe('Samantha');
		expect(
			pickLocalVoice(
				[voice('Markus', 'de-DE'), voice('Anna', 'de-DE')],
				'de'
			)?.name
		).toBe('Anna');
		// Windows' local voices count as preferred too.
		expect(
			pickLocalVoice(
				[
					voice('Fred', 'en-US'),
					voice('Microsoft Zira - English (United States)', 'en-US')
				],
				'en'
			)?.name
		).toBe('Microsoft Zira - English (United States)');
	});

	it('falls back to the default local voice, then the first local voice', () => {
		expect(
			pickLocalVoice(
				[voice('Tom', 'en-US'), voice('Fred', 'en-US', true, true)],
				'en'
			)?.name
		).toBe('Fred');
		expect(
			pickLocalVoice(
				[voice('Tom', 'en-US'), voice('Fred', 'en-US')],
				'en'
			)?.name
		).toBe('Tom');
	});

	it('returns null without a language or without a local voice for it', () => {
		expect(pickLocalVoice([voice('Anna', 'de-DE')], '')).toBeNull();
		expect(pickLocalVoice([voice('Anna', 'de-DE')], 'ti')).toBeNull();
	});
});
