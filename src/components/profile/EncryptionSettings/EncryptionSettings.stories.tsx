import * as React from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { MatrixClient } from 'matrix-js-sdk';
import { UserDataContext } from '../../../globalState';
import { registerDeviceSigningAuth } from '../../../services/matrixInteractiveAuth';
import {
	clearPendingRecoveryKey,
	savePendingRecoveryKey
} from '../../../services/pendingRecoveryKeyStore';
import { setRecoveryRuntimeStatus } from '../../../services/recoveryReminderState';
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
		resetKeyBackup: async () => undefined,
		checkKeyBackupAndEnable: async () => ({}),
		loadSessionBackupPrivateKeyFromSecretStorage: async () => undefined,
		restoreKeyBackup: async () => ({ imported: 42, total: 42 }),
		resetEncryption: async () => undefined,
		...overrides
	};
	const client = {
		getCrypto: () => crypto,
		getUserId: () => '@encryption-story:example.test',
		secretStorage: { checkKey: async () => true }
	} as unknown as MatrixClient;
	registerDeviceSigningAuth(client, async (makeRequest) => makeRequest(null));
	return client;
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
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: /schlüssel einrichten/i })
		);
		await expect(
			canvas.findByText(DEMO_RECOVERY_KEY)
		).resolves.toBeVisible();
	},
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

/** Recovered account can attach its login password; all values are synthetic. */
export const PasswordRecoveryForm: Story = {
	args: { clientOverride: buildFakeClient() },
	beforeEach: () => {
		const id = '@encryption-story:example.test';
		setRecoveryRuntimeStatus(id, 'needs-password');
		savePendingRecoveryKey(id, DEMO_RECOVERY_KEY);
		return () => {
			clearPendingRecoveryKey(id);
			setRecoveryRuntimeStatus(id, 'idle');
		};
	},
	decorators: [
		(Story) => {
			const parent = React.useContext(UserDataContext);
			return (
				<UserDataContext.Provider
					value={{
						...parent,
						userData: {
							...parent.userData,
							chatRecoveryMode: 'LOGIN_PASSWORD',
							chatRecoveryPolicyRevision: 1,
							twoFactorAuth: {
								...parent.userData.twoFactorAuth,
								isActive: true
							}
						}
					}}
				>
					<Story />
				</UserDataContext.Provider>
			);
		}
	],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const password = await canvas.findByLabelText(
			'Aktuelles Login-Passwort'
		);
		const repeat = canvas.getByLabelText('Login-Passwort wiederholen');
		const otp = canvas.getByLabelText('Einmalcode');
		await expect(password).toHaveAttribute(
			'autocomplete',
			'current-password'
		);
		await expect(otp).toHaveAttribute('autocomplete', 'one-time-code');
		await userEvent.type(password, 'synthetic-password');
		await userEvent.type(repeat, 'different-password');
		await expect(repeat).toHaveAttribute('aria-invalid', 'true');
		await expect(
			canvas.getByText('Ihr Passwort ist nicht identisch.')
		).toBeVisible();
	}
};
