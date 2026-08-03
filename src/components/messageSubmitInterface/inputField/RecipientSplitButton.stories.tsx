import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import ShieldIcon from '@mui/icons-material/Shield';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { RecipientSplitButton } from './RecipientSplitButton';

const SPLIT_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=84-14745';
const BEHAVIOUR_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=7086-40457';

/**
 * Two things these stories pin down, both of which were wrong in the shipped
 * build (OpenResilienceInitiative/ORISO-Frontend#894):
 *
 * 1. **Colour carries the meaning.** Neutral grey while everyone in the
 *    conversation receives the message, accent while the audience is narrowed.
 *    The grey treatment previously existed only as CSS on class names no
 *    component rendered, so the chip was accent-coloured even for "Alle" —
 *    inverting the one signal the control exists to give.
 * 2. **The icon follows the recipient's role**, which is decided when the
 *    options are built. It used to be guessed by searching the rendered label
 *    for "moderator"/"supervisor"/"berater", so a generated pseudonym could
 *    pick the wrong symbol.
 *
 * The control itself is only rendered once more than two people can message
 * each other, and never for advice seekers — see `audienceOptions.test.ts`.
 */
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
					'`variant="all"` is the neutral state, `variant="targeted"` says the audience is ' +
					'narrowed. Touch targets are 32px tall; the trailing half is 48×32.'
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
	globals: { viewport: { value: 'phone375' } }
};

export const MobileTargeted: StoryObj = {
	name: 'Mobile 375px — targeted, long name',
	render: () => (
		<SplitButtonDemo
			label="absichtslose Schildkröte Andrea"
			icon={<PersonIcon />}
		/>
	),
	globals: { viewport: { value: 'phone375' } }
};
