import { withTimeout } from '../utils/promiseTimeout';
import {
	readRecoveryRoot,
	serverBackedSecretStorage
} from './matrixRecoveryAccountData';
import type { MatrixClient } from 'matrix-js-sdk';
import {
	SECRET_STORAGE_ALGORITHM_V1_AES,
	type SecretStorageKeyDescription,
	type SecretStorageKeyDescriptionAesV1
} from 'matrix-js-sdk/lib/secret-storage';
import {
	decodeRecoveryKey,
	CrossSigningKey
} from 'matrix-js-sdk/lib/crypto-api';
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

/** Scoped to the SDK client, never a module-wide key offered to arbitrary IDs. */
let pendingKeys = new WeakMap<
	MatrixClient,
	{ keys: Map<string, Uint8Array>; candidate?: Uint8Array }
>();

export const clearSecretStorageKeys = (client?: MatrixClient): void => {
	if (client) pendingKeys.delete(client);
	else pendingKeys = new WeakMap();
};

const activeSecretStorageScopes = new WeakSet<MatrixClient>();

export class SecretStorageBusyError extends Error {
	constructor() {
		super('Secret storage recovery is already running');
		this.name = 'SecretStorageBusyError';
	}
}

export const withSecretStorageKeys = async <T>(
	client: MatrixClient,
	keys: Map<string, Uint8Array>,
	run: () => Promise<T>,
	candidate?: Uint8Array
): Promise<T> => {
	if (activeSecretStorageScopes.has(client))
		throw new SecretStorageBusyError();
	activeSecretStorageScopes.add(client);
	const scope = { keys, candidate };
	pendingKeys.set(client, scope);
	try {
		return await run();
	} finally {
		if (pendingKeys.get(client) === scope) pendingKeys.delete(client);
		activeSecretStorageScopes.delete(client);
	}
};

export const secretStorageKeyCallback = async (
	client: MatrixClient,
	{ keys }: { keys: Record<string, SecretStorageKeyDescription> },
	_name: string
): Promise<[string, Uint8Array] | null> => {
	const scope = pendingKeys.get(client);
	if (!scope) return null;
	for (const [id, info] of Object.entries(keys)) {
		const key = scope.keys.get(id) ?? scope.candidate;
		// During bootstrap the SDK assigns the new root ID. Validate its MAC
		// before binding the candidate to that ID; a wrapping key has no candidate.
		if (
			key &&
			typeof (info as SecretStorageKeyDescriptionAesV1).mac ===
				'string' &&
			info.algorithm === SECRET_STORAGE_ALGORITHM_V1_AES &&
			(await client.secretStorage.checkKey(
				key,
				info as SecretStorageKeyDescriptionAesV1
			)) &&
			pendingKeys.get(client) === scope
		)
			return [id, key];
	}
	return null;
};

export const validateRecoveryKey = async (
	client: MatrixClient,
	encoded: string
): Promise<[string, Uint8Array]> => {
	let bytes: Uint8Array;
	try {
		bytes = decodeRecoveryKey(encoded.trim());
	} catch {
		throw new InvalidRecoveryKeyError();
	}
	const root = await readRecoveryRoot(client);
	if (
		!root ||
		root[1].algorithm !== SECRET_STORAGE_ALGORITHM_V1_AES ||
		!(await client.secretStorage.checkKey(
			bytes,
			root[1] as SecretStorageKeyDescriptionAesV1
		))
	)
		throw new InvalidRecoveryKeyError();
	return [root[0], bytes];
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
 * May the app bootstrap the Tresor on its own, without asking first?
 *
 * Only on a genuinely fresh identity. Bootstrapping replaces secret storage
 * and creates a new backup version, so doing it silently while the server
 * already holds a backup would orphan history the user can still recover
 * with their existing key. Those accounts keep the explicit path in the
 * Sicherheit panel.
 */
export const canBootstrapSilently = (status: EncryptionSetupStatus): boolean =>
	!status.serverBackupExists && !status.secretStorageReady;

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
	return withSecretStorageKeys(
		client,
		new Map(),
		async () => {
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
			return generated.encodedPrivateKey;
		},
		generated.privateKey
	);
};

/**
 * Recovery on a new device (or out-of-sync repair): the user enters their
 * recovery key; we unlock secret storage with it, load the backup private
 * key, and restore the encrypted history from the server backup.
 */
const readCrossSigningPublicIds = async (
	client: MatrixClient
): Promise<string[]> => {
	const userId = client.getUserId();
	if (!userId) throw new Error('Authenticated identity unavailable');
	const response = await withTimeout(
		client.downloadKeysForUsers([userId]),
		15000,
		'Cross-signing identity query timed out'
	);
	return ['master_keys', 'self_signing_keys', 'user_signing_keys'].map(
		(type) => {
			const values = Object.values(response[type]?.[userId]?.keys ?? {});
			if (
				values.length !== 1 ||
				typeof values[0] !== 'string' ||
				!values[0]
			)
				throw new Error(
					'Existing public cross-signing identity unavailable'
				);
			return values[0];
		}
	);
};

export const recoverWithKey = async (
	client: MatrixClient,
	encodedRecoveryKey: string
): Promise<{ imported: number; total: number }> => {
	const crypto = getCryptoOrThrow(client);

	const [rootId, privateKey] = await validateRecoveryKey(
		client,
		encodedRecoveryKey
	);
	return withSecretStorageKeys(
		client,
		new Map([[rootId, privateKey]]),
		async () => {
			await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
			const result = await crypto.restoreKeyBackup();

			// bootstrapCrossSigning may generate a replacement identity when secrets
			// are incomplete. Import the existing identity and sign this device only.
			const storage = serverBackedSecretStorage(client, {
				getSecretStorageKey: (keys, name) =>
					secretStorageKeyCallback(client, keys, name)
			});
			const [master, selfSigning, userSigning] = await Promise.all([
				storage.get('m.cross_signing.master'),
				storage.get('m.cross_signing.self_signing'),
				storage.get('m.cross_signing.user_signing')
			]);
			if (
				!master ||
				!selfSigning ||
				!userSigning ||
				!crypto.importSecretsBundle ||
				!(await crypto.userHasCrossSigningKeys(
					client.getUserId()!,
					true
				))
			)
				throw new Error('Existing cross-signing identity unavailable');
			const published = await readCrossSigningPublicIds(client);
			await crypto.importSecretsBundle({
				cross_signing: {
					master_key: master,
					self_signing_key: selfSigning,
					user_signing_key: userSigning
				}
			});
			const imported = await Promise.all(
				[
					CrossSigningKey.Master,
					CrossSigningKey.SelfSigning,
					CrossSigningKey.UserSigning
				].map((type) => crypto.getCrossSigningKeyId(type))
			);
			const currentPublished = await readCrossSigningPublicIds(client);
			if (
				JSON.stringify(published) !== JSON.stringify(imported) ||
				JSON.stringify(published) !== JSON.stringify(currentPublished)
			)
				throw new Error(
					'Recovered cross-signing identity does not match the published identity'
				);
			const cached = (await crypto.getCrossSigningStatus())
				.privateKeysCachedLocally;
			const deviceId = client.getDeviceId();
			if (
				!cached.masterKey ||
				!cached.selfSigningKey ||
				!cached.userSigningKey ||
				!deviceId
			)
				throw new Error(
					'Existing cross-signing identity could not be imported'
				);
			await crypto.crossSignDevice(deviceId);
			return { imported: result.imported, total: result.total };
		}
	);
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
