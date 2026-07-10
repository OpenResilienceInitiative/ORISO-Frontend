import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { DragHandle } from './DragHandle';
import { getComposerHeightBounds, stepComposerHeight } from './composerResize';

const meta = {
	title: 'Components/Composer/DragHandle',
	component: DragHandle,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Composer drag handle (Figma 1168:38118): 57×4 pill on the outer container ' +
					'edge. Drag or use Arrow keys (Shift for large steps, Home/End for min/max) ' +
					'to resize the composer up to two thirds of the viewport height.'
			}
		}
	},
	decorators: [
		(Story) => (
			<div
				style={{
					position: 'relative',
					height: 64,
					width: 420,
					background: '#fff',
					border: '1px solid var(--m3-primary-fixed, #ffdad5)',
					borderRadius: '24px 4px 24px 24px'
				}}
			>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof DragHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
	args: { ariaLabel: 'Drag to resize composer' }
};

export const Touched: Story = {
	args: { ariaLabel: 'Drag to resize composer', touched: true }
};

function KeyboardResizeDemo() {
	const bounds = getComposerHeightBounds({
		viewportWidth: 1280,
		viewportHeight: 900
	});
	const [height, setHeight] = useState(bounds.minHeight);
	return (
		<>
			<DragHandle
				ariaLabel="Drag to resize composer"
				onKeyDown={(e) => {
					const next = stepComposerHeight(
						height,
						{ key: e.key, shiftKey: e.shiftKey },
						bounds
					);
					if (next !== null) {
						e.preventDefault();
						setHeight(next);
					}
				}}
			/>
			<output
				data-testid="height-readout"
				style={{
					position: 'absolute',
					bottom: 8,
					left: 16,
					font: '13px system-ui'
				}}
			>
				{height}px (max {bounds.maxHeight}px = ⅔ viewport)
			</output>
		</>
	);
}

export const KeyboardResize: Story = {
	args: { ariaLabel: 'Drag to resize composer' },
	render: () => <KeyboardResizeDemo />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const handle = await canvas.findByRole('button');
		handle.focus();

		// End jumps to the two-thirds maximum and must clamp there.
		handle.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'End', bubbles: true })
		);
		await waitFor(async () => {
			await expect(
				canvas.getByTestId('height-readout').textContent
			).toContain('600px');
		});

		handle.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
		);
		await waitFor(async () => {
			await expect(
				canvas.getByTestId('height-readout').textContent
			).toContain('600px');
		});
	}
};
