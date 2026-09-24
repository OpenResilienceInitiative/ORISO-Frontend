// @vitest-environment jsdom
/**
 * Authenticated media, end to end through the component (#1487).
 *
 * With E2EE permanently on, the encrypted branch below is the path almost every
 * attachment in a counselling chat takes. It used to fetch the ciphertext
 * through `fetchData()`, which attaches the **Keycloak** access token from the
 * `keycloak` cookie (`src/api/fetchData.ts`) — so it was wrong twice over:
 * legacy endpoint *and* wrong token. It only ever worked because the legacy
 * endpoint ignored authorization altogether.
 *
 * Neither half of that can be caught by opening an existing chat: media
 * uploaded before Synapse's `enable_authenticated_media` flip is grandfathered
 * onto the legacy path permanently. These tests assert on the actual outgoing
 * request instead.
 */
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageAttachment } from './MessageAttachment';
import { NotificationsContext } from '../../globalState';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';

const HOMESERVER = 'https://matrix.test';
const MATRIX_TOKEN = 'matrix-access-token';
const KEYCLOAK_TOKEN = 'keycloak-access-token';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../resources/scripts/endpoints', () => ({
	apiUrl: 'https://api.test'
}));
vi.mock('../../services/mediaContentScanner', () => ({
	isMediaContentScannerEnabled: () => false,
	downloadScannedEncryptedMedia: vi.fn()
}));
vi.mock('../../utils/matrixEncryptedAttachment', () => ({
	decryptMatrixAttachment: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer)
}));
vi.mock('../../api/apiPostError', () => ({
	apiPostError: vi.fn(async () => undefined),
	ERROR_LEVEL_WARN: 'warn'
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

const imageFile = { name: 'photo.png', type: 'image/png' } as never;

const fetchMock = vi.fn();

const renderAttachment = (attachment: unknown) =>
	render(
		<NotificationsContext.Provider
			value={{ addNotification: vi.fn() } as never}
		>
			<MessageAttachment
				attachment={attachment as never}
				file={imageFile}
				hasRenderedMessage
				rid="room-1"
				mediaCheckState="safe"
			/>
		</NotificationsContext.Provider>
	);

beforeEach(() => {
	// A Keycloak session exists, exactly as it does in the app.
	document.cookie = `keycloak=${KEYCLOAK_TOKEN}`;
	setMatrixClientServiceRef({
		getClient: () => ({
			getAccessToken: () => MATRIX_TOKEN,
			mxcUrlToHttp: (
				mxcUrl: string,
				_w?: number,
				_h?: number,
				_m?: string,
				_direct?: boolean,
				_redirects?: boolean,
				useAuthentication?: boolean
			) => {
				const [serverName, mediaId] = mxcUrl
					.replace('mxc://', '')
					.split('/');
				return useAuthentication
					? `${HOMESERVER}/_matrix/client/v1/media/download/${serverName}/${mediaId}`
					: `${HOMESERVER}/_matrix/media/v3/download/${serverName}/${mediaId}`;
			}
		})
	} as never);

	fetchMock.mockReset();
	fetchMock.mockResolvedValue({
		ok: true,
		status: 200,
		blob: async () => new Blob(['bytes']),
		arrayBuffer: async () => new Uint8Array([9, 9, 9]).buffer
	});
	vi.stubGlobal('fetch', fetchMock);
	window.URL.createObjectURL = vi.fn().mockReturnValue('blob:photo');
	window.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
	cleanup();
	setMatrixClientServiceRef(null);
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('encrypted attachment — the ciphertext fetch', () => {
	const encryptedAttachment = {
		title: 'photo.png',
		downloadUrl: '',
		mxcUrl: 'mxc://hs/media-1',
		type: 'image',
		mediaType: 'image/png',
		size: 12,
		encryptedFile
	};

	it('fetches the ciphertext from the authenticated endpoint', async () => {
		renderAttachment(encryptedAttachment);

		screen.getByRole('button').click();

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		expect(fetchMock.mock.calls[0][0]).toBe(
			`${HOMESERVER}/_matrix/client/v1/media/download/hs/media-1`
		);
		expect(fetchMock.mock.calls[0][0]).not.toContain('/_matrix/media/');
	});

	it('sends the Matrix access token, never the Keycloak one', async () => {
		renderAttachment(encryptedAttachment);

		screen.getByRole('button').click();

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		const authorization = fetchMock.mock.calls[0][1]?.headers?.Authorization;
		expect(authorization).toBe(`Bearer ${MATRIX_TOKEN}`);
		expect(authorization).not.toContain(KEYCLOAK_TOKEN);
	});
});

describe('unencrypted homeserver media', () => {
	const plainAttachment = {
		title: 'photo.png',
		downloadUrl: '',
		mxcUrl: 'mxc://hs/media-2',
		type: 'image',
		mediaType: 'image/png',
		size: 12
	};

	it('renders the image from an object URL, not from a naked media path', async () => {
		renderAttachment(plainAttachment);

		const img = await screen.findByRole('img');
		expect(img.getAttribute('src')).toBe('blob:photo');
	});

	it('fetches it with the Matrix token from the authenticated endpoint', async () => {
		renderAttachment(plainAttachment);

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		expect(fetchMock.mock.calls[0][0]).toBe(
			`${HOMESERVER}/_matrix/client/v1/media/download/hs/media-2`
		);
		expect(fetchMock.mock.calls[0][1]?.headers?.Authorization).toBe(
			`Bearer ${MATRIX_TOKEN}`
		);
	});

	it('does not request an unrevealed guest image at all', async () => {
		render(
			<NotificationsContext.Provider
				value={{ addNotification: vi.fn() } as never}
			>
				<MessageAttachment
					attachment={plainAttachment as never}
					file={imageFile}
					hasRenderedMessage
					rid="room-1"
					mediaCheckState="unchecked"
				/>
			</NotificationsContext.Provider>
		);

		await screen.findByText('attachments.mediaCheck.unchecked');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('does not offer a download link before the bytes have arrived', () => {
		fetchMock.mockReturnValue(new Promise(() => {}));

		const { container } = renderAttachment({
			...plainAttachment,
			type: 'file',
			mediaType: 'application/pdf'
		});

		expect(container.querySelector('a')).toBeNull();
	});
});
