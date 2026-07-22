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
	maxWidth = 600,
	currentWidth = 320
}: Readonly<{
	minWidth?: number;
	maxWidth?: number;
	currentWidth?: number;
}>) {
	const [width, setWidth] = useState(320);
	React.useEffect(() => {
		setWidth(currentWidth);
	}, [currentWidth]);
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
					background: '#eae7e8',
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
	name: 'Empty desk — pill visible',
	args: {
		currentWidth: 320,
		minWidth: 80,
		maxWidth: 600,
		onResize: () => {}
	},
	parameters: {
		docs: {
			description: {
				story: 'No conversation selected: white `.sessionsList__resizeHandlePill` is visible (list↔chat separator).'
			}
		}
	},
	render: (args) => <ResizeDemo {...args} />
};

export const ChatActivePillHidden: Story = {
	name: 'Chat active — pill hidden',
	args: {
		currentWidth: 320,
		minWidth: 80,
		maxWidth: 600,
		onResize: () => {}
	},
	parameters: {
		docs: {
			description: {
				story: 'When `SessionsZone` marks the list as `contentWrapper__list--smallInactive` (session detail route), the white separator pill is hidden (`opacity: 0`).'
			}
		}
	},
	render: (args) => (
		<div className="contentWrapper__list contentWrapper__list--smallInactive">
			<ResizeDemo {...args} />
		</div>
	)
};

export const NarrowMin: Story = {
	args: {
		currentWidth: 320,
		minWidth: 120,
		maxWidth: 400,
		onResize: () => {}
	},
	render: (args) => <ResizeDemo {...args} />
};
