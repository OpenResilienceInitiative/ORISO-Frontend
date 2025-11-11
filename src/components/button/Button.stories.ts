import { Meta, StoryObj } from '@storybook/react';
import { Button, BUTTON_TYPES } from './Button';

const meta = {
	title: 'FORMS/Button',
	component: Button,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'Button component for user interactions. Supports multiple button types including primary, secondary, tertiary, and link styles.'
			}
		}
	}
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
	args: {
		item: {
			type: BUTTON_TYPES.PRIMARY,
			label: 'Primary Button',
			id: 'primary-btn'
		},
		buttonHandle: () => {}
	}
};

export const Secondary: Story = {
	args: {
		item: {
			type: BUTTON_TYPES.SECONDARY,
			label: 'Secondary Button',
			id: 'secondary-btn'
		},
		buttonHandle: () => {}
	}
};

export const Tertiary: Story = {
	args: {
		item: {
			type: BUTTON_TYPES.TERTIARY,
			label: 'Tertiary Button',
			id: 'tertiary-btn'
		},
		buttonHandle: () => {}
	}
};

export const Link: Story = {
	args: {
		item: {
			type: BUTTON_TYPES.LINK,
			label: 'Link Button',
			id: 'link-btn'
		},
		isLink: true,
		buttonHandle: () => {}
	}
};

export const Disabled: Story = {
	args: {
		item: {
			type: BUTTON_TYPES.PRIMARY,
			label: 'Disabled Button',
			id: 'disabled-btn',
			disabled: true
		},
		disabled: true,
		buttonHandle: () => {}
	}
};
