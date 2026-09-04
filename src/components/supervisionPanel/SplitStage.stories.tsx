/**
 * WP-B1 — desktop split: client chat left, supervision panel right, a
 * divider you can drag with the pointer or the keyboard. Below 768px the
 * stage is single-pane and the FAB flips between chat and side room.
 */
import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { SplitStage, SplitStagePane } from './SplitStage';
import { SupervisionPanel } from './SupervisionPanel';
import { SupervisionPanelMini } from './SupervisionPanelMini';
import {
	CLIENT_NAME,
	CONSULTANT_NAME,
	FixtureBubbles,
	FixtureComposer,
	FixtureMainChat,
	SUPERVISOR_NAME,
	lastSideRoomSnippet,
	sideRoomMessages
} from './supervisionPanel.fixtures';
import './supervisionPanel.styles.scss';

const noop = () => undefined;

/** Let React flush the state update behind a synthetic pointer event. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const SidePanel = ({
	onClose,
	onCollapse,
	withMessages = true
}: {
	onClose?: () => void;
	onCollapse?: () => void;
	withMessages?: boolean;
}) => (
	<SupervisionPanel
		counterpartName={SUPERVISOR_NAME}
		viewerRole="consultant"
		unreadCount={withMessages ? 1 : 0}
		onClose={onClose ?? noop}
		onCollapse={onCollapse ?? noop}
		renderComposer={() => (
			<FixtureComposer counterpartName={SUPERVISOR_NAME} />
		)}
	>
		{withMessages && (
			<FixtureBubbles
				messages={sideRoomMessages()}
				viewerName={CONSULTANT_NAME}
			/>
		)}
	</SupervisionPanel>
);

const Frame = ({
	children,
	fullscreen = false
}: {
	children: React.ReactNode;
	fullscreen?: boolean;
}) => (
	<div
		style={
			fullscreen
				? { width: '100vw', height: '100vh' }
				: {
						width: 1200,
						maxWidth: '100%',
						height: 640,
						border: '1px solid var(--m3-outline-variant, #c4c7c8)',
						borderRadius: 16,
						overflow: 'hidden'
					}
		}
	>
		{children}
	</div>
);

const meta = {
	title: 'Components/Session/SplitStage',
	component: SplitStage,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	args: {
		main: <FixtureMainChat />,
		secondary: <SidePanel />,
		secondaryOpen: true
	}
} satisfies Meta<typeof SplitStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Desktop: both panes, divider between. The client only exists on the left. */
export const DesktopSplit: Story = {
	name: 'Desktop split (chat left, supervision right)',
	args: { mode: 'split' },
	render: (args) => (
		<Frame>
			<SplitStage {...args} />
		</Frame>
	),
	play: async ({ canvasElement }) => {
		const main = canvasElement.querySelector(
			'[data-cy="split-stage-main"]'
		);
		const secondary = canvasElement.querySelector(
			'[data-cy="split-stage-secondary"]'
		);
		await expect(main).not.toBeNull();
		await expect(secondary).not.toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="split-stage-divider"]')
		).not.toBeNull();
		await expect(main!.textContent).toContain(CLIENT_NAME);
		await expect(secondary!.textContent).not.toContain(CLIENT_NAME);
		const mainRect = main!.getBoundingClientRect();
		const secondaryRect = secondary!.getBoundingClientRect();
		await expect(secondaryRect.left).toBeGreaterThan(mainRect.right - 1);
	}
};

export const SecondaryClosed: Story = {
	name: 'Secondary closed — main pane only',
	args: { mode: 'split', secondaryOpen: false },
	render: (args) => (
		<Frame>
			<SplitStage {...args} />
		</Frame>
	),
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector('[data-cy="split-stage-secondary"]')
		).toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="split-stage-divider"]')
		).toBeNull();
	}
};

export const EmptySideRoom: Story = {
	name: 'Desktop split with an empty side room',
	args: { mode: 'split', secondary: <SidePanel withMessages={false} /> },
	render: (args) => (
		<Frame>
			<SplitStage {...args} />
		</Frame>
	)
};

const fireOn = (target: Element, type: string, x: number, y: number): boolean =>
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			pointerId: 1,
			button: 0,
			clientX: x,
			clientY: y
		})
	);

/** Dragging the divider left widens the side panel; keyboard does the same. */
export const DividerDrag: Story = {
	name: 'Divider: pointer drag + arrow keys (play)',
	args: { mode: 'split', defaultSecondaryWidth: 400 },
	render: (args) => (
		<Frame>
			<SplitStage {...args} />
		</Frame>
	),
	play: async ({ canvasElement }) => {
		const secondary = () =>
			canvasElement.querySelector(
				'[data-cy="split-stage-secondary"]'
			) as HTMLElement;
		const divider = canvasElement.querySelector(
			'[data-cy="split-stage-divider"]'
		) as HTMLElement;
		await expect(divider).toHaveAttribute('role', 'separator');
		await expect(divider).toHaveAttribute('aria-valuenow', '400');

		const before = secondary().getBoundingClientRect().width;
		const rect = divider.getBoundingClientRect();
		const x = rect.left + rect.width / 2;
		const y = rect.top + rect.height / 2;
		fireOn(divider, 'pointerdown', x, y);
		fireOn(divider, 'pointermove', x - 50, y);
		fireOn(divider, 'pointermove', x - 100, y);
		fireOn(divider, 'pointerup', x - 100, y);
		await tick();
		const afterDrag = secondary().getBoundingClientRect().width;
		await expect(afterDrag - before).toBeCloseTo(100, 0);
		await expect(divider).toHaveAttribute('aria-valuenow', '500');

		divider.focus();
		await userEvent.keyboard('{ArrowRight}{ArrowRight}');
		const afterKeys = secondary().getBoundingClientRect().width;
		await expect(afterDrag - afterKeys).toBeCloseTo(32, 0);
	}
};

/** Minimum widths hold: the divider cannot crush either pane. */
export const DividerLimits: Story = {
	name: 'Divider respects min widths (play)',
	args: {
		mode: 'split',
		defaultSecondaryWidth: 400,
		minMainWidth: 500,
		minSecondaryWidth: 320
	},
	render: (args) => (
		<Frame>
			<SplitStage {...args} />
		</Frame>
	),
	play: async ({ canvasElement }) => {
		const secondary = () =>
			canvasElement.querySelector(
				'[data-cy="split-stage-secondary"]'
			) as HTMLElement;
		const main = () =>
			canvasElement.querySelector(
				'[data-cy="split-stage-main"]'
			) as HTMLElement;
		const divider = canvasElement.querySelector(
			'[data-cy="split-stage-divider"]'
		) as HTMLElement;
		divider.focus();
		await userEvent.keyboard('{End}');
		await expect(
			main().getBoundingClientRect().width
		).toBeGreaterThanOrEqual(499);
		await userEvent.keyboard('{Home}');
		await expect(
			Math.round(secondary().getBoundingClientRect().width)
		).toBe(320);
	}
};

const PhoneHarness = () => {
	const [activePane, setActivePane] = useState<SplitStagePane>('main');
	return (
		<Frame fullscreen>
			<SplitStage
				mode="single"
				activePane={activePane}
				secondaryOpen
				main={<FixtureMainChat />}
				secondary={
					<SidePanel
						onClose={() => setActivePane('main')}
						onCollapse={() => setActivePane('main')}
					/>
				}
				switcher={
					activePane === 'main' ? (
						<SupervisionPanelMini
							variant="fab"
							name={SUPERVISOR_NAME}
							unreadCount={1}
							hasNewMessage
							lastMessage={lastSideRoomSnippet()}
							onExpand={() => setActivePane('secondary')}
						/>
					) : null
				}
			/>
		</Frame>
	);
};

/** Phone: only the chat; the FAB opens the side room full-screen, close returns. */
export const Phone390Switcher: Story = {
	name: 'Phone 390 — FAB toggles the full-screen side room (play)',
	args: { mode: 'single' },
	globals: { viewport: { value: 'phone390' } },
	parameters: { layout: 'fullscreen' },
	render: () => <PhoneHarness />,
	play: async ({ canvasElement }) => {
		const stage = canvasElement.querySelector('[data-cy="split-stage"]');
		await expect(stage).toHaveAttribute('data-mode', 'single');
		await expect(
			canvasElement.querySelector('[data-cy="split-stage-secondary"]')
		).toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="split-stage-divider"]')
		).toBeNull();

		const fab = canvasElement.querySelector(
			'[data-cy="supervision-mini"]'
		) as HTMLButtonElement;
		await expect(fab).toHaveClass('supervisionMini--fab');
		await userEvent.click(fab);

		const secondary = canvasElement.querySelector(
			'[data-cy="split-stage-secondary"]'
		) as HTMLElement;
		await expect(secondary).not.toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="split-stage-main"]')
		).toBeNull();
		const stageRect = stage!.getBoundingClientRect();
		await expect(secondary.getBoundingClientRect().width).toBeCloseTo(
			stageRect.width,
			0
		);

		await userEvent.click(
			canvasElement.querySelector(
				'[data-cy="supervision-panel-close"]'
			) as HTMLButtonElement
		);
		await expect(
			canvasElement.querySelector('[data-cy="split-stage-main"]')
		).not.toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="supervision-mini"]')
		).not.toBeNull();
	}
};

const CollapsibleDesktop = () => {
	const [collapsed, setCollapsed] = useState(false);
	return (
		<Frame>
			<SplitStage
				mode="split"
				secondaryOpen={!collapsed}
				main={<FixtureMainChat />}
				secondary={<SidePanel onCollapse={() => setCollapsed(true)} />}
				switcher={
					collapsed ? (
						<SupervisionPanelMini
							name={SUPERVISOR_NAME}
							unreadCount={1}
							hasNewMessage
							lastMessage={lastSideRoomSnippet()}
							onExpand={() => setCollapsed(false)}
						/>
					) : null
				}
			/>
		</Frame>
	);
};

/** Desktop: collapse the pane into the miniature and back. */
export const DesktopCollapseToMini: Story = {
	name: 'Desktop — collapse to miniature and back (play)',
	args: { mode: 'split' },
	render: () => <CollapsibleDesktop />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			canvasElement.querySelector(
				'[data-cy="supervision-panel-collapse"]'
			) as HTMLButtonElement
		);
		await expect(
			canvasElement.querySelector('[data-cy="split-stage-secondary"]')
		).toBeNull();
		const mini = canvasElement.querySelector(
			'[data-cy="supervision-mini-expand"]'
		) as HTMLButtonElement;
		await expect(mini).not.toBeNull();
		await userEvent.click(mini);
		await expect(
			canvasElement.querySelector('[data-cy="split-stage-secondary"]')
		).not.toBeNull();
	}
};

export const DarkScheme: Story = {
	name: 'Dark scheme (Storybook scheme global)',
	args: { mode: 'split' },
	globals: { scheme: 'dark' },
	render: (args) => (
		<Frame>
			<SplitStage {...args} />
		</Frame>
	)
};
