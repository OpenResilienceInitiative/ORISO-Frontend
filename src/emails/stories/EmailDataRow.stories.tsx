import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailDataPanel } from '../kit/emailMolecules';

const meta = {
	title: 'Email/Atoms/DataRow',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'One label/value pair. Two columns on desktop (38% / rest); below 620px both cells become blocks so the value gets the full width. That stacking is the single biggest mobile fix in this kit — a postal address squeezed into a 38%-wide column at 320px wrapped over four lines.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleRow: Story = {
	args: {
		fragment: emailDataPanel([
			{ label: 'Benutzername', value: '{{username}}' }
		]),
		width: 700
	}
};

export const LongValue: Story = {
	name: 'Long value (address)',
	args: {
		fragment: emailDataPanel([
			{ label: 'Ort', value: '{{locationName}}<br>{{locationAddress}}' }
		]),
		width: 700
	}
};

export const StackedOnPhone: Story = {
	name: 'Stacked on a phone',
	args: {
		fragment: emailDataPanel([
			{ label: 'Ort', value: '{{locationName}}<br>{{locationAddress}}' }
		]),
		width: 375
	}
};

export const StackedOnNarrowPhone: Story = {
	name: 'Stacked at 320px',
	args: {
		fragment: emailDataPanel([
			{ label: 'Sprechzeiten', value: '{{consultantHours}}' },
			{ label: 'Ort', value: '{{locationName}}<br>{{locationAddress}}' }
		]),
		width: 320
	}
};
