import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import type { MatrixClientService } from '../../services/matrixClientService';
import {
	clearRecoveryRuntimeState,
	setRecoveryRuntimeStatus
} from '../../services/recoveryReminderState';
import { KeyBackupRecoveryPrompt } from './KeyBackupRecoveryPrompt';

const USER_ID = '@recovery-snackbar-story:example.test';
const service = {
	getClient: () => ({ getUserId: () => USER_ID })
} as unknown as MatrixClientService;

/**
 * The login-time recovery notice as an M3 snackbar. It used to be a strip
 * pinned above the app shell; now it floats bottom-centre, carries one action
 * ("Tresor öffnen") and a ✕, comes back on every reload and login until the
 * history is readable, and never pushes the layout.
 */
const meta = {
	title: 'Organisms/KeyBackupRecoverySnackbar',
	component: KeyBackupRecoveryPrompt,
	parameters: { layout: 'fullscreen' },
	decorators: [
		(Story) => (
			<MatrixClientContext.Provider
				value={{
					matrixClientService: service,
					setMatrixClientService: () => undefined
				}}
			>
				<div style={{ minHeight: 480 }}>
					<Story />
				</div>
			</MatrixClientContext.Provider>
		)
	],
	beforeEach: () => {
		setRecoveryRuntimeStatus(USER_ID, 'needs-recovery-key');
		return () => clearRecoveryRuntimeState();
	}
} satisfies Meta<typeof KeyBackupRecoveryPrompt>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NeedsRecoveryKey: Story = {
	play: async () => {
		const page = within(document.body);
		const snackbar = await page.findByTestId('key-backup-recovery-action');
		await waitFor(() => expect(snackbar).toBeVisible());
		await expect(snackbar).toHaveTextContent('Ersatzschlüssel');
		await expect(
			page.getByRole('link', { name: 'Sicherheitseinstellungen' })
		).toHaveAttribute('href', '/profile/einstellungen/sicherheit');
	}
};

export const NeedsRecoveryKeyMobile: Story = {
	...NeedsRecoveryKey,
	parameters: {
		layout: 'fullscreen',
		viewport: { defaultViewport: 'mobile1' }
	}
};

export const NeedsPassword: Story = {
	beforeEach: () => {
		setRecoveryRuntimeStatus(USER_ID, 'needs-password');
	}
};

export const DismissHidesIt: Story = {
	play: async () => {
		const page = within(document.body);
		await userEvent.click(
			await page.findByTestId('key-backup-recovery-action-close')
		);
		await expect(
			page.queryByTestId('key-backup-recovery-action')
		).not.toBeInTheDocument();
	}
};

export const ActionOpensVault: Story = {
	play: async () => {
		const page = within(document.body);
		await userEvent.click(
			await page.findByTestId('key-backup-recovery-open')
		);
		const dialog = await page.findByRole('dialog');
		await waitFor(() => expect(dialog).toBeVisible());
	}
};
