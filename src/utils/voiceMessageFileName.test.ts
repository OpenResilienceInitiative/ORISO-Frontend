import { describe, expect, it } from 'vitest';
import {
	isVoiceMessageFileName,
	voiceDurationMsFromFileName
} from './voiceMessageFileName';

describe('voice message file name', () => {
	it('recognises the recorder name only', () => {
		expect(
			isVoiceMessageFileName(
				'voice-message-1758600000000-s42-ms42300.webm'
			)
		).toBe(true);
		expect(isVoiceMessageFileName('interview.webm')).toBe(false);
		expect(isVoiceMessageFileName('voice-message-notes.pdf')).toBe(false);
	});

	it('prefers the whole seconds the sender showed', () => {
		expect(
			voiceDurationMsFromFileName('voice-message-1-s42-ms42300.webm')
		).toBe(42_000);
	});

	it('falls back to milliseconds, then to the legacy -d seconds', () => {
		expect(voiceDurationMsFromFileName('voice-message-1-ms900.ogg')).toBe(
			900
		);
		expect(voiceDurationMsFromFileName('voice-message-1-d7.ogg')).toBe(
			7_000
		);
	});

	it('returns null when the name carries no length', () => {
		expect(voiceDurationMsFromFileName('voice-message.ogg')).toBeNull();
	});
});
