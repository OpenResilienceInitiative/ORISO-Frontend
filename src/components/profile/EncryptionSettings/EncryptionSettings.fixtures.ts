import type { MatrixClient } from 'matrix-js-sdk';
import { registerDeviceSigningAuth } from '../../../services/matrixInteractiveAuth';
import type { EncryptionSetupStatus } from '../../../services/matrixKeyBackupService';

export const DEMO_RECOVERY_KEY =
	'EsTc XKzB 4Dcp 8xWm Jvqa 2S9d Hn3f Ky6R pQ7u Vw1z';

export const buildFakeClient = (
	overrides: Partial<Record<string, unknown>> = {}
): MatrixClient => {
	const crypto = {
		isSecretStorageReady: async () => true,
		isCrossSigningReady: async () => true,
		getActiveSessionBackupVersion: async () => '3',
		getKeyBackupInfo: async () => ({ version: '3' }),
		getSessionBackupPrivateKey: async () => new Uint8Array(32),
		createRecoveryKeyFromPassphrase: async () => ({
			encodedPrivateKey: DEMO_RECOVERY_KEY,
			privateKey: new Uint8Array(32),
			keyInfo: {}
		}),
		bootstrapCrossSigning: async () => undefined,
		bootstrapSecretStorage: async () => undefined,
		resetKeyBackup: async () => undefined,
		checkKeyBackupAndEnable: async () => ({}),
		loadSessionBackupPrivateKeyFromSecretStorage: async () => undefined,
		restoreKeyBackup: async () => ({ imported: 42, total: 42 }),
		resetEncryption: async () => undefined,
		...overrides
	};
	const client = {
		clientRunning: true,
		getCrypto: () => crypto,
		getUserId: () => '@encryption-story:example.test',
		secretStorage: { checkKey: async () => true }
	} as unknown as MatrixClient;
	registerDeviceSigningAuth(client, async (makeRequest) => makeRequest(null));
	return client;
};

export const statusNotSetUp: EncryptionSetupStatus = {
	secretStorageReady: false,
	crossSigningReady: false,
	activeBackupVersion: null,
	serverBackupExists: false,
	keyStorageOutOfSync: false
};

export const statusHealthy: EncryptionSetupStatus = {
	secretStorageReady: true,
	crossSigningReady: true,
	activeBackupVersion: '3',
	serverBackupExists: true,
	keyStorageOutOfSync: false
};

export const statusOutOfSync: EncryptionSetupStatus = {
	secretStorageReady: false,
	crossSigningReady: false,
	activeBackupVersion: null,
	serverBackupExists: true,
	keyStorageOutOfSync: true
};
