import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ChannelSwitcherFab } from './ChannelSwitcherFab';
import type { SecondaryChannel } from './channelSwitcherState';
import { phone390Globals } from '../message/messageStoryShell';
import './channelSwitcherFab.styles.scss';

const FAB_MENU_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=9748-60084';

export const SUPERVISION_CHANNEL: SecondaryChannel = {
	id: 'supervision',
	kind: 'supervision',
	label: 'Bettina B.'
};
export const THREAD_1: SecondaryChannel = {
	id: '$thread-1',
	kind: 'thread',
	label: 'Thread #1'
};
export const THREAD_2: SecondaryChannel = {
	id: '$thread-2',
	kind: 'thread',
	label: 'Thread #2'
};

/** A slice of chat card — the FAB is positioned against it. */
function Shell({
	children,
	width = 480,
	height = 360
}: {
	children: React.ReactNode;
	width?: number;
	height?: number;
}) {
	return (
		<div
			style={{
				position: 'relative',
				width,
				height,
				maxWidth: '100%',
				background: 'var(--m3-surface-container-lowest, #fff)',
				border: '1px solid var(--oriso-primary-fixed-dim, #ffb4aa)',
				borderRadius: 28,
				boxSizing: 'border-box'
			}}
		>
			{children}
		</div>
	);
}

function Playground(
	props: Partial<React.ComponentProps<typeof ChannelSwitcherFab>> & {
		channels: SecondaryChannel[];
	}
) {
	const [last, setLast] = useState<string>('');
	// Story args carry the required (no-op) handlers; the playground wraps
	// them so the picked channel becomes visible in the canvas.
	const { onSelect, onBack, ...rest } = props;
	return (
		<Shell>
			<p
				data-cy="switcher-last-action"
				style={{
					margin: 16,
					font: '14px/20px var(--m3-body-font-family, sans-serif)',
					color: 'var(--m3-on-surface-variant, #444748)'
				}}
			>
				{last ? `Zuletzt: ${last}` : 'Noch nichts ausgewählt'}
			</p>
			<ChannelSwitcherFab
				{...rest}
				onSelect={(id) => {
					setLast(id);
					onSelect?.(id);
				}}
				onBack={() => {
					setLast('main');
					onBack?.();
				}}
			/>
		</Shell>
	);
}

const meta = {
	title: 'Components/Chat/ChannelSwitcherFab',
	component: ChannelSwitcherFab,
	tags: ['autodocs'],
	excludeStories: /^(SUPERVISION_CHANNEL|THREAD_1|THREAD_2)$/,
	parameters: {
		layout: 'padded',
		design: { type: 'figma', url: FAB_MENU_FIGMA_URL },
		docs: {
			description: {
				component:
					'Switcher for the secondary channels of a conversation (supervision side room, open threads). ' +
					'Grey = all read, unread role = new message, one channel = direct FAB, several = speed dial (Figma 9748:60084).'
			}
		}
	}
} satisfies Meta<typeof ChannelSwitcherFab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSupervisionIdle: Story = {
	name: 'Single supervision — idle (grey)',
	args: { channels: [SUPERVISION_CHANNEL], onSelect: () => {} },
	render: (args) => <Playground {...args} />,
	play: async ({ canvasElement }) => {
		const fab = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="channel-switcher-fab"]'
		);
		await expect(fab).not.toBeNull();
		await expect(
			fab!.closest('[data-variant]')?.getAttribute('data-variant')
		).toBe('idle');
		await expect(fab).not.toHaveAttribute('aria-haspopup');
		await userEvent.click(fab!);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="switcher-last-action"]')
					?.textContent
			).toContain('supervision')
		);
	}
};

export const SingleSupervisionAttention: Story = {
	name: 'Single supervision — attention (new message)',
	args: {
		channels: [{ ...SUPERVISION_CHANNEL, unread: 3 }],
		onSelect: () => {}
	},
	render: (args) => <Playground {...args} />,
	play: async ({ canvasElement }) => {
		const root = canvasElement.querySelector(
			'[data-cy="channel-switcher"]'
		);
		await expect(root?.getAttribute('data-variant')).toBe('attention');
		await expect(
			root?.querySelector('.channelSwitcher__badge')?.textContent
		).toBe('3');
	}
};

export const SingleThread: Story = {
	name: 'Single thread',
	args: { channels: [{ ...THREAD_1, unread: 1 }], onSelect: () => {} },
	render: (args) => <Playground {...args} />,
	play: async ({ canvasElement }) => {
		const fab = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="channel-switcher-fab"]'
		);
		await expect(fab?.getAttribute('aria-label')).toMatch(/Thread/);
		await userEvent.click(fab!);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="switcher-last-action"]')
					?.textContent
			).toContain('$thread-1')
		);
	}
};

export const MenuTwoThreadsAndSupervision: Story = {
	name: 'Menu — two threads + supervision (speed dial)',
	args: {
		channels: [SUPERVISION_CHANNEL, THREAD_2, { ...THREAD_1, unread: 2 }],
		onSelect: () => {}
	},
	render: (args) => <Playground {...args} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const fab = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="channel-switcher-fab"]'
		)!;
		await expect(fab).toHaveAttribute('aria-haspopup', 'menu');
		await expect(fab).toHaveAttribute('aria-expanded', 'false');

		// Open: three segments, threads on top, supervision right above the FAB.
		await userEvent.click(fab);
		const menu = await canvas.findByRole('menu');
		const items = within(menu).getAllByRole('menuitem');
		await expect(items).toHaveLength(3);
		await expect(items[0]).toHaveAttribute('data-channel-id', '$thread-2');
		await expect(items[1]).toHaveAttribute('data-channel-id', '$thread-1');
		await expect(items[2]).toHaveAttribute(
			'data-channel-id',
			'supervision'
		);
		await expect(fab).toHaveAttribute('aria-expanded', 'true');

		// Pick: selects and closes.
		await userEvent.click(items[2]);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="switcher-last-action"]')
					?.textContent
			).toContain('supervision')
		);
		await expect(canvas.queryByRole('menu')).toBeNull();

		// Close with the X without picking.
		await userEvent.click(fab);
		await canvas.findByRole('menu');
		await userEvent.click(fab);
		await waitFor(() => expect(canvas.queryByRole('menu')).toBeNull());

		// Escape closes as well.
		await userEvent.click(fab);
		await canvas.findByRole('menu');
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(canvas.queryByRole('menu')).toBeNull());
	}
};

export const Phone390InsideSecondary: Story = {
	name: 'Phone 390 — inside the supervision chat (FAB = back switcher)',
	globals: phone390Globals,
	args: {
		channels: [SUPERVISION_CHANNEL],
		activeChannelId: 'supervision',
		onSelect: () => {}
	},
	render: (args) => <Playground {...args} />,
	play: async ({ canvasElement }) => {
		const fab = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="channel-switcher-fab"]'
		)!;
		await expect(fab.getAttribute('aria-label')).toMatch(
			/Beratungschat|counselling/i
		);
		await userEvent.click(fab);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="switcher-last-action"]')
					?.textContent
			).toContain('main')
		);
	}
};

export const Phone390InsideThreadWithMenu: Story = {
	name: 'Phone 390 — inside a thread, supervision + main chat in the menu',
	globals: phone390Globals,
	args: {
		channels: [{ ...SUPERVISION_CHANNEL, unread: 1 }, THREAD_1],
		activeChannelId: '$thread-1',
		onSelect: () => {}
	},
	render: (args) => <Playground {...args} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvasElement.querySelector<HTMLButtonElement>(
				'[data-cy="channel-switcher-fab"]'
			)!
		);
		const items = within(await canvas.findByRole('menu')).getAllByRole(
			'menuitem'
		);
		await expect(items).toHaveLength(2);
		await expect(items[0]).toHaveAttribute(
			'data-channel-id',
			'supervision'
		);
		await expect(items[1]).toHaveAttribute(
			'data-cy',
			'channel-switcher-item-main'
		);
	}
};
