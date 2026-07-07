import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { Box, BoxTypes } from './Box';

const meta = {
	title: 'Atoms/Box',
	component: Box,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Box component for displaying titled content blocks with error, info and success variants.'
			}
		}
	}
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
	args: {
		children: <span>This is an informational message.</span>
	},
	render: () => (
		<Box title="Information" type={BoxTypes.INFO}>
			<span>This is an informational message.</span>
		</Box>
	)
};

export const Success: Story = {
	args: {
		children: <span>Your changes have been saved.</span>
	},
	render: () => (
		<Box title="Success" type={BoxTypes.SUCCESS}>
			<span>Your changes have been saved.</span>
		</Box>
	)
};

export const Error: Story = {
	args: {
		children: <span>Something went wrong.</span>
	},
	render: () => (
		<Box title="Error" type={BoxTypes.ERROR}>
			<span>Something went wrong.</span>
		</Box>
	)
};

export const NoTitle: Story = {
	args: {
		children: <span>A plain box without a title or type.</span>
	},
	render: () => (
		<Box>
			<span>A plain box without a title or type.</span>
		</Box>
	)
};
