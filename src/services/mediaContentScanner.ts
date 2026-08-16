/**
 * Client side of the matrix-content-scanner protocol
 * (epic ORISO-Admin#366 phase 2, issue #1072, ADR-019).
 *
 * ADR-019 promises a fail-closed scan: an unchecked or rejected file must be
 * inaccessible, not merely hidden. That promise was written while Matrix
 * crypto was off, when a proxying scanner could simply read the file. E2EE is
 * permanently on now, so a plain proxy sees ciphertext and would clear
 * everything it cannot understand.
 *
 * The scanner therefore offers an encrypted-media path: the client seals the
 * file's decryption keys to the scanner's published public key and POSTs them,
 * and the scanner fetches, decrypts, scans and only then releases the file.
 *
 * Two rules hold everywhere in this module:
 *
 *   1. **Never in the clear.** The protocol also accepts an unsealed `file`
 *      body. We do not use it. If the public key cannot be fetched, the media
 *      stays blocked — we do not trade the file keys for a preview.
 *   2. **No verdict means blocked.** Every failure — unreachable scanner,
 *      timeout, unparseable answer, media repository down — resolves to a
 *      verdict that keeps the file away from the user.
 *
 * The module is inert until an environment configures a scanner URL.
 */
import { getMediaScannerUrl } from '../resources/scripts/runtimeConfig';
import type { MatrixEncryptedFile } from '../utils/matrixEncryptedAttachment';

/**
 * `safe` carries the plaintext the scanner released. `blocked` means the
 * scanner judged the file and rejected it. `error` means no judgement could be
 * obtained — treated exactly as strictly as `blocked`, but distinguishable so
 * the UI can say something honest.
 */
export type MediaScanOutcome =
	| { verdict: 'safe'; data: ArrayBuffer }
	| { verdict: 'blocked'; reason: string }
	| { verdict: 'error'; reason: string };

/** Verdicts the scanner returns about the file itself, rather than about its own health. */
const REJECTION_REASONS = ['MCS_MEDIA_NOT_CLEAN', 'MCS_MIME_TYPE_FORBIDDEN'];

const MXC_PREFIX = 'mxc://';

let publicKeyRequest: Promise<string> | null = null;

const scannerBaseUrl = (): string =>
	(getMediaScannerUrl() || '').replace(/\/+$/, '');

/** Whether this environment routes media through a content scanner at all. */
export const isMediaContentScannerEnabled = (): boolean =>
	Boolean(scannerBaseUrl());

const parseMxcUri = (
	contentUrl: string
): { serverName: string; mediaId: string } | null => {
	if (!contentUrl?.startsWith(MXC_PREFIX)) {
		return null;
	}
	const [serverName, mediaId] = contentUrl
		.substring(MXC_PREFIX.length)
		.split('/');
	if (!serverName || !mediaId) {
		return null;
	}
	return { serverName, mediaId };
};

/**
 * Scanner URL for unencrypted media, or `null` when there is nothing to route
 * to — callers then keep their previous path. Legacy media from before the
 * E2EE migration reaches the same scanner through this endpoint.
 */
export const getScannedMediaDownloadPath = (
	contentUrl: string
): string | null => {
	const base = scannerBaseUrl();
	if (!base) {
		return null;
	}
	const mxc = parseMxcUri(contentUrl);
	if (!mxc) {
		return null;
	}
	return `${base}/download/${mxc.serverName}/${mxc.mediaId}`;
};

const fetchScannerPublicKey = async (base: string): Promise<string> => {
	const response = await fetch(`${base}/public_key`);
	if (!response.ok) {
		throw new Error(
			`Content scanner public key request failed: ${response.status}`
		);
	}
	const payload = await response.json();
	const publicKey = payload?.public_key;
	if (typeof publicKey !== 'string' || !publicKey) {
		throw new Error('Content scanner returned no public key');
	}
	return publicKey;
};

/**
 * The key is stable for the lifetime of a scanner deployment, so it is fetched
 * once per session. A failed fetch is not remembered — the next attachment
 * tries again rather than staying blocked because of one bad moment.
 */
const getScannerPublicKey = (base: string): Promise<string> => {
	if (!publicKeyRequest) {
		publicKeyRequest = fetchScannerPublicKey(base).catch((error) => {
			publicKeyRequest = null;
			throw error;
		});
	}
	return publicKeyRequest;
};

/** Test seam; also lets a re-login pick up a redeployed scanner. */
export const resetMediaContentScannerSession = (): void => {
	publicKeyRequest = null;
};

const sealRequestBody = async (
	payload: unknown,
	publicKey: string
): Promise<{ ciphertext: string; mac: string; ephemeral: string }> => {
	const { Curve25519PublicKey, PkEncryption, initAsync } = await import(
		'@matrix-org/matrix-sdk-crypto-wasm'
	);
	await initAsync();
	const encryption = PkEncryption.fromKey(new Curve25519PublicKey(publicKey));
	const sealed = encryption.encryptString(JSON.stringify(payload)).toBase64();
	return {
		ciphertext: sealed.ciphertext,
		mac: sealed.mac,
		ephemeral: sealed.ephemeralKey
	};
};

const readRejectionReason = async (response: Response): Promise<string> => {
	try {
		const payload = await response.json();
		return typeof payload?.reason === 'string' ? payload.reason : '';
	} catch {
		return '';
	}
};

/**
 * Ask the scanner for a file the client cannot show without it.
 *
 * Resolves rather than throws: every caller has to render *something*, and a
 * thrown error is far too easy to swallow into an accidental reveal.
 */
export const downloadScannedEncryptedMedia = async (
	encryptedFile: MatrixEncryptedFile
): Promise<MediaScanOutcome> => {
	const base = scannerBaseUrl();
	if (!base) {
		return { verdict: 'error', reason: 'no-scanner-configured' };
	}

	let encryptedBody;
	try {
		const publicKey = await getScannerPublicKey(base);
		encryptedBody = await sealRequestBody(
			{ file: encryptedFile },
			publicKey
		);
	} catch (error) {
		// Deliberately no unsealed fallback: a preview is not worth handing the
		// file keys to whatever sits between the client and the scanner.
		return {
			verdict: 'error',
			reason: `key-forwarding-unavailable: ${(error as Error)?.message}`
		};
	}

	let response: Response;
	try {
		response = await fetch(`${base}/download_encrypted`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ encrypted_body: encryptedBody })
		});
	} catch (error) {
		return {
			verdict: 'error',
			reason: `scanner-unreachable: ${(error as Error)?.message}`
		};
	}

	if (response.ok) {
		try {
			return { verdict: 'safe', data: await response.arrayBuffer() };
		} catch (error) {
			return {
				verdict: 'error',
				reason: `unreadable-response: ${(error as Error)?.message}`
			};
		}
	}

	const reason = await readRejectionReason(response);
	if (REJECTION_REASONS.includes(reason)) {
		return { verdict: 'blocked', reason };
	}

	// Everything else — 401/404/500/502, or a body we cannot parse — is the
	// scanner failing to judge, not the file being cleared.
	return {
		verdict: 'error',
		reason: reason || `scan-failed-${response.status}`
	};
};
