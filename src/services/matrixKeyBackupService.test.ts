import { describe, expect, it, vi, beforeEach } from 'vitest';
import { encodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api';
import {
	getEncryptionStatus,
	setUpRecovery,
	recoverWithKey,
	resetCryptoIdentity,
	secretStorageKeyCallback,
	InvalidRecoveryKeyError,
	CryptoUnavailableError,
	RecoverySetupPhaseError
} from './matrixKeyBackupService';

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

const buildClient = (crypto: unknown) => ({ getCrypto: () => crypto }) as any;

describe('matrixKeyBackupService (#437)', () => {
	beforeEach(async () => {
		// Drain any pending key left over from a failed test.
		await secretStorageKeyCallback(
			{ keys: {} } as any,
			'm.megolm_backup.v1'
		);
	});

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
			const encoded = await setUpRecovery(buildClient(crypto));

			expect(encoded).toBe(VALID_ENCODED_KEY);
			expect(crypto.bootstrapCrossSigning).toHaveBeenCalled();
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
			const crypto = buildCrypto({
				bootstrapSecretStorage: vi.fn(async () => {
					keyDuringFlow = await secretStorageKeyCallback(
						{ keys: { 'key-id-1': {} } } as any,
						'm.cross_signing.master'
					);
				})
			});

			await setUpRecovery(buildClient(crypto));

			expect(keyDuringFlow).toEqual(['key-id-1', VALID_KEY_BYTES]);
			// After the flow the cache is drained — callback yields null.
			await expect(
				secretStorageKeyCallback(
					{ keys: { 'key-id-1': {} } } as any,
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

			const failure = await setUpRecovery(buildClient(crypto)).catch(
				(error) => error
			);
			expect(failure).toBeInstanceOf(RecoverySetupPhaseError);
			expect(failure.phase).toBe('secret-storage');
			expect(failure.message).not.toContain('sensitive sdk payload');
			await expect(
				secretStorageKeyCallback(
					{ keys: { 'key-id-1': {} } } as any,
					'm.cross_signing.master'
				)
			).resolves.toBeNull();
		});

		it('does not expose a recovery key when the new backup is not durably stored in secret storage', async () => {
			const crypto = buildCrypto({
				isSecretStorageReady: vi.fn().mockResolvedValue(false)
			});

			const failure = await setUpRecovery(buildClient(crypto)).catch(
				(error) => error
			);
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
			expect(crypto.bootstrapCrossSigning).toHaveBeenCalled();
		});

		it('clears the cached key after recovery, success or failure', async () => {
			const crypto = buildCrypto({
				restoreKeyBackup: vi.fn().mockRejectedValue(new Error('nope'))
			});

			await expect(
				recoverWithKey(buildClient(crypto), VALID_ENCODED_KEY)
			).rejects.toThrow('nope');
			await expect(
				secretStorageKeyCallback(
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
