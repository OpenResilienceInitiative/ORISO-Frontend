import { Meta, StoryObj } from '@storybook/react';
import { RadioButton } from './RadioButton';

const meta = {
	title: 'FORMS/RadioButton',
	component: RadioButton,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'RadioButton component for single selection from multiple options.'
			}
		}
	}
} satisfies Meta<typeof RadioButton>;

export default meta;
type Story = StoryObj<typeof RadioButton>;

export const Default: Story = {
	args: {
		type: 'default',
		inputId: 'radio-1',
		name: 'radio',
		value: 'option1',
		checked: false,
		handleRadioButton: () => {},
		children: 'Option 1'
	}
};

export const Checked: Story = {
	args: {
		type: 'default',
		inputId: 'radio-2',
		name: 'radio',
		value: 'option2',
		checked: true,
		handleRadioButton: () => {},
		children: 'Selected Option'
	}
};

export const BoxStyle: Story = {
	args: {
		type: 'box',
		inputId: 'radio-3',
		name: 'radio',
		value: 'option3',
		checked: false,
		handleRadioButton: () => {},
		children: 'Box Style Radio'
	}
};
