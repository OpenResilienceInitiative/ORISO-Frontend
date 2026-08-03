import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailCodePanel } from '../kit/emailMolecules';

const meta = {
	title: 'Email/Molecules/CodePanel',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'A one-time code, on the same tinted panel as the data rows but set to be read off one screen and typed into another. The label sits above rather than beside it, because a code is not one data point among several — it is the only thing the recipient needs out of the mail.\n\nBelow the mobile breakpoint the code shrinks before it can wrap: a six-digit code broken across two lines is harder to read than a smaller one on one.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		fragment: emailCodePanel({ label: 'Code', value: '418 902' }),
		width: 700
	}
};

export const Ungrouped: Story = {
	name: 'Without grouping space',
	args: {
		fragment: emailCodePanel({ label: 'Code', value: '418902' }),
		width: 700
	}
};

export const Longer: Story = {
	name: 'Eight characters',
	args: {
		fragment: emailCodePanel({ label: 'Code', value: 'K7P4-2QX9' }),
		width: 700
	}
};

export const OnPhone: Story = {
	name: 'Phone (375px)',
	args: {
		fragment: emailCodePanel({ label: 'Code', value: '418 902' }),
		width: 375
	}
};

export const OnNarrowPhone: Story = {
	name: 'Narrow phone (320px)',
	args: {
		fragment: emailCodePanel({ label: 'Code', value: 'K7P4-2QX9' }),
		width: 320
	}
};
