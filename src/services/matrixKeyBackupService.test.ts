import { describe, expect, it, vi, beforeEach } from 'vitest';
import { encodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api';
import {
	getEncryptionStatus,
	setUpRecovery,
	recoverWithKey,
	resetCryptoIdentity,
	secretStorageKeyCallback,
	clearSecretStorageKeys,
	InvalidRecoveryKeyError,
	CryptoUnavailableError,
	RecoverySetupPhaseError
} from './matrixKeyBackupService';
import { registerDeviceSigningAuth } from './matrixInteractiveAuth';

vi.mock('./matrixRecoveryAccountData', async (original) => ({
	...(await original<any>()),
	serverBackedSecretStorage: (client: any) => client.secretStorage
}));
/**
 * #437 Key backup + recovery UX — service layer over matrix-js-sdk's CryptoApi
 * (Apache-2.0: SDK used directly; only the element-web UX pattern is
 * reimplemented). All SDK calls are mocked; these tests pin the flows'
 * call order, the one-time key cache, and error mapping.
 */

const VALID_KEY_BYTES = new Uint8Array(32).fill(7);
const VALID_ENCODED_KEY = encodeRecoveryKey(VALID_KEY_BYTES) as string;

const generatedKey = {
	encodedPrivateKey: VALID_ENCODED_KEY,
	privateKey: VALID_KEY_BYTES,
	keyInfo: {}
};

const buildCrypto = (overrides: Record<string, unknown> = {}) => ({
	isSecretStorageReady: vi.fn().mockResolvedValue(true),
	isCrossSigningReady: vi.fn().mockResolvedValue(true),
	getActiveSessionBackupVersion: vi.fn().mockResolvedValue('3'),
	getKeyBackupInfo: vi.fn().mockResolvedValue({ version: '3' }),
	getSessionBackupPrivateKey: vi
		.fn()
		.mockResolvedValue(new Uint8Array(32).fill(1)),
	createRecoveryKeyFromPassphrase: vi.fn().mockResolvedValue(generatedKey),
	bootstrapCrossSigning: vi.fn().mockResolvedValue(undefined),
	importSecretsBundle: vi.fn().mockResolvedValue(undefined),
	userHasCrossSigningKeys: vi.fn().mockResolvedValue(true),
	getCrossSigningStatus: vi.fn().mockResolvedValue({
		privateKeysCachedLocally: {
			masterKey: true,
			selfSigningKey: true,
			userSigningKey: true
		}
	}),
	crossSignDevice: vi.fn().mockResolvedValue(undefined),
	getCrossSigningKeyId: vi.fn(async (type) => `public-${type}`),
	bootstrapSecretStorage: vi.fn().mockResolvedValue(undefined),
	resetKeyBackup: vi.fn().mockResolvedValue(undefined),
	checkKeyBackupAndEnable: vi.fn().mockResolvedValue({ backupInfo: {} }),
	loadSessionBackupPrivateKeyFromSecretStorage: vi
		.fn()
		.mockResolvedValue(undefined),
	restoreKeyBackup: vi.fn().mockResolvedValue({ imported: 12, total: 12 }),
	resetEncryption: vi.fn().mockResolvedValue(undefined),
	...overrides
});

const buildClient = (crypto: unknown) => {
	const client = {
		getCrypto: () => crypto,
		getUserId: () => '@synthetic:test',
		getDeviceId: () => 'synthetic-device',
		downloadKeysForUsers: async () =>
			Object.fromEntries(
				['master', 'self_signing', 'user_signing'].map((type) => [
					`${type}_keys`,
					{
						'@synthetic:test': {
							keys: {
								[`ed25519:public-${type}`]: `public-${type}`
							}
						}
					}
				])
			),
		http: {
			authedRequest: async (_method: string, path: string) =>
				path === '/keys/query'
					? Object.fromEntries(
							['master', 'self_signing', 'user_signing'].map(
								(type) => [
									`${type}_keys`,
									{
										'@synthetic:test': {
											keys: {
												[`ed25519:public-${type}`]: `public-${type}`
											}
										}
									}
								]
							)
						)
					: path.endsWith('m.secret_storage.default_key')
						? { key: 'key-id-1' }
						: {
								algorithm: 'm.secret_storage.v1.aes-hmac-sha2',
								mac: 'test-mac'
							}
		},
		secretStorage: {
			get: vi.fn(async () => 'synthetic-cross-signing-seed'),
			getKey: vi.fn(async () => [
				'key-id-1',
				{
					mac: 'test-mac',
					algorithm: 'm.secret_storage.v1.aes-hmac-sha2'
				}
			]),
			checkKey: vi.fn(async () => true)
		}
	} as any;
	registerDeviceSigningAuth(client, vi.fn());
	return client;
};

describe('matrixKeyBackupService (#437)', () => {
	beforeEach(() => clearSecretStorageKeys());

	describe('getEncryptionStatus', () => {
		it('maps the CryptoApi state into a status object', async () => {
			const crypto = buildCrypto();
			const status = await getEncryptionStatus(buildClient(crypto));

			expect(status).toEqual({
				secretStorageReady: true,
				crossSigningReady: true,
				activeBackupVersion: '3',
				serverBackupExists: true,
				keyStorageOutOfSync: false
			});
		});

		it('flags out-of-sync when a server backup exists but this device holds no backup key', async () => {
			const crypto = buildCrypto({
				getSessionBackupPrivateKey: vi.fn().mockResolvedValue(null),
				getActiveSessionBackupVersion: vi.fn().mockResolvedValue(null),
				isSecretStorageReady: vi.fn().mockResolvedValue(false),
				isCrossSigningReady: vi.fn().mockResolvedValue(false)
			});
			const status = await getEncryptionStatus(buildClient(crypto));

			expect(status.serverBackupExists).toBe(true);
			expect(status.keyStorageOutOfSync).toBe(true);
		});

		it('throws CryptoUnavailableError when the client has no crypto', async () => {
			await expect(
				getEncryptionStatus(buildClient(null))
			).rejects.toBeInstanceOf(CryptoUnavailableError);
		});
	});

	describe('setUpRecovery', () => {
		it('creates key backup inside secret-storage bootstrap and verifies the durable state before displaying the key', async () => {
			const crypto = buildCrypto();
			const client = buildClient(crypto);
			const authenticate = vi.fn();
			registerDeviceSigningAuth(client, authenticate);
			const encoded = await setUpRecovery(client);

			expect(encoded).toBe(VALID_ENCODED_KEY);
			expect(crypto.bootstrapCrossSigning).toHaveBeenCalledWith({
				authUploadDeviceSigningKeys: authenticate
			});
			expect(crypto.bootstrapSecretStorage).toHaveBeenCalledWith(
				expect.objectContaining({ setupNewKeyBackup: true })
			);
			expect(crypto.resetKeyBackup).not.toHaveBeenCalled();
			expect(crypto.checkKeyBackupAndEnable).toHaveBeenCalled();
			expect(
				crypto.bootstrapSecretStorage.mock.invocationCallOrder[0]
			).toBeLessThan(
				crypto.checkKeyBackupAndEnable.mock.invocationCallOrder[0]
			);
			expect(crypto.isSecretStorageReady).toHaveBeenCalled();

			// createSecretStorageKey hands the SDK the same generated key.
			const opts = crypto.bootstrapSecretStorage.mock.calls[0][0];
			await expect(opts.createSecretStorageKey()).resolves.toBe(
				generatedKey
			);
		});

		it('serves the generated key through the secret-storage callback during the flow, then clears it', async () => {
			let keyDuringFlow: [string, Uint8Array] | null = null;
			let client: any;
			const crypto = buildCrypto({
				bootstrapSecretStorage: vi.fn(async () => {
					keyDuringFlow = await secretStorageKeyCallback(
						client,
						{
							keys: {
								'key-id-1': {
									mac: 'test-mac',
									algorithm:
										'm.secret_storage.v1.aes-hmac-sha2'
								}
							}
						} as any,
						'm.cross_signing.master'
					);
				})
			});

			client = buildClient(crypto);
			await setUpRecovery(client);

			expect(keyDuringFlow).toEqual(['key-id-1', VALID_KEY_BYTES]);
			// After the flow the cache is drained — callback yields null.
			await expect(
				secretStorageKeyCallback(
					client,
					{
						keys: {
							'key-id-1': {
								mac: 'test-mac',
								algorithm: 'm.secret_storage.v1.aes-hmac-sha2'
							}
						}
					} as any,
					'm.cross_signing.master'
				)
			).resolves.toBeNull();
		});

		it('classifies the failing phase without exposing SDK details and clears the cached key', async () => {
			const crypto = buildCrypto({
				bootstrapSecretStorage: vi
					.fn()
					.mockRejectedValue(new Error('sensitive sdk payload'))
			});

			const client = buildClient(crypto);
			const failure = await setUpRecovery(client).catch((error) => error);
			expect(failure).toBeInstanceOf(RecoverySetupPhaseError);
			expect(failure.phase).toBe('secret-storage');
			expect(failure.message).not.toContain('sensitive sdk payload');
			await expect(
				secretStorageKeyCallback(
					client,
					{
						keys: {
							'key-id-1': {
								mac: 'test-mac',
								algorithm: 'm.secret_storage.v1.aes-hmac-sha2'
							}
						}
					} as any,
					'm.cross_signing.master'
				)
			).resolves.toBeNull();
		});

		it('does not expose a recovery key when the new backup is not durably stored in secret storage', async () => {
			const crypto = buildCrypto({
				isSecretStorageReady: vi.fn().mockResolvedValue(false)
			});

			const client = buildClient(crypto);
			const failure = await setUpRecovery(client).catch((error) => error);
			expect(failure).toBeInstanceOf(RecoverySetupPhaseError);
			expect(failure.phase).toBe('key-backup');
		});
	});

	describe('recoverWithKey', () => {
		it('rejects a malformed recovery key without touching the SDK', async () => {
			const crypto = buildCrypto();

			await expect(
				recoverWithKey(buildClient(crypto), 'not a real key')
			).rejects.toBeInstanceOf(InvalidRecoveryKeyError);
			expect(
				crypto.loadSessionBackupPrivateKeyFromSecretStorage
			).not.toHaveBeenCalled();
		});

		it('restores secrets and the key backup with a valid key', async () => {
			const crypto = buildCrypto();

			const result = await recoverWithKey(
				buildClient(crypto),
				`  ${VALID_ENCODED_KEY}  `
			);

			expect(result).toEqual({ imported: 12, total: 12 });
			expect(
				crypto.loadSessionBackupPrivateKeyFromSecretStorage
			).toHaveBeenCalled();
			expect(crypto.restoreKeyBackup).toHaveBeenCalled();
			expect(crypto.bootstrapCrossSigning).not.toHaveBeenCalled();
			expect(crypto.importSecretsBundle).toHaveBeenCalled();
			expect(crypto.crossSignDevice).toHaveBeenCalled();
		});

		it('clears the cached key after recovery, success or failure', async () => {
			const crypto = buildCrypto({
				restoreKeyBackup: vi.fn().mockRejectedValue(new Error('nope'))
			});

			const client = buildClient(crypto);
			await expect(
				recoverWithKey(client, VALID_ENCODED_KEY)
			).rejects.toThrow('nope');
			await expect(
				secretStorageKeyCallback(
					client,
					{ keys: { k: {} } } as any,
					'm.megolm_backup.v1'
				)
			).resolves.toBeNull();
		});
	});

	describe('resetCryptoIdentity', () => {
		it('delegates to resetEncryption', async () => {
			const crypto = buildCrypto();
			await resetCryptoIdentity(buildClient(crypto));
			expect(crypto.resetEncryption).toHaveBeenCalled();
		});
	});
});
