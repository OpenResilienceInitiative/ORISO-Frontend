import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ResizableHandle } from './ResizableHandle';
import './sessionsList.styles.scss';

const meta = {
	title: 'Components/Session/List/ResizableHandle',
	component: ResizableHandle,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Drag the **right edge** of the gray panel to resize (used on `SessionsListWrapper`). Snaps around icon-only width. Class: `sessionsList__resizeHandle`.'
			}
		}
	},
	argTypes: {
		minWidth: { control: { type: 'number' } },
		maxWidth: { control: { type: 'number' } }
	}
} satisfies Meta<typeof ResizableHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

function ResizeDemo({
	minWidth = 80,
	maxWidth = 600
}: {
	minWidth?: number;
	maxWidth?: number;
}) {
	const [width, setWidth] = useState(320);
	return (
		<div
			style={{
				display: 'flex',
				height: 220,
				fontFamily: 'system-ui, sans-serif',
				fontSize: 13
			}}
		>
			<div
				style={{
					width,
					position: 'relative',
					flexShrink: 0,
					background: '#f5f5f5',
					border: '1px solid #e0e0e0',
					padding: 12,
					boxSizing: 'border-box'
				}}
			>
				<strong>Session list</strong>
				<p style={{ margin: '8px 0 0', color: '#666' }}>
					Width: <code>{width}px</code>
				</p>
				<p style={{ margin: '8px 0 0', color: '#666', fontSize: 12 }}>
					Drag the right edge →
				</p>
				<ResizableHandle
					currentWidth={width}
					onResize={setWidth}
					minWidth={minWidth}
					maxWidth={maxWidth}
				/>
			</div>
			<div
				style={{
					flex: 1,
					background: '#fff',
					border: '1px solid #eee',
					padding: 12
				}}
			>
				Main content column
			</div>
		</div>
	);
}

export const Default: Story = {
	args: {
		currentWidth: 320,
		minWidth: 80,
		maxWidth: 600
	},
	render: () => <ResizeDemo />
};

export const NarrowMin: Story = {
	args: {
		currentWidth: 320,
		minWidth: 120,
		maxWidth: 400
	},
	render: () => <ResizeDemo minWidth={120} maxWidth={400} />
};
