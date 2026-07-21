import { describe, expect, it } from 'vitest';
import { isSupportedAttachment } from './attachmentHelpers';

describe('isSupportedAttachment', () => {
	it.each([
		['image.png', 'image/png'],
		['photo.jpeg', 'image/jpeg'],
		['document.pdf', 'application/pdf'],
		[
			'document.docx',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		],
		[
			'table.xlsx',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		],
		['voice.webm', 'audio/webm'],
		['voice.ogg', 'audio/ogg'],
		['voice.mp3', 'audio/mpeg']
	])('accepts supported %s', (name, type) => {
		expect(isSupportedAttachment({ name, type })).toBe(true);
	});

	it('accepts a supported extension when the operating system supplies no MIME type', () => {
		expect(isSupportedAttachment({ name: 'document.PDF', type: '' })).toBe(
			true
		);
	});

	it.each([
		['harmless.txt', 'text/plain'],
		['script.exe', 'application/octet-stream'],
		['fake.pdf', 'text/plain'],
		['unknown.bin', '']
	])('rejects unsupported %s', (name, type) => {
		expect(isSupportedAttachment({ name, type })).toBe(false);
	});
});
