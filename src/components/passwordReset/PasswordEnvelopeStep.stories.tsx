import * as React from 'react';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PasswordEnvelopeStep } from './PasswordEnvelopeStep';
import { DEMO_RECOVERY_KEY } from '../profile/EncryptionSettings/EncryptionSettings.fixtures';

/**
 * #1917: right after a password change on an account whose chat recovery has
 * no password envelope yet. The password is already changed; this step seals
 * the existing recovery key under the new password once, or is skipped.
 */
const meta = {
	title: 'Organisms/PasswordEnvelopeStep',
	component: PasswordEnvelopeStep,
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 560, padding: 16 }}>
				<Story />
			</div>
		)
	],
	args: {
		onSkip: fn(),
		onSubmit: fn(),
		onRecoveryKeyChange: fn(),
		recoveryKey: ''
	},
	render: function Render(args) {
		const [recoveryKey, setRecoveryKey] = useState(args.recoveryKey);
		return (
			<PasswordEnvelopeStep
				{...args}
				recoveryKey={recoveryKey}
				onRecoveryKeyChange={(value) => {
					setRecoveryKey(value);
					args.onRecoveryKeyChange(value);
				}}
			/>
		);
	}
} satisfies Meta<typeof PasswordEnvelopeStep>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The step as it opens: the key field is empty, so only "Später" is active. */
export const AskForRecoveryKey: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const submit = canvas.getByRole('button', {
			name: 'Mit neuem Passwort schützen'
		});
		await expect(submit).toBeDisabled();
		await userEvent.type(
			canvas.getByRole('textbox', { name: 'Ersatzschlüssel' }),
			DEMO_RECOVERY_KEY
		);
		await expect(submit).toBeEnabled();
		await userEvent.click(submit);
		await expect(args.onSubmit).toHaveBeenCalled();
	}
};

/** A key that does not match this account: the step stays open and says why. */
export const InvalidRecoveryKey: Story = {
	args: {
		recoveryKey: 'EsTc wrong key',
		errorMessage:
			'Dieser Ersatzschlüssel ist ungültig. Bitte prüfen Sie die Eingabe.'
	}
};
