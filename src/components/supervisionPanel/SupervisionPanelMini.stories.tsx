/**
 * WP-B1 — the collapsed miniature: a floating card above the chat on desktop,
 * a round FAB on phones. Click / Enter expands; the grip drags (pointer +
 * arrow keys). `kind` swaps icon and label so a thread can reuse it.
 */
import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import {
	DEFAULT_MINI_POSITION,
	SupervisionMiniKind,
	SupervisionMiniPosition,
	SupervisionPanelMini
} from './SupervisionPanelMini';
import { SupervisionPanel } from './SupervisionPanel';
import {
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

/** Relative stage the miniature floats in (the chat card in the app). */
const Stage = ({
	children,
	width = 720,
	height = 480
}: {
	children: React.ReactNode;
	width?: number | string;
	height?: number | string;
}) => (
	<div
		data-cy="mini-stage"
		style={{
			position: 'relative',
			width,
			height,
			borderRadius: 16,
			overflow: 'hidden',
			background: 'var(--m3-surface, #fcf9f9)'
		}}
	>
		<FixtureMainChat />
		{children}
	</div>
);

const meta = {
	title: 'Components/Session/SupervisionPanelMini',
	component: SupervisionPanelMini,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	args: {
		name: SUPERVISOR_NAME,
		unreadCount: 0,
		lastMessage: lastSideRoomSnippet(),
		onExpand: noop
	}
} satisfies Meta<typeof SupervisionPanelMini>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Card: Story = {
	name: 'Card (desktop, no unread)',
	render: (args) => (
		<Stage>
			<SupervisionPanelMini {...args} />
		</Stage>
	),
	play: async ({ canvasElement }) => {
		const mini = canvasElement.querySelector(
			'[data-cy="supervision-mini"]'
		);
		await expect(mini).not.toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="supervision-mini-unread"]')
		).toBeNull();
		const snippet = canvasElement.querySelector(
			'[data-cy="supervision-mini-snippet"]'
		) as HTMLElement;
		// One line with ellipsis: the snippet is clipped, not wrapped.
		await expect(getComputedStyle(snippet).whiteSpace).toBe('nowrap');
		await expect(snippet.scrollWidth).toBeGreaterThan(snippet.clientWidth);
	}
};

export const CardUnreadPulse: Story = {
	name: 'Card with unread + new-message pulse',
	args: { unreadCount: 2, hasNewMessage: true },
	render: (args) => (
		<Stage>
			<SupervisionPanelMini {...args} />
		</Stage>
	),
	play: async ({ canvasElement }) => {
		const badge = canvasElement.querySelector(
			'[data-cy="supervision-mini-unread"]'
		);
		await expect(badge?.textContent).toBe('2');
		await expect(
			canvasElement.querySelector('[data-cy="supervision-mini"]')
		).toHaveClass('supervisionMini--pulse');
	}
};

export const CardThreadKind: Story = {
	name: 'Card reused for a thread (kind=thread)',
	args: {
		kind: 'thread',
		name: 'Antworten auf „Briefe"',
		lastMessage: 'Ich habe die Briefe inzwischen geöffnet.',
		unreadCount: 1
	},
	render: (args) => (
		<Stage>
			<SupervisionPanelMini {...args} />
		</Stage>
	),
	play: async ({ canvasElement }) => {
		const mini = canvasElement.querySelector(
			'[data-cy="supervision-mini"]'
		);
		await expect(mini).toHaveAttribute('data-kind', 'thread');
	}
};

const CollapsibleHarness = ({ initiallyCollapsed = true }) => {
	const [collapsed, setCollapsed] = useState(initiallyCollapsed);
	const [position, setPosition] = useState<SupervisionMiniPosition>(
		DEFAULT_MINI_POSITION
	);
	return (
		<Stage>
			{collapsed ? (
				<SupervisionPanelMini
					name={SUPERVISOR_NAME}
					unreadCount={2}
					hasNewMessage
					lastMessage={lastSideRoomSnippet()}
					onExpand={() => setCollapsed(false)}
					position={position}
					onPositionChange={setPosition}
				/>
			) : (
				<SupervisionPanel
					counterpartName={SUPERVISOR_NAME}
					viewerRole="consultant"
					frame={{ x: 300, y: 24, width: 400, height: 430 }}
					onFrameChange={noop}
					onCollapse={() => setCollapsed(true)}
					onClose={noop}
					renderComposer={() => (
						<FixtureComposer counterpartName={SUPERVISOR_NAME} />
					)}
				>
					<FixtureBubbles
						messages={sideRoomMessages()}
						viewerName={CONSULTANT_NAME}
					/>
				</SupervisionPanel>
			)}
		</Stage>
	);
};

/** Click the miniature → the panel expands; collapse → the miniature is back. */
export const CollapsedToExpanded: Story = {
	name: 'Collapsed → expanded → collapsed (play)',
	render: () => <CollapsibleHarness />,
	play: async ({ canvasElement }) => {
		const expand = canvasElement.querySelector(
			'[data-cy="supervision-mini-expand"]'
		) as HTMLButtonElement;
		await expect(expand).not.toBeNull();
		await userEvent.click(expand);
		await expect(
			canvasElement.querySelector('[data-cy="supervision-panel"]')
		).not.toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="supervision-mini"]')
		).toBeNull();

		const collapse = canvasElement.querySelector(
			'[data-cy="supervision-panel-collapse"]'
		) as HTMLButtonElement;
		await userEvent.click(collapse);
		await expect(
			canvasElement.querySelector('[data-cy="supervision-mini"]')
		).not.toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="supervision-panel"]')
		).toBeNull();
	}
};

/** Enter on the focused miniature expands it too. */
export const ExpandWithKeyboard: Story = {
	name: 'Enter on the miniature expands (play)',
	render: () => <CollapsibleHarness />,
	play: async ({ canvasElement }) => {
		const expand = canvasElement.querySelector(
			'[data-cy="supervision-mini-expand"]'
		) as HTMLButtonElement;
		expand.focus();
		await userEvent.keyboard('{Enter}');
		await expect(
			canvasElement.querySelector('[data-cy="supervision-panel"]')
		).not.toBeNull();
	}
};

/** The grip moves the card with arrow keys; the owner stores the offset. */
export const DragGripKeyboard: Story = {
	name: 'Grip: arrow keys move the card (play)',
	render: () => <CollapsibleHarness />,
	play: async ({ canvasElement }) => {
		const mini = () =>
			canvasElement.querySelector(
				'[data-cy="supervision-mini"]'
			) as HTMLElement;
		const grip = canvasElement.querySelector(
			'[data-cy="supervision-mini-drag-handle"]'
		) as HTMLButtonElement;
		await expect(grip).toHaveAccessibleName();
		const before = mini().getBoundingClientRect();
		grip.focus();
		await userEvent.keyboard('{ArrowLeft}{ArrowUp}');
		const after = mini().getBoundingClientRect();
		await expect(after.left).toBeLessThan(before.left);
		await expect(after.top).toBeLessThan(before.top);
	}
};

const FabHarness = ({
	kind = 'supervision'
}: {
	kind?: SupervisionMiniKind;
}) => {
	const [position, setPosition] = useState<SupervisionMiniPosition>(
		DEFAULT_MINI_POSITION
	);
	const [expanded, setExpanded] = useState(false);
	return (
		<Stage width="100vw" height="100vh">
			<div
				data-cy="fab-expanded"
				data-expanded={expanded ? 'true' : 'false'}
				hidden
			/>
			<SupervisionPanelMini
				variant="fab"
				kind={kind}
				name={SUPERVISOR_NAME}
				unreadCount={2}
				hasNewMessage
				onExpand={() => setExpanded(true)}
				position={position}
				onPositionChange={setPosition}
			/>
		</Stage>
	);
};

/** On a 390px phone the switcher is a round FAB bottom-right with a badge. */
export const FabPhone390: Story = {
	name: 'FAB on Phone 390 (mobile switcher)',
	args: { variant: 'fab', unreadCount: 2 },
	globals: { viewport: { value: 'phone390' } },
	parameters: { layout: 'fullscreen' },
	render: () => <FabHarness />,
	play: async ({ canvasElement }) => {
		const fab = canvasElement.querySelector(
			'[data-cy="supervision-mini"]'
		) as HTMLButtonElement;
		await expect(fab).toHaveClass('supervisionMini--fab');
		await expect(fab).toHaveAccessibleName();
		const stage = canvasElement
			.querySelector('[data-cy="mini-stage"]')!
			.getBoundingClientRect();
		const rect = fab.getBoundingClientRect();
		await expect(stage.right - rect.right).toBeCloseTo(16, 0);
		await expect(stage.bottom - rect.bottom).toBeCloseTo(16, 0);
		await userEvent.click(fab);
		await expect(
			canvasElement.querySelector('[data-cy="fab-expanded"]')
		).toHaveAttribute('data-expanded', 'true');
	}
};

/** A short press expands; a drag moves and does not expand. */
export const FabDragDoesNotExpand: Story = {
	name: 'FAB: drag moves without expanding (play)',
	args: { variant: 'fab' },
	globals: { viewport: { value: 'phone390' } },
	parameters: { layout: 'fullscreen' },
	render: () => <FabHarness />,
	play: async ({ canvasElement }) => {
		const fab = () =>
			canvasElement.querySelector(
				'[data-cy="supervision-mini"]'
			) as HTMLButtonElement;
		const before = fab().getBoundingClientRect();
		const x = before.left + before.width / 2;
		const y = before.top + before.height / 2;
		const fire = (type: string, cx: number, cy: number) =>
			fab().dispatchEvent(
				new PointerEvent(type, {
					bubbles: true,
					pointerId: 1,
					button: 0,
					clientX: cx,
					clientY: cy
				})
			);
		fire('pointerdown', x, y);
		fire('pointermove', x - 40, y - 60);
		fire('pointermove', x - 80, y - 120);
		fire('pointerup', x - 80, y - 120);
		await tick();
		fab().click();
		await tick();
		const after = fab().getBoundingClientRect();
		await expect(before.left - after.left).toBeCloseTo(80, 0);
		await expect(before.top - after.top).toBeCloseTo(120, 0);
		await expect(
			canvasElement.querySelector('[data-cy="fab-expanded"]')
		).toHaveAttribute('data-expanded', 'false');
	}
};

export const FabThreadKind: Story = {
	name: 'FAB reused for a thread (kind=thread)',
	args: { variant: 'fab', kind: 'thread' },
	globals: { viewport: { value: 'phone390' } },
	parameters: { layout: 'fullscreen' },
	render: () => <FabHarness kind="thread" />
};

export const DarkScheme: Story = {
	name: 'Dark scheme (Storybook scheme global)',
	args: { unreadCount: 2, hasNewMessage: true },
	globals: { scheme: 'dark' },
	render: (args) => (
		<Stage>
			<SupervisionPanelMini {...args} />
		</Stage>
	)
};
