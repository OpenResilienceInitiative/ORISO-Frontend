import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	SupervisorDialog,
	type SupervisorDialogCopy
} from './SupervisorDialog';

const COPY: SupervisorDialogCopy = {
	title: {
		add: 'Request supervision',
		change: 'Change supervisor',
		handover: 'Hand over consultation'
	},
	description: {
		add: 'Invite an experienced colleague to this case.',
		change: 'Replace the current supervisor.',
		handover: 'Offer this consultation to another eligible colleague.'
	},
	currentHeading: 'Current supervision',
	noneYet: 'No supervisor has been assigned.',
	personLabel: {
		add: 'Select supervisor',
		change: 'Select new supervisor',
		handover: 'Select colleague'
	},
	reasonLabel: {
		add: 'Reason for supervision',
		change: 'Reason for change',
		handover: 'Reason for handover'
	},
	reasonPlaceholder: 'Briefly describe the reason.',
	reasonError: 'Select a reason.',
	reasonEmptyOption: 'Select reason …',
	explanation: {
		add: 'A supervisor can support you in a separate team space.',
		change: 'The new supervisor replaces the previous one.',
		handover:
			'The selected colleague decides first. If policy requires it, the client is asked afterwards. Until all required decisions are complete, the current counsellor remains responsible.'
	},
	handoverPending:
		'The request is sent to the selected colleague first and takes effect only after every required decision.',
	confirm: {
		add: 'Request supervision',
		change: 'Request change',
		handover: 'Send handover offer'
	},
	cancel: 'Cancel',
	close: 'Close',
	emptyOption: 'Please select …'
};

const meta = {
	title: 'Chat/Organisms/SupervisorDialog',
	component: SupervisorDialog,
	args: {
		mode: 'handover',
		copy: COPY,
		candidates: [],
		onSelect: () => undefined,
		onReasonChange: () => undefined,
		onConfirm: () => undefined,
		onClose: () => undefined
	},
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'The shared M3 supervisor dialog. Its handover mode is connected from the case owner profile and submits a recipient-first offer; client consent follows only when the selected policy requires it.'
			}
		}
	}
} satisfies Meta<typeof SupervisorDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const HandoverDialog = () => {
	const [selectedId, setSelectedId] = React.useState('');
	const [reason, setReason] = React.useState('');
	return (
		<SupervisorDialog
			mode="handover"
			copy={COPY}
			candidates={[
				{ id: 'c-1', name: 'Jonas Lehmann' },
				{ id: 'c-2', name: 'Ayse Demir' }
			]}
			reasons={[
				{ code: 'COUNSELLOR_ON_HOLIDAY', label: 'Planned absence' },
				{ code: 'OTHER_EMERGENCY', label: 'Other urgent reason' }
			]}
			selectedId={selectedId}
			reason={reason}
			onSelect={setSelectedId}
			onReasonChange={setReason}
			onConfirm={() => undefined}
			onClose={() => undefined}
		/>
	);
};

/**
 * MUI puts a `data-testid` handed to `Select` on the OutlinedInput ROOT, not on
 * the `role="combobox"` display inside it — and the menu opens from a handler on
 * that display. Clicking the root therefore does nothing, which is what made the
 * first version of this play function fail in CI. Address the combobox inside the
 * test id, the way `OrisoFormControls.stories` and `OrisoSelect.test` do.
 */
const openSelect = async (root: HTMLElement) => {
	await userEvent.click(within(root).getByRole('combobox'));
};

const chooseOption = async (
	canvas: ReturnType<typeof within>,
	name: string
) => {
	await userEvent.click(await canvas.findByRole('option', { name }));
	// The menu closes through a transition and its backdrop keeps swallowing
	// real clicks until it unmounts, so wait it out before touching the next
	// field.
	await waitFor(() =>
		expect(canvas.queryByRole('listbox')).not.toBeInTheDocument()
	);
};

export const HandoverRecipientFirst: Story = {
	render: () => <HandoverDialog />,
	play: async () => {
		const canvas = within(document.body);
		await expect(canvas.getByRole('dialog')).toBeInTheDocument();
		const confirm = canvas.getByTestId('supervisor-dialog-confirm');
		await expect(confirm).toBeDisabled();

		await openSelect(canvas.getByTestId('supervisor-dialog-person'));
		await chooseOption(canvas, 'Jonas Lehmann');

		await openSelect(canvas.getByTestId('supervisor-dialog-reason'));
		await chooseOption(canvas, 'Planned absence');

		await expect(confirm).toBeEnabled();
	}
};
