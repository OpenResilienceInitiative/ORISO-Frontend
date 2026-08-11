import type { MatrixClient } from 'matrix-js-sdk';
import type { SecretStorageKeyDescription } from 'matrix-js-sdk/lib/secret-storage';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api';
import { getDeviceSigningAuth } from './matrixInteractiveAuth';

/**
 * #437 Key backup + recovery UX — thin service layer over matrix-js-sdk's
 * CryptoApi (Apache-2.0; the SDK provides backup + secret storage completely,
 * we only orchestrate). UX pattern adapted from element-web's Encryption
 * settings tab (AGPL), reimplemented for ORISO — no source copied.
 *
 * Mandatory before the Megolm cutover (ADR-012): without server-side key
 * backup + a recovery key, losing the device means unreadable case history.
 */

export class CryptoUnavailableError extends Error {
	constructor() {
		super('Matrix client has no crypto initialized');
		this.name = 'CryptoUnavailableError';
	}
}

export class InvalidRecoveryKeyError extends Error {
	constructor() {
		super('The entered recovery key is not valid');
		this.name = 'InvalidRecoveryKeyError';
	}
}

export type RecoverySetupPhase =
	| 'cross-signing'
	| 'secret-storage'
	| 'key-backup-creation'
	| 'key-backup';

export class RecoverySetupPhaseError extends Error {
	constructor(
		public readonly phase: RecoverySetupPhase,
		cause: unknown
	) {
		super(`Recovery setup failed during ${phase}`, { cause });
		this.name = 'RecoverySetupPhaseError';
	}
}

const runRecoverySetupPhase = async <T>(
	phase: RecoverySetupPhase,
	operation: () => Promise<T>
): Promise<T> => {
	try {
		return await operation();
	} catch (error) {
		throw new RecoverySetupPhaseError(phase, error);
	}
};

export type EncryptionSetupStatus = {
	/** 4S (secret storage) is set up and usable. */
	secretStorageReady: boolean;
	/** Cross-signing identity exists and this device can use it. */
	crossSigningReady: boolean;
	/** Backup version this device actively backs up to (null = none). */
	activeBackupVersion: string | null;
	/** A key backup exists on the server (any device may have created it). */
	serverBackupExists: boolean;
	/**
	 * Element's "key storage out of sync": the server has a backup but this
	 * device holds no backup private key — history stays unreadable until the
	 * user re-enters the recovery key (repair path).
	 */
	keyStorageOutOfSync: boolean;
};

/**
 * One-shot in-memory cache for the secret-storage private key while a
 * setup/recovery flow is running. The SDK pulls it via the
 * `getSecretStorageKey` crypto callback (wired in createMatrixClient); it is
 * never persisted and cleared in `finally` of every flow.
 */
let pendingSecretStorageKey: Uint8Array | null = null;

const setPendingKey = (key: Uint8Array | null): void => {
	pendingSecretStorageKey = key;
};

/**
 * `cryptoCallbacks.getSecretStorageKey` implementation. Returns the cached
 * key for the first key id the SDK asks about, or null when no flow is
 * running (the SDK then aborts the secret read gracefully).
 */
export const secretStorageKeyCallback = async (
	{ keys }: { keys: Record<string, SecretStorageKeyDescription> },
	_name: string
): Promise<[string, Uint8Array] | null> => {
	if (!pendingSecretStorageKey) {
		return null;
	}
	const [keyId] = Object.keys(keys);
	if (!keyId) {
		// Defensive drain (also used by tests to reset the cache).
		pendingSecretStorageKey = null;
		return null;
	}
	return [keyId, pendingSecretStorageKey];
};

const getCryptoOrThrow = (client: MatrixClient) => {
	const crypto = client.getCrypto();
	if (!crypto) {
		throw new CryptoUnavailableError();
	}
	return crypto;
};

export const getEncryptionStatus = async (
	client: MatrixClient
): Promise<EncryptionSetupStatus> => {
	const crypto = getCryptoOrThrow(client);

	const [
		secretStorageReady,
		crossSigningReady,
		activeBackupVersion,
		backupInfo,
		sessionBackupKey
	] = await Promise.all([
		crypto.isSecretStorageReady(),
		crypto.isCrossSigningReady(),
		crypto.getActiveSessionBackupVersion(),
		crypto.getKeyBackupInfo(),
		crypto.getSessionBackupPrivateKey()
	]);

	const serverBackupExists = backupInfo !== null;
	return {
		secretStorageReady,
		crossSigningReady,
		activeBackupVersion,
		serverBackupExists,
		keyStorageOutOfSync: serverBackupExists && sessionBackupKey === null
	};
};

/**
 * First-time setup: generate a recovery key, bootstrap cross-signing and
 * secret storage with it, and enable server-side key backup.
 *
 * @returns the encoded recovery key — display it to the user exactly once
 *     ("store this safely"), then drop it; it is not retrievable later.
 */
export const setUpRecovery = async (client: MatrixClient): Promise<string> => {
	const crypto = getCryptoOrThrow(client);
	const authUploadDeviceSigningKeys = getDeviceSigningAuth(client);
	if (!authUploadDeviceSigningKeys) {
		throw new Error('Matrix device-signing authentication is unavailable');
	}

	const generated = await crypto.createRecoveryKeyFromPassphrase();
	setPendingKey(generated.privateKey);
	try {
		await runRecoverySetupPhase('cross-signing', () =>
			crypto.bootstrapCrossSigning({ authUploadDeviceSigningKeys })
		);
		await runRecoverySetupPhase('secret-storage', () =>
			crypto.bootstrapSecretStorage({
				createSecretStorageKey: async () => generated,
				// Let the SDK create the backup while the new secret-storage
				// key is still part of the same bootstrap transaction. Creating
				// it afterwards can miss m.megolm_backup.v1 until the account
				// data cache catches up, so the setup looks healthy only until
				// the next reload.
				setupNewKeyBackup: true
			})
		);
		await runRecoverySetupPhase('key-backup', async () => {
			await crypto.checkKeyBackupAndEnable();
			if (!(await crypto.isSecretStorageReady())) {
				throw new Error(
					'Recovery setup did not persist the key backup secret'
				);
			}
		});
	} finally {
		setPendingKey(null);
	}

	return generated.encodedPrivateKey;
};

/**
 * Recovery on a new device (or out-of-sync repair): the user enters their
 * recovery key; we unlock secret storage with it, load the backup private
 * key, and restore the encrypted history from the server backup.
 */
export const recoverWithKey = async (
	client: MatrixClient,
	encodedRecoveryKey: string
): Promise<{ imported: number; total: number }> => {
	const crypto = getCryptoOrThrow(client);
	const authUploadDeviceSigningKeys = getDeviceSigningAuth(client);
	if (!authUploadDeviceSigningKeys) {
		throw new Error('Matrix device-signing authentication is unavailable');
	}

	let privateKey: Uint8Array;
	try {
		privateKey = decodeRecoveryKey(encodedRecoveryKey.trim());
	} catch (error) {
		throw new InvalidRecoveryKeyError();
	}

	setPendingKey(privateKey);
	try {
		await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
		const result = await crypto.restoreKeyBackup();
		// Self-verify this device against the recovered cross-signing identity.
		await crypto.bootstrapCrossSigning({ authUploadDeviceSigningKeys });
		return { imported: result.imported, total: result.total };
	} finally {
		setPendingKey(null);
	}
};

/**
 * "Forgot recovery key" path: resets the cryptographic identity
 * (cross-signing, secret storage, key backup). Destructive — previously
 * encrypted history that only the old backup could decrypt stays unreadable.
 * The caller must confirm with the user first.
 */
export const resetCryptoIdentity = async (
	client: MatrixClient
): Promise<void> => {
	const crypto = getCryptoOrThrow(client);
	const authUploadDeviceSigningKeys = getDeviceSigningAuth(client);
	if (!authUploadDeviceSigningKeys) {
		throw new Error('Matrix device-signing authentication is unavailable');
	}
	await crypto.resetEncryption(authUploadDeviceSigningKeys);
};
