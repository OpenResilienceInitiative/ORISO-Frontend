import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { ScrollableSection } from './ScrollableSection';

const meta = {
	title: 'Atoms/ScrollableSection',
	component: ScrollableSection,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Layout wrapper that renders its children as an optional header, a scrollable body, and an optional footer.'
			}
		}
	}
} satisfies Meta<typeof ScrollableSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BodyOnly: Story = {
	render: () => (
		<ScrollableSection>
			<div>Scrollable body content</div>
		</ScrollableSection>
	)
};

export const HeaderAndBody: Story = {
	render: () => (
		<ScrollableSection>
			<div>Header</div>
			<div>Scrollable body content</div>
		</ScrollableSection>
	)
};

export const HeaderBodyFooter: Story = {
	render: () => (
		<ScrollableSection>
			<div>Header</div>
			<div>Scrollable body content</div>
			<div>Footer</div>
		</ScrollableSection>
	)
};
