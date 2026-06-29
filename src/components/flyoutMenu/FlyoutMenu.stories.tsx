import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { FlyoutMenu } from './FlyoutMenu';

const meta = {
	title: 'Molecules/FlyoutMenu',
	component: FlyoutMenu,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'A trigger button that toggles a positioned flyout panel holding its children as menu items.'
			}
		}
	}
} satisfies Meta<typeof FlyoutMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
	args: { isOpen: false, position: 'left' },
	render: (args) => (
		<FlyoutMenu {...args}>
			<button type="button">Edit</button>
			<button type="button">Delete</button>
		</FlyoutMenu>
	)
};

export const Open: Story = {
	args: { isOpen: true, position: 'right' },
	render: (args) => (
		<FlyoutMenu {...args}>
			<button type="button">Edit</button>
			<button type="button">Archive</button>
			<button type="button">Delete</button>
		</FlyoutMenu>
	)
};
