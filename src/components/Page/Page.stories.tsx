import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { Page } from './';

const meta = {
	title: 'Atoms/Page',
	component: Page,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Layout wrapper that renders a page container and an optional Page.Title subcomponent.'
			}
		}
	}
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		children: <span>Page content</span>
	},
	render: () => (
		<Page>
			<span>Page content</span>
		</Page>
	)
};

export const WithTitle: Story = {
	args: {
		children: [
			<Page.Title key="title">Section heading</Page.Title>,
			<span key="content">Page content</span>
		]
	},
	render: () => (
		<Page>
			<Page.Title>Section heading</Page.Title>
			<span>Page content</span>
		</Page>
	)
};
