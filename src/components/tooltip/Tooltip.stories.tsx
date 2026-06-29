import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from './Tooltip';

const meta = {
	title: 'Atoms/Tooltip',
	component: Tooltip,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Tooltip that shows contextual content on hover or click, positioned in a configurable direction relative to its trigger.'
			}
		}
	}
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Tooltip trigger={<button type="button">Hover me</button>}>
			<span>Helpful information shown in the tooltip.</span>
		</Tooltip>
	)
};

export const Top: Story = {
	render: () => (
		<Tooltip direction="top" trigger={<button type="button">Top</button>}>
			<span>Tooltip positioned above the trigger.</span>
		</Tooltip>
	)
};

export const Left: Story = {
	render: () => (
		<Tooltip direction="left" trigger={<button type="button">Left</button>}>
			<span>Tooltip positioned to the left of the trigger.</span>
		</Tooltip>
	)
};

export const Right: Story = {
	render: () => (
		<Tooltip direction="right" trigger={<button type="button">Right</button>}>
			<span>Tooltip positioned to the right of the trigger.</span>
		</Tooltip>
	)
};
