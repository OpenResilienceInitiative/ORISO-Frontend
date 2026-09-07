/**
 * `Chat/Molecules/PanelHeader` — "the header we rebuilt" (Frank, 07.09.).
 *
 * It carries nine of the approved decisions of 04.–06.09.: T1 (the room's
 * own avatar stack), T3 (same paddings as the session header, so both
 * hairlines end on the same y), T4/T14 (40 px avatars, 28 px step), T19
 * (chevron marks the channel word as a menu button), T26 (the word sits
 * under the hairline where the main chat shows its topic tag), T41 (the
 * supervision header is tinted, a thread header is not), T43 (no 4 px void
 * above the row) and T48 (the tint stops AT the hairline).
 *
 * Until now the only way to see it was to open `SidePanel` or the
 * 910-line stage. These stories are the isolated view.
 */
import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { PanelHeader } from './PanelHeader';
import type { SecondaryChannel } from './channelSwitcherState';
import type { StackParticipant } from '../message/participantStack';
import { STACK_MAX_VISIBLE } from '../message/participantStack';
import { phone390Globals } from '../message/messageStoryShell';
import {
	CLIENT_MATRIX_ID,
	CLIENT_NAME,
	COUNSELLOR_MATRIX_ID,
	COUNSELLOR_NAME,
	SUPERVISOR_MATRIX_ID,
	SUPERVISOR_NAME,
	THREAD_ROOT_ID
} from './__storybook__/chatStageFixtures';
import './sidePanel.styles.scss';

const ROOM_HEADER_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1320-38281';

const noop = () => {};

/**
 * T48: the tint is painted as a background image exactly
 * `card inset (16) + row top gap (2) + row (40) + row bottom gap (6)` tall —
 * the same 64 px at which the hairline sits. Kept here as the number the
 * stories check against `sidePanel.styles.scss`.
 */
const TINT_HEIGHT = 64;

const clientParticipant: StackParticipant = {
	userId: CLIENT_MATRIX_ID,
	username: 'sonnenblume_47',
	displayName: CLIENT_NAME,
	isAsker: true
};
const counsellorParticipant: StackParticipant = {
	userId: COUNSELLOR_MATRIX_ID,
	username: 'mona.s@oriso.invalid',
	displayName: COUNSELLOR_NAME,
	firstName: 'Mona',
	lastName: 'Sommer'
};
const supervisorParticipant: StackParticipant = {
	userId: SUPERVISOR_MATRIX_ID,
	username: 'bettina.b@oriso.invalid',
	displayName: SUPERVISOR_NAME,
	firstName: 'Bettina',
	lastName: 'Berg'
};
/** A team supervision: enough people to reach the "+N" fold. */
const extraSupervisors: StackParticipant[] = [
	{
		userId: '@jonas.k:oriso.invalid',
		username: 'jonas.k@oriso.invalid',
		displayName: 'Jonas K.',
		firstName: 'Jonas',
		lastName: 'Kern'
	},
	{
		userId: '@aylin.t:oriso.invalid',
		username: 'aylin.t@oriso.invalid',
		displayName: 'Aylin T.',
		firstName: 'Aylin',
		lastName: 'Tan'
	},
	{
		userId: '@rita.m:oriso.invalid',
		username: 'rita.m@oriso.invalid',
		displayName: 'Rita M.',
		firstName: 'Rita',
		lastName: 'Mai'
	}
];

const SUPERVISION_CHANNEL: SecondaryChannel = {
	id: 'supervision',
	kind: 'supervision',
	label: SUPERVISOR_NAME,
	unread: 1,
	lastMessage: {
		author: COUNSELLOR_NAME,
		text: 'Danke, das hilft. Ich melde mich nach dem nächsten Kontakt.',
		ts: Date.parse('2026-09-04T09:20:00+02:00')
	}
};
const THREAD_CHANNEL: SecondaryChannel = {
	id: THREAD_ROOT_ID,
	kind: 'thread',
	label: 'Es sind ein paar Briefe gekommen…',
	createdTs: Date.parse('2026-09-04T09:07:00+02:00'),
	lastMessage: {
		author: CLIENT_NAME,
		text: 'Okay. Vielleicht nächste Woche, wenn ich weiß, wie es weitergeht.',
		ts: Date.parse('2026-09-04T09:25:00+02:00')
	}
};

/**
 * The header always lives at the top of a side room. `.sidePanel` is what
 * `useChannelMenuPlacement` measures the channel card against, so the host
 * carries the class the app puts there — nothing else.
 */
function Host({
	children,
	width = 480
}: {
	children: React.ReactNode;
	width?: number;
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
				style={{
					height: 260,
					borderRadius: 16,
					overflow: 'hidden',
					background: 'var(--m3-surface-container-lowest, #fff)'
				}}
			>
				{children}
			</div>
		</div>
	);
}

const meta = {
	title: 'Chat/Molecules/PanelHeader',
	component: PanelHeader,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: { type: 'figma', url: ROOM_HEADER_FIGMA_URL },
		docs: {
			description: {
				component:
					'Header of a side room: participant stack · counterpart name · unread pill · actions, then the `primary-fixed` hairline and, under it, the channel word that IS the menu button (T19/T26). ' +
					'Supervision wears the pink tint down to the hairline (T41/T48); a thread stays neutral.'
			}
		}
	},
	args: {
		kind: 'supervision',
		title: 'Supervision',
		name: SUPERVISOR_NAME,
		participants: [counsellorParticipant, supervisorParticipant],
		channels: [SUPERVISION_CHANNEL, THREAD_CHANNEL],
		activeChannelId: SUPERVISION_CHANNEL.id,
		onSelectChannel: noop,
		onClose: noop
	},
	decorators: [
		(Story) => (
			<Host>
				<Story />
			</Host>
		)
	]
} satisfies Meta<typeof PanelHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

const headerOf = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>('.panelHeader')!;
const dividerOf = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>('.panelHeader__divider')!;

/** The tint must reach the hairline and stop there — never past it (T48). */
const expectTintEndsAtTheHairline = async (canvasElement: HTMLElement) => {
	const header = headerOf(canvasElement);
	const style = getComputedStyle(header);
	await expect(style.backgroundImage).toContain('gradient');
	// Painted height …
	const painted = Number.parseFloat(style.backgroundSize.split(' ')[1]);
	await expect(painted).toBe(TINT_HEIGHT);
	// … equals the distance from the header's top to the hairline.
	const hairline =
		dividerOf(canvasElement).getBoundingClientRect().top -
		header.getBoundingClientRect().top;
	await expect(Math.round(hairline)).toBe(TINT_HEIGHT);
};

/**
 * T41/T48: supervision is unmistakable — the name row takes a hint of
 * `primary-fixed`, the hairline and the channel tag the stronger
 * `primary-fixed-dim`, and the tint stops exactly at the hairline.
 */
export const Supervision: Story = {
	name: 'Supervision — tinted down to the hairline (T41/T48)',
	play: async ({ canvasElement }) => {
		const header = headerOf(canvasElement);
		await expect(header).toHaveAttribute('data-kind', 'supervision');
		await expectTintEndsAtTheHairline(canvasElement);
		// The hairline and the channel tag take the stronger tone.
		const dim = getComputedStyle(document.documentElement)
			.getPropertyValue('--m3-primary-fixed-dim')
			.trim();
		await expect(dim).not.toBe('');
		const divider = getComputedStyle(dividerOf(canvasElement));
		const tag = getComputedStyle(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="panel-header-channel-options"]'
			)!
		);
		await expect(divider.borderTopColor).toBe(tag.backgroundColor);
		await expect(divider.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
		// T26: the counterpart name is the title ABOVE the hairline, the
		// channel word sits BELOW it.
		const hairlineTop =
			dividerOf(canvasElement).getBoundingClientRect().top;
		await expect(
			canvasElement
				.querySelector('[data-cy="panel-header-name"]')!
				.getBoundingClientRect().bottom
		).toBeLessThanOrEqual(hairlineTop + 1);
		await expect(
			canvasElement
				.querySelector('[data-cy="panel-header-kind-label"]')!
				.getBoundingClientRect().top
		).toBeGreaterThanOrEqual(hairlineTop);
	}
};

/** A thread header stays neutral — no tint at all (T41). */
export const Thread: Story = {
	name: 'Thread — no tint',
	args: {
		kind: 'thread',
		title: 'Thread',
		name: CLIENT_NAME,
		participants: [clientParticipant, counsellorParticipant],
		activeChannelId: THREAD_ROOT_ID,
		unreadCount: 0
	},
	play: async ({ canvasElement }) => {
		const header = headerOf(canvasElement);
		await expect(header).toHaveAttribute('data-kind', 'thread');
		await expect(getComputedStyle(header).backgroundImage).toBe('none');
		// T26: the shown thread is named with the card's stable number.
		await expect(
			canvasElement.querySelector('[data-cy="panel-header-kind-label"]')
				?.textContent
		).toBe('Thread #1');
		// Without unread there is no pill (house rule: nothing to show, nothing rendered).
		await expect(
			canvasElement.querySelector('[data-cy="panel-header-unread"]')
		).toBeNull();
	}
};

/** Unread in the side room: the pill next to the name, clamped at 99+. */
export const Unread: Story = {
	name: 'With the unread pill',
	args: { unreadCount: 3 },
	play: async ({ canvasElement }) => {
		const pill = canvasElement.querySelector<HTMLElement>(
			'[data-cy="panel-header-unread"]'
		)!;
		await expect(pill.textContent).toBe('3');
		// It sits in the name row, left of the actions — never under the hairline.
		const actions = canvasElement.querySelector<HTMLElement>(
			'.panelHeader__actions'
		)!;
		await expect(pill.getBoundingClientRect().right).toBeLessThanOrEqual(
			actions.getBoundingClientRect().left + 1
		);
		await expect(pill.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			dividerOf(canvasElement).getBoundingClientRect().top + 1
		);
	}
};

export const UnreadOverflow: Story = {
	name: 'Unread over ninety-nine',
	args: { unreadCount: 128 },
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector('[data-cy="panel-header-unread"]')
				?.textContent
		).toBe('99+');
	}
};

/**
 * A long counterpart name. The Figma title is `title/small 14/500/20` on ONE
 * line, so the name does not wrap — it is cut with an ellipsis and the row
 * keeps its 40 px height. Without that rule the close button would be pushed
 * out of the header.
 */
export const LongName: Story = {
	name: 'Long name — one line, ellipsis, actions stay put',
	args: {
		name: 'Absichtslose Schildkröte Andrea (Supervision Fachbereich Schulden)',
		unreadCount: 2
	},
	play: async ({ canvasElement }) => {
		const name = canvasElement.querySelector<HTMLElement>(
			'[data-cy="panel-header-name"]'
		)!;
		// One line, clipped: no wrap into a second row.
		await expect(Math.round(name.getBoundingClientRect().height)).toBe(20);
		await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
		const row =
			canvasElement.querySelector<HTMLElement>('.panelHeader__row')!;
		await expect(Math.round(row.getBoundingClientRect().height)).toBe(48);
		// The close button stays fully inside the header.
		const close = canvasElement.querySelector<HTMLElement>(
			'[data-cy="panel-header-close"]'
		)!;
		await expect(close.getBoundingClientRect().right).toBeLessThanOrEqual(
			headerOf(canvasElement).getBoundingClientRect().right + 1
		);
	}
};

/**
 * Phone 390, a team supervision with six people in the room.
 *
 * FINDING (07.09.): the panel header folds after **four** avatars, because
 * it never passes `maxVisible`. The session header switches to ONE avatar
 * plus "+N" on the phone (`STACK_MAX_VISIBLE_PHONE`,
 * `SessionHeaderComponent.tsx:1219`). This story pins today's behaviour so
 * the difference is visible; changing it is a product decision, not a story
 * fix.
 */
export const Phone390: Story = {
	name: 'Phone 390 — avatar stack folds into "+N"',
	globals: phone390Globals,
	args: {
		participants: [
			counsellorParticipant,
			supervisorParticipant,
			...extraSupervisors
		],
		unreadCount: 2,
		onBack: noop,
		onClose: undefined
	},
	decorators: [
		(Story) => (
			<Host width={390}>
				<Story />
			</Host>
		)
	],
	play: async ({ canvasElement }) => {
		const avatars = canvasElement.querySelectorAll(
			'[data-cy="panel-header-participants"] [data-cy="participant-avatar"]'
		);
		await expect(avatars).toHaveLength(STACK_MAX_VISIBLE);
		const overflow = canvasElement.querySelector<HTMLElement>(
			'[data-cy="panel-header-participants"] [data-cy="participant-overflow"]'
		)!;
		await expect(overflow.textContent).toBe('+1');
		// The stack, the name and the pill all stay inside the 390 px panel.
		const header = headerOf(canvasElement).getBoundingClientRect();
		for (const cy of [
			'panel-header-participants',
			'panel-header-name',
			'panel-header-unread'
		]) {
			const box = canvasElement
				.querySelector(`[data-cy="${cy}"]`)!
				.getBoundingClientRect();
			await expect(box.right).toBeLessThanOrEqual(header.right + 1);
		}
		// Phone: back instead of close.
		await expect(
			canvasElement.querySelector('[data-cy="panel-header-back"]')
		).not.toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="panel-header-close"]')
		).toBeNull();
	}
};

/** T19/T20: with another channel to go to, the word opens the channel card. */
export const MenuTriggerEnabled: Story = {
	name: 'Menu trigger — enabled, card opens below the hairline',
	render: (args) => {
		const Demo = () => {
			const [active, setActive] = useState<string>(
				SUPERVISION_CHANNEL.id
			);
			return (
				<PanelHeader
					{...args}
					kind={
						active === SUPERVISION_CHANNEL.id
							? 'supervision'
							: 'thread'
					}
					title={
						active === SUPERVISION_CHANNEL.id
							? 'Supervision'
							: 'Thread'
					}
					name={
						active === SUPERVISION_CHANNEL.id
							? SUPERVISOR_NAME
							: CLIENT_NAME
					}
					activeChannelId={active}
					onSelectChannel={setActive}
				/>
			);
		};
		return <Demo />;
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="panel-header-channel-options"]'
		)!;
		await expect(trigger).not.toBeDisabled();
		await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await userEvent.click(trigger);
		const menu = await canvas.findByRole('menu');
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');
		// T20: the card hangs BELOW the whole header, hairline included.
		await expect(
			canvasElement
				.querySelector('[data-cy="panel-header-channel-menu"]')!
				.getBoundingClientRect().top
		).toBeGreaterThanOrEqual(
			dividerOf(canvasElement).getBoundingClientRect().bottom - 1
		);
		const items = within(menu).getAllByRole('menuitem');
		await expect(items).toHaveLength(2);
		await expect(items[0]).toHaveAttribute('aria-current', 'true');
		// Picking the other channel switches the panel and closes the card.
		await userEvent.click(items[1]);
		await waitFor(() =>
			expect(canvasElement.querySelector('[role="menu"]')).toBeNull()
		);
		await waitFor(() =>
			expect(headerOf(canvasElement)).toHaveAttribute(
				'data-kind',
				'thread'
			)
		);
		await expect(
			canvasElement.querySelector('[data-cy="panel-header-kind-label"]')
				?.textContent
		).toBe('Thread #1');
	}
};

/**
 * Nothing else to switch to: the trigger is DISABLED, not hidden — the house
 * rule ("disable, never hide"). The chevron stays in place, dimmed.
 */
export const MenuTriggerDisabled: Story = {
	name: 'Menu trigger — disabled (no other channel)',
	args: { channels: [SUPERVISION_CHANNEL] },
	play: async ({ canvasElement }) => {
		const trigger = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="panel-header-channel-options"]'
		)!;
		await expect(trigger).toBeDisabled();
		// Still there, still labelled — just inert.
		await expect(trigger.getAttribute('aria-label')).toContain(
			'Keine weiteren Kanäle'
		);
		const chevron = canvasElement.querySelector<HTMLElement>(
			'[data-cy="panel-header-kind-chevron"]'
		)!;
		await expect(chevron).not.toBeNull();
		await expect(
			Number.parseFloat(getComputedStyle(chevron).opacity)
		).toBeLessThan(1);
		await userEvent.click(trigger, { pointerEventsCheck: 0 });
		await expect(canvasElement.querySelector('[role="menu"]')).toBeNull();
	}
};
