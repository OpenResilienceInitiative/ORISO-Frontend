// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EncryptionSetupStatus } from '../../../services/matrixKeyBackupService';
import {
	beginRecoverySetup,
	getPendingRecoveryKey,
	savePendingRecoveryKey
} from '../../../services/pendingRecoveryKeyStore';
import { EncryptionSettingsPanel } from './index';

const setUpRecovery = vi.hoisted(() =>
	vi.fn().mockResolvedValue('test-recovery-key')
);
const getEncryptionStatus = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
	useTranslation: () => {
		const catalogue: Record<string, string> = {
			'profile.encryption.setup.cta': 'Ersatzschlüssel einrichten',
			'profile.encryption.showKey.confirmLabel':
				'Ich habe den Schlüssel sicher gespeichert.',
			'profile.encryption.showKey.copy': 'Schlüssel kopieren',
			'profile.encryption.showKey.done': 'Fertig',
			'profile.encryption.unavailable':
				'Die Verschlüsselungseinstellungen sind gerade nicht verfügbar. Bitte laden Sie die Seite neu.',
			'profile.encryption.recover.inputLabel': 'Ersatzschlüssel',
			'profile.encryption.recover.cta': 'Verlauf wiederherstellen',
			'profile.encryption.showKey.silentExplainer':
				'Ihr Tresor wurde beim Anmelden automatisch eingerichtet. Das ist Ihr Ersatzschlüssel.',
			'profile.encryption.setup.busy':
				'Ihr Tresor wird gerade schon eingerichtet — in einem anderen Tab oder im Hintergrund.'
		};
		return {
			t: (key: string) => catalogue[key] ?? key
		};
	}
}));

vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('../../../services/matrixKeyBackupService', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('../../../services/matrixKeyBackupService')
		>();
	return { ...actual, setUpRecovery, getEncryptionStatus };
});

const notSetUp: EncryptionSetupStatus = {
	secretStorageReady: false,
	crossSigningReady: false,
	activeBackupVersion: null,
	serverBackupExists: false,
	keyStorageOutOfSync: false
};

const outOfSync: EncryptionSetupStatus = {
	secretStorageReady: false,
	crossSigningReady: false,
	activeBackupVersion: null,
	serverBackupExists: true,
	keyStorageOutOfSync: true
};

const healthy: EncryptionSetupStatus = {
	secretStorageReady: true,
	crossSigningReady: true,
	activeBackupVersion: '3',
	serverBackupExists: true,
	keyStorageOutOfSync: false
};

const UNAVAILABLE_TEXT =
	'Die Verschlüsselungseinstellungen sind gerade nicht verfügbar. Bitte laden Sie die Seite neu.';

describe('EncryptionSettingsPanel', () => {
	afterEach(cleanup);

	it('uses the shared M3 checkbox for recovery-key confirmation', async () => {
		render(
			<EncryptionSettingsPanel
				clientOverride={{} as MatrixClient}
				initialStatusOverride={notSetUp}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: 'Ersatzschlüssel einrichten'
			})
		);

		const checkbox = await screen.findByRole('checkbox', {
			name: 'Ich habe den Schlüssel sicher gespeichert.'
		});
		expect(checkbox.closest('label')?.classList).toContain('m3Checkbox');
		for (const name of ['Schlüssel kopieren', 'Fertig']) {
			expect(
				screen.getByRole('button', { name }).closest('.button__wrapper')
					?.classList
			).toContain('encryptionSettings__fullWidthAction');
		}

		fireEvent.click(checkbox);
		expect((checkbox as HTMLInputElement).checked).toBe(true);
	});

	it('shows the unavailable state when setup has no ready client', async () => {
		render(
			<EncryptionSettingsPanel
				clientOverride={null}
				initialStatusOverride={notSetUp}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: 'Ersatzschlüssel einrichten'
			})
		);

		expect(await screen.findByText(UNAVAILABLE_TEXT)).toBeTruthy();
	});

	it('shows the unavailable state when recovery has no ready client', async () => {
		render(
			<EncryptionSettingsPanel
				clientOverride={null}
				initialStatusOverride={outOfSync}
			/>
		);

		fireEvent.change(screen.getByLabelText('Ersatzschlüssel'), {
			target: { value: 'recovery-key' }
		});
		fireEvent.click(
			screen.getByRole('button', { name: 'Verlauf wiederherstellen' })
		);

		expect(await screen.findByText(UNAVAILABLE_TEXT)).toBeTruthy();
	});

	describe('recovery key parked by the silent setup (#839 follow-up)', () => {
		const USER_ID = '@abe.simpson:oriso.org';
		const PARKED_KEY = 'EsTc 1111 2222 3333 4444';
		const clientWithUser = { getUserId: () => USER_ID } as MatrixClient;

		beforeEach(() => {
			localStorage.clear();
			getEncryptionStatus.mockReset();
			setUpRecovery.mockClear();
		});

		it('shows the key the background setup generated', async () => {
			savePendingRecoveryKey(USER_ID, PARKED_KEY);
			getEncryptionStatus.mockResolvedValue(healthy);

			render(<EncryptionSettingsPanel clientOverride={clientWithUser} />);

			expect(await screen.findByText(PARKED_KEY)).toBeTruthy();
			expect(screen.getByText(/automatisch eingerichtet/i)).toBeTruthy();
		});

		it('forgets the key once the user confirms they stored it', async () => {
			savePendingRecoveryKey(USER_ID, PARKED_KEY);
			getEncryptionStatus.mockResolvedValue(healthy);

			render(<EncryptionSettingsPanel clientOverride={clientWithUser} />);

			fireEvent.click(
				await screen.findByRole('checkbox', {
					name: 'Ich habe den Schlüssel sicher gespeichert.'
				})
			);
			fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));

			await waitFor(() =>
				expect(getPendingRecoveryKey(USER_ID)).toBeNull()
			);
			expect(screen.queryByText(PARKED_KEY)).toBeNull();
		});

		it('keeps a manually created key across a reload until it is confirmed', async () => {
			getEncryptionStatus.mockResolvedValue(notSetUp);
			const firstVisit = render(
				<EncryptionSettingsPanel clientOverride={clientWithUser} />
			);

			fireEvent.click(
				await screen.findByRole('button', {
					name: 'Ersatzschlüssel einrichten'
				})
			);
			expect(await screen.findByText('test-recovery-key')).toBeTruthy();
			firstVisit.unmount();

			render(<EncryptionSettingsPanel clientOverride={clientWithUser} />);

			expect(await screen.findByText('test-recovery-key')).toBeTruthy();
		});

		it('refuses to set up a second time while another tab is at it', async () => {
			getEncryptionStatus.mockResolvedValue(notSetUp);
			// The background bootstrap (or another tab) holds the lock.
			beginRecoverySetup(USER_ID);

			render(<EncryptionSettingsPanel clientOverride={clientWithUser} />);
			fireEvent.click(
				await screen.findByRole('button', {
					name: 'Ersatzschlüssel einrichten'
				})
			);

			expect(
				await screen.findByText(/gerade schon eingerichtet/i)
			).toBeTruthy();
			expect(setUpRecovery).not.toHaveBeenCalled();
		});

		it('asks for the recovery key first when this device is out of sync', async () => {
			savePendingRecoveryKey(USER_ID, PARKED_KEY);
			getEncryptionStatus.mockResolvedValue(outOfSync);

			render(<EncryptionSettingsPanel clientOverride={clientWithUser} />);

			expect(
				await screen.findByLabelText('Ersatzschlüssel')
			).toBeTruthy();
			expect(screen.queryByText(PARKED_KEY)).toBeNull();
		});
	});
});
