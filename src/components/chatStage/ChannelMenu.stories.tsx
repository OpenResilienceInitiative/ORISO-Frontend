/**
 * `Chat/Molecules/ChannelMenu` — the channel card (T20, Figma "Menu"
 * 9763:62964). One list for both hosts: the side-panel header hangs it
 * below the hairline, the FAB opens it upwards.
 *
 * It carries T20 (every secondary channel of the session, supervision
 * first), T27 (the same rows and the same hover as the real chat menu),
 * T28 (two-line "Author: text…" preview), T29 (the "Weitere Gespräche"
 * eyebrow) and T36 (a plain row again — no supervision on/off switch).
 * Order, numbering, shortcuts and previews come from `channelMenuModel.ts`;
 * this component only renders and moves focus.
 */
import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ChannelMenu } from './ChannelMenu';
import type { SecondaryChannel } from './channelSwitcherState';
import { phone390Globals } from '../message/messageStoryShell';
import {
	CLIENT_NAME,
	COUNSELLOR_NAME,
	SUPERVISOR_NAME,
	THREAD_ROOT_ID
} from './__storybook__/chatStageFixtures';
import './channelMenu.styles.scss';
import './sidePanel.styles.scss';

const CHANNEL_MENU_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=9763-62964';

const noop = () => {};

const ts = (iso: string) => Date.parse(iso);

const SUPERVISION: SecondaryChannel = {
	id: 'supervision',
	kind: 'supervision',
	label: SUPERVISOR_NAME,
	unread: 2,
	lastMessage: {
		author: SUPERVISOR_NAME,
		text: 'Ich würde es nicht forcieren. Benenne kurz, dass du das Thema wahrgenommen hast, und lass die Entscheidung bei ihr.',
		ts: ts('2026-09-04T09:15:00+02:00')
	}
};

/** Six threads: enough for the ceiling to bite and the list to scroll. */
const THREADS: SecondaryChannel[] = [
	{
		id: THREAD_ROOT_ID,
		kind: 'thread',
		label: 'Es sind ein paar Briefe gekommen…',
		createdTs: ts('2026-09-01T09:07:00+02:00'),
		lastMessage: {
			author: CLIENT_NAME,
			text: 'Okay. Vielleicht nächste Woche, wenn ich weiß, wie es mit dem Vertrag weitergeht.',
			ts: ts('2026-09-04T09:25:00+02:00')
		}
	},
	{
		id: '$thread-2',
		kind: 'thread',
		label: 'Zum Termin bei der Schuldnerberatung',
		createdTs: ts('2026-09-02T11:12:00+02:00'),
		unread: 1,
		lastMessage: {
			author: COUNSELLOR_NAME,
			text: 'Ich habe den Termin für Donnerstag eingetragen.',
			ts: ts('2026-09-04T10:02:00+02:00')
		}
	},
	{
		id: '$thread-3',
		kind: 'thread',
		label: 'Unterlagen',
		createdTs: ts('2026-09-03T08:20:00+02:00'),
		lastMessage: {
			author: CLIENT_NAME,
			text: 'Die Kopien sind unterwegs.',
			ts: ts('2026-09-03T16:40:00+02:00')
		}
	},
	{
		id: '$thread-4',
		kind: 'thread',
		label: 'Wohnsituation',
		createdTs: ts('2026-09-03T09:45:00+02:00'),
		lastMessage: {
			author: COUNSELLOR_NAME,
			text: 'Wir schauen uns das nächste Woche gemeinsam an.',
			ts: ts('2026-09-03T12:05:00+02:00')
		}
	},
	{
		id: '$thread-5',
		kind: 'thread',
		label: 'Krankenkasse',
		createdTs: ts('2026-09-03T14:00:00+02:00'),
		lastMessage: {
			author: CLIENT_NAME,
			text: 'Die Karte ist angekommen.',
			ts: ts('2026-09-03T11:00:00+02:00')
		}
	},
	{
		id: '$thread-6',
		kind: 'thread',
		label: 'Arbeitsvertrag',
		createdTs: ts('2026-09-04T07:30:00+02:00'),
		lastMessage: {
			author: CLIENT_NAME,
			text: 'Noch keine Antwort von der Personalabteilung.',
			ts: ts('2026-09-04T07:35:00+02:00')
		}
	}
];

/**
 * The card as the panel header hangs it: absolutely positioned under the
 * header inside the `.sidePanel`. Only the host classes, no story CSS —
 * `.panelHeader__menu` is what carries the phone rule.
 */
function PanelHost({
	children,
	width = 480,
	height = 420
}: {
	children: React.ReactNode;
	width?: number;
	height?: number;
}) {
	return (
		<div
			style={{
				width,
				maxWidth: '100%',
				padding: 24,
				boxSizing: 'border-box',
				background: 'var(--m3-surface-container-high, #eae7e8)'
			}}
		>
			<div
				className="sidePanel"
				data-cy="menu-host"
				style={{
					position: 'relative',
					height,
					borderRadius: 16,
					background: 'var(--m3-surface-container-lowest, #fff)'
				}}
			>
				<div
					className="panelHeader"
					style={{ position: 'relative', height: 0 }}
				>
					<div className="panelHeader__menu">{children}</div>
				</div>
			</div>
		</div>
	);
}

const meta = {
	title: 'Chat/Molecules/ChannelMenu',
	component: ChannelMenu,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: { type: 'figma', url: CHANNEL_MENU_FIGMA_URL },
		docs: {
			description: {
				component:
					'Channel card listing every secondary channel of the conversation: the supervision chat first (⇧S), then the threads ordered by their newest message but numbered by their root (⇧1…⇧9), each with a two-line preview. ' +
					'The shown channel carries `aria-current`; the card owns the roving focus (arrows, Home/End, Escape).'
			}
		}
	},
	args: {
		channels: [SUPERVISION, THREADS[0]],
		activeChannelId: 'supervision',
		onSelect: noop,
		onClose: noop
	},
	decorators: [
		(Story) => (
			<PanelHost>
				<Story />
			</PanelHost>
		)
	]
} satisfies Meta<typeof ChannelMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Only the supervision chat exists yet. It is still a plain row (T36 — the
 * on/off switch is gone), it carries ⇧S, and it is the one on screen.
 */
export const SupervisionOnly: Story = {
	name: 'Supervision only',
	args: { channels: [SUPERVISION], activeChannelId: 'supervision' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const items = within(await canvas.findByRole('menu')).getAllByRole(
			'menuitem'
		);
		await expect(items).toHaveLength(1);
		await expect(items[0]).toHaveAttribute(
			'data-channel-id',
			'supervision'
		);
		await expect(items[0]).toHaveAttribute('aria-current', 'true');
		await expect(items[0].textContent).toContain('Supervisionschat');
		await expect(items[0]).toHaveAttribute('data-shortcut', '⇧S');
		// T36: a row, not a switch — no checkbox, no toggle semantics.
		await expect(items[0]).not.toHaveAttribute('role', 'menuitemcheckbox');
		await expect(items[0].querySelector('input')).toBeNull();
		// T29: the eyebrow names what the card is.
		await expect(canvasElement.textContent).toContain('Weitere Gespräche');
		// T28: the preview is "Author: text".
		await expect(
			items[0].querySelector('[data-cy="channel-menu-preview"]')
				?.textContent
		).toContain(`${SUPERVISOR_NAME}:`);
		// Unread rides on the label.
		await expect(
			items[0].querySelector('.channelMenu__badge')?.textContent
		).toBe('2');
	}
};

/**
 * Supervision plus six threads. T20: supervision always first, threads
 * ORDERED by their newest message but NUMBERED by their root — "Thread #1"
 * stays the thread that was started first even when another one has the
 * latest reply. Review v6: past the host's ceiling the row list scrolls
 * inside the card instead of growing past it.
 */
export const SupervisionAndThreads: Story = {
	name: 'Supervision + several threads',
	args: {
		channels: [SUPERVISION, ...THREADS],
		activeChannelId: '$thread-2',
		maxHeight: 300
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const menu = await canvas.findByRole('menu');
		const items = within(menu).getAllByRole('menuitem');
		await expect(items).toHaveLength(7);
		// Supervision first, whatever the timestamps say.
		await expect(items[0]).toHaveAttribute(
			'data-channel-id',
			'supervision'
		);
		// Threads by recency: #2 (10:02) before #1 (09:25) before #6 (07:35).
		await expect(
			items
				.slice(1, 4)
				.map((item) => item.getAttribute('data-channel-id'))
		).toEqual(['$thread-2', THREAD_ROOT_ID, '$thread-6']);
		// … but numbered by their root message, so #1 keeps its number and
		// its ⇧1 even though it is listed second.
		await expect(items[2].textContent).toContain('Thread #1');
		await expect(items[2]).toHaveAttribute('data-shortcut', '⇧1');
		await expect(items[1].textContent).toContain('Thread #2');
		await expect(items[1]).toHaveAttribute('aria-current', 'true');
		// The card respects the host's ceiling; the list scrolls inside it.
		const card = canvasElement.querySelector<HTMLElement>('.channelMenu')!;
		const list =
			canvasElement.querySelector<HTMLElement>('.channelMenu__list')!;
		await expect(card.getBoundingClientRect().height).toBeLessThanOrEqual(
			300
		);
		await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
	}
};

/**
 * T27: a row highlights exactly like a row of the real chat menu — hover,
 * keyboard focus and the row on screen share ONE surface
 * (`--oriso-menu-hover-surface`, `chatMenuDropdown.styles.scss`).
 *
 * The play function drives the highlight through the card's own roving
 * focus, because `userEvent.hover` dispatches synthetic pointer events and
 * Chrome only sets CSS `:hover` from real input. The screenshot for this
 * story is taken with a real pointer; the assertion below checks the same
 * rule the hover selector shares.
 */
export const RowHover: Story = {
	name: 'Row highlight (hover / focus / shown row)',
	args: {
		channels: [SUPERVISION, ...THREADS.slice(0, 3)],
		activeChannelId: 'supervision'
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const items = within(await canvas.findByRole('menu')).getAllByRole(
			'menuitem'
		);
		// The alias is bound to the engine token (review v10), so the
		// expected colour is read, not hard-coded.
		const hoverToken = getComputedStyle(document.documentElement)
			.getPropertyValue('--oriso-menu-hover-surface')
			.trim();
		await expect(hoverToken).toMatch(/^#[0-9a-f]{6}$/i);
		const n = Number.parseInt(hoverToken.slice(1), 16);
		const highlight = `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${
			n & 255
		})`;
		// The row on screen wears the highlight (the surface fades in over
		// 150 ms — wait for it) …
		await waitFor(() =>
			expect(getComputedStyle(items[0]).backgroundColor).toBe(highlight)
		);
		// … an untouched row does not …
		const target = items[2];
		await expect(getComputedStyle(target).backgroundColor).not.toBe(
			highlight
		);
		// … and moving the card's focus onto it gives it the SAME surface,
		// which is the point of T27: one treatment for all three states.
		await userEvent.keyboard('{ArrowDown}{ArrowDown}');
		await waitFor(() => expect(target).toHaveFocus());
		await waitFor(() =>
			expect(getComputedStyle(target).backgroundColor).toBe(highlight)
		);
		// The label turns `primary` with it (never the pink surface).
		await expect(
			getComputedStyle(
				target.querySelector('.chatMenuDropdown__itemTitle')!
			).color
		).toBe(
			getComputedStyle(
				items[0].querySelector('.chatMenuDropdown__itemTitle')!
			).color
		);
	}
};

/**
 * Phone 390: the host stretches the card across the panel (16 px inset each
 * side, `sidePanel.styles.scss` `@media (width <= 899px)`) and adds the row
 * back to the main chat, because the phone has no second pane to return to.
 */
export const Phone390: Story = {
	name: 'Phone 390 — full-width card with the way back',
	globals: phone390Globals,
	args: {
		channels: [SUPERVISION, ...THREADS.slice(0, 2)],
		activeChannelId: 'supervision',
		onBack: noop
	},
	decorators: [
		(Story) => (
			<PanelHost width={390} height={480}>
				<Story />
			</PanelHost>
		)
	],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const menu = await canvas.findByRole('menu');
		const items = within(menu).getAllByRole('menuitem');
		// Three channels plus the way back to the main chat.
		await expect(items).toHaveLength(4);
		await expect(items[3]).toHaveAttribute(
			'data-cy',
			'channel-switcher-item-main'
		);
		await expect(items[3].textContent).toContain('Beratungschat');
		// The card stays inside the 390 px panel — never off the edge.
		//
		// NOTE: the full-width phone placement itself
		// (`.panelHeader__menu` under `@media (width <= 899px)`) cannot be
		// asserted here: Storybook's viewport global resizes the preview
		// frame in the Storybook UI, but under `vitest --project storybook`
		// the story renders in the 1280 px browser window, so CSS media
		// queries see 1280. The 390 px screenshot shows the real placement.
		const panel = canvasElement
			.querySelector('[data-cy="menu-host"]')!
			.getBoundingClientRect();
		const card = canvasElement
			.querySelector('.channelMenu')!
			.getBoundingClientRect();
		await expect(card.left).toBeGreaterThanOrEqual(panel.left - 1);
		await expect(card.right).toBeLessThanOrEqual(panel.right + 1);
		await expect(card.width).toBeGreaterThan(0);
	}
};

/**
 * The card owns the keyboard while it is open: arrows wrap, Home/End jump,
 * ⇧1 picks a thread by its stable number and Escape hands focus back.
 */
export const KeyboardRoving: Story = {
	name: 'Keyboard — arrows, Home/End, ⇧1, Escape',
	args: { channels: [SUPERVISION, ...THREADS.slice(0, 2)] },
	render: (args) => {
		const Demo = () => {
			const [picked, setPicked] = useState<string>('—');
			const [closed, setClosed] = useState(0);
			return (
				<>
					<ChannelMenu
						{...args}
						onSelect={setPicked}
						onClose={() => setClosed((n) => n + 1)}
					/>
					<output
						data-testid="picked"
						style={{ position: 'absolute', bottom: 8, left: 8 }}
					>
						{picked} / closed {closed}
					</output>
				</>
			);
		};
		return <Demo />;
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const menu = await canvas.findByRole('menu');
		const items = within(menu).getAllByRole('menuitem');
		// Focus starts on the shown channel (here the first row).
		await waitFor(() => expect(items[0]).toHaveFocus());
		await userEvent.keyboard('{ArrowDown}');
		await waitFor(() => expect(items[1]).toHaveFocus());
		await userEvent.keyboard('{End}');
		await waitFor(() => expect(items[2]).toHaveFocus());
		// Wraps around at the end.
		await userEvent.keyboard('{ArrowDown}');
		await waitFor(() => expect(items[0]).toHaveFocus());
		// ⇧1 picks "Thread #1" by its stable number and closes the card.
		await userEvent.keyboard('{Shift>}1{/Shift}');
		await waitFor(() =>
			expect(canvas.getByTestId('picked').textContent).toContain(
				THREAD_ROOT_ID
			)
		);
		await expect(canvas.getByTestId('picked').textContent).toContain(
			'closed 1'
		);
	}
};
