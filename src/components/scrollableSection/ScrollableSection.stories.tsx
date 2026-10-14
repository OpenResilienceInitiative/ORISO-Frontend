import React, { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
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
	args: {
		children: [<LongScrollableBody key="body" />]
	},
	render: () => (
		<ScrollableStoryFrame>
			<div style={storyPanelStyle}>
				<ScrollableSection>
					{[<LongScrollableBody key="body" />]}
				</ScrollableSection>
			</div>
		</ScrollableStoryFrame>
	)
};

export const HeaderAndBody: Story = {
	args: {
		children: [
			<div key="header">Header</div>,
			<LongScrollableBody key="body" />
		]
	},
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
	args: {
		children: [
			<div key="header">Header</div>,
			<LongScrollableBody key="body" />,
			<div key="footer">Footer</div>
		]
	},
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

function StepBodyScrollReset() {
	const [step, setStep] = useState(1);
	return (
		<ScrollableStoryFrame>
			<div style={storyPanelStyle}>
				<ScrollableSection bodyKey={step}>
					<div>Persistent header</div>
					<div>
						{Array.from({ length: 18 }, (_, index) => (
							<p key={index}>
								Step {step}, row {index + 1}
							</p>
						))}
					</div>
					<button type="button" onClick={() => setStep(step + 1)}>
						Next step
					</button>
				</ScrollableSection>
			</div>
		</ScrollableStoryFrame>
	);
}

export const ChangedStepResetsOnlyBody: Story = {
	args: { children: [] },
	render: () => <StepBodyScrollReset />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const next = canvas.getByRole('button', { name: 'Next step' });
		await userEvent.click(next);
		await expect(canvas.getByText('Step 2, row 1')).toBeVisible();
		await expect(next).toHaveFocus();
		await expect(canvas.getByText('Persistent header')).toBeVisible();
	}
};
