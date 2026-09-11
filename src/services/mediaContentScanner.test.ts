import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatrixEncryptedFile } from '../utils/matrixEncryptedAttachment';

const getMediaScannerUrl = vi.fn<() => string>();

vi.mock('../resources/scripts/runtimeConfig', () => ({
	getMediaScannerUrl: () => getMediaScannerUrl()
}));

/**
 * Stand-in for the Olm public-key encryption the real scanner protocol uses.
 * The test asserts the shape the scanner receives, not the cipher itself —
 * that belongs to the crypto library, which has its own test suite.
 */
vi.mock('@matrix-org/matrix-sdk-crypto-wasm', () => {
	class Curve25519PublicKey {
		constructor(public readonly key: string) {}
	}
	class PkEncryption {
		private constructor(private readonly publicKey: Curve25519PublicKey) {}
		static fromKey(publicKey: Curve25519PublicKey) {
			return new PkEncryption(publicKey);
		}
		encryptString(message: string) {
			return {
				toBase64: () => ({
					// Not real Olm, but it does hide the plaintext, so a test
					// asserting "the keys never travel readable" means something.
					ciphertext: btoa(message),
					mac: 'mac',
					ephemeralKey: `ephemeral-for-${this.publicKey.key}`
				})
			};
		}
	}
	return {
		Curve25519PublicKey,
		PkEncryption,
		initAsync: async () => undefined
	};
});

const encryptedFile: MatrixEncryptedFile = {
	url: 'mxc://oriso.example/abc123',
	key: {
		alg: 'A256CTR',
		ext: true,
		k: 'key-material',
		key_ops: ['encrypt', 'decrypt'],
		kty: 'oct'
	},
	iv: 'iv-material',
	hashes: { sha256: 'hash' },
	v: 'v2'
};

const publicKeyResponse = () =>
	new Response(JSON.stringify({ public_key: 'scanner-public-key' }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});

const notCleanResponse = () =>
	new Response(
		JSON.stringify({ reason: 'MCS_MEDIA_NOT_CLEAN', info: 'Eicar-Test' }),
		{ status: 403, headers: { 'Content-Type': 'application/json' } }
	);

let fetchMock: ReturnType<typeof vi.fn>;

const importModule = async () => import('./mediaContentScanner');

beforeEach(async () => {
	vi.resetModules();
	getMediaScannerUrl.mockReturnValue(
		'https://pre-dev.example.org/_matrix/media_proxy/unstable'
	);
	fetchMock = vi.fn();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('isMediaContentScannerEnabled', () => {
	it('is off while no scanner is configured', async () => {
		getMediaScannerUrl.mockReturnValue('');
		const { isMediaContentScannerEnabled } = await importModule();

		expect(isMediaContentScannerEnabled()).toBe(false);
	});

	it('is on once a scanner URL is configured', async () => {
		const { isMediaContentScannerEnabled } = await importModule();

		expect(isMediaContentScannerEnabled()).toBe(true);
	});
});

describe('getScannedMediaDownloadPath', () => {
	it('rewrites an mxc URI onto the scanner', async () => {
		const { getScannedMediaDownloadPath } = await importModule();

		expect(getScannedMediaDownloadPath('mxc://oriso.example/abc123')).toBe(
			'https://pre-dev.example.org/_matrix/media_proxy/unstable/download/oriso.example/abc123'
		);
	});

	it('returns null while no scanner is configured, so callers keep the old path', async () => {
		getMediaScannerUrl.mockReturnValue('');
		const { getScannedMediaDownloadPath } = await importModule();

		expect(
			getScannedMediaDownloadPath('mxc://oriso.example/abc123')
		).toBeNull();
	});

	it('returns null for anything that is not an mxc URI', async () => {
		const { getScannedMediaDownloadPath } = await importModule();

		expect(
			getScannedMediaDownloadPath('https://elsewhere/file')
		).toBeNull();
	});
});

describe('downloadScannedEncryptedMedia', () => {
	it('forwards the file keys sealed to the scanner public key', async () => {
		fetchMock
			.mockResolvedValueOnce(publicKeyResponse())
			.mockResolvedValueOnce(
				new Response(new Uint8Array([1, 2, 3]), { status: 200 })
			);
		const { downloadScannedEncryptedMedia } = await importModule();

		const outcome = await downloadScannedEncryptedMedia(encryptedFile);

		expect(outcome.verdict).toBe('safe');

		const [publicKeyUrl] = fetchMock.mock.calls[0];
		expect(publicKeyUrl).toBe(
			'https://pre-dev.example.org/_matrix/media_proxy/unstable/public_key'
		);

		const [downloadUrl, request] = fetchMock.mock.calls[1];
		expect(downloadUrl).toBe(
			'https://pre-dev.example.org/_matrix/media_proxy/unstable/download_encrypted'
		);
		const body = JSON.parse(request.body as string);
		expect(Object.keys(body)).toEqual(['encrypted_body']);
		expect(body.encrypted_body).toEqual({
			ciphertext: btoa(JSON.stringify({ file: encryptedFile })),
			mac: 'mac',
			ephemeral: 'ephemeral-for-scanner-public-key'
		});
	});

	it('never sends the file keys in the clear', async () => {
		fetchMock
			.mockResolvedValueOnce(publicKeyResponse())
			.mockResolvedValueOnce(
				new Response(new Uint8Array([1, 2, 3]), { status: 200 })
			);
		const { downloadScannedEncryptedMedia } = await importModule();

		await downloadScannedEncryptedMedia(encryptedFile);

		const [, request] = fetchMock.mock.calls[1];
		expect(request.body).not.toContain(encryptedFile.key.k);
		expect(request.body).not.toContain(encryptedFile.iv);
		// The protocol also accepts an unsealed `file` body. We must never use it.
		expect(JSON.parse(request.body as string).file).toBeUndefined();
	});

	it('returns the plaintext the scanner released', async () => {
		fetchMock
			.mockResolvedValueOnce(publicKeyResponse())
			.mockResolvedValueOnce(
				new Response(new Uint8Array([7, 8, 9]), { status: 200 })
			);
		const { downloadScannedEncryptedMedia } = await importModule();

		const outcome = await downloadScannedEncryptedMedia(encryptedFile);

		expect(outcome.verdict).toBe('safe');
		expect(
			outcome.verdict === 'safe'
				? Array.from(new Uint8Array(outcome.data))
				: null
		).toEqual([7, 8, 9]);
	});

	it('blocks a file the scanner rejected', async () => {
		fetchMock
			.mockResolvedValueOnce(publicKeyResponse())
			.mockResolvedValueOnce(notCleanResponse());
		const { downloadScannedEncryptedMedia } = await importModule();

		const outcome = await downloadScannedEncryptedMedia(encryptedFile);

		expect(outcome.verdict).toBe('blocked');
	});

	it('blocks a forbidden mime type', async () => {
		fetchMock
			.mockResolvedValueOnce(publicKeyResponse())
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ reason: 'MCS_MIME_TYPE_FORBIDDEN' }),
					{
						status: 403
					}
				)
			);
		const { downloadScannedEncryptedMedia } = await importModule();

		const outcome = await downloadScannedEncryptedMedia(encryptedFile);

		expect(outcome.verdict).toBe('blocked');
	});

	it('does not release the file when the scanner is unreachable', async () => {
		fetchMock
			.mockResolvedValueOnce(publicKeyResponse())
			.mockRejectedValueOnce(new Error('network down'));
		const { downloadScannedEncryptedMedia } = await importModule();

		const outcome = await downloadScannedEncryptedMedia(encryptedFile);

		expect(outcome.verdict).toBe('error');
	});

	it('does not release the file when the media repository is unavailable', async () => {
		fetchMock
			.mockResolvedValueOnce(publicKeyResponse())
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ reason: 'MCS_MEDIA_REQUEST_FAILED' }),
					{ status: 502 }
				)
			);
		const { downloadScannedEncryptedMedia } = await importModule();

		const outcome = await downloadScannedEncryptedMedia(encryptedFile);

		expect(outcome.verdict).toBe('error');
	});

	it('does not fall back to plaintext when the public key cannot be fetched', async () => {
		fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
		const { downloadScannedEncryptedMedia } = await importModule();

		const outcome = await downloadScannedEncryptedMedia(encryptedFile);

		expect(outcome.verdict).toBe('error');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('refuses to run at all while no scanner is configured', async () => {
		getMediaScannerUrl.mockReturnValue('');
		const { downloadScannedEncryptedMedia } = await importModule();

		const outcome = await downloadScannedEncryptedMedia(encryptedFile);

		expect(outcome.verdict).toBe('error');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('fetches the scanner public key only once per session', async () => {
		fetchMock
			.mockResolvedValueOnce(publicKeyResponse())
			.mockResolvedValue(
				new Response(new Uint8Array([1]), { status: 200 })
			);
		const { downloadScannedEncryptedMedia } = await importModule();

		await downloadScannedEncryptedMedia(encryptedFile);
		await downloadScannedEncryptedMedia(encryptedFile);

		const publicKeyCalls = fetchMock.mock.calls.filter(([url]) =>
			String(url).endsWith('/public_key')
		);
		expect(publicKeyCalls).toHaveLength(1);
	});
});
