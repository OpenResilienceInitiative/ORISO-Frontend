import { describe, expect, it } from 'vite-plus/test';
import {
	formatAttachmentSize,
	isSupportedAttachment
} from './attachmentHelpers';

describe('formatAttachmentSize', () => {
	it('counts in thousands, like the limit check', () => {
		expect(formatAttachmentSize(400, 'en')).toBe('1 KB');
		expect(formatAttachmentSize(340_000, 'en')).toBe('340 KB');
		expect(formatAttachmentSize(1_250_000, 'en')).toBe('1.3 MB');
		expect(formatAttachmentSize(1_250_000, 'de')).toBe('1,3 MB');
	});

	it('never shows a file over the limit as exactly the limit', () => {
		expect(formatAttachmentSize(10_000_001, 'en')).toBe('10 MB');
		expect(formatAttachmentSize(10_000_001, 'en', { roundUp: true })).toBe(
			'10.1 MB'
		);
	});
});

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
