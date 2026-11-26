// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
	isVoiceMessageFileName,
	voiceDurationMsFromFileName
} from '../../utils/voiceMessageFileName';
import {
	createVoiceFile,
	pickVoiceMimeType,
	voiceFileExtension
} from './voiceRecordingFile';

afterEach(() => vi.unstubAllGlobals());

describe('voiceRecordingFile', () => {
	it('names a take so the receiving side reads its length', () => {
		const { file, durationSec } = createVoiceFile(
			new Blob(['x'], { type: 'audio/webm' }),
			'audio/webm;codecs=opus',
			2600,
			1700000000000
		);
		expect(durationSec).toBe(3);
		expect(file.name).toBe('voice-message-1700000000000-s3-ms2600.webm');
		expect(isVoiceMessageFileName(file.name)).toBe(true);
		expect(voiceDurationMsFromFileName(file.name)).toBe(3000);
	});

	it('counts anything under a second as one second', () => {
		const { durationSec, file } = createVoiceFile(
			new Blob(['x']),
			'audio/ogg;codecs=opus',
			200,
			1
		);
		expect(durationSec).toBe(1);
		expect(file.name).toBe('voice-message-1-s1-ms1000.ogg');
	});

	it('maps Safari mp4 to m4a', () => {
		expect(voiceFileExtension('audio/mp4')).toBe('m4a');
	});

	it('picks the first format the browser records', () => {
		vi.stubGlobal('MediaRecorder', {
			isTypeSupported: (type: string) => type === 'audio/webm'
		});
		expect(pickVoiceMimeType()).toBe('audio/webm');
		vi.stubGlobal('MediaRecorder', undefined);
		expect(pickVoiceMimeType()).toBeUndefined();
	});
});
