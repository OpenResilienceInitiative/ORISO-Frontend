import { Meta, StoryObj } from '@storybook/react';
import { Switch } from './';

const meta = {
	title: 'Atoms/Switch',
	component: Switch,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Labeled toggle switch with a translated title and optional description.'
			}
		}
	}
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {
	args: {
		titleKey: 'Enable notifications',
		checked: false,
		onChange: () => {}
	}
};

export const On: Story = {
	args: {
		titleKey: 'Enable notifications',
		checked: true,
		onChange: () => {}
	}
};

export const WithDescription: Story = {
	args: {
		titleKey: 'Enable notifications',
		descriptionKey: 'Receive an email whenever a new message arrives.',
		checked: true,
		onChange: () => {}
	}
};

export const Disabled: Story = {
	args: {
		titleKey: 'Enable notifications',
		checked: false,
		disabled: true,
		onChange: () => {}
	}
};
