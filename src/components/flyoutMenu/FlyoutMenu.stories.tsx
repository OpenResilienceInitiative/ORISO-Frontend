import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
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

export const OpenedByTrigger: Story = {
	name: 'Opened by trigger click',
	args: { position: 'left' },
	render: (args) => (
		<FlyoutMenu {...args}>
			<button type="button">Bannen</button>
		</FlyoutMenu>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', {
			name: 'Weitere Funktionen'
		});

		await userEvent.click(trigger);
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');
		await expect(
			canvas.getByRole('button', { name: 'Bannen' })
		).toBeVisible();
	}
};
