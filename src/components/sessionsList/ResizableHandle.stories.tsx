import * as React from 'react';
import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent } from 'storybook/test';
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

/**
 * Interaction test for the atom (ORISO-Frontend#1196).
 *
 * Keyboard is what a play function can drive deterministically - a pointer
 * drag depends on real layout geometry Storybook cannot give us reliably - and
 * it runs through the same normalizeWidth path the pointer drag ends in, so
 * the snapping contract is covered either way.
 */
export const KeyboardResizeInteraction: Story = {
	name: 'Interaction — keyboard resize and snapping',
	args: {
		currentWidth: 320,
		minWidth: 120,
		maxWidth: 600,
		onResize: () => {}
	},
	render: (args) => <ResizeDemo {...args} />,
	play: async ({ canvasElement }) => {
		const handle = canvasElement.querySelector(
			'.sessionsList__resizeHandle'
		) as HTMLElement | null;
		const width = () =>
			Number(
				canvasElement
					.querySelector('code')
					?.textContent?.replace('px', '')
			);

		await expect(handle).not.toBeNull();
		// The bar is the whole control: it reports itself as a separator and
		// carries the current width, so assistive tech can read and change it.
		await expect(handle).toHaveAttribute('role', 'separator');
		await expect(handle).toHaveAttribute('aria-valuenow', '320');

		// #1196 job 3: the collapse chevron is gone. Double-click and wheel on
		// the bar carry that function now, so a stray button would be a
		// regression rather than a spare affordance.
		await expect(
			canvasElement.querySelector('.sessionsList__resizeToggle')
		).toBeNull();

		handle!.focus();

		// 320 sits in the dead band between the icon-only rail (220) and the
		// expanded minimum (397). Any resize has to leave that band rather than
		// strand the list at a width that truncates every row.
		await userEvent.keyboard('{ArrowRight}');
		await expect(width()).toBe(397);

		// Stepping back down holds at the expanded minimum for the same reason.
		await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
		await expect(width()).toBe(397);

		// Home and End go to the configured bounds exactly, without snapping.
		await userEvent.keyboard('{Home}');
		await expect(width()).toBe(120);

		await userEvent.keyboard('{End}');
		await expect(width()).toBe(600);
	}
};

function ScrollOnlyDemo() {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	return (
		<div
			style={{
				position: 'relative',
				width: 360,
				border: '1px solid #e0e0e0',
				borderRadius: 8,
				background: '#fff',
				fontFamily: 'system-ui, sans-serif',
				fontSize: 13
			}}
		>
			<div
				ref={scrollRef}
				style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 20 }}
			>
				{Array.from({ length: 24 }, (_, i) => (
					<div key={i} style={{ padding: '10px 12px' }}>
						Thread {i + 1}
					</div>
				))}
			</div>
			<ResizableHandle
				mode="scroll"
				scrollTargetRef={scrollRef}
				className="sessionsList__resizeHandle--inset"
			/>
		</div>
	);
}

/**
 * Scroll-only mode, as the threads dropdown uses it (ORISO-Frontend#1196
 * job 2). The panel has a fixed width, so the bar scrolls and never resizes.
 */
export const ScrollOnlyInteraction: Story = {
	name: 'Interaction — scroll-only (threads dropdown)',
	args: { onResize: () => {} },
	render: () => <ScrollOnlyDemo />,
	play: async ({ canvasElement }) => {
		const handle = canvasElement.querySelector(
			'.sessionsList__resizeHandle'
		) as HTMLElement | null;
		const scroller = canvasElement.querySelector(
			'div[style*="overflow"]'
		) as HTMLElement | null;

		await expect(handle).not.toBeNull();
		await expect(scroller).not.toBeNull();

		// It announces as a scrollbar, not a separator: there is no width to
		// move here, so "separator" would promise a control that does nothing.
		await expect(handle).toHaveAttribute('role', 'scrollbar');
		await expect(handle).toHaveAttribute('aria-valuemax', '100');

		handle!.focus();
		await expect(scroller!.scrollTop).toBe(0);

		await userEvent.keyboard('{ArrowDown}');
		await expect(scroller!.scrollTop).toBeGreaterThan(0);

		await userEvent.keyboard('{Home}');
		await expect(scroller!.scrollTop).toBe(0);

		// End goes to the bottom rather than resizing anything.
		await userEvent.keyboard('{End}');
		await expect(scroller!.scrollTop).toBeGreaterThan(0);
	}
};
