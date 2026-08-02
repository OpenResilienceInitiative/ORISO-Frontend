// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EncryptionSetupStatus } from '../../../services/matrixKeyBackupService';
import { EncryptionSettingsPanel } from './index';

const setUpRecovery = vi.hoisted(() =>
	vi.fn().mockResolvedValue('test-recovery-key')
);

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key
	})
}));

vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('../../../services/matrixKeyBackupService', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('../../../services/matrixKeyBackupService')
		>();
	return { ...actual, setUpRecovery };
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
				name: 'Wiederherstellungsschlüssel einrichten'
			})
		);

		const checkbox = await screen.findByRole('checkbox', {
			name: 'Ich habe den Schlüssel sicher gespeichert.'
		});
		expect(checkbox.closest('label')?.classList).toContain('m3Checkbox');

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
				name: 'Wiederherstellungsschlüssel einrichten'
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

		fireEvent.change(screen.getByLabelText('Wiederherstellungsschlüssel'), {
			target: { value: 'recovery-key' }
		});
		fireEvent.click(
			screen.getByRole('button', { name: 'Verlauf wiederherstellen' })
		);

		expect(await screen.findByText(UNAVAILABLE_TEXT)).toBeTruthy();
	});
});
