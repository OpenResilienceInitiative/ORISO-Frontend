import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import ShieldIcon from '@mui/icons-material/Shield';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { RecipientSplitButton } from './RecipientSplitButton';
// One place defines what "375px" means; an inline globals object here would
// drift from `.storybook/preview.tsx` the next time a viewport is renamed.
import { phone375Globals } from '../../message/messageStoryShell';

const SPLIT_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=84-14745';
const BEHAVIOUR_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=7086-40457';

/** The production composer adapter uses the shared small SplitButton (#1806).
 * Audience role icons and selection are independent of its standard states. */
const meta = {
	title: 'Components/Composer/RecipientSplitButton',
	component: RecipientSplitButton,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		design: [
			{ type: 'figma', name: 'Split button', url: SPLIT_FIGMA_URL },
			{
				type: 'figma',
				name: 'Behaviour (Theme 3)',
				url: BEHAVIOUR_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'M3 split button (Figma 1168:23016) for picking message recipients. Leading shows ' +
					'the recipient and their role symbol; the trailing arrow opens the recipient menu. ' +
					'The shared small atom is outlined at rest, tonal for chosen recipients, and elevated while open. ' +
					'Controls are 32px tall; the trailing segment is 28px wide.'
			}
		}
	}
} satisfies Meta<typeof RecipientSplitButton>;

export default meta;

// Hooks must live in a proper component — calling useState inside the
// story's render() violates react-hooks/rules-of-hooks and fails CI lint.
const SplitButtonDemo = ({
	label,
	icon,
	isMulti = false,
	variant = 'targeted'
}: {
	label: string;
	icon: React.ReactNode;
	isMulti?: boolean;
	variant?: 'all' | 'targeted';
}) => {
	const [open, setOpen] = useState(false);
	return (
		<RecipientSplitButton
			label={label}
			icon={icon}
			isOpen={open}
			isMulti={isMulti}
			variant={variant}
			onToggle={() => setOpen((o) => !o)}
			chevronLabel="Open send-to menu"
		/>
	);
};

export const AllRecipients: StoryObj = {
	name: 'Everyone (neutral)',
	render: () => (
		<SplitButtonDemo label="Alle" icon={<GroupIcon />} variant="all" />
	),
	parameters: {
		docs: {
			description: {
				story: 'The default state of an accepted conversation: nothing is withheld from anyone, so the chip stays out of the way.'
			}
		}
	}
};

export const SingleAdviceSeeker: StoryObj = {
	name: 'Targeted — advice seeker',
	render: () => (
		<SplitButtonDemo label="sanftes Alpaka Mika" icon={<PersonIcon />} />
	)
};

export const SingleConsultant: StoryObj = {
	name: 'Targeted — counsellor',
	render: () => (
		<SplitButtonDemo label="K. Paulstätter" icon={<SupportAgentIcon />} />
	)
};

export const SingleSupervisor: StoryObj = {
	name: 'Targeted — moderator',
	render: () => <SplitButtonDemo label="B. Pardon" icon={<ShieldIcon />} />,
	parameters: {
		docs: {
			description: {
				story: 'Supervision outranks the counselling role: somebody who is both is shown as a moderator, because that is the more restrictive reading.'
			}
		}
	}
};

export const MultipleRecipients: StoryObj = {
	name: 'Targeted — several people',
	render: () => (
		<SplitButtonDemo
			label="3 Personen"
			icon={<GroupIcon />}
			isMulti
			variant="targeted"
		/>
	)
};

export const LongestGeneratedName: StoryObj = {
	name: 'Longest generated name (31 chars)',
	render: () => (
		<SplitButtonDemo
			label="absichtslose Schildkröte Andrea"
			icon={<PersonIcon />}
		/>
	),
	parameters: {
		docs: {
			description: {
				story: 'The longest display name the generator can produce — 12 + 11 + 6 characters. The leading half caps at 186px and ellipsises rather than pushing the chevron off the composer.'
			}
		}
	}
};

export const MobileNeutral: StoryObj = {
	name: 'Mobile 375px — everyone',
	render: () => (
		<SplitButtonDemo label="Alle" icon={<GroupIcon />} variant="all" />
	),
	globals: phone375Globals
};

export const MobileTargeted: StoryObj = {
	name: 'Mobile 375px — targeted, long name',
	render: () => (
		<SplitButtonDemo
			label="absichtslose Schildkröte Andrea"
			icon={<PersonIcon />}
		/>
	),
	globals: phone375Globals
};

export const MenuOpen: StoryObj = {
	name: 'Open menu — standard elevated state',
	render: () => (
		<RecipientSplitButton
			label="3 Personen"
			icon={<GroupIcon />}
			isOpen
			variant="targeted"
			onToggle={() => {}}
			chevronLabel="Open send-to menu"
		/>
	)
};
export const Disabled: StoryObj = {
	name: 'Unavailable — shared disabled state',
	render: () => (
		<RecipientSplitButton
			label="Alle"
			icon={<GroupIcon />}
			isOpen={false}
			disabled
			variant="all"
			onToggle={() => {}}
			chevronLabel="Open send-to menu"
		/>
	)
};
