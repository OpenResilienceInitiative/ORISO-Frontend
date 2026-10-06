import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import type { MatrixClientService } from '../../services/matrixClientService';
import {
	clearPendingRecoveryKey,
	getPendingRecoveryKey,
	savePendingRecoveryKey
} from '../../services/pendingRecoveryKeyStore';
import {
	markEnquiryFinalized,
	setRecoveryRuntimeStatus
} from '../../services/recoveryReminderState';
import { RecoveryKeySaveReminder } from './RecoveryKeySaveReminder';

const USER_ID = '@reminder-story:example.test';
const DEMO_KEY = 'STORYBOOK DEMO — NOT A REAL RECOVERY KEY';
const service = {
	getClient: () => ({ getUserId: () => USER_ID })
} as unknown as MatrixClientService;
const meta = {
	title: 'Organisms/RecoveryKeySaveReminder',
	component: RecoveryKeySaveReminder,
	decorators: [
		(Story) => (
			<MatrixClientContext.Provider
				value={{
					matrixClientService: service,
					setMatrixClientService: () => undefined
				}}
			>
				<Story />
			</MatrixClientContext.Provider>
		)
	],
	beforeEach: () => {
		sessionStorage.removeItem('oriso.recoveryReminder.' + USER_ID);
		setRecoveryRuntimeStatus(USER_ID, 'ready');
		savePendingRecoveryKey(USER_ID, DEMO_KEY);
		markEnquiryFinalized(USER_ID, 12);
		return () => {
			clearPendingRecoveryKey(USER_ID);
			sessionStorage.removeItem('oriso.recoveryReminder.' + USER_ID);
			setRecoveryRuntimeStatus(USER_ID, 'idle');
		};
	}
} satisfies Meta<typeof RecoveryKeySaveReminder>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AfterEnquiry: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole('complementary')).toBeVisible();
		await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
		await expect(canvas.queryByText(DEMO_KEY)).not.toBeInTheDocument();
	}
};
export const SaveAdditionalKey: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Schlüssel anzeigen'
			})
		);
		await expect(canvas.getByText(DEMO_KEY)).toBeVisible();
	}
};
export const LaterPreservesKey: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button', { name: 'Später' }));
		await expect(
			canvas.queryByRole('complementary')
		).not.toBeInTheDocument();
		await expect(getPendingRecoveryKey(USER_ID)).toBe(DEMO_KEY);
	}
};
