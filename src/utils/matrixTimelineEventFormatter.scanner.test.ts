/**
 * Media routing when a content scanner is deployed (issue #1072, ADR-019).
 *
 * Legacy, unencrypted attachments from before the E2EE migration must reach
 * the same scanner as everything else — otherwise the one class of file the
 * scanner could always have read keeps a route nothing inspects.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getMediaScannerUrl = vi.fn<() => string>();

vi.mock('../resources/scripts/runtimeConfig', () => ({
	getMediaScannerUrl: () => getMediaScannerUrl()
}));

const imageEvent = {
	getType: () => 'm.room.message',
	getSender: () => '@someone:hs',
	getTs: () => 1700000000000,
	getId: () => 'event-1',
	getContent: () => ({
		msgtype: 'm.image',
		body: 'photo.png',
		url: 'mxc://hs/media-1',
		info: { mimetype: 'image/png', size: 12 }
	})
};

const format = async () => {
	const { formatMatrixTimelineEvent } = await import(
		'./matrixTimelineEventFormatter'
	);
	return formatMatrixTimelineEvent(imageEvent, null, 'encrypted');
};

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('unencrypted media routing', () => {
	it('goes through the scanner where one is deployed', async () => {
		getMediaScannerUrl.mockReturnValue(
			'https://pre-dev.example.org/_matrix/media_proxy/unstable'
		);

		const message = await format();

		expect(message.attachments[0].downloadUrl).toBe(
			'https://pre-dev.example.org/_matrix/media_proxy/unstable/download/hs/media-1'
		);
	});

	it('keeps the previous path where none is deployed', async () => {
		getMediaScannerUrl.mockReturnValue('');

		const message = await format();

		expect(message.attachments[0].downloadUrl).toBe(
			'/_matrix/media/r0/download/hs/media-1'
		);
	});
});
