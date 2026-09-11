import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { KeyBackupRecoveryDialog } from './KeyBackupRecoveryPrompt';

const meta = {
	title: 'Organisms/KeyBackupRecoveryDialog',
	component: KeyBackupRecoveryDialog,
	parameters: {
		docs: {
			description: {
				component:
					'#843 login-time recovery prompt. Standard ORISO dialog based on the approved Element-inspired Tresor mockup. Only the new-device case still asks: first-time setup runs silently in the background and surfaces its recovery key in the Sicherheit panel. Actions stack full-width at 575px and below.'
			}
		}
	}
} satisfies Meta<typeof KeyBackupRecoveryDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const InteractiveDialog = () => {
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
					onClose={() => setOpen(false)}
					onRecover={async () => 42}
				/>
			)}
		</>
	);
};

export const NewDeviceRecovery: Story = {
	args: {
		onClose: () => undefined,
		onRecover: async () => 42
	},
	render: () => <InteractiveDialog />
};

export const NewDeviceRecoveryMobile: Story = {
	...NewDeviceRecovery,
	parameters: { viewport: { defaultViewport: 'mobile1' } }
};
