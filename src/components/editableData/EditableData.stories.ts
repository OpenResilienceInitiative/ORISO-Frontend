import { Meta, StoryObj } from '@storybook/react';
import { EditableData } from './EditableData';

const meta = {
	title: 'Molecules/EditableData',
	component: EditableData,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'A labelled input that toggles between a read-only display state and an editable state, with optional clear/edit actions and email validation.'
			}
		}
	}
} satisfies Meta<typeof EditableData>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
	args: {
		label: 'First name',
		type: 'text',
		initialValue: 'Jane',
		onValueIsValid: () => {}
	}
};

export const ReadOnly: Story = {
	args: {
		label: 'First name',
		type: 'text',
		initialValue: 'Jane',
		isDisabled: true,
		isSingleEdit: true,
		isSingleClearable: true,
		onSingleEditActive: () => {},
		onSingleClear: () => {}
	}
};

export const Email: Story = {
	args: {
		label: 'Email address',
		type: 'email',
		initialValue: 'jane@example.com',
		onValueIsValid: () => {}
	}
};

export const EmailAlreadyInUse: Story = {
	args: {
		label: 'Email address',
		type: 'email',
		initialValue: 'taken@example.com',
		isEmailAlreadyInUse: true,
		onValueIsValid: () => {}
	}
};
