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

const storyFrameStyle: React.CSSProperties = {
	width: 360,
	height: 220,
	border: '1px solid var(--m3-outline-variant, #D7D1D4)',
	borderRadius: 12,
	overflow: 'hidden'
};

const storyPanelStyle: React.CSSProperties = {
	height: '100%'
};

const longBodyItems = Array.from({ length: 18 }, (_, index) => (
	<p key={index}>Scrollable body row {index + 1}</p>
));

function ScrollableStoryFrame({ children }: { children: React.ReactNode }) {
	return <div style={storyFrameStyle}>{children}</div>;
}

function LongScrollableBody() {
	return <div>{longBodyItems}</div>;
}

export const BodyOnly: Story = {
	render: () => (
		<ScrollableStoryFrame>
			<div style={storyPanelStyle}>
				<ScrollableSection>
					<LongScrollableBody />
				</ScrollableSection>
			</div>
		</ScrollableStoryFrame>
	)
};

export const HeaderAndBody: Story = {
	render: () => (
		<ScrollableStoryFrame>
			<div style={storyPanelStyle}>
				<ScrollableSection>
					<div>Header</div>
					<LongScrollableBody />
				</ScrollableSection>
			</div>
		</ScrollableStoryFrame>
	)
};

export const HeaderBodyFooter: Story = {
	render: () => (
		<ScrollableStoryFrame>
			<div style={storyPanelStyle}>
				<ScrollableSection>
					<div>Header</div>
					<LongScrollableBody />
					<div>Footer</div>
				</ScrollableSection>
			</div>
		</ScrollableStoryFrame>
	)
};
