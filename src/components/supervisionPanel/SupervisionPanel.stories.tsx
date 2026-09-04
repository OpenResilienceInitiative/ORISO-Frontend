/**
 * WP-B1 — Supervision as a parallel chat next to the client chat.
 *
 * These stories are the review surface for the panel's *shape*: header with
 * role label + responsible person, the never-visible-to-the-client line,
 * timeline slot, composer slot, close/collapse, and a drag handle that works
 * from the keyboard. Transport arrives in B2; nothing here talks to Matrix.
 */
import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { SupervisionPanel, SupervisionPanelFrame } from './SupervisionPanel';
import {
	CLIENT_NAME,
	CONSULTANT_NAME,
	FixtureBubbles,
	FixtureComposer,
	SUPERVISOR_NAME,
	counterpartFor,
	sideRoomMessages
} from './supervisionPanel.fixtures';
import './supervisionPanel.styles.scss';

const noop = () => undefined;

/** Let React flush the state update behind a synthetic pointer event. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const Docked = (
	props: Partial<React.ComponentProps<typeof SupervisionPanel>> & {
		viewerRole: 'consultant' | 'supervisor';
		withMessages?: boolean;
	}
) => {
	const { viewerRole, withMessages = true, ...rest } = props;
	const counterpartName = counterpartFor(viewerRole);
	const viewerName =
		viewerRole === 'consultant' ? CONSULTANT_NAME : SUPERVISOR_NAME;
	return (
		<div style={{ width: 440, height: 560 }}>
			<SupervisionPanel
				counterpartName={counterpartName}
				viewerRole={viewerRole}
				onClose={noop}
				onCollapse={noop}
				renderComposer={() => (
					<FixtureComposer counterpartName={counterpartName} />
				)}
				{...rest}
			>
				{withMessages && (
					<FixtureBubbles
						messages={sideRoomMessages()}
						viewerName={viewerName}
					/>
				)}
			</SupervisionPanel>
		</div>
	);
};

const meta = {
	title: 'Components/Session/SupervisionPanel',
	component: SupervisionPanel,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'Expanded supervision side room: a parallel chat next to the client chat. Header names the responsible person, a hint says the client never sees this channel, the timeline and composer are slots.'
			}
		}
	}
} satisfies Meta<typeof SupervisionPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const expectNoClientInSideRoom = (panel: HTMLElement) =>
	expect(panel.textContent ?? '').not.toContain(CLIENT_NAME);

/** The consultant sees the supervisor as the responsible person. */
export const ConsultantView: Story = {
	name: 'Consultant view (supervisor is the counterpart)',
	args: { counterpartName: SUPERVISOR_NAME, viewerRole: 'consultant' },
	render: () => <Docked viewerRole="consultant" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const panel = canvasElement.querySelector(
			'[data-cy="supervision-panel"]'
		) as HTMLElement;
		await expect(panel).not.toBeNull();
		await expect(
			canvas.getByText(SUPERVISOR_NAME, {
				selector: '.supervisionPanel__titleName'
			})
		).toBeVisible();
		const role = panel.querySelector('[data-cy="supervision-panel-role"]');
		await expect(role?.textContent?.trim().length).toBeGreaterThan(0);
		await expect(
			panel.querySelector('.supervisionPanel__privacyHint')
		).not.toBeNull();
		await expect(
			panel.querySelectorAll('[data-cy="supervision-bubble"]').length
		).toBe(4);
		// Own bubbles are the consultant's — the viewer's — messages.
		await expect(
			panel.querySelectorAll(
				'[data-cy="supervision-bubble"][data-own="true"]'
			).length
		).toBe(2);
		await expectNoClientInSideRoom(panel);
	}
};

/** The supervisor sees the consultant as the responsible person. */
export const SupervisorView: Story = {
	name: 'Supervisor view (consultant is the counterpart)',
	args: { counterpartName: CONSULTANT_NAME, viewerRole: 'supervisor' },
	render: () => <Docked viewerRole="supervisor" />,
	play: async ({ canvasElement }) => {
		const panel = canvasElement.querySelector(
			'[data-cy="supervision-panel"]'
		) as HTMLElement;
		await expect(
			panel.querySelector('[data-cy="supervision-panel-counterpart"]')
				?.textContent
		).toBe(CONSULTANT_NAME);
		const consultantRole = panel.querySelector(
			'[data-cy="supervision-panel-role"]'
		)?.textContent;
		await expect(consultantRole?.trim().length).toBeGreaterThan(0);
		await expectNoClientInSideRoom(panel);
	}
};

/** Role chip differs between the two viewers — checked behaviourally, not by wording. */
export const RoleChipDiffersByViewer: Story = {
	name: 'Role chip changes with the viewer',
	args: { counterpartName: SUPERVISOR_NAME, viewerRole: 'consultant' },
	render: () => (
		<div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
			<Docked viewerRole="consultant" data-cy="panel-consultant" />
			<Docked viewerRole="supervisor" data-cy="panel-supervisor" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const chipOf = (cy: string) =>
			canvasElement
				.querySelector(
					`[data-cy="${cy}"] [data-cy="supervision-panel-role"]`
				)
				?.textContent?.trim();
		await expect(chipOf('panel-consultant')).not.toBe(
			chipOf('panel-supervisor')
		);
	}
};

export const UnreadState: Story = {
	name: 'Unread messages in the side room',
	args: {
		counterpartName: SUPERVISOR_NAME,
		viewerRole: 'consultant',
		unreadCount: 3
	},
	render: (args) => (
		<Docked viewerRole="consultant" unreadCount={args.unreadCount} />
	),
	play: async ({ canvasElement }) => {
		const badge = canvasElement.querySelector(
			'[data-cy="supervision-panel-unread"]'
		);
		await expect(badge).not.toBeNull();
		await expect(badge?.textContent).toBe('3');
	}
};

export const EmptySideRoom: Story = {
	name: 'Empty side room (no messages yet)',
	args: { counterpartName: SUPERVISOR_NAME, viewerRole: 'consultant' },
	render: () => <Docked viewerRole="consultant" withMessages={false} />,
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector('[data-cy="supervision-panel-empty"]')
		).not.toBeNull();
		await expect(
			canvasElement.querySelectorAll('[data-cy="supervision-bubble"]')
				.length
		).toBe(0);
	}
};

/** No handlers → buttons stay visible but disabled (disable, never hide). */
export const WithoutCloseOrCollapse: Story = {
	name: 'Close / collapse disabled when no handler',
	args: { counterpartName: SUPERVISOR_NAME, viewerRole: 'consultant' },
	render: () => (
		<Docked
			viewerRole="consultant"
			onClose={undefined}
			onCollapse={undefined}
		/>
	),
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector('[data-cy="supervision-panel-close"]')
		).toBeDisabled();
		await expect(
			canvasElement.querySelector(
				'[data-cy="supervision-panel-collapse"]'
			)
		).toBeDisabled();
	}
};

const FloatingHarness = () => {
	const [frame, setFrame] = useState<SupervisionPanelFrame>({
		x: 40,
		y: 24,
		width: 400,
		height: 420
	});
	return (
		<div
			data-cy="floating-stage"
			style={{
				position: 'relative',
				width: 900,
				height: 560,
				borderRadius: 16,
				background: 'var(--m3-surface-container, #f1ecec)'
			}}
		>
			<SupervisionPanel
				counterpartName={SUPERVISOR_NAME}
				viewerRole="consultant"
				frame={frame}
				onFrameChange={setFrame}
				onClose={noop}
				onCollapse={noop}
				renderComposer={() => (
					<FixtureComposer counterpartName={SUPERVISOR_NAME} />
				)}
			>
				<FixtureBubbles
					messages={sideRoomMessages()}
					viewerName={CONSULTANT_NAME}
				/>
			</SupervisionPanel>
		</div>
	);
};

/**
 * Floating pane with a live frame. The grip moves with arrow keys and resizes
 * with Shift + arrow keys — the keyboard path for "repositionable like a
 * floating pane".
 */
export const DragHandleKeyboard: Story = {
	name: 'Drag handle: arrow keys move, Shift+arrow resizes (play)',
	args: { counterpartName: SUPERVISOR_NAME, viewerRole: 'consultant' },
	render: () => <FloatingHarness />,
	play: async ({ canvasElement }) => {
		const panel = () =>
			canvasElement.querySelector(
				'[data-cy="supervision-panel"]'
			) as HTMLElement;
		const grip = canvasElement.querySelector(
			'[data-cy="supervision-panel-drag-handle"]'
		) as HTMLButtonElement;
		await expect(grip).toHaveAccessibleName();

		const before = panel().getBoundingClientRect();
		grip.focus();
		await userEvent.keyboard('{ArrowRight}{ArrowDown}');
		const moved = panel().getBoundingClientRect();
		await expect(moved.left).toBeGreaterThan(before.left);
		await expect(moved.top).toBeGreaterThan(before.top);
		await expect(moved.width).toBe(before.width);

		await userEvent.keyboard('{Shift>}{ArrowRight}{ArrowDown}{/Shift}');
		const resized = panel().getBoundingClientRect();
		await expect(resized.width).toBeGreaterThan(moved.width);
		await expect(resized.height).toBeGreaterThan(moved.height);
		await expect(resized.left).toBe(moved.left);
	}
};

/** Pointer drag on the grip moves the floating pane. */
export const DragHandlePointer: Story = {
	name: 'Drag handle: pointer drag moves the pane (play)',
	args: { counterpartName: SUPERVISOR_NAME, viewerRole: 'consultant' },
	render: () => <FloatingHarness />,
	play: async ({ canvasElement }) => {
		const panel = () =>
			canvasElement.querySelector(
				'[data-cy="supervision-panel"]'
			) as HTMLElement;
		const grip = canvasElement.querySelector(
			'[data-cy="supervision-panel-drag-handle"]'
		) as HTMLElement;
		const before = panel().getBoundingClientRect();
		const rect = grip.getBoundingClientRect();
		const startX = rect.left + rect.width / 2;
		const startY = rect.top + rect.height / 2;
		const fire = (type: string, x: number, y: number) =>
			grip.dispatchEvent(
				new PointerEvent(type, {
					bubbles: true,
					pointerId: 1,
					button: 0,
					clientX: x,
					clientY: y
				})
			);
		fire('pointerdown', startX, startY);
		fire('pointermove', startX + 60, startY + 30);
		fire('pointermove', startX + 120, startY + 50);
		fire('pointerup', startX + 120, startY + 50);
		await tick();
		const after = panel().getBoundingClientRect();
		await expect(after.left - before.left).toBeCloseTo(120, 0);
		await expect(after.top - before.top).toBeCloseTo(50, 0);
	}
};

export const DarkScheme: Story = {
	name: 'Dark scheme (Storybook scheme global)',
	args: { counterpartName: SUPERVISOR_NAME, viewerRole: 'consultant' },
	globals: { scheme: 'dark' },
	render: () => <Docked viewerRole="consultant" unreadCount={1} />
};

export const Phone390: Story = {
	name: 'Phone 390 — full-screen side room',
	args: { counterpartName: SUPERVISOR_NAME, viewerRole: 'consultant' },
	globals: { viewport: { value: 'phone390' } },
	parameters: { layout: 'fullscreen' },
	render: () => (
		<div style={{ width: '100vw', height: '100vh' }}>
			<SupervisionPanel
				counterpartName={SUPERVISOR_NAME}
				viewerRole="consultant"
				onClose={noop}
				onCollapse={noop}
				renderComposer={() => (
					<FixtureComposer counterpartName={SUPERVISOR_NAME} />
				)}
			>
				<FixtureBubbles
					messages={sideRoomMessages()}
					viewerName={CONSULTANT_NAME}
				/>
			</SupervisionPanel>
		</div>
	)
};
