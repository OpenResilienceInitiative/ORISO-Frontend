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
import type { EncryptionSetupStatus } from '../../services/matrixKeyBackupService';

const getEncryptionStatus = vi.fn();
const recoverWithKey = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (_key: string, def?: string) => def ?? _key })
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

/** Fake MatrixClientService: immediately reports PREPARED to its listener. */
const buildService = (ready = true) =>
	(() => {
		const client = {} as any;
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
const SETUP_TEXT = /Richten Sie einen Wiederherstellungsschlüssel ein/i;

describe('KeyBackupRecoveryPrompt (#437 login-time recovery)', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="banner"></div>';
		sessionStorage.clear();
		getEncryptionStatus.mockReset();
		recoverWithKey.mockReset();
	});

	afterEach(() => cleanup());

	it('shows the recovery prompt when key storage is out of sync after login', async () => {
		getEncryptionStatus.mockResolvedValue(outOfSync);

		renderPrompt(buildService());

		await waitFor(() =>
			expect(screen.queryByText(RECOVERY_TEXT)).toBeTruthy()
		);
		expect(screen.getByRole('dialog')).toBeTruthy();
		expect(
			screen.getByRole('textbox', {
				name: /Wiederherstellungsschlüssel/i
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
			name: /Wiederherstellungsschlüssel/i
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
		expect(sessionStorage.getItem('hideKeyBackupPrompt')).toBe('true');
	});

	it.each([
		['server backup', { ...healthy, serverBackupExists: false }],
		['secret storage', { ...healthy, secretStorageReady: false }],
		['cross-signing', { ...healthy, crossSigningReady: false }]
	])(
		'shows setup-specific copy when %s is missing (#839)',
		async (_prerequisite, status) => {
			getEncryptionStatus.mockResolvedValue(status);

			renderPrompt(buildService());

			await waitFor(() =>
				expect(screen.queryByText(SETUP_TEXT)).toBeTruthy()
			);
			expect(screen.queryByText(RECOVERY_TEXT)).toBeNull();
			expect(screen.getByRole('dialog')).toBeTruthy();
			expect(screen.getByRole('link').textContent).toMatch(
				/Tresor einrichten/i
			);
			expect(screen.getByRole('link').getAttribute('href')).toContain(
				'/profile/einstellungen/sicherheit'
			);
		}
	);

	it('prioritizes recovery copy when key storage is out of sync', async () => {
		getEncryptionStatus.mockResolvedValue({
			...healthy,
			serverBackupExists: false,
			keyStorageOutOfSync: true
		});

		renderPrompt(buildService());

		await waitFor(() =>
			expect(screen.queryByText(RECOVERY_TEXT)).toBeTruthy()
		);
		expect(screen.queryByText(SETUP_TEXT)).toBeNull();
		expect(screen.getByRole('textbox')).toBeTruthy();
		expect(
			screen.getByRole('button', { name: /Tresor öffnen/i })
		).toBeTruthy();
	});

	it('stays hidden when encryption is healthy', async () => {
		getEncryptionStatus.mockResolvedValue(healthy);

		renderPrompt(buildService());

		// Give the probe time to resolve, then assert nothing rendered.
		await waitFor(() => expect(getEncryptionStatus).toHaveBeenCalled());
		expect(screen.queryByText(RECOVERY_TEXT)).toBeNull();
		expect(screen.queryByText(SETUP_TEXT)).toBeNull();
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
