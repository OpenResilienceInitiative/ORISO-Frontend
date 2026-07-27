import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { MatrixClient } from 'matrix-js-sdk';
import { EncryptionSettingsPanel } from './index';
import type { EncryptionSetupStatus } from '../../../services/matrixKeyBackupService';

/**
 * #437 Key backup + recovery UX. Stories inject a fake Matrix client (only the
 * CryptoApi methods the panel's flows touch) plus a fixed initial status, so
 * every phase renders without a homeserver.
 */

const DEMO_RECOVERY_KEY = 'EsTc XKzB 4Dcp 8xWm Jvqa 2S9d Hn3f Ky6R pQ7u Vw1z';

const buildFakeClient = (
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
		checkKeyBackupAndEnable: async () => ({}),
		loadSessionBackupPrivateKeyFromSecretStorage: async () => undefined,
		restoreKeyBackup: async () => ({ imported: 42, total: 42 }),
		resetEncryption: async () => undefined,
		...overrides
	};
	return { getCrypto: () => crypto } as unknown as MatrixClient;
};

const statusNotSetUp: EncryptionSetupStatus = {
	secretStorageReady: false,
	crossSigningReady: false,
	activeBackupVersion: null,
	serverBackupExists: false,
	keyStorageOutOfSync: false
};

const statusHealthy: EncryptionSetupStatus = {
	secretStorageReady: true,
	crossSigningReady: true,
	activeBackupVersion: '3',
	serverBackupExists: true,
	keyStorageOutOfSync: false
};

const statusOutOfSync: EncryptionSetupStatus = {
	secretStorageReady: false,
	crossSigningReady: false,
	activeBackupVersion: null,
	serverBackupExists: true,
	keyStorageOutOfSync: true
};

const meta = {
	title: 'Organisms/EncryptionSettingsPanel',
	component: EncryptionSettingsPanel,
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 480, padding: 16 }}>
				<Story />
			</div>
		)
	],
	parameters: {
		docs: {
			description: {
				component:
					'#437 key backup + recovery: profile "Sicherheit" panel. Setup generates a recovery key (displayed exactly once), recovery restores encrypted history on a new/out-of-sync device, reset creates a new crypto identity (destructive, two-step). UX pattern from element-web Encryption settings, reimplemented on ORISO primitives; crypto via matrix-js-sdk (Apache-2.0).'
			}
		}
	}
} satisfies Meta<typeof EncryptionSettingsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** First visit: key storage not set up yet — the setup CTA. */
export const NotSetUp: Story = {
	args: {
		clientOverride: buildFakeClient(),
		initialStatusOverride: statusNotSetUp
	}
};

/**
 * After "einrichten": the recovery key is displayed exactly once with copy +
 * stored-confirmation. Click the CTA in NotSetUp to reach this state
 * interactively; this story starts there via the fake client.
 */
export const SetupFlow: Story = {
	name: 'Setup flow (click CTA → one-time key display)',
	args: {
		clientOverride: buildFakeClient(),
		initialStatusOverride: statusNotSetUp
	}
};

/** Healthy: backup active — change-key and reset entry points. */
export const Healthy: Story = {
	args: {
		clientOverride: buildFakeClient(),
		initialStatusOverride: statusHealthy
	}
};

/**
 * Element's "key storage out of sync": a server backup exists but this device
 * has no backup key — recovery-key input repairs it.
 */
export const OutOfSync: Story = {
	args: {
		clientOverride: buildFakeClient({
			getSessionBackupPrivateKey: async () => null,
			getActiveSessionBackupVersion: async () => null,
			isSecretStorageReady: async () => false
		}),
		initialStatusOverride: statusOutOfSync
	}
};

/** Recovery rejects an invalid key with a friendly, plain-language error. */
export const OutOfSyncInvalidKey: Story = {
	name: 'Out of sync — invalid key error',
	args: {
		clientOverride: buildFakeClient({
			getSessionBackupPrivateKey: async () => null,
			isSecretStorageReady: async () => false
		}),
		initialStatusOverride: statusOutOfSync
	}
};

/** No Matrix client (e.g. before login) — graceful unavailable state. */
export const Unavailable: Story = {
	args: {
		clientOverride: null,
		initialStatusOverride: null
	}
};
