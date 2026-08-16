// @vitest-environment jsdom
/**
 * Encrypted-media scanning (epic ORISO-Admin#366 phase 2, issue #1072).
 *
 * With E2EE permanently on, an encrypted attachment is only shown once the
 * content scanner has judged the actual bytes. These tests pin the fail-closed
 * half of that: no verdict, nothing rendered and nothing linked.
 */
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageAttachment } from './MessageAttachment';
import { NotificationsContext } from '../../globalState';

const isMediaContentScannerEnabled = vi.fn<() => boolean>();
const downloadScannedEncryptedMedia = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../resources/scripts/endpoints', () => ({
	apiUrl: 'https://api.test'
}));
vi.mock('../../services/mediaContentScanner', () => ({
	isMediaContentScannerEnabled: () => isMediaContentScannerEnabled(),
	downloadScannedEncryptedMedia: (file: unknown) =>
		downloadScannedEncryptedMedia(file)
}));
vi.mock('../../globalState', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	return {
		NotificationsContext: react.createContext({
			addNotification: () => {}
		}),
		NOTIFICATION_TYPE_ERROR: 'error'
	};
});

const encryptedFile = {
	url: 'mxc://hs/media-1',
	key: {
		alg: 'A256CTR',
		ext: true,
		k: 'key-material',
		key_ops: ['encrypt', 'decrypt'],
		kty: 'oct'
	},
	iv: 'iv',
	hashes: { sha256: 'hash' },
	v: 'v2'
};

const encryptedAttachment = {
	title: 'photo.png',
	downloadUrl: '/_matrix/media/r0/download/hs/media-1',
	type: 'image',
	mediaType: 'image/png',
	size: 12,
	encryptedFile
} as never;

const imageFile = { name: 'photo.png', type: 'image/png' } as never;

const renderAttachment = (extraProps: Record<string, unknown> = {}) =>
	render(
		<NotificationsContext.Provider
			value={{ addNotification: vi.fn() } as never}
		>
			<MessageAttachment
				attachment={encryptedAttachment}
				file={imageFile}
				hasRenderedMessage
				rid="room-1"
				// eslint-disable-next-line react/jsx-props-no-spreading
				{...extraProps}
			/>
		</NotificationsContext.Provider>
	);

describe('MessageAttachment with a content scanner deployed', () => {
	beforeEach(() => {
		isMediaContentScannerEnabled.mockReturnValue(true);
		if (!window.URL.createObjectURL) {
			window.URL.createObjectURL = vi.fn();
		}
		vi.spyOn(window.URL, 'createObjectURL').mockReturnValue(
			'blob:scanned-photo'
		);
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it('forwards the file keys to the scanner without waiting for a click', async () => {
		downloadScannedEncryptedMedia.mockResolvedValue({
			verdict: 'safe',
			data: new Uint8Array([1, 2, 3]).buffer
		});

		renderAttachment({ mediaCheckState: 'safe' });

		await waitFor(() =>
			expect(downloadScannedEncryptedMedia).toHaveBeenCalledWith(
				encryptedFile
			)
		);
	});

	it('shows the image the scanner released', async () => {
		downloadScannedEncryptedMedia.mockResolvedValue({
			verdict: 'safe',
			data: new Uint8Array([1, 2, 3]).buffer
		});

		renderAttachment({ mediaCheckState: 'safe' });

		const img = await screen.findByRole('img');
		expect(img.getAttribute('src')).toBe('blob:scanned-photo');
	});

	it('neither renders nor links media the scanner rejected', async () => {
		downloadScannedEncryptedMedia.mockResolvedValue({
			verdict: 'blocked',
			reason: 'MCS_MEDIA_NOT_CLEAN'
		});

		renderAttachment({ mediaCheckState: 'safe' });

		await screen.findByText('attachments.mediaCheck.blocked');
		expect(screen.queryByRole('img')).toBeNull();
		expect(document.querySelector('a')).toBeNull();
	});

	it('withholds media when the scanner could not judge it', async () => {
		downloadScannedEncryptedMedia.mockResolvedValue({
			verdict: 'error',
			reason: 'scanner-unreachable: network down'
		});

		renderAttachment({ mediaCheckState: 'safe' });

		await screen.findByText('attachments.mediaCheck.error');
		expect(screen.queryByRole('img')).toBeNull();
		expect(document.querySelector('a')).toBeNull();
	});

	it('a scanner verdict overrides a "safe" claim from event metadata', async () => {
		downloadScannedEncryptedMedia.mockResolvedValue({
			verdict: 'blocked',
			reason: 'MCS_MEDIA_NOT_CLEAN'
		});

		renderAttachment({ mediaCheckState: 'safe' });

		await screen.findByText('attachments.mediaCheck.blocked');
	});

	it('does not fetch anything while an image is still waiting to be revealed', async () => {
		renderAttachment({ mediaCheckState: 'unchecked' });

		await screen.findByText('attachments.mediaCheck.unchecked');
		expect(downloadScannedEncryptedMedia).not.toHaveBeenCalled();
	});

	it('leaves the unlock flow untouched where no scanner is deployed', async () => {
		isMediaContentScannerEnabled.mockReturnValue(false);

		renderAttachment({ mediaCheckState: 'safe' });

		await screen.findByText('e2ee.attachment.encrypted');
		expect(downloadScannedEncryptedMedia).not.toHaveBeenCalled();
	});
});
