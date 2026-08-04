import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
	KeyBackupRecoveryDialog,
	type KeyBackupPromptMode
} from './KeyBackupRecoveryPrompt';

const meta = {
	title: 'Organisms/KeyBackupRecoveryDialog',
	component: KeyBackupRecoveryDialog,
	parameters: {
		docs: {
			description: {
				component:
					'#843 login-time recovery prompt. Standard ORISO dialog based on the approved Element-inspired Tresor mockup. Recovery happens inline; setup links to the existing Sicherheit flow. Actions stack full-width at 575px and below.'
			}
		}
	}
} satisfies Meta<typeof KeyBackupRecoveryDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const InteractiveDialog = ({ mode }: { mode: KeyBackupPromptMode }) => {
	const [open, setOpen] = useState(true);
	return (
		<>
			{!open && (
				<button type="button" onClick={() => setOpen(true)}>
					Dialog erneut öffnen
				</button>
			)}
			{open && (
				<KeyBackupRecoveryDialog
					mode={mode}
					onClose={() => setOpen(false)}
					onRecover={async () => 42}
				/>
			)}
		</>
	);
};

export const NewDeviceRecovery: Story = {
	args: {
		mode: 'recovery',
		onClose: () => undefined,
		onRecover: async () => 42
	},
	render: () => <InteractiveDialog mode="recovery" />
};

export const FirstTimeSetup: Story = {
	args: {
		mode: 'setup',
		onClose: () => undefined,
		onRecover: async () => 0
	},
	render: () => <InteractiveDialog mode="setup" />
};

export const NewDeviceRecoveryMobile: Story = {
	...NewDeviceRecovery,
	parameters: { viewport: { defaultViewport: 'mobile1' } }
};
