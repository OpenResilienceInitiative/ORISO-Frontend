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
		expect(isVoiceMessageFileName('voice-message-notes.mp3')).toBe(false);
		expect(isVoiceMessageFileName('voice-message-1-d7.ogg')).toBe(true);
		expect(isVoiceMessageFileName('voice-message-1-ms900.ogg')).toBe(true);
	});

	it('recognises the .m4a and .mp4 names an iOS Safari take gets', () => {
		expect(
			isVoiceMessageFileName('voice-message-1758600000000-s7-ms7100.m4a')
		).toBe(true);
		expect(
			isVoiceMessageFileName('voice-message-1758600000000-s7-ms7100.mp4')
		).toBe(true);
		expect(isVoiceMessageFileName('holiday.m4a')).toBe(false);
		expect(
			voiceDurationMsFromFileName('voice-message-1-s7-ms7100.m4a')
		).toBe(7_000);
		expect(voiceDurationMsFromFileName('voice-message-1-ms900.mp4')).toBe(
			900
		);
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

	it('reads the legacy -s seconds without a -ms part', () => {
		expect(voiceDurationMsFromFileName('voice-message-1-s7.ogg')).toBe(
			7_000
		);
	});

	it('returns null when the name carries no length', () => {
		expect(voiceDurationMsFromFileName('voice-message.ogg')).toBeNull();
	});
});
