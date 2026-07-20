import { describe, expect, it } from 'vitest';
import { resolveAttachmentForSend } from './resolveAttachmentForSend';

const fakeFile = (name: string, type = '') => ({ name, type }) as File;

describe('resolveAttachmentForSend', () => {
	it('uses an in-memory voice preview when no file input or preselected file exists', () => {
		const voicePreview = fakeFile('voice-message.webm', 'audio/webm');

		expect(resolveAttachmentForSend(null, undefined, voicePreview)).toBe(
			voicePreview
		);
	});

	it('keeps explicit preselected and file-input precedence', () => {
		const preselected = fakeFile('preselected.pdf');
		const selected = fakeFile('selected.pdf');
		const preview = fakeFile('preview.webm');

		expect(resolveAttachmentForSend(preselected, selected, preview)).toBe(
			preselected
		);
		expect(resolveAttachmentForSend(null, selected, preview)).toBe(
			selected
		);
	});
});
