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
import {
	getPendingRecoveryKey,
	savePendingRecoveryKey
} from '../../../services/pendingRecoveryKeyStore';
import type { EncryptionSetupStatus } from '../../../services/matrixKeyBackupService';
import { BackupKeyAfterTwoFactorDialog } from './BackupKeyAfterTwoFactorDialog';

const setUpRecovery = vi.hoisted(() =>
	vi.fn().mockResolvedValue('fresh-recovery-key')
);
const getEncryptionStatus = vi.hoisted(() => vi.fn());

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key
	})
}));

vi.mock('../../../services/matrixKeyBackupService', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('../../../services/matrixKeyBackupService')
		>();
	return { ...actual, setUpRecovery, getEncryptionStatus };
});

const USER_ID = '@asker:oriso.org';
const PARKED_KEY = 'EsTc parked-key-0001';
const clientWithUser = { getUserId: () => USER_ID } as MatrixClient;

const healthy: EncryptionSetupStatus = {
	secretStorageReady: true,
	crossSigningReady: true,
	activeBackupVersion: '1',
	serverBackupExists: true,
	keyStorageOutOfSync: false
};

const notSetUp: EncryptionSetupStatus = {
	secretStorageReady: false,
	crossSigningReady: false,
	activeBackupVersion: null,
	serverBackupExists: false,
	keyStorageOutOfSync: false
};

afterEach(cleanup);

describe('BackupKeyAfterTwoFactorDialog', () => {
	beforeEach(() => {
		localStorage.clear();
		getEncryptionStatus.mockReset();
		setUpRecovery.mockClear();
		setUpRecovery.mockResolvedValue('fresh-recovery-key');
	});

	it('does not render when closed', () => {
		render(
			<BackupKeyAfterTwoFactorDialog
				clientOverride={clientWithUser}
				onClose={vi.fn()}
				open={false}
			/>
		);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('shows a parked silent-setup key and forgets it on confirm', async () => {
		savePendingRecoveryKey(USER_ID, PARKED_KEY);
		getEncryptionStatus.mockResolvedValue(healthy);
		const onClose = vi.fn();

		render(
			<BackupKeyAfterTwoFactorDialog
				clientOverride={clientWithUser}
				onClose={onClose}
				open
			/>
		);

		expect(await screen.findByText(PARKED_KEY)).toBeTruthy();
		fireEvent.click(
			screen.getByRole('checkbox', {
				name: 'Ich habe den Schlüssel sicher gespeichert.'
			})
		);
		fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));

		expect(getPendingRecoveryKey(USER_ID)).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('closes immediately when backup is already healthy and no key is parked', async () => {
		getEncryptionStatus.mockResolvedValue(healthy);
		const onClose = vi.fn();

		render(
			<BackupKeyAfterTwoFactorDialog
				clientOverride={clientWithUser}
				onClose={onClose}
				open
			/>
		);

		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
		expect(setUpRecovery).not.toHaveBeenCalled();
	});

	it('sets up recovery when no backup exists yet', async () => {
		getEncryptionStatus.mockResolvedValue(notSetUp);

		render(
			<BackupKeyAfterTwoFactorDialog
				clientOverride={clientWithUser}
				onClose={vi.fn()}
				open
			/>
		);

		expect(await screen.findByText('fresh-recovery-key')).toBeTruthy();
		expect(setUpRecovery).toHaveBeenCalledTimes(1);
		expect(getPendingRecoveryKey(USER_ID)).toBe('fresh-recovery-key');
	});

	it('lets the person retry when setup fails', async () => {
		getEncryptionStatus.mockResolvedValue(notSetUp);
		setUpRecovery.mockRejectedValueOnce(new Error('setup failed'));

		render(
			<BackupKeyAfterTwoFactorDialog
				clientOverride={clientWithUser}
				onClose={vi.fn()}
				open
			/>
		);

		expect(
			await screen.findByText(
				'Die Einrichtung ist fehlgeschlagen. Bitte versuchen Sie es erneut.'
			)
		).toBeTruthy();

		fireEvent.click(
			screen.getByRole('button', { name: 'Erneut versuchen' })
		);
		expect(await screen.findByText('fresh-recovery-key')).toBeTruthy();
		expect(setUpRecovery).toHaveBeenCalledTimes(2);
	});

	it('lets the person close the recovery-key step after a setup error', async () => {
		getEncryptionStatus.mockResolvedValue(notSetUp);
		setUpRecovery.mockRejectedValueOnce(new Error('setup failed'));
		const onClose = vi.fn();

		render(
			<BackupKeyAfterTwoFactorDialog
				clientOverride={clientWithUser}
				onClose={onClose}
				open
			/>
		);

		expect(
			await screen.findByText(
				'Die Einrichtung ist fehlgeschlagen. Bitte versuchen Sie es erneut.'
			)
		).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
