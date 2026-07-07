import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import { RecipientSplitButton } from './RecipientSplitButton';

const SPLIT_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=84-14745';

const meta = {
	title: 'Components/Composer/RecipientSplitButton',
	component: RecipientSplitButton,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		design: [{ type: 'figma', name: 'Split button', url: SPLIT_FIGMA_URL }],
		docs: {
			description: {
				component:
					'M3 split button (Figma 1168:23016) for picking message recipients. Only shown ' +
					'when a chat has more than two participants. Leading shows the recipient; the ' +
					'trailing arrow opens the recipient menu.'
			}
		}
	}
} satisfies Meta<typeof RecipientSplitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// Hooks must live in a proper component — calling useState inside the
// story's render() violates react-hooks/rules-of-hooks and fails CI lint.
const SplitButtonDemo = ({
	label,
	icon,
	isMulti = false
}: {
	label: string;
	icon: React.ReactNode;
	isMulti?: boolean;
}) => {
	const [open, setOpen] = useState(false);
	return (
		<RecipientSplitButton
			label={label}
			icon={icon}
			isOpen={open}
			isMulti={isMulti}
			onToggle={() => setOpen((o) => !o)}
			chevronLabel="Open send-to menu"
		/>
	);
};

export const SingleRecipient: Story = {
	render: () => <SplitButtonDemo label="A. Kräger" icon={<PersonIcon />} />
};

export const MultipleRecipients: Story = {
	render: () => (
		<SplitButtonDemo label="3 Personen" icon={<GroupIcon />} isMulti />
	)
};

export const AllRecipients: Story = {
	render: () => <SplitButtonDemo label="Alle" icon={<GroupIcon />} />
};
