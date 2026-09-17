// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { buildMatrixFileMessageContent } from './matrixClientService';

vi.mock('matrix-js-sdk', () => ({}));

const encryptedFile = { url: 'mxc://server/media-id' } as never;

describe('buildMatrixFileMessageContent', () => {
	it.each([
		['voice note', 'voice.webm', 'audio/webm', 'm.audio'],
		['image', 'photo.png', 'image/png', 'm.image'],
		['PDF', 'document.pdf', 'application/pdf', 'm.file']
	])(
		'keeps the Matrix thread relation for a %s attachment',
		(_label, name, type, msgtype) => {
			const file = new File(['x'], name, { type });

			const content = buildMatrixFileMessageContent(
				file,
				encryptedFile,
				null,
				{ threadRootId: '$thread-root:oriso.org' }
			);

			expect(content).toMatchObject({
				msgtype,
				'm.relates_to': {
					'rel_type': 'm.thread',
					'event_id': '$thread-root:oriso.org',
					'is_falling_back': true,
					'm.in_reply_to': {
						event_id: '$thread-root:oriso.org'
					}
				}
			});
		}
	);

	it('keeps room attachments relation-free', () => {
		const file = new File(['x'], 'photo.png', { type: 'image/png' });

		const content = buildMatrixFileMessageContent(
			file,
			encryptedFile,
			null
		);

		expect(content).not.toHaveProperty('m.relates_to');
	});

	it('sends images as m.image with intrinsic dimensions in info', () => {
		const file = new File(['x'], 'photo.png', { type: 'image/png' });

		const content = buildMatrixFileMessageContent(file, encryptedFile, {
			w: 120,
			h: 72
		});

		expect(content.msgtype).toBe('m.image');
		expect(content.info).toMatchObject({
			mimetype: 'image/png',
			w: 120,
			h: 72
		});
	});

	it('omits dimensions when probing was not possible', () => {
		const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });

		const content = buildMatrixFileMessageContent(
			file,
			encryptedFile,
			null
		);

		expect(content.msgtype).toBe('m.file');
		expect(content.info).not.toHaveProperty('w');
		expect(content.info).not.toHaveProperty('h');
	});
});
