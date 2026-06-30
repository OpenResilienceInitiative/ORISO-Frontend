import { Meta, StoryObj } from '@storybook/react';
import { Box } from '@mui/material';
import React from 'react';
import { Banner } from './Banner';

const meta = {
	title: 'Molecules/Banner',
	component: Banner,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'A portal-rendered banner pinned to the app stage, with optional close button.'
			}
		}
	}
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

function BannerStoryContent({ children }: { children: React.ReactNode }) {
	return (
		<Box component="span" sx={{ display: 'block', px: 2, py: 1.5 }}>
			{children}
		</Box>
	);
}

export const Default: Story = {
	render: (args) => (
		<Banner {...args}>
			<BannerStoryContent>
				This is an informational banner message.
			</BannerStoryContent>
		</Banner>
	)
};

export const Closable: Story = {
	render: (args) => (
		<Banner {...args} onClose={() => {}}>
			<BannerStoryContent>
				This banner can be dismissed with the close button.
			</BannerStoryContent>
		</Banner>
	)
};
