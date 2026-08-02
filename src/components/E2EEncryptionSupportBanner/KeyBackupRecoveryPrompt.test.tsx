// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyBackupRecoveryPrompt } from './KeyBackupRecoveryPrompt';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import type { EncryptionSetupStatus } from '../../services/matrixKeyBackupService';

const getEncryptionStatus = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (_key: string, def?: string) => def ?? _key })
}));

vi.mock('../../services/matrixKeyBackupService', () => ({
	getEncryptionStatus: (...args: unknown[]) => getEncryptionStatus(...args)
}));

const outOfSync: EncryptionSetupStatus = {
	secretStorageReady: false,
	crossSigningReady: false,
	activeBackupVersion: null,
	serverBackupExists: true,
	keyStorageOutOfSync: true
};

const notSetUp: EncryptionSetupStatus = {
	secretStorageReady: false,
	crossSigningReady: false,
	activeBackupVersion: null,
	serverBackupExists: false,
	keyStorageOutOfSync: false
};

const healthy: EncryptionSetupStatus = {
	secretStorageReady: true,
	crossSigningReady: true,
	activeBackupVersion: '3',
	serverBackupExists: true,
	keyStorageOutOfSync: false
};

/** Fake MatrixClientService: immediately reports PREPARED to its listener. */
const buildService = (ready = true) =>
	({
		getClient: () => ({}) as any,
		onSyncStateChange: (cb: (state: string | null) => void) => {
			cb(ready ? 'PREPARED' : 'SYNCING');
			return () => undefined;
		}
	}) as any;

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

const RECOVERY_TEXT = /noch nicht verfügbar/i;

describe('KeyBackupRecoveryPrompt (#437 login-time recovery)', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="banner"></div>';
		sessionStorage.clear();
		getEncryptionStatus.mockReset();
	});

	afterEach(() => cleanup());

	it('shows the recovery prompt when key storage is out of sync after login', async () => {
		getEncryptionStatus.mockResolvedValue(outOfSync);

		renderPrompt(buildService());

		await waitFor(() =>
			expect(screen.queryByText(RECOVERY_TEXT)).toBeTruthy()
		);
		// Deep-links into the profile Sicherheit panel that holds the input.
		const link = screen.getByRole('link');
		expect(link.getAttribute('href')).toContain(
			'/profile/einstellungen/sicherheit'
		);
	});

	it('shows the setup prompt when no key backup exists after login (#839)', async () => {
		getEncryptionStatus.mockResolvedValue(notSetUp);

		renderPrompt(buildService());

		await waitFor(() =>
			expect(screen.queryByText(RECOVERY_TEXT)).toBeTruthy()
		);
		expect(screen.getByRole('link').getAttribute('href')).toContain(
			'/profile/einstellungen/sicherheit'
		);
	});

	it('stays hidden when encryption is healthy', async () => {
		getEncryptionStatus.mockResolvedValue(healthy);

		renderPrompt(buildService());

		// Give the probe time to resolve, then assert nothing rendered.
		await waitFor(() => expect(getEncryptionStatus).toHaveBeenCalled());
		expect(screen.queryByText(RECOVERY_TEXT)).toBeNull();
	});

	it('does not probe until the client is PREPARED', async () => {
		getEncryptionStatus.mockResolvedValue(outOfSync);

		renderPrompt(buildService(false));

		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(getEncryptionStatus).not.toHaveBeenCalled();
		expect(screen.queryByText(RECOVERY_TEXT)).toBeNull();
	});

	it('stays hidden when dismissed earlier this session', async () => {
		sessionStorage.setItem('hideKeyBackupPrompt', 'true');
		getEncryptionStatus.mockResolvedValue(outOfSync);

		renderPrompt(buildService());

		// Dismissal short-circuits before any crypto probe.
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(getEncryptionStatus).not.toHaveBeenCalled();
		expect(screen.queryByText(RECOVERY_TEXT)).toBeNull();
	});

	it('renders nothing and never probes without a Matrix client service', async () => {
		renderPrompt(null);

		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(getEncryptionStatus).not.toHaveBeenCalled();
		expect(screen.queryByText(RECOVERY_TEXT)).toBeNull();
	});
});
