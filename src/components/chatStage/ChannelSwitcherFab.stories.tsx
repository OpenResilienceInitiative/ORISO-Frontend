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

const at = (hhmm: string) => new Date(`2026-09-05T${hhmm}:00+02:00`).getTime();

export const SUPERVISION_CHANNEL: SecondaryChannel = {
	id: 'supervision',
	kind: 'supervision',
	label: 'Bettina B.',
	lastMessage: {
		author: 'Elena P.',
		text: 'ich kann nicht sagen das dies bisher passiert ist das wir',
		ts: at('09:20')
	}
};
export const THREAD_1: SecondaryChannel = {
	id: '$thread-1',
	kind: 'thread',
	label: 'Thread #1',
	createdTs: at('09:00'),
	lastMessage: {
		author: 'baer-mika-343',
		text: 'wissen sie das fällt mir tatsächlich sehr schwer',
		ts: at('09:25')
	}
};
export const THREAD_2: SecondaryChannel = {
	id: '$thread-2',
	kind: 'thread',
	label: 'Thread #2',
	createdTs: at('09:05'),
	lastMessage: {
		author: 'Susanne P.',
		text: 'das ist ein sehr gutes Argument das sie hier einbringen',
		ts: at('09:12')
	}
};

/** Review v6: six threads — more rows than the card shows at once. */
export const SIX_THREADS: SecondaryChannel[] = Array.from(
	{ length: 6 },
	(_, index) => ({
		id: `$thread-${index + 1}`,
		kind: 'thread' as const,
		label: `Thread #${index + 1}`,
		createdTs: at(`09:0${index}`),
		unread: index === 3 ? 1 : 0,
		lastMessage: {
			author: index % 2 ? 'Susanne P.' : 'baer-mika-343',
			text: `Antwort im Thread ${index + 1}: das nehme ich mit in die nächste Sitzung.`,
			ts: at(`10:${String(10 + ((index * 7) % 50)).padStart(2, '0')}`)
		}
	})
);

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
	excludeStories: /^(SUPERVISION_CHANNEL|THREAD_1|THREAD_2|SIX_THREADS)$/,
	parameters: {
		layout: 'padded',
		design: { type: 'figma', url: FAB_MENU_FIGMA_URL },
		docs: {
			description: {
				component:
					'Switcher for the secondary channels of a conversation (supervision side room, open threads). ' +
					'Grey = all read, unread role = new message, one channel = direct FAB, several = the channel card (Figma 9748:60084 button, 9763:62964 card).'
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
	name: 'Menu — two threads + supervision (channel card)',
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

		// Open: the channel card (T20) — supervision first, then the threads
		// by their latest message (thread-1 at 09:25 before thread-2 at 09:12).
		await userEvent.click(fab);
		const menu = await canvas.findByRole('menu');
		const items = within(menu).getAllByRole('menuitem');
		await expect(
			canvasElement.querySelector('.channelMenu .chatMenuDropdown__title')
				?.textContent
		).toBe('Threads und Supervision');
		await expect(items).toHaveLength(3);
		await expect(items[0]).toHaveAttribute(
			'data-channel-id',
			'supervision'
		);
		await expect(items[0].textContent).toContain('⇧S');
		await expect(items[1]).toHaveAttribute('data-channel-id', '$thread-1');
		await expect(items[1].textContent).toContain('Thread #1');
		await expect(items[2]).toHaveAttribute('data-channel-id', '$thread-2');
		await expect(items[2].textContent).toContain('Thread #2');
		await expect(items[1].textContent).toContain('2');
		await expect(fab).toHaveAttribute('aria-expanded', 'true');

		// Pick: selects and closes.
		await userEvent.click(items[0]);
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
		// Review v6: the card lists EVERY channel — the shown thread too,
		// marked current — so "Thread #1" means the same in both cards.
		await expect(items).toHaveLength(3);
		await expect(items[0]).toHaveAttribute(
			'data-channel-id',
			'supervision'
		);
		await expect(items[0]).not.toHaveAttribute('aria-current');
		await expect(items[1]).toHaveAttribute('data-channel-id', '$thread-1');
		await expect(items[1]).toHaveAttribute('aria-current', 'true');
		await expect(items[1].textContent).toContain('Thread #1');
		await expect(items[2]).toHaveAttribute(
			'data-cy',
			'channel-switcher-item-main'
		);
		// Picking the shown thread only closes the card.
		await userEvent.click(items[1]);
		await waitFor(() => expect(canvas.queryByRole('menu')).toBeNull());
		await expect(
			canvasElement.querySelector('[data-cy="switcher-last-action"]')
				?.textContent
		).toContain('Noch nichts');
	}
};

/** The card's rectangle, the FAB's and the shell's — all in viewport px. */
const menuGeometry = (canvasElement: HTMLElement) => ({
	card: canvasElement
		.querySelector<HTMLElement>('.channelMenu')!
		.getBoundingClientRect(),
	list: canvasElement.querySelector<HTMLElement>('.channelMenu__list')!,
	fab: canvasElement
		.querySelector<HTMLElement>('[data-cy="channel-switcher-fab"]')!
		.getBoundingClientRect(),
	shell: canvasElement
		.querySelector<HTMLElement>('[data-cy="channel-switcher"]')!
		.offsetParent!.getBoundingClientRect(),
	root: canvasElement.querySelector<HTMLElement>(
		'[data-cy="channel-switcher"]'
	)!
});

/**
 * Review v6: with six threads the card would be taller than the room
 * above the FAB — it clamps to that room (never past 5½ rows) and the
 * row list scrolls inside; the FAB stays where it is.
 */
export const MenuSixThreadsClampsAndScrolls: Story = {
	name: 'Menu — six threads: card clamps above the FAB, list scrolls (review v6)',
	args: {
		channels: [SUPERVISION_CHANNEL, ...SIX_THREADS],
		onSelect: () => {},
		defaultOpen: true
	},
	render: (args) => <Playground {...args} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const menu = await canvas.findByRole('menu');
		await expect(within(menu).getAllByRole('menuitem')).toHaveLength(7);
		await waitFor(() => {
			const { card, list, fab, shell, root } =
				menuGeometry(canvasElement);
			expect(root.getAttribute('data-menu-side')).toBe('up');
			expect(card.bottom).toBeLessThanOrEqual(fab.top);
			expect(card.top).toBeGreaterThanOrEqual(shell.top);
			expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
		});
		// End scrolls the last row into view inside the card.
		await userEvent.keyboard('{End}');
		await waitFor(() => {
			const { list } = menuGeometry(canvasElement);
			const items = within(menu).getAllByRole('menuitem');
			const last = items[items.length - 1].getBoundingClientRect();
			const box = list.getBoundingClientRect();
			expect(document.activeElement).toBe(items[items.length - 1]);
			expect(last.bottom).toBeLessThanOrEqual(box.bottom + 1);
		});
	}
};

/**
 * Review v6: no room above the FAB (it sits near the top of its card, e.g.
 * a very short chat card) — the card flips BELOW the FAB and still fits.
 */
export const MenuFlipsBelowTheFab: Story = {
	name: 'Menu — flips below the FAB when there is no room above (review v6)',
	args: {
		channels: [SUPERVISION_CHANNEL, THREAD_1, THREAD_2],
		onSelect: () => {},
		defaultOpen: true,
		bottomOffset: 280
	},
	render: (args) => <Playground {...args} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await canvas.findByRole('menu');
		await waitFor(() => {
			const { card, fab, shell, root } = menuGeometry(canvasElement);
			expect(root.getAttribute('data-menu-side')).toBe('down');
			expect(card.top).toBeGreaterThanOrEqual(fab.bottom);
			expect(card.bottom).toBeLessThanOrEqual(shell.bottom + 1);
		});
	}
};
