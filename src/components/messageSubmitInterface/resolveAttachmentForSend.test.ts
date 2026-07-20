import { describe, expect, it } from 'vitest';
import { resolveAttachmentForSend } from './resolveAttachmentForSend';

describe('resolveAttachmentForSend', () => {
	it('uses an in-memory voice preview when no file input or preselected file exists', () => {
		const voicePreview = new File(['voice'], 'voice-message.webm', {
			type: 'audio/webm'
		});

		expect(resolveAttachmentForSend(null, undefined, voicePreview)).toBe(
			voicePreview
		);
	});

	it('keeps explicit preselected and file-input precedence', () => {
		const preselected = new File(['a'], 'preselected.pdf');
		const selected = new File(['b'], 'selected.pdf');
		const preview = new File(['c'], 'preview.webm');

		expect(resolveAttachmentForSend(preselected, selected, preview)).toBe(
			preselected
		);
		expect(resolveAttachmentForSend(null, selected, preview)).toBe(
			selected
		);
	});
});
