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
					'Drag the **right edge** of the gray panel to resize (used on `SessionsListWrapper`). Snaps around icon-only width. Class: `sessionsList__resizeHandle`.\n\n' +
					'The bar is a **handle, not a scrollbar thumb**: once the list overflows it keeps its place in the middle of the panel and the scroll area behind it stays invisible. Dragging it vertically still scrolls the list.'
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
	currentWidth = 320,
	rows = 20
}: Readonly<{
	minWidth?: number;
	maxWidth?: number;
	currentWidth?: number;
	/** Enough rows to overflow, so the bar can be seen holding its place. */
	rows?: number;
}>) {
	const [width, setWidth] = useState(320);
	const scrollRef = useRef<HTMLDivElement | null>(null);
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
					boxSizing: 'border-box'
				}}
			>
				<div style={{ padding: 12 }}>
					<strong>Session list</strong>
					<p style={{ margin: '8px 0 0', color: '#666' }}>
						Width: <code>{width}px</code>
					</p>
				</div>
				<div
					ref={scrollRef}
					data-testid="list-scroll"
					// Native scrollbar hidden, as the real list does: the bar is
					// the affordance and the scroll area behind it is invisible.
					style={{
						maxHeight: 140,
						overflowY: 'auto',
						scrollbarWidth: 'none'
					}}
				>
					{Array.from({ length: rows }, (_, i) => (
						<div key={i} style={{ padding: '8px 12px' }}>
							Conversation {i + 1}
						</div>
					))}
				</div>
				<ResizableHandle
					currentWidth={width}
					onResize={setWidth}
					scrollTargetRef={scrollRef}
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
 * Interaction test for the handle (ORISO-Frontend#1196).
 *
 * The list here overflows, which is the case the issue is about: the bar used
 * to turn into a scrollbar thumb and travel with the scroll position. It has
 * to hold its place instead.
 *
 * Keyboard is what a play function can drive deterministically — a pointer
 * drag depends on real layout geometry Storybook cannot give us reliably — and
 * it runs through the same normalizeWidth path the pointer drag ends in.
 */
export const DragBarInteraction: Story = {
	name: 'Interaction — bar holds its place while the list scrolls',
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
		const pill = canvasElement.querySelector(
			'.sessionsList__resizeHandlePill'
		) as HTMLElement | null;
		const list = canvasElement.querySelector(
			'[data-testid="list-scroll"]'
		) as HTMLElement | null;
		const width = () =>
			Number(
				canvasElement
					.querySelector('code')
					?.textContent?.replace('px', '')
			);

		await expect(handle).not.toBeNull();
		await expect(pill).not.toBeNull();
		await expect(list).not.toBeNull();

		// The bar is the whole control: it reports itself as a separator and
		// carries the current width, so assistive tech can read and change it.
		await expect(handle).toHaveAttribute('role', 'separator');
		await expect(handle).toHaveAttribute('aria-valuenow', '320');

		// The collapse chevron is gone; double-click and wheel on the bar carry
		// that function now, so a stray button would be a regression.
		await expect(
			canvasElement.querySelector('.sessionsList__resizeToggle')
		).toBeNull();

		// The list overflows — the case that used to move the bar.
		await expect(list!.scrollHeight).toBeGreaterThan(list!.clientHeight);
		const restingTop = pill!.getBoundingClientRect().top;
		const restingHeight = pill!.getBoundingClientRect().height;

		list!.scrollTop = list!.scrollHeight - list!.clientHeight;
		list!.dispatchEvent(new Event('scroll'));
		await new Promise((resolve) => setTimeout(resolve, 150));

		// Scrolled to the bottom, the bar has neither moved nor resized.
		await expect(pill!.getBoundingClientRect().top).toBe(restingTop);
		await expect(pill!.getBoundingClientRect().height).toBe(restingHeight);

		handle!.focus();

		// 320 sits in the dead band between the icon-only rail (220) and the
		// expanded minimum (397). A resize has to leave that band rather than
		// strand the list at a width that truncates every row.
		await userEvent.keyboard('{ArrowRight}');
		await expect(width()).toBe(397);

		// Home and End go to the configured bounds exactly, without snapping.
		await userEvent.keyboard('{Home}');
		await expect(width()).toBe(120);

		await userEvent.keyboard('{End}');
		await expect(width()).toBe(600);
	}
};
