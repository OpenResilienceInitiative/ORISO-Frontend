/**
 * Participant avatar stack — the room header's "Avatar Group" (Figma
 * 1320:38281) built from the chat's `MessageAvatar` atom. T1 / T4 of the
 * 05.09. work list: hover or focus shows the name, the tail folds into "+N".
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	ParticipantAvatarStack,
	STACK_AVATAR_SIZE,
	STACK_STEP,
	stackStepFor
} from './ParticipantAvatarStack';
import type { StackParticipant } from './participantStack';

const ROOM_HEADER_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1320-38281';

const client: StackParticipant = {
	userId: '@sonnenblume_47:oriso.invalid',
	username: 'sonnenblume_47',
	displayName: 'Sonnenblume_47',
	isAsker: true,
	lastActivity: 3
};
const counsellor: StackParticipant = {
	userId: '@mona.s:oriso.invalid',
	username: 'mona.s@oriso.invalid',
	displayName: 'Mona S.',
	firstName: 'Mona',
	lastName: 'Sommer',
	lastActivity: 2
};
const supervisor: StackParticipant = {
	userId: '@bettina.b:oriso.invalid',
	username: 'bettina.b@oriso.invalid',
	displayName: 'Bettina B.',
	firstName: 'Bettina',
	lastName: 'Berg',
	lastActivity: 1
};

const meta = {
	title: 'Components/Chat/ParticipantAvatarStack',
	component: ParticipantAvatarStack,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		design: { type: 'figma', url: ROOM_HEADER_FIGMA_URL }
	},
	decorators: [
		(Story) => (
			<div
				style={{
					padding: '16px 16px 48px',
					background: 'var(--m3-surface-container-lowest, #fff)'
				}}
			>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof ParticipantAvatarStack>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Client (animal) + counsellor + supervisor (monograms), latest first. */
export const ThreeParticipants: Story = {
	name: 'Three participants — hover shows the name',
	args: { participants: [supervisor, counsellor, client] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const avatars = canvasElement.querySelectorAll<HTMLElement>(
			'[data-cy="participant-avatar"]'
		);
		await expect(avatars).toHaveLength(3);
		// Latest activity first: the client wrote last.
		await expect(avatars[0].getAttribute('data-user-id')).toBe(
			client.userId
		);
		// T14/T17 — Figma 1320:38281 Avatar Group: 40 px avatars, 28 px step.
		const first = avatars[0].getBoundingClientRect();
		const second = avatars[1].getBoundingClientRect();
		await expect(Math.round(first.width)).toBe(STACK_AVATAR_SIZE);
		await expect(Math.round(first.height)).toBe(40);
		await expect(Math.round(second.left - first.left)).toBe(STACK_STEP);
		await expect(STACK_STEP).toBe(28);
		// Tooltip hidden until hover …
		const tip = canvas.getByText('Mona S.', {
			selector: '[data-cy="participant-tooltip"]'
		});
		await expect(tip).not.toBeVisible();
		await userEvent.hover(avatars[1]);
		await waitFor(() => expect(tip).toBeVisible());
		await userEvent.unhover(avatars[1]);
		await waitFor(() => expect(tip).not.toBeVisible());
		// … and on keyboard focus.
		avatars[2].focus();
		await waitFor(() =>
			expect(
				canvas.getByText('Bettina B.', {
					selector: '[data-cy="participant-tooltip"]'
				})
			).toBeVisible()
		);
		await userEvent.keyboard('{Escape}');
		await waitFor(() =>
			expect(
				canvas.getByText('Bettina B.', {
					selector: '[data-cy="participant-tooltip"]'
				})
			).not.toBeVisible()
		);
	}
};

/** Six people: four avatars and a "+2" chip (FE#1193 Job 2). */
export const OverflowPlusN: Story = {
	name: 'Six participants — "+2" fallback',
	args: {
		participants: [
			client,
			counsellor,
			supervisor,
			{ userId: '@kim:oriso.invalid', displayName: 'Kim G.' },
			{ userId: '@ali:oriso.invalid', displayName: 'Ali R.' },
			{ userId: '@jo:oriso.invalid', displayName: 'Jo L.' }
		]
	},
	play: async ({ canvasElement }) => {
		const avatars = canvasElement.querySelectorAll<HTMLElement>(
			'[data-cy="participant-avatar"]'
		);
		await expect(avatars).toHaveLength(4);
		const chip = canvasElement.querySelector<HTMLElement>(
			'[data-cy="participant-overflow"]'
		)!;
		await expect(chip.textContent).toBe('+2');
		// The chip must start beyond the last full avatar, so an overlapping
		// avatar never paints over the leading "+" (including phone density).
		const last = avatars[3].getBoundingClientRect();
		const chipRect = chip.getBoundingClientRect();
		const stack = canvasElement
			.querySelector('[data-cy="participant-stack"]')!
			.getBoundingClientRect();
		await expect(chipRect.left).toBeGreaterThanOrEqual(last.right - 0.5);
		await expect(chipRect.right).toBeLessThanOrEqual(stack.right + 0.5);
		await expect(getComputedStyle(chip).position).not.toBe('absolute');
	}
};

/**
 * Design options for the "+N" chip on the conversation card (maxVisible 2).
 * Local CSS only — nothing here changes the shared stack. Pick one and it
 * moves into `participantAvatarStack.styles.scss`.
 */
const OVERFLOW_VARIANT_CSS = `
.ovf { display:flex; align-items:center; gap:40px; padding:14px 0; }
.ovf__label { width:210px; font:600 13px/1.3 Inter,system-ui,sans-serif; color:#3b3b3b; }
.ovf__label small { display:block; font-weight:400; color:#6b6b6b; }
/* B: round chip, same size as the avatars — reads as one more avatar */
.ovf--round .participantStack__overflow { padding:0; min-width:var(--participant-size); border-radius:50%; font-size:15px; }
/* C: outlined — quiet, no second pink blob next to the avatars */
.ovf--outline .participantStack__overflow { padding:0; min-width:var(--participant-size); border-radius:50%;
  background:transparent; box-shadow:none; border:2px dashed var(--m3-primary-fixed-dim,#ffb4aa); font-size:15px; }
/* D: badge on the last avatar — takes no extra width */
.ovf--badge .participantStack { padding-right:0; }
.ovf--badge .participantStack__item--overflow { position:absolute; top:auto; left:auto; right:-8px; bottom:-6px; margin:0 !important; width:auto; height:auto; z-index:2 !important; }
.ovf--badge .participantStack__overflow { height:22px; min-width:22px; padding:0 6px; border-radius:11px; font-size:12px;
  background:var(--m3-primary-container,#cc1e1c); color:#fff; }
/* E: small satellite — half-size chip, vertically centred */
.ovf--small .participantStack__overflow { height:28px; min-width:28px; padding:0 7px; border-radius:14px; font-size:13px;
  background:#ece6e6; color:#3b3b3b; box-shadow:none; }
`;

export const OverflowChipVariants: Story = {
	name: '"+N" chip — design options for the card',
	render: () => {
		const many = [
			client,
			counsellor,
			supervisor,
			{ userId: '@kim:oriso.invalid', displayName: 'Kim G.' },
			{ userId: '@ali:oriso.invalid', displayName: 'Ali R.' },
			{ userId: '@jo:oriso.invalid', displayName: 'Jo L.' },
			{ userId: '@a:oriso.invalid', displayName: 'A B.' },
			{ userId: '@b:oriso.invalid', displayName: 'B C.' },
			{ userId: '@c:oriso.invalid', displayName: 'C D.' },
			{ userId: '@d:oriso.invalid', displayName: 'D E.' },
			{ userId: '@e:oriso.invalid', displayName: 'E F.' },
			{ userId: '@f:oriso.invalid', displayName: 'F G.' },
			{ userId: '@g:oriso.invalid', displayName: 'G H.' },
			{ userId: '@h:oriso.invalid', displayName: 'H I.' }
		];
		const rows: [string, string, string][] = [
			['ovf--now', 'A · Aktuell', 'rosa Pille, Text off-center'],
			['ovf--round', 'B · Runder Chip', 'wie ein vierter Avatar'],
			[
				'ovf--outline',
				'C · Gestrichelter Kreis',
				'leise, „da ist noch mehr“'
			],
			['ovf--badge', 'D · Badge am Avatar', 'braucht keine Breite'],
			[
				'ovf--small',
				'E · Kleiner grauer Chip',
				'tritt hinter die Avatare zurück'
			]
		];
		return (
			<div>
				<style>{OVERFLOW_VARIANT_CSS}</style>
				{rows.map(([cls, title, note]) => (
					<div key={cls} className={`ovf ${cls}`}>
						<div className="ovf__label">
							{title}
							<small>{note}</small>
						</div>
						<ParticipantAvatarStack
							participants={[client, counsellor, supervisor]}
							size={40}
							maxVisible={2}
						/>
						<ParticipantAvatarStack
							participants={many}
							size={40}
							maxVisible={2}
						/>
					</div>
				))}
			</div>
		);
	}
};

/**
 * Preserve the existing 32 px card geometry independently of the header.
 */
export const Size32: Story = {
	name: '32 px variant — same 12 px overlap',
	args: { participants: [client, counsellor], size: 32 },
	play: async ({ canvasElement }) => {
		const avatars = canvasElement.querySelectorAll<HTMLElement>(
			'[data-cy="participant-avatar"]'
		);
		const first = avatars[0].getBoundingClientRect();
		const second = avatars[1].getBoundingClientRect();
		await expect(Math.round(first.width)).toBe(32);
		await expect(Math.round(second.left - first.left)).toBe(
			stackStepFor(32)
		);
		await expect(stackStepFor(32)).toBe(20);
	}
};

/** Current Figma Avatar Group (7608:40689): 48px circles, 24px overlap. */
export const Header48: Story = {
	args: { ...ThreeParticipants.args, size: 48, overlap: 24 },
	play: async ({ canvasElement }) => {
		const avatars = canvasElement.querySelectorAll<HTMLElement>(
			'[data-cy="participant-avatar"]'
		);
		const first = avatars[0].getBoundingClientRect();
		const second = avatars[1].getBoundingClientRect();
		await expect(Math.round(first.width)).toBe(48);
		await expect(Math.round(first.right - second.left)).toBe(24);
		const secondItem = avatars[1].parentElement!;
		await userEvent.hover(avatars[1]);
		await waitFor(() =>
			expect(Number(getComputedStyle(secondItem).zIndex)).toBeGreaterThan(
				Number(getComputedStyle(avatars[0].parentElement!).zIndex)
			)
		);
		// The full face is painted above the preceding coin without shifting it.
		await expect(
			avatars[1].contains(
				document.elementFromPoint(second.left + 4, second.top + 24)
			)
		).toBe(true);
		await expect(avatars[1].getBoundingClientRect().left).toBe(second.left);
		await userEvent.unhover(avatars[1]);
		await waitFor(() =>
			expect(Number(getComputedStyle(secondItem).zIndex)).toBeLessThan(
				Number(getComputedStyle(avatars[0].parentElement!).zIndex)
			)
		);
	}
};

/** The card's 32px avatars and compact phone chip must not obscure "+25". */
export const Overflow32Phone: Story = {
	name: '32px phone overflow — complete +25 stays clear of avatars',
	globals: { viewport: { value: 'phone390' } },
	args: {
		participants: Array.from({ length: 27 }, (_, index) => ({
			userId: `@person-${index}:oriso.invalid`,
			displayName: `Person ${index + 1}`
		})),
		size: 32,
		maxVisible: 2
	},
	play: async ({ canvasElement }) => {
		const avatars = canvasElement.querySelectorAll(
			'[data-cy="participant-avatar"]'
		);
		const chip = canvasElement.querySelector(
			'[data-cy="participant-overflow"]'
		)!;
		await expect(chip).toHaveTextContent('+25');
		await expect(chip.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			avatars[avatars.length - 1].getBoundingClientRect().right - 0.5
		);
	}
};

export const Overflow40Phone: Story = {
	name: '40px phone overflow — complete +5 stays clear of avatars',
	globals: { viewport: { value: 'phone390' } },
	args: { ...OverflowPlusN.args, maxVisible: 1 },
	play: async ({ canvasElement }) => {
		const avatar = canvasElement.querySelector(
			'[data-cy="participant-avatar"]'
		)!;
		const chip = canvasElement.querySelector(
			'[data-cy="participant-overflow"]'
		)!;
		await expect(chip).toHaveTextContent('+5');
		await expect(chip.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			avatar.getBoundingClientRect().right - 0.5
		);
	}
};

/** Hover-only users can dismiss a name without first focusing the avatar. */
export const HoverEscape: Story = {
	args: ThreeParticipants.args,
	play: async ({ canvasElement }) => {
		const avatar = canvasElement.querySelector<HTMLElement>(
			'[data-cy="participant-avatar"]'
		)!;
		const tip = canvasElement.querySelector<HTMLElement>(
			'[data-cy="participant-tooltip"]'
		)!;
		await userEvent.hover(avatar);
		await waitFor(() => expect(tip).toBeVisible());
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(tip).not.toBeVisible());
		await expect(tip).toHaveAttribute('aria-hidden', 'true');
		await userEvent.unhover(avatar);
		await userEvent.hover(avatar);
		await waitFor(() => expect(tip).toBeVisible());
		await userEvent.unhover(avatar);
	}
};

/** A tooltip remains available while either its avatar is hovered or focused. */
export const MixedHoverAndFocus: Story = {
	args: ThreeParticipants.args,
	play: async ({ canvasElement }) => {
		const avatars = canvasElement.querySelectorAll<HTMLElement>(
			'[data-cy="participant-avatar"]'
		);
		const tips = canvasElement.querySelectorAll<HTMLElement>(
			'[data-cy="participant-tooltip"]'
		);
		avatars[0].focus();
		await userEvent.hover(avatars[1]);
		await waitFor(() => expect(tips[1]).toBeVisible());
		await userEvent.unhover(avatars[1]);
		await waitFor(() => expect(tips[0]).toBeVisible());
		await userEvent.hover(avatars[0]);
		avatars[0].blur();
		await waitFor(() => expect(tips[0]).toBeVisible());
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(tips[0]).not.toBeVisible());
		await userEvent.unhover(avatars[0]);
	}
};
