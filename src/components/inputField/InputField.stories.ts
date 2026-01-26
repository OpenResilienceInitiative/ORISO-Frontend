import { Meta, StoryObj } from '@storybook/react';
import { InputField } from './InputField';

const meta = {
	title: 'FORMS/InputField',
	component: InputField,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'InputField component for text input with validation states, icons, and helper text.'
			}
		}
	}
} satisfies Meta<typeof InputField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		item: {
			id: 'input-1',
			type: 'text',
			name: 'input',
			label: 'Input Field',
			content: ''
		},
		inputHandle: () => {}
	}
};

export const WithValue: Story = {
	args: {
		item: {
			id: 'input-2',
			type: 'text',
			name: 'input',
			label: 'Input with Value',
			content: 'Sample text'
		},
		inputHandle: () => {}
	}
};

export const Email: Story = {
	args: {
		item: {
			id: 'email-input',
			type: 'email',
			name: 'email',
			label: 'Email Address',
			content: ''
		},
		inputHandle: () => {}
	}
};

export const Password: Story = {
	args: {
		item: {
			id: 'password-input',
			type: 'password',
			name: 'password',
			label: 'Password',
			content: ''
		},
		inputHandle: () => {}
	}
};

export const Valid: Story = {
	args: {
		item: {
			id: 'valid-input',
			type: 'text',
			name: 'valid',
			label: 'Valid Input',
			content: 'Valid text',
			labelState: 'valid'
		},
		inputHandle: () => {}
	}
};

export const Invalid: Story = {
	args: {
		item: {
			id: 'invalid-input',
			type: 'text',
			name: 'invalid',
			label: 'Invalid Input',
			content: 'Invalid text',
			labelState: 'invalid'
		},
		inputHandle: () => {}
	}
};
