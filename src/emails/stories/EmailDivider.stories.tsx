import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailBlock, emailDivider } from '../kit/emailAtoms';

const meta = {
	title: 'Email/Atoms/Divider',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'A 1px rule separating the message from the closing fine print. Built as a table cell with an explicit `height`, `line-height` and `font-size:0`, because an empty `<div>` with a border collapses to nothing in Outlook.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		fragment: emailBlock(emailDivider(), { padding: [36, 40, 36, 40] }),
		width: 700
	}
};

export const OnPhone: Story = {
	args: {
		fragment: emailBlock(emailDivider(), { padding: [36, 40, 36, 40] }),
		width: 375
	}
};
