import { Meta, StoryObj } from '@storybook/react';
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

export const Default: Story = {
	render: (args) => (
		<Banner {...args}>
			<span style={{ padding: '12px 16px', display: 'block' }}>
				This is an informational banner message.
			</span>
		</Banner>
	)
};

export const Closable: Story = {
	render: (args) => (
		<Banner {...args} onClose={() => {}}>
			<span style={{ padding: '12px 16px', display: 'block' }}>
				This banner can be dismissed with the close button.
			</span>
		</Banner>
	)
};
