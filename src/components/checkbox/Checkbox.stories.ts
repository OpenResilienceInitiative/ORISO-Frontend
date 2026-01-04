import { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from './Checkbox';

const meta = {
	title: 'FORMS/Checkbox',
	component: Checkbox,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'Checkbox component for boolean input with optional description.'
			}
		}
	}
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
	args: {
		inputId: 'checkbox-1',
		name: 'checkbox',
		labelId: 'label-1',
		label: 'Checkbox Label',
		checked: false,
		checkboxHandle: () => {}
	}
};

export const Checked: Story = {
	args: {
		inputId: 'checkbox-2',
		name: 'checkbox',
		labelId: 'label-2',
		label: 'Checked Checkbox',
		checked: true,
		checkboxHandle: () => {}
	}
};

export const WithDescription: Story = {
	args: {
		inputId: 'checkbox-3',
		name: 'checkbox',
		labelId: 'label-3',
		label: 'Checkbox with Description',
		description: 'This is a description for the checkbox.',
		checked: false,
		checkboxHandle: () => {}
	}
};
