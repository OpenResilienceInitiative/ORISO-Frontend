// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyBackupRecoveryPrompt } from './KeyBackupRecoveryPrompt';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import { getPendingRecoveryKey } from '../../services/pendingRecoveryKeyStore';
import type { EncryptionSetupStatus } from '../../services/matrixKeyBackupService';

const getEncryptionStatus = vi.fn();
const recoverWithKey = vi.fn();
const setUpRecovery = vi.fn();

const USER_ID = '@abe.simpson:oriso.org';
const GENERATED_KEY = 'EsTc 1111 2222 3333 4444';

vi.mock('react-i18next', () => ({
	useTranslation: () => {
		const catalogue: Record<string, string> = {
			'encryption.keyBackup.dialog.recoveryCopy':
				'Sie sind auf einem neuen Gerät angemeldet. Ihr bisheriger Gesprächsverlauf liegt sicher verschlossen in Ihrem Tresor.',
			'encryption.keyBackup.dialog.keyLabel': 'Ersatzschlüssel',
			'encryption.keyBackup.dialog.openVault': 'Tresor öffnen',
			'encryption.keyBackup.dialog.later': 'Später'
		};
		return {
			t: (key: string) => catalogue[key] ?? key
		};
	}
}));

vi.mock('../../resources/img/icons/recovery-safe.svg', () => ({
	ReactComponent: () => <svg aria-label="Tresor" />
}));

vi.mock('../modal/OrisoDialog', () => ({
	OrisoDialog: ({
		children,
		title,
		onClose
	}: {
		children: React.ReactNode;
		title: React.ReactNode;
		onClose: () => void;
	}) => (
		<div role="dialog" aria-label={String(title)}>
			<button type="button" onClick={onClose}>
				Schliessen
			</button>
			{children}
		</div>
	)
}));

vi.mock('../../services/matrixKeyBackupService', () => ({
	getEncryptionStatus: (...args: unknown[]) => getEncryptionStatus(...args),
	recoverWithKey: (...args: unknown[]) => recoverWithKey(...args),
	setUpRecovery: (...args: unknown[]) => setUpRecovery(...args),
	canBootstrapSilently: (status: EncryptionSetupStatus) =>
		!status.serverBackupExists && !status.secretStorageReady,
	InvalidRecoveryKeyError: class InvalidRecoveryKeyError extends Error {}
}));

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

const freshAccount: EncryptionSetupStatus = {
	secretStorageReady: false,
	crossSigningReady: false,
	activeBackupVersion: null,
	serverBackupExists: false,
	keyStorageOutOfSync: false
};

/** Fake MatrixClientService: immediately reports PREPARED to its listener. */
const buildService = (ready = true, userId = USER_ID) =>
	(() => {
		const client = { getUserId: () => userId } as any;
		return {
			getClient: () => client,
			getReadyClient: async () => client,
			getStaleDeviceRecoveryVersion: () => 0,
			onSyncStateChange: (cb: (state: string | null) => void) => {
				cb(ready ? 'PREPARED' : 'SYNCING');
				return () => undefined;
			}
		} as any;
	})();

const renderPrompt = (service: unknown) =>
	render(
		<MatrixClientContext.Provider
			value={{
				matrixClientService: service as any,
				setMatrixClientService: vi.fn()
			}}
		>
			<MemoryRouter>
				<KeyBackupRecoveryPrompt />
			</MemoryRouter>
		</MatrixClientContext.Provider>
	);

const RECOVERY_TEXT = /auf einem neuen Gerät angemeldet/i;
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('KeyBackupRecoveryPrompt (#437 login-time recovery)', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="banner"></div>';
		sessionStorage.clear();
		localStorage.clear();
		getEncryptionStatus.mockReset();
		recoverWithKey.mockReset();
		setUpRecovery.mockReset();
		setUpRecovery.mockResolvedValue(GENERATED_KEY);
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it('shows the recovery prompt when key storage is out of sync after login', async () => {
		getEncryptionStatus.mockResolvedValue(outOfSync);

		renderPrompt(buildService());

		await waitFor(() =>
			expect(screen.queryByText(RECOVERY_TEXT)).toBeTruthy()
		);
		expect(screen.getByRole('dialog')).toBeTruthy();
		expect(
			screen.getByRole('textbox', {
				name: /Ersatzschlüssel/i
			})
		).toBeTruthy();
		expect(
			screen.getByRole('button', { name: /Tresor öffnen/i })
		).toBeTruthy();
	});

	it('restores encrypted history directly from the new-device dialog', async () => {
		getEncryptionStatus.mockResolvedValue(outOfSync);
		recoverWithKey.mockResolvedValue({ imported: 21, total: 21 });

		renderPrompt(buildService());

		const input = await screen.findByRole('textbox', {
			name: /Ersatzschlüssel/i
		});
		fireEvent.change(input, { target: { value: 'valid recovery key' } });
		fireEvent.click(screen.getByRole('button', { name: /Tresor öffnen/i }));

		await waitFor(() =>
			expect(recoverWithKey).toHaveBeenCalledWith(
				expect.anything(),
				'valid recovery key'
			)
		);
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(sessionStorage.getItem('hideKeyBackupPrompt')).toBe(USER_ID);
	});

	it('sets the Tresor up in the background instead of asking (#839 follow-up)', async () => {
		getEncryptionStatus.mockResolvedValue(freshAccount);

		renderPrompt(buildService());

		await waitFor(() => expect(setUpRecovery).toHaveBeenCalled());
		// Nothing interrupts the user — the dialog never appears.
		expect(screen.queryByRole('dialog')).toBeNull();
		// The key waits in the Sicherheit panel instead of a modal.
		await waitFor(() =>
			expect(getPendingRecoveryKey(USER_ID)).toBe(GENERATED_KEY)
		);
	});

	it('runs the silent setup once, even with a second tab on the same account', async () => {
		getEncryptionStatus.mockResolvedValue(freshAccount);

		renderPrompt(buildService());
		renderPrompt(buildService());

		await flush();
		expect(setUpRecovery).toHaveBeenCalledTimes(1);
	});

	it('stays silent and shows no dialog when the background setup fails', async () => {
		getEncryptionStatus.mockResolvedValue(freshAccount);
		setUpRecovery.mockRejectedValue(new Error('UIA rejected'));

		renderPrompt(buildService());

		await waitFor(() => expect(setUpRecovery).toHaveBeenCalled());
		await flush();
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(getPendingRecoveryKey(USER_ID)).toBeNull();
	});

	it('never bootstraps over an existing server backup', async () => {
		getEncryptionStatus.mockResolvedValue({
			...healthy,
			secretStorageReady: false
		});

		renderPrompt(buildService());

		await flush();
		expect(setUpRecovery).not.toHaveBeenCalled();
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('prioritizes recovery over setup when key storage is out of sync', async () => {
		getEncryptionStatus.mockResolvedValue({
			...freshAccount,
			keyStorageOutOfSync: true
		});

		renderPrompt(buildService());

		await waitFor(() =>
			expect(screen.queryByText(RECOVERY_TEXT)).toBeTruthy()
		);
		expect(setUpRecovery).not.toHaveBeenCalled();
	});

	it('stays hidden when encryption is healthy', async () => {
		getEncryptionStatus.mockResolvedValue(healthy);

		renderPrompt(buildService());

		// Give the probe time to resolve, then assert nothing rendered.
		await waitFor(() => expect(getEncryptionStatus).toHaveBeenCalled());
		expect(screen.queryByText(RECOVERY_TEXT)).toBeNull();
		expect(setUpRecovery).not.toHaveBeenCalled();
	});

	it('does not probe until the client is PREPARED', async () => {
		getEncryptionStatus.mockResolvedValue(outOfSync);

		renderPrompt(buildService(false));

		await flush();
		expect(getEncryptionStatus).not.toHaveBeenCalled();
		expect(screen.queryByText(RECOVERY_TEXT)).toBeNull();
	});

	it('stays hidden when this user dismissed it earlier in the session', async () => {
		sessionStorage.setItem('hideKeyBackupPrompt', USER_ID);
		getEncryptionStatus.mockResolvedValue(outOfSync);

		renderPrompt(buildService());

		await flush();
		expect(screen.queryByText(RECOVERY_TEXT)).toBeNull();
	});

	it('remembers who dismissed it, not just that someone did', async () => {
		getEncryptionStatus.mockResolvedValue(outOfSync);
		recoverWithKey.mockResolvedValue({ imported: 0, total: 0 });

		renderPrompt(buildService());

		fireEvent.click(await screen.findByRole('button', { name: /Später/i }));

		expect(sessionStorage.getItem('hideKeyBackupPrompt')).toBe(USER_ID);
	});

	it('still asks the next account that logs into the same tab', async () => {
		sessionStorage.setItem('hideKeyBackupPrompt', USER_ID);
		getEncryptionStatus.mockResolvedValue(outOfSync);

		renderPrompt(buildService(true, '@lisa.simpson:oriso.org'));

		await waitFor(() =>
			expect(screen.queryByText(RECOVERY_TEXT)).toBeTruthy()
		);
	});

	it('sets a dismissed-tab account up in the background all the same', async () => {
		// The dismissal was about a dialog. It never spoke for the bootstrap.
		sessionStorage.setItem('hideKeyBackupPrompt', USER_ID);
		getEncryptionStatus.mockResolvedValue(freshAccount);

		renderPrompt(buildService());

		await waitFor(() => expect(setUpRecovery).toHaveBeenCalled());
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('renders nothing and never probes without a Matrix client service', async () => {
		renderPrompt(null);

		await flush();
		expect(getEncryptionStatus).not.toHaveBeenCalled();
		expect(screen.queryByText(RECOVERY_TEXT)).toBeNull();
	});
});
