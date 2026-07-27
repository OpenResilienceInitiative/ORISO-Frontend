// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { buildMatrixFileMessageContent } from './matrixClientService';

vi.mock('matrix-js-sdk', () => ({}));

const encryptedFile = { url: 'mxc://server/media-id' } as never;

describe('buildMatrixFileMessageContent', () => {
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
